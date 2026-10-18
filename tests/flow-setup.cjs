const assert = require('node:assert/strict')
const {test} = require('node:test')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const {EventEmitter} = require('node:events')
const ts = require('typescript')

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bang-flow-pairing-'))
  const source = fs.readFileSync(path.join(__dirname, '../src/main/flowSetup.ts'), 'utf8')
  const revision = source.match(/const REV = '([^']+)'/)[1]
  for (const file of ['source/main.py', 'python/python.exe', 'browsers/chromium-test/chrome-win/chrome.exe']) {
    fs.mkdirSync(path.dirname(path.join(root, file)), {recursive: true})
    fs.writeFileSync(path.join(root, file), '')
  }
  fs.writeFileSync(path.join(root, 'installed.json'), JSON.stringify({repository: 'Exeloxylade/flow2api-English', revision}))
  const tokens = [], requests = [], events = [], opened = [], spawns = []
  const state = {email: 'one@example.com', failCheck: false, phase: 'ready', onOpen: null, replacedJob: false}
  let settings = {flowLocalEnabled: false}
  const secrets = new Map()
  const child = new EventEmitter(); child.pid = 123; child.exitCode = null; child.stderr = new EventEmitter()
  const deps = {
    'node:child_process': {spawn: (_file, args) => {spawns.push(args); return child}, execFileSync() {}},
    'node:net': {createServer: () => ({once() {}, listen(_p, _h, cb) {cb()}, close(cb) {cb()}})},
    electron: {BrowserWindow: class {}, session: {}, shell: {openExternal: async url => {opened.push(url); if (state.onOpen) await state.onOpen()}}},
    '@shared/media': {defaultFlowModel: kind => 'flow2api:' + kind},
    './paths': {dataDir: () => root},
    './secrets': {getSecret: k => secrets.get(k), requireSecret: k => secrets.get(k), setSecret: (k, v) => secrets.set(k, v), recordCheck() {}},
    './settings': {getSettings: () => settings, setSettings: value => {settings = {...settings, ...value}}},
    './events': {emit: {flow: value => events.push(value)}},
    './services/http': {sleep: async () => {}},
    './flowSource': {replaceFlowSource() {}},
    './flowAccounts': {captureFlowLogin() {throw Error('Automated login must not run')}, removeAccountProfile() {}}
  }
  const job = '12345678-1234-1234-1234-123456789abc'
  async function fetchMock(url, options = {}) {
    if (options.signal?.aborted) throw new Error('Aborted')
    requests.push({url, method: options.method, body: options.body})
    let result = {success: true}
    if (url.endsWith('/api/admin/login')) result = {token: 'private-admin-session'}
    else if (url.endsWith('/v1/models')) result = {data: []}
    else if (url.endsWith('/api/tokens')) {
      if (state.failCheck) return {ok: false, status: 500}
      result = tokens.map(t => ({...t}))
    } else if (url.endsWith('/browser-login/start')) result = {job_id: job, phase: 'login', pairing_code: '8765:' + 'a'.repeat(64)}
    else if (url.endsWith('/browser-login/status')) {
      if (state.phase === 'ready') {
        let existing = tokens.find(t => t.email === state.email)
        if (!existing) {existing = {id: tokens.length + 1, email: state.email}; tokens.push(existing)}
        Object.assign(existing, {is_active: true, at: 'private-at', at_expired: false})
        result = {job_id: state.replacedJob ? 'other-job' : job, phase: 'ready', account: {id: existing.id, email: state.email}}
      } else result = {job_id: job, phase: state.phase, error_code: state.error_code}
    }
    return {ok: true, status: 200, json: async () => result}
  }
  const js = ts.transpileModule(source.replace("join(dataDir(), 'tools', 'flow2api')", JSON.stringify(root)), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023}}).outputText
  const module = {exports: {}}
  new Function('require', 'module', 'exports', 'fetch', js)(name => deps[name] ?? require(name), module, module.exports, fetchMock)
  return {root, api: module.exports, state, tokens, requests, events, opened, spawns, child, get settings() {return settings}, clean: () => fs.rmSync(root, {recursive: true, force: true})}
}

