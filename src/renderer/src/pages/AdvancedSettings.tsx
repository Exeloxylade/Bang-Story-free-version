import { useEffect, useState } from 'react'
import { DEFAULT_SCRIPT_INSTRUCTIONS, DEFAULT_VISUAL_INSTRUCTIONS, INSTRUCTION_LIMIT, resolveInstructions } from '@shared/storyInstructions'
import type { AppSettings, InstructionMode } from '@shared/types'
import { StyleInstructions } from './StyleInstructions'
import { Button, Segmented, inputCls } from '../components/ui'
import { errorText } from '../lib/format'

type InstructionKey = 'scriptInstructions' | 'visualInstructions'

function InstructionEditor({ field, title, description, fallback, settings, onSettings }: {
  field: InstructionKey
  title: string
  description: string
  fallback: string
  settings: AppSettings
  onSettings: (settings: AppSettings) => void
}) {
  const modeKey = field === 'scriptInstructions' ? 'scriptInstructionsMode' : 'visualInstructionsMode'
  const mode = settings[modeKey]
  const saved = resolveInstructions(settings[field], fallback)
  const [draft, setDraft] = useState(saved)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  useEffect(() => { setDraft(saved) }, [saved])
  const dirty = draft.trim() !== saved.trim()

  const changeMode = async (value: InstructionMode): Promise<void> => {
    setBusy(true)
    setError('')
    try { onSettings(await window.api.settings.set({ [modeKey]: value })); setMessage(value === 'original' ? 'Instruksi asli aktif. Teks kustom tetap tersimpan.' : 'Instruksi kustom aktif untuk generasi berikutnya.') }
    catch (e) { setError(errorText(e)) }
    finally { setBusy(false) }
  }

  const save = async (reset = false): Promise<void> => {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const text = reset ? '' : draft.trim()
      const value = !text || text === fallback ? '' : text
      const next = await window.api.settings.set({ [field]: value })
      onSettings(next)
      setDraft(resolveInstructions(next[field], fallback))
      setMessage(reset ? 'Instruksi bawaan dipulihkan.' : 'Instruksi tersimpan untuk generasi berikutnya.')
    } catch (e) { setError(errorText(e)) }
    finally { setBusy(false) }
  }

  return <section className="flex min-w-0 flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
    <div>
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="mt-1 text-sm text-ink-2">{description}</p>
    </div>
    <div role="group" aria-label={`Mode ${title}`}>
      <Segmented<InstructionMode> value={mode} options={[{ id: 'original', label: 'Asli (Original)', disabled: busy }, { id: 'custom', label: 'Kustom (Custom)', disabled: busy }]} onChange={value => void changeMode(value)} />
    </div>
    <textarea aria-label={title} value={mode === 'original' ? fallback : draft} readOnly={mode === 'original'} disabled={busy} maxLength={INSTRUCTION_LIMIT} rows={12}
      spellCheck={false} className={`${inputCls} min-h-[240px] w-full resize-y py-3 font-mono text-[13px] leading-relaxed`}
      onChange={e => { setDraft(e.target.value); setMessage(''); setError('') }} />
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-xs text-ink-2">{(mode === 'original' ? fallback : draft).length.toLocaleString('id-ID')} / {INSTRUCTION_LIMIT.toLocaleString('id-ID')} karakter · {mode === 'original' ? (dirty ? 'Asli aktif · perubahan kustom belum disimpan' : 'Instruksi asli aktif') : dirty ? 'Perubahan kustom belum disimpan' : 'Instruksi kustom aktif'}</span>
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy || mode === 'original' || (!dirty && !settings[field]?.trim())} onClick={() => void save(true)}>Pulihkan bawaan</Button>
        <Button variant="primary" disabled={busy || mode === 'original' || !dirty} onClick={() => void save()}>{busy ? 'Menyimpan…' : 'Simpan instruksi'}</Button>
      </div>
    </div>
    {error && <p role="alert" className="text-sm text-bad-ink">{error}</p>}
    {message && <p role="status" className="text-sm text-ok-ink">{message}</p>}
  </section>
}

export function AdvancedSettings({ settings, onSettings }: { settings: AppSettings; onSettings: (settings: AppSettings) => void }) {
  return <>
    <div>
      <h1 className="font-display text-[34px] font-bold tracking-[-0.015em]">Pengaturan lanjutan</h1>
      <p className="mt-2 text-[15px] text-ink-2">Edit arahan kreatif untuk semua proyek di komputer ini. Pilih Asli untuk memakai bawaan aplikasi, atau Kustom untuk memakai instruksi yang kamu simpan. Beralih ke Asli tidak menghapus teks kustom.</p>
    </div>
    <div className="rounded-xl border border-line bg-sand px-4 py-3 text-sm text-ink-2">
      Berlaku untuk generasi berikutnya: naskah, rencana visual, gambar, atau reference sheet sesuai bagian yang kamu ubah. Naskah, gambar, dan audio yang sudah ada tetap tersimpan. Instruksi boleh ditulis dalam bahasa Indonesia atau Inggris.
    </div>
    <InstructionEditor field="scriptInstructions" title="1. Naskah dan hook" description="Atur pembukaan, alur cerita, ketegangan, gaya narator, dan penutup." fallback={DEFAULT_SCRIPT_INSTRUCTIONS} settings={settings} onSettings={onSettings} />
    <InstructionEditor field="visualInstructions" title="2. Storyboard dan karakter" description="Atur momen yang ditampilkan, kesinambungan adegan, framing, kostum, dan karakter. Gaya gambar tetap mengikuti pilihan proyek." fallback={DEFAULT_VISUAL_INSTRUCTIONS} settings={settings} onSettings={onSettings} />
    <StyleInstructions settings={settings} onSettings={onSettings} />
    <details className="rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink-2">
      <summary className="cursor-pointer font-semibold text-ink">Aturan yang tetap diatur Bang Story</summary>
      <p className="mt-2">Format keluaran, bahasa proyek, jumlah adegan yang diminta, pilihan gerak kamera, dan template narasi dengan jeda hening tetap disertakan otomatis. Kamu tidak perlu menulis format JSON atau placeholder. Instruksi ini mengarahkan LLM penyusun cerita dan storyboard; prompt gaya gambar dan reference sheet tetap ditambahkan saat generasi gambar.</p>
    </details>
  </>
}
