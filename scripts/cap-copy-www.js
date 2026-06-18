#!/usr/bin/env node
// Capacitor verlangt ein webDir ungleich dem Projekt-Root ("." ist laut
// CLI-Validierung kein gültiger Wert). Da die App ansonsten bewusst ohne
// Build-Schritt auskommt, spiegelt dieses Skript nur die tatsächlich zur
// Laufzeit benötigten Dateien 1:1 (unverändert) nach www/ — kein Bundling,
// kein Transpiling, nur ein Datei-Copy vor `npx cap sync`.
import { cpSync, rmSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const www = join(root, 'www');

rmSync(www, { recursive: true, force: true });
mkdirSync(www, { recursive: true });

const entries = ['index.html', 'privacy.html', 'imprint.html', 'manifest.json', 'sw.js', 'css', 'icons', 'js'];
for (const entry of entries) {
  cpSync(join(root, entry), join(www, entry), { recursive: true });
}
