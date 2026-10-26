// Tests für die Mathematik der Casino-Spiele. Ausführen mit: node tests/casino.test.js
global.window = global;
const R = require('path').join(__dirname, '..', 'js') + '/';
require(R + 'casino/casino.js');
['slot-machine', 'scratch', 'wheel', 'plinko', 'mines', 'crash', 'race', 'video-slots'].forEach(f => require(R + 'casino/' + f + '.js'));
const assert = (cond, msg) => { if (!cond) { console.log('FAIL', msg); process.exitCode = 1; } };
const between = (x, lo, hi, msg) => assert(x >= lo && x <= hi, `${msg}: ${x}`);
const C = GK.casino;

// Rubbellose: fast jedes zweite Los gewinnt, Rückzahlung knapp unter dem Einsatz
between(C.scratchRtp(), 0.97, 1.0, 'Rubbellose Quote');

// Glücksrad
between(C.wheelMath.rtp(), 0.94, 0.99, 'Glücksrad Quote');
assert(C.wheelMath.SEGMENTS.reduce((s, x) => s + x.weight, 0) === 100, 'Glücksrad: Felder ergeben 100');

// Münzfall: jede Risikostufe
Object.keys(C.plinkoMath.RISKS).forEach(r => {
  between(C.plinkoMath.rtp(r), 0.97, 0.995, `Münzfall ${r}`);
  const m = C.plinkoMath.RISKS[r].mults;
  assert(m.length === C.plinkoMath.ROWS + 1 && m.every((x, i) => x === m[m.length - 1 - i]), `Münzfall ${r}: symmetrisch`);
});

// Schatzinsel: egal wann man abkassiert, die Quote bleibt gleich
C.minesMath.SKULL_OPTIONS.forEach(k => {
  for (let f = 1; f <= C.minesMath.FIELDS - k; f++) between(C.minesMath.rtp(k, f), 0.95, 0.971, `Schatzinsel ${k}☠️ nach ${f}`);
  assert(C.minesMath.multiplier(k, 1) > 1, `Schatzinsel ${k}☠️: erster Fund > ×1`);
});

// Kanonenkugel: Verteilung der Explosion per Simulation
{
  const n = 400000;
  let at2 = 0, at10 = 0, instant = 0;
  for (let i = 0; i < n; i++) {
    const c = C.crashMath.crashPoint(Math.random());
    if (c > 2) at2 += 2;
    if (c > 10) at10 += 10;
    if (c === 1) instant++;
  }
  between(at2 / n, 0.94, 0.98, 'Kanonenkugel bei ×2');
  between(at10 / n, 0.92, 1.0, 'Kanonenkugel bei ×10');
  between(instant / n, 0.03, 0.05, 'Kanonenkugel: sofort explodiert');
  assert(Math.abs(C.crashMath.multAt(C.crashMath.timeFor(3)) - 3) < 1e-9, 'Kanonenkugel: Zeit ↔ Multiplikator');
}

// Schiffsrennen: Multiplikator × Wahrscheinlichkeit ≤ 0,95, Sieger nach Stärke
for (let k = 0; k < 500; k++) {
  const o = C.raceMath.makeOdds(Math.random);
  assert(Math.abs(o.probs.reduce((a, b) => a + b, 0) - 1) < 1e-9, 'Rennen: Wahrscheinlichkeiten ergeben 1');
  o.probs.forEach((p, i) => between(p * o.mults[i], 0.85, 0.951, 'Rennen: Rückzahlung je Schiff'));
}
{
  const o = C.raceMath.makeOdds(Math.random);
  const wins = [0, 0, 0, 0, 0];
  const n = 100000;
  for (let i = 0; i < n; i++) {
    const order = C.raceMath.drawOrder(o.probs, Math.random);
    assert(order.length === 5 && new Set(order).size === 5, 'Rennen: vollständiger Zieleinlauf');
    wins[order[0]]++;
  }
  wins.forEach((w, i) => assert(Math.abs(w / n - o.probs[i]) < 0.01, `Rennen: Schiff ${i} gewinnt ${w / n} statt ${o.probs[i]}`));
}

// Video-Slots: exakte Quote je Thema, Simulation der Grunddrehungen, höchstens 1 Scatter/Bonus je Walze
{
  const V = GK.videoSlots;
  V.THEMES.forEach(t => between(V.rtp(t).total, 0.93, 0.975, `Video-Slot ${t.id}`));
  const r = V.rtp(V.THEMES[0]);
  const n = 300000;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const g = V.windowAt(V.STRIPS.map(s => Math.floor(Math.random() * s.length)));
    g.forEach(col => assert(col.filter(x => x === 'S' || x === 'B').length <= 1, 'Video-Slot: Scatter/Bonus mit Abstand'));
    sum += V.evaluate(V.THEMES[0], g, 2000).total / 2000;
  }
  between(sum / n, r.line + r.scatter - 0.03, r.line + r.scatter + 0.03, 'Video-Slot: Simulation passt zur Rechnung');
  // Linien-Auswertung
  assert(V.evalLine(['H1', 'H1', 'H1', 'L4', 'L4']).pay === V.PAYS.H1[0], 'Linie: 3× H1');
  assert(V.evalLine(['W', 'W', 'L2', 'L2', 'H1']).count === 4, 'Linie: WILD ersetzt');
  assert(V.evalLine(['W', 'W', 'W', 'W', 'W']).pay === V.PAYS.H1[2], 'Linie: 5× WILD');
  assert(V.evalLine(['W', 'W', 'W', 'L4', 'H2']).sym === 'H1', 'Linie: 3 WILD zahlen mehr als 4× J');
  assert(V.evalLine(['L1', 'S', 'L1', 'L1', 'L1']).pay === 0, 'Linie: Scatter unterbricht');
}

// Slot-Maschine (bestehend)
between(GK.slotMachine.rtp(), 0.94, 0.98, 'Slot-Maschine Quote');

console.log(process.exitCode ? 'Casino-Tests FEHLGESCHLAGEN' : 'Casino-Tests bestanden.');
