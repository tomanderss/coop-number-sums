// hinttutor.js — der „Tipp-Tutor": erklärt Schritt für Schritt, WARUM der
// nächste Zug zwingend ist — wie ein Mensch, mit den KONKRETEN Zahlen des
// Bretts statt generischer Texte.
//
// buildHintTutorial(puzzle, marks) sucht die am einfachsten erklärbare
// erzwungene Deduktion (Tier 1 → Teilsummen/Tier 2 → Überlapp/Tier 2.5) und
// zerlegt sie in eine Kette kleiner, einzeln zu bestätigender Schritte:
//   1. „Schau dir Zeile 3 an — Zielsumme 12."          (Bereich highlighten)
//   2. „Eingekreist sind schon 3+5=8 → es fehlen 4."   (belegte Zellen)
//   3. „Von den freien Zahlen 2, 4, 7 erreicht nur …"  (die eigentliche Logik)
//   4. „Also: Die 7 kann unmöglich dazugehören."       (Folgerung + Aktion)
//
// Jeder Schritt: { cells:[[r,c],…], key, params, unit?, unit2?, final?, action? }
//  - cells  = zu highlightende Zellen (immer konkret aufgelöst)
//  - key    = i18n-Schlüssel unter tutor.* (Texte in app.js/i18n)
//  - params = KONKRETE Zahlen/Listen für den Text (sprachneutral formatiert)
//  - unit   = { kind:'row'|'col'|'region', ref } — Label baut die UI via i18n
//  - final  = letzter Schritt; action = { r, c, want } wird beim Bestätigen
//    ausgeführt (die Aktion selbst läuft in app.js über doRevealCell).
//
// Die Kombinationen (Tier 2) werden ECHT AUFGEZÄHLT (alle Teilmengen der noch
// offenen Werte, die die Restsumme treffen) — das deckt auch Paritäts-Argumente
// („nur ungerade Kombination möglich") konkret ab, ohne Spezialsprache. Die
// Aufzählung ist gedeckelt (MAX_COMBOS_SHOWN) und bei sehr vielen offenen
// Zellen (ENUM_LIMIT) wird auf die reine Zwangs-Aussage zurückgefallen.
import { buildModel, UNK, KEEP, REMOVE } from './solver.js';

const ENUM_LIMIT = 14;       // max. offene Zellen je Gruppe für die Kombinations-Aufzählung
const MAX_COMBOS_SHOWN = 4;  // mehr Kombinationen werden als „+n weitere" zusammengefasst
const MAX_COMBOS_TOTAL = 400; // darüber ist die Aufzählung nicht mehr „erklärbar" → Gruppe überspringen

function marksToState(marks) {
  return marks.map(row => row.map(m => m === 'kept' ? KEEP : m === 'removed' ? REMOVE : UNK));
}

// Alle Teilmengen von vals (Index-Listen), deren Summe exakt target ist.
// capCount begrenzt die zurückgegebene Anzahl NICHT (wir brauchen die echte
// Gesamtmenge für die Zwangs-Prüfung), nur die Anzeige kürzt später.
function combosForTarget(vals, target) {
  const res = [];
  const n = vals.length;
  const pick = [];
  (function rec(i, sum) {
    if (res.length > MAX_COMBOS_TOTAL) return;
    if (sum === target) { res.push(pick.slice()); }
    if (i >= n || sum >= target) return;
    pick.push(i); rec(i + 1, sum + vals[i]); pick.pop();
    rec(i + 1, sum);
  })(0, 0);
  return res;
}

// Alle mit Teilmengen von vals erreichbaren Summen (klein & schnell — für die
// Überlapp-Deduktion, wo eine volle Aufzählung pro Kandidaten-Summe zu teuer wäre).
function reachableSums(vals) {
  const set = new Set([0]);
  for (const v of vals) for (const s of [...set]) set.add(s + v);
  return set;
}

// Kombinationen als lesbare Liste formatieren: "2+7, 4+5 (+2 weitere)" —
// sprachneutral; die "+n weitere"-Angabe liefert params.more für den i18n-Text.
function formatCombos(combos, vals) {
  const shown = combos.slice(0, MAX_COMBOS_SHOWN)
    .map(idxs => idxs.map(i => vals[i]).join('+'));
  return { list: shown.join(',  '), more: Math.max(0, combos.length - MAX_COMBOS_SHOWN) };
}

function fmtList(nums) { return nums.join(', '); }

// Gruppen-Zustand: Restsumme, offene/behaltene Zellen (als Modell-Indizes).
function groupState(model, st, g) {
  let rem = g.target;
  const und = [], kept = [];
  for (const ci of g.cells) {
    const cell = model.cells[ci];
    const v = st[cell.r][cell.c];
    if (v === KEEP) { rem -= cell.val; kept.push(ci); }
    else if (v === UNK) und.push(ci);
  }
  return { rem, und, kept };
}

