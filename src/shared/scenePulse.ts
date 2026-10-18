import styles from '../../resources/scenepulse/skill/assets/styles.json'
import catalog from '../../resources/scenepulse/skill/assets/sfx.json'
import choices from '../../resources/scenepulse/skill/assets/sfx-ai-choices.json'
import type { Asset, Clip, Project } from './types'

export const SCENEPULSE_VERSION = '0.3.0'
export const EFFECT_STYLES = styles.styles
export const EFFECT_SOUNDS = catalog.sounds
export const EFFECT_ROLES = choices.choices
export interface ScenePulseSettings {
  enabled: boolean
  motion: boolean
  sfx: boolean
  styleId: string
  resolution: 720 | 1080
}
export interface SceneEffect {
  sceneId: string
  audio: { effectId: string; startMs: number; gainDb: number }[]
  motion: { presetId: 'static' | 'push-in' | 'pull-out' | 'pan-left' | 'pan-right'; amount: number }
  graphics: { presetId: 'highlight-box' | 'underline' | 'frame-outline'; startMs: number; endMs: number; x: number; y: number; width: number; height: number }[]
}
export interface ScenePulsePlan { schemaVersion: 1; sceneEffects: SceneEffect[] }
export interface ScenePulseMeta {
  signature: string
  role: 'visual' | 'sfx'
  skillVersion: string
  plan: SceneEffect
}
export interface ScenePulseStatus { ready: boolean; skillVersion: string; skillIncluded: boolean; engine: string }
export const DEFAULT_SCENEPULSE: ScenePulseSettings = { enabled: false, motion: true, sfx: true, styleId: 'minimal-clean', resolution: 720 }

export function scenePulseSettings(project: Pick<Project, 'editor'>): ScenePulseSettings {
  return { ...DEFAULT_SCENEPULSE, ...project.editor.scenePulse }
}

/** Stable data shared by preview/export: changed sources or timing never reuse stale effects. */
export function scenePulseSignature(project: Project, clip: Clip): string {
  const s = scenePulseSettings(project)
  return JSON.stringify([SCENEPULSE_VERSION, clip.id, project.aspectRatio, project.styleId, s.styleId, s.resolution,
    clip.imageAssetId, clip.videoAssetId, clip.motionType, clip.mediaInMs, clip.durationMs,
    clip.cameraPreset, clip.motionStrength, clip.videoCamera, clip.videoStrength,
    clip.title, clip.narration, clip.visualPrompt, clip.audioAssetId, clip.voiceInMs, clip.voiceOutMs, clip.voiceStartMs])
}

export function scenePulseMeta(asset: Asset): ScenePulseMeta | null {
  const meta = asset.meta.scenePulse as ScenePulseMeta | undefined
  return asset.provider === 'scenepulse' && meta?.skillVersion === SCENEPULSE_VERSION && typeof meta.signature === 'string' ? meta : null
}

export function scenePulseAssets(project: Project, clip: Clip, assets: Asset[]): { visual: Asset | null; sfx: Asset | null } {
  const signature = scenePulseSignature(project, clip)
  let visual: Asset | null = null, sfx: Asset | null = null
  for (const asset of assets) {
    const meta = scenePulseMeta(asset)
    if (asset.clipId !== clip.id || meta?.signature !== signature) continue
    if (meta.role === 'visual' && asset.kind === 'video' && (!visual || asset.createdAt >= visual.createdAt)) visual = asset
    if (meta.role === 'sfx' && asset.kind === 'sfx' && (!sfx || asset.createdAt >= sfx.createdAt)) sfx = asset
  }
  return { visual, sfx }
}

export function emptySceneEffect(clip: Clip): SceneEffect {
  return { sceneId: clip.id, audio: [], motion: { presetId: 'static', amount: 0 }, graphics: [] }
}

export function appliedScenePulsePlan(project: Project, clips: Clip[], assets: Asset[]): ScenePulsePlan {
  const settings = scenePulseSettings(project)
  return {schemaVersion:1,sceneEffects:clips.map(clip=>{
    const cached=scenePulseAssets(project,clip,assets), entry=emptySceneEffect(clip)
    const visual=cached.visual && scenePulseMeta(cached.visual), sfx=cached.sfx && scenePulseMeta(cached.sfx)
    if (settings.enabled && settings.motion && visual) { entry.motion=visual.plan.motion;entry.graphics=visual.plan.graphics }
    if (settings.enabled && settings.sfx && sfx) entry.audio=sfx.plan.audio
    return entry
  })}
}

export function allowsScenePulseCamera(clip: Clip): boolean {
  return (clip.motionType === 'video' ? clip.videoCamera : clip.cameraPreset) === 'static'
}

