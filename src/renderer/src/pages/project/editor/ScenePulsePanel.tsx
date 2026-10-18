import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { EFFECT_ROLES, EFFECT_STYLES, scenePulseAssets, scenePulseMeta, scenePulseSettings, type ScenePulseStatus } from '@shared/scenePulse'
import type { Clip } from '@shared/types'
import { Select } from '../../../components/Select'
import { Button, Switch } from '../../../components/ui'
import { errorText } from '../../../lib/format'
import { useApp } from '../../../store/app'
import { isRunning, jobFor, useProject } from '../../../store/project'

export function ScenePulsePanel({clip}:{clip:Clip|null}) {
  const {project,clips,assets,jobs,updateEditor,flush,upsertJob}=useProject()
  const {toast}=useApp()
  const [status,setStatus]=useState<ScenePulseStatus|null>(null)
  const [statusError,setStatusError]=useState('')
  const [starting,setStarting]=useState(false)
  const job=jobFor(jobs,'effects',{}), busy=starting || isRunning(job)
  useEffect(()=>{
    let live=true
    void window.api.scenePulse.status().then(value=>{if(live){setStatus(value);setStatusError('')}}).catch(error=>{if(live)setStatusError(errorText(error))})
    return ()=>{live=false}
  },[job?.status])
  if (!project) return null
  const settings=scenePulseSettings(project), list=Object.values(assets)
  const cached=clip ? scenePulseAssets(project,clip,list) : null
  const ready=clips.filter(c=>{
    const result=scenePulseAssets(project,c,list)
    return (!settings.motion || result.visual) && (!settings.sfx || result.sfx)
  }).length
  const patch=(value:Partial<typeof settings>):void=>updateEditor({scenePulse:{...settings,...value}})
  const run=async(action:'setup'|'missing'|'all'|'clip'):Promise<void>=>{
    setStarting(true)
    try {
      await flush()
      const next=action==='setup' ? await window.api.scenePulse.install(project.id) : await window.api.scenePulse.generate(project.id,
        action==='clip' && clip ? {clipIds:[clip.id],force:true} : {force:action==='all'})
      const known=useProject.getState().jobs[next.id]
      if (!known || known.updatedAt<next.updatedAt) upsertJob(next)
    } catch(error) {toast('error',errorText(error))}
    finally {setStarting(false)}
  }
  const selectedPlan=cached?.sfx ? scenePulseMeta(cached.sfx)?.plan : null
  return <div className="flex min-w-0 flex-col text-sm" data-scenepulse-panel>
    <div className="flex items-center gap-3 border-b border-line p-[18px]">
      <div className="min-w-0 flex-1"><h3 className="font-semibold">Motion + SFX</h3><p className="mt-1 text-xs text-muted">ScenePulse untuk adegan kamu</p></div>
      <Switch label="Aktifkan Motion + SFX" on={settings.enabled} onChange={enabled=>{
        patch({enabled})
        if (!enabled && isRunning(job)) void window.api.generate.cancel(job!.id)
      }}/>
    </div>
    <div className="space-y-3 border-b border-line p-[18px]">
      <p className="text-xs leading-relaxed text-ink-2">Memakai LLM pilihanmu untuk rencana efek dan aset adegan yang sudah tersedia. Narasi dan durasi adegan tetap menjadi patokan.</p>
      <p className="text-xs text-muted">{status?.skillIncluded ? `Skill ScenePulse v${status.skillVersion} · sudah disertakan` : 'Memeriksa paket skill…'}</p>
      {statusError && <p role="alert" className="text-xs text-bad-ink">{statusError}</p>}
      {status && !status.skillIncluded && <p role="alert" className="text-xs text-bad-ink">Paket skill tidak lengkap. Pasang ulang Bang Story terbaru.</p>}
    </div>
    {settings.enabled && <>
      <fieldset disabled={busy} className="min-w-0 space-y-4 border-b border-line p-[18px] disabled:opacity-65">
        <div className="flex items-center gap-3"><div className="flex-1"><p className="font-semibold">Gerak dan grafis</p><p className="mt-1 text-xs text-muted">Sorotan dan gerak halus lewat HyperFrames.</p></div><Switch label="Gunakan gerak dan grafis" on={settings.motion} onChange={motion=>patch({motion})}/></div>
        <div className="flex items-center gap-3"><div className="flex-1"><p className="font-semibold">Efek suara</p><p className="mt-1 text-xs text-muted">Aksen pendek dari pustaka suara bawaan.</p></div><Switch label="Gunakan efek suara" on={settings.sfx} onChange={sfx=>patch({sfx})}/></div>
        <div className="space-y-2"><p className="font-semibold">Gaya penyuntingan</p><Select label="Gaya Motion + SFX" size="sm" value={settings.styleId} onChange={styleId=>patch({styleId})} options={EFFECT_STYLES.map(s=>({value:s.id,label:s.label,note:s.description}))}/><p className="text-xs leading-relaxed text-muted">{EFFECT_STYLES.find(s=>s.id===settings.styleId)?.guidance}</p></div>
        {settings.motion && <div className="space-y-2"><p className="font-semibold">Resolusi hasil efek</p><Select label="Resolusi Motion + SFX" size="sm" value={settings.resolution} onChange={resolution=>patch({resolution})} options={[{value:720,label:'720p · lebih ringan'},{value:1080,label:'1080p · lebih tajam'}]}/><p className="text-xs text-muted">Hasil efek tersimpan pada resolusi ini.</p></div>}
      </fieldset>
      <div className="space-y-3 border-b border-line p-[18px]">
        <p className="font-semibold">{ready} dari {clips.length} adegan siap</p>
        {settings.motion && !status?.ready && <p className="text-xs leading-relaxed text-muted">Runtime render disiapkan otomatis saat pertama dipakai. Kamu bisa menyiapkannya sekarang.</p>}
        {settings.motion && !status?.ready && <Button size="sm" disabled={busy || !status?.skillIncluded} onClick={()=>void run('setup')}>Siapkan render sekali</Button>}
        <Button className="w-full" variant="accent" size="sm" icon={<Sparkles className="size-4"/>} loading={busy} disabled={!clips.length || (!settings.motion && !settings.sfx) || !status?.skillIncluded} onClick={()=>void run(ready===clips.length?'all':'missing')}>{ready===clips.length?'Buat ulang semua efek':'Tambahkan / perbarui efek'}</Button>
        {clip && <Button className="w-full" size="sm" disabled={busy || (!settings.motion && !settings.sfx) || !status?.skillIncluded} onClick={()=>void run('clip')}>Buat ulang efek adegan terpilih</Button>}
        {isRunning(job) && <><p role="status" className="text-xs leading-relaxed text-sun-ink">{job!.message ?? 'Memproses'} · {Math.round(job!.progress*100)}%</p><Button size="sm" onClick={()=>void window.api.generate.cancel(job!.id)}>Batalkan proses</Button></>}
        {job?.status==='done' && job.message && <p role="status" className="text-xs leading-relaxed text-ok-ink">{job.message}</p>}
        {job?.status==='failed' && job.error && <p role="alert" className="text-xs leading-relaxed text-bad-ink">{job.error}</p>}
        {ready<clips.length && <p className="text-xs leading-relaxed text-muted">Perbarui efek setelah mengganti media, durasi, narasi, atau gaya. Ekspor memeriksa kecocokan ini.</p>}
      </div>
      {clip && <div className="space-y-2 p-[18px]"><p className="truncate font-semibold">{clip.title}</p><p className="text-xs text-muted">{settings.motion ? cached?.visual?'Gerak siap':'Gerak perlu dibuat':'Gerak dimatikan'} · {settings.sfx ? cached?.sfx?'SFX siap':'SFX perlu dibuat':'SFX dimatikan'}</p>{selectedPlan?.audio.length ? selectedPlan.audio.map((cue,i)=><p key={i} className="text-xs text-ink-2">{(cue.startMs/1000).toLocaleString('id-ID')} dtk · {EFFECT_ROLES.find(r=>r.id===cue.effectId)?.label} · {cue.gainDb} dB</p>) : cached?.sfx && <p className="text-xs text-muted">Adegan ini dibiarkan tenang.</p>}</div>}
    </>}
  </div>
}
