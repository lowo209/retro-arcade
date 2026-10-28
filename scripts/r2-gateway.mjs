// Deployed only on Workers Free. Its platform request cutoff bounds R2 reads.
// R2 bindings include write methods; this application deliberately never uses them.
export const DEFAULT_ORIGINS = ['https://lowo209.github.io', 'http://127.0.0.1:4174'];

export function createGateway({ prefix, objects, allowedOrigins = DEFAULT_ORIGINS }) {
  const safeKey = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(value)
    && !value.endsWith('/') && !value.includes('//') && !value.split('/').some(part => part === '.' || part === '..');
  if (!safeKey(prefix) || !Array.isArray(objects) || !objects.length || objects.length > 512) throw new Error('Invalid gateway release.');
  const files = new Map();
  for (const value of objects) {
    if (!value || !safeKey(value.key) || !value.key.startsWith(prefix + '/') || files.has(value.key)
      || !Number.isSafeInteger(value.bytes) || value.bytes < 1
      || typeof value.etag !== 'string' || !/^[a-f0-9]{32}(?:-[1-9][0-9]*)?$/.test(value.etag)
      || typeof value.contentType !== 'string' || value.contentType.length > 160
      || !/^[\x20-\x7e]+$/.test(value.contentType) || !value.contentType.includes('/')) throw new Error('Invalid gateway object.');
    files.set(value.key, Object.freeze({ key: value.key, bytes: value.bytes, etag: value.etag, contentType: value.contentType }));
  }
  if (!Array.isArray(allowedOrigins) || !allowedOrigins.length || allowedOrigins.length > 8) throw new Error('Invalid gateway origins.');
  const origins = new Set(allowedOrigins);
  for (const origin of origins) {
    const url = new URL(origin);
    if (url.origin !== origin || !['https:', 'http:'].includes(url.protocol)
      || (url.protocol === 'http:' && url.hostname !== '127.0.0.1')) throw new Error('Invalid gateway origin.');
  }
  const exposed = 'Content-Length, Content-Range, Accept-Ranges, ETag, X-Arcade-Gateway';
  const requestHeaders = new Set(['range', 'if-none-match', 'if-match', 'if-range']);
  // Preserve verified byte lengths and strong ETags through Cloudflare's edge.
  const cachePolicy = 'public, max-age=86400, no-transform';
  function headers(origin) {
    const result = new Headers({ 'X-Arcade-Gateway': 'r2-free-v1', 'X-Content-Type-Options': 'nosniff',
      'Cross-Origin-Resource-Policy': 'cross-origin', 'Referrer-Policy': 'no-referrer', 'Vary': 'Origin' });
    if (origin && origins.has(origin)) {
      result.set('Access-Control-Allow-Origin', origin);
      result.set('Access-Control-Expose-Headers', exposed);
    }
    return result;
  }
  function error(status, message, origin, extra = {}) {
    const result = headers(origin);
    result.set('Content-Type', 'text/plain; charset=utf-8'); result.set('Cache-Control', 'no-store');
    for (const [name, value] of Object.entries(extra)) result.set(name, value);
    return new Response(message, { status, headers: result });
  }
  function matches(value, etag, weak = true) {
    return value?.split(',').some(part => part.trim() === '*' || (weak ? part.trim().replace(/^W\//, '') : part.trim()) === etag);
  }
  function rangeFor(value, size) {
    const found = /^bytes=([0-9]*)-([0-9]*)$/.exec(value.trim());
    if (!found || (!found[1] && !found[2])) return null;
    const startValue = found[1] ? Number(found[1]) : null;
    const endValue = found[2] ? Number(found[2]) : null;
    if ((startValue !== null && !Number.isSafeInteger(startValue)) || (endValue !== null && !Number.isSafeInteger(endValue))) return null;
    if (startValue === null) {
      if (!endValue) return null;
      const length = Math.min(endValue, size);
      return { offset: size - length, length };
    }
    const end = endValue === null ? size - 1 : Math.min(endValue, size - 1);
    if (startValue >= size || startValue > end) return null;
    return { offset: startValue, length: end - startValue + 1 };
  }
  async function discard(object) { try { await object?.body?.cancel(); } catch {} }
  return Object.freeze({
    async fetch(request, env) {
      const origin = request.headers.get('Origin');
      if (origin && !origins.has(origin)) return error(403, 'Origin is not allowed.', null);
      if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return error(405, 'Method is not allowed.', origin, { Allow: 'GET, HEAD, OPTIONS' });
      let key;
      try {
        // Inspect the raw path before URL normalizes dot segments. Every release
        // key is plain ASCII, so encoded separators and path aliases are rejected.
        const rawPath = /^[A-Za-z][A-Za-z0-9+.-]*:\/\/[^/?#]*(\/[^?#]*)?/.exec(request.url)?.[1] || '/';
        if (!rawPath.startsWith('/') || !safeKey(rawPath.slice(1))) return error(404, 'File is not available.', origin);
        const url = new URL(request.url);
        if (!['http:', 'https:'].includes(url.protocol) || url.pathname !== rawPath) return error(404, 'File is not available.', origin);
        key = rawPath.slice(1);
      } catch { return error(400, 'Invalid request URL.', origin); }
      const file = files.get(key);
      if (!file) return error(404, 'File is not available.', origin);
      if (request.method === 'OPTIONS') {
        const method = request.headers.get('Access-Control-Request-Method');
        const requested = (request.headers.get('Access-Control-Request-Headers') || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
        if ((method && !['GET', 'HEAD'].includes(method)) || requested.some(value => !requestHeaders.has(value))) return error(403, 'Preflight is not allowed.', origin);
        const result = headers(origin);
        result.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        result.set('Access-Control-Allow-Headers', 'Range, If-None-Match, If-Match, If-Range');
        result.set('Access-Control-Max-Age', '86400'); result.set('Cache-Control', cachePolicy);
        return new Response(null, { status: 204, headers: result });
      }
      const etag = '"' + file.etag + '"';
      if (request.headers.has('If-Match') && !matches(request.headers.get('If-Match'), etag, false)) return error(412, 'File precondition failed.', origin);
      // Release keys are immutable. A matching public release ETag can avoid an
      // R2 read altogether; changed uploads require a new verified release.
      if (matches(request.headers.get('If-None-Match'), etag)) {
        const result = headers(origin); result.set('ETag', etag); result.set('Cache-Control', cachePolicy);
        return new Response(null, { status: 304, headers: result });
      }
      let range;
      const rangeHeader = request.method === 'GET' ? request.headers.get('Range') : null;
      const ifRange = request.headers.get('If-Range');
      if (rangeHeader !== null && (!ifRange || ifRange === etag)) {
        range = rangeFor(rangeHeader, file.bytes);
        if (!range) return error(416, 'Requested range is not available.', origin, { 'Content-Range': 'bytes */' + file.bytes, 'Accept-Ranges': 'bytes' });
      }
      const bucket = env?.ASSETS;
      if (!bucket || typeof bucket[request.method === 'HEAD' ? 'head' : 'get'] !== 'function') return error(503, 'Downloads are temporarily unavailable.', origin);
      let object;
      try {
        // Exactly one R2 operation per incoming request. There is no retry,
        // fallback URL, object listing, write or persistent counter.
        object = request.method === 'HEAD' ? await bucket.head(key)
          : await bucket.get(key, range ? { range } : undefined);
        if (!object) return error(404, 'File is not available.', origin);
        if (object.size !== file.bytes || object.etag !== file.etag
          || (object.storageClass && object.storageClass !== 'Standard')
          || (request.method === 'GET' && !object.body)) {
          await discard(object);
          return error(503, 'Downloads are temporarily unavailable.', origin);
        }
        const result = headers(origin);
        result.set('Content-Type', file.contentType); result.set('ETag', etag);
        result.set('Accept-Ranges', 'bytes'); result.set('Cache-Control', cachePolicy);
        result.set('Content-Length', String(range ? range.length : file.bytes));
        if (range) result.set('Content-Range', `bytes ${range.offset}-${range.offset + range.length - 1}/${file.bytes}`);
        if (object.uploaded instanceof Date && Number.isFinite(object.uploaded.getTime())) result.set('Last-Modified', object.uploaded.toUTCString());
        // Direct streaming keeps 700+ MB games outside the Worker's 128 MB heap.
        return new Response(request.method === 'HEAD' ? null : object.body, { status: range ? 206 : 200, headers: result });
      } catch {
        await discard(object);
        return error(503, 'Downloads are temporarily unavailable.', origin);
      }
    },
  });
}
