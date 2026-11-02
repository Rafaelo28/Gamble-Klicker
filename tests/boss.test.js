// Tests für Bosskämpfe: Lebenspunkte und Ungeheuer je Stufe, Kampf mit Tipps und Kanonen der Flotte,
// nächster Boss nach einem Sieg, Zeit abgelaufen, Belohnungen und Trophäen (Klickkraft), Figur-Teile,
// Rangliste und alte Spielstände. Ausführen mit: node tests/boss.test.js
global.window = global;
global.document = { addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, getElementById() { return null; }, visibilityState: 'visible' };
global.location = { search: '', pathname: '/', origin: '', hash: '' };
global.history = { replaceState() {} };
const R = require('path').join(__dirname, '..', 'js') + '/';
require(R + 'format.js');
require(R + 'state.js');
require(R + 'casino/casino.js');
require(R + 'progress.js');
require(R + 'clicker.js');
require(R + 'rank.js');
require(R + 'fleet.js');
require(R + 'boss.js');
require(R + 'figure.js');
require(R + 'cosmetics.js');
require(R + 'friends.js');
require(R + 'achievements.js');
const assert = (cond, msg) => { if (!cond) { console.log('FAIL', msg); process.exitCode = 1; } };
const close = (a, b, eps = 1e-9) => Math.abs(a - b) <= Math.abs(b) * eps;
let toasts = [];
GK.toast = t => toasts.push(t);
GK.sound = { play() {} };
GK.save = () => true;
GK.notify = () => {};
GK.fx = { confetti() {}, pulse() {}, floatText() {} };
const B = GK.boss;
let s = GK.state;
let clock = 1e12;
B._setNow(() => clock);
GK.fleet._setNow(() => clock);

// ---------- Stufen ----------
{
  assert(B.hp(1) === 20 && B.hp(2) === 31, `Lebenspunkte wachsen (${B.hp(1)}, ${B.hp(2)})`);
  for (let l = 2; l < 300; l++) {
    const ratio = B.hp(l) / B.hp(l - 1);
    if (B.isBig(l)) assert(ratio > 3, `Stufe ${l}: großer Boss viel stärker`);
    else if (!B.isBig(l - 1)) assert(ratio > 1.5 && ratio < 1.6, `Stufe ${l}: +55 %`);
  }
  assert(Number.isFinite(B.hp(1500)), 'Auch Stufe 1.500 hat endliche Lebenspunkte');
  assert(B.monster(10).name === 'Kraken-König' && B.monster(20).name === 'Seedrache' && B.monster(30).name === 'Kraken-König', 'Große Bosse im Wechsel');
  const names = [];
  for (let l = 1; l <= 9; l++) names.push(B.monster(l).name);
  assert(new Set(names).size === 9, 'Neun verschiedene Ungeheuer');
  for (let l = 1; l < 100; l++) if (!B.isBig(l) && !B.isBig(l + 1)) assert(B.monster(l).name !== B.monster(l + 1).name, `Stufe ${l} und ${l + 1}: verschiedene Bosse`);
}

// ---------- Kampf: Tipps, Sieg, nächster Boss ----------
{
  s.buildings = {};
  s.upgrades = [];
  s.buffs = [];
  s.money = 0;
  const tap = B.tapDamage();
  assert(tap > 0 && close(tap, GK.clicker.getClickPower()), 'Ein Tipp trifft mit der Klickkraft');
  assert(B.start() && !B.start(), 'Kampf beginnt (nur einer gleichzeitig)');
  const f = B.current();
  assert(f.level === 1 && f.hp === 20 && f.end === clock + 30000, 'Stufe 1, 30 Sekunden');
  let taps = 0;
  while (s.boss.level < 1 && taps < 100) { B.tap(); taps++; clock += 60; }
  assert(s.boss.level === 1 && taps === Math.ceil(20 / tap), `Boss nach ${taps} Tipps besiegt`);
  assert(s.money === B.reward(1) && s.money > 0, 'Belohnung gutgeschrieben');
  assert(B.current() && B.current().level === 2 && B.current().hp === B.hp(2) && B.current().end === clock - 60 + 30000, 'Sofort der nächste Boss mit neuer Zeit');
  // Mehr als 20 Tipps pro Sekunde zählen nicht
  clock = Math.ceil(clock / 1000) * 1000;
  let hits = 0;
  for (let i = 0; i < 40; i++) if (B.tap() > 0) hits++;
  assert(hits === B.MAX_TAPS_PER_SECOND, `Höchstens 20 Tipps pro Sekunde (${hits})`);
  // Zeit abgelaufen: Boss entkommt, Stufe bleibt
  const level = s.boss.level;
  clock = B.current().end;
  toasts = [];
  const r = B.step();
  assert(r && !B.current() && s.boss.level === level && /entkommen/.test(toasts[0]), 'Zeit um: Boss entkommt');
}

