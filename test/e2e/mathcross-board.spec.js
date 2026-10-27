import { test, expect } from '@playwright/test';
import { gotoApp, startNewGame, playOneMove, commitMistakes } from './mathcross-helpers.js';

// Kern des Spiels: Steine per Drag & Drop ins Rechennetz, Tausch bei Kollision,
// Zurücklegen in den Vorrat — und die Fehler-Regel (nur eine vollständig
// falsche Rechnung zählt).
test.describe('Rechenkreuz: Steine legen', () => {
  // Der gezogene Stein schwebt ÜBER dem Finger (DRAG_LIFT) — abgelegt wird
  // dort, wo der STEIN liegt. Der Zeiger muss also um genau diesen Betrag
  // TIEFER stehen als das Zielfeld, so wie es ein Daumen auch täte.
  async function dragTo(page, from, to) {
    // Der Vorrat ist eine waagerecht scrollbare Reihe — ein Stein kann also
    // ausserhalb des Sichtbereichs liegen. Erst heranscrollen, sonst zeigt die
    // Bounding-Box auf eine Stelle, an der gar nicht der Stein liegt.
    await from.scrollIntoViewIfNeeded();
    const lift = await page.evaluate(() => window.__cns.dragLift);
    const a = await from.boundingBox();
    const b = await to.boundingBox();
    const tx = b.x + b.width / 2, ty = b.y + b.height / 2 + lift;
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(a.x + a.width / 2 + 12, a.y + a.height / 2 + 12, { steps: 3 });
    await page.mouse.move(tx, ty, { steps: 8 });
    await page.mouse.up();
  }

  test('ein Stein lässt sich aus dem Vorrat auf ein Feld ziehen', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page, 'mittel');
    const target = await page.evaluate(() => window.__cns.firstBlank());
    const tileIndex = await page.evaluate((v) => window.__cns.state.tray.findIndex((t) => !t.used && t.v === v), target.v);
    const tile = page.locator('.tray .tile').nth(tileIndex);
    const cell = page.locator(`.board .cell[data-r="${target.r}"][data-c="${target.c}"]`);
    await dragTo(page, tile, cell);
    expect(await page.evaluate(({ r, c }) => window.__cns.state.placed[r][c], target)).toBe(target.v);
    await expect(cell).toHaveClass(/filled/);
  });

  test('ein Stein lässt sich zurück in den Vorrat ziehen', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page, 'mittel');
    const move = await playOneMove(page);
    const before = await page.evaluate(() => window.__cns.state.tray.filter((t) => !t.used).length);
    const cell = page.locator(`.board .cell[data-r="${move.r}"][data-c="${move.c}"]`);
    await dragTo(page, cell, page.locator('.tray'));
    expect(await page.evaluate(({ r, c }) => window.__cns.state.placed[r][c], move)).toBeNull();
    expect(await page.evaluate(() => window.__cns.state.tray.filter((t) => !t.used).length)).toBe(before + 1);
  });

  test('zwei Steine tauschen den Platz', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page, 'mittel');
    // ZWEI Felder wählen, deren Rechnungen auch nach dem Tausch noch offen
    // bleiben — sonst wäre der Tausch ein echter Fehler (vollständige, falsche
    // Rechnung) und würde zu Recht abgelehnt.
    const pair = await page.evaluate(() => {
      const { state, placeAt } = window.__cns;
      const p = state.puzzle;
      const cellsOf = (eq) => { const out = []; for (let i = 0; i <= eq.n; i++) out.push(eq.dir === 'h' ? [eq.r, eq.c + i] : [eq.r + i, eq.c]); return out; };
      const eqsAt = (r, c) => p.equations.filter((e) => cellsOf(e).some(([rr, cc]) => rr === r && cc === c));
      const openBlanks = (eq) => cellsOf(eq).filter(([r, c]) => !p.slots[r][c].given && state.placed[r][c] == null).length;
      const safe = [];
      for (let r = 0; r < p.rows; r++) for (let c = 0; c < p.cols; c++) {
        const sl = p.slots[r][c];
        if (!sl || sl.given) continue;
        if (eqsAt(r, c).every((e) => openBlanks(e) >= 2)) safe.push({ r, c, v: sl.v });
      }
      for (const x of safe) for (const y of safe) {
        if (x === y || x.v === y.v) continue;
        const shared = eqsAt(x.r, x.c).some((e) => eqsAt(y.r, y.c).includes(e));
        if (shared) continue;
        placeAt(x.r, x.c, x.v); placeAt(y.r, y.c, y.v);
        return { a: x, b: y };
      }
      return null;
    });
    expect(pair, 'kein tauschbares Feldpaar gefunden').not.toBeNull();
    const { a, b } = pair;
    const cellA = page.locator(`.board .cell[data-r="${a.r}"][data-c="${a.c}"]`);
    const cellB = page.locator(`.board .cell[data-r="${b.r}"][data-c="${b.c}"]`);
    await dragTo(page, cellA, cellB);
    const after = await page.evaluate(({ a, b }) => ({
      a: window.__cns.state.placed[a.r][a.c], b: window.__cns.state.placed[b.r][b.c],
    }), { a, b });
    expect(after).toEqual({ a: b.v, b: a.v });
  });

  test('eine falsch platzierte Zahl ist KEIN Fehler, solange keine Rechnung falsch wird', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page, 'mittel');
    // Einen Stein auf ein Feld legen, dessen Rechnungen danach noch offen sind.
    const ok = await page.evaluate(() => {
      const { state, placeAt } = window.__cns;
      const p = state.puzzle;
      const cellsOf = (eq) => { const out = []; for (let i = 0; i <= eq.n; i++) out.push(eq.dir === 'h' ? [eq.r, eq.c + i] : [eq.r + i, eq.c]); return out; };
      const openBlanks = (eq) => cellsOf(eq).filter(([r, c]) => !p.slots[r][c].given && state.placed[r][c] == null).length;
      for (const eq of p.equations) {
        for (const [r, c] of cellsOf(eq)) {
          if (p.slots[r][c].given || state.placed[r][c] != null) continue;
          // ALLE Rechnungen dieses Feldes müssen danach noch offen bleiben —
          // sonst wäre der Zug ein echter Fehler (vollständig + falsch).
          const eqs = p.equations.filter((e) => cellsOf(e).some(([rr, cc]) => rr === r && cc === c));
          if (!eqs.every((e) => openBlanks(e) >= 2)) continue;
          const right = p.slots[r][c].v;
          const wrong = state.tray.filter((t) => !t.used && t.v !== right).map((t) => t.v)[0];
          if (wrong == null) continue;
          return { placed: placeAt(r, c, wrong), lives: state.lives, r, c, wrong };
        }
      }
      return null;
    });
    expect(ok).not.toBeNull();
    expect(ok.placed).toBe(true);          // Zug angenommen
    expect(ok.lives).toBe(3);              // kein Leben verloren
  });

  test('eine vollständig falsche Rechnung kostet ein Leben', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page, 'mittel');
    await commitMistakes(page, 1);
    expect(await page.evaluate(() => window.__cns.state.lives)).toBe(2);
    expect(await page.evaluate(() => window.__cns.state.mistakes)).toBe(1);
  });
});

