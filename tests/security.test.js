// Tests für Daten von außen: Ein präparierter Spielstand-Code oder eine Nachricht eines anderen Geräts darf keinen
// HTML-Schnipsel (und damit keinen fremden Code) ins Spiel bringen. Ausführen mit: node tests/security.test.js
global.window = global;
global.document = { addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, getElementById() { return null; }, visibilityState: 'visible' };
global.location = { search: '', pathname: '/', origin: '', hash: '' };
global.history = { replaceState() {} };
const R = require('path').join(__dirname, '..', 'js') + '/';
require(R + 'format.js');
require(R + 'savecode.js');
require(R + 'state.js');
const assert = (cond, msg) => { if (!cond) { console.log('FAIL', msg); process.exitCode = 1; } };
GK.save = () => true;

// Findet irgendwo in einem Wert (auch in Schlüsseln) ein Zeichen, mit dem man HTML einschleusen kann?
function unsafe(v) {
  if (typeof v === 'string') return /[<>"'`]/.test(v);
  if (!v || typeof v !== 'object') return false;
  return Object.keys(v).some(k => unsafe(k) || unsafe(v[k]));
}

// ---------- GK.cleanData ----------
{
  const evil = JSON.parse(JSON.stringify({
    money: 5,
    buffs: [{ id: 'goldrush', type: 'income', mult: '<img src=x onerror=alert(1)>', until: 9e15 }],
    friends: { '<b>x</b>': { avatar: '" onclick="alert(1)', name: "O'Neil", games: { '<i>': [1, 2, 3] } } },
    casino: { history: [{ text: '`${alert(1)}`', game: '<script>' }] },
    n: 1e5, ok: true, none: null, list: [1, 'a', [2, '<']],
  }).replace('"money":5', '"money":5,"__proto__":{"polluted":1}'));
  assert(Object.keys(evil).includes('__proto__'), 'Testdaten enthalten einen echten Schlüssel __proto__');
  const c = GK.cleanData(evil);
  assert(!unsafe(c), 'Keine gefährlichen Zeichen mehr – in Texten und Schlüsseln');
  assert(!Object.keys(c).includes('__proto__') && Object.getPrototypeOf(c) === Object.prototype && ({}).polluted === undefined, '__proto__ fällt weg, nichts wird untergeschoben');
  assert(c.money === 5 && c.n === 1e5 && c.ok === true && c.none === null && c.list[0] === 1 && c.list[2][0] === 2, 'Zahlen, Wahrheitswerte und null bleiben');
  assert(c.friends['‹b›x‹/b›'].name === 'O’Neil', 'Texte bleiben lesbar (gleich aussehende Zeichen)');
  assert(c.buffs[0].mult === '‹img src=x onerror=alert(1)›', 'Kein Tag mehr – nur noch harmloser Text');
  // Sehr tief verschachtelt: kein Absturz
  let deep = {};
  const root = deep;
  for (let i = 0; i < 5000; i++) { deep.a = {}; deep = deep.a; }
  assert(GK.cleanData(root) && true, 'Tiefe Verschachtelung bricht nicht ab');
}

// ---------- Import: präparierter Spielstand-Code ----------
{
  global.atob = x => Buffer.from(x, 'base64').toString('binary');
  const payload = { money: 5, buffs: [{ id: 'goldrush', type: 'income', mult: '<img src=x onerror=alert(1)>', until: 9e15 }],
    player: { name: '<b>Hacker</b>', avatar: '"><script>' }, casino: { history: [{ text: '<img src=x>', game: 'x"y' }] } };
  const code = Buffer.from(JSON.stringify(payload)).toString('base64');
  assert(GK.importSave(code), 'Präparierter Code lädt (als harmloser Spielstand)');
  assert(!unsafe(GK.state), 'Im geladenen Spielstand steht kein HTML mehr');
  assert(GK.state.money === 5, 'Werte bleiben erhalten');
  // Verschlüsselter Code (neues Format) wird genauso geprüft
  GK.state.player.name = 'Test';
  const fresh = GK.exportSave();
  assert(GK.importSave(fresh) && GK.state.player.name === 'Test', 'Normaler Export/Import funktioniert weiter');
  assert(!GK.importSave(Buffer.from('[1,2,3]').toString('base64')) && !GK.importSave(Buffer.from('"x"').toString('base64')), 'Kein Spielstand: abgelehnt');
}

console.log(process.exitCode ? 'Sicherheits-Tests FEHLGESCHLAGEN' : 'Sicherheits-Tests bestanden.');
