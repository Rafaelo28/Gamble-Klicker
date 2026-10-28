// Tests für Darts in der Taverne: Wertung, Ablauf, Stechen, Aufgeben. Ausführen mit: node tests/darts.test.js
global.window = global;
const R = require('path').join(__dirname, '..', 'js') + '/';
require(R + 'state.js');
require(R + 'casino/casino.js');
require(R + 'mp/room.js');
require(R + 'mp/darts.js');
const D = GK.darts;
const assert = (cond, msg) => { if (!cond) { console.log('FAIL', msg); process.exitCode = 1; } };
const bots = (n, skill = 0.6) => Array.from({ length: n }, (_, i) => ({ id: 'b' + i, name: 'B' + i, isBot: true, skill }));

// Wertung (y zeigt nach unten, oben ist die 20)
const cases = [[0, 0, 50], [0.06, 0, 25], [0, -0.3, 20], [D.T20.x, D.T20.y, 60], [0, -0.975, 40], [0.3, 0, 6], [-0.3, 0, 11], [0, 0.3, 3], [0, -1.1, 0]];
cases.forEach(([x, y, p]) => assert(D.score(x, y).points === p, `Wertung (${x}, ${y}) = ${p}, nicht ${D.score(x, y).points}`));
D.SECTORS.forEach((n, i) => {
  const a = (i * 18 - 90) * Math.PI / 180;
  assert(D.score(Math.cos(a) * 0.4, Math.sin(a) * 0.4).points === n, `Feld ${n}`);
  assert(D.score(Math.cos(a) * 0.605, Math.sin(a) * 0.605).label === 'T' + n, `Dreifach ${n}`);
});

// Komplette Partien: 2–4 Spieler, alle Rundenzahlen, eindeutige Plätze
for (const n of [2, 3, 4]) {
  for (const rounds of [3, 5, 8]) {
    const st = D.create(bots(n), { rounds });
    let guard = 0;
    while (st.phase !== 'finished' && guard++ < 500) {
      if (st.phase === 'show') { D.advance(st); continue; }
      const seat = st.order[st.idx];
      assert(D.act(st, seat, D.botAct(st, seat)), 'Wurf gültig');
    }
    assert(st.phase === 'finished', `${n} Spieler, ${rounds} Runden: beendet`);
    const places = st.players.map(p => p.place).sort().join(',');
    assert(places === Array.from({ length: n }, (_, i) => i + 1).join(','), `Plätze ${places}`);
    st.players.forEach(p => {
      assert(p.turns.length >= rounds, 'jeder hat alle Runden geworfen');
      assert(p.turns.reduce((a, b) => a + b, 0) === p.score, 'Punkte = Summe der Runden');
    });
    const winner = st.players.find(p => p.place === 1);
    assert(st.players.every(p => p.score <= winner.score), 'Sieger hat die meisten Punkte');
  }
}

// Ungültige Würfe
{
  const st = D.create(bots(2), { rounds: 3 });
  const seat = st.order[0];
  assert(!D.act(st, 1 - seat, { type: 'throw', x: 0, y: 0 }), 'nicht dran');
  assert(!D.act(st, seat, { type: 'throw', x: NaN, y: 0 }), 'keine Zahl');
  for (let i = 0; i < 3; i++) D.act(st, seat, { type: 'throw', x: 0, y: -0.3 });
  assert(st.phase === 'show' && !D.act(st, seat, { type: 'throw', x: 0, y: 0 }), 'nach 3 Pfeilen ist Schluss');
  assert(Math.abs(st.players[seat].darts[0].x) < 0.4, 'Streuung bleibt im Rahmen');
}

// Stechen bei Gleichstand an der Spitze
{
  const st = D.create(bots(3), { rounds: 3 });
  st.round = 3;
  st.idx = 2;
  st.phase = 'show';
  st.players.forEach((p, i) => { p.score = i === 2 ? 50 : 100; });
  D.advance(st);
  assert(st.shootout === 1 && st.phase === 'throw' && st.order.length === 2 && !st.order.includes(2), 'Stechen nur für die Führenden');
}

