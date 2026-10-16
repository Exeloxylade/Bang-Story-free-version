import { spawn, execFileSync, type ChildProcess } from 'node:child_process'
import { randomBytes, createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createServer } from 'node:net'
import { BrowserWindow, session } from 'electron'
import type { FlowSetupStatus } from '@shared/types'
import { defaultFlowModel } from '@shared/media'
import { dataDir } from './paths'
import { getSecret, requireSecret, setSecret, recordCheck } from './secrets'
import { getSettings, setSettings } from './settings'
import { emit } from './events'
import { sleep } from './services/http'
import { replaceFlowSource } from './flowSource'

export const LOCAL_FLOW_URL = 'http://127.0.0.1:8765'
const FLOW_REPOSITORY = 'Exeloxylade/flow2api-English'
const REV = 'd4bf2f744d38de4120ecad45efcea81c0822e571'
const PYTHON_URL = 'https://github.com/astral-sh/python-build-standalone/releases/download/20261009/cpython-3.12.15%2B20261009-x86_64-pc-windows-msvc-install_only.tar.gz'
const PYTHON_SHA = '194c8f0d9e0de6f1c4576e5dfa67819a48c764be87608b74b8ad43387a57b93b'
const root = (): string => join(dataDir(), 'tools', 'flow2api')
const source = (): string => join(root(), 'source')
const python = (): string => join(root(), 'python', 'python.exe')
const browserDir = (): string => join(root(), 'browsers')
const installed = (): boolean => existsSync(join(root(), 'installed.json')) && existsSync(python()) && existsSync(join(source(), 'main.py'))
function sourceIsCurrent(): boolean {
  if (!installed()) return false
  try {
    const marker = JSON.parse(readFileSync(join(root(), 'installed.json'), 'utf8')) as { repository?: string; revision?: string }
    return marker.repository === FLOW_REPOSITORY && marker.revision === REV
  } catch { return false }
}
let server: ChildProcess | null = null
let worker: ChildProcess | null = null
let setup: AbortController | null = null
let stopping = false
let panel: BrowserWindow | null = null
let adminSession: string | null = null
let status: FlowSetupStatus = { state: 'missing', installed: false, progress: 0, message: 'Belum dipasang', error: null, accountReady: false, activeAccounts: 0 }

function report(patch: Partial<FlowSetupStatus>): void {
  status = { ...status, ...patch, installed: installed() }
  emit.flow(status)
}

export function flowSetupStatus(): FlowSetupStatus {
  if (process.platform !== 'win32' || process.arch !== 'x64') return { ...status, state: 'unsupported', message: 'Pemasangan otomatis tersedia untuk Windows 64-bit. Kamu tetap bisa memakai server eksternal.' }
  if (installed() && !sourceIsCurrent() && !setup && !server)
    return { ...status, installed: true, state: 'installed', message: 'Flow2API English tersedia. Klik Pasang ulang untuk memperbarui panel dan menyimpan akun lama.' }
  return { ...status, installed: installed(), state: status.state === 'missing' && installed() ? 'installed' : status.state }
}

function killTree(child: ChildProcess | null): void {
  if (!child?.pid || child.exitCode !== null) return
  try { execFileSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore', timeout: 5000 }) }
  catch { child.kill() }
}

function run(file: string, args: string[], signal: AbortSignal, cwd = root(), env: NodeJS.ProcessEnv = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new Error('Pemasangan dibatalkan'))
    const child = spawn(file, args, { cwd, windowsHide: true, stdio: 'ignore', env: { ...process.env, ...env } })
    worker = child
    const abort = (): void => killTree(child)
    signal.addEventListener('abort', abort, { once: true })
    const cleanup = (): void => { signal.removeEventListener('abort', abort); if (worker === child) worker = null }
    child.once('error', () => { cleanup(); reject(new Error('Program pemasangan tidak bisa dijalankan. Periksa koneksi dan ruang disk.')) })
    child.once('exit', code => { cleanup(); code === 0 && !signal.aborted ? resolve() : reject(new Error(signal.aborted ? 'Pemasangan dibatalkan' : 'Pemasangan gagal. Periksa koneksi internet dan ruang disk, lalu coba lagi.')) })
  })
}

