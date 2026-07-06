// badgeart.js — Selbst gezeichnete Abzeichen-Medaillen als SVG (Emoji-Ersatz).
//
// Ziel: eigene Bildsprache statt System-Emojis. Jedes Abzeichen ist ein
// geprägtes RUNDES Medaillon (optional am Halsband), dessen Fassung sich vom
// Rang ableitet — Bronze → Silber → Gold → Legendär (Obsidian + Smaragd):
//   Tier 1 Bronze:  schlichte Fassung
//   Tier 2 Silber:  + Perlrand
//   Tier 3 Gold:    + Lorbeerkranz + Zinne
//   Tier 4 Legendär: Obsidian-Fassung, irisierende Kante, Platin-Zier,
//                    Strahlenkranz, gesetzte Smaragde + Funkeln
// Reine String-Erzeugung (kein DOM), damit unit-testbar. Die gemeinsamen
// Verläufe/Symbole liegen EINMAL im Dokument (badgeDefsMarkup), jede Medaille
// referenziert sie per id → günstig, auch bei vielen Abzeichen auf einem Screen.
//
// Motive sind bewusst symmetrisch um die Mittelachse und weich gerundet
// (stroke-linejoin:round) — geprägt, nicht krakelig.

// Die Stufe (tier 1..4) wird jetzt EXPLIZIT übergeben (Prestige-System) — jedes
// Symbol gibt es in allen vier Stufen. Kein Shop-Katalog-Lookup mehr nötig.

