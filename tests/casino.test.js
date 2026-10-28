// Tests für die Mathematik der Casino-Spiele. Ausführen mit: node tests/casino.test.js
global.window = global;
const R = require('path').join(__dirname, '..', 'js') + '/';
require(R + 'casino/casino.js');
['cards', 'slot-machine', 'scratch', 'wheel', 'plinko', 'mines', 'crash', 'race', 'flight', 'video-slots', 'roulette',
  'hilo', 'tower', 'keno', 'baccarat'].forEach(f => require(R + 'casino/' + f + '.js'));
const assert = (cond, msg) => { if (!cond) { console.log('FAIL', msg); process.exitCode = 1; } };
const between = (x, lo, hi, msg) => assert(x >= lo && x <= hi, `${msg}: ${x}`);
const C = GK.casino;

// Roulette: Kessel mit 0–36, Farben im Wechsel, jede Wette zahlt im Schnitt 36/37 zurück, jede Zahl gleich oft
{
  const M = C.rouletteMath;
  const order = M.WHEEL_ORDER;
  assert(order.length === 37 && new Set(order).size === 37 && order.every(n => n >= 0 && n <= 36) && order[0] === 0, 'Roulette: Kessel mit 0–36');
  assert(M.RED.size === 18 && !M.RED.has(0), 'Roulette: 18 rote Zahlen');
  for (let i = 1; i < 36; i++) assert(M.colorOf(order[i]) !== M.colorOf(order[i + 1]), `Roulette: Farben wechseln bei ${order[i]}`);
  const keys = Object.keys(M.OUTSIDE_BETS).concat(order.map(n => 'n' + n));
  keys.forEach(key => {
    const bet = M.betInfo(key);
    let back = 0;
    for (let r = 0; r <= 36; r++) if (bet.wins(r)) back += bet.mult / 37;
    assert(Math.abs(back - 36 / 37) < 1e-12, `Roulette: Wette ${key} zahlt im Schnitt ${back}`);
  });
  // Zufall: jede Zahl (auch die 0) gleich oft – Chi-Quadrat mit 36 Freiheitsgraden (99,99 %-Grenze ≈ 78)
  const n = 370000;
  const counts = new Array(37).fill(0);
  for (let i = 0; i < n; i++) counts[GK.rng.int(37)]++;
  const chi = counts.reduce((sum, c) => sum + (c - n / 37) ** 2 / (n / 37), 0);
  assert(chi < 85, `Roulette: Zufall gleichmäßig (Chi-Quadrat ${chi.toFixed(1)})`);
  between(counts[0] / n, 0.0255, 0.0286, 'Roulette: Anteil der 0');
}

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

// Flugkapitän: Rechnung und Simulation je Geschwindigkeit, schnellere Flüge zahlen mehr, landen seltener
{
  const F = C.flightMath;
  let lastE = 0;
  let lastLanding = 1;
  Object.keys(F.MODES).forEach(mode => {
    between(F.rtp(mode), 0.965, 0.975, `Flugkapitän ${mode}: Rechnung`);
    assert(F.modeExpectation(mode) > lastE && F.landingChance(mode) < lastLanding, `Flugkapitän ${mode}: schneller = mehr Gewinn, seltener Landung`);
    lastE = F.modeExpectation(mode);
    lastLanding = F.landingChance(mode);
    const n = 200000;
    let total = 0;
    for (let i = 0; i < n; i++) {
      const f = F.makeFlight(mode);
      const [lo, hi] = F.MODES[mode].events;
      if (i < 200) {
        assert(f.events.length >= lo && f.events.length <= hi && f.events[f.events.length - 1].counter === f.counter, `Flugkapitän ${mode}: Flug stimmig`);
        assert(f.events.every((e, k) => k === 0 ? e.at >= 1.5 : e.at > f.events[k - 1].at + 0.7), `Flugkapitän ${mode}: Abstände der Symbole`);
        assert(f.events.every(e => ['add', 'mult', 'div', 'rocket'].includes(e.type)), `Flugkapitän ${mode}: Symbolarten`);
      }
      if (i < 40) {
        // Flugbahn bleibt im Bild, Symbole zum Vorbeifliegen liegen klar neben der Bahn
        const path = F.buildPath(f.events);
        assert(path.alt.every((a, k) => k * 0.02 <= 1 || (a >= F.LOW && a <= F.HIGH)), `Flugkapitän ${mode}: Flugbahn im Korridor`);
        F.buildDecoys(f.events, path).forEach(d => {
          for (let dt = -0.3; dt <= 0.3; dt += 0.05) assert(Math.abs(F.altAt(path, d.at + dt) - d.a) >= 85, `Flugkapitän ${mode}: Symbol neben der Bahn`);
        });
      }
      if (f.landed) total += f.counter;
    }
    between(total / n, 0.9, 1.04, `Flugkapitän ${mode}: Simulation`);
  });
}

