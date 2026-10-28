// Tests für Minigolf: Physik und komplette Runden zwischen Computer-Gegnern. Ausführen mit: node tests/minigolf.test.js
global.window = global;
const R = require('path').join(__dirname, '..', 'js') + '/';
require(R + 'state.js');
require(R + 'casino/casino.js');
require(R + 'mp/room.js');
require(R + 'mp/minigolf.js');
const G = GK.minigolf;
const assert = (cond, msg) => { if (!cond) { console.log('FAIL', msg); process.exitCode = 1; } };

// Gleicher Schlag = gleiches Ergebnis (wichtig fürs Online-Spiel)
G.HOLES.forEach((h, i) => {
  for (let k = 0; k < 20; k++) {
    const a = Math.random() * Math.PI * 2;
    const dx = Math.cos(a), dy = Math.sin(a), power = 0.1 + Math.random() * 0.9;
    const r1 = G.simulate(h, h.tee, dx, dy, power, true);
    const r2 = G.simulate(h, h.tee, dx, dy, power, false);
    assert(r1.x === r2.x && r1.y === r2.y && r1.holed === r2.holed, `Bahn ${i}: deterministisch`);
    // Ball bleibt auf der Bahn (innerhalb des Randes)
    const xs = h.outline.map(p => p[0]), ys = h.outline.map(p => p[1]);
    assert(r1.x >= Math.min(...xs) && r1.x <= Math.max(...xs) && r1.y >= Math.min(...ys) && r1.y <= Math.max(...ys), `Bahn ${i}: Ball bleibt auf der Bahn`);
  }
});
// Gerader Schlag auf Bahn 3 (Sandbank) geht durch die Lücke ins Loch-Nähe
{
  const h = G.HOLES[2];
  const r = G.simulate(h, h.tee, 1, 0, 0.62, false);
  assert(r.x > 500, 'Sandbank: gerader Schlag kommt durch die Lücke ' + r.x);
}
// Komplette Runden mit 2–4 Computer-Gegnern, auch mit Aufgeben
for (let g = 0; g < 12; g++) {
  const n = 2 + (g % 3);
  const seats = Array.from({ length: n }, (_, i) => ({ id: 'b' + i, name: 'Bot' + i, isBot: true, skill: 0.3 + i * 0.2 }));
  const st = G.create(seats, { holes: g % 2 ? 3 : 6 });
  let guard = 0;
  while (st.phase !== 'finished' && guard++ < 2000) {
    if (st.phase === 'aim') {
      if (g % 4 === 3 && Math.random() < 0.01) G.forfeit(st, st.turn);
      else assert(G.act(st, st.turn, G.botAct(st, st.turn)), 'Schlag gültig');
    } else {
      G.advance(st);
    }
  }
  assert(st.phase === 'finished', `Runde ${g} beendet`);
  const places = st.players.map(p => p.place).sort((a, b) => a - b).join(',');
  assert(places === Array.from({ length: n }, (_, i) => i + 1).join(','), `Plätze ${places}`);
  // Gibt jemand auf und es bleibt nur einer übrig, ist die Runde sofort vorbei: restliche Bahnen bleiben bei 0
  const someoneOut = st.players.some(p => p.out);
  st.players.forEach(p => p.strokes.forEach(s => assert(s >= 1 && s <= 8 || p.out || (s === 0 && someoneOut), 'Schläge pro Bahn 1–8')));
}
// Ungültige Schläge
{
  const st = G.create([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], { holes: 3 });
  assert(!G.act(st, 1, { type: 'shot', dx: 1, dy: 0, power: 0.5 }), 'nicht am Zug');
  assert(!G.act(st, 0, { type: 'shot', dx: 0, dy: 0, power: 0.5 }), 'ohne Richtung');
  assert(!G.act(st, 0, { type: 'shot', dx: 'x', dy: 1, power: 0.5 }), 'Unsinn');
  assert(G.act(st, 0, { type: 'shot', dx: 3, dy: 0, power: 9 }), 'Kraft wird begrenzt');
}
console.log(process.exitCode ? 'Minigolf-Tests FEHLGESCHLAGEN' : 'Minigolf-Tests bestanden.');