const cellsOf = (model, ids) => ids.map(ci => [model.cells[ci].r, model.cells[ci].c]);
const valsOf = (model, ids) => ids.map(ci => model.cells[ci].val);

// Die gemeinsamen Einstiegs-Schritte jeder Erklärung: Bereich + Zwischenstand.
function introSteps(model, g, stG) {
  const unit = { kind: g.kind, ref: g.ref };
  const steps = [{ cells: cellsOf(model, g.cells), key: 'lookAt', params: { target: g.target }, unit }];
  if (stG.kept.length) {
    steps.push({
      cells: cellsOf(model, stG.kept), key: 'statusKept', unit,
      params: { kept: valsOf(model, stG.kept).join('+'), keptSum: g.target - stG.rem, rem: stG.rem },
    });
  } else {
    steps.push({ cells: cellsOf(model, g.cells), key: 'statusNone', params: { rem: stG.rem }, unit });
  }
  return steps;
}

function finalStep(model, ci, want, unit) {
  const cell = model.cells[ci];
  return {
    cells: [[cell.r, cell.c]], unit, final: true,
    key: want === 'kept' ? 'concludeKeep' : 'concludeRemove',
    params: { val: cell.val },
    action: { r: cell.r, c: cell.c, want },
  };
}

// ── Tier 1: direkt aus der Restsumme erklärbar ───────────────────────────────
function explainTier1(model, st) {
  for (const g of model.groups) {
    const stG = groupState(model, st, g);
    if (!stG.und.length) continue;
    const unit = { kind: g.kind, ref: g.ref };
    // Ziel bereits exakt erreicht → alles Offene muss weg.
    if (stG.rem === 0) {
      const steps = introSteps(model, g, stG);
      steps.push({ cells: cellsOf(model, stG.und), key: 'sumReached', params: { target: g.target }, unit });
      steps.push(finalStep(model, stG.und[0], 'removed', unit));
      return { steps, reason: 'sumReached' };
    }
    const undVals = valsOf(model, stG.und);
    const undTotal = undVals.reduce((a, b) => a + b, 0);
    // Alle offenen Zahlen zusammen ergeben GENAU den Rest → jede wird gebraucht.
    if (undTotal === stG.rem) {
      const steps = introSteps(model, g, stG);
      steps.push({ cells: cellsOf(model, stG.und), key: 'allNeeded', params: { vals: fmtList(undVals), rem: stG.rem }, unit });
      steps.push(finalStep(model, stG.und[0], 'kept', unit));
      return { steps, reason: 'allNeeded' };
    }
    // Eine offene Zahl ist allein schon größer als der Rest → kann nie dazugehören.
    for (const ci of stG.und) {
      if (model.cells[ci].val > stG.rem) {
        const steps = introSteps(model, g, stG);
        steps.push({ cells: [[model.cells[ci].r, model.cells[ci].c]], key: 'tooLarge', params: { val: model.cells[ci].val, rem: stG.rem }, unit });
        steps.push(finalStep(model, ci, 'removed', unit));
        return { steps, reason: 'tooLarge' };
      }
    }
  }
  return null;
}

// Kombinations-Zwang: Welche Zellen stecken in ALLEN / in KEINER der gültigen
// Kombinationen? (targetSums = Menge zulässiger Zielsummen, meist genau eine.)
function comboForce(undIds, undVals, targetSums) {
  let combos = [];
  for (const t of targetSums) combos = combos.concat(combosForTarget(undVals, t));
  if (!combos.length) return null;
  const inAll = [], inNone = [];
  for (let k = 0; k < undIds.length; k++) {
    let cntIn = 0;
    for (const combo of combos) if (combo.includes(k)) cntIn++;
    if (cntIn === combos.length) inAll.push(k);
    else if (cntIn === 0) inNone.push(k);
  }
  return { combos, inAll, inNone };
}

// ── Tier 2: Teilsummen — Kombinationen konkret aufzählen ─────────────────────
function explainTier2(model, st) {
  for (const g of model.groups) {
    const stG = groupState(model, st, g);
    if (!stG.und.length || stG.und.length > ENUM_LIMIT) continue;
    const undVals = valsOf(model, stG.und);
    const cf = comboForce(stG.und, undVals, [stG.rem]);
    if (!cf || (!cf.inAll.length && !cf.inNone.length)) continue;
    const unit = { kind: g.kind, ref: g.ref };
    const fmt = formatCombos(cf.combos, undVals);
    const steps = introSteps(model, g, stG);
    steps.push({
      cells: cellsOf(model, stG.und), key: 'combos', unit,
      params: { vals: fmtList(undVals), rem: stG.rem, combos: fmt.list, more: fmt.more, count: cf.combos.length },
    });
    const keep = cf.inAll.length > 0;
    const k = keep ? cf.inAll[0] : cf.inNone[0];
    const ci = stG.und[k];
    steps.push({
      cells: [[model.cells[ci].r, model.cells[ci].c]], unit,
      key: keep ? 'inAllCombos' : 'inNoCombo',
      params: { val: undVals[k], count: cf.combos.length },
    });
    steps.push(finalStep(model, ci, keep ? 'kept' : 'removed', unit));
    return { steps, reason: keep ? 'comboKeep' : 'comboRemove' };
  }
  return null;
}

