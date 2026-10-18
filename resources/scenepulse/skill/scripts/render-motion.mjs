// ScenePulse's isolated renderer for the Bang Motion OPENER timeline contract.
// Upstream architecture: Bang Tutorial, MIT; see ../vendor/bang-motion/LICENSE.
import {parseArgs} from 'node:util';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createServer} from 'node:http';
import {readFile, realpath, stat, mkdir, access, writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {once} from 'node:events';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.env.PUPPETEER_CACHE_DIR ??= path.join(ROOT, '.runtime', 'browser');
const {values: opts} = parseArgs({options: {
  doctor: {type: 'boolean'}, project: {type: 'string'}, output: {type: 'string'},
  shots: {type: 'string'}, times: {type: 'string'}, width: {type: 'string', default: '640'},
  'allow-network': {type: 'boolean', default: false},
}});
function require(ok, message) { if (!ok) throw new Error(message); }
async function exists(file) { try { await access(file); return true; } catch { return false; } }
function inside(root, file) { const rel = path.relative(root, file); return !rel.startsWith('..') && !path.isAbsolute(rel); }
const mime = {'.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.mp4':'video/mp4', '.webm':'video/webm', '.wav':'audio/wav', '.mp3':'audio/mpeg', '.ogg':'audio/ogg', '.woff2':'font/woff2', '.ttf':'font/ttf'};

async function serverFor(root) {
  const canonical = await realpath(root);
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      let file = path.resolve(canonical, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
      require(inside(canonical, file), 'Path outside project');
      file = await realpath(file);
      require(inside(canonical, file), 'Symlink outside project');
      const info = await stat(file);
      require(info.isFile(), 'Not a file');
      // Local footage seeking needs HTTP byte ranges.
      let start = 0, end = info.size - 1, code = 200;
      if (req.headers.range) {
        const match = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range);
        require(match, 'Invalid range');
        start = Number(match[1]); end = match[2] ? Number(match[2]) : end;
        if (start > end || end >= info.size) { res.writeHead(416, {'Content-Range':`bytes */${info.size}`}); res.end(); return; }
        code = 206;
      }
      const headers = {'Content-Type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control':'no-store', 'Accept-Ranges':'bytes', 'Content-Length':end-start+1};
      if (code === 206) headers['Content-Range'] = `bytes ${start}-${end}/${info.size}`;
      res.writeHead(code, headers);
      const {createReadStream} = await import('node:fs');
      createReadStream(file, {start, end}).pipe(res);
    } catch { res.writeHead(404); res.end('Not found'); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return {server, url:`http://127.0.0.1:${server.address().port}/index.html?clean=1`};
}

async function main() {
  let puppeteer;
  try { puppeteer = (await import('puppeteer')).default; }
  catch { throw new Error('Runtime belum terpasang. Jalankan npm ci di folder skill scenepulse.'); }
  const executable = await puppeteer.executablePath();
  require(await exists(executable), 'Browser renderer belum ada. Jalankan npm ci di folder skill.');
  if (opts.doctor) { console.log(JSON.stringify({status:'ready', browser:executable, isolatedProfile:true})); return; }
  require(opts.project && (!!opts.output !== !!opts.shots), 'Gunakan --project FOLDER dan salah satu --output MP4 / --shots FOLDER --times 0,1,2');
  const project = path.resolve(opts.project);
  const config = JSON.parse(await readFile(path.join(project, 'motion.json'), 'utf8'));
  require(config.schemaVersion === 1 && Number.isInteger(config.durationMs) && config.durationMs > 0, 'Manifest motion tidak valid');
  for (const name of ['width', 'height']) require(Number.isInteger(config[name]) && config[name] >= 160 && config[name] <= 4096, 'Ukuran panggung tidak valid');
  const requested = Number(opts.width);
  require(Number.isInteger(requested) && requested >= 160 && requested <= 3840, 'Lebar render harus 160–3840');
  const width = Math.floor(requested / 2) * 2;
  const scale = width / config.width;
  const height = Math.round(config.height * scale);
  require(height % 2 === 0, 'Rasio ini menghasilkan tinggi ganjil; pilih lebar lain untuk H.264');
  const fps = 30, total = Math.ceil(config.durationMs / 1000 * fps);
  const times = opts.shots ? (opts.times || '').split(',').filter(Boolean).map(Number) : [];
  require(!opts.shots || times.length > 0 && times.every(t => Number.isFinite(t) && t >= 0 && t < config.durationMs / 1000), 'Detik snapshot harus di dalam timeline');
  if (opts.output) {
    require(!await exists(path.resolve(opts.output)), 'Output sudah ada');
    require(path.extname(opts.output).toLowerCase() === '.mp4', 'Output harus MP4');
    await mkdir(path.dirname(path.resolve(opts.output)), {recursive:true});
  } else {
    require(!await exists(path.resolve(opts.shots)), 'Folder snapshot sudah ada; pilih nama baru');
    await mkdir(path.resolve(opts.shots), {recursive:true});
  }
  const {server, url} = await serverFor(project);
  let browser, encoder;
  const errors = [], blocked = [], pages = [];
  try {
    // Puppeteer creates a fresh temporary profile; no installed browser/profile/CDP attachment.
    browser = await puppeteer.launch({headless:true, args:['--autoplay-policy=no-user-gesture-required']});
    const page = await browser.newPage();
    const seed = [...config.projectId].reduce((value, char) => Math.imul(value ^ char.charCodeAt(0), 16777619) >>> 0, 2166136261);
    await page.evaluateOnNewDocument(initial => {
      let value = initial;
      Math.random = () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296; };
    }, seed);
    await page.setViewport({width:config.width, height:config.height, deviceScaleFactor:scale});
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400 && !response.url().endsWith('favicon.ico')) errors.push(`${response.status()} ${response.url()}`); });
    await page.setRequestInterception(true);
    page.on('request', async request => {
      try {
        const remote = new URL(request.url());
        if (['data:', 'blob:', 'about:'].includes(remote.protocol) || remote.origin === new URL(url).origin) { await request.continue(); return; }
        let local;
        if (['https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js', 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js'].includes(remote.href)) local = path.join(ROOT, 'node_modules/gsap/dist/gsap.min.js');
        const threePrefix = 'https://cdn.jsdelivr.net/npm/three@0.161.0/';
        if (remote.href.startsWith(threePrefix)) {
          const candidate = path.resolve(ROOT, 'node_modules/three', remote.href.slice(threePrefix.length));
          if (inside(path.join(ROOT, 'node_modules/three'), candidate)) local = candidate;
        }
        if (local) { await request.respond({status:200, contentType:'text/javascript', headers:{'Access-Control-Allow-Origin':'*'}, body:await readFile(local)}); return; }
        if (opts['allow-network'] && ['http:', 'https:'].includes(remote.protocol)) { await request.continue(); return; }
        blocked.push(remote.href); await request.abort('blockedbyclient');
      } catch (error) { errors.push(error.message); try { await request.abort(); } catch {} }
    });
    await page.goto(url, {waitUntil:'networkidle0', timeout:60000});
    await page.waitForFunction(() => window.OPENER && window.OPENER.ready && (!window.OPENER.clipsReady || window.OPENER.clipsReady()), {timeout:60000});
    await page.evaluate(() => document.fonts.ready);
    const contract = await page.evaluate(() => ({W:window.OPENER.W ?? document.getElementById('stage')?.offsetWidth, H:window.OPENER.H ?? document.getElementById('stage')?.offsetHeight, duration:window.OPENER.DURATION, seek:typeof window.OPENER.seek, seekFrame:typeof window.OPENER.seekFrame, timeline:!!window.OPENER.tl}));
    require(contract.W === config.width && contract.H === config.height, 'OPENER.W/H berbeda dari motion.json');
    require(Number.isFinite(contract.duration) && Math.abs(contract.duration * 1000 - config.durationMs) <= 1, 'OPENER.DURATION berbeda dari motion.json; selaraskan timeline dengan durasi narasi');
    require(contract.seek === 'function' || contract.seekFrame === 'function' || contract.timeline, 'OPENER tidak menyediakan seek/timeline');
    require(blocked.length === 0, `Aset eksternal diblokir: ${[...new Set(blocked)].join(', ')}. Gunakan aset lokal atau --allow-network secara eksplisit.`);
    require(errors.length === 0, `Halaman gagal: ${errors.join('; ')}`);
    await page.evaluate(() => { window.OPENER.tl?.pause(); for (const media of document.querySelectorAll('audio,video')) media.muted = true; });
    async function capture(t) {
      await page.evaluate(async time => {
        const opener = window.OPENER;
        if (opener.seekFrame) await opener.seekFrame(time);
        else if (opener.seek) await opener.seek(time);
        else opener.tl.pause(time, false);
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      }, t);
      require(errors.length === 0, `Kesalahan saat seek: ${errors.join('; ')}`);
      return page.screenshot({type:'png', clip:{x:0,y:0,width:config.width,height:config.height}});
    }
    if (opts.shots) {
      for (let i=0; i<times.length; i++) {
        const file = path.join(path.resolve(opts.shots), `frame-${String(i).padStart(3,'0')}-${times[i]}.png`);
        await writeFile(file, await capture(times[i])); pages.push(file);
      }
    } else {
      let stderr = '';
      encoder = spawn('ffmpeg', ['-v','error','-nostdin','-n','-f','image2pipe','-vcodec','png','-framerate',String(fps),'-i','pipe:0','-an','-t',String(config.durationMs/1000),'-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',path.resolve(opts.output)], {stdio:['pipe','ignore','pipe'], windowsHide:true});
      encoder.stderr.on('data', data => { stderr = (stderr + data.toString()).slice(-6000); });
      let processError;
      encoder.on('error', error => { processError = error; });
      encoder.stdin.on('error', error => { processError = error; });
      const finished = new Promise(resolve => encoder.once('close', code => resolve(code)));
      for (let i=0; i<total; i++) {
        require(!processError && encoder.exitCode === null, `FFmpeg berhenti: ${processError?.message || stderr}`);
        if (!encoder.stdin.write(await capture(i/fps))) await once(encoder.stdin, 'drain');
      }
      encoder.stdin.end();
      const code = await finished;
      require(code === 0 && !processError, `FFmpeg gagal: ${processError?.message || stderr}`);
    }
    const result = {schemaVersion:1, engine:'bang-motion/gsap', upstreamCommit:'c1aa65e921c970d858705fcb4a53a8294d1a4131',
      durationMs:config.durationMs, fps, width, height, frameCount:opts.shots ? times.length : total,
      isolatedProfile:true, browserVersion:await browser.version(), networkAllowed:opts['allow-network'], setupSeed:seed,
      silentVideo:!!opts.output, screenshots:pages, output:opts.output ? path.resolve(opts.output) : null};
    if (opts.output) await writeFile(path.resolve(opts.output)+'.motion.json', JSON.stringify(result,null,2)+'\n', {flag:'wx'});
    console.log(JSON.stringify(result));
  } finally {
    if (encoder && encoder.exitCode === null) encoder.kill();
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => { console.error(`ScenePulse motion: ${error.message}`); process.exitCode = 1; });
