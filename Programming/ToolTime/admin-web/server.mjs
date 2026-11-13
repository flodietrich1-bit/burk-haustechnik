import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';

const root = resolve('dist');
const port = Number(process.env.PORT || 8080);
const backendUrl = process.env.BACKEND_API_URL || 'https://tooltime-api-209459117942.europe-west4.run.app';
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

createServer(async (request, response) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname); }
  catch { response.writeHead(400).end(); return; }
  if (pathname === '/api' || pathname.startsWith('/api/')) {
    if (!backendUrl) { response.writeHead(503, { 'Content-Type': 'application/json' }).end('{"code":"API_UNAVAILABLE"}'); return; }
    try {
      const headers = { ...request.headers };
      for (const name of ['host', 'connection', 'transfer-encoding', 'keep-alive', 'upgrade']) delete headers[name];
      const upstream = await fetch(new URL(request.url || '/api', backendUrl), {
        method: request.method,
        headers,
        ...(request.method === 'GET' || request.method === 'HEAD' ? {} : { body: request, duplex: 'half' }),
      });
      const responseHeaders = Object.fromEntries(upstream.headers);
      for (const name of ['content-length', 'content-encoding', 'transfer-encoding', 'connection']) delete responseHeaders[name];
      response.writeHead(upstream.status, responseHeaders);
      if (upstream.body && request.method !== 'HEAD') Readable.fromWeb(upstream.body).pipe(response);
      else response.end();
    } catch {
      if (!response.headersSent) response.writeHead(502, { 'Content-Type': 'application/json' });
      response.end('{"code":"API_UNAVAILABLE"}');
    }
    return;
  }
  const filePath = resolve(join(root, pathname.replace(/^\/+/, '')));
  if (filePath !== root && !filePath.startsWith(root + sep)) { response.writeHead(403).end(); return; }
  let target = filePath;
  try {
    if (!(await stat(target)).isFile()) target = join(root, 'index.html');
  } catch { target = join(root, 'index.html'); }
  try {
    const contents = await readFile(target);
    response.writeHead(200, {
      'Content-Type': mimeTypes[extname(target)] || 'application/octet-stream',
      'Cache-Control': target.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable',
    });
    response.end(request.method === 'HEAD' ? undefined : contents);
  } catch { response.writeHead(404).end(); }
}).listen(port, '0.0.0.0');
