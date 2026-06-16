// create-icons.js — erzeugt icons/icon-192.png & icon-512.png ohne Abhängigkeiten
// (reiner PNG-Encoder via Node-zlib). Motiv: eine einzelne Cage-Zelle — Verlauf-
// Hintergrund, violette Cage mit Summen-Chip oben links, große eingekreiste Zahl.
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

// ── Farben ────────────────────────────────────────────────────────────────────
function lerp(a, b, t) { return a + (b - a) * t; }
function hslToRgb(h, s, l) {
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r1, g1, b1;
  if (h < 60) [r1, g1, b1] = [c, x, 0];
  else if (h < 120) [r1, g1, b1] = [x, c, 0];
  else if (h < 180) [r1, g1, b1] = [0, c, x];
  else if (h < 240) [r1, g1, b1] = [0, x, c];
  else if (h < 300) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  return [(r1 + m) * 255, (g1 + m) * 255, (b1 + m) * 255];
}
const C1 = [91, 140, 255];   // #5b8cff
const C2 = [168, 85, 247];   // #a855f7
const VIOLET = hslToRgb(263, 72, 62);      // Cage-Farbe (wie REGION_COLORS in config.js)
const VIOLET_DARK = hslToRgb(263, 72, 46); // Summen-Chip-Hintergrund (dunklere Schattierung)
const WHITE = [255, 255, 255];

// ── Sieben-Segment-Ziffern (ohne Schriftart) ───────────────────────────────────
// Box-Koordinaten: Breite 0..1, Höhe 0..1.8. `t` = Segmentdicke (Anteil von 1).
const DIGIT_SEGMENTS = {
  0: ['A', 'B', 'C', 'D', 'E', 'F'],
  1: ['B', 'C'],
  2: ['A', 'B', 'G', 'E', 'D'],
  3: ['A', 'B', 'G', 'C', 'D'],
  4: ['F', 'G', 'B', 'C'],
  5: ['A', 'F', 'G', 'C', 'D'],
  6: ['A', 'F', 'G', 'E', 'C', 'D'],
  7: ['A', 'B', 'C'],
  8: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
  9: ['A', 'B', 'C', 'D', 'F', 'G'],
};
function segmentRect(seg, t) {
  switch (seg) {
    case 'A': return [t, 0, 1 - t, t];
    case 'B': return [1 - t, t, 1, 0.9];
    case 'C': return [1 - t, 0.9, 1, 1.8 - t];
    case 'D': return [t, 1.8 - t, 1 - t, 1.8];
    case 'E': return [0, 0.9, t, 1.8 - t];
    case 'F': return [0, t, t, 0.9];
    case 'G': return [t, 0.9 - t / 2, 1 - t, 0.9 + t / 2];
  }
}
function digitCoverage(digit, lx, ly, t) {
  if (lx < 0 || lx > 1 || ly < 0 || ly > 1.8) return false;
  for (const seg of DIGIT_SEGMENTS[digit]) {
    const [x0, y0, x1, y1] = segmentRect(seg, t);
    if (lx >= x0 && lx <= x1 && ly >= y0 && ly <= y1) return true;
  }
  return false;
}

// ── Geometrie- / Treffertests ──────────────────────────────────────────────────
function inRoundedRect(px, py, x, y, w, h, r) {
  if (px < x || px > x + w || py < y || py > y + h) return false;
  const rx = Math.min(r, w / 2), ry = Math.min(r, h / 2);
  const corner = (cx, cy) => ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 <= 1;
  if (px < x + rx && py < y + ry) return corner(x + rx, y + ry);
  if (px > x + w - rx && py < y + ry) return corner(x + w - rx, y + ry);
  if (px < x + rx && py > y + h - ry) return corner(x + rx, y + h - ry);
  if (px > x + w - rx && py > y + h - ry) return corner(x + w - rx, y + h - ry);
  return true;
}
function inRing(px, py, cx, cy, rOuter, strokeW) {
  const d = Math.hypot(px - cx, py - cy);
  return d <= rOuter && d >= rOuter - strokeW;
}

// ── Zeichnen ──────────────────────────────────────────────────────────────────
function render(N) {
  const buf = Buffer.alloc(N * N * 4);
  const SS = 4; // Supersampling für glatte Kanten

  const cell = { x: 0.16146 * N, y: 0.16146 * N, w: 0.67708 * N, h: 0.67708 * N, r: 0.10417 * N };
  const badge = { x: 0.21354 * N, y: 0.21354 * N, w: 0.20833 * N, h: 0.13542 * N, r: 0.03125 * N };
  const ring = { cx: 0.5 * N, cy: 0.55208 * N, rOuter: 0.17708 * N, strokeW: 0.03646 * N };

  // große Ziffer "7", zentriert im Ring
  const bigH = ring.rOuter * 1.45, bigW = bigH / 1.8;
  const bigX = ring.cx - bigW / 2, bigY = ring.cy - bigH / 2;

  // Summen-Chip "12": zwei Ziffern nebeneinander, zentriert im Badge
  const pad = 0.2;
  const innerH = badge.h * (1 - 2 * pad);
  const digH = innerH, digW = digH / 1.8;
  const gap = digW * 0.22;
  const totalW = digW * 2 + gap;
  const chipX = badge.x + (badge.w - totalW) / 2, chipY = badge.y + (badge.h - digH) / 2;

  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let rs = 0, gs = 0, bs = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const px = x + (sx + 0.5) / SS, py = y + (sy + 0.5) / SS;
        let col;
        const lxBig = (px - bigX) / bigW, lyBig = (py - bigY) / bigH * 1.8;
        const lxC1 = (px - chipX) / digW, lxC2 = (px - (chipX + digW + gap)) / digW, lyC = (py - chipY) / digH * 1.8;
        if (inRing(px, py, ring.cx, ring.cy, ring.rOuter, ring.strokeW) || digitCoverage(7, lxBig, lyBig, 0.22)) {
          col = WHITE;
        } else if (digitCoverage(1, lxC1, lyC, 0.22) || digitCoverage(2, lxC2, lyC, 0.22)) {
          col = WHITE;
        } else if (inRoundedRect(px, py, badge.x, badge.y, badge.w, badge.h, badge.r)) {
          col = VIOLET_DARK;
        } else if (inRoundedRect(px, py, cell.x, cell.y, cell.w, cell.h, cell.r)) {
          col = VIOLET;
        } else {
          const t = (px + py) / (2 * N);
          col = [lerp(C1[0], C2[0], t), lerp(C1[1], C2[1], t), lerp(C1[2], C2[2], t)];
        }
        rs += col[0]; gs += col[1]; bs += col[2];
      }
      const n = SS * SS;
      const i = (y * N + x) * 4;
      buf[i] = Math.round(rs / n); buf[i + 1] = Math.round(gs / n); buf[i + 2] = Math.round(bs / n); buf[i + 3] = 255;
    }
  }
  return encodePNG(N, N, buf);
}

const dir = join(__dir, 'icons');
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'icon-192.png'), render(192));
writeFileSync(join(dir, 'icon-512.png'), render(512));
console.log('✓ icons/icon-192.png & icon-512.png erstellt');
