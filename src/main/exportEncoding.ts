import { spawn } from 'node:child_process'
import { availableParallelism, totalmem } from 'node:os'
import type { ExportCapabilities, ExportEncoder, ExportOptions } from '@shared/types'

type Encoder = Exclude<ExportEncoder, 'auto'>
export interface RenderPlan { encoder: Encoder; workers: number; threads: number }
const ENCODERS: Record<Encoder, string> = { cpu: 'libx264', amd: 'h264_amf', nvidia: 'h264_nvenc', intel: 'h264_qsv' }
const LABELS: Record<Encoder, string> = { cpu: 'CPU (x264)', amd: 'AMD GPU (AMF)', nvidia: 'NVIDIA GPU (NVENC)', intel: 'Intel GPU (Quick Sync)' }

export function encodingArgs(encoder: Encoder, segment = false, quality = 19): string[] {
  const q = segment ? '17' : String(quality)
  if (encoder === 'cpu') return ['-c:v', ENCODERS.cpu, '-preset', segment ? 'veryfast' : 'medium', '-crf', q]
  if (encoder === 'amd') return ['-c:v', ENCODERS.amd, '-quality', 'balanced', '-rc', 'cqp', '-qp_i', q, '-qp_p', q]
  if (encoder === 'nvidia') return ['-c:v', ENCODERS.nvidia, '-preset', 'p4', '-rc', 'constqp', '-qp', q]
  return ['-c:v', ENCODERS.intel, '-preset', 'medium', '-global_quality', q]
}

/** Actually initialize the encoder; an encoder listed in FFmpeg may have no matching GPU. */
export function probeEncoder(binary: string, encoder: Encoder): Promise<boolean> {
  return new Promise(resolve => {
    const child = spawn(binary, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=black:s=320x240:r=30', '-frames:v', '2', ...encodingArgs(encoder), '-pix_fmt', 'yuv420p', '-f', 'null', '-'], { windowsHide: true, stdio: 'ignore' })
    const timer = setTimeout(() => { child.kill(); resolve(false) }, 10000)
    child.once('error', () => { clearTimeout(timer); resolve(false) })
    child.once('close', code => { clearTimeout(timer); resolve(code === 0) })
  })
}
let cached: Promise<ExportCapabilities> | undefined
export function getExportCapabilities(binary: string): Promise<ExportCapabilities> {
  return cached ??= (async () => {
    const encoders = []
    // Serial probing avoids initializing several hardware drivers at once.
    for (const id of Object.keys(ENCODERS) as Encoder[]) encoders.push({ id, label: LABELS[id], available: await probeEncoder(binary, id) })
    return { encoders, logicalCores: availableParallelism() }
  })()
}

export function renderPlan(opts: ExportOptions, capabilities: ExportCapabilities, memory = totalmem()): RenderPlan {
  const choice = opts.encoder ?? 'auto'
  const resources = opts.resources ?? 'balanced'
  if (!['auto', 'cpu', 'amd', 'nvidia', 'intel'].includes(choice) || !['responsive', 'balanced', 'maximum'].includes(resources)) throw new Error('Pilihan render tidak valid')
  const selected = choice === 'auto' ? capabilities.encoders.find(e => e.id !== 'cpu' && e.available)?.id ?? 'cpu' : choice
  // Explicit selection remains visible in the UI; unavailable hardware falls back safely.
  const encoder = capabilities.encoders.some(e => e.id === selected && e.available) ? selected : 'cpu'
  const ratio = resources === 'responsive' ? 0.25 : resources === 'balanced' ? 0.5 : 1
  const threads = Math.max(1, Math.floor(capabilities.logicalCores * ratio))
  const maxWorkers = resources === 'responsive' ? 1 : resources === 'balanced' ? 2 : 4
  // 4K camera filters need substantially more memory than the encoder itself.
  const perWorker = opts.resolution === 2160 ? 4 * 1024 ** 3 : 1024 ** 3
  const workers = Math.max(1, Math.min(maxWorkers, Math.floor(threads / 2), Math.floor(memory * 0.5 / perWorker)))
  return { encoder, workers, threads }
}

/** Only hardware initialization failures permit a CPU retry, never a broken filter graph. */
export function hardwareFailure(error: unknown): boolean {
  return /AMF|NVENC|QSV|MFX|No capable devices|No device available|Cannot load (?:nvcuda|nvEncodeAPI)|unsupported device|device (?:lost|failed)|hardware encoder/i.test(String(error))
}
