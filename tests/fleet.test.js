// Tests für Flotte & Expeditionen: Kaufen und Ausbauen, Fahrten (auch über Neuladen hinweg), Rückenwind,
// Beute, Schätze und ihre Boni, Ziele nach Rang, alte Spielstände. Ausführen mit: node tests/fleet.test.js
global.window = global;
global.document = { addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, getElementById() { return null; }, visibilityState: 'visible' };
global.location = { search: '', pathname: '/', origin: '', hash: '' };
global.history = { replaceState() {} };
const R = require('path').join(__dirname, '..', 'js') + '/';
require(R + 'format.js');
require(R + 'savecode.js');
require(R + 'state.js');
require(R + 'casino/casino.js');
require(R + 'daily.js');
require(R + 'progress.js');
require(R + 'clicker.js');
require(R + 'rank.js');
require(R + 'fleet.js');
require(R + 'figure.js');
require(R + 'achievements.js');
const assert = (cond, msg) => { if (!cond) { console.log('FAIL', msg); process.exitCode = 1; } };
const close = (a, b, eps = 1e-9) => Math.abs(a - b) <= Math.abs(b) * eps;
GK.toast = () => {};
GK.sound = { play() {} };
GK.save = () => true;
GK.notify = () => {};
const F = GK.fleet;
let s = GK.state; // nach dem Neuladen neu setzen
let clock = 1e12;
F._setNow(() => clock);
const realRng = GK.rng.float;
// Zufall festlegen: nacheinander diese Werte (danach wieder echter Zufall)
const fix = (...values) => { GK.rng.float = () => (values.length ? values.shift() : realRng()); };

// Einkommen festlegen: nur Hilfsfinger
function setIncome(fingers) {
  s.buildings = { finger: fingers };
  s.upgrades = [];
}

// ---------- Kaufen und Ausbauen ----------
{
  setIncome(100);
  const cps = GK.clicker.getCpsPermanent();
  assert(cps > 0, 'Einkommen vorhanden');
  assert(close(F.income(), cps), 'Preise und Beute nach dem Einkommen');
  assert(F.canBuy('sloop') && !F.canBuy('brig'), 'Erst die Schaluppe, dann die Brigg');
  s.money = F.buyPrice('sloop') - 1;
  assert(!F.buy('sloop') && !F.owns('sloop') && s.money === F.buyPrice('sloop') - 1, 'Zu wenig Geld: nichts passiert');
  s.money = F.buyPrice('sloop') + 10;
  assert(F.buy('sloop') && F.level('sloop') === 1 && s.money === 10, 'Schaluppe gekauft');
  assert(!F.buy('sloop'), 'Kein zweites Mal');
  assert(F.canBuy('brig'), 'Jetzt die Brigg');
  const up = F.upgradePrice('sloop');
  assert(close(up, F.buyPrice('sloop') * 1.75, 1e-6), 'Ausbauen kostet mehr als der Kauf');
  s.money = up;
  const hold1 = F.holdOf('sloop');
  assert(F.upgrade('sloop') && F.level('sloop') === 2 && s.money === 0 && close(F.holdOf('sloop'), hold1 * 1.1), 'Ausgebaut: +10 % Laderaum');
  assert(F.upgradePrice('sloop') > up, 'Nächste Stufe teurer');
  s.money = 1e300;
  while (F.level('sloop') < F.MAX_LEVEL) F.upgrade('sloop');
  assert(!F.upgrade('sloop') && F.level('sloop') === F.MAX_LEVEL, 'Höchste Stufe');
  s.fleet.ships.sloop = 1;
}

