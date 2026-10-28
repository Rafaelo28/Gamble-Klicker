// Tests für Mau-Mau: Regeln, Sonderkarten, komplette Partien zwischen Computer-Gegnern, Aufgeben, Ansicht.
// Ausführen mit: node tests/maumau.test.js
global.window = global;
const R = require('path').join(__dirname, '..', 'js') + '/';
require(R + 'state.js');
require(R + 'casino/casino.js');
require(R + 'casino/cards.js');
require(R + 'mp/room.js');
require(R + 'mp/maumau.js');
const M = GK.maumauGame;
const assert = (cond, msg) => { if (!cond) { console.log('FAIL', msg); process.exitCode = 1; } };
const seats = n => Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'Spieler ' + i, isBot: true, skill: (i + 1) / (n + 1) }));
const cardsIn = st => st.deck.length + st.pile.length + st.players.reduce((s, p) => s + p.hand.length, 0);

// Eine Tischsituation von Hand bauen
function table(n, hands, topCard, extra = {}) {
  const st = M.create(seats(n));
  const used = new Set(hands.flat().concat(topCard));
  st.players.forEach((p, i) => { p.hand = hands[i].slice(); });
  st.pile = [topCard];
  st.deck = M.newDeck().filter(c => !used.has(c));
  st.turn = 0;
  return Object.assign(st, { wish: null, pending7: 0, drawn: false }, extra);
}

// ---------- Aufbau ----------
{
  const st = M.create(seats(4));
  assert(cardsIn(st) === 32 && new Set(st.deck.concat(st.pile, ...st.players.map(p => p.hand))).size === 32, '32 verschiedene Karten');
  assert(st.players.every(p => p.hand.length === 5), 'Jeder bekommt 5 Karten');
  assert(!'78J'.includes(st.pile[0][0]), 'Erste offene Karte ist keine Sonderkarte');
}

// ---------- Was passt? ----------
{
  const st = table(2, [['9H', 'KS', 'JC', '9D'], ['7C']], '9S');
  assert(M.playable(st, '9H') && M.playable(st, 'KS') && M.playable(st, 'JC') && M.playable(st, '9D') && !M.playable(st, '7C'), 'Gleicher Wert oder gleiche Farbe, Bube immer');
  assert(!M.playable(table(2, [['QH'], ['7C']], 'KS'), 'QH'), 'Andere Farbe und anderer Wert passen nicht');
  assert(!M.playable(table(2, [['JH'], ['7C']], 'JS'), 'JH'), 'Kein Bube auf einen Buben');
  const w = table(2, [['9H', 'QC'], ['7C']], 'JS', { wish: 'C' });
  assert(M.playable(w, 'QC') && !M.playable(w, '9H'), 'Wunschfarbe muss bedient werden');
  const s = table(2, [['7H', '9S'], ['7C']], '7S', { pending7: 2 });
  assert(M.playable(s, '7H') && !M.playable(s, '9S'), 'Auf eine 7 nur eine 7 (oder ziehen)');
}

