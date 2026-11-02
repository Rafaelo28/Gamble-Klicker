// Tests für Ränge (je 1.000-mal mehr insgesamt verdient, ohne Ende), Rang-Teile der Figur, Rang in
// Namensschild und Freundes-Rangliste sowie die neuen Gebäude nach dem Sternenportal.
// Ausführen mit: node tests/rank.test.js
global.window = global;
global.document = { addEventListener() {}, querySelector() { return null; }, getElementById() { return null }, visibilityState: 'visible' };
global.location = { search: '', pathname: '/', origin: '', hash: '' };
global.history = { replaceState() {} };
const R = require('path').join(__dirname, '..', 'js') + '/';
require(R + 'format.js');
require(R + 'state.js');
require(R + 'casino/casino.js');
require(R + 'progress.js');
require(R + 'clicker.js');
require(R + 'rank.js');
require(R + 'figure.js');
require(R + 'cosmetics.js');
require(R + 'friends.js');
require(R + 'achievements.js');
const assert = (cond, msg) => { if (!cond) { console.log('FAIL', msg); process.exitCode = 1; } };
const K = GK.rank;
const s = GK.state;
let toasts = [];
GK.toast = t => toasts.push(t);
GK.sound = { play() {} };
GK.save = () => true;

// ---------- Ränge ----------
{
  assert(K.of(0) === 0 && K.name(0) === 'Landratte', 'Start: Landratte');
  assert(K.of(999) === 0 && K.of(1000) === 1 && K.name(1) === 'Schiffsjunge', 'Ab 1.000: Schiffsjunge');
  assert(K.of(1e6 - 1) === 1 && K.of(1e6) === 2, 'Grenze genau bei 1 Mio.');
  // Jede Grenze ist genau 1000^r (über „1e…“ geschrieben, damit jedes Gerät gleich rechnet)
  for (let r = 1; r <= 100; r++) {
    const t = K.threshold(r);
    assert(t === Number(`1e${3 * r}`) && K.of(t) === r && K.of(t * 0.999) === r - 1, `Grenze Rang ${r}`);
  }
  assert(K.name(K.of(3.43e28)) === 'Admiral', '7 Mio. Schatzkarten (≈ 3,4 Quadrd. verdient): Admiral');
  assert(K.name(12) === 'Herrscher der Meere' && K.name(13) === 'Legende I' && K.name(14) === 'Legende II' &&
    K.name(16) === 'Legende IV' && K.name(21) === 'Legende IX' && K.name(61) === 'Legende XLIX', 'Danach: Legende I, II, … ohne Ende');
  const names = new Set();
  for (let r = 0; r < 300; r++) names.add(K.name(r));
  assert(names.size === 300, 'Jeder Rang hat einen eigenen Namen');
  for (const bad of [-1, 1.5, '3', null, undefined, NaN, Infinity, 1000, { r: 1 }]) assert(K.valid(bad) === 0, `Ungültiger Rang abgelehnt: ${String(bad)}`);
  assert(K.valid(9) === 9 && K.valid(999) === 999, 'Gültige Ränge bleiben');
  assert(K.tag(0) === '' && /title="Admiral"/.test(K.tag(9)) && K.tag('<b>') === '', 'Rang-Zeichen: nicht für Landratten, nur gültige Ränge');
  // Fortschritt zum nächsten Rang
  const p = K.progress(3.16e28);
  assert(p.rank === 9 && p.next === 10 && p.to === 1e30 && p.frac > 0.49 && p.frac < 0.51, `Fortschritt logarithmisch (${p.frac})`);
  assert(K.progress(0).frac === 0 && K.progress(500).frac === 0.5 && K.progress(1e6).frac === 0, 'Fortschritt am Anfang und an der Grenze');
  assert(Number.isFinite(K.progress(Infinity).frac) && Number.isFinite(K.progress(NaN).frac), 'Fortschritt ohne NaN');
}

