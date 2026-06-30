// skins.js — reine Logik für den freischaltbaren „Dynamischen Skin" (1.0).
// Keine DOM-/Vue-Abhängigkeit → voll unit-testbar. app.js importiert hier.

export const SKIN_ID = 'dynamicColor';
export const SKIN_UNLOCK_VERSION = '1.0';
// Geheimcode (case-insensitiv, Leerzeichen ignoriert): „SupporterSeitTag1".
export const SKIN_CODE_NORM = 'supporterseittag1';

// Semver-artiger Vergleich teilstückweise numerisch ("1.0" > "0.166").
export function cmpVersion(a, b) {
  const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

// „Erlebt den Sprung auf 1.0": nur Bestandsspieler, die von <1.0 auf ≥1.0
// aktualisieren. Reine Erstinstallationen (kein seen) bekommen ihn NICHT
// automatisch (nur per Code) — bewusste Produktentscheidung.
export function qualifiesForV1Skin(seen, build) {
  return !!seen && cmpVersion(seen, SKIN_UNLOCK_VERSION) < 0 && cmpVersion(build, SKIN_UNLOCK_VERSION) >= 0;
}

export function normalizeSkinCode(s) { return String(s || '').replace(/\s/g, '').toLowerCase(); }
export function skinCodeMatches(s) { return normalizeSkinCode(s) === SKIN_CODE_NORM; }

// Gültige Stile (für Validierung/Tests). Der eigentliche Gradient lebt in CSS
// (css/styles.css, .skin-style-*) — er MUSS dort stehen und nicht als
// Custom-Property-String, weil `var(--markcol)` sonst schon am Brett-Container
// (ohne --markcol) eingesetzt und damit ungültig würde; in der ::after-Regel
// löst es dagegen pro Zelle korrekt auf (Coop-Identität bleibt).
export const SKIN_STYLES = ['solid', 'gradient', 'rainbow'];

// Inline-CSS-Variablen für den Brett-Container. speed=0 ⇒ keine Rotation.
// Eigene Editor-Farben NUR setzen, wenn gewählt; sonst greift in der CSS-Regel
// der Fallback var(--skin-cN, <aus --markcol abgeleitet>).
export function skinVars(s) {
  const speed = Math.max(0, Number(s.skinSpeed) || 0);
  const v = {
    '--skin-speed': speed + 's',
    '--skin-glow': (Math.max(0, Number(s.skinGlow) || 0)) + 'px',
    '--skin-thickness': (Math.max(1, Number(s.skinThickness) || 2.5)) + 'px',
  };
  if (s.skinColor1) v['--skin-c1'] = s.skinColor1;
  if (s.skinColor2) v['--skin-c2'] = s.skinColor2;
  if (s.skinColor3) v['--skin-c3'] = s.skinColor3;
  return v;
}

// Klassen für den Brett-Container, abhängig von den Editor-Einstellungen.
export function skinClasses(s, active) {
  const style = SKIN_STYLES.includes(s.skinStyle) ? s.skinStyle : 'gradient';
  return {
    'skin-dynamic': !!active,
    'skin-kept': s.skinApplyTo !== 'removed',
    'skin-removed': s.skinApplyTo !== 'kept',
    'skin-spin': (Number(s.skinSpeed) || 0) > 0,
    'skin-ccw': s.skinDirection === 'ccw',
    ['skin-style-' + style]: true,
  };
}