// Höher oder tiefer: Chancen, Multiplikator, im Schnitt 97 % – egal wie man tippt und wann man aufhört
{
  const H = C.hiloMath;
  assert(H.chance('2S', 'hi') === 1 && H.chance('AS', 'lo') === 1 && Math.abs(H.chance('7H', 'hi') - 8 / 13) < 1e-12 && Math.abs(H.chance('7H', 'lo') - 6 / 13) < 1e-12, 'Höher oder tiefer: Chancen');
  for (let v = 2; v <= 14; v++) {
    const card = '23456789TJQKA'[v - 2] + 'S';
    assert(Math.abs(H.chance(card, 'hi') + H.chance(card, 'lo') - 14 / 13) < 1e-12, 'Höher oder tiefer: gleich zählt bei beiden');
  }
  assert(H.wins('7H', '7S', 'hi') && H.wins('7H', '7S', 'lo') && H.wins('7H', '9D', 'hi') && !H.wins('7H', '9D', 'lo'), 'Höher oder tiefer: gleich gewinnt immer');
  // Simulation: immer die wahrscheinlichere Seite (2 und Ass werden übersprungen), nach 1–5 Treffern auszahlen
  [1, 3, 5].forEach(stop => {
    const n = 100000;
    let back = 0;
    for (let i = 0; i < n; i++) {
      let card = H.randomCard();
      let prob = 1;
      let steps = 0;
      while (steps < stop) {
        while (H.chance(card, 'hi') >= 1 || H.chance(card, 'lo') >= 1) card = H.randomCard();
        const dir = H.chance(card, 'hi') >= H.chance(card, 'lo') ? 'hi' : 'lo';
        const next = H.randomCard();
        if (!H.wins(card, next, dir)) { prob = 0; break; }
        prob *= H.chance(card, dir);
        card = next;
        steps++;
      }
      if (prob) back += H.multiplier(prob);
    }
    between(back / n, 0.945, 0.99, `Höher oder tiefer: auszahlen nach ${stop} Treffern`);
  });
}

// Mast-Kletterei: Multiplikator je Stufe, morsche Seile richtig verteilt, im Schnitt 97 %
{
  const T = C.towerMath;
  Object.keys(T.MODES).forEach(mode => {
    const m = T.MODES[mode];
    for (let lv = 1; lv <= T.LEVELS; lv++) {
      const r = Math.pow(T.chance(mode), lv) * T.multiplier(mode, lv);
      assert(r <= 0.97 + 1e-9 && r >= 0.955, `Mast-Kletterei ${mode}: Stufe ${lv} zahlt im Schnitt ${r}`);
      assert(T.multiplier(mode, lv) > T.multiplier(mode, lv - 1), `Mast-Kletterei ${mode}: Stufe ${lv} bringt mehr`);
    }
    for (let i = 0; i < 100; i++) {
      const mast = T.makeMast(mode);
      assert(mast.length === T.LEVELS && mast.every(lv => lv.length === m.broken && new Set(lv).size === m.broken && lv.every(x => x >= 0 && x < m.ropes)), `Mast-Kletterei ${mode}: Mast stimmt`);
    }
    // Zufall: jedes Seil reißt gleich oft
    const counts = new Array(m.ropes).fill(0);
    for (let i = 0; i < 20000; i++) T.makeMast(mode)[0].forEach(x => counts[x]++);
    assert(counts.every(c => Math.abs(c / 20000 - m.broken / m.ropes) < 0.02), `Mast-Kletterei ${mode}: alle Seile gleich oft morsch`);
  });
}

