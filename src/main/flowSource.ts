import { cpSync, existsSync, mkdirSync, renameSync } from 'node:fs'
import { dirname, join } from 'node:path'

/** Replace only server code, preserving local accounts and configuration for upgrades. */
export function replaceFlowSource(current: string, staged: string): void {
  if (!existsSync(join(staged, 'main.py')) || !existsSync(join(staged, 'src', 'main.py')))
    throw new Error('Arsip Flow2API tidak lengkap. Coba pasang ulang.')
  if (existsSync(current)) {
    for (const relative of ['data', 'tmp', 'config/setting.toml']) {
      const saved = join(current, relative)
      if (!existsSync(saved)) continue
      const target = join(staged, relative)
      mkdirSync(dirname(target), { recursive: true })
      cpSync(saved, target, { recursive: true })
    }
    const backup = `${current}.backup-${Date.now()}`
    renameSync(current, backup)
    try { renameSync(staged, current) }
    catch (e) { renameSync(backup, current); throw e }
  } else renameSync(staged, current)
}
