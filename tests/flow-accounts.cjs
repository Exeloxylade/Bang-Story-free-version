const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { EventEmitter } = require('node:events')
const ts = require('typescript')

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bang-flow-test-'))
  const script = path.join(root, 'browser_login.py')
  fs.writeFileSync(script, '# pinned Flow2API login helper')
  const calls = []
  let scenario = { code: 0, output: JSON.stringify({ email: 'one@example.com', cookies: [{ name: 'OSID', value: 'fake' }] }) }
  const childProcess = {
    spawn(_python, _args, options) {
      const child = new EventEmitter()
      child.stdout = new EventEmitter()
      child.pid = 12345
      child.exitCode = null
      calls.push(options)
      if (!scenario.hang) setImmediate(() => {
        child.stdout.emit('data', Buffer.from(scenario.output))
        child.exitCode = scenario.code
        child.emit('close', scenario.code)
      })
      child.kill = () => { child.exitCode = 1; child.emit('close', 1) }
      childProcess.child = child
      return child
    },
    execFileSync() { childProcess.child.kill() }
  }
  const source = fs.readFileSync(path.join(__dirname, '../src/main/flowAccounts.ts'), 'utf8')
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', js)(name => name === 'node:child_process' ? childProcess : require(name), module, module.exports)
  return { root, calls, api: module.exports, set: value => { scenario = { ...scenario, ...value } }, options: signal => ({ root, script, python: 'test-python', chromium: 'test-browser', signal: signal ?? new AbortController().signal }), clean: () => fs.rmSync(root, { recursive: true, force: true }) }
}

test('profiles stay isolated, reconnect reuses profile, and removal preserves another account', async () => {
  const f = fixture()
  try {
    const first = await f.api.captureFlowLogin(f.options()); first.commit()
    f.set({ output: JSON.stringify({ email: 'two@example.com', cookies: [{}] }) })
    const second = await f.api.captureFlowLogin(f.options()); second.commit()
    assert.notEqual(f.calls[0].env.BANG_LOGIN_PROFILE, f.calls[1].env.BANG_LOGIN_PROFILE)
    f.set({ output: JSON.stringify({ email: 'one@example.com', cookies: [{}] }) })
    const reconnect = await f.api.captureFlowLogin({ ...f.options(), email: 'one@example.com' }); reconnect.commit()
    assert.equal(f.calls[0].env.BANG_LOGIN_PROFILE, f.calls[2].env.BANG_LOGIN_PROFILE)
    f.api.removeAccountProfile(f.root, 'one@example.com')
    assert.equal(fs.existsSync(f.calls[0].env.BANG_LOGIN_PROFILE), false)
    assert.equal(fs.existsSync(f.calls[1].env.BANG_LOGIN_PROFILE), true)
  } finally { f.clean() }
})

test('adding the same email replaces its profile and keeps one mapping', async () => {
  const f = fixture()
  try {
    const a = await f.api.captureFlowLogin(f.options()); a.commit()
    const b = await f.api.captureFlowLogin(f.options()); b.commit()
    assert.equal(JSON.parse(fs.readFileSync(path.join(f.root, 'account-profiles.json'))).length, 1)
    assert.equal(fs.existsSync(f.calls[0].env.BANG_LOGIN_PROFILE), false)
  } finally { f.clean() }
})

for (const [label, scenario] of [
  ['closed browser', { code: 2, output: '' }],
  ['wrong identity', { code: 3, output: 'sensitive upstream error' }],
  ['malformed output', { output: 'sensitive upstream error' }],
  ['oversized payload', { output: 'x'.repeat(524289) }],
  ['empty cookies', { output: JSON.stringify({ email: 'one@example.com', cookies: [] }) }]
]) test(`${label} cleans up the new profile and keeps credentials out of errors`, async () => {
  const f = fixture()
  try {
    f.set(scenario)
    await assert.rejects(f.api.captureFlowLogin(f.options()), error => !error.message.includes('sensitive upstream'))
    assert.equal(fs.readdirSync(path.join(f.root, 'account-profiles')).length, 0)
  } finally { f.clean() }
})

test('cancel kills the helper and browser tree and allows retry', async () => {
  const f = fixture()
  try {
    f.set({ hang: true })
    const controller = new AbortController()
    const pending = f.api.captureFlowLogin(f.options(controller.signal))
    controller.abort()
    await assert.rejects(pending, /dibatalkan/)
    f.set({ hang: false })
    const retry = await f.api.captureFlowLogin(f.options()); retry.discard()
  } finally { f.clean() }
})

test('wrong account cannot replace an existing saved profile', async () => {
  const f = fixture()
  try {
    const original = await f.api.captureFlowLogin(f.options()); original.commit()
    f.set({ output: JSON.stringify({ email: 'other@example.com', cookies: [{}] }) })
    await assert.rejects(f.api.captureFlowLogin({ ...f.options(), email: 'one@example.com' }))
    assert.equal(fs.existsSync(f.calls[0].env.BANG_LOGIN_PROFILE), true)
  } finally { f.clean() }
})

test('profile metadata rejects directory traversal before deleting anything', () => {
  const f = fixture()
  try {
    fs.writeFileSync(path.join(f.root, 'account-profiles.json'), JSON.stringify([{ email: 'one@example.com', directory: '../../outside' }]))
    assert.throws(() => f.api.removeAccountProfile(f.root, 'one@example.com'), /profil Flow/)
  } finally { f.clean() }
})

test('outdated server without a login helper is rejected before opening a browser', async () => {
  const f = fixture()
  try {
    await assert.rejects(f.api.captureFlowLogin({ ...f.options(), script: path.join(f.root, 'missing.py') }), /perlu diperbarui/)
    assert.equal(f.calls.length, 0)
  } finally { f.clean() }
})