// Schatzkarten-Keno: Wahrscheinlichkeiten ergeben 1, jede Tabelle zahlt 94–97 %, Simulation passt
{
  const K = C.kenoMath;
  for (let picks = 1; picks <= 10; picks++) {
    let sum = 0;
    for (let h = 0; h <= picks; h++) sum += K.hitChance(picks, h);
    assert(Math.abs(sum - 1) < 1e-9, `Keno ${picks}: Wahrscheinlichkeiten ergeben 1`);
    between(K.rtp(picks), 0.94, 0.97, `Keno ${picks} Inseln: Rechnung`);
  }
  const n = 100000;
  let back5 = 0;
  let back10 = 0;
  const mine5 = [3, 9, 17, 28, 40];
  const mine10 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  for (let i = 0; i < n; i++) {
    const d = K.draw();
    if (i < 500) assert(d.length === 10 && new Set(d).size === 10 && d.every(x => x >= 1 && x <= 40), 'Keno: 10 verschiedene Inseln gezogen');
    back5 += K.payoutMult(5, mine5.filter(x => d.includes(x)).length);
    back10 += K.payoutMult(10, mine10.filter(x => d.includes(x)).length);
  }
  between(back5 / n, 0.91, 0.99, 'Keno 5 Inseln: Simulation');
  between(back10 / n, 0.88, 1.02, 'Keno 10 Inseln: Simulation');
}

// Baccarat: Regeln für die dritte Karte, Häufigkeiten und Rückzahlung wie im echten Spiel
{
  const B = C.baccaratMath;
  assert(B.points('AS') === 1 && B.points('9H') === 9 && B.points('TD') === 0 && B.points('KC') === 0, 'Baccarat: Punktwerte');
  assert(B.total(['9S', '8H']) === 7 && B.total(['KS', 'QH']) === 0, 'Baccarat: nur die Einerstelle zählt');
  assert(B.bankerDraws(5, null) && !B.bankerDraws(6, null), 'Baccarat: Bank ohne dritte Spielerkarte');
  assert(B.bankerDraws(3, '7S') && !B.bankerDraws(3, '8S') && B.bankerDraws(4, '2S') && !B.bankerDraws(4, 'AS') &&
    B.bankerDraws(5, '4S') && !B.bankerDraws(5, '3S') && B.bankerDraws(6, '6S') && !B.bankerDraws(6, '5S') && !B.bankerDraws(7, '6S'), 'Baccarat: Tabelle der Bank');
  const n = 200000;
  const wins = { player: 0, banker: 0, tie: 0 };
  const back = { player: 0, banker: 0, tie: 0 };
  let shoe = [];
  for (let i = 0; i < n; i++) {
    if (shoe.length < 20) shoe = GK.cards.createDeck(8); // wie im Kasino: ein Schuh für viele Hände
    const h = B.playHand(shoe);
    wins[h.winner]++;
    ['player', 'banker', 'tie'].forEach(c => { back[c] += B.payoutMult(c, h.winner); });
    if (i < 300) {
      assert(h.player.length >= 2 && h.player.length <= 3 && h.banker.length >= 2 && h.banker.length <= 3 && h.order.length === h.player.length + h.banker.length, 'Baccarat: Hand stimmig');
      if (h.natural) assert(h.player.length === 2 && h.banker.length === 2, 'Baccarat: Natural – keine dritte Karte');
    }
  }
  between(wins.banker / n, 0.452, 0.465, 'Baccarat: Bank gewinnt');
  between(wins.player / n, 0.440, 0.452, 'Baccarat: Spieler gewinnt');
  between(wins.tie / n, 0.091, 0.099, 'Baccarat: Unentschieden');
  between(back.player / n, 0.98, 0.995, 'Baccarat: Wette auf Spieler');
  between(back.banker / n, 0.98, 0.997, 'Baccarat: Wette auf Bank');
  between(back.tie / n, 0.82, 0.89, 'Baccarat: Wette auf Unentschieden');
}

// Slot-Maschine (bestehend)
between(GK.slotMachine.rtp(), 0.94, 0.98, 'Slot-Maschine Quote');

console.log(process.exitCode ? 'Casino-Tests FEHLGESCHLAGEN' : 'Casino-Tests bestanden.');
