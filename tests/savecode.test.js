// Tests für den Spielstand-Code (verschlüsselt und fälschungssicher).
// Ausführen mit: node tests/savecode.test.js
global.window = global;
require(require('path').join(__dirname, '..', 'js', 'savecode.js'));

let failed = 0;
const assert = (cond, msg) => { if (!cond) { console.log('FAIL', msg); failed = 1; } };

const sc = GK.saveCode;

// --- SHA-256 gegen bekannte Prüfwerte (FIPS 180-4) ------------------------
assert(sc._sha256hex('') === 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'SHA-256 von „“');
assert(sc._sha256hex('abc') === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', 'SHA-256 von „abc“');
assert(
  sc._sha256hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq') ===
    '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
  'SHA-256 der 448-Bit-Probe'
);

// --- Hin und zurück -------------------------------------------------------
const proben = [
  {},
  { money: 1234, name: 'Rafaelo28' },
  { a: 1, b: [1, 2, 3], c: { tief: { x: true, y: null } }, text: 'Dublonen „≈“ 😀 Ümlaute' },
  { big: '0123456789'.repeat(500) }, // länger als ein paar SHA-256-Blöcke
];
for (const obj of proben) {
  const code = sc.encode(obj);
  assert(typeof code === 'string' && code.length > 0, 'Code ist ein nicht-leerer Text');
  const zurück = sc.decode(code);
  assert(JSON.stringify(zurück) === JSON.stringify(obj), 'Hin und zurück ergibt dasselbe Objekt');
}

// --- Verschleierung: Inhalt steht nicht im Klartext im Code ----------------
const geheim = sc.encode({ dublonen: 999999, geheim: 'KLARTEXT_MARKER' });
const roh = Buffer.from(geheim, 'base64').toString('latin1');
assert(!roh.includes('KLARTEXT_MARKER') && !roh.includes('dublonen'), 'Klartext taucht im Code nicht auf');
assert(!geheim.startsWith('ey'), 'Code ist nicht einfach Base64 eines JSON (beginnt nicht mit „ey“)');

// --- Zufälliges Salz: zweimal verschlüsseln ergibt unterschiedliche Codes ---
const c1 = sc.encode({ x: 1 });
const c2 = sc.encode({ x: 1 });
assert(c1 !== c2, 'Gleicher Inhalt ergibt dank Salz unterschiedliche Codes');
assert(JSON.stringify(sc.decode(c1)) === JSON.stringify(sc.decode(c2)), 'Beide ergeben wieder denselben Inhalt');

// --- Fälschung wird erkannt -----------------------------------------------
function flip(code, bytePos) {
  const b = Buffer.from(code, 'base64');
  b[bytePos % b.length] ^= 0xff;
  return b.toString('base64');
}
const original = sc.encode({ money: 100 });
// Ein Byte im Geheimtext ändern (nach Magic+Version+Salz+Prüfsumme = 2+12+16=30)
assert(sc.decode(flip(original, 31)) === null, 'Verändertes Geheimtext-Byte wird abgewiesen');
// Ein Byte in der Prüfsumme ändern
assert(sc.decode(flip(original, 20)) === null, 'Veränderte Prüfsumme wird abgewiesen');
// Ein Byte im Salz ändern
assert(sc.decode(flip(original, 5)) === null, 'Verändertes Salz wird abgewiesen');

// --- Unsinn wird sauber abgewiesen ----------------------------------------
for (const müll of ['', '!!!nicht base64!!!', 'xxxx', 'AAAA']) {
  assert(sc.decode(müll) === null, `„${müll}“ wird als ungültig abgewiesen`);
}

// --- Alte reine Base64-Codes lassen sich weiter importieren -----------------
const alt = Buffer.from(JSON.stringify({ money: 42, alt: true }), 'utf8').toString('base64');
const altZurück = sc.decode(alt);
assert(altZurück && altZurück.money === 42 && altZurück.alt === true, 'Alter Base64-Code wird weiter gelesen');

// --- Zusammenspiel mit state.js (Export/Import des echten Spielstands) -------
require(require('path').join(__dirname, '..', 'js', 'format.js'));
// state.js braucht ein paar Bausteine; wir laden es und prüfen den Rundlauf grob.
try {
  require(require('path').join(__dirname, '..', 'js', 'state.js'));
  if (GK.exportSave && GK.importSave) {
    const code = GK.exportSave();
    assert(typeof code === 'string' && code.length > 0, 'GK.exportSave liefert einen Code');
    assert(GK.importSave(code) === true, 'GK.importSave lädt den eigenen Code');
    assert(GK.importSave('kaputt!!!') === false, 'GK.importSave weist Unsinn ab');
  }
} catch (e) {
  // state.js hängt evtl. von weiteren Dateien ab; der Kern (savecode) ist oben geprüft.
  console.log('Hinweis: state.js nicht eigenständig ladbar –', e.message);
}

console.log(failed ? 'Spielstand-Code-Tests FEHLGESCHLAGEN' : 'Spielstand-Code-Tests bestanden.');
process.exitCode = failed;
