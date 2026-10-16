import { useEffect, useState } from 'react'
import type { AppSettings, FlowSetupStatus } from '@shared/types'
import { Button, confirmDialog } from '../components/ui'
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
  useEffect(() => {
    if (status?.state !== 'running' || status.connecting) return
    const timer = setInterval(() => { void window.api.flowSetup.check().then(setStatus).catch(() => {}) }, 30_000)
    return () => clearInterval(timer)
  }, [status?.state, status?.connecting])
  const action = async (fn: () => Promise<unknown>): Promise<void> => {
    setBusy(true)
    try { await fn() }
    catch (e) { toast('error', errorText(e)) }
    finally {
      try { setStatus(await window.api.flowSetup.status()); onChanged() }
      finally { setBusy(false) }
    }
  }
  const remove = async (id: number, email: string): Promise<void> => {
    if (await confirmDialog({ title: 'Hapus akun Flow?', body: `${email} akan dihapus dari Bang Story beserta profil browser login lokalnya. Proyek kamu tetap tersimpan.`, confirm: 'Hapus akun', danger: true }))
      await action(() => window.api.flowSetup.removeAccount(id))
  }
  const installing = status?.state === 'installing'
  const starting = status?.state === 'starting'
  const running = status?.state === 'running'
  const connecting = status?.connecting
  const locked = busy || connecting || installing || starting
  const unsupported = status?.state === 'unsupported'
  return <div className="space-y-3 rounded-xl border border-line-2 bg-paper p-4">
    <div className="space-y-1">
      <h3 className="font-semibold">Akun Google Flow</h3>
      <p className="text-xs text-muted">Klik hubungkan, lalu login langsung di browser Google. Kebutuhan dipasang otomatis saat pertama kali; akun berikutnya punya profil browser sendiri.</p>
    </div>
    {status && <p className="text-sm" role="status">{status.message}</p>}
    {status?.error && <p className="text-sm text-bad-ink" role="alert">{status.error}</p>}
    {installing && <progress aria-label="Pemasangan Google Flow" className="w-full" max={1} value={status?.progress} />}
    <div className="flex flex-wrap gap-2">
      <Button variant="primary" disabled={!status || locked || unsupported} onClick={() => void action(() => window.api.flowSetup.connect())}>
        {connecting ? 'Menghubungkan…' : status?.accounts.length ? 'Tambah akun Google' : 'Hubungkan Google Flow'}
      </Button>
      {connecting && <Button onClick={() => void window.api.flowSetup.cancelConnect().catch(e => toast('error', errorText(e)))}>Batalkan login</Button>}
      {running && !connecting && <Button disabled={locked} onClick={() => void action(window.api.flowSetup.check)}>Periksa akun</Button>}
    </div>
    {!!status?.accounts.length && <ul aria-label="Akun Google Flow" className="space-y-2">
      {status.accounts.map(account => <li key={account.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface p-3">
        <div className="min-w-0 flex-1">
          <p className="break-all text-sm font-semibold">{account.email}</p>
          <p className="text-xs text-muted">{account.ready ? 'Terhubung' : account.enabled ? 'Perlu dihubungkan ulang' : 'Dinonaktifkan'}</p>
        </div>
        <Button size="sm" disabled={locked} onClick={() => void action(() => window.api.flowSetup.connect(account.id))}>Hubungkan ulang</Button>
        <Button size="sm" disabled={locked} onClick={() => void remove(account.id, account.email)}>Hapus</Button>
      </li>)}
    </ul>}
    <p className="text-xs text-muted">Setelah terhubung, Google Flow dipilih untuk gambar dan video proyek baru. Kamu tetap perlu akses Flow dan kuota. Jika Google meminta verifikasi, selesaikan di browser. Pemeriksaan akun tidak memakai kuota generasi.</p>
    <details className="border-t border-line pt-3">
      <summary className="cursor-pointer text-xs font-semibold">Pengaturan lanjutan</summary>
      <div className="mt-3 space-y-3">
        <label className="flex cursor-pointer items-center gap-3 text-sm">
          <input type="checkbox" checked={settings.flowLocalEnabled} disabled={locked || unsupported} onChange={e => void action(() => window.api.flowSetup.setEnabled(e.target.checked))} />
          Gunakan layanan Flow2API lokal
        </label>
        {settings.flowLocalEnabled && <div className="flex flex-wrap gap-2">
          {!running && !starting && !installing && <Button disabled={locked} onClick={() => void action(window.api.flowSetup.install)}>{status?.installed ? 'Pasang ulang' : 'Pasang layanan'}</Button>}
          {installing && !connecting && <Button onClick={() => void window.api.flowSetup.cancel()}>Batalkan pemasangan</Button>}
          {status?.installed && !running && !starting && !installing && <Button disabled={locked} onClick={() => void action(window.api.flowSetup.start)}>Jalankan layanan</Button>}
          {(running || starting) && <Button disabled={connecting} onClick={() => void window.api.flowSetup.stop().catch(e => toast('error', errorText(e)))}>Hentikan layanan</Button>}
          {running && <Button disabled={locked} onClick={() => void action(window.api.flowSetup.openPanel)}>Buka panel lanjutan</Button>}
        </div>}
      </div>
    </details>
  </div>
}
