// Tests für die eigene Figur: Code prüfen (nur bekannte Teile), Zeichnen, Vorlagen (John Pork),
// gesperrte Teile, Namensschild und Rangliste, alte Spielstände. Ausführen mit: node tests/figure.test.js
global.window = global;
global.document = { addEventListener() {}, querySelector() { return null; }, getElementById() { return null; }, visibilityState: 'visible' };
global.location = { search: '', pathname: '/', origin: '', hash: '' };
global.history = { replaceState() {} };
const R = require('path').join(__dirname, '..', 'js') + '/';
require(R + 'format.js');
require(R + 'savecode.js');
require(R + 'state.js');
require(R + 'casino/casino.js');
require(R + 'progress.js');
require(R + 'clicker.js');
require(R + 'rank.js');
require(R + 'figure.js');
require(R + 'cosmetics.js');
require(R + 'friends.js');
const assert = (cond, msg) => { if (!cond) { console.log('FAIL', msg); process.exitCode = 1; } };
const F = GK.figure;
const s = GK.state;

// ---------- Code prüfen ----------
{
  assert(F.valid('3.0.0.0.1.4.4') === '3.0.0.0.1.4.4', 'Gültiger Code bleibt');
  assert(F.valid('03.0.0.0.1.4.4') === '3.0.0.0.1.4.4', 'Führende Nullen werden bereinigt');
  ['', null, undefined, 42, '1.2.3', '1.2.3.4.5.6.7.8', '99.0.0.0.0.0.0', '0.0.0.0.0.0.-1', '<b>.0.0.0.0.0.0', '0.0.0.0.0.0.0<script>', 'a.b.c.d.e.f.g']
    .forEach(bad => assert(F.valid(bad) === '', `Ungültiger Code abgelehnt: ${String(bad)}`));
  F.SLOTS.forEach((slot, i) => {
    const max = Array(7).fill(0);
    max[i] = slot.parts.length - 1;
    assert(F.valid(max.join('.')) === max.join('.'), `${slot.name}: letztes Teil gültig`);
    max[i] = slot.parts.length;
    assert(F.valid(max.join('.')) === '', `${slot.name}: dahinter ungültig`);
  });
}

// ---------- Zeichnen: jede Kombination jedes Platzes ----------
{
  let count = 0;
  F.SLOTS.forEach((slot, i) => slot.parts.forEach((_, j) => {
    const p = [3, 0, 0, 0, 1, 4, 4];
    p[i] = j;
    const svg = F.svg(p.join('.'));
    count++;
    assert(svg.startsWith('<svg') && svg.endsWith('</svg>') && !/ id=/.test(svg) && !/undefined|NaN/.test(svg), `SVG für ${slot.name} „${slot.parts[j].name}“`);
  }));
  assert(count > 50, `Viele Teile (${count})`);
  assert(F.svg('3.0.0.0.1.4.4') === F.svg('3.0.0.0.1.4.4'), 'Gleicher Code, gleiches Bild');
}

// ---------- Vorlagen: John Pork ----------
{
  const pork = F.PRESETS.find(p => p.name === 'John Pork');
  assert(pork && F.valid(pork.code) === pork.code, 'John Pork ist eine gültige Vorlage');
  const parts = F.parse(pork.code);
  assert(F.SLOTS[0].parts[parts[0]].name === 'Schwein' && F.SLOTS[4].parts[parts[4]].name === 'Anzug' && F.SLOTS[6].parts[parts[6]].name === 'Handy', 'John Pork: Schweinekopf, Anzug, Handy');
  F.PRESETS.forEach(p => {
    assert(F.valid(p.code) === p.code, `Vorlage ${p.name} gültig`);
    assert(F.parse(p.code).every((part, slot) => F.unlocked(slot, part)), `Vorlage ${p.name} braucht keine Freischaltung`);
  });
}

// ---------- Gesperrte Teile ----------
{
  const crown = F.SLOTS[1].parts.findIndex(p => p.name === 'Krone');
  const chain = F.SLOTS[6].parts.findIndex(p => p.name === 'Goldkette');
  s.casino.vip = 0;
  s.prestige.points = 0;
  assert(!F.unlocked(1, crown) && !F.unlocked(6, chain), 'Krone und Goldkette am Anfang gesperrt');
  F.set(`0.${crown}.0.0.0.0.${chain}`);
  assert(s.player.fig === '0.0.0.0.0.0.0' && s.player.figOn, 'Gesperrte Teile lassen sich nicht anlegen');
  s.player.fig = `0.${crown}.0.0.0.0.${chain}`; // bearbeiteter Spielstand
  assert(F.mine() === '0.0.0.0.0.0.0', 'Bearbeiteter Spielstand: gesperrte Teile werden nicht gezeigt oder verschickt');
  s.casino.vip = 2;
  s.prestige.points = 7e6;
  assert(F.unlocked(1, crown) && F.unlocked(6, chain), 'Mit VIP-Karte Gold und 7 Mio. Schatzkarten freigeschaltet');
  F.set(`0.${crown}.0.0.0.0.${chain}`);
  assert(s.player.fig === `0.${crown}.0.0.0.0.${chain}` && F.mine() === s.player.fig, 'Jetzt angelegt');
  // Zufall nur aus freigeschalteten Teilen
  s.casino.vip = 0;
  s.prestige.points = 0;
  for (let i = 0; i < 200; i++) {
    const code = F.randomCode();
    assert(F.parse(code).every((part, slot) => F.unlocked(slot, part)), 'Zufall nimmt nur freigeschaltete Teile');
  }
}

// ---------- Anzeigen: Namensschild und Rangliste ----------
{
  s.player.figOn = false;
  assert(F.mine() === '', 'Ausgeschaltet: man ist mit dem Emoji zu sehen');
  s.player.figOn = true;
  s.player.fig = '3.0.0.0.1.4.4';
  const tag = GK.cosmetics.nameTag({ name: 'Rafael', avatar: '😎', fig: F.mine() });
  assert(/fig-mini/.test(tag) && !/😎/.test(tag) && /Rafael/.test(tag), 'Namensschild zeigt die Figur statt des Emojis');
  assert(!/fig-mini/.test(GK.cosmetics.nameTag({ name: 'Ben', avatar: '🐸', fig: '<img src=x>' })), 'Kaputter Code: Emoji statt Figur');
  assert(GK.friends.myRecords().fig === '3.0.0.0.1.4.4', 'Figur wird in der Rangliste mitgeschickt');
  const anna = GK.friends.clean({ id: 'ANNA12345678', name: 'Anna', fig: '4.2.0.1.0.0.3' });
  const evil = GK.friends.clean({ id: 'EVIL12345678', name: 'Evil', fig: '"><script>alert(1)</script>' });
  assert(anna.fig === '4.2.0.1.0.0.3' && evil.fig === '', 'Empfangene Figuren werden geprüft');
}

// ---------- Alte Spielstände ----------
{
  const old = JSON.parse(JSON.stringify(GK.state));
  delete old.player.fig;
  delete old.player.figOn;
  global.atob = x => Buffer.from(x, 'base64').toString('binary');
  assert(GK.importSave(Buffer.from(JSON.stringify(old)).toString('base64')), 'Alter Spielstand lädt');
  assert(GK.state.player.fig === '' && GK.state.player.figOn === false && GK.figure.mine() === '', 'Ohne Figur: Emoji wie bisher');
  assert(GK.figure.current() === GK.figure.DEFAULT, 'Baukasten startet mit einer Standard-Figur');
}

console.log(process.exitCode ? 'Figur-Tests FEHLGESCHLAGEN' : 'Figur-Tests bestanden.');
