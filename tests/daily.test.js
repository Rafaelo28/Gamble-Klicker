// Tests für die täglichen Aufgaben: Auslosen, Fortschritt zählen, Abholen, Bonus und Serie, Tageswechsel,
// alte Spielstände. Ausführen mit: node tests/daily.test.js
global.window = global;
global.document = { addEventListener() {}, querySelector() { return null; }, getElementById() { return null; }, visibilityState: 'visible' };
global.location = { search: '', pathname: '/', origin: '', hash: '' };
global.history = { replaceState() {} };
const R = require('path').join(__dirname, '..', 'js') + '/';
require(R + 'format.js');
require(R + 'state.js');
require(R + 'daily.js');
require(R + 'progress.js');
require(R + 'clicker.js');
require(R + 'cosmetics.js');
require(R + 'casino/casino.js');
['cards', 'mines', 'scratch', 'baccarat', 'keno'].forEach(f => require(R + 'casino/' + f + '.js'));
require(R + 'mp/room.js');
require(R + 'mp/dice.js');
// Für die Casino-Übersicht, die record() nebenbei aktualisiert
document.getElementById = () => ({});
GK.poker = { tournament: { TIERS: [] } };
const assert = (cond, msg) => { if (!cond) { console.log('FAIL', msg); process.exitCode = 1; } };
const D = GK.daily;
const d = () => GK.state.daily;

// Uhr für die Tests: Tag 0 = 29.10.2026, 10 Uhr
let day = 0;
D._setNow(() => new Date(2026, 9, 29 + day, 10, 0, 0));
const task = (id, extra = {}) => Object.assign({ id, progress: 0, done: false, claimed: false }, D.DEFS[id].make(), extra);
function setTasks(tasks) {
  d().day = D.today();
  d().tasks = tasks;
}

// ---------- Auslosen ----------
{
  for (let i = 0; i < 300; i++) {
    const tasks = D.makeTasks();
    const ids = tasks.map(t => t.id);
    assert(tasks.length === 3 && new Set(ids).size === 3, 'Drei verschiedene Aufgaben');
    assert(D.DEFS[ids[0]].group === 'clicker' && D.DEFS[ids[1]].group === 'casino', 'Eine im Klicker, eine im Casino');
    assert(tasks.every(t => t.target >= 1 && t.progress === 0 && !t.done && !t.claimed), 'Ziele gesetzt');
    const g = tasks.find(t => t.id === 'game');
    if (g) assert(['mines', 'scratch', 'baccarat', 'keno'].includes(g.game), `Spiel-Aufgabe nur für schnelle Spiele (${g.game})`);
  }
  // Ohne genug offene Upgrades keine Upgrade-Aufgabe
  const realRemaining = GK.clicker.remainingUpgrades;
  GK.clicker.remainingUpgrades = () => 1;
  for (let i = 0; i < 200; i++) assert(!D.makeTasks().some(t => t.id === 'upgrades'), 'Keine Upgrade-Aufgabe, wenn kaum Upgrades übrig sind');
  GK.clicker.remainingUpgrades = realRemaining;
  D.ensureDay();
  assert(d().day === '2026-10-29' && d().tasks.length === 3, 'Aufgaben für heute');
  assert(D.ensureDay() === false, 'Am selben Tag keine neuen Aufgaben');
}

// ---------- Fortschritt zählen ----------
{
  setTasks([task('clicks', { target: 5 }), task('combo', { target: 30 }), task('buildings', { target: 10 })]);
  const before = d().completed;
  for (let i = 0; i < 4; i++) D.track('click', 1);
  assert(d().tasks[0].progress === 4 && !d().tasks[0].done, 'Klicks gezählt');
  D.track('click', 1);
  D.track('click', 1);
  assert(d().tasks[0].done && d().tasks[0].progress === 5 && d().completed === before + 1, 'Klick-Aufgabe geschafft (genau einmal gezählt)');
  D.track('combo', 12);
  D.track('combo', 5);
  assert(d().tasks[1].progress === 12, 'Combo: der beste Wert zählt');
  D.track('combo', 31);
  assert(d().tasks[1].done, 'Combo geschafft');
  D.track('building', 10);
  assert(d().tasks[2].done, 'Zehn Gebäude auf einmal zählen');

  setTasks([task('earn', { target: 1000 }), task('variety', { target: 3 }), task('game', { target: 2, game: 'mines' })]);
  GK.earn(400, 'click');
  GK.earn(400, 'casino');
  GK.earn(400, 'daily');
  assert(d().tasks[0].progress === 400, 'Verdienen: nur Klicks und Gebäude zählen');
  GK.earn(700, 'passive');
  assert(d().tasks[0].done, 'Verdienen geschafft');
  GK.state.money = 1e6;
  const round = (game, bet, payout) => { GK.casino.bet(bet); GK.casino.payout(payout); GK.casino.record(game, bet, payout, 'Test'); };
  GK.unlockAchievement = () => {};
  ['mines', 'mines', 'sideSlot', 'scratch'].forEach(g => round(g, 10, 0));
  assert(d().tasks[1].progress === 2 && d().tasks[2].done, 'Verschiedene Spiele (ohne Side-Slot) und ein bestimmtes Spiel');
  round('keno', 10, 0);
  assert(d().tasks[1].done, 'Drei verschiedene Spiele geschafft');

  setTasks([task('wins', { target: 2 }), task('bigHit', { mult: 5 }), task('friends')]);
  round('mines', 100, 100);
  round('mines', 100, 150);
  assert(d().tasks[0].progress === 1, 'Gewinn zählt nur, wenn mehr zurückkommt als gesetzt');
  round('scratch', 100, 400);
  assert(!d().tasks[1].done, 'Unter ×5 zählt nicht');
  round('scratch', 100, 500);
  assert(d().tasks[0].done && d().tasks[1].done, 'Gewinne und ×5-Treffer geschafft');
  round('mines', 100, 0);
  assert(!d().tasks[2].done, 'Casino-Spiel zählt nicht als Spiel mit Freunden');
  round('dice', 1000, 2000);
  assert(d().tasks[2].done, 'Partie gegen Computer (Lügenwürfel) zählt');
  setTasks([task('friends')]);
  round('poker', 1000, 0);
  assert(d().tasks[0].done, 'Poker zählt auch');
}

