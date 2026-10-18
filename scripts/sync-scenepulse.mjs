import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.resolve(process.argv[2] || path.join(root, '../scenepulse/skills/scenepulse'));
const target = path.join(root, 'resources/scenepulse/skill');
const files = [];
function copy(directory, relative = '') {
  for (const entry of fs.readdirSync(directory, {withFileTypes:true})) {
    if (['node_modules', '.runtime', '__pycache__', '.git', 'dist'].includes(entry.name)) continue;
    const rel = path.join(relative, entry.name);
    if (entry.isDirectory()) copy(path.join(directory, entry.name), rel);
    else if (entry.isFile() && !entry.name.endsWith('.pyc')) {
      const bytes = fs.readFileSync(path.join(directory, entry.name));
      const output = path.join(target, rel);
      fs.mkdirSync(path.dirname(output), {recursive:true});
      fs.writeFileSync(output, bytes);
      files.push({file:rel.replaceAll('\\','/'),sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
    }
  }
}
copy(source);
fs.writeFileSync(path.join(target, '../ORIGIN.json'), JSON.stringify({repository:'https://github.com/Exeloxylade/ScenePulse',
  commit:'fe470c8',skillVersion:'0.3.0',files}, null, 2)+'\n');
console.log(`ScenePulse: ${files.length} skill files transferred; runtime caches excluded.`);
