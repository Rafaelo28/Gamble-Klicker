// Tests für die Spielzeit-Uhr (GK.now): Die Geräte-Uhr zurück- oder vorzustellen bringt keine dauerhaften Buffs,
// kein mehrfaches Offline-Einkommen und keine sofort fertigen Fahrten. Ausführen mit: node tests/clock.test.js
global.window = global;
global.document = { addEventListener() {}, querySelector() { return null; }, getElementById() { return null; }, visibilityState: 'visible' };
global.location = { search: '', pathname: '/', origin: '', hash: '' };
global.history = { replaceState() {} };
// Geräte-Uhr (verstellbar) und echte vergangene Zeit (performance.now) getrennt steuern
const REAL_START = Date.UTC(2026, 10, 12, 9, 0, 0);
let wall = REAL_START;   // was die Geräte-Uhr anzeigt
let perf = 1000;         // echte vergangene Zeit
Date.now = () => wall;
Object.defineProperty(global, 'performance', { value: { now: () => perf }, configurable: true });
const wait = ms => { wall += ms; perf += ms; };   // echte Zeit vergeht (Geräte-Uhr läuft mit)
const setClock = t => { wall = t; };              // Geräte-Uhr verstellen (keine echte Zeit vergeht)
const H = 3600e3;

const R = require('path').join(__dirname, '..', 'js') + '/';
require(R + 'format.js');
require(R + 'savecode.js');
require(R + 'state.js');
require(R + 'casino/casino.js');
require(R + 'daily.js');
require(R + 'progress.js');
require(R + 'clicker.js');
require(R + 'fleet.js');
document.getElementById = () => ({});
GK.sound = { play() {} };
GK.toast = () => {};
GK.notify = () => {};
GK.unlockAchievement = () => {};
GK.storageAvailable = true;
global.localStorage = { setItem() {}, getItem() { return null; }, removeItem() {} };
const assert = (cond, msg) => { if (!cond) { console.log('FAIL', msg); process.exitCode = 1; } };
const s = GK.state;

// ---------- Die Uhr läuft nie rückwärts ----------
{
  const t0 = GK.now();
  assert(t0 >= REAL_START, 'Startet bei der Geräte-Uhr');
  wait(5000);
  assert(GK.now() - t0 === 5000, 'Echte Zeit vergeht normal');
  setClock(wall - 365 * 24 * H);
  const t1 = GK.now();
  assert(t1 === t0 + 5000, 'Geräte-Uhr ein Jahr zurück: Spielzeit springt nicht zurück');
  perf += 2000;
  assert(GK.now() === t1 + 2000, 'Danach läuft sie mit der echten Zeit weiter');
  setClock(REAL_START + 8 * H);
  assert(GK.now() === REAL_START + 8 * H, 'Vorgestellte Uhr zählt wie Zeit ohne Spiel (nicht von echter Abwesenheit zu unterscheiden)');
  setClock(REAL_START + 7000);
  const t2 = GK.now();
  assert(t2 >= REAL_START + 8 * H, '… und wieder zurückgestellt: Die vorgezogene Zeit ist verbraucht');
  s.lastSaved = t2 + 10 * H;
  assert(GK.now() >= t2 + 10 * H, 'Nie vor dem letzten Speichern');
  // für die weiteren Tests: alles wieder auf die echte Zeit
  wall = GK.now();
}

// ---------- Buffs ----------
{
  s.buffs = [];
  GK.progress.addBuff('clickfever');
  assert(GK.progress.buffMult('click') === 25, 'Klickfieber aktiv');
  setClock(wall - 365 * 24 * H);
  perf += 31e3;
  assert(GK.progress.buffMult('click') === 1, 'Uhr zurückgestellt: Klickfieber endet trotzdem nach 30 Sekunden');
  wall = GK.now();
}

// ---------- Offline-Einkommen ----------
{
  s.buildings = { piggy: 10 };
  s.passiveOff = false;
  GK.save();
  // Uhr 9 Stunden zurück, kurz warten (Speichern), Uhr wieder richtig – „Neuladen“
  const real = wall;
  setClock(real - 9 * H);
  perf += 5000;
  GK.save();
  setClock(real + 5000);
  const before = s.money;
  GK.progress.applyOfflineEarnings();
  assert(s.money === before, `Uhr zurück und wieder vor: kein Offline-Einkommen (${s.money - before})`);
  // Echte Abwesenheit zählt weiter
  GK.save();
  wait(2 * H);
  GK.progress.applyOfflineEarnings();
  assert(s.money > before, 'Echte 2 Stunden weg: Offline-Einkommen');
}

// ---------- Flotte ----------
{
  wall = GK.now();
  const F = GK.fleet;
  s.money = 1e12;
  s.fleet = { ships: {}, voyages: {}, last: {}, treasures: {}, peak: 0, done: 0, earned: 0, log: [] };
  F.buy('sloop');
  const dest = F.DESTS[0];
  const sent = F.send('sloop', dest.id);
  assert(sent, 'Schaluppe ausgelaufen');
  const v = s.fleet.voyages.sloop;
  assert(v && v.end > GK.now(), 'Fahrt läuft');
  // Uhr vor und gleich wieder zurück, ohne dass echte Zeit vergeht – im laufenden Spiel bringt das nichts
  setClock(wall - 24 * H);
  perf += 1000;
  assert(GK.now() < v.end && !GK.fleet.isBack('sloop'), 'Uhr zurück: Fahrt läuft unverändert weiter');
}

console.log(process.exitCode ? 'Uhr-Tests FEHLGESCHLAGEN' : 'Uhr-Tests bestanden.');