async function download(url: string, file: string, signal: AbortSignal, digest?: string): Promise<void> {
  const res = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(10 * 60 * 1000)]) })
  if (!res.ok) throw new Error('Unduhan gagal. Periksa koneksi internet, lalu coba lagi.')
  const bytes = Buffer.from(await res.arrayBuffer())
  if (digest && createHash('sha256').update(bytes).digest('hex') !== digest) throw new Error('Unduhan Python tidak utuh. Coba pasang lagi.')
  writeFileSync(file, bytes)
}

// Credentials remain in Bang Story's encrypted store and enter the server only through its environment.
const RUNNER = `import os, sys
sys.path.insert(0, os.getcwd())
from src.core.config import config
from src.core.database import Database
config.get_raw_config()['server'].update(host='127.0.0.1', port=8765)
config.get_raw_config()['captcha']['captcha_method'] = 'personal'
config.get_raw_config()['debug'].update(enabled=False, log_requests=False, log_responses=False)
original_reload = Database.reload_config_to_memory
async def reload_config(self):
    await original_reload(self)
    config.get_raw_config()['global']['api_key'] = os.environ['BANG_FLOW_KEY']
    config.admin_username = 'admin'
    config.admin_password = os.environ['BANG_FLOW_ADMIN']
Database.reload_config_to_memory = reload_config
import uvicorn
from src.main import app
uvicorn.run(app, host='127.0.0.1', port=8765, log_level='error', access_log=False)
`

export function installFlow(): void {
  if (setup) return
  if (!getSettings().flowLocalEnabled) throw new Error('Aktifkan Flow2API lokal dulu.')
  if (flowSetupStatus().state === 'unsupported') throw new Error('Pemasangan otomatis membutuhkan Windows 64-bit.')
  if (server) throw new Error('Hentikan Flow2API dulu sebelum memasang ulang.')
  const ctrl = new AbortController()
  setup = ctrl
  mkdirSync(root(), { recursive: true })
  report({ state: 'installing', progress: 0.05, message: 'Mengunduh Python untuk Flow2API', error: null })
  void (async () => {
    const signal = AbortSignal.any([ctrl.signal, AbortSignal.timeout(30 * 60 * 1000)])
    try {
      if (!existsSync(python())) {
        await download(PYTHON_URL, join(root(), 'python.tar.gz'), signal, PYTHON_SHA)
        await run('tar.exe', ['-xf', join(root(), 'python.tar.gz'), '-C', root()], signal)
      }
      report({ progress: 0.25, message: 'Mengunduh Flow2API English' })
      if (!sourceIsCurrent()) {
        const zip = join(root(), 'source.zip')
        await download(`https://github.com/${FLOW_REPOSITORY}/archive/${REV}.zip`, zip, signal)
        const quote = (s: string): string => `'${s.replace(/'/g, "''")}'`
        await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `Expand-Archive -LiteralPath ${quote(zip)} -DestinationPath ${quote(join(root(), 'unpack'))} -Force`], signal)
        replaceFlowSource(source(), join(root(), 'unpack', `flow2api-English-${REV}`))
      }
      report({ progress: 0.45, message: 'Memasang kebutuhan Flow2API (bisa beberapa menit)' })
      await run(python(), ['-m', 'pip', 'install', '--disable-pip-version-check', '-r', join(source(), 'requirements.txt')], signal)
      report({ progress: 0.75, message: 'Mengunduh browser untuk login Google Flow' })
      await run(python(), ['-m', 'playwright', 'install', 'chromium'], signal, root(), { PLAYWRIGHT_BROWSERS_PATH: browserDir() })
      writeFileSync(join(source(), 'bang-story-runner.py'), RUNNER)
      writeFileSync(join(root(), 'installed.json'), JSON.stringify({ repository: FLOW_REPOSITORY, revision: REV }))
      report({ state: 'installed', progress: 1, message: 'Terpasang. Jalankan Flow2API untuk menghubungkan akun Google.', error: null })
    } catch (e) { report({ state: installed() ? 'installed' : 'error', error: (e as Error).message, message: 'Pemasangan belum selesai' }) }
    finally { setup = null }
  })()
}

