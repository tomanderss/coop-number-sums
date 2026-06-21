// profanity.js — einfache Basis-Moderation für frei wählbare Coop-Anzeigenamen.
// Ziel ist kein perfekter Filter, sondern eine niedrigschwellige Hürde gegen
// offensichtlich unangemessene Namen in einem öffentlich sichtbaren Roster.
// Normalisiert Kleinschreibung/Leetspeak/Whitespace und prüft auf Substring-
// Treffer gegen eine kleine DE/EN-Wortliste.

const WORDS = [
  // Englisch
  'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'cunt', 'dick', 'pussy',
  'nigger', 'nigga', 'faggot', 'whore', 'slut', 'retard', 'rape',
  // Deutsch (ß ist bereits zu "ss" normalisiert, siehe normalize())
  'arschloch', 'scheisse', 'hure', 'fotze', 'wichser', 'schlampe',
  'nazi', 'hitler', 'kanake', 'spast', 'mongo',
];

const LEET_MAP = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's' };

function normalize(s) {
  return String(s)
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // Akzente entfernen
    .replace(/[01345 7@$]/g, ch => LEET_MAP[ch] ?? '') // Leetspeak + Whitespace strippen
    .replace(/[^a-z]/g, '');
}

export function hasProfanity(name) {
  const norm = normalize(name);
  if (!norm) return false;
  return WORDS.some(w => norm.includes(w));
}
