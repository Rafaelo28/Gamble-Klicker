// Tests für die Hafenbörse: Kursmodell (man macht fast immer Verlust), Kurse weiterrechnen, Kaufen und
// Verkaufen (Geldfluss, Verlauf), Pleiten. Ausführen mit: node tests/stocks.test.js
global.window = global;
global.document = { addEventListener() {}, querySelector() { return null; }, getElementById() { return null; }, visibilityState: 'visible' };
global.location = { search: '', pathname: '/', origin: '', hash: '' };
global.history = { replaceState() {} };
const R = require('path').join(__dirname, '..', 'js') + '/';
require(R + 'format.js');
require(R + 'state.js');
require(R + 'casino/casino.js');
require(R + 'casino/stocks.js');
// Für die Casino-Übersicht, die record() nebenbei aktualisiert
document.getElementById = () => ({});
GK.poker = { tournament: { TIERS: [] } };
GK.sound = { play() {} };
GK.notify = () => {};
const unlocked = [];
GK.unlockAchievement = id => unlocked.push(id);
const assert = (cond, msg) => { if (!cond) { console.log('FAIL', msg); process.exitCode = 1; } };
const M = GK.casino.stockMath;

// Schneller, reproduzierbarer Zufall für die vielen Simulationen
let seed = 12345;
const fast = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const realRng = GK.rng;
GK.rng = { float: fast, int: max => Math.floor(fast() * max), weighted: realRng.weighted };

// ---------- Kursmodell: fast immer Verlust ----------
{
  const N = 1500;
  Object.keys(M.PROFILES).forEach(profile => {
    const run = (f) => {
      let wins = 0;
      let sum = 0;
      for (let i = 0; i < N; i++) {
        const r = f();
        if (r > 0) wins++;
        sum += r;
      }
      return { wins: wins / N, mean: sum / N };
    };
    const hold = run(() => M.simulateTrade(profile, 60 + Math.floor(fast() * 1140), 0));
    const quick = run(() => M.simulateTrade(profile, 10, 0));
    const take = run(() => M.simulateTrade(profile, 1800, 0.01));
    console.log(`Börse ${profile}: halten 1–20 Min. ${(hold.wins * 100).toFixed(1)} % Gewinn (Schnitt ${(hold.mean * 100).toFixed(0)} %), ` +
      `Gewinnmitnahme ab +1 % ${(take.wins * 100).toFixed(1)} % Gewinn (Schnitt ${(take.mean * 100).toFixed(0)} %)`);
    assert(hold.wins < 0.08 && hold.mean < -0.1, `${profile}: Halten bringt fast immer Verlust (${(hold.wins * 100).toFixed(1)} %)`);
    assert(take.wins < 0.18 && take.mean < -0.2, `${profile}: Auch schnelle Gewinnmitnahme verliert meistens (${(take.wins * 100).toFixed(1)} %)`);
    assert(quick.wins < 0.03 && quick.mean < -0.02, `${profile}: Sofort wieder verkaufen kostet die Spanne`);
  });
  // Firmen gehen irgendwann pleite (wilde schneller)
  ['calm', 'wild'].forEach(profile => {
    let bust = 0;
    for (let i = 0; i < 200; i++) {
      const st = { profile, price: 100, ipo: 100 };
      for (let t = 0; t < 6 * 60; t++) M.step(st, 60);
      if (st.price < st.ipo * M.BANKRUPT) bust++;
    }
    assert(bust > 160, `${profile}: nach 6 Stunden fast alle pleite (${bust}/200)`);
  });
}

// ---------- Kurse weiterrechnen ----------
const s = M.state();
{
  const t0 = 1_800_000_000_000;
  M.tick(t0);
  assert(s.stocks.length === 6 && new Set(s.stocks.map(x => x.id)).size === 6, 'Sechs verschiedene Firmen an der Börse');
  assert(s.stocks.every(x => x.hist.length === 144 && x.price > x.ipo * M.BANKRUPT), 'Mit 12 Minuten Vorgeschichte, keine pleite');
  assert(s.stocks.every(x => M.COMPANIES.slice(0, 6).some(c => c.id === x.id)), 'Am Anfang die sechs ersten Firmen');
  const before = s.stocks.map(x => x.price);
  assert(M.tick(t0 + 999) === false, 'Unter einer Sekunde passiert nichts');
  M.tick(t0 + 1000);
  assert(s.stocks.some((x, i) => x.price !== before[i]), 'Nach einer Sekunde bewegen sich die Kurse');
  const len = s.stocks[0].hist.length;
  M.tick(t0 + 11000);
  assert(s.stocks[0].hist.length === 144 && s.lastTick === t0 + 11000, 'Verlauf bleibt bei 144 Punkten');
  // Lange Pause: höchstens 8 Stunden nachrechnen, danach wieder sechs Firmen (Pleiten ersetzt)
  M.tick(t0 + 11000 + 20 * 3600 * 1000);
  assert(s.lastTick === t0 + 11000 + 20 * 3600 * 1000, 'Nach der Pause auf dem neuesten Stand');
  assert(s.stocks.length === 6 && new Set(s.stocks.map(x => x.id)).size === 6 && s.stocks.every(x => x.price > x.ipo * M.BANKRUPT), 'Nach 8 Stunden: wieder sechs lebende Firmen');
  assert(len === 144, 'Verlauf voll');
}

