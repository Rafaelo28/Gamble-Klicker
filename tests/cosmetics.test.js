// Tests für die Schatzkammer: Katalog, Preise und das Glücksrad nach der großen Fahrt.
// Ausführen mit: node tests/cosmetics.test.js
global.window = global;
const R = require('path').join(__dirname, '..', 'js') + '/';
require(R + 'casino/casino.js');
require(R + 'cosmetics.js');
const assert = (cond, msg) => { if (!cond) { console.log('FAIL', msg); process.exitCode = 1; } };
const C = GK.cosmetics;

// Katalog: 3 Kategorien mit Standard + 5 Cosmetics (2 selten, 2 episch, 1 legendär), eindeutige IDs
assert(C.CATEGORIES.length === 3, 'drei Kategorien');
C.CATEGORIES.forEach(cat => {
  const r = cat.items.map(i => i.rarity);
  assert(cat.items.length === 6 && r[0] === 'common', `${cat.name}: Standard + 5`);
  assert(r.filter(x => x === 'rare').length === 2 && r.filter(x => x === 'epic').length === 2 && r.filter(x => x === 'legendary').length === 1,
    `${cat.name}: 2 selten, 2 episch, 1 legendär`);
});
assert(new Set(C._ITEMS.map(i => i.id)).size === C._ITEMS.length && C.total === 15, 'eindeutige IDs, 15 zum Sammeln');
// Je seltener, desto teurer – in Dublonen und in Gebäuden
const { rare, epic, legendary } = C.RARITIES;
assert(rare.price < epic.price && epic.price < legendary.price, 'Preise steigen');
assert(rare.share < epic.share && epic.share < legendary.share && legendary.share < 1, 'Gebäude-Anteil steigt');
assert(rare.minBuildings < epic.minBuildings && epic.minBuildings < legendary.minBuildings, 'Mindestzahl an Gebäuden steigt');

// Glücksrad: 8 Felder, höchstens 5 Cosmetics (nur solche, die man noch nicht hat), mindestens 3× Flaute
GK.state = { cosmetics: { owned: [], equipped: {}, wheel: null }, buildings: {} };
const seen = { rare: 0, epic: 0, legendary: 0 };
for (let k = 0; k < 20000; k++) {
  const segs = C._createWheel().segments;
  const items = segs.filter(Boolean);
  assert(segs.length === 8 && items.length === 5 && new Set(items).size === 5, 'Rad: 8 Felder, 5 verschiedene Cosmetics');
  items.forEach(id => { seen[C._ITEMS.find(i => i.id === id).rarity]++; });
}
// pro Cosmetic: seltene Sachen landen häufiger auf dem Rad als legendäre
assert(seen.rare / 6 > seen.epic / 6 && seen.epic / 6 > seen.legendary / 3, `Rad: selten > episch > legendär (${JSON.stringify(seen)})`);
// Fast alles gesammelt: nur die fehlenden stehen auf dem Rad, der Rest ist Flaute
GK.state.cosmetics.owned = C._ITEMS.filter(i => i.rarity !== 'common' && !['royal', 'flames'].includes(i.id)).map(i => i.id);
for (let k = 0; k < 200; k++) {
  const items = C._createWheel().segments.filter(Boolean).sort();
  assert(items.join() === 'flames,royal', `Rad: nur fehlende Cosmetics (${items})`);
}
assert(C.unownedCount() === 2, 'zwei fehlen noch');
console.log(process.exitCode ? 'Schatzkammer-Tests FEHLGESCHLAGEN' : 'Schatzkammer-Tests bestanden.');
