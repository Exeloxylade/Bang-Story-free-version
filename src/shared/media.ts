import { getImageModel, getVideoModel, type HfModel } from './higgsfield'
import type { AspectRatio } from './types'

export const FLOW_PREFIX = 'flow2api:'
export const isFlowModel = (id: string | null | undefined): boolean => !!id?.startsWith(FLOW_PREFIX)
export const flowModelId = (id: string): string => id.slice(FLOW_PREFIX.length)
export const flowAspectModel = (id: string, aspect: AspectRatio): string =>
  id.replace(/-(landscape|portrait)(?=-|$)/, `-${aspect === '9:16' ? 'portrait' : 'landscape'}`)
export const defaultFlowModel = (kind: 'image' | 'video', aspect: AspectRatio): string =>
  FLOW_PREFIX + (kind === 'image' ? `gemini-3.1-flash-image-${aspect === '9:16' ? 'portrait' : 'landscape'}` : `veo-3.1-fast-i2v-6s-${aspect === '9:16' ? 'portrait' : 'landscape'}`)

/** Choose a real server-advertised duration, keeping family, input mode and orientation. */
export function flowVideoModelForDuration(id: string, aspect: AspectRatio, seconds: number, available: readonly string[]): string {
  if (!isFlowModel(id)) return id
  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error('Durasi suara/adegan harus lebih dari nol.')
  const oriented = flowAspectModel(id, aspect)
  const orientation = aspect === '9:16' ? 'portrait' : 'landscape'
  const family = (name: string): string => name.replace(/-\d+s(?=-|$)/, '').replace(/-(landscape|portrait)(?=-|$)/, '')
  const selected = flowModelId(oriented)
  const candidates = available.flatMap(value => {
    const name = isFlowModel(value) ? flowModelId(value) : value
    const duration = Number(/-(\d+)s(?:-|$)/.exec(name)?.[1])
    const direction = /-(landscape|portrait)(?:-|$)/.exec(name)?.[1]
    return duration > 0 && family(name) === family(selected) && direction === orientation ? [{ id: FLOW_PREFIX + name, duration }] : []
  })
  candidates.sort((a, b) => Math.abs(a.duration - seconds) - Math.abs(b.duration - seconds) || b.duration - a.duration || a.id.localeCompare(b.id))
  if (candidates.length) return candidates[0].id
  // Unknown/custom families retain their exact supported ID; never invent a variant.
  if (available.some(value => (isFlowModel(value) ? value : FLOW_PREFIX + value) === oriented)) return oriented
  throw new Error('Tidak ada varian model Flow yang sesuai dengan model dan rasio proyek. Perbarui daftar model lalu pilih ulang.')
}

function model(id: string | null | undefined, kind: 'image' | 'video'): HfModel {
  if (!isFlowModel(id)) return kind === 'image' ? getImageModel(id) : getVideoModel(id)
  const name = flowModelId(id!)
  const seconds = Number(/-(\d+)s(?:-|$)/.exec(name)?.[1] ?? 8)
  return { id: id!, name, family: 'Google Flow', kind, input: { field: 'image_url', mode: kind === 'image' ? 'reference' : 'first-frame', max: 3 }, required: [], props: {}, durations: kind === 'video' ? { values: [seconds] } : null, tags: [] }
}

export const getMediaImageModel = (id: string | null | undefined): HfModel => model(id, 'image')
export const getMediaVideoModel = (id: string | null | undefined): HfModel => model(id, 'video')
