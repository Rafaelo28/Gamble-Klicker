// Tests für „Geheime Parole“ (Wörter raten). Ausführen mit: node tests/parole.test.js
global.window = global;
const R = require('path').join(__dirname, '..', 'js') + '/';
require(R + 'casino/casino.js');
require(R + 'casino/parole.js');
const assert = (cond, msg) => { if (!cond) { console.log('FAIL', msg); process.exitCode = 1; } };
const P = GK.casino.paroleMath;

// Wortlisten: genug Wörter, genau fünf Buchstaben, nur A–Z, keine doppelten
Object.keys(P.WORDS).forEach(lang => {
  const w = P.WORDS[lang];
  assert(w.length >= 200, `${lang}: mindestens 200 Wörter (${w.length})`);
  assert(w.every(x => /^[A-Z]{5}$/.test(x)), `${lang}: nur fünf Buchstaben A–Z: ${w.filter(x => !/^[A-Z]{5}$/.test(x))}`);
  assert(new Set(w).size === w.length, `${lang}: keine doppelten Wörter: ${w.filter((x, i) => w.indexOf(x) !== i)}`);
  for (let i = 0; i < 200; i++) assert(w.includes(P.pickWord(lang)), `${lang}: ausgeloste Parole steht in der Liste`);
});
assert(P.WORDS.de && P.WORDS.en, 'Wörter auf Deutsch und Englisch');
assert(P.WORDS.de.includes(P.pickWord('xx')), 'Unbekannte Sprache: deutsche Wörter');

// Bewertung: 2 = richtige Stelle, 1 = andere Stelle, 0 = kommt nicht vor
const sc = (g, w) => P.score(g, w).join('');
assert(sc('ANKER', 'ANKER') === '22222', 'Alles richtig');
assert(sc('STURM', 'INSEL') === '10000', 'S an anderer Stelle');
assert(sc('KISTE', 'KARTE') === '20022', 'K, T und E sitzen');
assert(sc('REGEN', 'ANKER') === '10021', 'Das zweite E sitzt, das erste zählt dann nicht mehr');
// Doppelte Buchstaben: nur so oft melden, wie sie in der Parole stehen
assert(sc('ESSEN', 'SEGEL') === '11020', 'Ein S und zwei E in der Parole');
assert(sc('LLAMA', 'SALAD') === '10101', 'Nur ein L in der Parole – das erste L meldet, das zweite nicht');
assert(sc('ALLES', 'LILIE') === '01210', 'Zwei L: eins sitzt, eins steht woanders');
assert(sc('TASSE', 'SEGEL') === '00101', 'S nur einmal, E einmal');
// Jede Bewertung meldet einen Buchstaben höchstens so oft, wie er in der Parole steht
{
  const W = P.WORDS.de;
  let ok = true;
  for (let i = 0; i < 4000; i++) {
    const g = W[GK.rng.int(W.length)];
    const w = W[GK.rng.int(W.length)];
    const s = P.score(g, w);
    if ((g === w) !== s.every(v => v === 2)) ok = false;
    for (const ch of new Set(g)) {
      const marked = [...g].filter((c, k) => c === ch && s[k] > 0).length;
      const inWord = [...w].filter(c => c === ch).length;
      const inGuess = [...g].filter(c => c === ch).length;
      if (marked !== Math.min(inWord, inGuess)) ok = false;
    }
    for (let k = 0; k < P.LENGTH; k++) if ((s[k] === 2) !== (g[k] === w[k])) ok = false;
  }
  assert(ok, 'Bewertung stimmt für zufällige Wortpaare');
}

// Tastatur: bester Stand je Buchstabe
{
  const k = P.letterStates(['STURM', 'INSEL'], 'INSEL');
  assert(k.S === 2 && k.T === 0 && k.I === 2 && k.L === 2 && k.A === undefined, 'Tastatur merkt sich den besten Stand');
}

// Gewinnstufen: sechs Versuche, früher ist besser, danach nichts
assert(P.TRIES === 6 && P.MULTS.length === P.TRIES, 'Sechs Versuche, sechs Stufen');
assert(P.MULTS.every((m, i) => i === 0 || m < P.MULTS[i - 1]), 'Jeder spätere Versuch zahlt weniger');
assert(P.multiplier(1) === P.MULTS[0] && P.multiplier(6) === P.MULTS[5], 'Multiplikator je Versuch');
assert(P.multiplier(0) === 0 && P.multiplier(7) === 0, 'Nicht geknackt: nichts');
assert(P.MULTS[2] < 1 && P.MULTS[5] < 0.5, 'Ab dem 3. Versuch kein Gewinn mehr');

// Ausgewogenheit: Ein Rechner, der die ganze Liste kennt und immer ein noch passendes Wort rät, darf auf Dauer
// nichts verdienen (sonst wäre die Parole ein Gelddrucker). Wer die Liste nicht kennt, liegt deutlich darunter.
Object.keys(P.WORDS).forEach(lang => {
  const W = P.WORDS[lang];
  const N = 6000;
  let back = 0;
  let solved = 0;
  for (let n = 0; n < N; n++) {
    const word = P.pickWord(lang);
    let cand = W;
    for (let t = 1; t <= P.TRIES; t++) {
      const g = cand[GK.rng.int(cand.length)];
      if (g === word) { back += P.multiplier(t); solved++; break; }
      const s = sc(g, word);
      cand = cand.filter(c => sc(g, c) === s);
      assert(cand.includes(word), 'Die Parole passt immer zu allen Hinweisen');
    }
  }
  assert(solved / N > 0.97, `${lang}: mit den Hinweisen fast immer lösbar (${solved / N})`);
  assert(back / N > 0.6 && back / N < 0.95, `${lang}: Rechner mit Listenkenntnis ${back / N}`);
});

if (!process.exitCode) console.log('Parole-Tests bestanden');
