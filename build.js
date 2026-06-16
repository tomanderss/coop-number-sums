// build.js — generiert js/buildinfo.js (Version + Changelog) und bumpt den
// Service-Worker-Cache. Version = 0.<Commit-Anzahl+1>. Changelog kommt aus
// changes.txt (von Claude/dir gepflegt). 1:1-Mechanik wie in der Werwolf-App.

import { execSync } from 'child_process';
import { writeFileSync, readFileSync, existsSync, readdirSync, unlinkSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
function git(cmd) { return execSync(`git ${cmd}`, { cwd: __dir }).toString().trim(); }
function gitSafe(cmd, fallback) { try { return git(cmd); } catch { return fallback; } }

// ── Version ──────────────────────────────────────────────────────────────────
const VERSION_OFFSET = 1;
const totalCommits = parseInt(gitSafe('rev-list --count HEAD', '0')) || 0;
const VERSION = `0.${totalCommits + VERSION_OFFSET}`;
const GIT_HASH = gitSafe('rev-parse --short HEAD', 'init');

// ── Aktuelle Änderungen aus changes.txt ──────────────────────────────────────
const changesFile = join(__dir, 'changes.txt');
const currentChanges = existsSync(changesFile)
  ? readFileSync(changesFile, 'utf8').split('\n').map(l => l.trim()).filter(Boolean)
  : ['Stabilitätsverbesserungen'];
const changes = currentChanges.length ? currentChanges : ['Stabilitätsverbesserungen'];

// ── Bisherige History übernehmen ─────────────────────────────────────────────
let oldChangelog = [];
const buildinfoPath = join(__dir, 'js', 'buildinfo.js');
if (existsSync(buildinfoPath)) {
  try {
    const raw = readFileSync(buildinfoPath, 'utf8');
    const m = raw.match(/export const CHANGELOG\s*=\s*(\[[\s\S]*?\]);/);
    if (m) oldChangelog = JSON.parse(m[1]);
  } catch {}
}

const today = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
const newEntry = { version: VERSION, date: today, changes };
const history = [newEntry, ...oldChangelog.filter(e => e.version !== VERSION)];

// ── Schreiben ────────────────────────────────────────────────────────────────
writeFileSync(buildinfoPath, `// Auto-generiert von build.js — nicht manuell bearbeiten!
export const BUILD      = '${VERSION}';
export const BUILD_HASH = '${GIT_HASH}';

export const CHANGELOG = ${JSON.stringify(history, null, 2)};
`, 'utf8');

// changes.txt leeren
writeFileSync(changesFile, '', 'utf8');

// ── Service-Worker-Cache aktualisieren ───────────────────────────────────────
const swPath = join(__dir, 'sw.js');
if (existsSync(swPath)) {
  const sw = readFileSync(swPath, 'utf8').replace(/coop-number-sums-v[\d.]+/, `coop-number-sums-v${VERSION}`);
  writeFileSync(swPath, sw, 'utf8');
}

// ── Versions-Markerdatei ─────────────────────────────────────────────────────
readdirSync(__dir).filter(f => f.startsWith('version-')).forEach(f => unlinkSync(join(__dir, f)));
writeFileSync(join(__dir, `version-${VERSION}.txt`), `v${VERSION} | ${GIT_HASH} | ${today}\n`, 'utf8');

console.log(`✓ v${VERSION} (${GIT_HASH}) — ${changes.length} Änderungen`);
