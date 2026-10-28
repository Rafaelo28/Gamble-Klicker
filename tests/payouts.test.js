// Tests für die Preise der Spiele mit Freunden und gegen Computer (Spielräume und Poker).
// Mit Freunden: Computer-Gegner zahlen keinen Eintritt. Das Preisgeld sind nur eure Eintritte, verteilt nach
// dem Platz unter allen am Tisch – gewinnt ein Computer-Gegner einen Preis, behält ihn das Casino.
// Ausführen mit: node tests/payouts.test.js
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

// Darts zu zweit mit zwei Computer-Gegnern: 2 Eintritte, verteilt nach Platz unter allen vier (65/35)
{
  const room = view([['h', 1], ['b', 2], ['h', 3], ['b', 4]]);
  assert(pay(friends('darts'), room, 0, 1) === 1300, 'zu zweit + Computer: Sieger bekommt 1.300');
  assert(pay(friends('darts'), room, 2, 3) === 0, 'zu zweit + Computer: Platz 3 bekommt nichts');
  const v = view([['h', 2], ['b', 1], ['h', 4], ['b', 3]]);
  assert(pay(friends('darts'), v, 0, 2) === 700, 'Computer gewinnt: Mensch auf Platz 2 bekommt 700');
  assert(pay(friends('darts'), v, 2, 4) === 0, 'Computer gewinnt: Letzter bekommt nichts');
}
// Ohne Computer-Gegner bleibt alles wie bisher
{
  const v = view([['h', 1], ['h', 2], ['h', 3], ['h', 4]]);
  const got = [0, 1, 2, 3].map(i => pay(friends('darts'), v, i, i + 1));
  assert(got.join() === [2600, 1400, 0, 0].join(), `4 Freunde: ${got}`);
}
// Drei Freunde und ein Computer auf Platz 2: der Sieger bekommt 65 % von 3 Eintritten, der Rest bleibt im Casino
{
  const v = view([['h', 1], ['b', 2], ['h', 3], ['h', 4]]);
  const got = [0, 2, 3].map(i => pay(friends('darts'), v, i, v.players[i].place));
  assert(got.join() === [1950, 0, 0].join(), `3 Freunde + Computer: ${got}`);
}
// Lügenwürfel: wer früh rausfliegt, ist hinter allen, die noch im Spiel sind
{
  const v = view([['h', 4], ['b', null], ['h', null], ['b', null]]);
  assert(pay(friends('dice'), v, 0, 4) === 0, 'früh ausgeschieden: nichts');
  const later = view([['h', 2], ['b', 1], ['h', 3], ['b', 4]]);
  assert(pay(friends('dice'), later, 0, 2) === 700, 'hinter einem Computer: Preis für Platz 2');
}
// Zufällige Ergebnisse: nie mehr ausgezahlt als eingezahlt, Preise nur für die vorderen Plätze
for (let k = 0; k < 2000; k++) {
  const seats = 2 + Math.floor(Math.random() * 5);
  const humanCount = 2 + Math.floor(Math.random() * (seats - 1));
  const kinds = Array.from({ length: seats }, (_, i) => (i < humanCount ? 'h' : 'b'));
  const places = Array.from({ length: seats }, (_, i) => i + 1).sort(() => Math.random() - 0.5);
  const v = view(kinds.map((kind, i) => [kind, places[i]]));
  const got = kinds.map((kind, i) => pay(friends('dice'), v, i, places[i]));
  const total = got.reduce((a, b) => a + b, 0);
  // Alle Preise zusammen (auch die der Computer) sind genau die Eintritte der Menschen
  assert(total <= humanCount * E && total >= humanCount * E - seats, `Summe = Eintritte (${total} bei ${humanCount} Menschen)`);
  const paidPlaces = GK.room.prizeShares(seats).length;
  kinds.forEach((kind, i) => assert(places[i] <= paidPlaces || got[i] === 0, 'hinten gibt es nichts'));
  assert(got.every((g, i) => places[i] === 1 || g < humanCount * E), 'nur der Sieger kann (fast) alles bekommen');
}
// Gegen Computer: Casino-Tabelle nach dem Platz unter allen
{
  const v = view([['h', 1], ['b', 2], ['b', 3], ['b', 4]]);
  assert(pay({ game: 'darts', solo: true, entry: E }, v, 0, 1) === 3300, 'gegen Computer: Sieger 3,3-fach');
  assert(pay({ game: 'darts', solo: true, entry: E }, v, 0, 2) === 500, 'gegen Computer: Platz 2 halber Einsatz');
}

// Poker mit Freunden: zwei Menschen, vier Computer-Gegner – 2 Eintritte, verteilt nach Platz unter allen sechs
{
  const T = GK.poker.tournament;
  const seats = [{ id: 'a', name: 'A', isBot: false }, { id: 'b', name: 'B', isBot: false }].concat(T.botSeats(4));
  const mp = GK.poker.mp._payout;
  // Klassisch: Platz 1/2/3 bekommen 50/30/20 % von 2.000
  const t = T.createTable(seats, 'classic');
  t.players.forEach((p, i) => { p.place = [3, 6, 1, 2, 4, 5][i]; p.out = p.place !== 1; });
  t.phase = 'finished';
  assert(mp(t, 0, E) === 400 && mp(t, 1, E) === 0, `Poker klassisch: ${mp(t, 0, E)} / ${mp(t, 1, E)}`);
  assert(mp(t, 2, E) === 1000 && mp(t, 3, E) === 600, `Poker klassisch, Computer: ${mp(t, 2, E)} / ${mp(t, 3, E)}`);
  // Blitz: die besten 4 am Tisch teilen 2.000 nach Chips, auch Computer-Gegner
  const b = T.createTable(seats, 'blitz', 5);
  b.phase = 'finished';
  b.players.forEach((p, i) => { p.out = false; p.chips = [1500, 900, 4000, 3000, 2000, 1000][i]; });
  const bPay = b.players.map((p, i) => mp(b, i, E));
  assert(bPay[0] === Math.floor(2 * E * 1500 / 10500) && bPay[1] === 0, `Poker Blitz: ${bPay}`);
  assert(bPay.reduce((a, c) => a + c, 0) <= 2 * E, `Poker Blitz: nie mehr als die Eintritte (${bPay})`);
  // Ohne Computer-Gegner wie bisher: Blitz mit 6 Freunden teilt 6 Eintritte unter den besten 4
  const six = T.createTable(['a', 'b', 'c', 'd', 'e', 'f'].map(id => ({ id, name: id, isBot: false })), 'blitz', 5);
  six.phase = 'finished';
  six.players.forEach((p, i) => { p.out = false; p.chips = [4000, 3000, 2000, 1000, 500, 500][i]; });
  const sixPay = six.players.map((p, i) => mp(six, i, E));
  assert(sixPay[4] === 0 && sixPay[5] === 0 && sixPay.reduce((a, c) => a + c, 0) <= 6 * E && sixPay.reduce((a, c) => a + c, 0) >= 6 * E - 6, `Poker Blitz 6 Freunde: ${sixPay}`);
}
console.log(process.exitCode ? 'Preis-Tests FEHLGESCHLAGEN' : 'Preis-Tests bestanden.');
