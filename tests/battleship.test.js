// Tests für die Seeschlacht: Flotte, Regeln, geheime Ansicht, Computer-Gegner. Ausführen mit: node tests/battleship.test.js
global.window = global;
const R = require('path').join(__dirname, '..', 'js') + '/';
require(R + 'state.js');
require(R + 'casino/casino.js');
require(R + 'mp/room.js');
require(R + 'mp/battleship.js');
const B = GK.battleship;
const assert = (cond, msg) => { if (!cond) { console.log('FAIL', msg); process.exitCode = 1; } };
const seats = (a, b, botA = true, botB = true) => [{ id: 'a', name: 'A', isBot: botA, skill: a }, { id: 'b', name: 'B', isBot: botB, skill: b }];
const fleet = list => list.map(([x, y, v], i) => ({ x, y, v, len: B.FLEET[i].len }));

// Flotte: zufällig immer gültig; Berühren, Überschneiden, Rand und falsche Längen werden abgelehnt
for (let i = 0; i < 500; i++) assert(B.validFleet(B.randomFleet()), 'Zufallsflotte gültig');
const good = fleet([[0, 0, false], [0, 2, false], [0, 4, false], [0, 6, false], [0, 8, false]]);
assert(B.validFleet(good), 'Flotte untereinander mit Abstand');
assert(!B.validFleet(fleet([[0, 0, false], [0, 1, false], [0, 4, false], [0, 6, false], [0, 8, false]])), 'Schiffe dürfen sich nicht berühren');
assert(!B.validFleet(fleet([[0, 0, false], [5, 1, false], [0, 4, false], [0, 6, false], [0, 8, false]])), 'auch nicht schräg');
assert(!B.validFleet(fleet([[6, 0, false], [0, 2, false], [0, 4, false], [0, 6, false], [0, 8, false]])), 'nicht über den Rand');
assert(!B.validFleet(good.slice(0, 4)), 'genau fünf Schiffe');
assert(!B.validFleet(good.map((s, i) => (i === 4 ? { ...s, len: 3 } : s))), 'richtige Längen');

// Aufstellen und Bereit
{
  const st = B.create(seats(0.5, 0.5, false, false));
  assert(st.phase === 'place', 'Menschen stellen erst auf');
  assert(!B.act(st, 0, { type: 'place', ships: fleet([[0, 0, false], [0, 1, false], [0, 4, false], [0, 6, false], [0, 8, false]]) }), 'ungültige Flotte abgelehnt');
  assert(B.act(st, 0, { type: 'place', ships: good }) && st.players[0].ships[0].x === 0, 'gültige Flotte übernommen');
  assert(!B.act(st, 0, { type: 'fire', x: 0, y: 0 }), 'beim Aufstellen wird nicht geschossen');
  assert(B.act(st, 0, { type: 'ready' }) && st.phase === 'place', 'einer bereit');
  assert(!B.act(st, 0, { type: 'place', ships: good }), 'nach Bereit nichts mehr ändern');
  assert(B.act(st, 1, { type: 'ready' }) && st.phase === 'battle', 'beide bereit = Schlacht');
  const st2 = B.create(seats(0.5, 0.5, false, false));
  B.advance(st2);
  assert(st2.phase === 'battle', 'Zeit um = Schlacht beginnt');
  assert(B.create(seats(0.5, 0.5)).phase === 'battle', 'nur Computer: sofort los');
}

// Schießen: Treffer = nochmal, Wasser = Wechsel, doppelt und fremder Zug abgelehnt, Versenken, Sieg
{
  const st = B.create(seats(0.5, 0.5));
  st.turn = 0;
  st.players[1].ships = good.map(s => ({ ...s, sunk: false }));
  assert(!B.act(st, 1, { type: 'fire', x: 5, y: 5 }), 'nicht dran');
  assert(B.act(st, 0, { type: 'fire', x: 0, y: 0 }) && st.turn === 0 && st.lastShot.hit, 'Treffer: nochmal');
  assert(!B.act(st, 0, { type: 'fire', x: 0, y: 0 }), 'gleiches Feld nicht zweimal');
  assert(!B.act(st, 0, { type: 'fire', x: 10, y: 0 }), 'außerhalb');
  assert(B.act(st, 0, { type: 'fire', x: 9, y: 9 }) && st.turn === 1 && !st.lastShot.hit, 'Wasser: Wechsel');
  // Geheime Ansicht: Spieler 0 sieht von Spieler 1 nur versenkte Schiffe
  let v = B.view(st, 0);
  assert(v.players[1].ships.length === 0 && v.players[0].ships.length === 5, 'gegnerische Schiffe verborgen');
  st.turn = 0;
  for (let x = 1; x < 5; x++) B.act(st, 0, { type: 'fire', x, y: 0 });
  assert(st.players[1].ships[0].sunk && st.lastShot.sunk === 'Flaggschiff', 'Flaggschiff versenkt');
  v = B.view(st, 0);
  assert(v.players[1].ships.length === 1 && v.players[1].sunk[0], 'versenktes Schiff wird gezeigt');
  good.slice(1).forEach(s => B.cells(s).forEach(([x, y]) => B.act(st, 0, { type: 'fire', x, y })));
  assert(st.phase === 'finished' && st.players[0].place === 1 && st.players[1].place === 2, 'alle versenkt = Sieg');
  assert(B.view(st, 0).players[1].ships.length === 5, 'am Ende wird alles aufgedeckt');
}

// Computer-Gegner: Schüsse bis zur versenkten Flotte (allein gegen eine Zufallsflotte)
function shotsToWin(skill) {
  const st = B.create(seats(skill, 0.5));
  st.turn = 0;
  let shots = 0;
  while (st.phase !== 'finished' && shots < 100) {
    st.turn = 0;
    assert(B.act(st, 0, B.botAct(st, 0)), 'Computer-Schuss gültig');
    shots++;
  }
  return shots;
}
const avg = (skill, n) => { let s = 0; for (let i = 0; i < n; i++) s += shotsToWin(skill); return s / n; };
const strong = avg(1, 120);
const weak = avg(0.25, 120);
console.log('Schüsse bis zum Sieg – stark', strong.toFixed(1), 'schwach', weak.toFixed(1));
assert(strong < 55, 'starker Computer braucht wenig Schüsse');
assert(weak > strong + 3, 'schwacher Computer braucht mehr Schüsse');
// Komplette Partien: jede endet, der Starke gewinnt meistens
let strongWins = 0;
for (let g = 0; g < 40; g++) {
  const st = B.create(g % 2 ? seats(1, 0.25) : seats(0.25, 1));
  let guard = 0;
  while (st.phase !== 'finished' && guard++ < 250) assert(B.act(st, st.turn, B.botAct(st, st.turn)), 'Zug gültig');
  assert(st.phase === 'finished', 'Partie beendet');
  if (st.players[g % 2 ? 0 : 1].place === 1) strongWins++;
}
console.log('Starker Computer gewann', strongWins, 'von 40');
assert(strongWins >= 24, 'starker Computer gewinnt meistens');
// Aufgeben
{
  const st = B.create(seats(0.5, 0.5, false, false));
  B.forfeit(st, 1);
  assert(st.phase === 'finished' && st.players[0].place === 1 && st.players[1].out, 'Aufgeben');
}
console.log(process.exitCode ? 'Seeschlacht-Tests FEHLGESCHLAGEN' : 'Seeschlacht-Tests bestanden.');