// ---------- Neuer Rang wird einmal gemeldet ----------
{
  s.allTimeEarned = 0;
  s.rankSeen = 0;
  toasts = [];
  assert(!K.check() && toasts.length === 0, 'Kein neuer Rang: keine Meldung');
  s.allTimeEarned = 5e21;
  assert(K.check() && toasts.length === 1 && /Kapitän/.test(toasts[0]) && s.rankSeen === 7, 'Mehrere Ränge auf einmal: nur der höchste wird gemeldet');
  assert(!K.check() && toasts.length === 1, 'Nicht doppelt melden');
  // Große Fahrt: „insgesamt verdient“ bleibt, der Rang sinkt nie
  s.totalEarned = 0;
  s.money = 0;
  assert(K.mine() === 7, 'Rang bleibt nach der großen Fahrt');
  // Erfolge für Ränge
  s.achievements = [];
  GK.unlockAchievement = id => { if (!s.achievements.includes(id)) s.achievements.push(id); };
  const ach = GK.achievements.ACHIEVEMENTS;
  const byId = id => ach.find(a => a.id === id);
  assert(byId('rankCaptain').check(s) && !byId('rankAdmiral').check(s) && !byId('rankLegend').check(s), 'Erfolg Kapitän erreicht');
  s.allTimeEarned = 2e39;
  assert(byId('rankAdmiral').check(s) && byId('rankLegend').check(s), 'Erfolge Admiral und Legende');
}

// ---------- Figur-Teile ab einem Rang ----------
{
  const F = GK.figure;
  const parts = F.rankParts();
  assert(parts.length >= 6 && parts.every((x, i) => i === 0 || x.rank >= parts[i - 1].rank), 'Rang-Belohnungen nach Rang sortiert');
  const find = name => {
    for (let i = 0; i < F.SLOTS.length; i++) {
      const j = F.SLOTS[i].parts.findIndex(p => p.name === name);
      if (j >= 0) return [i, j];
    }
    return null;
  };
  s.allTimeEarned = 0;
  parts.forEach(x => {
    const [i, j] = find(x.name);
    assert(!F.unlocked(i, j), `${x.name} am Anfang gesperrt`);
    assert(F.SLOTS[i].parts[j].hint === `Ab Rang ${K.name(x.rank)}`, `${x.name}: Hinweis nennt den Rang`);
    s.allTimeEarned = K.threshold(x.rank) * 0.99;
    assert(!F.unlocked(i, j), `${x.name} knapp darunter gesperrt`);
    s.allTimeEarned = K.threshold(x.rank);
    assert(F.unlocked(i, j), `${x.name} ab Rang ${K.name(x.rank)} frei`);
    const code = [0, 0, 0, 0, 0, 0, 0];
    code[i] = j;
    const svg = F.svg(code.join('.'));
    assert(svg.startsWith('<svg') && !/undefined|NaN/.test(svg), `${x.name} wird gezeichnet`);
    s.allTimeEarned = 0;
  });
  // Gesperrt anlegen geht nicht, freigeschaltet schon
  const [hi, hj] = find('Admiralshut');
  F.set(`0.${hj}.0.0.0.0.0`);
  assert(s.player.fig === '0.0.0.0.0.0.0', 'Admiralshut ohne Rang nicht anlegbar');
  s.allTimeEarned = 1e27;
  F.set(`0.${hj}.0.0.0.0.0`);
  assert(s.player.fig === `0.${hj}.0.0.0.0.0` && hi === 1, 'Als Admiral anlegbar');
  // Alte Figur-Codes bleiben gültig (neue Teile nur hinten angehängt)
  F.PRESETS.forEach(p => assert(F.valid(p.code) === p.code, `Vorlage ${p.name} weiter gültig`));
}