export function cancelFlowInstall(): void { setup?.abort(); killTree(worker) }

async function checkPort(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const probe = createServer()
    probe.once('error', () => reject(new Error('Port 8765 sedang dipakai. Tutup program yang memakai port ini lalu coba lagi.')))
    probe.listen(8765, '127.0.0.1', () => probe.close(() => resolve()))
  })
}

function chromium(): string {
  for (const entry of readdirSync(browserDir()).filter(n => n.startsWith('chromium-'))) {
    for (const sub of ['chrome-win', 'chrome-win64']) {
      const file = join(browserDir(), entry, sub, 'chrome.exe')
      if (existsSync(file)) return file
    }
  }
  throw new Error('Browser belum terpasang. Klik Pasang lagi.')
}

async function login(): Promise<string> {
  if (!server || status.state !== 'running') throw new Error('Jalankan Flow2API lokal dulu.')
  if (adminSession) return adminSession
  const res = await fetch(`${LOCAL_FLOW_URL}/api/admin/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: requireSecret('flow2api-admin') }), signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error('Panel Flow2API belum siap. Hentikan lalu jalankan lagi.')
  const body = await res.json() as { token?: string }
  if (!body.token) throw new Error('Login panel Flow2API gagal.')
  return adminSession = body.token
}

export async function checkFlowAccount(): Promise<FlowSetupStatus> {
  if (!server || status.state !== 'running') return flowSetupStatus()
  try {
    const child = server
    const auth = await login()
    const res = await fetch(`${LOCAL_FLOW_URL}/api/tokens`, { headers: { Authorization: `Bearer ${auth}` }, signal: AbortSignal.timeout(10_000) })
    if (!res.ok) { adminSession = null; throw new Error('Akun belum bisa diperiksa. Coba lagi.') }
    const tokens = await res.json() as { is_active?: boolean; at?: string; at_expired?: boolean }[]
    if (server !== child || stopping) return flowSetupStatus()
    const count = tokens.filter(t => t.is_active && !!t.at && !t.at_expired).length
    recordCheck('flow2api-local', count > 0, count ? 'Akun Flow terhubung' : 'Hubungkan akun Flow dulu')
    report({ accountReady: count > 0, activeAccounts: count, error: null, message: count ? 'Akun Flow terhubung. Kamu bisa memilih model di Ide cerita.' : 'Login Google Flow, lalu tambahkan akun aktif di panel Flow2API.' })
  } catch { if (server && !stopping) { recordCheck('flow2api-local', false, 'Akun belum bisa diperiksa'); report({ accountReady: false, activeAccounts: 0, error: 'Akun belum bisa diperiksa. Buka panel atau coba lagi.' }) } }
  return flowSetupStatus()
}

export async function startFlow(): Promise<void> {
  if (server || status.state === 'starting') return
  if (!getSettings().flowLocalEnabled) throw new Error('Aktifkan Flow2API lokal dulu.')
  if (!installed() || setup) throw new Error('Pasang Flow2API sampai selesai dulu.')
  if (!sourceIsCurrent()) throw new Error('Flow2API English perlu dipasang. Klik Pasang ulang; akun dan pengaturan lama akan disimpan.')
  stopping = false
  report({ state: 'starting', message: 'Membuka Flow2API dan browser login', error: null, accountReady: false })
  try {
    await checkPort()
    if (stopping || !getSettings().flowLocalEnabled) return
    if (!getSecret('flow2api-local')) setSecret('flow2api-local', randomBytes(32).toString('hex'))
    if (!getSecret('flow2api-admin')) setSecret('flow2api-admin', randomBytes(24).toString('hex'))
    writeFileSync(join(source(), 'bang-story-runner.py'), RUNNER)
    stopping = false
    const child = spawn(python(), [join(source(), 'bang-story-runner.py')], { cwd: source(), windowsHide: true, stdio: 'ignore', env: { ...process.env, PYTHONUTF8: '1', PYTHONUNBUFFERED: '1', PLAYWRIGHT_BROWSERS_PATH: browserDir(), BROWSER_EXECUTABLE_PATH: chromium(), PERSONAL_BROWSER_USER_DATA_DIR: join(root(), 'google-profile'), BANG_FLOW_KEY: requireSecret('flow2api-local'), BANG_FLOW_ADMIN: requireSecret('flow2api-admin') } })
    server = child
    child.once('error', () => { if (server === child) server = null; report({ state: 'error', error: 'Flow2API tidak bisa dijalankan. Coba pasang ulang.', accountReady: false }) })
    child.once('exit', () => { if (server !== child) return; server = null; adminSession = null; report({ state: stopping ? 'installed' : 'error', accountReady: false, activeAccounts: 0, error: stopping ? null : 'Flow2API berhenti. Jalankan lagi atau pasang ulang.' }) })
    for (let i = 0; i < 120; i++) {
      if (!server || stopping) throw new Error('Flow2API berhenti saat dijalankan.')
      try {
        const res = await fetch(`${LOCAL_FLOW_URL}/v1/models`, { headers: { Authorization: `Bearer ${requireSecret('flow2api-local')}` }, signal: AbortSignal.timeout(1500) })
        if (res.ok && server === child && !stopping && Array.isArray((await res.json() as { data?: unknown }).data)) { report({ state: 'running', progress: 1, message: 'Flow2API berjalan. Hubungkan akun Google Flow.' }); await checkFlowAccount(); return }
      } catch { /* Startup includes browser initialization. */ }
      await sleep(1000)
    }
    throw new Error('Flow2API belum siap. Tutup browser login setelah selesai, lalu coba lagi.')
  } catch (e) { if (stopping) return; stopFlow(); report({ state: 'error', error: (e as Error).message, message: 'Belum bisa dijalankan' }) }
}

export function stopFlow(): void {
  stopping = true
  const child = server
  server = null
  adminSession = null
  if (panel && !panel.isDestroyed()) panel.close()
  panel = null
  killTree(child)
  try { if (getSecret('flow2api-local')) recordCheck('flow2api-local', false, 'Flow2API lokal dihentikan') } catch { /* Shutdown must still terminate the server if a saved key is unreadable. */ }
  report({ state: installed() ? 'installed' : 'missing', accountReady: false, activeAccounts: 0, message: 'Flow2API dihentikan', error: null })
}

export async function enableLocalFlow(enabled: boolean): Promise<void> {
  setSettings({ flowLocalEnabled: enabled })
  if (!enabled) { cancelFlowInstall(); stopFlow() }
}

export async function openFlowPanel(): Promise<void> {
  const token = await login()
  if (panel && !panel.isDestroyed()) { panel.show(); panel.focus(); return }
  const partition = 'persist:bang-story-flow2api'
  const s = session.fromPartition(partition)
  await s.cookies.set({ url: LOCAL_FLOW_URL, name: 'admin_session', value: token, httpOnly: true, sameSite: 'lax', path: '/' })
  panel = new BrowserWindow({ width: 1100, height: 800, title: 'Flow2API · Hubungkan Google Flow', webPreferences: { partition, sandbox: true, contextIsolation: true, nodeIntegration: false } })
  panel.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  panel.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(LOCAL_FLOW_URL + '/')) e.preventDefault() })
  panel.on('closed', () => { panel = null })
  await panel.loadURL(`${LOCAL_FLOW_URL}/manage`)
}

export async function useFlowDefaults(): Promise<void> {
  const ready = await checkFlowAccount()
  if (!ready.accountReady || !getSettings().flowLocalEnabled) throw new Error('Hubungkan akun Flow dulu sampai siap.')
  setSettings({ imageModel: defaultFlowModel('image', '16:9'), videoModel: defaultFlowModel('video', '16:9') })
}

export function shutdownFlow(): void { cancelFlowInstall(); stopFlow() }
