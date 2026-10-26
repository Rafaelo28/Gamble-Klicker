// Tests für das Kanonenduell: Flugbahn (muss überall gleich rechnen), Schaden, Regeln, Computer-Gegner.
// Ausführen mit: node tests/cannon.test.js
global.window = global;
const fs = require('fs');
const R = require('path').join(__dirname, '..', 'js') + '/';
require(R + 'casino/casino.js');
require(R + 'mp/room.js');
require(R + 'mp/cannon.js');
const C = GK.cannonDuel;
const assert = (cond, msg) => { if (!cond) { console.log('FAIL', msg); process.exitCode = 1; } };
const bots = (a = 0.6, b = 0.6) => [{ id: 'a', name: 'A', isBot: true, skill: a }, { id: 'b', name: 'B', isBot: true, skill: b }];

// Die Flugbahn nutzt nur Grundrechenarten und Wurzel (keine Winkelfunktionen)
const src = fs.readFileSync(R + 'mp/cannon.js', 'utf8');
['groundAt', 'muzzle', 'hitsShip', 'simulate', 'damage'].forEach(name => {
  const start = src.indexOf(`function ${name}(`);
  const body = src.slice(start, src.indexOf('\n  }\n', start));
  assert(start > 0 && !/Math\.(sin|cos|tan|atan|asin|acos|pow|exp|log|hypot)/.test(body), `${name}: nur + − × ÷ und Wurzel`);
});

// Gleiche Eingabe = gleiche Bahn, auch nach dem Weg über JSON (wie beim Mitspieler)
{
  const st = C.create(bots());
  const copy = JSON.parse(JSON.stringify(st));
  for (let i = 0; i < 200; i++) {
    const ux = Math.random() * 2 - 1;
    const uy = -Math.random();
    const len = Math.sqrt(ux * ux + uy * uy);
    const power = 0.1 + Math.random() * 0.9;
    const wind = Math.round(Math.random() * 20 - 10) / 10;
    const a = C.simulate(st, i % 2, ux / len, uy / len, power, wind, true);
    const b = C.simulate(copy, i % 2, JSON.parse(JSON.stringify(ux / len)), JSON.parse(JSON.stringify(uy / len)), power, wind, true);
    assert(a.x === b.x && a.y === b.y && a.steps === b.steps && a.what === b.what, 'Bahn exakt gleich');
  }
}

// Insel: am Rand Wasserlinie, in der Mitte höher
{
  const st = C.create(bots());
  const isl = st.island;
  assert(C.groundAt(isl, isl[0][0] - 5) === C.SEA && C.groundAt(isl, isl[isl.length - 1][0] + 5) === C.SEA, 'neben der Insel Wasser');
  assert(C.groundAt(isl, isl[3][0]) < C.SEA - 100, 'Inselspitze ragt heraus');
}

// Senkrecht nach oben ohne Wind: die Kugel fällt aufs eigene Schiff zurück
{
  const st = C.create(bots());
  st.turn = 0;
  st.wind = 0;
  assert(C.act(st, 0, { type: 'fire', dx: 0, dy: -1, power: 0.5 }), 'Schuss angenommen');
  assert(st.lastShot.what === 'ship' && st.lastShot.damage[0] === C.DIRECT && st.players[0].hp === C.HP - C.DIRECT, 'Eigentreffer zählt');
  assert(!C.act(st, 0, { type: 'fire', dx: 1, dy: -1, power: 0.5 }), 'während des Flugs kein Schuss');
  C.advance(st);
  assert(st.phase === 'aim' && st.turn === 1, 'danach ist der andere dran');
}

// Ungültige Schüsse
{
  const st = C.create(bots());
  const s = st.turn;
  assert(!C.act(st, 1 - s, { type: 'fire', dx: 1, dy: -1, power: 0.5 }), 'nicht dran');
  assert(!C.act(st, s, { type: 'fire', dx: 0, dy: 0, power: 0.5 }), 'keine Richtung');
  assert(!C.act(st, s, { type: 'fire', dx: 1, dy: NaN, power: 0.5 }), 'keine Zahl');
  assert(!C.act(st, s, { type: 'fire', dx: 1, dy: -1, power: 0 }), 'ohne Kraft');
}

// Beide versenkt: wer geschossen hat, verliert
{
  const st = C.create(bots());
  st.turn = 0;
  st.players[0].hp = 1;
  st.players[1].hp = 1;
  st.phase = 'flying';
  st.lastShot = { seat: 0 };
  st.players[0].hp = 0;
  st.players[1].hp = 0;
  C.advance(st);
  assert(st.phase === 'finished' && st.players[1].place === 1, 'Schütze verliert bei beidseitigem Untergang');
}

// Computer-Gegner: der beste Schuss trifft, und komplette Partien enden
{
  let hits = 0;
  for (let i = 0; i < 40; i++) {
    const st = C.create(bots(1, 1));
    const s = st.turn;
    C.act(st, s, C.botAct(st, s));
    if (st.lastShot.damage[1 - s] > 0) hits++;
  }
  console.log('Starker Computer trifft', hits, 'von 40');
  assert(hits >= 28, 'starker Computer trifft meistens');
}
let strongWins = 0;
for (let g = 0; g < 40; g++) {
  const st = C.create(g % 2 ? bots(1, 0.25) : bots(0.25, 1));
  let guard = 0;
  while (st.phase !== 'finished' && guard++ < 400) {
    if (st.phase === 'flying') { C.advance(st); continue; }
    assert(C.act(st, st.turn, C.botAct(st, st.turn)), 'Computer-Schuss gültig');
  }
  assert(st.phase === 'finished', 'Partie beendet');
  if (st.players[g % 2 ? 0 : 1].place === 1) strongWins++;
}
console.log('Starker Computer gewann', strongWins, 'von 40');
assert(strongWins >= 26, 'starker Computer gewinnt meistens');
// Zeit abgelaufen und Aufgeben
{
  const st = C.create(bots());
  assert(C.act(st, st.turn, C.timeout(st, st.turn)), 'Schuss bei Zeitablauf');
  const st2 = C.create(bots());
  C.forfeit(st2, 0);
  assert(st2.phase === 'finished' && st2.players[1].place === 1, 'Aufgeben');
}
console.log(process.exitCode ? 'Kanonenduell-Tests FEHLGESCHLAGEN' : 'Kanonenduell-Tests bestanden.');