// Reichweite beim Ziehen (settings.dragScale): der Stein folgt der Bewegung
// verstärkt, damit man den oberen Brettrand erreicht, ohne den Finger über den
// ganzen Bildschirm zu ziehen. Abgelegt wird IMMER dort, wo der Stein zu sehen
// ist — genau das prüft der Test: eine um den Faktor GETEILTE Zeigerbewegung
// muss dieselbe Zelle treffen wie die volle Bewegung ohne Verstärkung.
test.describe('Reichweite beim Ziehen', () => {
  test('bei Faktor 3 folgt der Stein der Bewegung dreifach', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page, 'mittel');
    const lift = await page.evaluate(() => window.__cns.dragLift);
    const tile = page.locator('.tray .tile').first();

    // Die eigentliche Zusage ist eine Rechnung, kein Pixel-Treffer: der Stein
    // steht bei Faktor f auf Startpunkt + f × Fingerweg (abzüglich Lift). Genau
    // das wird hier gemessen — an der TATSÄCHLICHEN Position des Ziehschattens.
    // (Ein Test, der stattdessen auf eine Zelle zielt, hängt an der Brett-
    // geometrie: misst der ResizeObserver das Brett unter Last erst nach dem
    // Auslesen der Koordinaten neu, verschiebt sich das Ziel und der Test fällt
    // ohne echten Fehler um — genau so flackerte er in der CI.)
    // Der Startpunkt wird IMMER unmittelbar vor der Geste frisch gemessen: misst
    // der ResizeObserver das Brett unter Last nach, wandert auch der Vorrat, und
    // ein vorher gelesener Kasten zeigt ins Leere — der Zug beginnt dann gar
    // nicht (genau das ließ den Test in der CI umfallen).
    const ghostAfterMove = async (f, dx, dy) => {
      await page.evaluate((v) => window.__cns.setSetting('dragScale', v), f);
      await tile.scrollIntoViewIfNeeded();
      const a = await tile.boundingBox();
      const sx = a.x + a.width / 2, sy = a.y + a.height / 2;
      await page.mouse.move(sx, sy);
      await page.mouse.down();
      await page.mouse.move(sx + dx, sy + dy, { steps: 6 });
      const pos = await page.evaluate(() => {
        const g = document.querySelector('.drag-ghost');
        if (!g || g.style.display === 'none') return null;
        const m = g.style.transform.match(/translate3d\((-?[\d.]+)px,\s*(-?[\d.]+)px/);
        return { x: +m[1], y: +m[2] };
      });
      await page.mouse.up();
      expect(pos, 'der Ziehschatten muss sichtbar sein').not.toBeNull();
      return { ...pos, sx, sy };
    };

    // Delta bewusst nach RECHTS oben: der erste Stein liegt links, dreifach nach
    // links liefe der Stein aus dem Fenster und würde geklemmt (dropPoint hält
    // ihn im sichtbaren Bereich) — dann misst der Test die Klemme, nicht die
    // Verstärkung.
    const dx = 40, dy = -120;
    const p3 = await ghostAfterMove(3, dx, dy);
    expect(Math.abs(p3.x - (p3.sx + dx * 3))).toBeLessThanOrEqual(1);
    expect(Math.abs(p3.y - (p3.sy + dy * 3 - lift))).toBeLessThanOrEqual(1);

    // Zum Vergleich: bei 1 klebt der Stein (bis auf den Lift) am Finger.
    const p1 = await ghostAfterMove(1, dx, dy);
    expect(Math.abs(p1.x - (p1.sx + dx))).toBeLessThanOrEqual(1);
    expect(Math.abs(p1.y - (p1.sy + dy - lift))).toBeLessThanOrEqual(1);
  });

  test('auch eine schnelle Bewegung startet den Zug', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page, 'mittel');
    const tile = page.locator('.tray .tile').first();
    await tile.scrollIntoViewIfNeeded();
    const a = await tile.boundingBox();
    const sx = a.x + a.width / 2, sy = a.y + a.height / 2;
    await page.mouse.move(sx, sy);
    await page.mouse.down();
    // EIN Sprung, weit über den Stein hinaus — so wischt man wirklich. Ohne den
    // sofortigen Zeiger-Fang in onDragStart gingen die Bewegungen an das Element
    // UNTER dem Zeiger, der Stein sah sie nie und der Zug begann gar nicht.
    await page.mouse.move(sx, sy - 200);
    const sichtbar = await page.evaluate(() => {
      const g = document.querySelector('.drag-ghost');
      return !!g && g.style.display === 'block';
    });
    await page.mouse.up();
    expect(sichtbar).toBe(true);
  });

  test('Standard ist 1 — die Bewegung wird nicht verstärkt', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page, 'mittel');
    expect(await page.evaluate(() => window.__cns.state.settings.dragScale)).toBe(1);
  });
});