// Aufgeben: wer dran ist, wird übersprungen; bleibt einer übrig, gewinnt er
{
  const st = D.create(bots(3), { rounds: 3 });
  const first = st.order[0];
  D.forfeit(st, first);
  assert(st.players[first].place === 3 && st.phase === 'throw' && st.order[st.idx] !== first, 'Aufgeben: der Nächste ist dran');
  D.forfeit(st, st.order[st.idx]);
  assert(st.phase === 'finished' && st.players.filter(p => p.place === 1).length === 1, 'Letzter übrig = Sieger');
}

// Starke Werfer schlagen schwache meistens
let strongWins = 0;
for (let g = 0; g < 40; g++) {
  const st = D.create([{ id: 'a', name: 'A', isBot: true, skill: 1 }, { id: 'b', name: 'B', isBot: true, skill: 0.25 }], { rounds: 5 });
  while (st.phase !== 'finished') {
    if (st.phase === 'show') { D.advance(st); continue; }
    const seat = st.order[st.idx];
    D.act(st, seat, D.botAct(st, seat));
  }
  if (st.players[0].place === 1) strongWins++;
}
console.log('Starker Werfer gewann', strongWins, 'von 40');
assert(strongWins >= 28, 'starker Werfer gewinnt meistens');
// Kein sicherer Gewinn: auch perfekt gezielt (ohne Zittern) bringt die Streuung nicht mehr als die
// besten Computer-Gegner – egal ob auf die Dreifach-20 oder die Mitte
{
  const st = D.create(bots(2), { rounds: 8 });
  const avg = (aim, n = 6000) => {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      st.phase = 'throw'; st.idx = 0; st.players[st.order[0]].darts = [];
      D.act(st, st.order[0], { type: 'throw', x: aim.x, y: aim.y });
      sum += st.lastDart.points;
    }
    return sum / n;
  };
  const t20 = avg(D.T20);
  const bull = avg({ x: 0, y: 0 });
  st.players[st.order[0]].skill = 0.8;
  let best = 0;
  for (let i = 0; i < 6000; i++) {
    st.phase = 'throw'; st.idx = 0; st.players[st.order[0]].darts = [];
    D.act(st, st.order[0], D.botAct(st, st.order[0]));
    best += st.lastDart.points;
  }
  best /= 6000;
  console.log('Punkte pro Pfeil – perfekt auf T20', t20.toFixed(1), 'perfekt auf die Mitte', bull.toFixed(1), 'bester Computer', best.toFixed(1));
  assert(t20 < 28 && bull < 28, 'perfektes Zielen bringt keine Traumwerte');
  assert(best > t20 - 3, 'die besten Computer-Gegner halten mit');
}

// Gegen Computer: nur der Sieger macht Gewinn, bei gleich starken Gegnern fließen 95 % zurück
for (let n = 2; n <= 6; n++) {
  const prizes = [1, 2, 3, 4, 5, 6].slice(0, n).map(place => GK.room.prize(place, 1000, n, true));
  const total = prizes.reduce((a, b) => a + b, 0);
  assert(Math.abs(total / n - 950) <= 1, `gegen Computer ${n} Spieler: Rückfluss ${total / n / 10} %`);
  assert(prizes[0] > 1000 && prizes.slice(1).every(p => p < 1000), `gegen Computer ${n} Spieler: nur Platz 1 im Plus (${prizes})`);
  // Mit Freunden bleibt alles beim Alten: alle Eintritte werden verteilt
  const friends = [1, 2, 3, 4, 5, 6].slice(0, n).reduce((s, place) => s + GK.room.prize(place, 1000, n, false), 0);
  assert(friends === 1000 * n, `mit Freunden ${n} Spieler: Preisgeld = Eintritte`);
}
console.log(process.exitCode ? 'Darts-Tests FEHLGESCHLAGEN' : 'Darts-Tests bestanden.');
