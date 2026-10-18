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
const instructions = load('shared/storyInstructions.ts', {'./speech':speech})

test('default creative prompts remain available and blank overrides restore them', () => {
 assert.match(instructions.scriptSystem('English',''),/The first scene is a strong hook/)
 assert.match(instructions.visualSystem('  '),/Keep every recurring character visually consistent/)
 for(const invalid of [null, {}, 'x'.repeat(instructions.INSTRUCTION_LIMIT+1)]) assert.equal(instructions.resolveInstructions(invalid,'default'),'default')
})
test('custom creative instructions replace defaults but retain output, language and silent pauses', () => {
 const script = instructions.scriptSystem('Indonesian','Start with a surprising question. Never add a subscribe CTA.')
 assert.match(script,/Start with a surprising question/)
 assert.doesNotMatch(script,/The last scene can invite/)
 assert.match(script,/Write everything in Indonesian/)
 assert.match(script,/JSON schema/)
 assert.match(script,/No audible breathing/)
 const visual = instructions.visualSystem('Show the consequences of the previous scene.')
 assert.match(visual,/consequences of the previous scene/)
 assert.match(visual,/only the requested numbered scenes/)
 assert.match(visual,/in English/)
})
test('settings persist independently, reject invalid overrides and support reset', () => {
 const values = new Map()
 const db={prepare: sql => ({all:()=> [...values].map(([key,value])=>({key,value})),run:(k,v)=>values.set(k,v)}),transaction:fn=>()=>fn()}
 const api=load('main/settings.ts', {
  '@shared/storyInstructions':instructions,
  '@shared/higgsfield':{DEFAULT_IMAGE_MODEL:'image',DEFAULT_VIDEO_MODEL:'video',getImageModel:id=>({id}),getVideoModel:id=>({id})},
  '@shared/media':{isFlowModel:()=>false}, './db':{getDb:()=>db}
 })
 assert.equal(api.getSettings().scriptInstructions,'')
 api.setSettings({scriptInstructions:'My hook'})
 api.setSettings({visualInstructions:'My continuity'})
 assert.equal(api.getSettings().scriptInstructions,'My hook')
 assert.equal(api.getSettings().visualInstructions,'My continuity')
 assert.throws(()=>api.setSettings({scriptInstructions:42}),/Instruksi/)
 assert.throws(()=>api.setSettings({visualInstructions:'x'.repeat(instructions.INSTRUCTION_LIMIT+1)}),/Instruksi/)
 api.setSettings({scriptInstructions:''})
 assert.equal(api.getSettings().scriptInstructions,'')
 assert.equal(api.getSettings().visualInstructions,'My continuity')
})
test('actual story pipeline uses saved instructions and preserves schemas and project context', async () => {
 const settings={scriptInstructions:'Start with an unanswered question.',visualInstructions:'Progress the action between scenes.'}
 const project={title:'Test',synopsis:'What if the Mongol Empire survived?',language:'en',durationSec:360,styleId:'stickman-minimalist',aspectRatio:'16:9'}
 const clips=[{id:'one',title:'First',story:'An empire survives.',narration:'The empire survived.',cameraPreset:'static',motionStrength:'halus',transition:'cut'}]
 const requests=[]
 let replaced, applied
 const api=load('main/story.ts', {
  '@shared/motion':{CAMERA_PRESETS:[{id:'static'}],MOTION_STRENGTHS:[{id:'halus'}],TRANSITIONS:[{id:'cut'}]},
  '@shared/models':{LANGUAGES:[{code:'en',english:'English'}],clipCountFor:()=>65},
  '@shared/script':{estimateNarrationMs:()=>5000,needsVisual:()=>true},
  '@shared/storyInstructions':instructions,'@shared/styles':{getStyle:()=>({name:'Stickman minimalist'})},
  './settings':{getSettings:()=>({...settings})},
  './repo':{getProject:()=>project,getBundle:()=>({project,clips}),clipsOf:()=>clips,charactersOf:()=>[{name:'Khan',description:'red headband'}],replaceScript:(...args)=>{replaced=args},applyVisuals:(...args)=>{applied=args}},
  './services/llm':{generateJson:async req=>{requests.push(req);return req.name==='script'?{title:'Title',scenes:[{title:'First',story:'Story',narration:'Words'}]}:{world:'Empire',characters:[],scenes:[{scene:1,setting:'Mongolia',action:'The Khan stands.',camera:'static',strength:'halus',transition:'cut'}]}}}
 })
 await api.generateScript('project')
 await api.generateVisuals('project','all')
 assert.match(requests[0].system,/Start with an unanswered question/)
 assert.match(requests[0].prompt,/Write exactly 65 scenes/)
 assert.match(requests[1].system,/Progress the action between scenes/)
 assert.match(requests[1].prompt,/Full script:/)
 assert.match(requests[1].prompt,/Stickman minimalist/)
 assert.match(requests[1].prompt,/Khan: red headband/)
 assert.equal(replaced[2][0].narration,'Words')
 assert.equal(applied[2][0].clipId,'one')
 const schemas=requests.map(r=>r.schema)
 settings.scriptInstructions='';settings.visualInstructions=''
 await api.generateScript('project');await api.generateVisuals('project','all')
 assert.deepEqual(requests[2].schema,schemas[0]);assert.deepEqual(requests[3].schema,schemas[1])
})
