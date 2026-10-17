import { readFileSync } from 'node:fs'
import { extname } from 'node:path'
import { FLOW_PREFIX, flowModelId } from '@shared/media'
import { flowFailure } from '@shared/flowErrors'
import type { KeyTestResult, ModelOption } from '@shared/types'
import { requireSecret } from '../secrets'
import { getSettings } from '../settings'
import { downloadTo } from './http'
import { LOCAL_FLOW_URL, flowSetupStatus } from '../flowSetup'

function apiKey(key?: string): string {
  if (!getSettings().flowLocalEnabled) return key ?? requireSecret('flow2api')
  if (flowSetupStatus().state !== 'running') throw new Error('Jalankan Flow2API lokal di Pengaturan dulu.')
  return requireSecret('flow2api-local')
}

function base(): string {
  const url = new URL(getSettings().flowLocalEnabled ? LOCAL_FLOW_URL : getSettings().flowBaseUrl)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash)
    throw new Error('Alamat Flow2API harus berupa URL http:// atau https:// tanpa kredensial.')
  return url.toString().replace(/\/+$/, '').replace(/\/v1$/, '') + '/v1'
}

async function models(key?: string): Promise<{ id: string; description?: string }[]> {
  const res = await fetch(`${base()}/models`, { headers: { Authorization: `Bearer ${apiKey(key)}` }, signal: AbortSignal.timeout(20_000) })
  if (!res.ok) throw new Error(`Flow2API tidak bisa dihubungi (HTTP ${res.status}). Periksa alamat server dan kunci.`)
  const body = await res.json() as { data?: { id: string; description?: string }[] }
  if (!Array.isArray(body.data)) throw new Error('Daftar model Flow2API tidak valid.')
  return body.data
}

export async function testKey(key?: string): Promise<KeyTestResult> {
  try { return { ok: true, message: `Terhubung · ${(await models(key)).length} model tersedia` } }
  catch { return { ok: false, message: 'Flow2API belum terhubung. Periksa server, alamat, dan kunci API.' } }
}

export async function listModels(kind: 'image' | 'video'): Promise<ModelOption[]> {
  return (await models()).filter(m => kind === 'image' ? /image|imagen/i.test(m.id) : (/-i2v-|_i2v_|^omni-/.test(m.id) && !/extend|interpolation|upsample/i.test(m.id)))
    .map(m => ({ id: FLOW_PREFIX + m.id, name: m.id, description: m.description, tags: [kind === 'image' ? 'Gambar' : 'Video'], family: 'Google Flow' }))
}

export function imageData(path: string): string {
  const mime = extname(path).toLowerCase() === '.jpg' || extname(path).toLowerCase() === '.jpeg' ? 'image/jpeg' : extname(path).toLowerCase() === '.webp' ? 'image/webp' : 'image/png'
  return `data:${mime};base64,${readFileSync(path).toString('base64')}`
}

/** Flow2API returns final media in completion content; progress lives in reasoning_content. */
export async function generate(id: string, prompt: string, images: string[], kind: 'image' | 'video', signal: AbortSignal, progress: (message: string) => void): Promise<{ bytes: Buffer; contentType: string; url: string | null }> {
  const timeout = AbortSignal.any([signal, AbortSignal.timeout(30 * 60 * 1000)])
  const model = flowModelId(id)
  if (kind === 'video' && (!/-i2v-|_i2v_|^omni-/.test(model) || /extend|interpolation|upsample/i.test(model))) throw new Error('Pilih model Flow2API image-to-video (i2v) atau Omni agar gambar klip dipakai.')
  const res = await fetch(`${base()}/chat/completions`, {
    method: 'POST', signal: timeout,
    headers: { Authorization: `Bearer ${apiKey()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, ...images.map(url => ({ type: 'image_url', image_url: { url } }))] }], stream: true })
  })
  if (!res.ok || !res.body) {
    const failure = await res.json().catch(() => ({})) as { error?: unknown }
    throw flowFailure(failure.error)
  }
  let content = ''
  if (res.headers.get('content-type')?.includes('text/event-stream')) {
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let pending = ''
    const accept = (line: string): void => {
      if (!line.startsWith('data:')) return
      const data = line.slice(5).trim()
      if (!data || data === '[DONE]') return
      const chunk = JSON.parse(data) as { error?: unknown; choices?: { delta?: { content?: string; reasoning_content?: string } }[] }
      if (chunk.error) throw flowFailure(chunk.error)
      for (const choice of chunk.choices ?? []) {
        content += choice.delta?.content ?? ''
        if (choice.delta?.reasoning_content) progress('Flow2API sedang membuat media…')
      }
    }
    try {
      while (true) {
        const part = await reader.read()
        pending += decoder.decode(part.value, { stream: !part.done })
        const lines = pending.split(/\r?\n/)
        pending = lines.pop() ?? ''
        for (const line of lines) accept(line)
        if (part.done) { accept(pending); break }
      }
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock() }
  } else {
    const body = await res.json() as { error?: unknown; choices?: { message?: { content?: string } }[] }
    if (body.error) throw flowFailure(body.error)
    content = body.choices?.[0]?.message?.content ?? ''
  }
  const link = kind === 'image' ? /!\[[^\]]*\]\(([^\s)]+)\)/.exec(content)?.[1] : /<video\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i.exec(content)?.[1]
  const raw = link ?? (/^(?:https?:\/\/|\/tmp\/|data:)/.test(content.trim()) ? content.trim() : null)
  if (!raw) throw new Error('Flow2API selesai tanpa gambar atau video yang bisa dibaca.')
  if (raw.startsWith('data:')) {
    const match = /^data:([^;,]+);base64,([\s\S]+)$/.exec(raw)
    if (!match || !(kind === 'image' ? /^image\/(png|jpeg|webp)$/ : /^video\/mp4$/).test(match[1])) throw new Error('Format media Flow2API tidak didukung.')
    return { bytes: Buffer.from(match[2], 'base64'), contentType: match[1], url: null }
  }
  const url = new URL(raw, base()).toString()
  if (!/^https?:\/\//i.test(url)) throw new Error('Alamat hasil Flow2API tidak valid.')
  const result = await downloadTo(url, timeout)
  return { ...result, url }
}
