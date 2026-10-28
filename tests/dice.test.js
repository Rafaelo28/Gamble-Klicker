// Tests für Lügenwürfel: komplette Partien zwischen Computer-Gegnern. Ausführen mit: node tests/dice.test.js
global.window = global;
const R = require('path').join(__dirname, '..', 'js') + '/';
require(R + 'state.js');
require(R + 'casino/casino.js');
require(R + 'mp/room.js');
require(R + 'mp/dice.js');
const D = GK.diceGame;
const assert = (cond, msg) => { if (!cond) { console.log('FAIL', msg); process.exitCode = 1; } };

// Wahrscheinlichkeit
assert(Math.abs(D.atLeast(3, 1, 0.5) - 0.875) < 1e-9, 'atLeast(3,1,½)');
assert(D.atLeast(5, 0, 0.3) === 1 && D.atLeast(2, 3, 0.9) === 0, 'atLeast Grenzen');

const seats = n => Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'Bot ' + i, isBot: true, skill: i / n }));
let rounds = 0;
let challenges = 0;
let liesCaught = 0;
for (let g = 0; g < 200; g++) {
  const n = 2 + (g % 5);
  const dice = g % 2 ? 3 : 5;
  const st = D.create(seats(n), { dice });
  let steps = 0;
  let lastTotal = n * dice;
  while (st.phase !== 'finished' && steps++ < 5000) {
    if (st.phase === 'reveal') {
      challenges++;
      if (st.reveal.loser === st.reveal.bid.seat) liesCaught++;
      // Ergebnis prüfen: gezählt werden die Augenzahl und Einsen
      const actual = st.players.reduce((s, p) => s + p.dice.filter(d => d === st.reveal.bid.f || d === 1).length, 0);
      assert(actual === st.reveal.actual, 'Aufdecken zählt richtig');
      assert((actual >= st.reveal.bid.q) === (st.reveal.loser === st.reveal.challenger), 'richtiger Verlierer');
      D.advance(st);
      rounds++;
      const total = st.players.reduce((s, p) => s + (p.out ? 0 : p.count), 0);
      assert(total === lastTotal - 1 || st.phase === 'finished', 'genau ein Würfel weniger');
      lastTotal = total;
      continue;
    }
    // Gelegentlich gibt jemand auf (Spieler verlässt den Raum)
    if (g % 7 === 0 && Math.random() < 0.01) {
      const alive = st.players.map((p, i) => i).filter(i => !st.players[i].out);
      D.forfeit(st, alive[Math.floor(Math.random() * alive.length)]);
      lastTotal = st.players.reduce((s, p) => s + (p.out ? 0 : p.count), 0);
      continue;
    }
    const seat = st.turn;
    const action = D.botAct(st, seat);
    const before = st.bid ? { ...st.bid } : null;
    assert(D.act(st, seat, action), 'Bot-Aktion gültig: ' + JSON.stringify(action) + ' bei ' + JSON.stringify(before));
    if (action.type === 'bid') assert(!before || action.q > before.q || (action.q === before.q && action.f > before.f), 'Gebot höher');
  }
  assert(st.phase === 'finished', `Partie ${g} beendet (${steps} Schritte)`);
  const places = st.players.map(p => p.place).sort((a, b) => a - b).join(',');
  assert(places === Array.from({ length: n }, (_, i) => i + 1).join(','), `Plätze ${places}`);
}
// Ungültige Aktionen werden abgelehnt
{
  const st = D.create(seats(3), { dice: 5 });
  const s = st.turn;
  assert(!D.act(st, (s + 1) % 3, { type: 'bid', q: 2, f: 3 }), 'nicht am Zug');
  assert(!D.act(st, s, { type: 'challenge' }), 'Lüge ohne Gebot');
  assert(!D.act(st, s, { type: 'bid', q: 2, f: 1 }), 'auf Einsen bieten verboten');
  assert(!D.act(st, s, { type: 'bid', q: 99, f: 4 }), 'mehr Würfel als auf dem Tisch');
  assert(D.act(st, s, { type: 'bid', q: 2, f: 4 }), 'gültiges Gebot');
  assert(!D.act(st, st.turn, { type: 'bid', q: 2, f: 3 }), 'niedriger bieten verboten');
  // Sicht: fremde Würfel verdeckt
  const v = D.view(st, 0);
  assert(v.players[1].dice.every(d => d === 0) && v.players[0].dice.every(d => d > 0), 'fremde Würfel verdeckt');
}
console.log('Runden', rounds, 'Lüge-Rufe', challenges, 'davon erwischt', liesCaught);
console.log(process.exitCode ? 'Lügenwürfel-Tests FEHLGESCHLAGEN' : 'Lügenwürfel-Tests bestanden.');
