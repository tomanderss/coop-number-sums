// games/feedback.js — EIN Gefühl für alle Spiele: kurze Vibration je Zugart.
//
// Vorher vibrierten nur Math Cross, Rectangles und Pipes, jedes mit eigener
// Dauer. Jetzt ruft jedes Brett haptic(art) und bekommt dieselbe Rückmeldung:
//   tap   – leichter Antipper (Zug gesetzt, Zelle berührt)
//   place – Zug abgeschlossen (Linie/Rechteck/Stein abgelegt)
//   lock  – Sperren/Entsperren, Durchbrechen einer Grenze
//   done  – Einheit fertig (Rechnung, Zeile, Paar verbunden …)
//   error – Fehler (Leben verloren)
//   win   – gelöst
// Abschaltbar über settings.haptics (Einstellungen ▸ Sound). iOS-Safari kennt
// navigator.vibrate nicht — dort passiert einfach nichts.

const PATTERNS = {
  tap: 6,
  place: 12,
  lock: 16,
  done: [14, 40, 24],
  error: [30, 50, 30],
  win: [20, 60, 20, 60, 60],
};

let settings = () => ({});
/** Einmalig aus app.js: woher die Einstellungen kommen. */
export function initFeedback(getSettings) { if (typeof getSettings === 'function') settings = getSettings; }

/** Rein (unit-getestet): das Vibrationsmuster einer Art, unbekannt = place. */
export function hapticPattern(kind) { return PATTERNS[kind] ?? PATTERNS.place; }

export function haptic(kind = 'place') {
  try {
    if (settings().haptics === false) return false;
    if (typeof navigator === 'undefined' || !navigator.vibrate) return false;
    navigator.vibrate(hapticPattern(kind));
    return true;
  } catch (_) { return false; }
}
