const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { EventEmitter } = require('node:events')
const ts = require('typescript')

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bang-flow-setup-'))
  const source = fs.readFileSync(path.join(__dirname, '../src/main/flowSetup.ts'), 'utf8')
  const revision = source.match(/const REV = '([^']+)'/)[1]
  fs.mkdirSync(path.join(root, 'source'), { recursive: true })
  fs.mkdirSync(path.join(root, 'python'), { recursive: true })
  fs.mkdirSync(path.join(root, 'browsers/chromium-test/chrome-win'), { recursive: true })
  for (const file of ['source/main.py', 'python/python.exe', 'browsers/chromium-test/chrome-win/chrome.exe']) fs.writeFileSync(path.join(root, file), '')
  fs.writeFileSync(path.join(root, 'installed.json'), JSON.stringify({ repository: 'Exeloxylade/flow2api-English', revision }))
  const tokens = [], mutations = [], events = []
  let identity = 'one@example.com', failCheck = false, discarded = false, committed = false
  let settings = { flowLocalEnabled: false }
  let captureHook
  const secrets = new Map()
  const child = new EventEmitter(); child.pid = 123; child.exitCode = null
  const deps = {
    'node:child_process': { spawn: () => child, execFileSync: () => {} },
    'node:net': { createServer: () => ({ once() {}, listen(_port, _host, cb) { cb() }, close(cb) { cb() } }) },
    electron: { BrowserWindow: class {}, session: {} },
    '@shared/media': { defaultFlowModel: kind => 'flow2api:' + kind },
    './paths': { dataDir: () => path.dirname(path.dirname(root)) },
    './secrets': { getSecret: k => secrets.get(k), requireSecret: k => secrets.get(k), setSecret: (k, v) => secrets.set(k, v), recordCheck() {} },
    './settings': { getSettings: () => settings, setSettings: value => { settings = { ...settings, ...value } } },
    './events': { emit: { flow: value => events.push(value) } },
    './services/http': { sleep: async () => {} },
    './flowSource': { replaceFlowSource() {} },
    './flowAccounts': {
      captureFlowLogin: async options => {
        if (captureHook) await captureHook(options)
        return { email: identity, google_cookies: 'private-cookies', commit() { committed = true }, discard() { discarded = true } }
      },
      removeAccountProfile() {}
    }
  }
  // Keep the real path helpers, but redirect the managed installation to this disposable fixture.
  const js = ts.transpileModule(source.replace("join(dataDir(), 'tools', 'flow2api')", JSON.stringify(root)), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } }).outputText
  async function fetchMock(url, options = {}) {
    let result = { success: true }
    if (url.endsWith('/api/admin/login')) result = { token: 'private-admin-session' }
    else if (url.endsWith('/v1/models')) result = { data: [] }
    else if (url.endsWith('/api/tokens') && !options.method) {
      if (failCheck) return { ok: false, status: 500 }
      result = tokens.map(t => ({ ...t }))
    } else {
      mutations.push({ url, method: options.method, body: options.body })
      const match = url.match(/\/api\/tokens\/(\d+)/)
      if (options.method === 'POST' && !match) tokens.push({ id: tokens.length + 1, email: JSON.parse(options.body).login_account, is_active: true, at: 'private-at', at_expired: false })
      if (options.method === 'PUT') Object.assign(tokens.find(t => t.id === Number(match[1])), { at_expired: false })
      if (url.endsWith('/enable')) tokens.find(t => t.id === Number(match[1])).is_active = true
      if (options.method === 'DELETE') tokens.splice(tokens.findIndex(t => t.id === Number(match[1])), 1)
    }
    return { ok: true, status: 200, json: async () => result }
  }
  const module = { exports: {} }
  new Function('require', 'module', 'exports', 'fetch', js)(name => deps[name] ?? require(name), module, module.exports, fetchMock)
  return { api: module.exports, tokens, mutations, events, identity: value => { identity = value }, failCheck: () => { failCheck = true }, capture: fn => { captureHook = fn }, get settings() { return settings }, get committed() { return committed }, get discarded() { return discarded }, clean: () => fs.rmSync(root, { recursive: true, force: true }) }
}

test('connect enables local mode, registers once, adds another account and reconnects without duplicates', async () => {
  const f = fixture()
  try {
    await f.api.connectFlowAccount()
    assert.equal(f.settings.flowLocalEnabled, true)
    assert.equal(f.settings.imageModel, 'flow2api:image')
    assert.equal(f.committed, true)
    await f.api.connectFlowAccount()
    assert.equal(f.tokens.length, 1)
    assert.equal(f.mutations[1].method, 'PUT')
    f.identity('two@example.com')
    await f.api.connectFlowAccount()
    assert.equal(f.tokens.length, 2)
    const status = f.api.flowSetupStatus()
    assert.equal(status.activeAccounts, 2)
    assert.equal(status.connecting, false)
    assert.equal(JSON.stringify(status).includes('private-'), false)
    assert.equal(JSON.stringify(f.events).includes('private-'), false)
    await f.api.removeFlowAccount(1)
    assert.equal(f.tokens.length, 1)
  } finally { f.clean() }
})

test('failed account listing prevents registration using stale account state', async () => {
  const f = fixture()
  try {
    await f.api.connectFlowAccount()
    f.failCheck()
    await assert.rejects(f.api.connectFlowAccount(), /examine|diperiksa/)
    assert.equal(f.mutations.length, 1)
    assert.equal(f.api.flowSetupStatus().accountReady, false)
  } finally { f.clean() }
})

test('cancelled login does not register credentials and releases connection lock', async () => {
  const f = fixture()
  try {
    f.capture(async options => {
      await assert.rejects(f.api.connectFlowAccount(), /sedang berjalan/)
      f.api.cancelFlowConnect()
      assert.equal(options.signal.aborted, true)
    })
    await f.api.connectFlowAccount()
    assert.equal(f.tokens.length, 0)
    assert.equal(f.discarded, true)
    assert.equal(f.api.flowSetupStatus().connecting, false)
    f.capture(undefined)
    await f.api.connectFlowAccount()
    assert.equal(f.tokens.length, 1)
  } finally { f.clean() }
})

test('invalid account IDs are rejected before side effects', async () => {
  const f = fixture()
  try {
    await assert.rejects(f.api.connectFlowAccount(-1), /tidak valid/)
    await assert.rejects(f.api.removeFlowAccount('../1'), /tidak valid/)
    assert.equal(f.mutations.length, 0)
  } finally { f.clean() }
})