// ── Tier 2.5: Überlapp Käfig ↔ Zeile/Spalte (Innie/Outtie) ──────────────────
function explainOverlap(model, st) {
  for (const pair of model.overlapPairs) {
    const { gA, gB, shared } = pair;
    const stA = groupState(model, st, gA), stB = groupState(model, st, gB);
    const sharedUnd = shared.filter(ci => {
      const cell = model.cells[ci];
      return st[cell.r][cell.c] === UNK;
    });
    if (sharedUnd.length < 2 || sharedUnd.length > ENUM_LIMIT) continue;
    if (stA.und.length > ENUM_LIMIT || stB.und.length > ENUM_LIMIT) continue;
    const sharedSet = new Set(sharedUnd);
    const sharedVals = valsOf(model, sharedUnd);
    const aExcl = stA.und.filter(ci => !sharedSet.has(ci));
    const bExcl = stB.und.filter(ci => !sharedSet.has(ci));
    // Mögliche Summen der geteilten Zellen aus Sicht beider Gruppen.
    const sharedReach = reachableSums(sharedVals);
    const sumsFrom = (exclIds, rem) => {
      const exclReach = reachableSums(valsOf(model, exclIds));
      const possible = new Set();
      for (const s of sharedReach) if (rem - s >= 0 && exclReach.has(rem - s)) possible.add(s);
      return possible;
    };
    const sumsA = sumsFrom(aExcl, stA.rem);
    const sumsB = sumsFrom(bExcl, stB.rem);
    const both = [...sumsA].filter(s => sumsB.has(s)).sort((a, b) => a - b);
    if (!both.length) continue;
    const cf = comboForce(sharedUnd, sharedVals, both);
    if (!cf || (!cf.inAll.length && !cf.inNone.length)) continue;
    const unitA = { kind: gA.kind, ref: gA.ref }, unitB = { kind: gB.kind, ref: gB.ref };
    const fmt = formatCombos(cf.combos, sharedVals);
    const steps = [
      { cells: cellsOf(model, gA.cells), key: 'lookAt', params: { target: gA.target }, unit: unitA },
      { cells: cellsOf(model, gB.cells), key: 'overlapOther', params: { remB: stB.rem }, unit: unitA, unit2: unitB },
      {
        cells: cellsOf(model, sharedUnd), key: 'overlapShared', unit: unitA, unit2: unitB,
        params: { vals: fmtList(sharedVals), sums: both.join(' / '), remA: stA.rem, remB: stB.rem },
      },
      {
        cells: cellsOf(model, sharedUnd), key: 'combos', unit: unitA,
        params: { vals: fmtList(sharedVals), rem: both.join(' / '), combos: fmt.list, more: fmt.more, count: cf.combos.length },
      },
    ];
    const keep = cf.inAll.length > 0;
    const k = keep ? cf.inAll[0] : cf.inNone[0];
    const ci = sharedUnd[k];
    steps.push({
      cells: [[model.cells[ci].r, model.cells[ci].c]], unit: unitA,
      key: keep ? 'inAllCombos' : 'inNoCombo',
      params: { val: sharedVals[k], count: cf.combos.length },
    });
    steps.push(finalStep(model, ci, keep ? 'kept' : 'removed', unitA));
    return { steps, reason: 'overlap' };
  }
  return null;
}

// ── Fallback (sollte praktisch nie greifen): Käfig der Zielzelle zeigen ──────
function explainFallback(model, st, puzzle) {
  for (let r = 0; r < puzzle.rows; r++) for (let c = 0; c < puzzle.cols; c++) {
    if (st[r][c] !== UNK) continue;
    const want = puzzle.solution[r][c] ? 'kept' : 'removed';
    const g = model.groups.find(gr => gr.kind === 'region' && gr.cells.includes(model.idx(r, c))) || model.groups[r];
    const unit = { kind: g.kind, ref: g.ref };
    return {
      steps: [
        { cells: cellsOf(model, g.cells), key: 'hard', params: {}, unit },
        { cells: [[r, c]], unit, final: true, key: want === 'kept' ? 'concludeKeep' : 'concludeRemove', params: { val: puzzle.values[r][c] }, action: { r, c, want } },
      ],
      reason: 'fallback',
    };
  }
  return null;
}

// Haupteinstieg: liefert { steps, target, reason } oder null (Brett fertig).
export function buildHintTutorial(puzzle, marks) {
  const model = buildModel(puzzle);
  const st = marksToState(marks);
  const found = explainTier1(model, st) || explainTier2(model, st) || explainOverlap(model, st) || explainFallback(model, st, puzzle);
  if (!found) return null;
  const last = found.steps[found.steps.length - 1];
  return { steps: found.steps, target: last.action, reason: found.reason };
}
