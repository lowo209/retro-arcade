import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Only these website assets can enter a public preview. Never walk private/,
// vendor/, local configuration, generated game code or source-export folders.
export const PREVIEW_FILES = [
  'index.html', 'game.html', 'app.js', 'game.js', 'catalog.js', 'deployment.js',
  'styles.css', 'arcade-cabinet.js', 'lib/three/three.module.min.js',
  'lib/three/three.core.min.js', 'lib/three/LICENSE',
  ...['umk3', 'nfs', 'gt2', 'gt4', 're3', 'cover-fallback', 'arcade-fallback', 'favicon'].map(name => `assets/${name}.svg`),
];
const GENERATED = ['.nojekyll', 'LICENSE', 'preview-build.json'];

export function normalizeBasePath(value = '/') {
  if (!/^\/?(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]*\/?$/.test(value)) throw new Error('Use a root path or repository name for --base, without URLs or traversal.');
  const segments = value.split('/').filter(Boolean);
  return `/${segments.length ? segments.join('/') + '/' : ''}`;
}

export function buildPreview({ root = ROOT, basePath = '/', repository = 'lowo209/retro-arcade' } = {}) {
  const base = normalizeBasePath(basePath);
  if (!/^[\w-]+\/[\w.-]+$/.test(repository)) throw new Error('Repository must be owner/name.');
  const output = path.resolve(root, 'dist');
  const publicRoot = path.resolve(root, 'public');
  const allowed = new Set([...PREVIEW_FILES, ...GENERATED]);
  function files(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
      const file = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Preview refuses symlink: ${file}`);
      return entry.isDirectory() ? files(file) : [file];
    });
  }
  if (fs.existsSync(output)) {
    if (fs.lstatSync(output).isSymbolicLink()) throw new Error('Preview refuses a linked output directory.');
    for (const file of files(output)) {
      const relative = path.relative(output, file).split(path.sep).join('/');
      if (!allowed.has(relative)) throw new Error(`Unexpected file in dist; move it aside before rebuilding: ${relative}`);
    }
  }
  if (fs.realpathSync(publicRoot) !== publicRoot) throw new Error('Preview source must be a real public directory.');
  // Validate every input before writing the output.
  const sources = PREVIEW_FILES.map(relative => {
    const source = path.join(publicRoot, relative);
    if (!fs.realpathSync(source).startsWith(publicRoot + path.sep) || fs.lstatSync(source).isSymbolicLink()) throw new Error(`Preview refuses linked source: ${relative}`);
    let data = fs.readFileSync(source, 'utf8');
    if (relative.endsWith('.html')) {
      data = data.replace(/\b(href|src)="\/(?!\/)([^"]*)"/g, (_, attribute, target) => `${attribute}="${base}${target}"`)
        .replace(/LOCAL ARCADE/g, 'TESTER PREVIEW')
        .replace(/Checking (your )?local (game files|library)…/g, 'Loading the interface preview…');
      if (relative === 'index.html') data = data.replace(/<meta name="description" content="[^"]*">/, '<meta name="description" content="Explore the Retro Arcade interface preview: interactive 3D cabinet, eight-game library, search, filters and favorites. Game playback is available in the local build.">');
    }
    if (relative === 'deployment.js') data = `export const IS_PREVIEW = true;\nexport const FEEDBACK_URL = ${JSON.stringify(`https://github.com/${repository}/issues/new?template=tester-feedback.yml`)};\nexport const HOSTED_LIBRARY_URL = '';\nexport const EMULATOR_DATA_URL = '';\n`;
    return [relative, data];
  });
  sources.push(['LICENSE', fs.readFileSync(path.join(root, 'LICENSE'), 'utf8')], ['.nojekyll', ''],
    ['preview-build.json', JSON.stringify({ mode: 'interface-preview', basePath: base, repository, gamesIncluded: false, firmwareIncluded: false }, null, 2) + '\n']);
  for (const [relative, data] of sources) {
    const target = path.join(output, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, data);
  }
  return { output, basePath: base, files: sources.map(([name]) => name) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argument = name => process.argv.slice(2).find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
  const result = buildPreview({ basePath: argument('base'), repository: argument('repository') });
  console.log(`Interface preview: ${result.output}\nBase path: ${result.basePath}\n${result.files.length} allowlisted assets; no game files, BIOS, emulator binaries or private cover scans.`);
}
