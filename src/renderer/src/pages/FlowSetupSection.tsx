import { useEffect, useState } from 'react'
import type { AppSettings, FlowSetupStatus } from '@shared/types'
import { Button } from '../components/ui'
import { useApp } from '../store/app'
import { errorText } from '../lib/format'

export function FlowSetupSection({ settings, onChanged }: { settings: AppSettings; onChanged: () => void }) {
  const [status, setStatus] = useState<FlowSetupStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const { toast } = useApp()
  useEffect(() => {
    const off = window.api.on.flow(setStatus)
    void window.api.flowSetup.status().then(setStatus).catch(e => toast('error', errorText(e)))
    return off
  }, [toast])
  const action = async (fn: () => Promise<unknown>): Promise<void> => {
    setBusy(true)
    try { await fn(); setStatus(await window.api.flowSetup.status()); onChanged() }
    catch (e) { toast('error', errorText(e)) }
    finally { setBusy(false) }
  }
  const installing = status?.state === 'installing'
  const starting = status?.state === 'starting'
  const running = status?.state === 'running'
  return <div className="space-y-3 rounded-xl border border-line-2 bg-paper p-4">
    <label className="flex cursor-pointer items-center gap-3 font-semibold">
      <input type="checkbox" checked={settings.flowLocalEnabled} disabled={busy || status?.state === 'unsupported'} onChange={e => void action(() => window.api.flowSetup.setEnabled(e.target.checked))} />
      Gunakan Flow2API lokal (opsional)
    </label>
    <p className="text-xs text-muted">Pasang Flow2API English langsung dari Bang Story. Python dan browser diunduh otomatis; tidak perlu Docker. Untuk mengganti panel lama, hentikan server lalu klik Pasang ulang. Akun dan pengaturan lama disimpan.</p>
    {settings.flowLocalEnabled && status && <>
      <p className="text-sm" role="status">{status.accountReady ? 'Akun Flow terhubung' : status.message}</p>
      {status.error && <p className="text-sm text-bad-ink" role="alert">{status.error}</p>}
      {installing && <progress className="w-full" max={1} value={status.progress} />}
      <div className="flex flex-wrap gap-2">
        {!running && !starting && !installing && <Button disabled={busy} onClick={() => void action(window.api.flowSetup.install)}>{status.installed ? 'Pasang ulang' : '1. Pasang Flow2API'}</Button>}
        {installing && <Button onClick={() => void action(window.api.flowSetup.cancel)}>Batalkan pemasangan</Button>}
        {status.installed && !running && !starting && !installing && <Button disabled={busy} onClick={() => void action(window.api.flowSetup.start)}>2. Jalankan dan login</Button>}
        {(running || starting) && <Button onClick={() => void window.api.flowSetup.stop().catch(e => toast('error', errorText(e)))}>Hentikan</Button>}
        {running && <>
          <Button disabled={busy} onClick={() => void action(window.api.flowSetup.openPanel)}>3. Buka panel akun</Button>
          <Button disabled={busy} onClick={() => void action(window.api.flowSetup.check)}>4. Periksa akun</Button>
          <Button variant="primary" disabled={busy || !status.accountReady} onClick={() => void action(window.api.flowSetup.useDefaults)}>5. Gunakan untuk proyek baru</Button>
        </>}
      </div>
      <ol className="list-decimal space-y-2 pl-5 text-xs text-muted">
        <li>Pasang sampai selesai, lalu jalankan. Login akun Google di browser yang terbuka, lalu buka https://flow.google.com di browser yang sama.</li>
        <li>Di panel English, buka Setup guide. Versi ini membutuhkan cookie Google/Flow lengkap, bukan satu Session Token/ST lama.</li>
        <li>Di browser Flow, tekan F12 → Network, muat ulang halaman, lalu pilih permintaan dokumen flow.google.com. Salin nilai Cookie lengkap dari Request Headers.</li>
        <li>Di panel Flow2API, buka Accounts → Add, tempel ke Google Cookies, isi Google Account dengan email yang sama, lalu simpan. Cookie hanya boleh ditempel di server milik kamu.</li>
        <li>Klik Periksa akun sampai akun terhubung, lalu Gunakan untuk proyek baru. Untuk proyek yang sudah ada, pilih penyedia Flow2API dan model gambar/video di Ide cerita.</li>
      </ol>
      <p className="text-xs text-muted">Pemeriksaan akun tidak membuat gambar/video dan tidak memakai kuota generasi. Jika sesi kedaluwarsa, login ulang dan perbarui Google Cookies di panel. Nonaktifkan pilihan ini untuk kembali memakai server eksternal.</p>
    </>}
    {status?.state === 'unsupported' && <p className="text-xs text-muted">{status.message}</p>}
  </div>
}
