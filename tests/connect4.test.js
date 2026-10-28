// Tests für Vier gewinnt: Regeln, Gewinnerkennung, Computer-Gegner. Ausführen mit: node tests/connect4.test.js
global.window = global;
const R = require('path').join(__dirname, '..', 'js') + '/';
require(R + 'state.js');
require(R + 'casino/casino.js');
require(R + 'mp/room.js');
require(R + 'mp/connect4.js');
const V = GK.connect4;
const assert = (cond, msg) => { if (!cond) { console.log('FAIL', msg); process.exitCode = 1; } };
const two = (a = 0.5, b = 0.5) => [{ id: 'a', name: 'A', isBot: true, skill: a }, { id: 'b', name: 'B', isBot: true, skill: b }];

// Gewinnerkennung in alle Richtungen
const lines = { waagerecht: [[0, 0], [1, 0], [2, 0], [3, 0]], senkrecht: [[2, 0], [2, 1], [2, 2], [2, 3]], schräg: [[0, 0], [1, 1], [2, 2], [3, 3]], andersSchräg: [[0, 3], [1, 2], [2, 1], [3, 0]] };
Object.entries(lines).forEach(([name, cells]) => {
  const board = Array.from({ length: 7 }, () => []);
  cells.forEach(([c, r]) => { while (board[c].length < r) board[c].push(1); board[c][r] = 0; });
  const [c, r] = cells[3];
  assert(V.winLine(board, c, r) && V.winLine(board, c, r).length >= 4, 'Gewinn ' + name);
});
// Ungültige Züge
{
  const st = V.create(two());
  const s = st.turn;
  assert(!V.act(st, 1 - s, { type: 'drop', col: 3 }), 'nicht am Zug');
  assert(!V.act(st, s, { type: 'drop', col: 9 }), 'Spalte gibt es nicht');
  for (let i = 0; i < 6; i++) assert(V.act(st, st.turn, { type: 'drop', col: i % 2 ? 3 : 4 }), 'Zug ' + i);
  assert(!V.act(st, st.turn, { type: 'drop', col: 3 }) || st.board[3].length <= 6, 'volle Spalte');
}
// Starker gegen schwachen Computer: der Starke gewinnt meistens; jede Partie endet
let strongWins = 0;
for (let g = 0; g < 16; g++) {
  const strongSeat = g % 2;
  const st = V.create(strongSeat === 0 ? two(1, 0) : two(0, 1));
  let guard = 0;
  while (st.phase !== 'finished' && guard++ < 400) {
    if (st.phase === 'full') { V.advance(st); continue; }
    assert(V.act(st, st.turn, V.botAct(st, st.turn)), 'Computer-Zug gültig');
  }
  assert(st.phase === 'finished', 'Partie beendet');
  if (st.players[strongSeat].place === 1) strongWins++;
}
assert(strongWins >= 11, `starker Computer gewinnt meistens (${strongWins}/16)`);
// Sofortgewinn wird genommen, Sofortverlust verhindert
{
  const st = V.create(two(0.6, 0.6));
  st.turn = 0;
  st.board[0] = [0, 0, 0];
  st.board[1] = [1, 1];
  assert(V.botAct(st, 0).col === 0, 'nimmt den Sieg');
  st.board[0] = [1, 1, 1];
  st.board[1] = [];
  assert(V.botAct(st, 0).col === 0, 'blockt den Gegner');
}
// Aufgeben
{
  const st = V.create(two());
  V.forfeit(st, 0);
  assert(st.phase === 'finished' && st.players[1].place === 1 && st.players[0].place === 2, 'Aufgeben');
}
console.log('Starker Computer gewann', strongWins, 'von 16');
console.log(process.exitCode ? 'Vier-gewinnt-Tests FEHLGESCHLAGEN' : 'Vier-gewinnt-Tests bestanden.');