// ---------- Abholen, Bonus, Serie ----------
{
  GK.state.money = 0;
  setTasks([task('clicks', { target: 1 }), task('golden', { target: 1 }), task('upgrades', { target: 1 })]);
  assert(D.claim(0) === 0, 'Nicht geschafft: nichts abzuholen');
  D.track('click', 1);
  assert(D.claimable() === 1, 'Eine Belohnung wartet');
  const r = D.reward();
  assert(D.claim(0) === r && GK.state.money === r, 'Belohnung abgeholt');
  assert(D.claim(0) === 0 && GK.state.money === r, 'Nicht doppelt abholen');
  assert(D.claimBonus() === 0, 'Bonus erst, wenn alle drei abgeholt sind');
  D.track('golden', 1);
  D.track('upgrade', 1);
  D.claim(1);
  D.claim(2);
  assert(D.claimable() === 1, 'Jetzt wartet der Bonus');
  const b1 = D.claimBonus();
  assert(b1 === r * 2 && d().streak === 1 && d().bonusDay === '2026-10-29', `Bonus Tag 1: doppelte Belohnung (${b1})`);
  assert(D.claimBonus() === 0 && D.claimable() === 0, 'Bonus nur einmal');
  // Tag 2: Serie läuft weiter, Bonus +25 %
  day = 1;
  assert(D.ensureDay() && d().day === '2026-10-30' && d().tasks.every(t => !t.done), 'Neuer Tag, neue Aufgaben');
  d().tasks.forEach(t => { t.done = true; });
  [0, 1, 2].forEach(i => D.claim(i));
  const b2 = D.claimBonus();
  assert(b2 === Math.floor(D.reward() * 2 * 1.25) && d().streak === 2, `Bonus Tag 2: +25 % (${b2})`);
  // Tag 4 (Tag 3 ausgelassen): Serie beginnt neu
  day = 3;
  D.ensureDay();
  d().tasks.forEach(t => { t.done = true; });
  [0, 1, 2].forEach(i => D.claim(i));
  const b4 = D.claimBonus();
  assert(b4 === D.reward() * 2 && d().streak === 1, 'Nach einer Pause beginnt die Serie neu');
}

// ---------- Tageswechsel: nicht abgeholte Belohnungen ----------
{
  day = 10;
  D.ensureDay();
  d().tasks.forEach(t => { t.done = true; });
  const money = GK.state.money;
  const r = D.reward();
  day = 11;
  assert(D.ensureDay(), 'Mitternacht: neue Aufgaben');
  assert(GK.state.money === money + 3 * r + 2 * r, 'Nicht abgeholte Belohnungen und Bonus werden gutgeschrieben');
  assert(d().bonusDay === '2026-11-08' && d().streak === 1, 'Der Bonus zählt für den alten Tag');
  // Am neuen Tag geht die Serie weiter
  d().tasks.forEach(t => { t.done = true; });
  [0, 1, 2].forEach(i => D.claim(i));
  D.claimBonus();
  assert(d().streak === 2, 'Serie läuft nach automatischem Bonus weiter');
  // Fortschritt von gestern zählt nicht für heute
  const t0 = d().tasks[0];
  day = 12;
  D.track('click', 1000);
  assert(t0.progress <= t0.target, 'Alte Aufgaben ändern sich nach Mitternacht nicht mehr');
}

// ---------- Alte Spielstände ----------
{
  const old = JSON.parse(JSON.stringify(GK.state));
  delete old.daily;
  const text = Buffer.from(JSON.stringify(old)).toString('base64');
  global.atob = s => Buffer.from(s, 'base64').toString('binary');
  assert(GK.importSave(text), 'Alter Spielstand lädt');
  assert(d() && Array.isArray(d().tasks) && d().streak === 0 && d().day === '', 'Standardwerte für tägliche Aufgaben');
  day = 20;
  D.ensureDay();
  assert(d().tasks.length === 3, 'Danach gibt es sofort Aufgaben');
}

console.log(process.exitCode ? 'Tagesaufgaben-Tests FEHLGESCHLAGEN' : 'Tagesaufgaben-Tests bestanden.');
