// create-icons.js — erzeugt icons/icon-192.png & icon-512.png ohne Abhängigkeiten
// (reiner PNG-Encoder via Node-zlib). Motiv: ein nachgestellter Mini-Ausschnitt
// der oberen linken Spielfeld-Ecke — Eck-Header, zwei Spalten- und Zeilensummen,
// ein 2x2-Block echter Puzzle-Zellen mit Cage-Farben, Summen-Badge und einer
// eingekreisten "kept"-Zahl (wie im echten Spiel).
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

// ── Farben (wie im echten App-Theme / REGION_COLORS) ───────────────────────────
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
const WHITE = [255, 255, 255];
const BG = [11, 16, 32];          // --bg
const HDR_BG = [26, 33, 56];      // --bg2-artige Header-/Eckzelle
const TEXT2 = [154, 166, 194];    // --text2 (gedämpfte Spaltensumme)
const VIOLET = hslToRgb(263, 72, 62);       // REGION_COLORS.violet
const VIOLET_DARK = hslToRgb(263, 72, 46);  // Summen-Badge (dunklere Schattierung)
const TEAL = hslToRgb(174, 70, 44);         // REGION_COLORS.teal
const TEAL_DARK = hslToRgb(174, 70, 30);

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
function inRoundedRectLocal(lx, ly, x, y, w, h, r) {
  if (lx < x || lx > x + w || ly < y || ly > y + h) return false;
  const rx = Math.min(r, w / 2), ry = Math.min(r, h / 2);
  const corner = (cx, cy) => ((lx - cx) / rx) ** 2 + ((ly - cy) / ry) ** 2 <= 1;
  if (lx < x + rx && ly < y + ry) return corner(x + rx, y + ry);
  if (lx > x + w - rx && ly < y + ry) return corner(x + w - rx, y + ry);
  if (lx < x + rx && ly > y + h - ry) return corner(x + rx, y + h - ry);
  if (lx > x + w - rx && ly > y + h - ry) return corner(x + w - rx, y + h - ry);
  return true;
}
// Segmente bekommen abgerundete Ecken (Pillenform) statt scharfer Rechtecke,
// damit die Ziffern nicht wie ein blockiger Digitalanzeigen-Font wirken.
function digitCoverage(digit, lx, ly, t) {
  if (lx < -0.1 || lx > 1.1 || ly < -0.1 || ly > 1.9) return false;
  const segR = t * 0.85;
  for (const seg of DIGIT_SEGMENTS[digit]) {
    const [x0, y0, x1, y1] = segmentRect(seg, t);
    if (inRoundedRectLocal(lx, ly, x0, y0, x1 - x0, y1 - y0, segR)) return true;
  }
  return false;
}
// Zentriert eine Ziffer in einer Box (boxW/boxH), `scale` = Ziffernbreite relativ
// zur Boxbreite (Ziffernhöhe ergibt sich aus dem festen 1:1.8-Seitenverhältnis).
function digitCentered(px, py, boxX, boxY, boxW, boxH, digit, scale, t = 0.24) {
  const dw = scale * boxW, dh = dw * 1.8;
  const dx = boxX + (boxW - dw) / 2, dy = boxY + (boxH - dh) / 2;
  const lx = (px - dx) / dw, ly = (py - dy) / dh * 1.8;
  return digitCoverage(digit, lx, ly, t);
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
// Silhouette der äußeren Karte — bestimmt bei der transparenten Variante (für
// das Capacitor-Assets-Logo), welche Pixel außerhalb des Icons liegen.
function isInsideCard(px, py, N) {
  return inRoundedRect(px, py, 0.06 * N, 0.06 * N, 0.88 * N, 0.88 * N, 0.16 * N);
}

// ── Zeichnen ──────────────────────────────────────────────────────────────────
function pixelColor(px, py, N) {
  const x0 = 0.06 * N, y0 = 0.06 * N, W = 0.88 * N, H = 0.88 * N, R = 0.16 * N;
  if (!inRoundedRect(px, py, x0, y0, W, H, R)) return BG;
  const gap = 0.02 * N;
  const hdr = 0.27 * W;
  const cellsW = W - hdr, cellW = (cellsW - gap) / 2;
  const colX0 = x0 + hdr + gap, colX1 = colX0 + cellW + gap;
  const rowY0 = y0 + hdr + gap, rowY1 = rowY0 + cellW + gap;
  const cellR = cellW * 0.16; // weich abgerundete Zellenecken statt scharfer Kanten

  // Eck-Header
  if (inRoundedRect(px, py, x0, y0, hdr, hdr, cellR)) return HDR_BG;
  // Spaltensummen (oben)
  if (py >= y0 && py < y0 + hdr) {
    if (px >= colX0 && px < colX0 + cellW) return inRoundedRect(px, py, colX0, y0, cellW, hdr, cellR) ? (digitCentered(px, py, colX0, y0, cellW, hdr, 6, 0.42) ? TEXT2 : HDR_BG) : BG;
    if (px >= colX1 && px < colX1 + cellW) return inRoundedRect(px, py, colX1, y0, cellW, hdr, cellR) ? (digitCentered(px, py, colX1, y0, cellW, hdr, 4, 0.42) ? TEXT2 : HDR_BG) : BG;
  }
  // Zeilensummen (links)
  if (px >= x0 && px < x0 + hdr) {
    if (py >= rowY0 && py < rowY0 + cellW) return inRoundedRect(px, py, x0, rowY0, hdr, cellW, cellR) ? (digitCentered(px, py, x0, rowY0, hdr, cellW, 9, 0.46) ? WHITE : HDR_BG) : BG;
    if (py >= rowY1 && py < rowY1 + cellW) return inRoundedRect(px, py, x0, rowY1, hdr, cellW, cellR) ? (digitCentered(px, py, x0, rowY1, hdr, cellW, 5, 0.46) ? WHITE : HDR_BG) : BG;
  }
  // 2x2-Block echter Puzzle-Zellen
  const cells = [
    { x: colX0, y: rowY0, col: VIOLET, dark: VIOLET_DARK, digit: 7, badge: 3, ring: true },
    { x: colX1, y: rowY0, col: TEAL,   dark: TEAL_DARK,   digit: 4, badge: null, ring: false },
    { x: colX0, y: rowY1, col: TEAL,   dark: TEAL_DARK,   digit: 8, badge: null, ring: false },
    { x: colX1, y: rowY1, col: VIOLET, dark: VIOLET_DARK, digit: 5, badge: null, ring: false },
  ];
  for (const c of cells) {
    if (px >= c.x && px < c.x + cellW && py >= c.y && py < c.y + cellW) {
      if (!inRoundedRect(px, py, c.x, c.y, cellW, cellW, cellR)) return BG;
      if (c.badge != null) {
        const bx = c.x + cellW * 0.1, by = c.y + cellW * 0.1, bw = cellW * 0.46, bh = cellW * 0.3, br = bh * 0.42;
        if (inRoundedRect(px, py, bx, by, bw, bh, br)) {
          return digitCentered(px, py, bx, by, bw, bh, c.badge, 0.32) ? WHITE : c.dark;
        }
      }
      if (c.ring) {
        const rcx = c.x + cellW * 0.56, rcy = c.y + cellW * 0.62, rOuter = cellW * 0.27, sw = cellW * 0.08;
        if (digitCentered(px, py, rcx - rOuter * 0.62, rcy - rOuter * 0.62, rOuter * 1.24, rOuter * 1.24, c.digit, 0.7)) return WHITE;
        if (inRing(px, py, rcx, rcy, rOuter, sw)) return WHITE;
        return c.col;
      }
      return digitCentered(px, py, c.x, c.y, cellW, cellW, c.digit, 0.5) ? WHITE : c.col;
    }
  }
  return BG;
}

// `transparent`: macht alles außerhalb der äußeren Karten-Silhouette
// durchsichtig statt BG-farben — für das Capacitor-Assets-Quelllogo, das auf
// eine separate Hintergrundfarbe gelegt wird (Easy Mode, Android Adaptive Icon).
function render(N, { transparent = false } = {}) {
  const buf = Buffer.alloc(N * N * 4);
  const SS = 6; // Supersampling für glatte Kanten
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let rs = 0, gs = 0, bs = 0, inside = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const px = x + (sx + 0.5) / SS, py = y + (sy + 0.5) / SS;
        if (transparent && !isInsideCard(px, py, N)) continue;
        const col = pixelColor(px, py, N);
        rs += col[0]; gs += col[1]; bs += col[2]; inside++;
      }
      const n = SS * SS;
      const i = (y * N + x) * 4;
      if (inside === 0) {
        buf[i] = BG[0]; buf[i + 1] = BG[1]; buf[i + 2] = BG[2]; buf[i + 3] = 0;
      } else {
        buf[i] = Math.round(rs / inside); buf[i + 1] = Math.round(gs / inside); buf[i + 2] = Math.round(bs / inside);
        buf[i + 3] = transparent ? Math.round((inside / n) * 255) : 255;
      }
    }
  }
  return encodePNG(N, N, buf);
}

const dir = join(__dir, 'icons');
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'icon-192.png'), render(192));
writeFileSync(join(dir, 'icon-512.png'), render(512));
// 1024px voll-deckendes Master-Icon für die App-Store-Einreichung (Apple
// verlangt randlos, ohne Alpha, ohne vorgerundete Ecken).
writeFileSync(join(dir, 'icon-1024.png'), render(1024));

// Transparentes Quelllogo für `@capacitor/assets` (Easy Mode) — wird beim
// Android-Adaptive-Icon/Splash-Generieren auf eine eigene Hintergrundfarbe gelegt.
const assetsDir = join(__dir, 'assets');
mkdirSync(assetsDir, { recursive: true });
writeFileSync(join(assetsDir, 'logo.png'), render(1024, { transparent: true }));

console.log('✓ icons/icon-192.png, icon-512.png, icon-1024.png & assets/logo.png erstellt');
