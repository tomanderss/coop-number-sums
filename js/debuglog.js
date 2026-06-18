// debuglog.js — Persistentes Diagnoseprotokoll für den Coop-Transport.
// Rein lokal (localStorage), enthält keine Spieldaten — nur Zeitstempel,
// Kategorie, Meldung und ggf. Fehlercode/-meldung. Zweck: Verbindungsprobleme
// (z.B. von Firebase abgelehnte Schreibzugriffe) lassen sich anhand eines vom
// Nutzer exportierten Protokolls nachträglich diagnostizieren.

const KEY = 'cns_debuglog';
const MAX_ENTRIES = 200;

function read() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
}
function write(entries) {
  try { localStorage.setItem(KEY, JSON.stringify(entries)); } catch {}
}
function serializeExtra(extra) {
  if (extra instanceof Error || (extra && typeof extra === 'object' && ('code' in extra || 'message' in extra))) {
    return { code: extra.code, message: extra.message, name: extra.name };
  }
  return extra;
}

export function log(category, message, extra) {
  const entry = { ts: Date.now(), category, message };
  if (extra !== undefined) entry.extra = serializeExtra(extra);
  const entries = read();
  entries.push(entry);
  while (entries.length > MAX_ENTRIES) entries.shift();
  write(entries);
}

export function getLog() { return read(); }
export function clearLog() { write([]); }

export async function exportLogToFile() {
  const { BUILD } = await import('./buildinfo.js');
  const entries = read();
  const lines = entries.map(e => {
    const time = new Date(e.ts).toISOString();
    const extra = e.extra !== undefined ? ' ' + JSON.stringify(e.extra) : '';
    return `[${time}] [${e.category}] ${e.message}${extra}`;
  });
  const header = `Coop Number Sums – Diagnoseprotokoll\nVersion: ${BUILD}\nUserAgent: ${navigator.userAgent}\nExportiert: ${new Date().toISOString()}\n\n`;
  const text = header + (lines.join('\n') || '(leer)');
  const filename = `coop-number-sums-diagnose-${Date.now()}.txt`;
  const blob = new Blob([text], { type: 'text/plain' });
  if (navigator.canShare) {
    try {
      const file = new File([blob], filename, { type: 'text/plain' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Coop Number Sums Diagnose' });
        return;
      }
    } catch (e) { if (e.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
