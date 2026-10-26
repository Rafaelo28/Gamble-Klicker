// Tests für Poker-Handbewertung und Spiel-Engine. Ausführen mit: node tests/poker.test.js
global.window = global;
const R = require('path').join(__dirname, '..', 'js') + '/';
require(R + 'casino/casino.js'); require(R + 'casino/cards.js');
require(R + 'poker/evaluator.js'); require(R + 'poker/engine.js'); require(R + 'poker/ai.js');
require(R + 'poker/tournament.js');
const ev = c => GK.poker.evaluate(c.split(' '));
const assert = (cond, msg) => { if (!cond) { console.log('FAIL', msg); process.exitCode = 1; } };
// Handbewertung: bekannte Hände
const cases = [
  ['AS KS QS JS TS 2H 3D', 'Royal Flush'], ['5S 4S 3S 2S AS KH KD', 'Straight Flush'],
  ['9H 9D 9S 9C 2H 3D 4C', 'Vierling'], ['9H 9D 9S 2C 2H 3D 4C', 'Full House'],
  ['9H 9D 9S 2C 2H 2D 4C', 'Full House'], ['AH 3H 7H 9H JH 2D 4C', 'Flush'],
  ['AH 2D 3C 4S 5H KD KC', 'Straße'], ['TH JD QC KS AH 2D 2C', 'Straße'],
  ['7H 7D 7C KS 2H 3D 9C', 'Drilling'], ['7H 7D KC KS 2H 3D 9C', 'Zwei Paare'],
  ['7H 7D KC 4S 2H 3D 9C', 'Ein Paar'], ['7H 8D KC 4S 2H 3D TC', 'Höchste Karte'],
];
cases.forEach(([c, name]) => assert(ev(c).name === name, `${c} -> ${ev(c).name} (erwartet ${name})`));
assert(ev('AH AD KC 4S 2H').score > ev('AH AD QC JS TH').score, 'Kicker');
assert(ev('6H 5D 4C 3S 2H').score > ev('5H 4D 3C 2S AH').score, '6-high straight > wheel');
assert(ev('KH KD QC QS 3H').score > ev('KH KD 2C 2S AH').score, 'two pair compare');
assert(ev('AH AD 3C 3S 2H 2D KC').score === ev('AS AC 3H 3D KD 7C 6C').score, 'two pair kicker from third pair');

// 30 komplette Bot-Turniere: Chips dürfen nie verloren gehen, Plätze müssen 1–6 sein
const levels = [[10,20],[15,30],[25,50],[50,100],[75,150],[100,200],[150,300],[200,400],[300,600],[500,1000],[800,1600],[1000,2000],[1500,3000],[2000,4000]].map(([sb,bb])=>({sb,bb}));
let hands = 0, t0 = Date.now(), showdowns = 0, splitPots = 0;
for (let n = 0; n < 30; n++) {
  const bots = GK.poker.ai.BOTS;
  const t = GK.poker.engine.createTable({ seats: bots.map((b,i)=>({id:'b'+i,name:b.name,isBot:true,personality:b.personality})), startChips: 1500, blindLevels: levels, handsPerLevel: 8 });
  let guard = 0;
  while (t.phase !== 'finished' && guard++ < 1000) {
    GK.poker.engine.startHand(t); hands++;
    let steps = 0;
    while (t.phase === 'betting' && steps++ < 500) {
      const total = t.players.reduce((s,p)=>s+p.chips+p.total,0);
      assert(total === 9000, 'chips during hand ' + total);
      JSON.parse(JSON.stringify(t)); // speicherbar
      GK.poker.engine.act(t, GK.poker.ai.decide(t));
    }
    assert(t.phase !== 'betting', 'hand did not finish');
    const total = t.players.reduce((s,p)=>s+p.chips,0);
    assert(total === 9000, 'chips after hand ' + total);
    if (t.result.showdown) showdowns++;
    if (t.result.winners.length > 1) splitPots++;
    t.players.forEach(p => assert(p.chips >= 0, 'negative chips'));
  }
  const places = t.players.map(p=>p.place).sort();
  assert(JSON.stringify(places) === '[1,2,3,4,5,6]', 'places ' + places + ' guard ' + guard);
}
if (!process.exitCode) console.log('Alle Tests bestanden.');
console.log('hands', hands, 'avg per tournament', hands/30, 'showdowns', showdowns, 'multi-winner', splitPots, 'ms', Date.now()-t0);
// Equity-Plausibilität
console.log('AA vs 1', GK.poker.ai.equity(['AS','AH'], [], 1, 3000).toFixed(2), '72o vs 1', GK.poker.ai.equity(['7S','2H'], [], 1, 3000).toFixed(2), 'AA vs 5', GK.poker.ai.equity(['AS','AH'], [], 5, 3000).toFixed(2));