// ---------- Fahrt: Ausgang steht beim Ablegen fest, auch über Neuladen hinweg ----------
{
  setIncome(100);
  s.money = 0;
  s.allTimeEarned = 1e13; // alle Ziele offen
  fix(0.5, 0.99); // normaler Ausgang, kein Schatz
  assert(F.send('sloop', 'reef'), 'Losgeschickt');
  const v = s.fleet.voyages.sloop;
  assert(v && v.outcome === 'normal' && v.treasure === '' && v.end - v.start === 900 * 1000, 'Korallenriff: 15 Minuten, normal');
  assert(close(v.loot, Math.floor(F.income() * 900 * 0.14), 1e-9), `Beute = Einkommen × Zeit × Anteil (${v.loot})`);
  assert(!F.send('sloop', 'bay'), 'Ein Schiff kann nicht zweimal fahren');
  // Neuladen mitten in der Fahrt
  const saved = JSON.stringify(GK.state);
  global.atob = x => Buffer.from(x, 'base64').toString('binary');
  assert(GK.importSave(Buffer.from(saved).toString('base64')), 'Neu geladen');
  s = GK.state;
  assert(JSON.stringify(GK.state.fleet.voyages.sloop) === JSON.stringify(v), 'Fahrt bleibt genau gleich');
  assert(F.collect('sloop') === null && !F.isBack('sloop'), 'Vor der Ankunft nichts abholen');
  clock += 899 * 1000;
  assert(F.collect('sloop') === null, 'Eine Sekunde vorher: noch nicht');
  clock += 1000;
  assert(F.isBack('sloop') && F.readyCount() === 1, 'Zurück im Hafen');
  const earned0 = GK.state.allTimeEarned;
  const r = F.collect('sloop');
  assert(r && r.loot === v.loot && GK.state.money === v.loot && GK.state.allTimeEarned === earned0 + v.loot, 'Beute gutgeschrieben');
  assert(GK.state.fleet.done === 1 && GK.state.fleet.log[0].loot === v.loot && !GK.state.fleet.voyages.sloop, 'Logbuch und Zähler');
  assert(F.collect('sloop') === null, 'Nicht doppelt abholen');
}

// ---------- Ausgänge: Sturm, reicher Fang, Goldschatz ----------
{
  const base = F.expectedLoot('sloop', 'bay');
  const go = (rolls, want, mult) => {
    fix(...rolls);
    F.send('sloop', 'bay');
    clock += 3 * 60 * 1000;
    const r = F.collect('sloop');
    assert(r.outcome === want && r.loot === Math.floor(base * mult), `${want}: ×${mult} (${r.loot} statt ${base})`);
  };
  go([0.05, 0.99], 'storm', 0.5);
  go([0.85, 0.99], 'rich', 2);
  go([0.985, 0.99], 'gold', 5);
  // Verteilung
  let sum = 0;
  const n = 40000;
  const counts = {};
  GK.rng.float = realRng;
  for (let i = 0; i < n; i++) {
    F.send('sloop', 'bay');
    const v = s.fleet.voyages.sloop;
    counts[v.outcome] = (counts[v.outcome] || 0) + 1;
    sum += v.loot / base;
    delete s.fleet.voyages.sloop;
  }
  assert(Math.abs(counts.storm / n - 0.12) < 0.01 && Math.abs(counts.gold / n - 0.03) < 0.005, `Sturm ~12 %, Goldschatz ~3 % (${JSON.stringify(counts)})`);
  assert(Math.abs(sum / n - 1.21) < 0.03, `Im Schnitt ×1,21 (${(sum / n).toFixed(3)})`);
}

