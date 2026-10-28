// versions.js — Versionsnummern: Vergleich, die rückwirkende Umnummerierung
// und die Feier einer neuen HAUPTVERSION. Rein und unit-getestet.
//
// RÜCKWIRKENDE UMNUMMERIERUNG: Die Zusammenlegung zu „Coop Number Games"
// (mehrere Spiele in einer App) erschien als 1.224 und war in Wahrheit eine neue
// Hauptversion. Deshalb wurde der Verlauf nachträglich umbenannt:
// 1.224 → 2.0, 1.225 → 2.1, … 1.240 → 2.16 (im CHANGELOG steht die alte Nummer
// als `formerly`). Geräte haben aber noch die ALTE Nummer als „zuletzt gesehen"
// gespeichert, Diagnoseprotokolle und Cloud-Sessions ebenso — `canonicalVersion`
// übersetzt sie, bevor verglichen wird.
//
// HAUPTVERSIONS-FEIER: Wer zuletzt eine Version mit kleinerer Hauptzahl gesehen
// hat und jetzt eine neue startet, bekommt EINMAL ein großes Feier-Pop-up
// (`majorCelebrationFor`). Maßgeblich ist die GESPEICHERTE Nummer, nicht die
// übersetzte: wer zuletzt „1.240" sah, hat 2.0 nie als solche erlebt und wird
// gefeiert. Neuinstallationen (nichts gesehen) feiern nicht — für sie ist nichts
// „neu". Jede Hauptversion ab 2 braucht einen Eintrag in MAJORS (Test erzwingt
// das für die laufende Version) samt Texten `major.v<N>.*` in ALLEN Sprachen.

/** Teilstückweise numerischer Vergleich ("1.10" > "1.9"). */
export function cmpVersion(a, b) {
  const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

export const majorOf = (v) => parseInt(String(v || '').split('.')[0], 10) || 0;

/** Umnummerierte Bereiche: [major, ersteMinor, letzteMinor] → neue Hauptzahl ab Minor 0. */
export const RENUMBERED = [
  { major: 1, from: 224, to: 240, newMajor: 2 },
];

/** Alte Nummer → heutige Nummer (unbekannte bleiben, wie sie sind). */
export function canonicalVersion(v) {
  if (v == null || v === '') return v;
  const [ma, mi] = String(v).split('.').map((n) => parseInt(n, 10));
  for (const r of RENUMBERED) {
    if (ma === r.major && mi >= r.from && mi <= r.to) return `${r.newMajor}.${mi - r.from}`;
  }
  return String(v);
}

/**
 * Die Hauptversionen, die gefeiert werden. `games` = Spiele, deren Logos die
 * Feier zeigt; `highlights` = Icon + i18n-Schlüssel je Punkt.
 */
export const MAJORS = {
  2: {
    games: ['numbersums', 'mathcross', 'rectangles', 'numberpath'],
    highlights: [
      { icon: 'grid', key: 'major.v2.h1' },
      { icon: 'user', key: 'major.v2.h2' },
      { icon: 'users', key: 'major.v2.h3' },
      { icon: 'star', key: 'major.v2.h4' },
    ],
  },
};

/**
 * Welche Hauptversion ist zu feiern? `seen` = die GESPEICHERTE zuletzt gesehene
 * Nummer (unübersetzt), `build` = die laufende. Liefert die Hauptzahl oder null.
 */
export function majorCelebrationFor(seen, build) {
  if (!seen) return null;
  const now = majorOf(build);
  if (majorOf(seen) >= now) return null;
  return MAJORS[now] ? now : null;
}
