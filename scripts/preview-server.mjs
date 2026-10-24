import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const selected = process.env.PREVIEW_DIRECTORY || 'dist';
if (!['dist', 'dist-playable'].includes(selected)) throw new Error('Preview only dist or dist-playable.');
const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', selected);
const { basePath } = JSON.parse(fs.readFileSync(path.join(directory, 'preview-build.json'), 'utf8'));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json' };
const port = Number(process.env.PREVIEW_PORT || 4173);
const server = http.createServer((request, response) => {
  if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(request.headers.host || '')) { response.writeHead(403).end(); return; }
  if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405).end(); return; }
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname === '/' || (basePath !== '/' && pathname === basePath.slice(0, -1))) { response.writeHead(302, { Location: basePath + 'index.html' }).end(); return; }
    if (!pathname.startsWith(basePath) || pathname.includes('\\')) { response.writeHead(404).end(); return; }
    const relative = pathname.slice(basePath.length) || 'index.html';
    const file = path.resolve(directory, relative);
    if (!file.startsWith(directory + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile() || !fs.realpathSync(file).startsWith(directory + path.sep)) { response.writeHead(404).end(); return; }
    response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    if (request.method === 'HEAD') response.end(); else fs.createReadStream(file).pipe(response);
  } catch { response.writeHead(400).end(); }
});
server.listen(port, '127.0.0.1', () => console.log(`Tester preview: http://127.0.0.1:${port}${basePath}`));