// ---------- Kanonen der Flotte ----------
{
  assert(B.cannonDps() === 0, 'Ohne Schiffe keine Kanonen');
  s.money = 1e300;
  GK.fleet.buy('sloop');
  GK.fleet.buy('brig');
  const dps = B.cannonDps();
  assert(close(dps, B.tapDamage() * (1 + 1.3) * 0.5), `Kanonen: halber Tipp je Laderaum (${dps})`);
  B.start();
  const f = B.current();
  const hp0 = f.hp;
  clock += 3000;
  B.step();
  assert(close(hp0 - B.current().hp, dps * 3) || B.current().level > f.level, 'Drei Sekunden: drei Salven');
  B.stop();
}

// ---------- Viel Klickkraft: viele Stufen hintereinander, Trophäen ----------
{
  s.upgrades = [];
  s.buffs = [{ id: 'clickfever', type: 'click', mult: 1e9, until: Date.now() + 1e9 }]; // riesige Klickkraft (Buffs laufen nach echter Uhrzeit)
  const before = GK.clicker.getClickPower();
  B.start();
  let n = 0;
  while (s.boss.level < 25 && n < 500) { B.tap(); n++; if (n % 20 === 0) clock += 1000; }
  assert(s.boss.level === 25 && n === 24, `Ein Tipp je Stufe von 2 bis 25 (${n} Tipps)`);
  assert(B.trophies() === 2 && close(B.clickMult(), 1.1), 'Zwei Trophäen: Klickkraft ×1,1');
  assert(close(GK.clicker.getClickPower(), before * 1.1), 'Trophäen wirken auf die Klickkraft');
  B.stop();
  s.buffs = [];
  // Belohnungen: großer Boss zehnmal so viel
  assert(close(B.reward(20), B.reward(19) * 10, 1e-6), 'Großer Boss: zehnfache Belohnung');
  // Figur-Teile
  const F = GK.figure;
  const find = name => { for (let i = 0; i < F.SLOTS.length; i++) { const j = F.SLOTS[i].parts.findIndex(p => p.name === name); if (j >= 0) return [i, j]; } return null; };
  assert(F.unlocked(...find('Kanone')) && F.unlocked(...find('Krakenhut')) && !F.unlocked(...find('Goldrüstung')) && !F.unlocked(...find('Krake')), 'Kanone (10) und Krakenhut (25) frei, der Rest noch nicht');
  F.bossParts().forEach(x => {
    const [i, j] = find(x.name);
    const code = [0, 0, 0, 0, 0, 0, 0];
    code[i] = j;
    assert(!/undefined|NaN/.test(F.svg(code.join('.'))), `${x.name} wird gezeichnet`);
    assert(/Boss-Stufe/.test(F.SLOTS[i].parts[j].hint), `${x.name}: Hinweis`);
  });
  const ach = GK.achievements.ACHIEVEMENTS;
  assert(ach.find(a => a.id === 'boss10').check(s) && !ach.find(a => a.id === 'boss50').check(s), 'Erfolge nach Stufe');
}

// ---------- Rangliste ----------
{
  assert(GK.friends.myRecords().boss === 25 && GK.friends.BOARDS.some(b => b.id === 'boss'), 'Boss-Stufe in der Rangliste');
  const f = GK.friends.clean({ id: 'ANNA12345678', name: 'Anna', boss: 40 });
  const old = GK.friends.clean({ id: 'OLDV12345678', name: 'Old' });
  assert(f.boss === 40 && old.boss === null, 'Empfangene Boss-Stufe geprüft');
}

// ---------- Alte Spielstände ----------
{
  const old = JSON.parse(JSON.stringify(GK.state));
  delete old.boss;
  global.atob = x => Buffer.from(x, 'base64').toString('binary');
  assert(GK.importSave(Buffer.from(JSON.stringify(old)).toString('base64')), 'Alter Spielstand lädt');
  s = GK.state;
  assert(s.boss.level === 0 && B.clickMult() === 1 && B.monster(B.best() + 1).name === 'Riesenkrabbe', 'Bosskampf beginnt bei Stufe 1');
  const bad = JSON.parse(JSON.stringify(GK.state));
  bad.boss = { level: -5 };
  assert(GK.importSave(Buffer.from(JSON.stringify(bad)).toString('base64')) && GK.state.boss.level === 0, 'Kaputte Stufe wird 0');
}

console.log(process.exitCode ? 'Boss-Tests FEHLGESCHLAGEN' : 'Boss-Tests bestanden.');