// ---------- Kaufen und verkaufen ----------
{
  GK.state.money = 100000;
  const c = GK.state.casino;
  const wagered0 = c.wagered;
  const won0 = c.won;
  const stock = s.stocks[0];
  s.selected = stock.uid;
  s.bet = 1000;
  const now = s.lastTick;
  const realNow = Date.now;
  Date.now = () => now; // keine Kursänderung zwischen den Schritten
  M.buy();
  const h = s.holdings[stock.uid];
  assert(GK.state.money === 99000 && c.wagered === wagered0 + 1000, 'Kauf zieht den Betrag ab');
  assert(h && Math.abs(h.shares - 1000 / (stock.price * M.BUY)) < 1e-9 && h.cost === 1000, 'Anteile zum Kaufkurs');
  M.buy();
  assert(Math.abs(s.holdings[stock.uid].cost - 2000) < 1e-9, 'Zweiter Kauf: Anteile kommen dazu');
  const shares = s.holdings[stock.uid].shares;
  const rounds = c.rounds;
  M.sell(0.5);
  const half = Math.floor(shares / 2 * stock.price * M.SELL);
  assert(GK.state.money === 98000 + half && c.won === won0 + half, `Hälfte verkauft (${half})`);
  assert(Math.abs(s.holdings[stock.uid].shares - shares / 2) < 1e-9 && Math.abs(s.holdings[stock.uid].cost - 1000) < 1e-9, 'Die andere Hälfte bleibt im Depot');
  assert(c.rounds === rounds + 1 && c.history[0].game === 'stocks' && c.history[0].bet === 1000 && c.history[0].payout === half, 'Verkauf als Runde verbucht');
  assert(half < 1000, 'Sofort wieder verkauft: Verlust durch die Spanne');
  M.sell(1);
  assert(!s.holdings[stock.uid] && GK.state.money === 98000 + 2 * half, 'Rest verkauft, Depot leer');
  // Zu wenig Geld
  GK.state.money = 10;
  M.buy();
  assert(GK.state.money === 10 && !s.holdings[stock.uid], 'Ohne genug Dublonen kein Kauf');
  // Verkaufen ohne Anteile tut nichts
  M.sell(1);
  assert(GK.state.money === 10, 'Ohne Anteile nichts zu verkaufen');
  // Gewinn möglich (Kurs steigt stark): Erfolg „Wolf vom Hafen“
  GK.state.money = 1000;
  M.buy();
  stock.price *= 1.5;
  M.sell(1);
  assert(GK.state.money > 1000 && unlocked.includes('stockWin'), 'Mit Gewinn verkauft');
  Date.now = realNow;
}

// ---------- Pleite mit Anteilen ----------
{
  GK.state.money = 5000;
  const stock = s.stocks[2];
  s.selected = stock.uid;
  s.bet = 2000;
  const realNow = Date.now;
  Date.now = () => s.lastTick;
  M.buy();
  Date.now = realNow;
  const rounds = GK.state.casino.rounds;
  stock.price = stock.ipo * M.BANKRUPT * 0.5;
  M.tick(s.lastTick + 1000);
  assert(!s.holdings[stock.uid], 'Pleite: Anteile weg');
  assert(GK.state.casino.rounds === rounds + 1 && GK.state.casino.history[0].payout === 0 && GK.state.casino.history[0].bet === 2000, 'Pleite als verlorene Runde verbucht');
  assert(unlocked.includes('stockCrash'), 'Erfolg „Totalverlust“');
  assert(s.stocks.length === 6 && !s.stocks.includes(stock) && s.stocks[2].id !== stock.id, 'Neue Firma an ihrer Stelle');
  assert(s.selected === s.stocks[2].uid, 'Auswahl springt auf die neue Firma');
  assert(s.news.some(n => /pleite/.test(n.text)) && s.news.some(n => /Neu an der Börse/.test(n.text)), 'Nachrichten zur Pleite und zum Börsengang');
  assert(GK.state.money === 3000, 'Geld bleibt weg');
}

// ---------- Spielstand ----------
{
  const json = JSON.stringify(GK.state.casino.games.stocks);
  assert(json.length < 20000, `Börse im Spielstand klein (${json.length} Zeichen)`);
}

console.log(process.exitCode ? 'Börsen-Tests FEHLGESCHLAGEN' : 'Börsen-Tests bestanden.');