// Zentrierte Motiv-Silhouetten (Ursprung 0,0, Radius ~15). Ohne fill/stroke —
// die bekommt die Fassung (Verlauf + Kontur) vom Assembler. Zusätzliche, fest
// gefärbte Details (Facetten, Augen) tragen ihre eigene Farbe.
const MOTIFS = {
  stern: '<path d="M0 -15 L3.65 -5.02 L14.27 -4.64 L5.9 1.92 L8.82 12.14 L0 6.2 L-8.82 12.14 L-5.9 1.92 L-14.27 -4.64 L-3.65 -5.02 Z"/>',
  blitz: '<path d="M4.5 -15 L-8 3.5 L-0.5 3.5 L-4.5 15 L8 -3.5 L0.5 -3.5 Z"/>',
  flamme: '<path d="M0 -15 C10 -4 9 8 0 15 C-9 8 -10 -4 0 -15 Z"/><path d="M0 -2 C5 3 4.5 9.5 0 13.5 C-4.5 9.5 -5 3 0 -2 Z" fill="#ffffff" fill-opacity=".45" stroke="none"/>',
  rakete: '<path d="M0 -15 C6 -9 7 3 4 11 L-4 11 C-7 3 -6 -9 0 -15 Z"/><path d="M-4 7 L-9.5 15.5 L-4 12 Z M4 7 L9.5 15.5 L4 12 Z"/><path d="M-2.6 11 L0 18 L2.6 11 Z"/><circle cx="0" cy="-5" r="2.6" fill="#00000055" stroke="none"/>',
  diamant: '<path d="M-9 -9 H9 L16 0 L0 20 L-16 0 Z"/><g fill="none" stroke="#00000055" stroke-width="0.9" stroke-linejoin="round" stroke-linecap="round"><path d="M-16 0 H16 M-9 -9 L-5 0 M9 -9 L5 0 M-5 0 L0 20 M5 0 L0 20"/></g>',
  krone: '<path d="M-16 12 L-12.5 -8 L-6.5 3 L0 -11 L6.5 3 L12.5 -8 L16 12 Z"/><rect x="-16" y="11.5" width="32" height="4.5" rx="1.6"/><g fill="#00000044" stroke="none"><circle cx="-12.5" cy="-8" r="1.8"/><circle cx="0" cy="-11" r="2.1"/><circle cx="12.5" cy="-8" r="1.8"/></g>',
  // vierblättriges Kleeblatt: vier Herzblätter mit der Spitze ZUM Zentrum
  // (rundere Lappen nach außen) + geschwungener Stiel.
  klee: '<g><path d="M0 -4.5 C-5 -8 -9.5 -11.5 -6.6 -15.6 C-4.6 -18.3 -1 -16 0 -13 C1 -16 4.6 -18.3 6.6 -15.6 C9.5 -11.5 5 -8 0 -4.5 Z" transform="rotate(0)"/><path d="M0 -4.5 C-5 -8 -9.5 -11.5 -6.6 -15.6 C-4.6 -18.3 -1 -16 0 -13 C1 -16 4.6 -18.3 6.6 -15.6 C9.5 -11.5 5 -8 0 -4.5 Z" transform="rotate(90)"/><path d="M0 -4.5 C-5 -8 -9.5 -11.5 -6.6 -15.6 C-4.6 -18.3 -1 -16 0 -13 C1 -16 4.6 -18.3 6.6 -15.6 C9.5 -11.5 5 -8 0 -4.5 Z" transform="rotate(180)"/><path d="M0 -4.5 C-5 -8 -9.5 -11.5 -6.6 -15.6 C-4.6 -18.3 -1 -16 0 -13 C1 -16 4.6 -18.3 6.6 -15.6 C9.5 -11.5 5 -8 0 -4.5 Z" transform="rotate(270)"/></g><path d="M2 3 C6 8 6.5 14 4 18.5" fill="none" stroke="#00000055" stroke-width="1.7" stroke-linecap="round"/>',
  // Pokal
  trophae: '<path d="M-11 -15 H11 V-9 C11 -1 6 4 2 5 V10 H5 V13 H-5 V10 H-2 V5 C-6 4 -11 -1 -11 -9 Z"/><path d="M-7 14 H7 V18 H-7 Z"/><path d="M-11 -13 C-18 -13 -18 -3 -11 -4" fill="none" stroke-width="2.4"/><path d="M11 -13 C18 -13 18 -3 11 -4" fill="none" stroke-width="2.4"/>',
  // Einhorn-Horn (Spiralkegel) — symmetrisch, klar lesbar
  einhorn: '<path d="M0 -18 L4.5 8 L-4.5 8 Z"/><g fill="none" stroke="#00000055" stroke-width="1.2" stroke-linecap="round"><path d="M-3.4 2 L3.4 -1"/><path d="M-2.7 -5 L2.9 -8"/><path d="M-1.9 -11 L2.2 -13.5"/></g>',
  // Gehirn (zwei Lappen, Mittelfurche)
  gehirn: '<path d="M0 -13 C-6 -16 -13 -12 -13 -5 C-16 -2 -14 5 -8 6 C-6 11 2 11 4 6 C10 11 17 4 13 -1 C16 -6 11 -14 4 -12 C3 -14 -1 -14 0 -13 Z"/><g fill="none" stroke="#00000055" stroke-width="1" stroke-linecap="round"><path d="M0 -12 V8 M-6 -6 C-3 -4 -3 0 -6 2 M6 -6 C3 -4 3 0 6 2"/></g>',
  // Alien-Kopf mit Mandelaugen
  alien: '<path d="M0 -15 C10 -15 12.5 -3 8 7 C5 13.5 -5 13.5 -8 7 C-12.5 -3 -10 -15 0 -15 Z"/><g fill="#00000077" stroke="none"><path d="M-3 -3 C-7 -1 -8 4 -5.5 6 C-3 4 -2.5 -1 -3 -3 Z"/><path d="M3 -3 C7 -1 8 4 5.5 6 C3 4 2.5 -1 3 -3 Z"/></g>',
  // Drachenkopf, frontal & symmetrisch: geschwungene Hörner, Brauenkamm,
  // spitze Schnauze, Nüstern, Schlitzaugen — geprägt gerundet.
  drache: '<path d="M0 16 C-3.5 14 -5 10.5 -4.3 7 L-7.5 6.5 L-5.5 2.5 C-8.5 1 -9.5 -3 -8 -6 L-13 -9.5 C-15 -14 -11.5 -17 -8 -15 C-9 -12 -8 -9.5 -5.5 -8.5 L-3 -12 C-1.5 -13.5 1.5 -13.5 3 -12 L5.5 -8.5 C8 -9.5 9 -12 8 -15 C11.5 -17 15 -14 13 -9.5 L8 -6 C9.5 -3 8.5 1 5.5 2.5 L7.5 6.5 L4.3 7 C5 10.5 3.5 14 0 16 Z"/><g fill="#00000088" stroke="none"><path d="M-6 -4 L-2.5 -2.5 L-4.5 -0.5 Z"/><path d="M6 -4 L2.5 -2.5 L4.5 -0.5 Z"/></g><g fill="#00000055" stroke="none"><circle cx="-1.6" cy="7" r="0.9"/><circle cx="1.6" cy="7" r="0.9"/></g>',
};