// Der Vorrat zeigt IMMER alle Steine auf einmal (kein Scrollen), nimmt dabei so
// wenig Hoehe wie moeglich ein, und ein gelegter Stein hinterlaesst KEINE Luecke.
// Der Zug beginnt erst nach echter Bewegung (DRAG_SLOP), damit ein Tipp nur
// auswaehlt und der Ziehschatten nicht schon beim Antippen aufblitzt.
test.describe('Vorrat', () => {
  test('eine winzige Bewegung nimmt den Stein nur auf, sie zieht ihn nicht', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page, 'mittel');
    const tile = page.locator('.tray .tile').first();
    const v = await page.evaluate(() => window.__cns.state.tray.find((t) => !t.used).v);
    await tile.scrollIntoViewIfNeeded();
    const a = await tile.boundingBox();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(a.x + a.width / 2 + 3, a.y + a.height / 2, { steps: 2 });  // unter der Schwelle
    await page.mouse.up();
    // Unter der Schwelle = Tipp: der Stein ist AUSGEWAEHLT, nicht gezogen.
    expect(await page.evaluate(() => window.__cns.state.pick && window.__cns.state.pick.v)).toBe(v);
    expect(await page.evaluate(() => document.querySelectorAll('.drag-ghost[style*="display: block"]').length)).toBe(0);
  });

  // Ein ausgewaehlter Stein haelt die Hervorhebung der freien Felder — genau wie
  // beim Ziehen. Vorher erlosch sie mit dem Abheben des Fingers, obwohl der Stein
  // weiterhin in der Hand lag (gemeldet).
  test('ein angetippter Stein haelt die Feld-Hervorhebung', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page, 'mittel');
    expect(await page.locator('.cell.droppable').count()).toBe(0);
    const tile = page.locator('.tray .tile').first();
    await tile.scrollIntoViewIfNeeded();
    await tile.click();
    expect(await page.evaluate(() => !!window.__cns.state.pick)).toBe(true);
    expect(await page.locator('.cell.droppable').count()).toBeGreaterThan(0);
  });

  test('auch das größte Level zeigt ALLE Steine ohne Scrollen', async ({ page }) => {
    await gotoApp(page);
    // Das groesste Brett (10x8) ist teuer zu erzeugen: 1,8 s Median, bis 5,2 s
    // im Einzellauf — unter der Parallel-Last der vollen Suite reicht das
    // Standard-Limit von 30 s nicht zuverlaessig (genau so einmal rot geworden).
    test.setTimeout(90000);
    await startNewGame(page, 'rip');   // die meisten Steine
    const t = await page.evaluate(() => {
      const tray = document.querySelector('.tray');
      const box = tray.getBoundingClientRect();
      const tiles = [...document.querySelectorAll('.tray .tile')];
      const drin = tiles.every((el) => {
        const b = el.getBoundingClientRect();
        return b.left >= box.left - 1 && b.right <= box.right + 1 && b.top >= box.top - 1 && b.bottom <= box.bottom + 1;
      });
      return {
        scrollt: tray.scrollWidth > tray.clientWidth + 1 || tray.scrollHeight > tray.clientHeight + 1,
        tiles: tiles.length,
        offen: window.__cns.state.tray.filter((x) => !x.used).length,
        drin,
      };
    });
    expect(t.scrollt).toBe(false);       // nichts ist weggescrollt
    expect(t.tiles).toBe(t.offen);       // jeder offene Stein hat eine Kachel
    expect(t.drin).toBe(true);           // und liegt sichtbar im Vorrat
  });

  test('ein gelegter Stein hinterlässt keine Lücke und der Vorrat schrumpft', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page, 'schwer');
    const vorher = await page.evaluate(() => ({
      h: Math.round(document.querySelector('.tray').getBoundingClientRect().height),
      tile: window.__cns.state.trayTile,
      kacheln: document.querySelectorAll('.tray .tile').length,
    }));
    await page.evaluate(() => { for (let i = 0; i < 5; i++) window.__cns.placeOne(); });
    const nachher = await page.evaluate(() => ({
      h: Math.round(document.querySelector('.tray').getBoundingClientRect().height),
      tile: window.__cns.state.trayTile,
      kacheln: document.querySelectorAll('.tray .tile').length,
    }));
    expect(nachher.kacheln).toBe(vorher.kacheln - 5);   // keine Platzhalter-Lücken
    expect(nachher.tile).toBe(vorher.tile);             // Steingröße bleibt konstant
    expect(nachher.h).toBeLessThanOrEqual(vorher.h);    // der Vorrat wächst nie
  });
});

