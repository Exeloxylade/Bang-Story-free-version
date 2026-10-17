import { execFileSync, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

type Profile = { email: string; directory: string }
const validDirectory = (value: string): boolean => /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(value)

function profiles(root: string): Profile[] {
  const file = join(root, 'account-profiles.json')
  if (!existsSync(file)) return []
  const data: unknown = JSON.parse(readFileSync(file, 'utf8'))
  if (!Array.isArray(data) || !data.every(p => typeof p?.email === 'string' && typeof p?.directory === 'string' && validDirectory(p.directory)))
    throw new Error('Daftar profil Flow tidak bisa dibaca. Pulihkan account-profiles.json dari cadangan.')
  return data
}

function save(root: string, data: Profile[]): void {
  const file = join(root, 'account-profiles.json')
  writeFileSync(`${file}.tmp`, JSON.stringify(data))
  renameSync(`${file}.tmp`, file)
}

export function removeAccountProfile(root: string, email: string): void {
  const data = profiles(root)
  for (const profile of data.filter(p => p.email === email)) {
    // Only generated UUID directory names can reach recursive removal.
    rmSync(join(root, 'account-profiles', profile.directory), { recursive: true, force: true })
  }
  save(root, data.filter(p => p.email !== email))
}

export async function captureFlowLogin(options: {
  root: string; python: string; chromium: string; script: string; email?: string; signal: AbortSignal
}): Promise<{ email: string; google_cookies: string; commit: () => void; discard: () => void }> {
  const { root, python, chromium, script, email, signal } = options
  if (!existsSync(script)) throw new Error('Flow2API perlu diperbarui. Hentikan layanan lalu klik Pasang ulang.')
  const data = profiles(root)
  const previous = email ? data.find(p => p.email === email) : undefined
  const directory = previous?.directory ?? randomUUID()
  const profilePath = join(root, 'account-profiles', directory)
  mkdirSync(profilePath, { recursive: true })
  const discard = (): void => { if (!previous) rmSync(profilePath, { recursive: true, force: true }) }
  try {
    const result = await new Promise<{ email: string; cookies: unknown[] }>((resolve, reject) => {
      if (signal.aborted) { reject(new Error('Login dibatalkan')); return }
      const child = spawn(python, [script], {
        windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'],
        env: { ...process.env, PYTHONUTF8: '1', BANG_LOGIN_PROFILE: profilePath, BANG_LOGIN_EMAIL: email ?? '', BROWSER_EXECUTABLE_PATH: chromium }
      })
      let output = ''
      let oversized = false
      const terminate = (): void => {
        if (!child.pid || child.exitCode !== null) return
        try { execFileSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore', timeout: 5000 }) }
        catch { child.kill() }
      }
      signal.addEventListener('abort', terminate, { once: true })
      const timer = setTimeout(terminate, 11 * 60_000)
      const cleanup = (): void => { clearTimeout(timer); signal.removeEventListener('abort', terminate) }
      child.stdout.on('data', chunk => {
        if (oversized) return
        output += chunk.toString('utf8')
        if (Buffer.byteLength(output) > 524288) { oversized = true; output = ''; terminate() }
      })
      child.once('error', () => { cleanup(); reject(new Error(signal.aborted ? 'Login dibatalkan' : 'Browser login tidak bisa dibuka. Coba pasang ulang.')) })
      child.once('close', code => {
        cleanup()
        if (signal.aborted) { reject(new Error('Login dibatalkan')); return }
        if (code !== 0 || oversized) {
          reject(new Error(code === 3 ? 'Akun berbeda. Hubungkan ulang dengan akun Google yang sama.' : code === 2 ? 'Browser ditutup sebelum login selesai.' : code === 4 ? 'Waktu login habis. Coba hubungkan lagi.' : 'Login belum berhasil. Pastikan Google Flow terbuka dan coba lagi.'))
          return
        }
        try {
          const value = JSON.parse(output)
          if (typeof value.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email) || !Array.isArray(value.cookies) || !value.cookies.length || (email && value.email !== email)) throw new Error()
          resolve(value)
        } catch { reject(new Error('Sesi Flow tidak bisa dibaca. Coba hubungkan lagi.')) }
      })
    })
    return {
      email: result.email, google_cookies: JSON.stringify(result.cookies), discard,
      commit: () => {
        // A fresh login of an existing email replaces its profile instead of creating a duplicate account.
        const current = profiles(root)
        save(root, [...current.filter(p => p.email !== result.email), { email: result.email, directory }])
        for (const old of current.filter(p => p.email === result.email && p.directory !== directory))
          rmSync(join(root, 'account-profiles', old.directory), { recursive: true, force: true })
      }
    }
  } catch (e) { discard(); throw e }
}
