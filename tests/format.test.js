// Tests für Beträge mit Abkürzungen (500k, 2,5M, 1B, 3 Mio. …). Ausführen mit: node tests/format.test.js
global.window = global;
require(require('path').join(__dirname, '..', 'js', 'format.js'));
const assert = (cond, msg) => { if (!cond) { console.log('FAIL', msg); process.exitCode = 1; } };
const cases = {
  '5M': 5e6, '5m': 5e6, '2,5M': 2.5e6, '2.5M': 2.5e6, '2,3M': 2.3e6, '.5M': 5e5,
  '1B': 1e9, '1 Mrd.': 1e9, '2,5 Mrd.': 2.5e9, '1 Bio.': 1e12, '1 Billion': 1e12,
  '500k': 5e5, '500K': 5e5, '7 Tsd': 7000, '3 Mio.': 3e6, '3 Millionen': 3e6, '1,23 Mio.': 1.23e6,
  '1.000.000': 1e6, '1.000': 1000, '1,000,000': 1e6, '1.234,56': 1234.56, '12345': 12345, '1 000 000': 1e6, '0': 0,
};
for (const [text, want] of Object.entries(cases)) assert(GK.parseAmount(text) === want, `${text} → ${GK.parseAmount(text)} statt ${want}`);
for (const text of ['', 'abc', '5x', '5M5', 'M', '-5', '5..5', '1,2,3,4.5', '12.34.5']) assert(Number.isNaN(GK.parseAmount(text)), `${text} sollte unbekannt sein`);
// Was im Feld steht, lässt sich wieder genau einlesen
for (const n of [1, 999, 1000, 12345, 1234567, 2.5e6, 2.3e6, 5e6, 1e9, 1.25e9, 1e12, 7.77e15, 123456789]) {
  assert(GK.parseAmount(GK.formatAmount(n)) === n, `${n} → ${GK.formatAmount(n)} → ${GK.parseAmount(GK.formatAmount(n))}`);
}
console.log(process.exitCode ? 'Format-Tests FEHLGESCHLAGEN' : 'Format-Tests bestanden.');