// Der Vorrat muss IMMER exakt die noch fehlenden Zahlen enthalten — nicht mehr,
// nicht weniger. Beim Tausch zweier gelegter Steine entstand vorher ein Stein
// aus dem Nichts (gemeldet: „manche Level haben zu viele Steine").
test.describe('Vorrat bleibt exakt', () => {
  test('nach dem Tausch zweier gelegter Steine stimmt der Vorrat weiter', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page, 'schwer');
    const before = await page.evaluate(() => window.__cns.state.tray.length);
    // ZWEI Lücken suchen, deren TAUSCH die Fehlerprüfung passiert (keine VOLLE
    // Rechnung wird dadurch falsch) — sonst weist applyChanges den Zug ab und
    // der Pfad, um den es hier geht, wird gar nicht durchlaufen. Geprüft wird
    // mit derselben Funktion, die auch das Spiel benutzt.
    const cells = await page.evaluate(async () => {
      const { placementBreaksEquation } = await import('/js/games/mathcross/model.js');
      const s = window.__cns.state, p = s.puzzle;
      const blanks = [];
      for (let r = 0; r < p.rows; r++) for (let c = 0; c < p.cols; c++) {
        const sl = p.slots[r][c];
        if (sl && !sl.given) blanks.push({ r, c, v: sl.v });
      }
      for (let i = 0; i < blanks.length; i++) {
        for (let j = i + 1; j < blanks.length; j++) {
          const a = blanks[i], b = blanks[j];
          if (a.v === b.v) continue;                       // ein Tausch gleicher Werte ist keiner
          const trial = p.slots.map((row) => row.map(() => null));
          trial[b.r][b.c] = a.v; trial[a.r][a.c] = b.v;
          const bad = placementBreaksEquation(p, trial, b.r, b.c, a.v)
                   || placementBreaksEquation(p, trial, a.r, a.c, b.v);
          if (!bad) return [a, b];
        }
      }
      return [];
    });
    expect(cells.length).toBe(2);
    const swapped = await page.evaluate(([a, b]) => {
      window.__cns.placeAt(a.r, a.c, a.v);
      window.__cns.placeAt(b.r, b.c, b.v);
      window.__cns.dropOn(b.r, b.c, { v: a.v, from: { r: a.r, c: a.c } });
      const s = window.__cns.state;
      return s.placed[b.r][b.c] === a.v && s.placed[a.r][a.c] === b.v;
    }, cells);
    expect(swapped).toBe(true);   // der Tausch ist wirklich passiert
    const after = await page.evaluate(() => {
      const s = window.__cns.state;
      const placed = [];
      for (let r = 0; r < s.puzzle.rows; r++) for (let c = 0; c < s.puzzle.cols; c++) if (s.placed[r][c] != null) placed.push(s.placed[r][c]);
      const open = s.tray.filter((t) => !t.used).map((t) => t.v);
      const sort = (x) => x.slice().sort((p, q) => p - q).join(',');
      return { total: s.tray.length, matches: sort([...open, ...placed]) === sort(s.puzzle.tray) };
    });
    expect(after.total).toBe(before);
    expect(after.matches).toBe(true);   // offen + gelegt == der Vorrat des Rätsels
  });

  test('ein frisch gestartetes Level hat exakt so viele Steine wie Lücken', async ({ page }) => {
    await gotoApp(page);
    for (const diff of ['sehrleicht', 'mittel', 'schwer']) {
      await startNewGame(page, diff);
      const ok = await page.evaluate(() => {
        const s = window.__cns.state;
        let blanks = 0;
        for (const row of s.puzzle.slots) for (const sl of row) if (sl && !sl.given) blanks++;
        return { blanks, tray: s.tray.length };
      });
      expect(ok.tray).toBe(ok.blanks);
      await page.evaluate(() => window.__cns.state.screen = 'home');
    }
  });
});

