// i18n/index.js — Laufzeit-Übersetzungsmechanik ohne Build-Schritt/Library.
// Weitere Sprache hinzufügen: neue Datei nach diesem Muster anlegen und unten
// in MESSAGES + SUPPORTED_LOCALES eintragen — sonst nichts.
import { reactive } from '../vue.esm-browser.prod.js';
import de from './de.js';
import en from './en.js';
import es from './es.js';
import fr from './fr.js';
import ptBR from './pt-BR.js';
import it from './it.js';
import ja from './ja.js';
import ko from './ko.js';
import tr from './tr.js';
import ru from './ru.js';

export const MESSAGES = { de, en, es, fr, 'pt-BR': ptBR, it, ja, ko, tr, ru };

// label ist bewusst NICHT übersetzt — die eigene Sprache muss immer auffindbar
// bleiben, auch wenn man die aktuell aktive UI-Sprache nicht lesen kann.
export const SUPPORTED_LOCALES = [
  { id: 'de', label: 'Deutsch' },
  { id: 'en', label: 'English' },
  { id: 'es', label: 'Español' },
  { id: 'fr', label: 'Français' },
  { id: 'pt-BR', label: 'Português (BR)' },
  { id: 'it', label: 'Italiano' },
  { id: 'ja', label: '日本語' },
  { id: 'ko', label: '한국어' },
  { id: 'tr', label: 'Türkçe' },
  { id: 'ru', label: 'Русский' },
];

const FALLBACK_LOCALE = 'de';

export const i18nState = reactive({ locale: FALLBACK_LOCALE });

export function detectLocale() {
  const nav = (navigator.language || FALLBACK_LOCALE);
  if (MESSAGES[nav]) return nav;
  const short = nav.slice(0, 2).toLowerCase();
  const match = Object.keys(MESSAGES).find(id => id.toLowerCase().startsWith(short));
  return match || FALLBACK_LOCALE;
}

export function setLocale(id) {
  if (!MESSAGES[id]) id = FALLBACK_LOCALE;
  i18nState.locale = id;
  document.documentElement.setAttribute('lang', id);
}

function resolve(path, table) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), table);
}

// Spieleigene Text-Ebene: ein Spiel kann einzelne Schlüssel ergänzen oder anders
// fassen (Math Cross erklärt eine andere Spielregel als Number Sums). Sie liegt
// ÜBER den gemeinsamen Texten und wird einmal beim Start gesetzt (ein
// Spielwechsel lädt die App neu). Struktur: { de: {…}, en: {…}, … } — fehlt eine
// Sprache, gilt deren Fallback (de) der Ebene, erst danach die gemeinsamen Texte.
let gameMessages = null;
export function setGameMessages(table) { gameMessages = table && typeof table === 'object' ? table : null; }

// t('game.errorsFound', { count: 3 }) -> "3 Fehler gefunden"
export function t(key, params) {
  let msg;
  if (gameMessages) {
    msg = resolve(key, gameMessages[i18nState.locale]);
    // Fallback innerhalb der Ebene NUR, wenn die aktive Sprache den Schlüssel
    // auch gemeinsam nicht kennt — sonst überdeckte ein deutscher Spieltext
    // eine vorhandene Übersetzung.
    if (msg === undefined && resolve(key, MESSAGES[i18nState.locale]) === undefined) msg = resolve(key, gameMessages[FALLBACK_LOCALE]);
  }
  if (msg === undefined) msg = resolve(key, MESSAGES[i18nState.locale]);
  if (msg === undefined) msg = resolve(key, MESSAGES[FALLBACK_LOCALE]);
  if (msg === undefined) return key;
  if (params) {
    for (const [k, v] of Object.entries(params)) msg = msg.replaceAll(`{${k}}`, v);
  }
  return msg;
}