// Turniere, in denen zufällig Spieler aufgeben (z. B. Mitspieler verlässt den Raum):
// Das Spiel muss für die anderen weiterlaufen und mit eindeutigen Plätzen enden.
for (let n = 0; n < 40; n++) {
  const t = GK.poker.tournament.createTable(GK.poker.tournament.botSeats(2 + (n % 5)));
  const count = t.players.length;
  let guard = 0;
  while (t.phase !== 'finished' && guard++ < 2000) {
    if (t.phase !== 'betting') GK.poker.engine.startHand(t);
    if (t.phase !== 'betting') continue;
    if (Math.random() < 0.05) {
      const seat = Math.floor(Math.random() * count);
      GK.poker.engine.forfeit(t, seat);
      continue;
    }
    GK.poker.engine.act(t, GK.poker.ai.decide(t));
    t.players.forEach(p => assert(p.chips >= 0, 'negative chips after forfeit'));
  }
  assert(t.phase === 'finished', 'forfeit tournament did not finish');
  const places = t.players.map(p => p.place).sort((a, b) => a - b).join(',');
  assert(places === Array.from({ length: count }, (_, i) => i + 1).join(','), 'forfeit places ' + places);
}
// Preise: Summe aller Preise = alle Eintritte, bei 6 Spielern 3× / 1,8× / 1,2×
for (let players = 2; players <= 6; players++) {
  const sum = [1, 2, 3, 4, 5, 6].reduce((s, place) => s + GK.poker.tournament.prize(place, 1000, players), 0);
  assert(sum === 1000 * players, `prize sum ${players}: ${sum}`);
}
assert(GK.poker.tournament.prize(1, 1000, 6) === 3000 && GK.poker.tournament.prize(3, 1000, 6) === 1200, 'prize 6 players');
console.log(process.exitCode ? 'Forfeit-/Preis-Tests FEHLGESCHLAGEN' : 'Forfeit- und Preis-Tests bestanden.');

// Turbo-Modus: weniger Chips, Blinds steigen schneller – Turniere müssen deutlich kürzer sein
const T = GK.poker.tournament;
function playOut(modeId) {
  const t = T.createTable(T.botSeats(6), modeId);
  let guard = 0;
  while (t.phase !== 'finished' && guard++ < 1000) {
    GK.poker.engine.startHand(t);
    while (t.phase === 'betting') GK.poker.engine.act(t, GK.poker.ai.decide(t));
  }
  const total = t.players.reduce((s, p) => s + p.chips, 0);
  assert(total === 6 * T.mode(modeId).startChips, `${modeId}: chips ${total}`);
  assert(t.mode === modeId, `${modeId}: Modus am Tisch gespeichert`);
  return t.handNo;
}
const RUNS = 12;
let classicHands = 0, turboHands = 0;
for (let n = 0; n < RUNS; n++) { classicHands += playOut('classic'); turboHands += playOut('turbo'); }
assert(turboHands < classicHands * 0.6, `Turbo nicht schneller: ${turboHands} vs ${classicHands}`);
assert(T.mode('gibtsnicht').id === 'classic' && T.mode(undefined).id === 'classic', 'unbekannter Modus = klassisch');
console.log('Hände pro Turnier – klassisch', (classicHands / RUNS).toFixed(1), 'turbo', (turboHands / RUNS).toFixed(1));

// ICM (anteilige Auszahlung beim Aussteigen)
const near = (a, b, msg) => assert(Math.abs(a - b) < 1e-6, `${msg}: ${a} statt ${b}`);
const prizes6 = [3000, 1800, 1200];
const sum = a => a.reduce((s, x) => s + x, 0);
let eq = T.icm([1500, 1500, 1500, 1500, 1500, 1500], prizes6);
eq.forEach(e => near(e, 1000, 'gleiche Stacks = Eintritt zurück'));
eq = T.icm([5000, 2000, 1000, 500, 500, 0], prizes6);
near(sum(eq), 6000, 'ICM verteilt genau das Preisgeld');
assert(eq[0] > eq[1] && eq[1] > eq[2] && eq[2] > eq[3], 'mehr Chips = mehr wert');
assert(eq[0] < 3000 && eq[5] === 0, 'niemand bekommt mehr als Platz 1, ohne Chips nichts');
near(T.icm([7000, 2000], [3000, 1800])[0], 3000 * 7 / 9 + 1800 * 2 / 9, 'Heads-up');
near(T.icm([9000], [3000])[0], 3000, 'allein übrig = Platz 1');

// cashOutValue: Zwischen zwei Händen verteilt es genau das offene Preisgeld. Mitten in einer Hand
// verliert, wer aussteigt, seine Chips im Pot – dann ist die Summe kleiner, aber nie größer.
for (let n = 0; n < 20; n++) {
  const t = T.createTable(T.botSeats(6), n % 2 ? 'turbo' : 'classic');
  const values = () => t.players.map((p, i) => T.cashOutValue(t, i, 1000));
  GK.poker.engine.startHand(t);
  assert(sum(values()) <= 6000, 'Start: höchstens das Preisgeld');
  const handsToPlay = 1 + Math.floor(Math.random() * 25);
  while (t.phase !== 'finished') {
    if (t.phase !== 'betting') {
      if (t.handNo >= handsToPlay) break;
      GK.poker.engine.startHand(t);
      continue;
    }
    GK.poker.engine.act(t, GK.poker.ai.decide(t));
    assert(sum(values()) + t.players.filter(p => p.out).reduce((s, p) => s + T.prize(p.place, 1000, 6), 0) <= 6000, 'mitten in der Hand: nie mehr als das Preisgeld');
  }
  const decided = t.players.filter(p => p.out).reduce((s, p) => s + T.prize(p.place, 1000, 6), 0);
  const open = sum(values());
  assert(t.phase !== 'betting', 'zwischen zwei Händen');
  assert(open + decided <= 6000 && open + decided >= 6000 - t.players.length, `zwischen Händen: offen ${open} + vergeben ${decided}`);
  t.players.forEach((p, i) => { if (p.out) assert(T.cashOutValue(t, i, 1000) === 0, 'Ausgeschiedene bekommen nichts'); });
}
console.log(process.exitCode ? 'Turbo-/ICM-Tests FEHLGESCHLAGEN' : 'Turbo- und ICM-Tests bestanden.');
