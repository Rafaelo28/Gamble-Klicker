// Tests für Billard: Aufbau, Physik und komplette Partien. Ausführen mit: node tests/billiards.test.js
global.window = global;
const R = require('path').join(__dirname, '..', 'js') + '/';
require(R + 'casino/casino.js');
require(R + 'mp/room.js');
require(R + 'mp/billiards.js');
const P = GK.billiards;
const assert = (cond, msg) => { if (!cond) { console.log('FAIL', msg); process.exitCode = 1; } };

// Aufbau: 16 verschiedene Kugeln, keine überlappt, die 8 in der Mitte des Dreiecks
for (let k = 0; k < 100; k++) {
  const b = P.rack();
  assert(b.map(x => x.n).sort((a, c) => a - c).join(',') === '0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15', 'alle Kugeln da');
  for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) {
    assert(Math.hypot(b[i].x - b[j].x, b[i].y - b[j].y) >= 2 * P.R - 0.01, 'keine Überlappung');
  }
}
// Gleicher Stoß = gleiches Ergebnis, keine Kugel verlässt den Tisch ohne Loch
for (let k = 0; k < 30; k++) {
  const st = P.create([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }]);
  const a = Math.random() * Math.PI * 2;
  const power = 0.2 + Math.random() * 0.8;
  const r1 = P.simulate(st.balls, Math.cos(a), Math.sin(a), power, true);
  const r2 = P.simulate(st.balls, Math.cos(a), Math.sin(a), power, false);
  assert(JSON.stringify(r1.balls) === JSON.stringify(r2.balls), 'deterministisch (mit und ohne Aufzeichnung)');
  r1.balls.forEach(b => assert(b.potted || (b.x > 30 && b.x < 970 && b.y > 30 && b.y < 470), 'Kugel auf dem Tisch'));
}
// Komplette Partien zwischen Computer-Gegnern
let shots = 0;
for (let g = 0; g < 12; g++) {
  const st = P.create([{ id: 'a', name: 'A', isBot: true, skill: 0.9 }, { id: 'b', name: 'B', isBot: true, skill: 0.4 }]);
  let guard = 0;
  while (st.phase !== 'finished' && guard++ < 500) {
    if (st.phase === 'aim') {
      if (g === 5 && guard === 20) { P.forfeit(st, st.turn); continue; }
      assert(P.act(st, st.turn, P.botAct(st, st.turn)), 'Stoß gültig');
      shots++;
    } else {
      P.advance(st);
    }
  }
  assert(st.phase === 'finished', `Partie ${g} beendet`);
  assert([st.players[0].place, st.players[1].place].sort().join(',') === '1,2', 'Plätze 1 und 2');
}
// Regeln: Foul durch versenkte Weiße gibt Ball in der Hand, ungültige Ablage wird abgelehnt
{
  const st = P.create([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }]);
  const s = st.turn;
  assert(!P.act(st, s, { type: 'shot', dx: 1, dy: 0, power: 0.5, place: [600, 250] }), 'Anstoß nur links der Kopflinie');
  assert(!P.act(st, 1 - s, { type: 'shot', dx: 1, dy: 0, power: 0.5 }), 'nicht am Zug');
  assert(P.act(st, s, { type: 'shot', dx: 1, dy: 0, power: 1, place: [200, 250] }), 'Anstoß');
  P.advance(st);
  // Weiße direkt ins Loch stoßen
  const cue = st.balls.find(b => b.n === 0);
  const t = st.turn;
  st.balls.forEach(b => { if (b.n !== 0) { b.potted = b.n !== 1; if (b.n === 1) { b.x = 500; b.y = 300; } } });
  cue.x = 80; cue.y = 80;
  st.players[t].group = 'solid';
  st.players[1 - t].group = 'stripe';
  assert(P.act(st, t, { type: 'shot', dx: -1, dy: -1, power: 0.6 }), 'Stoß Richtung Loch');
  assert(st.inHand && st.nextTurn === 1 - t, 'Foul: Gegner hat Ball in der Hand');
}
console.log('Stöße', shots);
console.log(process.exitCode ? 'Billard-Tests FEHLGESCHLAGEN' : 'Billard-Tests bestanden.');