// ---------- Sonderkarten ----------
{
  // 7 weitergeben: der Übernächste zieht vier
  const st = table(3, [['7S', 'KH'], ['7H', 'QH'], ['9D', 'AS']], '9S');
  assert(M.act(st, 0, { type: 'play', card: '7S' }) && st.pending7 === 2 && st.turn === 1, '7: der Nächste muss reagieren');
  assert(!M.act(st, 1, { type: 'play', card: 'QH' }), '7: nur eine 7 darf drauf');
  assert(M.act(st, 1, { type: 'play', card: '7H' }) && st.pending7 === 4 && st.turn === 2, '7 weitergegeben');
  assert(M.act(st, 2, { type: 'draw' }) && st.players[2].hand.length === 6 && st.pending7 === 0 && st.turn === 0, 'Vier gezogen, dann ist der Nächste dran');
  // 8: aussetzen
  const e = table(3, [['8S', 'KH'], ['QS'], ['9S']], '9S');
  M.act(e, 0, { type: 'play', card: '8S' });
  assert(e.turn === 2, '8: der Nächste setzt aus');
  const e2 = table(2, [['8S', 'KH'], ['QS']], '9S');
  M.act(e2, 0, { type: 'play', card: '8S' });
  assert(e2.turn === 0, '8 zu zweit: man ist gleich wieder dran');
  // Bube mit Wunsch
  const j = table(2, [['JD', 'KH'], ['QS', 'QC']], '9S');
  assert(!M.act(j, 0, { type: 'play', card: 'JD' }), 'Bube ohne Wunsch abgelehnt');
  assert(M.act(j, 0, { type: 'play', card: 'JD', wish: 'C' }) && j.wish === 'C', 'Bube: Kreuz gewünscht');
  assert(!M.act(j, 1, { type: 'play', card: 'QS' }) && M.act(j, 1, { type: 'play', card: 'QC' }) && j.wish === null, 'Wunsch bedient, danach normal weiter');
  // Ziehen, dann legen oder passen
  const d = table(2, [['QH'], ['KD']], '9S');
  assert(!M.act(d, 0, { type: 'pass' }), 'Passen erst nach dem Ziehen');
  assert(M.act(d, 0, { type: 'draw' }) && d.drawn && d.players[0].hand.length === 2 && d.turn === 0, 'Eine Karte gezogen, noch dran');
  assert(!M.act(d, 0, { type: 'draw' }), 'Nur einmal ziehen');
  assert(M.act(d, 0, { type: 'pass' }) && d.turn === 1 && !d.drawn, 'Passen');
  // Mau-Mau
  const f = table(3, [['KS'], ['QH', 'AH'], ['9D', '9C', 'TC']], '9S');
  assert(M.act(f, 0, { type: 'play', card: 'KS' }) && f.phase === 'finished', 'Letzte Karte gelegt: Mau-Mau');
  assert(f.players[0].place === 1 && f.players[1].place === 2 && f.players[2].place === 3, 'Plätze nach Kartenzahl');
  const g = table(3, [['KS'], ['AH', 'TH'], ['9D', '9C']], '9S');
  M.act(g, 0, { type: 'play', card: 'KS' });
  assert(g.players[2].place === 2 && g.players[1].place === 3, 'Gleich viele Karten: weniger Kartenwert ist besser');
  // Leerer Stapel: Ablage wird neu gemischt
  const r = table(2, [['QH'], ['KD']], '9S');
  r.pile = ['7C', '8C', '9C', '9S'];
  r.deck = [];
  M.act(r, 0, { type: 'draw' });
  assert(r.pile.length === 1 && r.pile[0] === '9S' && r.players[0].hand.length === 2 && r.deck.length === 2, 'Ablage neu gemischt, oberste Karte bleibt');
  assert(cardsIn(r) === 1 + 2 + 2 + 1, 'Keine Karte geht verloren');
}

// ---------- Komplette Partien zwischen Computer-Gegnern ----------
{
  let games = 0;
  let moves = 0;
  let timeouts = 0;
  for (let g = 0; g < 300; g++) {
    const n = 2 + (g % 3);
    const st = M.create(seats(n));
    let steps = 0;
    while (st.phase !== 'finished' && steps++ < 5000) {
      if (g % 12 === 7 && steps === 25) {
        M.forfeit(st, (st.turn + 1) % n);
        continue;
      }
      const seat = st.turn;
      const a = g % 5 === 0 ? M.timeout(st, seat) : M.botAct(st, seat);
      assert(M.act(st, seat, a), `Zug gültig (${JSON.stringify(a)})`);
      if (cardsIn(st) !== 32) {
        assert(false, `Partie ${g}: 32 Karten im Spiel (${cardsIn(st)})`);
        break;
      }
    }
    assert(st.phase === 'finished', `Partie ${g} endet`);
    const places = st.players.map(p => p.place).sort();
    assert(places.join() === Array.from({ length: n }, (_, i) => i + 1).join(), `Partie ${g}: Plätze 1–${n} (${places})`);
    const winner = st.players.find(p => p.place === 1);
    assert(winner.hand.length === 0 || st.players.filter(p => !p.out).length === 1 || st.moves >= 600, `Partie ${g}: Sieger hat keine Karten mehr`);
    moves += st.moves;
    if (g % 5 === 0) timeouts++;
    games++;
  }
  console.log(`Mau-Mau: ${games} Partien, im Schnitt ${(moves / games).toFixed(0)} Züge`);
}

// ---------- Aufgeben und Ansicht ----------
{
  const st = M.create(seats(3));
  const t = st.turn;
  M.forfeit(st, t);
  assert(st.players[t].out && st.players[t].place === 3 && st.turn !== t && cardsIn(st) === 32, 'Aufgeben: Karten unter den Stapel, der Nächste ist dran');
  M.forfeit(st, st.turn);
  assert(st.phase === 'finished' && st.players.filter(p => p.place === 1).length === 1, 'Nur einer übrig: er gewinnt');
  const v0 = M.create(seats(3));
  const v = M.view(v0, 1);
  assert(v.players[1].hand.length === 5 && v.players[0].hand.length === 0 && v.players[0].count === 5, 'Ansicht: nur die eigenen Karten');
  assert(!('deck' in v) && v.deckCount === v0.deck.length && !JSON.stringify(v).includes('skill'), 'Ansicht: kein Stapel, keine Interna');
  const leak = JSON.stringify(v);
  assert(v0.players[0].hand.every(c => !leak.includes(`"${c}"`) || v.pile.includes(c)), 'Fremde Karten tauchen nicht auf');
}

console.log(process.exitCode ? 'Mau-Mau-Tests FEHLGESCHLAGEN' : 'Mau-Mau-Tests bestanden.');
