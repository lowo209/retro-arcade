import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../server.mjs';
// An allowlist export never walks private, vendor, generated, or Git directories.
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const output = path.join(ROOT, 'exports', `retro-arcade-source-${stamp}`);
const allowed = ['public', 'scripts', 'tests', 'docs', '.github', 'server.mjs', 'package.json', '.gitignore', 'README.md', 'THIRD_PARTY.md', 'LICENSE'];
const forbidden = /\.(bin|cue|iso|chd|pbp|zip|7z|rar|exe|dll|wasm|data|ps2|srm|state|sbi|pyc|pyo)$/i;
function copy(source, relative) {
  const info = fs.lstatSync(source);
  if (info.isSymbolicLink()) throw new Error(`Export refuses symlink: ${relative}`);
  if (info.isDirectory()) { for (const name of fs.readdirSync(source).filter(name => name !== '__pycache__')) copy(path.join(source, name), path.join(relative, name)); return; }
  if (forbidden.test(relative)) throw new Error(`Export refuses game/binary asset: ${relative}`);
  const target = path.join(output, relative); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(source, target);
}
for (const name of allowed) copy(path.join(ROOT, name), name);
console.log(`Source-only export created: ${output}`);
console.log('No games, firmware, emulator binaries, local configuration, or game-derived artifacts included.');
