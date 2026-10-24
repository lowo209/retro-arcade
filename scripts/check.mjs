import { execFileSync } from 'node:child_process';
import { inspectLibrary, ROOT } from '../server.mjs';
const library = inspectLibrary();
console.log(`Local EmulatorJS runtime: ${library.runtime ? 'installed' : 'missing'}`);
console.log(`Retail PS1 BIOS: ${library.bios ? 'checksum verified' : 'missing or invalid'}`);
for (const game of library.games) console.log(`${game.id}: ${game.ready ? 'ready to launch (gameplay verification separate)' : game.reason}`);
try {
  const files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: ROOT, encoding: 'utf8' }).split('\0').filter(Boolean);
  const unsafe = files.filter(f => /^(private|vendor|\.local|exports|dist|node_modules)\//.test(f) || /\.(bin|cue|iso|chd|pbp|zip|7z|rar|exe|dll|wasm|data|ps2|srm|state|sbi)$/i.test(f));
  if (unsafe.length) { console.error('Unsafe source files detected:\n' + unsafe.join('\n')); process.exitCode = 1; }
  else console.log(`Git safety: ${files.length} source files checked; no private game assets eligible for staging.`);
} catch { console.error('Could not run Git safety check. Install Git before preparing a source publication.'); process.exitCode = 1; }
