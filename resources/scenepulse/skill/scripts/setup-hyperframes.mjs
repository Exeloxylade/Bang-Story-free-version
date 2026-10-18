// HyperFrames 0.8.171 uses this pinned Chrome headless-shell build.
import {Browser, install, computeExecutablePath, detectBrowserPlatform, getDownloadUrl} from '@puppeteer/browsers';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {access, mkdir, rename, rm} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cacheDir = path.join(root, '.runtime', 'hyperframes-browser');
const buildId = '152.0.7977.30';
const platform = detectBrowserPlatform();
if (!platform) throw new Error('Platform browser tidak didukung');
const executablePath = computeExecutablePath({browser:Browser.CHROMEHEADLESSSHELL, buildId, cacheDir, platform});
if (process.argv.includes('--path')) {
  try { await access(executablePath); }
  catch { throw new Error('Jalankan node scripts/setup-hyperframes.mjs dari folder skill'); }
  process.stdout.write(executablePath);
} else {
  let present = false;
  try { await access(executablePath); present = true; } catch {}
  if (!present) {
    const url = await getDownloadUrl(Browser.CHROMEHEADLESSSHELL, platform, buildId);
    const directory = path.join(cacheDir, Browser.CHROMEHEADLESSSHELL);
    await mkdir(directory, {recursive:true});
    const archive = path.join(directory, `${buildId}-${path.basename(url.pathname)}`);
    const partial = `${archive}.part`;
    try {
      // Fetch has a bounded timeout and uses Node's current networking stack.
      const response = await fetch(url, {signal:AbortSignal.timeout(300000)});
      if (!response.ok) throw new Error(`Unduhan browser gagal: HTTP ${response.status}`);
      await pipeline(Readable.fromWeb(response.body), createWriteStream(partial));
      await rm(archive, {force:true});
      await rename(partial, archive);
      await install({browser:Browser.CHROMEHEADLESSSHELL, buildId, cacheDir, platform});
    } finally { await rm(partial, {force:true}); }
  }
  console.log(JSON.stringify({browser:'chrome-headless-shell', buildId, executablePath, cacheDirectory:cacheDir}));
}