// Drei Gesten auf einem Zahl-Feld, alle ohne Regel-Bedeutung fuer das Raetsel.
test.describe('Gesten auf dem Brett', () => {
  // ZWEI Felder legen, deren Rechnungen auch nach dem Tausch offen bleiben —
  // sonst waere der Tausch eine vollstaendige, falsche Rechnung und wuerde zu
  // Recht als Fehler abgelehnt (gleiche Auswahl wie im Zieh-Tausch-Test oben).
  async function legeZwei(page) {
    return page.evaluate(() => {
      const { state, placeAt } = window.__cns;
      const p = state.puzzle;
      const cellsOf = (eq) => { const out = []; for (let i = 0; i <= eq.n; i++) out.push(eq.dir === 'h' ? [eq.r, eq.c + i] : [eq.r + i, eq.c]); return out; };
      const eqsAt = (r, c) => p.equations.filter((e) => cellsOf(e).some(([rr, cc]) => rr === r && cc === c));
      const openBlanks = (eq) => cellsOf(eq).filter(([r, c]) => !p.slots[r][c].given && state.placed[r][c] == null).length;
      const safe = [];
      for (let r = 0; r < p.rows; r++) for (let c = 0; c < p.cols; c++) {
        const sl = p.slots[r][c];
        if (!sl || sl.given) continue;
        if (eqsAt(r, c).every((e) => openBlanks(e) >= 2)) safe.push({ r, c, v: sl.v });
      }
      for (const x of safe) for (const y of safe) {
        if (x === y || x.v === y.v) continue;
        if (eqsAt(x.r, x.c).some((e) => eqsAt(y.r, y.c).includes(e))) continue;
        placeAt(x.r, x.c, x.v); placeAt(y.r, y.c, y.v);
        return [x, y];
      }
      return null;
    });
  }
  const feld = (page, z) => page.locator(`.cell[data-r="${z.r}"][data-c="${z.c}"]`);

  test('langes Druecken markiert ein Feld farbig und hebt die Markierung wieder auf', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page, 'mittel');
    const ziel = await page.evaluate(() => window.__cns.firstBlank());
    const zelle = feld(page, ziel);

    const box = await zelle.boundingBox();
    const halten = async (ms) => {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(ms);
      await page.mouse.up();
    };
    await halten(700);
    await expect(zelle).toHaveClass(/marked/);
    expect(await page.evaluate(() => window.__cns.state.hl.length), 'genau eine Markierung').toBe(1);
    // Die Markierung darf KEINEN Stein gelegt haben.
    expect(await page.evaluate(({ r, c }) => window.__cns.state.placed[r][c], ziel)).toBeNull();

    await halten(700);
    await expect(zelle).not.toHaveClass(/marked/);
    expect(await page.evaluate(() => window.__cns.state.hl.length)).toBe(0);
  });

  test('die Markierungsfarbe kommt aus den Einstellungen', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page, 'mittel');
    await page.evaluate(() => window.__cns.setSetting('markColor', '#ff00ff'));
    const varWert = await page.evaluate(() => getComputedStyle(document.querySelector('.board')).getPropertyValue('--markhl').trim());
    expect(varWert).toBe('#ff00ff');
  });

  test('zwei gelegte Zahlen lassen sich per Antippen tauschen', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page, 'mittel');
    const paar = await legeZwei(page);
    expect(paar, 'kein tauschbares Feldpaar gefunden').not.toBeNull();
    const [a, b] = paar;

    await feld(page, a).click();
    expect(await page.evaluate(() => !!window.__cns.state.pick), 'erster Tipp waehlt aus').toBe(true);
    await expect(feld(page, a)).toHaveClass(/picked/);

    await feld(page, b).click();
    const nach = await page.evaluate(({ a, b }) => ({ a: window.__cns.state.placed[a.r][a.c], b: window.__cns.state.placed[b.r][b.c] }), { a, b });
    expect(nach.a, 'die Werte sind getauscht').toBe(b.v);
    expect(nach.b).toBe(a.v);
    expect(await page.evaluate(() => window.__cns.state.pick), 'die Auswahl ist verbraucht').toBeNull();
  });

  test('dreimal antippen schickt eine Zahl zurueck in den Vorrat', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page, 'mittel');
    const paar = await legeZwei(page);
    expect(paar, 'kein geeignetes Feldpaar gefunden').not.toBeNull();
    const [a] = paar;
    const offenVorher = await page.evaluate(() => window.__cns.state.tray.filter((t) => !t.used).length);

    const zelle = feld(page, a);
    await zelle.click(); await zelle.click(); await zelle.click();

    expect(await page.evaluate(({ r, c }) => window.__cns.state.placed[r][c], a), 'das Feld ist wieder leer').toBeNull();
    expect(await page.evaluate(() => window.__cns.state.tray.filter((t) => !t.used).length), 'der Stein liegt wieder im Vorrat').toBe(offenVorher + 1);
    expect(await page.evaluate(() => window.__cns.state.pick), 'nichts bleibt in der Hand').toBeNull();
  });

  test('das Markieren einer gelegten Zahl laesst sie NICHT ausgewaehlt zurueck', async ({ page }) => {
    await gotoApp(page);
    await startNewGame(page, 'mittel');
    const paar = await legeZwei(page);
    expect(paar, 'kein geeignetes Feldpaar gefunden').not.toBeNull();
    const [a] = paar;
    const zelle = feld(page, a);

    const box = await zelle.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(700);
    await page.mouse.up();

    await expect(zelle).toHaveClass(/marked/);
    // Der @click-Fallback darf nach dem Markieren nicht doch noch auswaehlen.
    expect(await page.evaluate(() => window.__cns.state.pick), 'die Zahl haengt nicht in der Hand').toBeNull();
    await expect(zelle).not.toHaveClass(/picked/);
    expect(await page.evaluate(({ r, c }) => window.__cns.state.placed[r][c], a), 'die Zahl liegt unveraendert').toBe(a.v);
  });
});
