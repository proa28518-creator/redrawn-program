// harness/server.mjs — the local stand-in for the Creatorize app's server.
// Serves the project root statically (the host page expects /__suite/cartoon.html,
// ../project.json, ../scenes/film.js, ../engine.js, ... all same-origin) and takes the
// export chunks the page POSTs to /__suite/append/<name> (see chost.js exportVideo),
// appending them to harness/out/<name>.h264 (?reset=1 truncates first).
import http from 'node:http';
import { createReadStream, createWriteStream, existsSync, statSync, mkdirSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));       // the project root
export const OUT = join(ROOT, 'harness', 'out');
mkdirSync(OUT, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.glb': 'model/gltf-binary',
  '.bin': 'application/octet-stream', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml',
};

export function startServer(port = 8765) {
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const path = decodeURIComponent(u.pathname);
    if (req.method === 'POST' && path.startsWith('/__suite/append/')) {
      const name = path.slice('/__suite/append/'.length).replace(/[^\w.-]/g, '_') || 'video';
      const file = join(OUT, name + '.h264');
      if (u.searchParams.get('reset')) { /* truncate below via flag */ }
      const ws = createWriteStream(file, { flags: u.searchParams.get('reset') ? 'w' : 'a' });
      req.pipe(ws);
      ws.on('finish', () => { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('ok'); });
      ws.on('error', e => { res.writeHead(500); res.end(String(e)); });
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
    const file = normalize(join(ROOT, path.replace(/^\/+/, '')));
    if (!file.startsWith(ROOT) || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404, { 'cache-control': 'no-store' }); res.end('not found: ' + path); return; }
    res.writeHead(200, { 'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store', 'content-length': statSync(file).size });
    if (req.method === 'HEAD') { res.end(); return; }
    createReadStream(file).pipe(res);
  });
  return new Promise(resolve => server.listen(port, '127.0.0.1', () => resolve(server)));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = +(process.argv[2] || 8765);
  startServer(port).then(() => console.log(`harness server on http://127.0.0.1:${port} (root ${ROOT})`));
}