// Fassungen je Rang. Verweisen auf die Verläufe in badgeDefsMarkup().
const TIERS = {
  1: { key: 'bronze', rim: 'bm-rim-bronze', disc: 'bm-disc-bronze', field: 'bm-field-bronze', mot: 'bm-mot-bronze',
       reed: '#5c3717', discHi: '#ffffff', discHiOp: '.4', fieldStroke: '#5c3717', motStroke: '#8a5228',
       bead: false, laurel: false, finial: false, legendary: false },
  2: { key: 'silber', rim: 'bm-rim-silver', disc: 'bm-disc-silver', field: 'bm-field-silver', mot: 'bm-mot-silver',
       reed: '#5a636e', discHi: '#ffffff', discHiOp: '.55', fieldStroke: '#5a636e', motStroke: '#8a94a2',
       bead: '#f7fafe', laurel: false, finial: false, legendary: false },
  3: { key: 'gold', rim: 'bm-rim-gold', disc: 'bm-disc-gold', field: 'bm-field-gold', mot: 'bm-mot-gold',
       reed: '#6e4e0c', discHi: '#fff6d8', discHiOp: '.6', fieldStroke: '#6e4e0c', motStroke: '#8a6410',
       bead: '#fff2c4', laurel: '#a9800f', finial: 'bm-rim-gold', legendary: false },
  4: { key: 'legend', rim: 'bm-rim-obs', disc: 'bm-disc-obs', field: 'bm-field-em', mot: 'bm-mot-em',
       reed: '#565a72', fieldStroke: '#062e1d', motStroke: '#0b5a38',
       bead: '#e9edff', laurel: '#cdd4e6', finial: false, legendary: true, gem: '#5ff0ab', haloOp: '.4' },
};

