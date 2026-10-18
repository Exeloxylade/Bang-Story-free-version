/* Real isolated Electron + HyperFrames + final FFmpeg export; the LLM is a local mock. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),cp=require('node:child_process'),assert=require('node:assert/strict')
const root=path.resolve(__dirname,'..'),ffmpeg=require('ffmpeg-static')
const folder=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'bs-fx-'))
const log=path.join(folder,'app.log'), planFile=path.join(folder,'plan.json')
let calls=0
const server=http.createServer(async(req,res)=>{
 let text='';for await(const chunk of req)text+=chunk
 if(req.url.endsWith('/models')) {res.setHeader('content-type','application/json');res.end(JSON.stringify({data:[{id:'scenepulse-local-test'}]}));return}
 try {
  assert.ok(req.url.endsWith('/chat/completions'))
  const body=JSON.parse(text),prompt=JSON.parse(body.messages[1].content)
  assert.match(body.messages[0].content,/--- SKILL.md ---/)
  assert.match(body.messages[0].content,/anti-ppt/)
  assert.match(body.messages[0].content,/Do not add pauses/)
  calls++
  const result={schemaVersion:1,sceneEffects:prompt.requiredSceneIds.map(id=>{
   const scene=prompt.scenes.find(c=>c.id===id),first=prompt.scenes[0].id===id
   return {sceneId:id,audio:prompt.enableSfx&&first?[{effectId:'pop',startMs:700,gainDb:-24}]:[],
    motion:{presetId:prompt.enableMotion&&scene.allowAdditionalCamera?'push-in':'static',amount:prompt.enableMotion&&scene.allowAdditionalCamera?.02:0},
    graphics:prompt.enableMotion&&first?[{presetId:'highlight-box',startMs:200,endMs:1400,x:.15,y:.1,width:.3,height:.3}]:[]}
  })}
  res.setHeader('content-type','application/json');res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(result)}}]}))
 }catch(e){res.statusCode=500;res.end(JSON.stringify({error:{message:e.message}}))}
})
const js=fn=>`(${fn.toString()})()`
const waitJob=`async function waitJob(id){for(let n=0;n<900;n++){const b=await window.api.projects.get(window.fxProject);const j=b.jobs.find(j=>j.id===id);if(j&&['done','failed','canceled'].includes(j.status)){if(j.status!=='done')throw Error(j.error||j.status);return j}await new Promise(r=>setTimeout(r,200))}throw Error('Job timeout')}`
const check=`function check(v,message){if(!v)throw Error(message)}`
async function main(){
 await new Promise(r=>server.listen(0,'127.0.0.1',r))
 const base=`http://127.0.0.1:${server.address().port}/v1`
 const exportOptions={fileName:'effects-on',folder:path.join(folder,'exports'),resolution:720,encoder:'cpu',resources:'responsive',fps:30,burnCaptions:false,writeSrt:false,normalizeAudio:false,duckMusic:false}
 const plan=[
  {main:'seed',wait:100},
  {js:`(async()=>{const p=(await window.api.projects.list())[0];window.fxProject=p.id;const b=await window.api.projects.get(p.id);b.clips=b.clips.slice(0,2).map((c,i)=>({...c,durationMs:2000,cameraPreset:'static',transition:'fade',transitionMs:200,voiceOutMs:1000,voiceStartMs:i?200:100}));b.project.editor.musicAssetId=null;await window.api.projects.save(b);await window.api.settings.set({llmProvider:'custom',customBaseUrl:${JSON.stringify(base)},llmModels:{custom:'scenepulse-local-test'}});console.log('FX_SEEDED '+p.id)})()`,wait:100},
  {main:'videos',wait:100},
  {js:`(async()=>{const b=await window.api.projects.get(window.fxProject);b.clips[0].motionType='camera';b.clips[1].mediaInMs=500;b.clips[1].videoCamera='panleft';await window.api.projects.save(b);window.fxOriginal=JSON.stringify(b.clips.map(c=>[c.id,c.narration,c.durationMs,c.imageAssetId,c.videoAssetId,c.audioAssetId,c.mediaInMs,c.voiceInMs,c.voiceOutMs,c.voiceStartMs]));console.log('FX_BASELINE '+window.fxOriginal);const OriginalAudio=window.Audio;window.fxAudio=[];window.Audio=function(src){const a=new OriginalAudio(src);window.fxAudio.push(a);return a}})()`,wait:100},
  {js:`location.reload()`,wait:1300},
  {js:`(async()=>{window.fxProject=(await window.api.projects.list())[0].id;const b=await window.api.projects.get(window.fxProject);window.fxOriginal=JSON.stringify(b.clips.map(c=>[c.id,c.narration,c.durationMs,c.imageAssetId,c.videoAssetId,c.audioAssetId,c.mediaInMs,c.voiceInMs,c.voiceOutMs,c.voiceStartMs]));const OriginalAudio=window.Audio;window.fxAudio=[];window.Audio=function(src){const a=new OriginalAudio(src);window.fxAudio.push(a);return a};document.querySelector('article button')?.click()})()`,wait:1000},
  {js:`Array.from(document.querySelectorAll('nav[aria-label="Panel editor"] button')).find(b=>b.textContent==='Efek')?.click()`,wait:500,shot:path.join(folder,'effects-off.png')},
  {js:`${check};check(document.querySelector('[data-scenepulse-panel]'),'Effects panel missing');check(document.querySelector('[aria-label="Aktifkan Motion + SFX"]').getAttribute('aria-checked')==='false','Old project was unexpectedly enabled');document.querySelector('[aria-label="Aktifkan Motion + SFX"]').click()`,wait:500},
  {js:`${check};const add=Array.from(document.querySelectorAll('[data-scenepulse-panel] button')).find(b=>b.textContent.includes('Tambahkan / perbarui'));check(add&&!add.disabled,'Add action unavailable');add.click()`,wait:300},
  {js:`(async()=>{${check};${waitJob};let jobs=[];for(let i=0;i<40;i++){jobs=(await window.api.projects.get(window.fxProject)).jobs.filter(j=>j.kind==='effects');if(jobs.length)break;await new Promise(r=>setTimeout(r,100))}check(jobs.length,'No effects job');await waitJob(jobs[0].id);const b=await window.api.projects.get(window.fxProject);check(b.assets.filter(a=>a.provider==='scenepulse').length===4,'Expected visual and SFX per scene');check(JSON.stringify(b.clips.map(c=>[c.id,c.narration,c.durationMs,c.imageAssetId,c.videoAssetId,c.audioAssetId,c.mediaInMs,c.voiceInMs,c.voiceOutMs,c.voiceStartMs]))===window.fxOriginal,'Original scene data changed');check(document.querySelectorAll('video[src*="/scenepulse/"]').length>0,'Preview did not use processed visuals');check(document.querySelector('[aria-label^="SFX adegan"]'),'SFX cue not on timeline');console.log('FX_GENERATED '+b.assets.filter(a=>a.provider==='scenepulse').length)})()`,wait:300,shot:path.join(folder,'effects-on.png')},
  {js:`document.querySelector('[aria-label="Putar"]').click()`,wait:850},
  {js:`${check};const fx=window.fxAudio.filter(a=>a.src.endsWith('/sfx.wav'));check(fx.some(a=>!a.paused&&a.currentTime>.2),'Preview SFX not playing with narration');document.querySelector('[aria-label="Jeda"]').click();console.log('FX_PREVIEW_AUDIO_OK')`,wait:150},
  {js:`(async()=>{${waitJob};const job=await window.api.exporter.start(window.fxProject,${JSON.stringify(exportOptions)});const done=await waitJob(job.id);console.log('FX_EXPORT_ON '+done.message)})()`,wait:100},
  {js:`(async()=>{${check};let rejected=false;try{await window.api.scenePulse.generate(window.fxProject)}catch(e){rejected=/sudah sesuai/.test(e.message)}check(rejected,'Cache generated another LLM request');document.querySelector('[aria-label="Aktifkan Motion + SFX"]').click()})()`,wait:1600},
  {js:`(async()=>{${check};${waitJob};const b=await window.api.projects.get(window.fxProject);check(!b.project.editor.scenePulse.enabled,'Off switch did not persist');check(!document.querySelector('video[src*="/scenepulse/"]'),'Off switch retained derived visuals');check(window.fxAudio.filter(a=>a.src.endsWith('/sfx.wav')).every(a=>a.paused),'Off switch retained SFX playback');const job=await window.api.exporter.start(window.fxProject,${JSON.stringify({...exportOptions,fileName:'effects-off'})});const done=await waitJob(job.id);console.log('FX_EXPORT_OFF '+done.message);b.project.editor.scenePulse.enabled=true;b.clips[0].durationMs=2100;await window.api.projects.save(b);const stale=await window.api.exporter.start(window.fxProject,${JSON.stringify({...exportOptions,fileName:'stale-must-fail'})});for(let i=0;i<100;i++){const state=(await window.api.projects.get(window.fxProject)).jobs.find(j=>j.id===stale.id);if(state?.status==='failed'){check(/belum siap|berubah/.test(state.error),'Unexpected stale error');console.log('FX_STALE_BLOCKED');return}await new Promise(r=>setTimeout(r,100))}throw Error('Stale effects were exported')})()`,wait:100},
  {js:`console.log('FX_HARNESS_DONE')`,wait:100,quit:true}
 ]
 fs.writeFileSync(planFile,JSON.stringify(plan))
 const browser=process.env.STUDIO_SCENEPULSE_BROWSER
 assert.ok(browser&&fs.existsSync(browser),'Set STUDIO_SCENEPULSE_BROWSER to the dedicated tested headless shell path')
 const env={...process.env,STUDIO_USER_DATA:path.join(folder,'userdata'),STUDIO_CAPTURE_PLAN:planFile,STUDIO_CAPTURE_HIDDEN:'1',STUDIO_LOG:log,STUDIO_SCENEPULSE_BROWSER:browser}
 delete env.ELECTRON_RUN_AS_NODE
 const child=cp.spawn(require('electron'),['.'],{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']})
 let stderr='';child.stderr.on('data',d=>{stderr=(stderr+d).slice(-6000);fs.appendFileSync(path.join(folder,'main.log'),d)});child.stdout.on('data',()=>{})
 const code=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{if(process.platform==='win32')cp.spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true});else child.kill();reject(Error('Harness timeout: '+stderr))},240000);child.on('error',reject);child.on('close',c=>{clearTimeout(timer);resolve(c)})})
 const content=fs.existsSync(log)?fs.readFileSync(log,'utf8'):''
 assert.equal(code,0,stderr)
 assert.doesNotMatch(content,/\[harness\] step failed|\[gone\]/,content)
 for(const marker of ['FX_GENERATED 4','FX_PREVIEW_AUDIO_OK','FX_EXPORT_ON','FX_EXPORT_OFF','FX_STALE_BLOCKED','FX_HARNESS_DONE'])assert.ok(content.includes(marker),content+'\n'+stderr)
 assert.equal(calls,1,'Cache should reuse results without another LLM call')
 const on=path.join(folder,'exports/effects-on.mp4'),off=path.join(folder,'exports/effects-off.mp4')
 const probe=file=>JSON.parse(cp.execFileSync(require('ffprobe-static').path,['-v','error','-show_streams','-show_format','-of','json',file],{encoding:'utf8'}))
 for(const file of [on,off]){const p=probe(file);assert.ok(Math.abs(Number(p.format.duration)-4)<.08);assert.ok(p.streams.some(s=>s.codec_type==='audio'))}
 const audio=file=>{const b=cp.execFileSync(ffmpeg,['-v','error','-i',file,'-vn','-ac','1','-ar','48000','-f','f32le','pipe:1']);return new Float32Array(b.buffer,b.byteOffset,b.byteLength/4)}
 const a=audio(on),b=audio(off)
 const diff=(start,end)=>{let sum=0,n=0;for(let i=Math.round(start*48000);i<Math.round(end*48000);i++){sum+=(a[i]-b[i])**2;n++}return Math.sqrt(sum/n)}
 assert.ok(diff(.70,.79)>.0003,'SFX was absent from the final export')
 assert.ok(diff(.3,.5)<.002,'Narration changed outside SFX')
 console.log(JSON.stringify({folder,llmCalls:calls,realHyperFrames:true,previewAudio:true,exportWithSfx:true,offSwitch:true,staleBlocked:true,voiceDiffOutsideSfx:diff(.3,.5),sfxDifference:diff(.70,.79)}))
}
main().catch(e=>{console.error(e.stack);console.error('Artifacts: '+folder);process.exitCode=1}).finally(()=>server.close())
