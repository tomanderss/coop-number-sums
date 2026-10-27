// Statischer Dateiserver für die E2E-Tests (Playwright `webServer`).
//
// Ersetzt `python3 -m http.server` im Test-Lauf: das CI läuft im offiziellen
// Playwright-Container (Browser + Systempakete vorinstalliert), dort ist Node
// garantiert vorhanden, Python nicht. Keine Abhängigkeiten, nur node:http.
// Für die Entwicklung von Hand bleibt `python3 -m http.server 8099` gleichwertig.
//
// Aufruf: node scripts/serve.mjs [port]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const ROOT = resolve(process.cwd());
const PORT = Number(process.argv[2] || process.env.PORT || 8099);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.mp3': 'audio/mpeg',
  '.wasm': 'application/wasm',
};

createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = normalize(join(ROOT, path));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    let st = await stat(file).catch(() => null);
    if (st && st.isDirectory()) { file = join(file, 'index.html'); st = await stat(file).catch(() => null); }
    if (!st) { res.writeHead(404, { 'content-type': 'text/plain' }).end('not found'); return; }
    const body = await readFile(file);
    res.writeHead(200, {
      'content-type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream',
      'content-length': body.length,
      'cache-control': 'no-cache',
    });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch (e) {
    res.writeHead(500, { 'content-type': 'text/plain' }).end(String(e && e.message));
  }
}).listen(PORT, '127.0.0.1', () => console.log(`serve: http://127.0.0.1:${PORT} (${ROOT})`));