// Alle Verläufe/Symbole EINMAL ins Dokument. app.js fügt das versteckt ein.
export function badgeDefsMarkup() {
  return '<svg width="0" height="0" style="position:absolute" aria-hidden="true" class="badge-defs"><defs>' +
    '<filter id="bm-emb" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="1.1" stdDeviation="0.9" flood-color="#000" flood-opacity="0.42"/></filter>' +
    '<radialGradient id="bm-spec" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset="70%" stop-color="#fff" stop-opacity="0"/></radialGradient>' +
    // bronze
    '<radialGradient id="bm-disc-bronze" cx="38%" cy="30%" r="78%"><stop offset="0" stop-color="#f6c99e"/><stop offset="52%" stop-color="#cf8c56"/><stop offset="100%" stop-color="#8a5228"/></radialGradient>' +
    '<radialGradient id="bm-field-bronze" cx="50%" cy="42%" r="62%"><stop offset="0" stop-color="#c47e48"/><stop offset="100%" stop-color="#b26e3a"/></radialGradient>' +
    '<linearGradient id="bm-mot-bronze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffdcb4"/><stop offset="1" stop-color="#a5602f"/></linearGradient>' +
    '<linearGradient id="bm-rim-bronze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0c49a"/><stop offset="1" stop-color="#6e4320"/></linearGradient>' +
    // silber
    '<radialGradient id="bm-disc-silver" cx="38%" cy="30%" r="78%"><stop offset="0" stop-color="#fbfdff"/><stop offset="52%" stop-color="#c3ccd6"/><stop offset="100%" stop-color="#7d8794"/></radialGradient>' +
    '<radialGradient id="bm-field-silver" cx="50%" cy="42%" r="62%"><stop offset="0" stop-color="#b9c2cd"/><stop offset="100%" stop-color="#a7b1bd"/></radialGradient>' +
    '<linearGradient id="bm-mot-silver" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#a3adb9"/></linearGradient>' +
    '<linearGradient id="bm-rim-silver" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2f5f8"/><stop offset="1" stop-color="#6e7784"/></linearGradient>' +
    // gold
    '<radialGradient id="bm-disc-gold" cx="38%" cy="30%" r="78%"><stop offset="0" stop-color="#ffe9a6"/><stop offset="52%" stop-color="#e6b93f"/><stop offset="100%" stop-color="#9a6c12"/></radialGradient>' +
    '<radialGradient id="bm-field-gold" cx="50%" cy="42%" r="62%"><stop offset="0" stop-color="#d8a52f"/><stop offset="100%" stop-color="#c8901f"/></radialGradient>' +
    '<linearGradient id="bm-mot-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2c4"/><stop offset="1" stop-color="#c98f1e"/></linearGradient>' +
    '<linearGradient id="bm-rim-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe9a6"/><stop offset="1" stop-color="#8a6410"/></linearGradient>' +
    // legendär: obsidian + smaragd + irisierende kante
    '<linearGradient id="bm-rim-obs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#40435a"/><stop offset="1" stop-color="#0a0b11"/></linearGradient>' +
    '<radialGradient id="bm-disc-obs" cx="38%" cy="28%" r="82%"><stop offset="0" stop-color="#2e3244"/><stop offset="58%" stop-color="#171926"/><stop offset="100%" stop-color="#0a0b11"/></radialGradient>' +
    '<linearGradient id="bm-irid" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6ff0ff"/><stop offset="0.5" stop-color="#b98cff"/><stop offset="1" stop-color="#ff8fd0"/></linearGradient>' +
    '<radialGradient id="bm-field-em" cx="46%" cy="38%" r="66%"><stop offset="0" stop-color="#5ff0ab"/><stop offset="55%" stop-color="#1f9e63"/><stop offset="100%" stop-color="#0a4d30"/></radialGradient>' +
    '<linearGradient id="bm-mot-em" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d6ffe9"/><stop offset="1" stop-color="#158a54"/></linearGradient>' +
    // Master „Großmeister": irisierender Prisma-Rand + Obsidian-Scheibe + Gold-Feld
    '<linearGradient id="bmm-irid" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe89a"/><stop offset="0.3" stop-color="#5ff0ab"/><stop offset="0.55" stop-color="#6ff0ff"/><stop offset="0.78" stop-color="#b98cff"/><stop offset="1" stop-color="#ff8fd0"/></linearGradient>' +
    '<radialGradient id="bmm-disc" cx="42%" cy="30%" r="80%"><stop offset="0" stop-color="#2a2e44"/><stop offset="55%" stop-color="#12141f"/><stop offset="100%" stop-color="#06070c"/></radialGradient>' +
    '<radialGradient id="bmm-field" cx="46%" cy="36%" r="70%"><stop offset="0" stop-color="#fff3c8"/><stop offset="45%" stop-color="#ffd76a"/><stop offset="100%" stop-color="#8a5a12"/></radialGradient>' +
    // symbole
    '<symbol id="bm-halo" viewBox="-80 -80 160 160"><g>' +
      [0,30,60,90,120,150,180,210,240,270,300,330].map(a => `<path d="M0 -76 L4.6 -52 L-4.6 -52 Z" transform="rotate(${a})"/>`).join('') +
    '</g></symbol>' +
    '<symbol id="bm-laurel" viewBox="-56 -56 112 112"><g><ellipse cx="16" cy="40" rx="6" ry="2.7" transform="rotate(58 16 40)"/><ellipse cx="30" cy="32" rx="6.2" ry="2.7" transform="rotate(44 30 32)"/><ellipse cx="40" cy="20" rx="6" ry="2.6" transform="rotate(28 40 20)"/><ellipse cx="45" cy="6" rx="5.6" ry="2.5" transform="rotate(12 45 6)"/><ellipse cx="45" cy="-9" rx="5.2" ry="2.4" transform="rotate(-6 45 -9)"/><ellipse cx="41" cy="-23" rx="4.8" ry="2.2" transform="rotate(-24 41 -23)"/></g></symbol>' +
    '<symbol id="bm-spark" viewBox="-8 -8 16 16"><path d="M0 -7 L1.3 -1.3 L7 0 L1.3 1.3 L0 7 L-1.3 1.3 L-7 0 L-1.3 -1.3 Z"/></symbol>' +
    '</defs></svg>';
}