// ---------- Schätze und ihre Boni ----------
{
  const before = { mult: GK.progress.permanentMult(), loot: F.expectedLoot('sloop', 'dragon'), time: F.durationOf('sloop', 'dragon') };
  const realInt = GK.rng.int;
  GK.rng.int = () => 0; // immer der erste Schatz des Ziels
  fix(0.5, 0.0); // normal, mit Schatz: der erste der Drachenküste (Drachenei +10 %)
  F.send('sloop', 'dragon');
  assert(s.fleet.voyages.sloop.treasure === 'egg', 'Schatz beim Ablegen ausgelost');
  clock += 8 * 3600 * 1000;
  const r = F.collect('sloop');
  assert(r.treasure === 'egg' && !r.duplicate && F.found('egg'), 'Drachenei gefunden');
  assert(close(F.incomeMult(), 1.1) && close(GK.progress.permanentMult(), before.mult * 1.1), 'Drachenei: +10 % Einkommen dauerhaft');
  // Doppelt gefunden: wird verkauft
  fix(0.5, 0.0);
  F.send('sloop', 'dragon');
  GK.rng.int = realInt;
  clock += 8 * 3600 * 1000;
  const loot = s.fleet.voyages.sloop.loot;
  const d = F.collect('sloop');
  assert(d.duplicate && d.loot > loot && close(F.incomeMult(), 1.1), 'Doppelt: verkauft, kein zweiter Bonus');
  // Beute- und Tempo-Schätze
  s.fleet.treasures.hoard = 1;
  s.fleet.treasures.lantern = 1;
  assert(close(F.lootMult(), 1.2) && close(F.timeMult(), 0.95), 'Drachengold +20 % Beute, Nordlicht-Laterne −5 % Zeit');
  assert(F.durationOf('sloop', 'dragon') === Math.round(before.time * 0.95), 'Fahrt kürzer');
  assert(F.setsComplete('dragon') === false, 'Drachenküste noch nicht komplett');
  s.fleet.treasures.scale = 1;
  assert(F.setsComplete('dragon'), 'Drachenküste komplett');
  const fig = GK.figure.SLOTS[4].parts.findIndex(p => p.name === 'Drachenschuppen');
  assert(fig > 0 && GK.figure.unlocked(4, fig), 'Figur-Teil Drachenschuppen freigeschaltet');
  const chest = GK.figure.SLOTS[6].parts.findIndex(p => p.name === 'Schatztruhe');
  assert(!GK.figure.unlocked(6, chest), 'Schatztruhe noch gesperrt');
  // Alle Schätze: Bonus-Summen
  F.TREASURES.forEach(t => { s.fleet.treasures[t.id] = 1; });
  assert(F.foundCount() === 18 && GK.figure.unlocked(6, chest), 'Alle Schätze');
  assert(close(F.incomeMult(), 1.47) && close(F.lootMult(), 1.55) && close(F.timeMult(), 0.85), `Boni: ×${F.incomeMult()} Einkommen, ×${F.lootMult()} Beute, ×${F.timeMult()} Zeit`);
  const ach = GK.achievements.ACHIEVEMENTS;
  assert(ach.find(a => a.id === 'treasureAll').check(s) && ach.find(a => a.id === 'voyage1').check(s), 'Erfolge');
  s.fleet.treasures = {};
}

// ---------- Rückenwind ----------
{
  fix(0.5, 0.99);
  F.send('sloop', 'ice');
  const v = s.fleet.voyages.sloop;
  clock += 3600 * 1000;
  const price = F.windPrice('sloop');
  assert(close(price, Math.ceil(F.income() * 3 * 3600 * 0.25), 1e-6), 'Kosten: Einkommen eines Viertels der restlichen Zeit');
  s.money = price;
  const end = v.end;
  assert(F.wind('sloop') && s.money === 0 && v.end === clock + (end - clock) / 2, 'Restzeit halbiert');
  s.money = 1e300;
  assert(!F.wind('sloop'), 'Nur einmal je Fahrt');
  clock = v.end;
  F.collect('sloop');
}

// ---------- Ziele nach Rang ----------
{
  s.allTimeEarned = 0;
  assert(F.send('sloop', 'reef'), 'Korallenriff von Anfang an');
  delete s.fleet.voyages.sloop;
  assert(!F.send('sloop', 'smuggler') && !F.send('sloop', 'dragon'), 'Weiter weg erst mit Rang');
  s.allTimeEarned = 1e12;
  assert(F.send('sloop', 'dragon'), 'Drachenküste ab Steuermann');
  delete s.fleet.voyages.sloop;
}

