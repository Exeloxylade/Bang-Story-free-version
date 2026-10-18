const assert=require('node:assert/strict'), {test}=require('node:test')
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),ts=require('typescript')
const root=path.resolve(__dirname,'..'), cache=new Map()
function load(file,mocks={}) {
 const filename=path.join(root,'src',file), module={exports:{}}
 const js=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023,esModuleInterop:true}}).outputText
 const local=name=>mocks[name] ?? (name.startsWith('@shared/') ? shared(name.slice(8)+'.ts') : name.startsWith('.') ? require(path.resolve(path.dirname(filename),name)) : require(name))
 new Function('require','module','exports',js)(local,module,module.exports)
 return module.exports
}
function shared(file) {if(!cache.has(file))cache.set(file,load('shared/'+file));return cache.get(file)}
const fx=shared('scenePulse.ts')
function fixture() {
 const project={id:'project',styleId:'stickman',aspectRatio:'16:9',editor:{scenePulse:{...fx.DEFAULT_SCENEPULSE,enabled:true}}}
 const clips=[0,1].map(i=>({id:'scene-'+i,sort:i,title:'Scene '+i,narration:'Keep my exact words.',visualPrompt:'Snowy landscape',
  durationMs:3000,imageAssetId:'image-'+i,videoAssetId:null,motionType:'camera',cameraPreset:'static',motionStrength:'halus',
  videoCamera:'static',videoStrength:'halus',mediaInMs:0,audioAssetId:'voice-'+i,voiceInMs:0,voiceOutMs:null,voiceStartMs:0}))
 return {project,clips,assets:[]}
}
const planOf=clips=>({schemaVersion:1,sceneEffects:clips.map(fx.emptySceneEffect)})
test('bundled skill is complete, hash-preserved and includes original Bang Motion notices and 8 sounds',()=>{
 const folder=path.join(root,'resources/scenepulse'),origin=require(path.join(folder,'ORIGIN.json'))
 assert.equal(origin.skillVersion,'0.3.0')
 for(const file of origin.files) assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(folder,'skill',file.file))).digest('hex'),file.sha256,file.file)
 assert.equal(fx.EFFECT_SOUNDS.length,8)
 assert.equal(fx.EFFECT_ROLES.length,6)
 assert.match(fs.readFileSync(path.join(folder,'skill/vendor/bang-motion/LICENSE'),'utf8'),/Bang Tutorial/)
 assert.ok(origin.files.some(f=>f.file==='SKILL.md'))
})
test('bounded plans reject unknown sounds, bad gains, invalid timings, duplicate scenes and caption collisions',()=>{
 const {project,clips}=fixture(), plan=planOf(clips)
 assert.deepEqual(fx.validateScenePulsePlan(project,clips,plan),plan)
 const bad=change=>{const v=structuredClone(plan);change(v);assert.throws(()=>fx.validateScenePulsePlan(project,clips,v))}
 bad(p=>p.sceneEffects[0].audio.push({effectId:'boom',startMs:0,gainDb:-24}))
 bad(p=>p.sceneEffects[0].audio.push({effectId:'pop',startMs:0,gainDb:0}))
 bad(p=>p.sceneEffects[0].audio.push({effectId:'pop',startMs:2999,gainDb:-24}))
 bad(p=>p.sceneEffects[0].motion.amount=NaN)
 bad(p=>p.sceneEffects[1].sceneId=p.sceneEffects[0].sceneId)
 bad(p=>p.sceneEffects[0].graphics.push({presetId:'highlight-box',startMs:0,endMs:1000,x:.1,y:.75,width:.3,height:.1}))
 bad(p=>p.sceneEffects[0].script='untrusted code')
})
test('scene-relative SFX spacing is enforced across cuts, and existing camera cannot receive another camera',()=>{
 const {project,clips}=fixture(), plan=planOf(clips)
 plan.sceneEffects[0].audio=[{effectId:'pop',startMs:2400,gainDb:-24}]
 plan.sceneEffects[1].audio=[{effectId:'pop',startMs:100,gainDb:-24}]
 assert.throws(()=>fx.validateScenePulsePlan(project,clips,plan),/padat|dekat/)
 plan.sceneEffects[1].audio=[]
 clips[0].cameraPreset='zoomin'
 plan.sceneEffects[0].motion={presetId:'push-in',amount:.02}
 assert.throws(()=>fx.validateScenePulsePlan(project,clips,plan),/kamera/)
})
test('cache is reversible and invalidates changed timing/media/text while keeping independent motion and SFX choices',()=>{
 const {project,clips,assets}=fixture(),clip=clips[0], entry=fx.emptySceneEffect(clip)
 entry.audio=[{effectId:'pop',startMs:500,gainDb:-24}]
 for(const role of ['visual','sfx']) assets.push({id:role,clipId:clip.id,provider:'scenepulse',kind:role==='visual'?'video':'sfx',createdAt:1,
  meta:{scenePulse:{signature:fx.scenePulseSignature(project,clip),role,skillVersion:'0.3.0',plan:entry}}})
 assert.equal(fx.scenePulseAssets(project,clip,assets).visual.id,'visual')
 const old=fx.scenePulseSignature(project,clip)
 project.editor.scenePulse.enabled=false;project.editor.scenePulse.sfx=false
 assert.equal(fx.scenePulseSignature(project,clip),old)
 assert.equal(fx.appliedScenePulsePlan(project,clips,assets).sceneEffects[0].audio.length,0)
 project.editor.scenePulse.sfx=true;project.editor.scenePulse.enabled=true
 assert.equal(fx.appliedScenePulsePlan(project,clips,assets).sceneEffects[0].audio.length,1)
 for(const patch of [{durationMs:3500},{mediaInMs:200},{imageAssetId:'new'},{voiceInMs:100},{narration:'Changed text.'}])
  assert.equal(fx.scenePulseAssets(project,{...clip,...patch},assets).visual,null)
 assert.equal(clip.audioAssetId,'voice-0')
})
test('generation loads bundled skill into the configured LLM and publishes no partial batch after a source changes',async()=>{
 const folder=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'bang-fx-unit-'))
 const bundle=fixture();bundle.project.title='Story';bundle.project.editor.scenePulse.motion=false
 let work, request, changed=false
 const created=[]
 const api=load('main/scenePulse.ts',{
  './events':{emit:{asset:a=>created.push(a)}},'./jobs':{runJob:(job,lane,fn)=>{assert.equal(lane,'effects');work=fn;return job}},
  './repo':{activeProjectJob:()=>null,getBundle:()=>changed?{...bundle,clips:bundle.clips.map(c=>({...c,durationMs:c.durationMs+100}))}:bundle,
   insertJob:()=>({id:'job'}),insertAsset:a=>a},
  './paths':{projectDir:()=>folder},'./exporter':{},'./db':{getDb:()=>({transaction:fn=>fn})},
  './services/llm':{generateJson:async req=>{request=req;return planOf(bundle.clips)}},'./services/audio':{},
  './scenePulseRuntime':{verifyScenePulseSkill(){},scenePulseSkillDir:()=>path.join(root,'resources/scenepulse/skill'),
   renderScenePulseSfx:async()=>{changed=true},setupScenePulse:async()=>{throw Error('SFX-only must not launch a browser')}}
 })
 api.generateScenePulse('project')
 await assert.rejects(work({jobId:'job',signal:new AbortController().signal,progress(){}}),/Adegan berubah/)
 assert.match(request.system,/ScenePulse/)
 assert.match(request.system,/Bang Motion|anti-ppt/)
 assert.match(request.system,/Do not add pauses/)
 assert.equal(created.length,0)
 assert.equal(bundle.clips[0].audioAssetId,'voice-0')
 fs.rmSync(folder,{recursive:true,force:true})
})
test('Gemini planning cancellation carries the signal and never retries an aborted schema request',async()=>{
 const controller=new AbortController();let count=0
 const gemini=load('main/services/gemini.ts',{'@shared/speech':{},'@shared/models':{},'../secrets':{requireSecret:()=> 'test-only-key'},
  '../settings':{},'./audio':{},'./json':{},'@google/genai':{GoogleGenAI:class{models={generateContent:async req=>{
   count++;assert.equal(req.config.abortSignal,controller.signal);controller.abort();throw Error('INVALID_ARGUMENT schema')
  }}}}})
 await assert.rejects(gemini.generateJson('test','system','prompt',{},controller.signal),/Dibatalkan/)
 assert.equal(count,1)
})
test('failed process launch and cancellation reject cleanly without leaving a pending renderer',async()=>{
 const runtime=load('main/scenePulseRuntime.ts',{'electron':{app:{isPackaged:false,getAppPath:()=>root}},
  './paths':{binPath:p=>p,dataDir:()=>root}})
 const controller=new AbortController(), ctx={signal:controller.signal,progress(){}}
 await assert.rejects(runtime.scenePulseProcess(process.execPath,['-e','0'],ctx,path.join(root,'no-such-directory')))
 const promise=runtime.scenePulseProcess(process.execPath,['-e','setInterval(()=>{},1000)'],ctx,root)
 setTimeout(()=>controller.abort(),100)
 await assert.rejects(promise,/Dibatalkan/)
})
