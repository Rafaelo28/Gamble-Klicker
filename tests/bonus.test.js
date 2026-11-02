// Tests für Klickkraft-Upgrades (auch die späten wie Sternenhand wirken spürbar) und die Glückssträhne
// aus der goldenen Dublone (Casino-Gewinne +30–50 %). Ausführen mit: node tests/bonus.test.js
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
require(R + 'casino/casino.js');
// Für die Casino-Übersicht, die record() nebenbei aktualisiert
document.getElementById = () => ({});
GK.poker = { tournament: { TIERS: [] } };
GK.sound = { play() {} };
GK.unlockAchievement = () => {};
const assert = (cond, msg) => { if (!cond) { console.log('FAIL', msg); process.exitCode = 1; } };
const close = (a, b) => Math.abs(a - b) <= Math.abs(b) * 1e-9;
const C = GK.clicker;
const s = GK.state;

// ---------- Klickkraft ----------
{
  s.upgrades = [];
  s.buffs = [];
  s.buildings = {};
  const base = C.getClickPower();
  assert(base > 0, 'Grundwert pro Klick');
  s.upgrades = ['click1'];
  assert(close(C.getClickPower(), base * 2), 'Starker Finger: ×2');
  // Spätes Spiel: viel Einkommen, Anteil vom Einkommen pro Klick (Klick-Investment … Klick-Dynastie)
  C.BUILDINGS.forEach((b, i) => { s.buildings[b.id] = 80 - i * 3; });
  s.upgrades = ['click1', 'click2', 'click3', 'click4', 'click5', 'click6', 'cpsClick1', 'cpsClick2', 'cpsClick3', 'cpsClick4', 'cpsClick5'];
  const cps = C.getCps();
  const before = C.getClickPower();
  assert(cps > 1e9 && before > cps * 0.15, `Spätes Spiel: Klickkraft vor allem aus dem Einkommen (${GK.formatNumber(before)} bei ${GK.formatNumber(cps)}/s)`);
  s.upgrades.push('click7');
  const star = C.getClickPower();
  assert(close(star, before * 3), `Sternenhand verdreifacht die Klickkraft (${GK.formatNumber(before)} → ${GK.formatNumber(star)})`);
  s.upgrades.push('click8');
  assert(close(C.getClickPower(), star * 4), 'Hand der Götter: ×4');
  // Die frühen ×2-Upgrades vervielfachen weiterhin nur den Grundwert
  const without = s.upgrades.filter(id => id !== 'click1');
  s.upgrades = without;
  const a = C.getClickPower();
  s.upgrades = without.concat('click1');
  const b = C.getClickPower();
  assert(b > a && b < a * 1.01, 'Starker Finger im späten Spiel: nur der Grundwert doppelt');
  // Klickfieber gilt für alles
  s.buffs = [{ id: 'clickfever', type: 'click', mult: 25, until: Date.now() + 10000 }];
  assert(close(C.getClickPower(), b * 25), 'Klickfieber ×25');
  s.buffs = [];
}

// ---------- Glückssträhne ----------
{
  const c = s.casino;
  const round = (bet, payout) => {
    GK.casino.bet(bet);
    GK.casino.payout(payout);
    GK.casino.record('mines', bet, payout, 'Test');
  };
  s.money = 10000;
  const start = { wagered: c.wagered, won: c.won };
  assert(GK.progress.buffMult('luck') === 1, 'Ohne Glückssträhne kein Bonus');
  round(100, 300);
  assert(s.money === 10200 && c.history[0].payout === 300, 'Normaler Gewinn');
  GK.progress.addBuff('luck', 1.4);
  assert(s.buffs.some(x => x.id === 'luck' && x.type === 'luck' && x.mult === 1.4), 'Glückssträhne aktiv');
  const won0 = c.won;
  round(100, 300);
  assert(s.money === 10200 + 200 + 80, `Gewinn 200 + 40 % = 80 Bonus (${s.money})`);
  assert(c.history[0].payout === 380 && /🍀/.test(c.history[0].text) && c.won === won0 + 380, 'Bonus mit der Runde verbucht');
  round(100, 0);
  assert(s.money === 10380 && c.history[0].payout === 0, 'Verlust: kein Bonus');
  round(100, 100);
  assert(s.money === 10380 && c.history[0].payout === 100, 'Einsatz zurück: kein Bonus');
  round(1000, 1001);
  assert(s.money === 10381, 'Bonus wird abgerundet (0,4 → 0)');
  // Abgelaufen
  s.buffs.forEach(x => { x.until = Date.now() - 1; });
  round(100, 300);
  assert(s.money === 10581 && c.history[0].payout === 300, 'Nach 30 Sekunden kein Bonus mehr');
  // Kontostand = Start − Einsätze + Auszahlungen (der Bonus zählt als Auszahlung)
  assert(s.money === 10000 - (c.wagered - start.wagered) + (c.won - start.won), 'Bilanz stimmt');
  // Andere Buffs ändern die Glückssträhne nicht
  s.buffs = [{ id: 'goldrush', type: 'income', mult: 7, until: Date.now() + 10000 }];
  assert(GK.progress.buffMult('luck') === 1, 'Goldrausch ist keine Glückssträhne');
}

console.log(process.exitCode ? 'Bonus-Tests FEHLGESCHLAGEN' : 'Bonus-Tests bestanden.');