// ---------- Mehrere Schiffe, alle losschicken, alle abholen ----------
{
  s.money = 1e300;
  ['brig', 'frigate', 'galleon', 'ghost'].forEach(id => assert(F.buy(id), `${id} gekauft`));
  assert(F.shipCount() === 5 && GK.achievements.ACHIEVEMENTS.find(a => a.id === 'fleetAll').check(s), 'Ganze Flotte');
  const spd = F.SHIPS.find(x => x.id === 'ghost').speed;
  assert(F.durationOf('ghost', 'bay') === Math.round(120 / spd), 'Geisterschiff ist schneller');
  assert(F.expectedLoot('ghost', 'bay') > F.expectedLoot('sloop', 'bay') * 2.5, 'und hat mehr Laderaum');
  s.fleet.last = { brig: 'volcano' };
  const tasks = s.daily.tasks;
  s.daily.tasks = [{ id: 'voyages', target: 3, progress: 0, done: false, claimed: false }];
  s.daily.day = GK.daily ? s.daily.day : '';
  assert(F.sendAll() === 5, 'Alle fünf abgelegt');
  assert(s.fleet.voyages.brig.dest === 'volcano' && s.fleet.voyages.sloop.dest === 'bay', 'Letztes Ziel bzw. die Bucht');
  assert(F.sendAll() === 0, 'Keins mehr im Hafen');
  clock += 9 * 3600 * 1000;
  const money0 = s.money;
  const all = F.collectAll();
  assert(all.length === 5 && F.readyCount() === 0 && close(s.money, money0 + all.reduce((x, r) => x + r.loot, 0)), 'Alle abgeholt');
  s.daily.tasks = tasks;
}

// ---------- Preise und Beute nach dem besten Einkommen (große Fahrt macht die Flotte nicht billig) ----------
{
  setIncome(500);
  const big = F.income();
  const price = F.upgradePrice('ghost');
  s.buildings = {}; // wie nach einer großen Fahrt
  assert(GK.clicker.getCpsPermanent() === 0 && F.income() === big && F.upgradePrice('ghost') === price, 'Bestes Einkommen bleibt die Grundlage');
}

// ---------- Ausgewogen: Die Flotte bringt nicht mehr als ein paar Mal das Einkommen ----------
{
  const fleetPerSecond = F.SHIPS.reduce((sum, x) => sum + F.expectedLoot(x.id, 'bay') / F.durationOf(x.id, 'bay'), 0) / F.income();
  const overnight = F.SHIPS.reduce((sum, x) => sum + F.expectedLoot(x.id, 'dragon'), 0) / F.income() / (8 * 3600);
  console.log(`Flotte: Bucht ×${fleetPerSecond.toFixed(2)}, über Nacht ×${overnight.toFixed(2)} Einkommen`);
  assert(fleetPerSecond > 0.5 && fleetPerSecond < 4, `Ganze Flotte in der Bucht (Stufe 1): ×${fleetPerSecond.toFixed(2)} Einkommen`);
  assert(overnight > 0.5 && overnight < 3, `Über Nacht zur Drachenküste: ×${overnight.toFixed(2)} Einkommen`);
}

// ---------- Alte Spielstände ----------
{
  const old = JSON.parse(JSON.stringify(GK.state));
  delete old.fleet;
  assert(GK.importSave(Buffer.from(JSON.stringify(old)).toString('base64')), 'Alter Spielstand lädt');
  assert(GK.state.fleet && F.shipCount() === 0 && F.incomeMult() === 1 && Array.isArray(GK.state.fleet.log), 'Leere Flotte');
  const broken = JSON.parse(JSON.stringify(GK.state));
  broken.fleet = { ships: null, voyages: [], log: 'x' };
  assert(GK.importSave(Buffer.from(JSON.stringify(broken)).toString('base64')) && F.shipCount() === 0 && Array.isArray(GK.state.fleet.log), 'Kaputte Flotten-Daten werden aufgefüllt');
}

console.log(process.exitCode ? 'Flotten-Tests FEHLGESCHLAGEN' : 'Flotten-Tests bestanden.');