test('connect pairs the normal browser, adds accounts, and never launches a login helper or transfers cookies through IPC', async () => {
  const f = fixture()
  try {
    await f.api.connectFlowAccount()
    assert.equal(f.settings.imageModel, 'flow2api:image')
    assert.equal(f.api.flowSetupStatus().accountReady, true)
    assert.ok(f.events.some(s => s.pairingCode === '8765:' + 'a'.repeat(64)))
    assert.equal(f.api.flowSetupStatus().pairingCode, null)
    assert.deepEqual(f.opened, ['https://flow.google.com/'])
    assert.equal(f.spawns.length, 1)
    assert.match(f.spawns[0][0], /bang-story-runner\.py$/)
    assert.equal(JSON.stringify(f.events).includes('private-'), false)
    assert.equal(JSON.stringify(f.requests).includes('google_cookies'), false)
    await f.api.connectFlowAccount()
    assert.equal(f.tokens.length, 1)
    f.state.email = 'two@example.com'
    await f.api.connectFlowAccount()
    assert.equal(f.tokens.length, 2)
  } finally {f.clean()}
})
test('reconnect binds the server pairing to an existing account ID', async () => {
  const f = fixture()
  try {
    await f.api.connectFlowAccount()
    await f.api.connectFlowAccount(1)
    const starts = f.requests.filter(r => r.url.endsWith('/browser-login/start'))
    assert.deepEqual(JSON.parse(starts[1].body), {expected_account_id: 1})
    assert.equal(f.tokens.length, 1)
  } finally {f.clean()}
})

test('server runner preserves the selected CAPTCHA provider at startup and after database reload', async () => {
  const f = fixture()
  try {
    await f.api.connectFlowAccount()
    const runner = fs.readFileSync(path.join(f.root, 'source/bang-story-runner.py'), 'utf8')
    const harness = `
import asyncio, os, sys, types
settings={'captcha':{'captcha_method':'extension'},'server':{},'debug':{},'global':{}}
class Config:
    def get_raw_config(self): return settings
config=Config()
class Database:
    async def reload_config_to_memory(self):
        settings['captcha']['captcha_method']='extension'
def module(name, **members):
    value=types.ModuleType(name)
    value.__dict__.update(members)
    sys.modules[name]=value
for name in ['src','src.core','src.services']: module(name)
module('src.core.config',config=config)
module('src.core.database',Database=Database)
module('src.main',app=object())
module('src.services.browser_captcha_personal',BrowserCaptchaService=type('FakeBrowser',(),{}))
def run(app, **options):
    assert settings['captcha']['captcha_method']=='extension', 'startup overwrote provider'
    asyncio.run(Database().reload_config_to_memory())
    assert settings['captcha']['captcha_method']=='extension', 'reload overwrote provider'
module('uvicorn',run=run)
os.environ['BANG_FLOW_KEY']='fixture-api'
os.environ['BANG_FLOW_ADMIN']='fixture-admin'
exec(sys.stdin.read(),{})
print('provider preserved')
`
    const output = require('node:child_process').execFileSync(process.env.PYTHON || 'python', ['-c', harness], {input: runner, encoding: 'utf8', windowsHide: true})
    assert.match(output, /provider preserved/)
  } finally {f.clean()}
})

