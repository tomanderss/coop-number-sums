// create-icons.js — erzeugt icons/icon-192.png & icon-512.png ohne Abhängigkeiten
// (reiner PNG-Encoder via Node-zlib). Motiv: ∑ auf blau-violettem Verlauf.
import { deflateSync } from 'zlib';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

// ── CRC32 / PNG-Chunks ────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const body = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0; // 8-bit RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // Filter 0
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ── Zeichnen ──────────────────────────────────────────────────────────────────
function lerp(a, b, t) { return a + (b - a) * t; }
const C1 = [91, 140, 255];   // #5b8cff
const C2 = [168, 85, 247];   // #a855f7

// Σ als Polygon (relative Koordinaten 0..1 in einer Inhaltsbox)
const SIGMA = [
  [0.16, 0.10], [0.84, 0.10], [0.84, 0.27], [0.45, 0.27],
  [0.63, 0.50], [0.45, 0.73], [0.84, 0.73], [0.84, 0.90],
  [0.16, 0.90], [0.42, 0.50],
];
function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

function render(N) {
  const buf = Buffer.alloc(N * N * 4);
  const pad = N * 0.16;          // Inhaltsbox (Safe Zone für maskable)
  const box = N - pad * 2;
  const SS = 3;                  // Supersampling für glatte Kanten
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      // Verlauf (diagonal)
      const t = (x + y) / (2 * N);
      const bg = [lerp(C1[0], C2[0], t), lerp(C1[1], C2[1], t), lerp(C1[2], C2[2], t)];
      // Σ-Abdeckung per Supersampling
      let cov = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const px = (x + (sx + 0.5) / SS - pad) / box;
        const py = (y + (sy + 0.5) / SS - pad) / box;
        if (px >= 0 && px <= 1 && py >= 0 && py <= 1 && pointInPoly(px, py, SIGMA)) cov++;
      }
      const a = cov / (SS * SS);
      const r = Math.round(lerp(bg[0], 255, a));
      const g = Math.round(lerp(bg[1], 255, a));
      const b = Math.round(lerp(bg[2], 255, a));
      const i = (y * N + x) * 4;
      buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = 255;
    }
  }
  return encodePNG(N, N, buf);
}

const dir = join(__dir, 'icons');
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'icon-192.png'), render(192));
writeFileSync(join(dir, 'icon-512.png'), render(512));
console.log('✓ icons/icon-192.png & icon-512.png erstellt');