// Erzeugt die Medaille eines Abzeichens. `id` = Symbol (z.B. 'drache'), die
// Stufe kommt aus opts.tier (1..4, Prestige-System; Default 1). ribbon=true
// hängt sie ans Halsband. Gibt '' für unbekannte Symbole zurück (Fremd-IDs).
export function badgeMedalMarkup(id, opts = {}) {
  if (!MOTIFS[id]) return '';
  const tier = Math.max(1, Math.min(4, Math.floor(opts.tier || 1)));
  const t = TIERS[tier] || TIERS[1];
  const size = opts.size || 64;
  const ribbon = !!opts.ribbon;
  // Medaillen-Zentrum + Rahmen-Radien im Koordinatenraum (72er Feld).
  const cy = ribbon ? 44 : 36;
  const vb = ribbon ? '0 0 72 96' : '0 0 72 72';
  const rimR = t.legendary ? 34.5 : 33;
  let s = `<svg class="bm bm-${t.key}${ribbon ? ' bm-ribbon' : ''}" viewBox="${vb}" width="${size}" height="${ribbon ? Math.round(size * 96 / 72) : size}" role="img" aria-label="${id}">`;

  // Halsband (V von oben) zuerst — Medaille liegt darüber.
  if (ribbon) {
    s += '<path d="M18 4 L25 4 L38 52 L32 55 Z" fill="#c8414f"/>' +
         '<path d="M54 4 L47 4 L34 52 L40 55 Z" fill="#a82c39"/>' +
         '<path d="M18 4 L21.5 4 L34.5 52 L32.5 53 Z" fill="#ffffff" opacity=".12"/>' +
         `<circle cx="36" cy="${cy - 24}" r="3.4" fill="url(#${t.rim})" stroke="${t.reed}" stroke-width="1"/><circle cx="36" cy="${cy - 24}" r="1.5" fill="var(--card,#111)"/>`;
  }

  const g0 = `<g transform="translate(36 ${cy})">`;
  s += g0;

  // Strahlenkranz (nur legendär), hinter dem Rahmen.
  if (t.legendary) s += `<use href="#bm-halo" x="-42" y="-42" width="84" height="84" fill="${t.gem}" opacity="${t.haloOp}"/>`;

  // Rahmen
  s += `<circle r="${rimR}" fill="url(#${t.rim})"/>`;
  if (t.legendary) {
    s += `<circle r="${rimR - 1}" fill="none" stroke="url(#bm-irid)" stroke-width="1.1" opacity=".9"/>`;
    s += `<circle r="${rimR - 1}" fill="none" stroke="${t.reed}" stroke-width="1.5" stroke-dasharray="1.6 2.4" opacity=".6"/>`;
  } else {
    s += `<circle r="${rimR - 1}" fill="none" stroke="${t.reed}" stroke-width="1.5" stroke-dasharray="1.6 2.4" opacity=".55"/>`;
  }
  s += `<circle r="30" fill="url(#${t.disc})"/>`;
  s += t.legendary
    ? '<circle r="30" fill="none" stroke="url(#bm-irid)" stroke-opacity=".55" stroke-width="1"/>'
    : `<circle r="30" fill="none" stroke="${t.discHi}" stroke-opacity="${t.discHiOp}" stroke-width="1"/>`;
  // Perlrand (ab Silber)
  if (t.bead) s += `<circle r="26.5" fill="none" stroke="${t.bead}" stroke-width="2.1" stroke-linecap="round" stroke-dasharray="0.1 7.4"/>`;
  // Feld
  s += `<circle r="22" fill="url(#${t.field})"/><circle r="22" fill="none" stroke="${t.fieldStroke}" stroke-opacity=".45" stroke-width="1.4"/>`;
  // Facetten-Sternchen im Feld (legendär)
  if (t.legendary) s += '<g stroke="#ffffff" stroke-opacity=".3" stroke-width=".7" fill="none"><path d="M0 0 L0 -22 M0 0 L19 -11 M0 0 L19 11 M0 0 L0 22 M0 0 L-19 11 M0 0 L-19 -11"/><path d="M0 -11 L9.5 -5.5 L9.5 5.5 L0 11 L-9.5 5.5 L-9.5 -5.5 Z"/></g>';
  // Lorbeer (ab Gold)
  if (t.laurel) {
    s += `<use href="#bm-laurel" x="-35" y="-35" width="70" height="70" fill="${t.laurel}"${t.legendary ? '' : ' opacity=".9"'}/>`;
    s += `<use href="#bm-laurel" x="-35" y="-35" width="70" height="70" fill="${t.laurel}"${t.legendary ? '' : ' opacity=".9"'} transform="scale(-1 1)"/>`;
  }
  // Zinne (Gold) bzw. gesetzte Gems (legendär)
  if (t.finial) s += `<g transform="translate(0 -33)"><path d="M0 -6 L1.6 -1.6 L6 -1.4 L2.4 1.4 L3.6 6 L0 3 L-3.6 6 L-2.4 1.4 L-6 -1.4 L-1.6 -1.6 Z" fill="url(#${t.finial})" stroke="${t.motStroke}" stroke-width="0.8"/></g>`;
  if (t.legendary) {
    s += `<g stroke="#e9edff" stroke-width="1"><circle cx="0" cy="-${rimR - 0.5}" r="3.1" fill="${t.gem}"/><circle cx="${rimR - 0.5}" cy="0" r="2.7" fill="${t.gem}"/><circle cx="0" cy="${rimR - 0.5}" r="2.7" fill="${t.gem}"/><circle cx="-${rimR - 0.5}" cy="0" r="2.7" fill="${t.gem}"/></g>`;
  }
  // Glanzlicht
  s += `<ellipse cx="0" cy="-10" rx="19" ry="9.5" fill="url(#bm-spec)" opacity="${t.legendary ? '.5' : '.48'}"/>`;
  // Motiv (geprägt)
  const mscale = t.legendary ? 1.02 : 1.08;
  s += `<g transform="scale(${mscale})" filter="url(#bm-emb)" fill="url(#${t.mot})" stroke="${t.motStroke}" stroke-width="1" stroke-linejoin="round" stroke-linecap="round">${MOTIFS[id]}</g>`;
  // Funkeln (legendär)
  if (t.legendary) s += '<use href="#bm-spark" x="-8" y="-8" width="16" height="16" fill="#fff" transform="translate(13 -14) scale(.55)"/><use href="#bm-spark" x="-8" y="-8" width="16" height="16" fill="#eafff4" transform="translate(-15 4) scale(.38)"/>';

  s += '</g></svg>';
  return s;
}