test('paired browser accounts require their live tab and a successful credit check, independent of marker expiry', async () => {
  const f = fixture()
  try {
    await f.api.connectFlowAccount()
    Object.assign(f.tokens[0], {browser_bridge: true, browser_connected: false, credits_updated_at: '2026-10-17T00:00:00Z'})
    assert.equal((await f.api.checkFlowAccount()).accountReady, false)
    f.tokens[0].browser_connected = true
    f.tokens[0].credits_updated_at = null
    assert.equal((await f.api.checkFlowAccount()).accountReady, false)
    f.tokens[0].credits_updated_at = '2026-10-17T00:00:00Z'
    f.tokens[0].at_expired = true
    assert.equal((await f.api.checkFlowAccount()).accountReady, true)
  } finally {f.clean()}
})
test('cancel invalidates the server pairing, clears its code, and leaves the normal browser alone', async () => {
  const f = fixture()
  try {
    f.state.onOpen = async () => {
      await assert.rejects(f.api.connectFlowAccount(), /sedang berjalan/)
      f.api.cancelFlowConnect()
    }
    await f.api.connectFlowAccount()
    assert.equal(f.tokens.length, 0)
    assert.equal(f.api.flowSetupStatus().pairingCode, null)
    assert.equal(f.api.flowSetupStatus().connecting, false)
    assert.ok(f.requests.some(r => r.url.endsWith('/browser-login/cancel')))
    f.state.onOpen = null
    await f.api.connectFlowAccount()
    assert.equal(f.tokens.length, 1)
  } finally {f.clean()}
})
test('failed verification clears pairing and does not select Flow models', async () => {
  const f = fixture()
  try {
    f.state.phase = 'error'
    await assert.rejects(f.api.connectFlowAccount(), /terverifikasi/)
    assert.equal(f.settings.imageModel, undefined)
    assert.equal(f.api.flowSetupStatus().pairingCode, null)
  } finally {f.clean()}
})
test('a stale account check prevents creating a new pairing', async () => {
  const f = fixture()
  try {
    f.state.failCheck = true
    await assert.rejects(f.api.connectFlowAccount(), /diperiksa/)
    assert.equal(f.opened.length, 0)
    assert.equal(f.requests.some(r => r.url.endsWith('/browser-login/start')), false)
  } finally {f.clean()}
})
test('accepted pairing failures retain their safe reason instead of being called expired', async () => {
  const f = fixture()
  try {
    f.state.phase = 'error'
    f.state.error_code = 'flow_signin_redirect'
    await assert.rejects(f.api.connectFlowAccount(), /flow_signin_redirect/)
    assert.match(f.api.flowSetupStatus().error, /Kode pairing diterima/)
    const log = fs.readFileSync(path.join(f.root, 'startup.log'), 'utf8')
    assert.match(log, /Account connection failed: flow_signin_redirect/)
    assert.equal(log.includes('private-'), false)
  } finally {f.clean()}
})
test('guide opens in the normal browser and diagnostic logging excludes raw stderr', async () => {
  const f = fixture()
  try {
    await assert.rejects(f.api.openFlowConnectorGuide(), /dulu/)
    await f.api.connectFlowAccount()
    await f.api.openFlowConnectorGuide()
    assert.equal(f.opened[1], 'http://127.0.0.1:8765/setup')
    f.child.stderr.emit('data', Buffer.from('ModuleNotFoundError: private-key and private-cookies'))
    const log = fs.readFileSync(path.join(f.root, 'startup.log'), 'utf8')
    assert.match(log, /Server error category: ModuleNotFoundError/)
    assert.equal(log.includes('private-'), false)
  } finally {f.clean()}
})
test('invalid or removed reconnect IDs are rejected before pairing', async () => {
  const f = fixture()
  try {
    await assert.rejects(f.api.connectFlowAccount(-1), /tidak valid/)
    await assert.rejects(f.api.connectFlowAccount(99), /tersedia/)
    assert.equal(f.opened.length, 0)
  } finally {f.clean()}
})


test('second account credit failure ends setup with a safe reason and preserves the first account', async () => {
  const f=fixture()
  try {
    await f.api.connectFlowAccount()
    f.state.email='two@example.com'
    f.state.onOpen=async()=>{f.tokens.push({id:2,email:f.state.email,browser_bridge:true,browser_connected:true,credits_updated_at:null,last_st_refresh_result:'private-cookie [rpc/http_400]'})}
    await assert.rejects(f.api.connectFlowAccount(),/http_400/)
    const state=f.api.flowSetupStatus()
    assert.equal(state.connecting,false);assert.equal(state.pairingCode,null)
    assert.equal(state.accounts.find(a=>a.id===1).ready,true)
    assert.equal(state.accounts.find(a=>a.id===2).ready,false)
    assert.match(state.error,/Pairing tersimpan/);assert.match(state.error,/Tidak perlu pairing ulang/)
    assert.ok(!JSON.stringify(f.events).includes('private-cookie'))
  } finally {f.clean()}
})
