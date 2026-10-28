// Tests für die Preise der Spiele mit Freunden und gegen Computer (Spielräume und Poker).
// Mit Freunden: Computer-Gegner zahlen keinen Eintritt und gewinnen nichts – nur eure Eintritte werden
// nach eurer Reihenfolge verteilt. Ausführen mit: node tests/payouts.test.js
global.window = global;
global.document = { addEventListener() {}, querySelector() { return null; } };
global.location = { search: '', pathname: '/', origin: '', hash: '' };
global.history = { replaceState() {} };
const R = require('path').join(__dirname, '..', 'js') + '/';
require(R + 'casino/casino.js');
require(R + 'mp/room.js');
require(R + 'mp/darts.js');
require(R + 'mp/dice.js');
['evaluator', 'engine', 'ai', 'tournament', 'multiplayer'].forEach(f => require(R + 'poker/' + f + '.js'));
const assert = (cond, msg) => { if (!cond) { console.log('FAIL', msg); process.exitCode = 1; } };
const E = 1000;
const pay = GK.room.payoutFor;
// Spieler: 'h' = Mensch, 'b' = Computer, mit Platz (oder null = noch im Spiel)
const view = list => ({ players: list.map(([kind, place], i) => ({ id: kind + i, name: kind + i, isBot: kind === 'b', place })) });
const friends = game => ({ game, solo: false, entry: E });

// Darts zu zweit mit zwei Computer-Gegnern: der bessere von euch bekommt beide Eintritte, der andere nichts
{
  const v = view([['h', 2], ['b', 1], ['h', 4], ['b', 3]]);
  assert(pay(friends('darts'), v, 0, 2) === 2 * E, 'zu zweit + Computer: besserer Mensch bekommt alles');
  assert(pay(friends('darts'), v, 2, 4) === 0, 'zu zweit + Computer: der andere bekommt nichts');
}
// Ohne Computer-Gegner bleibt alles wie bisher
{
  const v = view([['h', 1], ['h', 2], ['h', 3], ['h', 4]]);
  const got = [0, 1, 2, 3].map(i => pay(friends('darts'), v, i, i + 1));
  assert(got.join() === [2600, 1400, 0, 0].join(), `4 Freunde: ${got}`);
}
// Drei Freunde und ein Computer: 70/30 unter euch
{
  const v = view([['h', 1], ['b', 2], ['h', 3], ['h', 4]]);
  const got = [0, 2, 3].map(i => pay(friends('darts'), v, i, v.players[i].place));
  assert(got.join() === [2100, 900, 0].join(), `3 Freunde + Computer: ${got}`);
}
// Lügenwürfel: wer früh rausfliegt, ist hinter allen, die noch im Spiel sind
{
  const v = view([['h', 4], ['b', null], ['h', null], ['b', null]]);
  assert(pay(friends('dice'), v, 0, 4) === 0, 'früh ausgeschieden: nichts');
  const later = view([['h', 4], ['b', 1], ['h', 3], ['b', 2]]);
  assert(pay(friends('dice'), later, 2, 3) === 2 * E, 'länger durchgehalten als der andere Mensch: alles');
}
// Zufällige Ergebnisse: nie mehr ausgezahlt als eingezahlt, Letzter unter euch bekommt nie mehr als den Eintritt
for (let k = 0; k < 2000; k++) {
  const seats = 2 + Math.floor(Math.random() * 5);
  const humanCount = 2 + Math.floor(Math.random() * (seats - 1));
  const kinds = Array.from({ length: seats }, (_, i) => (i < humanCount ? 'h' : 'b'));
  const places = Array.from({ length: seats }, (_, i) => i + 1).sort(() => Math.random() - 0.5);
  const v = view(kinds.map((kind, i) => [kind, places[i]]));
  const humansIdx = kinds.map((kind, i) => i).filter(i => kinds[i] === 'h');
  const got = humansIdx.map(i => pay(friends('dice'), v, i, places[i]));
  const total = got.reduce((a, b) => a + b, 0);
  assert(total <= humanCount * E && total >= humanCount * E - humanCount, `Summe = Eintritte (${total} bei ${humanCount} Menschen)`);
  const worst = humansIdx.reduce((w, i) => (places[i] > places[w] ? i : w), humansIdx[0]);
  assert(pay(friends('dice'), v, worst, places[worst]) === 0, 'Letzter unter euch geht leer aus');
}
// Gegen Computer: Casino-Tabelle nach dem Platz unter allen
{
  const v = view([['h', 1], ['b', 2], ['b', 3], ['b', 4]]);
  assert(pay({ game: 'darts', solo: true, entry: E }, v, 0, 1) === 3300, 'gegen Computer: Sieger 3,3-fach');
  assert(pay({ game: 'darts', solo: true, entry: E }, v, 0, 2) === 500, 'gegen Computer: Platz 2 halber Einsatz');
}

// Poker mit Freunden: zwei Menschen, vier Computer-Gegner
{
  const T = GK.poker.tournament;
  const seats = [{ id: 'a', name: 'A', isBot: false }, { id: 'b', name: 'B', isBot: false }].concat(T.botSeats(4));
  const mp = GK.poker.mp._payout;
  // Klassisch: Rang unter den Menschen entscheidet
  const t = T.createTable(seats, 'classic');
  t.players.forEach((p, i) => { p.place = [3, 6, 1, 2, 4, 5][i]; p.out = p.place !== 1; });
  t.phase = 'finished';
  assert(mp(t, 0, E) === 2 * E && mp(t, 1, E) === 0, `Poker klassisch: ${mp(t, 0, E)} / ${mp(t, 1, E)}`);
  // Ausgeschieden, während der andere Mensch noch spielt: nichts
  const t2 = T.createTable(seats, 'classic');
  t2.players[0].place = 6; t2.players[0].out = true;
  assert(mp(t2, 0, E) === 0, 'Poker: zuerst ausgeschieden → nichts');
  // Blitz: der Mensch mit mehr Chips bekommt alles, Chips der Computer zählen nicht
  const b = T.createTable(seats, 'blitz', 5);
  b.phase = 'finished';
  b.players.forEach((p, i) => { p.out = false; p.chips = [1500, 900, 4000, 3000, 2000, 1000][i]; });
  assert(mp(b, 0, E) === 2 * E && mp(b, 1, E) === 0, `Poker Blitz: ${mp(b, 0, E)} / ${mp(b, 1, E)}`);
  // Ohne Computer-Gegner wie bisher: Blitz mit 6 Freunden teilt 6 Eintritte unter den besten 4
  const six = T.createTable(['a', 'b', 'c', 'd', 'e', 'f'].map(id => ({ id, name: id, isBot: false })), 'blitz', 5);
  six.phase = 'finished';
  six.players.forEach((p, i) => { p.out = false; p.chips = [4000, 3000, 2000, 1000, 500, 500][i]; });
  const sixPay = six.players.map((p, i) => mp(six, i, E));
  assert(sixPay[4] === 0 && sixPay[5] === 0 && sixPay.reduce((a, c) => a + c, 0) <= 6 * E && sixPay.reduce((a, c) => a + c, 0) >= 6 * E - 6, `Poker Blitz 6 Freunde: ${sixPay}`);
}
console.log(process.exitCode ? 'Preis-Tests FEHLGESCHLAGEN' : 'Preis-Tests bestanden.');
