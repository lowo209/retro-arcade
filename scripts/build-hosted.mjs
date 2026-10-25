import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PREVIEW_FILES, normalizeBasePath, buildPreview, versionBuildSources } from './build-preview.mjs';
import { GAMES } from '../public/catalog.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXTRA = ['frame.html', 'frame.js', 'startup-diagnostics.js', 'guides/browser.html'];
export function assetBase(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !url.pathname.endsWith('/')) throw new Error('Asset base must be a public HTTPS directory URL without credentials, query or fragment.');
  return url.href;
}
export function validateManifest(manifest) {
  const base = assetBase(manifest.assetBase);
  if (manifest.schema !== 1 || !manifest.verifiedAt || !Number.isFinite(Date.parse(manifest.verifiedAt)) || manifest.hosted !== true) throw new Error('Publish only a remotely verified hosted manifest.');
  if (manifest.games?.length !== GAMES.length || new Set(manifest.games.map(g => g.id)).size !== GAMES.length) throw new Error('Hosted library must contain every known game exactly once.');
  function validate(game) {
    if (game.ready && (!['pcsx_rearmed', 'mame2003_plus'].includes(game.core) || !game.romUrl || !Number.isSafeInteger(game.downloadBytes) || game.downloadBytes < 1)) throw new Error('Incomplete playable game.');
    if (game.ready && game.core === 'pcsx_rearmed' && !game.biosUrl) throw new Error('PS1 game is missing firmware.');
    for (const key of ['romUrl', 'biosUrl', 'coverUrl']) {
      if (game[key] && (!game[key].startsWith(base) || !new URL(game[key]).href.startsWith(base))) throw new Error('Asset URL outside the verified release.');
    }
    if (game.alternate) validate(game.alternate);
  }
  for (const game of manifest.games) {
    if (!GAMES.some(g => g.id === game.id)) throw new Error('Unknown hosted game.');
    if (game.id === 'gt4' && (game.ready || game.playerUrl)) throw new Error('GT4 has no verified public build.');
    validate(game);
  }
  return base;
}
export function publicManifest(manifest) {
  const fields = ['id', 'ready', 'experimental', 'reason', 'core', 'region', 'romUrl', 'biosUrl', 'coverUrl', 'downloadBytes', 'label', 'warning'];
  const game = value => ({ ...Object.fromEntries(fields.filter(key => value[key] !== undefined).map(key => [key, value[key]])), ...(value.alternate ? { alternate: game(value.alternate) } : {}) });
  return { schema: 1, hosted: true, assetBase: manifest.assetBase, verifiedAt: manifest.verifiedAt,
    runtime: !!manifest.runtime, bios: !!manifest.bios, biosName: manifest.biosName, games: manifest.games.map(game) };
}
export function buildHosted({ root = ROOT, basePath = '/', repository = 'lowo209/retro-arcade', manifest } = {}) {
  const base = normalizeBasePath(basePath);
  if (!/^[\w-]+\/[\w.-]+$/.test(repository)) throw new Error('Repository must be owner/name.');
  manifest ||= JSON.parse(fs.readFileSync(path.join(root, 'deploy/hosted-library.json'), 'utf8'));
  const assets = validateManifest(manifest), origin = new URL(assets).origin;
  const names = [...PREVIEW_FILES, ...EXTRA];
  const generated = ['.nojekyll', 'LICENSE', 'preview-build.json', 'library.json', 'software.html'];
  const output = path.join(root, 'dist-playable'), sourceRoot = path.join(root, 'public');
  function inspect(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error('Hosted build refuses linked files.');
      if (entry.isDirectory()) inspect(file);
      else if (![...names, ...generated].includes(path.relative(output, file).split(path.sep).join('/'))) throw new Error('Unexpected file in dist-playable; move it aside before rebuilding.');
    }
  }
  if (fs.existsSync(output)) {
    if (fs.lstatSync(output).isSymbolicLink()) throw new Error('Linked output directory.');
    inspect(output);
  }
  const sources = names.map(relative => {
    const file = path.join(sourceRoot, relative);
    if (!fs.realpathSync(file).startsWith(fs.realpathSync(sourceRoot) + path.sep) || fs.lstatSync(file).isSymbolicLink()) throw new Error('Linked source file.');
    let data = fs.readFileSync(file, 'utf8');
    if (relative.endsWith('.html')) {
      data = data.replace(/\b(href|src)="\/(?!\/)([^"]*)"/g, (_, key, target) => `${key}="${base}${target}"`)
        .replace(/LOCAL ARCADE/g, 'PLAYABLE TEST')
        .replace(/Checking (your )?local (game files|library)…/g, 'Loading the tester library…')
        .replace(/this same local address/g, 'this same website address');
      if (relative === 'index.html') data = data.replace(/<meta name="description" content="[^"]*">/, '<meta name="description" content="Play original arcade and PlayStation games in the Retro Arcade tester release. Explore the library, connect a controller and share feedback.">');
      if (relative === 'frame.html') {
        const policy = `default-src 'self'; script-src 'self' ${origin} blob: 'unsafe-eval' 'wasm-unsafe-eval'; connect-src 'self' ${origin} blob: data:; style-src 'self' ${origin} 'unsafe-inline'; img-src 'self' ${origin} blob: data:; font-src 'self' ${origin} data:; worker-src 'self' blob:; media-src 'self' ${origin} blob: data:; object-src 'none'; base-uri 'self'; form-action 'none'`;
        data = data.replace('<head>', `<head><meta http-equiv="Content-Security-Policy" content="${policy}">`);
      }
    }
    if (relative === 'deployment.js') data = `export const IS_PREVIEW = false;\nexport const FEEDBACK_URL = ${JSON.stringify(`https://github.com/${repository}/issues/new?template=tester-feedback.yml`)};\nexport const HOSTED_LIBRARY_URL = 'library.json';\nexport const EMULATOR_DATA_URL = ${JSON.stringify(assets + 'vendor/emulatorjs/data/')};\n`;
    return [relative, data];
  });
  // Only public URLs and catalogue fields enter Pages; source paths and keys do not.
  const library = publicManifest(manifest);
  sources.push(['library.json', JSON.stringify(library, null, 2) + '\n'],
    ['LICENSE', fs.readFileSync(path.join(root, 'LICENSE'), 'utf8')], ['.nojekyll', ''],
    ['preview-build.json', JSON.stringify({ mode: 'playable-test', basePath: base, repository, gamesIncluded: false, firmwareIncluded: false }, null, 2)],
    ['software.html', `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Emulator software — Retro Arcade</title><link rel="stylesheet" href="${base}styles.css"></head><body><main class="game-main"><a href="${base}">← Back to library</a><h1>Emulator licenses & source</h1><p>EmulatorJS 4.2.3 runs the original games through separate emulator cores. These components keep their own licenses; the website’s MIT license does not replace them.</p><ul><li><a href="${assets}vendor/emulatorjs/LICENSE">EmulatorJS GPL-3.0 license</a> · <a href="${assets}vendor/emulatorjs/data/src/emulator.js">Installed, modified frontend source</a> · <a href="https://github.com/EmulatorJS/EmulatorJS/tree/v4.2.3">Complete upstream frontend source</a></li><li><a href="${assets}notices/pcsx_rearmed/license.txt">PCSX ReARMed license</a> · <a href="${assets}notices/mame2003_plus/license.txt">MAME 2003 Plus license</a></li><li><a href="${assets}sources/index.html">Corresponding emulator core sources and build scripts</a></li></ul><p>The installed frontend has one modification: its optional update check is disabled. The reproducible patch is in <a href="https://github.com/${repository}/blob/main/scripts/setup.py">setup.py</a>. Unminified frontend sources are available beside the runtime. MAME 2003 Plus retains its non-commercial licensing restrictions. This tester site has no advertising or paid access.</p><p>Game files, firmware, cover artwork and trademarks are separate from the software licenses.</p></main></body></html>`]);
  const versioned = versionBuildSources(sources, { basePath: base, configuration: JSON.stringify(library) });
  for (const [relative, data] of versioned.sources) { const file = path.join(output, relative); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, data); }
  return { output, basePath: base, release: versioned.release, files: sources.map(([name]) => name) };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argument = name => process.argv.slice(2).find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
  const options = { basePath: argument('base'), repository: argument('repository') };
  const hosted = fs.existsSync(path.join(ROOT, 'deploy/hosted-library.json'));
  const result = hosted ? buildHosted(options) : buildPreview(options);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `directory=${path.basename(result.output)}\n`);
  console.log(`${hosted ? 'Playable tester release' : 'Interface preview'}: ${result.output}`);
}
