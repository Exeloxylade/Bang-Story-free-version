const assert = require('node:assert/strict')
const {test} = require('node:test')
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript')
function load(file, mocks = {}) {
 const module = {exports:{}}
 const js = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023}}).outputText
 new Function('require','module','exports',js)(name => mocks[name] ?? require(name),module,module.exports)
 return module.exports
}
const speech = load('shared/speech.ts')
const enc = load('main/exportEncoding.ts')
const caps = {logicalCores:16,encoders:[{id:'cpu',available:true},{id:'amd',available:true},{id:'intel',available:false},{id:'nvidia',available:false}]}
test('clean narration retains spoken words, silent pause tags and scene boundaries', () => {
 const original='The soldiers waited. <sigh>\n<long pause>\n[whispers] Then they marched. <breath> <gasp> <chuckles>'
 const clean=speech.cleanNarrationText(original)
 assert.deepEqual(speech.spokenWords(clean),speech.spokenWords(original))
 assert.match(clean,/\n<long pause>\n/)
 assert.doesNotMatch(clean,/sigh|whisper|breath|gasp|chuckle/)
 assert.equal(speech.cleanNarrationText('He gasped at the news.'),'He gasped at the news.')
})
test('Gemini delivery instructions are metadata, never transcript', async () => {
 let request
 const api=load('main/services/gemini.ts', {
  '@shared/speech':speech, '@shared/models':{}, '../secrets':{requireSecret:()=> 'fake'},
  '../settings':{getSettings:()=>({geminiTtsModel:'gemini-3.8-flash-tts'})},
  './audio':{isWav:()=>true}, './json':{},
  '@google/genai':{GoogleGenAI:class {models={generateContent:async r=>{request=r;return {candidates:[{content:{parts:[{inlineData:{data:Buffer.from('RIFF').toString('base64'),mimeType:'audio/wav'}}]}}]}}}}}
 })
 await api.speak('Hello. <sigh>\n<long pause>\nWorld.','Kore','en')
 const part=request.contents[0].parts[0]
 assert.equal(part.text,'Hello. \n<long pause>\nWorld.')
 assert.equal(part.speechMetadata.style,speech.CLEAN_NARRATION_STYLE)
 assert.doesNotMatch(part.text,/No audible breathing/)
})
test('resource plans bound workers, memory and CPU thread budget', () => {
 assert.deepEqual(enc.renderPlan({resources:'responsive',resolution:1080},caps,32*1024**3),{encoder:'amd',workers:1,threads:4})
 assert.deepEqual(enc.renderPlan({resources:'maximum',encoder:'cpu',resolution:1080},caps,32*1024**3),{encoder:'cpu',workers:4,threads:16})
 assert.equal(enc.renderPlan({resources:'maximum',resolution:2160},caps,8*1024**3).workers,1)
 assert.equal(enc.renderPlan({encoder:'intel'},caps).encoder,'cpu')
 assert.throws(()=>enc.renderPlan({encoder:'shell'},caps),/tidak valid/)
 assert.throws(()=>enc.renderPlan({resources:'unlimited'},caps),/tidak valid/)
})
test('hardware fallback never swallows filter or cancellation errors', () => {
 assert.equal(enc.hardwareFailure(new Error('AMF failed to initialize')),true)
 assert.equal(enc.hardwareFailure(new Error('No such filter: perspective')),false)
 assert.equal(enc.hardwareFailure(new Error('Dibatalkan')),false)
 for(const id of ['cpu','amd','intel','nvidia']) assert.ok(enc.encodingArgs(id).includes('-c:v'))
})