export function sfxEnvelope(localMs: number, durationMs: number): number {
  return Math.max(0, Math.min(1, localMs / 8, (durationMs - localMs) / 8))
}

function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Rencana Motion + SFX: ${message}`)
}
function keys(value: unknown, expected: string[]): asserts value is Record<string, unknown> {
  requireValue(!!value && typeof value === 'object' && !Array.isArray(value), 'objek diperlukan')
  requireValue(Object.keys(value).length === expected.length && expected.every(k => k in value), 'kolom tidak cocok')
}
function number(value: unknown, low: number, high: number, integer = false): asserts value is number {
  requireValue(typeof value === 'number' && Number.isFinite(value) && value >= low && value <= high && (!integer || Number.isInteger(value)), 'angka/waktu di luar batas')
}

/** App adapter of ScenePulse's bounded plan, reused at generation and export. */
export function validateScenePulsePlan(project: Project, clips: Clip[], input: unknown): ScenePulsePlan {
  const settings = scenePulseSettings(project)
  const style = EFFECT_STYLES.find(s => s.id === settings.styleId)
  requireValue(style, 'gaya tidak dikenal')
  requireValue(settings.resolution === 720 || settings.resolution === 1080, 'resolusi tidak dikenal')
  keys(input, ['schemaVersion', 'sceneEffects'])
  requireValue(input.schemaVersion === 1 && Array.isArray(input.sceneEffects) && input.sceneEffects.length === clips.length, 'setiap adegan harus muncul tepat sekali')
  const seen = new Set<string>(), cues: { start: number; end: number }[] = []
  const sceneById = new Map(clips.map(c => [c.id, c]))
  const starts = new Map<string, number>()
  let total = 0, graphicCount = 0
  for (const clip of clips) { starts.set(clip.id, total); total += clip.durationMs }
  for (const entry of input.sceneEffects) {
    keys(entry, ['sceneId', 'audio', 'motion', 'graphics'])
    requireValue(typeof entry.sceneId === 'string' && !seen.has(entry.sceneId), 'ID adegan kosong/ganda')
    const clip = sceneById.get(entry.sceneId)
    requireValue(clip, 'ID adegan tidak dikenal')
    seen.add(clip.id)
    requireValue(Array.isArray(entry.audio) && Array.isArray(entry.graphics), 'daftar efek diperlukan')
    keys(entry.motion, ['presetId', 'amount'])
    requireValue(['static','push-in','pull-out','pan-left','pan-right'].includes(String(entry.motion.presetId)), 'gerak tidak dikenal')
    number(entry.motion.amount, 0, style.maxCameraAmount)
    requireValue(entry.motion.presetId === 'static' ? entry.motion.amount === 0 : allowsScenePulseCamera(clip) && entry.motion.amount > 0, 'kamera tambahan bertabrakan dengan kamera klip')
    for (const cue of entry.audio) {
      keys(cue, ['effectId', 'startMs', 'gainDb'])
      const role = EFFECT_ROLES.find(r => r.id === cue.effectId)
      const sound = EFFECT_SOUNDS.find(s => s.id === role?.defaultSoundId)
      requireValue(sound, 'jenis suara tidak ada di katalog')
      number(cue.startMs, 0, clip.durationMs - sound.durationMs, true)
      number(cue.gainDb, -48, style.maxSfxGainDb)
      const start = starts.get(clip.id)! + cue.startMs
      cues.push({start, end: start + sound.durationMs})
    }
    requireValue(entry.graphics.length <= style.maxGraphicsPerScene, 'terlalu banyak grafis')
    graphicCount += entry.graphics.length
    for (const graphic of entry.graphics) {
      keys(graphic, ['presetId','startMs','endMs','x','y','width','height'])
      requireValue(['highlight-box','underline','frame-outline'].includes(String(graphic.presetId)), 'grafis tidak dikenal')
      number(graphic.startMs, 0, clip.durationMs, true)
      number(graphic.endMs, graphic.startMs + 100, clip.durationMs, true)
      for (const field of ['x','y','width','height']) number(graphic[field], 0, 1)
      const {x,y,width,height} = graphic as Record<string, number>
      requireValue(width > 0 && height > 0 && x + width <= 1 && y + height <= .8, 'grafis melewati bingkai/area caption')
    }
  }
  requireValue(graphicCount <= 16, 'maksimum 16 grafis per proyek')
  requireValue(cues.length <= Math.min(32, Math.ceil(total / 60000 * style.maxSfxPerMinute)), 'SFX terlalu padat')
  cues.sort((a,b) => a.start-b.start)
  for (let i=1; i<cues.length; i++) requireValue(cues[i].start-cues[i-1].start >= style.minSfxGapMs && cues[i].start >= cues[i-1].end, 'SFX terlalu dekat/tumpang tindih')
  return input as unknown as ScenePulsePlan
}