// Ist die ID ein zeichenbares eigenes Abzeichen? (für Templates)
export function hasBadgeMedal(id) { return !!(id && MOTIFS[id]); }

// Master-Badge „Großmeister": Prisma-Medaillon mit ZWÖLFSTERN (12 Zacken = die 12
// gemeisterten Prestige-Kategorien), Obsidian-Scheibe, Gold-Feld, 12 Rand-Gems
// und Strahlenkranz. Reine String-Erzeugung. Die Klasse `bmm-halo` am Strahlen-
// kranz erlaubt der CSS eine (nur in Home/Prestige aktive) Rotation. size = px.
export function masterMedalMarkup(opts = {}) {
  const size = opts.size || 64;
  const cx = 36, cy = 36;
  const star = (pts, ro, ri) => {
    let d = ''; const step = Math.PI / pts;
    for (let i = 0; i < pts * 2; i++) {
      const r = i % 2 ? ri : ro; const a = -Math.PI / 2 + i * step;
      d += (i ? 'L' : 'M') + (cx + Math.cos(a) * r).toFixed(1) + ' ' + (cy + Math.sin(a) * r).toFixed(1);
    }
    return d + 'Z';
  };
  const rays = Array.from({ length: 24 }, (_, i) => `<path d="M36 36 L34.7 2 L37.3 2 Z" transform="rotate(${i * 15} 36 36)"/>`).join('');
  const gemCols = ['#ffe89a', '#5ff0ab', '#6ff0ff', '#b98cff', '#ff8fd0', '#8ef0ff', '#ffd76a', '#c6ff9a', '#ff9a6a', '#9aa8ff', '#ff6ab0', '#6affc6'];
  const gems = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    return `<circle cx="${(36 + Math.cos(a) * 26.5).toFixed(1)}" cy="${(36 + Math.sin(a) * 26.5).toFixed(1)}" r="1.7" fill="${gemCols[i]}" stroke="#0a0b11" stroke-width=".5"/>`;
  }).join('');
  return `<svg class="bmm" viewBox="0 0 72 72" width="${size}" height="${size}" role="img" aria-label="Großmeister">`
    + `<g class="bmm-halo" fill="url(#bmm-irid)" opacity=".5">${rays}</g>`
    + `<circle cx="36" cy="36" r="34" fill="url(#bmm-irid)"/>`
    + `<circle cx="36" cy="36" r="34" fill="none" stroke="#06070c" stroke-width=".8" stroke-dasharray="1 1.7" opacity=".5"/>`
    + `<circle cx="36" cy="36" r="30" fill="url(#bmm-disc)"/>`
    + `<circle cx="36" cy="36" r="30" fill="none" stroke="url(#bmm-irid)" stroke-opacity=".55" stroke-width=".8"/>`
    + gems
    + `<circle cx="36" cy="36" r="22" fill="url(#bmm-field)"/>`
    + `<circle cx="36" cy="36" r="22" fill="none" stroke="#6e4a10" stroke-opacity=".5" stroke-width=".9"/>`
    + `<g stroke="#ffffff" stroke-opacity=".22" stroke-width=".5" fill="none"><path d="M36 36 L36 14 M36 36 L55 25 M36 36 L55 47 M36 36 L36 58 M36 36 L17 47 M36 36 L17 25"/></g>`
    + `<path d="${star(12, 17, 7.5)}" fill="url(#bmm-field)" stroke="#9a6a12" stroke-width=".9" stroke-linejoin="round" filter="url(#bm-emb)"/>`
    + `<circle cx="36" cy="36" r="4.6" fill="url(#bmm-irid)" stroke="#9a6a12" stroke-width=".6"/>`
    + `<circle cx="36" cy="36" r="1.9" fill="#fffbe9"/>`
    + `<ellipse cx="30" cy="26" rx="12" ry="5.5" fill="url(#bm-spec)" opacity=".45"/>`
    + `</svg>`;
}
