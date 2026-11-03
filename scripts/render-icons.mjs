// scripts/render-icons.mjs — erzeugt das App-Icon „Coop Number Games" in allen
// Größen aus EINER SVG-Quelle (iconSvg unten). Ersetzt das frühere
// create-icons.js (Number-Sums-Brettausschnitt aus der Zeit vor den anderen
// Spielen).
//
// Motiv: vier Kacheln in den Spielfarben, je mit dem Zeichen eines Spiels —
// eingekreiste Zahl (Number Sums), Plus (Math Cross), verbundene Punkte
// (Number Path / Number Link), Edelstein (Gem Hunt). Große, ruhige Formen:
// erkennbar auf dem Homescreen UND als Hauch im Hintergrund der Startseite.
// Maskable: alles Wichtige liegt im inneren 80-%-Kreis.
//
// Aufruf: node scripts/render-icons.mjs   (braucht das Playwright-Chromium)
// Ausgabe: icons/icon-{192,512,1024}.png, icons/icon-maskable-512.png, icons/motif.svg (transparent, fürs
// Hintergrundmotiv), assets/logo.png (transparent, Quelle für @capacitor/assets),
// Android-Mipmaps und iOS-AppIcon.

import { chromium } from 'playwright';
import { writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BG = '#141a2c';
const TILES = [
  { x: 0, y: 0, c: '#7b5cf0', g: 'circle' },   // Number Sums
  { x: 1, y: 0, c: '#2f8cf0', g: 'plus' },     // Math Cross
  { x: 0, y: 1, c: '#2fa86b', g: 'link' },     // Number Path / Link
  { x: 1, y: 1, c: '#f08a2c', g: 'gem' },      // Gem Hunt
];

/** Das Icon im 100er-Raster. bg=false → transparent (Motiv/Quelllogo). scale = Größe des Kachelblocks. */
export function iconSvg({ bg = true, scale = 0.74, round = 0 } = {}) {
  const block = 100 * scale, gap = block * 0.07, t = (block - gap) / 2;
  const o = (100 - block) / 2, r = t * 0.24;
  let s = '<defs><linearGradient id="gl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".12"/></linearGradient></defs>';
  if (bg) s += round ? `<circle cx="50" cy="50" r="50" fill="${BG}"/>` : `<rect width="100" height="100" fill="${BG}"/>`;
  for (const k of TILES) {
    const x = o + k.x * (t + gap), y = o + k.y * (t + gap), cx = x + t / 2, cy = y + t / 2, u = t / 10;
    s += `<rect x="${x}" y="${y}" width="${t}" height="${t}" rx="${r}" fill="${k.c}"/>`;
    // Sanfter Glanz von oben — Tiefe ohne Spielerei.
    s += `<rect x="${x}" y="${y}" width="${t}" height="${t}" rx="${r}" fill="url(#gl)"/>`;
    const Wd = (w) => `fill="none" stroke="#fff" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
    const W = Wd(u * 0.95);
    if (k.g === 'circle') {
      s += `<circle cx="${cx}" cy="${cy}" r="${u * 3.1}" ${W}/>`;
      s += `<path d="M${cx - u * 0.9} ${cy - u * 1.1} L${cx + u * 0.2} ${cy - u * 1.9} V${cy + u * 1.9}" ${W}/>`;
    } else if (k.g === 'plus') {
      s += `<path d="M${cx} ${cy - u * 3} V${cy + u * 3} M${cx - u * 3} ${cy} H${cx + u * 3}" ${Wd(u * 1.35)}/>`;
    } else if (k.g === 'link') {
      s += `<path d="M${cx - u * 2.6} ${cy - u * 2.4} V${cy + u * 0.4} H${cx + u * 2.6} V${cy + u * 2.6}" ${W}/>`;
      s += `<circle cx="${cx - u * 2.6}" cy="${cy - u * 2.4}" r="${u * 1.15}" fill="#fff"/><circle cx="${cx + u * 2.6}" cy="${cy + u * 2.6}" r="${u * 1.15}" fill="#fff"/>`;
    } else if (k.g === 'gem') {
      s += `<path d="M${cx} ${cy - u * 3.1} L${cx + u * 3.1} ${cy} L${cx} ${cy + u * 3.1} L${cx - u * 3.1} ${cy}Z" ${W}/>`;
      s += `<path d="M${cx} ${cy - u * 1.3} L${cx + u * 1.3} ${cy} L${cx} ${cy + u * 1.3} L${cx - u * 1.3} ${cy}Z" fill="#fff"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${s}</svg>`;
}

async function main() {
  const b = await chromium.launch(existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
  const page = await b.newPage();
  const png = async (file, size, opts = {}) => {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<html><body style="margin:0;background:transparent">${iconSvg(opts).replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
    await page.screenshot({ path: join(ROOT, file), omitBackground: opts.bg === false || !!opts.round, clip: { x: 0, y: 0, width: size, height: size } });
  };
  // „any": Kacheln groß (Homescreen, iOS schneidet nur die Ecken ab).
  // „maskable": kleiner, alles im inneren 80-%-Kreis (Android schneidet rund).
  for (const n of [192, 512, 1024]) await png(`icons/icon-${n}.png`, n);
  await png('icons/icon-maskable-512.png', 512, { scale: 0.58 });
  await png('assets/logo.png', 1024, { bg: false, scale: 0.8 });
  writeFileSync(join(ROOT, 'icons/motif.svg'), iconSvg({ bg: false, scale: 0.9 }));
  // Android: Alt-Icon (quadratisch), rund, adaptiv (Vorder-/Hintergrund, 108dp).
  const dens = { ldpi: 0.75, mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  const res = 'android/app/src/main/res';
  if (existsSync(join(ROOT, res))) {
    for (const [d, f] of Object.entries(dens)) {
      await png(`${res}/mipmap-${d}/ic_launcher.png`, Math.round(48 * f));
      await png(`${res}/mipmap-${d}/ic_launcher_round.png`, Math.round(48 * f), { round: true, scale: 0.58 });
      // Adaptiv (108dp; ic_launcher.xml legt 16,7 % Rand darum): Vordergrund
      // transparent, Kachelblock sicher innerhalb der Maske.
      await png(`${res}/mipmap-${d}/ic_launcher_foreground.png`, Math.round(108 * f), { bg: false, scale: 0.72 });
      await page.setViewportSize({ width: Math.round(108 * f), height: Math.round(108 * f) });
      await page.setContent(`<body style="margin:0;background:${BG}"></body>`);
      await page.screenshot({ path: join(ROOT, `${res}/mipmap-${d}/ic_launcher_background.png`) });
    }
  }
  // iOS: ein 1024er ohne Alpha.
  const ios = 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png';
  if (existsSync(join(ROOT, ios))) await png(ios, 1024);
  await b.close();
  console.log('✓ App-Icon in allen Größen erzeugt');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
