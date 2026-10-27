import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Das CI läuft im offiziellen Playwright-Container. Dessen Tag MUSS zur
// installierten @playwright/test-Version passen — sonst sucht Playwright eine
// Browser-Version, die im Image nicht liegt, und JEDER E2E-Shard scheitert.
test('CI-Container-Image passt zur @playwright/test-Version', () => {
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  const want = (pkg.devDependencies && pkg.devDependencies['@playwright/test']) || (pkg.dependencies && pkg.dependencies['@playwright/test']);
  const yml = readFileSync(new URL('../../.github/workflows/test.yml', import.meta.url), 'utf8');
  const m = yml.match(/mcr\.microsoft\.com\/playwright:v([\d.]+)-/);
  assert.ok(m, 'Playwright-Container fehlt im Workflow');
  assert.equal(m[1], String(want).replace(/^[^\d]*/, ''));
});

test('Shard-Anzahl in Matrix und Aufruf stimmen überein', () => {
  const yml = readFileSync(new URL('../../.github/workflows/test.yml', import.meta.url), 'utf8');
  const matrix = yml.match(/shard: \[([^\]]+)\]/)[1].split(',').map((x) => Number(x.trim()));
  const total = Number(yml.match(/--shard=\$\{\{ matrix\.shard \}\}\/(\d+)/)[1]);
  assert.deepEqual(matrix, Array.from({ length: total }, (_, i) => i + 1));
  assert.match(yml, new RegExp(`name: E2E \\$\\{\\{ matrix\\.shard \\}\\}/${total}`));
});
