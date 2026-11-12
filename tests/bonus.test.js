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
  // (nur die ersten 16 Gebäude – mit den riesigen späten Gebäuden ginge der Grundwert in der Rundung unter)
  C.BUILDINGS.forEach((b, i) => { s.buildings[b.id] = i < 16 ? 80 - i * 3 : 0; });
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
    GK.casino.bet(bet, 'mines');
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

// ---------- Glückssträhne gilt nur für Einsätze während der Strähne ----------
{
  const c = s.casino;
  s.money = 1e6;
  s.buffs = [];
  c.luck = {};
  const last = () => c.history[0];
  // Geparkte Runde: Einsatz vor der Strähne, Auszahlung währenddessen → kein Bonus
  GK.casino.bet(1000, 'chicken');
  GK.progress.addBuff('luck', 1.5);
  GK.casino.payout(10000);
  GK.casino.record('chicken', 1000, 10000, 'Test');
  assert(last().payout === 10000 && !/🍀/.test(last().text), 'Geparkter Gewinn (Einsatz vor der Strähne): kein Bonus');
  // Einsatz während der Strähne, Auszahlung erst danach → Bonus (beim Einsatz festgehalten)
  GK.casino.bet(1000, 'tower');
  s.buffs = [];
  GK.casino.payout(3000);
  GK.casino.record('tower', 1000, 3000, 'Test');
  assert(last().payout === 4000, `Einsatz in der Strähne zählt auch nach ihrem Ende (+50 % von 2000 = ${last().payout - 3000})`);
  assert(!c.luck.tower, 'Danach ist der Einsatz verbraucht');
  GK.casino.bet(1000, 'tower');
  GK.casino.payout(3000);
  GK.casino.record('tower', 1000, 3000, 'Test');
  assert(last().payout === 3000, 'Nächste Runde ohne Strähne: kein Bonus');
  // Freispiele / Bonus-Truhen (Einsatz 0): kein Bonus
  GK.progress.addBuff('luck', 1.4);
  GK.casino.payout(5000);
  GK.casino.record('pirates', 0, 5000, 'Freispiele');
  assert(last().payout === 5000, 'Runde ohne Einsatz: kein Bonus');
  // Räume mit Freunden setzen ohne Spiel-ID: kein Bonus
  GK.casino.bet(1000);
  GK.casino.payout(2000);
  GK.casino.record('darts', 1000, 2000, '1. Platz');
  assert(last().payout === 2000, 'Spiele mit Freunden: kein Bonus');
  // Chips setzen und wieder wegnehmen bringt keinen gespeicherten Bonus
  GK.casino.bet(5000, 'roulette');
  GK.casino.refund(5000, 'roulette');
  assert(!c.luck.roulette, 'Zurückgenommener Einsatz wird aus der Strähne gestrichen');
  s.buffs = [];
  GK.casino.bet(5000, 'roulette');
  GK.casino.payout(10000);
  GK.casino.record('roulette', 5000, 10000, 'Test');
  assert(last().payout === 10000, 'Später gesetzte Chips: kein Bonus');
  // Teilweise in der Strähne (Blackjack: Einsatz vorher, Verdoppeln währenddessen) → Bonus anteilig
  GK.casino.bet(100, 'blackjack');
  GK.progress.addBuff('luck', 1.4);
  GK.casino.bet(100, 'blackjack');
  s.buffs = [];
  GK.casino.payout(400);
  GK.casino.record('blackjack', 200, 400, 'Test');
  assert(last().payout === 440, `Halber Einsatz in der Strähne: Bonus auf die Hälfte (40 % von 100 = ${last().payout - 400})`);
  // Mehrere Runden aus einem Einsatz (Münzfall-Massenwurf)
  GK.progress.addBuff('luck', 1.3);
  GK.casino.bet(300, 'plinko');
  s.buffs = [];
  [200, 50, 100].forEach(p => { GK.casino.payout(p); GK.casino.record('plinko', 100, p, 'Test'); });
  assert(c.history[2].payout === 230 && c.history[1].payout === 50 && c.history[0].payout === 100 && !c.luck.plinko, 'Massenwurf: jede Kugel nutzt ihren Teil');
}

// ---------- Buffs: Restzeit gedeckelt, Belohnungen ohne Buffs ----------
{
  s.buffs = [{ id: 'clickfever', type: 'click', mult: 25, until: GK.now() + 365 * 86400e3 }];
  const fever = GK.progress.buffMult('click');
  assert(fever === 25 && s.buffs[0].until <= GK.now() + 31e3, 'Buff aus einem bearbeiteten Spielstand hält höchstens seine Dauer');
  assert(close(C.getClickPower(), C.getClickPowerPermanent() * 25), 'Klickfieber wirkt auf Klicks …');
  s.buffs.push({ id: 'goldrush', type: 'income', mult: 7, until: GK.now() + 10000 });
  const perm = C.getClickPowerPermanent();
  s.buffs = [];
  assert(close(perm, C.getClickPower()), '… aber nicht auf die Klickkraft für Belohnungen (Tagesaufgaben, Kraken, Schatzfund)');
}

console.log(process.exitCode ? 'Bonus-Tests FEHLGESCHLAGEN' : 'Bonus-Tests bestanden.');
