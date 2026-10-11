import { getImageModel, getVideoModel, type HfModel } from './higgsfield'
import type { AspectRatio } from './types'

export const FLOW_PREFIX = 'flow2api:'
export const isFlowModel = (id: string | null | undefined): boolean => !!id?.startsWith(FLOW_PREFIX)
export const flowModelId = (id: string): string => id.slice(FLOW_PREFIX.length)
export const flowAspectModel = (id: string, aspect: AspectRatio): string =>
  id.replace(/-(landscape|portrait)(?=-|$)/, `-${aspect === '9:16' ? 'portrait' : 'landscape'}`)
export const defaultFlowModel = (kind: 'image' | 'video', aspect: AspectRatio): string =>
  FLOW_PREFIX + (kind === 'image' ? `gemini-3.1-flash-image-${aspect === '9:16' ? 'portrait' : 'landscape'}` : `veo-3.1-fast-i2v-6s-${aspect === '9:16' ? 'portrait' : 'landscape'}`)

function model(id: string | null | undefined, kind: 'image' | 'video'): HfModel {
  if (!isFlowModel(id)) return kind === 'image' ? getImageModel(id) : getVideoModel(id)
  const name = flowModelId(id!)
  const seconds = Number(/-(\d+)s(?:-|$)/.exec(name)?.[1] ?? 8)
  return { id: id!, name, family: 'Google Flow', kind, input: { field: 'image_url', mode: kind === 'image' ? 'reference' : 'first-frame', max: 3 }, required: [], props: {}, durations: kind === 'video' ? { values: [seconds] } : null, tags: [] }
}

export const getMediaImageModel = (id: string | null | undefined): HfModel => model(id, 'image')
export const getMediaVideoModel = (id: string | null | undefined): HfModel => model(id, 'video')
