import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Only these website assets can enter a public preview. Never walk private/,
// vendor/, local configuration, generated game code or source-export folders.
export const PREVIEW_FILES = [
  'index.html', 'game.html', 'app.js', 'game.js', 'catalog.js', 'deployment.js', 'display-settings.js',
  'styles.css', 'arcade.css', 'arcade-cabinet.js', 'arcade-session.js', 'lib/three/three.module.min.js',
  'lib/three/three.core.min.js', 'lib/three/LICENSE',
  ...['umk3', 'nfs', 'gt2', 'gt4', 're3', 'cover-fallback', 'arcade-fallback', 'favicon'].map(name => `assets/${name}.svg`),
];
const GENERATED = ['.nojekyll', 'LICENSE', 'preview-build.json'];

// Version the complete first-party module graph together. Existing tester tabs
// must not mix a newly deployed entry point with a cached cabinet or catalogue.
// Vendor imports retain their own relative paths and are never rewritten.
export function versionBuildSources(sources, { basePath = '/', configuration = '' } = {}) {
  const version = createHash('sha256').update(basePath).update('\0').update(configuration).update('\0');
  for (const [relative, data] of [...sources].sort(([a], [b]) => a === b ? 0 : a < b ? -1 : 1)) {
    if (!relative.startsWith('lib/')) version.update(relative).update('\0').update(data).update('\0');
  }
  const release = version.digest('hex').slice(0, 12);
  const firstParty = new Set(sources.map(([relative]) => relative).filter(relative => !relative.startsWith('lib/') && /\.(js|css)$/.test(relative)));
  const origin = 'https://arcade-build.invalid';
  const rewritten = sources.map(([relative, source]) => {
    let data = source;
    if (relative.endsWith('.html')) {
      data = data.replace(/\b(src|href)=(["'])([^"']+)\2/g, (match, attribute, quote, value) => {
        const target = new URL(value, origin + basePath + relative);
        if (target.origin !== origin || !target.pathname.startsWith(basePath)) return match;
        const name = target.pathname.slice(basePath.length);
        if (!firstParty.has(name) || !((attribute === 'src' && name.endsWith('.js')) || (attribute === 'href' && name.endsWith('.css')))) return match;
        target.searchParams.set('v', release);
        return `${attribute}=${quote}${target.pathname}${target.search}${target.hash}${quote}`;
      });
    } else if (relative.endsWith('.js') && !relative.startsWith('lib/')) {
      data = data.replace(/(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(["'])([^"']+)\2/g, (match, prefix, quote, specifier) => {
        if (!/^\.\.?\//.test(specifier)) return match;
        const target = new URL(specifier, origin + '/' + relative);
        if (!firstParty.has(target.pathname.slice(1))) return match;
        target.searchParams.set('v', release);
        return `${prefix}${quote}${specifier.split(/[?#]/)[0]}${target.search}${target.hash}${quote}`;
      });
    }
    return [relative, data];
  });
  return { release, sources: rewritten };
}

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
  const versioned = versionBuildSources(sources, { basePath: base, configuration: repository });
  for (const [relative, data] of versioned.sources) {
    const target = path.join(output, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, data);
  }
  return { output, basePath: base, release: versioned.release, files: sources.map(([name]) => name) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argument = name => process.argv.slice(2).find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
  const result = buildPreview({ basePath: argument('base'), repository: argument('repository') });
  console.log(`Interface preview: ${result.output}\nBase path: ${result.basePath}\n${result.files.length} allowlisted assets; no game files, BIOS, emulator binaries or private cover scans.`);
}
