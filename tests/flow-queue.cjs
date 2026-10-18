const assert = require('node:assert/strict')
const {test} = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
function load(file, mocks = {}) {
  const js = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023}}).outputText
  const module = {exports: {}}
  new Function('require', 'module', 'exports', js)(name => mocks[name] ?? require(name), module, module.exports)
  return module.exports
}
const {WorkQueue} = load('main/workQueue.ts')
const {FlowSetupError, flowFailure} = load('shared/flowErrors.ts')
const tick = () => new Promise(resolve => setImmediate(resolve))
function deferred() { let resolve, reject; const promise = new Promise((a,b) => {resolve=a; reject=b}); return {promise, resolve, reject} }

test('image work overlaps to configured limit, FIFO and release is idempotent', async () => {
  const q = new WorkQueue(() => 2), signal = new AbortController().signal
  const r1 = await q.acquire(signal), r2 = await q.acquire(signal)
  const started = []
  const p3 = q.acquire(signal).then(release => {started.push(3); return release})
  const p4 = q.acquire(signal).then(release => {started.push(4); return release})
  await tick(); assert.deepEqual(started, [])
  r1(); r1(); const r3 = await p3; await tick(); assert.deepEqual(started, [3])
  r2(); const r4 = await p4; assert.deepEqual(started, [3,4]); r3(); r4()
})
test('queued cancellation is immediate and does not consume a slot', async () => {
  const q = new WorkQueue(() => 1), canceled = new AbortController()
  const release = await q.acquire(new AbortController().signal)
  const dead = q.acquire(canceled.signal); canceled.abort(); await assert.rejects(dead, /Canceled/)
  let started = false
  const live = q.acquire(new AbortController().signal).then(release => {started=true; return release})
  await tick(); assert.equal(started,false); release(); (await live)(); assert.equal(started,true)
})
function fixture() {
  const rows = new Map(), events = []
  const api = load('main/jobs.ts', {
    './workQueue': {WorkQueue}, '@shared/flowErrors': {FlowSetupError}, './settings': {getSettings: () => ({flowImageConcurrency:2})},
    './events': {emit: {job: j => events.push({...j})}}, './services/higgsfield': {cancelRequest: async () => {}},
    './repo': {getJobRaw: id => rows.get(id), updateJob: (id,patch) => {Object.assign(rows.get(id),patch); return rows.get(id)}}
  })
  function start(id, task, lane='flow2api') { const job={id, kind:'image', provider: lane.startsWith('flow2api')?'flow2api':'higgsfield', status:'queued'}; rows.set(id,job); api.runJob(job,lane,task); return job }
  return {api, rows, events, start}
}
test('setup failure cancels waiting Flow jobs; existing requests and other providers finish; retry needs no resume', async () => {
  const f=fixture(), a=deferred(), b=deferred(), starts=[]
  f.start('a',()=>a.promise); f.start('b',()=>b.promise)
  f.start('c',async()=>{starts.push('c')}); f.start('d',async()=>{starts.push('d')})
  f.start('sheet',async()=>{throw flowFailure('CAPTCHA unavailable [captcha/captcha_script_failed]')},'flow2api-sheet')
  f.start('waiting-sheet',async()=>{starts.push('waiting-sheet')},'flow2api-sheet')
  await tick(); assert.equal(f.rows.get('a').status,'running'); assert.equal(f.rows.get('b').status,'running')
  assert.equal(f.rows.get('sheet').status,'failed')
  for (const id of ['c','d','waiting-sheet']) assert.equal(f.rows.get(id).status,'canceled')
  assert.deepEqual(starts,[])
  a.resolve(); b.resolve(); f.start('other',async()=>{starts.push('other')},'higgsfield'); await tick()
  assert.equal(f.rows.get('a').status,'done'); assert.equal(f.rows.get('b').status,'done')
  f.start('retry',async()=>{starts.push('retry')}); await tick()
  assert.deepEqual(starts,['other','retry']); assert.equal(f.rows.get('retry').status,'done')
})
test('ordinary failures do not pause the queue, sheets have an independent lane', async () => {
  const f=fixture(), blocker=deferred()
  f.start('a',()=>blocker.promise); f.start('b',async()=>{throw new Error('individual prompt failure')})
  f.start('scene',async()=>{ const done=deferred(); f.start('sheet',async()=>{done.resolve()},'flow2api-sheet'); await done.promise })
  await tick(); await tick(); assert.equal(f.rows.get('scene').status,'done'); assert.equal(f.rows.get('sheet').status,'done'); blocker.resolve(); await tick()
})
test('failure mapping retains safe diagnostics without reflecting upstream secrets', () => {
  const e=flowFailure({message:'cookie=TOP_SECRET [captcha/captcha_timeout]'})
  assert.ok(e instanceof FlowSetupError); assert.match(e.message,/captcha_timeout/); assert.doesNotMatch(e.message,/TOP_SECRET/)
  assert.ok(flowFailure('account bad [rpc/account_mismatch]') instanceof FlowSetupError)
  assert.ok(!(flowFailure('individual prompt failed TOP_SECRET') instanceof FlowSetupError))
})

test('SSE and HTTP CAPTCHA errors reach the queue classifier; successful images still decode', async () => {
  const oldFetch=global.fetch
  const api=load('main/services/flow2api.ts', {
    '@shared/media': {flowModelId: id => id, FLOW_PREFIX:'flow2api:'}, '@shared/flowErrors':{flowFailure},
    '../secrets':{requireSecret:()=> 'fake-key'}, '../settings':{getSettings:()=>({flowLocalEnabled:false,flowBaseUrl:'http://localhost:8000'})},
    './http':{downloadTo:async()=>{throw new Error('unexpected download')}}, '../flowSetup':{LOCAL_FLOW_URL:'http://localhost:8000',flowSetupStatus:()=>({state:'stopped'})}
  })
  const run=()=>api.generate('gemini-image','test',[],'image',new AbortController().signal,()=>{})
  try {
    for (const response of [
      new Response(JSON.stringify({error:{message:'private-cookie [captcha/captcha_script_policy]'}}),{status:500,headers:{'content-type':'application/json'}}),
      new Response('data: '+JSON.stringify({error:'private-cookie [captcha/captcha_library_unavailable]'})+'\n\n',{headers:{'content-type':'text/event-stream'}})
    ]) {
      global.fetch=async()=>response
      await assert.rejects(run(),error=>error instanceof FlowSetupError && !error.message.includes('private-cookie'))
    }
    global.fetch=async()=>new Response('data: '+JSON.stringify({choices:[{delta:{content:'![image](data:image/png;base64,aGVsbG8=)'}}]})+'\n\ndata: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}})
    const result=await run(); assert.equal(result.bytes.toString(),'hello'); assert.equal(result.contentType,'image/png')
  } finally {global.fetch=oldFetch}
})