// ---------- Namensschild und Freundes-Rangliste ----------
{
  s.allTimeEarned = 3.43e28;
  const tag = GK.cosmetics.nameTag({ name: 'Ben', avatar: '🐸', rank: 9 });
  assert(/rank-ico/.test(tag) && /🌟/.test(tag) && /Ben/.test(tag), 'Namensschild zeigt das Rang-Zeichen');
  assert(!/rank-ico/.test(GK.cosmetics.nameTag({ name: 'Ben', avatar: '🐸' })), 'Ohne Rang (ältere Version) kein Zeichen');
  assert(!/rank-ico/.test(GK.cosmetics.nameTag({ name: 'Ben', avatar: '🐸', rank: '"><img src=x>' })), 'Kaputter Rang: kein Zeichen');
  assert(GK.friends.myRecords().rank === 9, 'Rang wird in der Rangliste mitgeschickt');
  assert(GK.friends.BOARDS.some(b => b.id === 'rank'), 'Rangliste nach Rang');
  const anna = GK.friends.clean({ id: 'ANNA12345678', name: 'Anna', rank: 13 });
  const old = GK.friends.clean({ id: 'OLDV12345678', name: 'Old', earned: 2e15 });
  const none = GK.friends.clean({ id: 'NONE12345678', name: 'None' });
  const evil = GK.friends.clean({ id: 'EVIL12345678', name: 'Evil', rank: 1e9 });
  assert(anna.rank === 13 && old.rank === 5 && none.rank === null && evil.rank === 0, `Empfangene Ränge geprüft (${anna.rank}, ${old.rank}, ${none.rank}, ${evil.rank})`);
}

// ---------- Neue Gebäude nach dem Sternenportal ----------
{
  const B = GK.clicker.BUILDINGS;
  const portal = B.findIndex(b => b.id === 'portal');
  const after = B.slice(portal + 1);
  assert(after.length === 8, `8 neue Gebäude (${after.length})`);
  assert(new Set(B.map(b => b.id)).size === B.length, 'Gebäude-IDs eindeutig');
  B.forEach((b, i) => {
    if (i === 0) return;
    assert(b.baseCost > B[i - 1].baseCost * 5 && b.baseCps > B[i - 1].baseCps * 4, `${b.name} teurer und stärker als ${B[i - 1].name}`);
    // Ein neues Gebäude bringt pro Dublone etwas weniger als das vorige, aber nicht viel weniger
    const ratio = (b.baseCps / b.baseCost) / (B[i - 1].baseCps / B[i - 1].baseCost);
    if (i > portal) assert(ratio > 0.4 && ratio < 1, `${b.name}: Preis-Leistung passt (${ratio.toFixed(2)})`);
  });
  // Upgrades für die neuen Gebäude werden automatisch erzeugt
  s.upgrades = [];
  s.buildings = {};
  B.forEach(b => { s.buildings[b.id] = 0; });
  s.buildings.portal = 300;
  const cps0 = GK.clicker.getCps();
  s.buildings.bigbang = 1;
  assert(GK.clicker.getCps() > cps0, 'Dublonen-Urknall bringt Einkommen');
  assert(GK.clicker.ownsAllBuildings() === false, 'Für „Von allem etwas“ braucht man jetzt auch die neuen Gebäude');
  const before = GK.clicker.remainingUpgrades();
  s.upgrades = ['bigbang-1', 'syn-bigbang', 'global6', 'global7'];
  assert(GK.clicker.remainingUpgrades() === before - 4, 'Upgrades für die neuen Gebäude und „Alle Gebäude“ gibt es');
  // Wert eines Riesen-Imperiums bleibt eine endliche Zahl
  B.forEach(b => { s.buildings[b.id] = 400; });
  assert(Number.isFinite(GK.clicker.buildingsWorth()) && Number.isFinite(GK.clicker.getCps()), 'Riesige Zahlen bleiben endlich');
  assert(!/e\+/.test(GK.formatNumber(GK.clicker.buildingsWorth())), `Gebäudewert lesbar: ${GK.formatNumber(GK.clicker.buildingsWorth())}`);
}

// ---------- Alte Spielstände ----------
{
  const old = JSON.parse(JSON.stringify(GK.state));
  delete old.rankSeen;
  old.allTimeEarned = 2e12;
  old.buildings = { finger: 3 };
  global.atob = x => Buffer.from(x, 'base64').toString('binary');
  assert(GK.importSave(Buffer.from(JSON.stringify(old)).toString('base64')), 'Alter Spielstand lädt');
  assert(GK.state.rankSeen === 0 && K.mine() === 4, 'Rang aus „insgesamt verdient“');
  toasts = [];
  assert(K.check() && toasts.length === 1 && /Steuermann/.test(toasts[0]), 'Beim ersten Laden einmal den Rang melden');
}

console.log(process.exitCode ? 'Rang-Tests FEHLGESCHLAGEN' : 'Rang-Tests bestanden.');
