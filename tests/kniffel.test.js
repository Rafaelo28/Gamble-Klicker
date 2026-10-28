// Tests für Kniffel: Punkte je Feld, Ablauf eines Zugs, komplette Partien zwischen Computer-Gegnern,
// Aufgeben, Bedenkzeit und Rangfolge. Ausführen mit: node tests/kniffel.test.js
global.window = global;
const R = require('path').join(__dirname, '..', 'js') + '/';
require(R + 'state.js');
require(R + 'casino/casino.js');
require(R + 'mp/room.js');
require(R + 'mp/kniffel.js');
const K = GK.kniffelGame;
const assert = (cond, msg) => { if (!cond) { console.log('FAIL', msg); process.exitCode = 1; } };

// ---------- Punkte ----------
{
  const s = K.score;
  assert(s([1, 1, 3, 4, 1], 'ones') === 3 && s([6, 6, 6, 2, 6], 'sixes') === 24 && s([2, 3, 4, 5, 6], 'ones') === 0, 'Obere Hälfte');
  assert(s([3, 3, 3, 2, 5], 'three') === 16 && s([3, 3, 2, 2, 5], 'three') === 0, 'Dreierpasch');
  assert(s([4, 4, 4, 4, 1], 'four') === 17 && s([4, 4, 4, 1, 1], 'four') === 0, 'Viererpasch');
  assert(s([2, 2, 5, 5, 5], 'full') === 25 && s([5, 5, 5, 5, 5], 'full') === 0 && s([2, 2, 5, 5, 6], 'full') === 0, 'Full House (fünf gleiche zählen nicht)');
  assert(s([1, 2, 3, 4, 6], 'small') === 30 && s([3, 4, 5, 6, 6], 'small') === 30 && s([1, 2, 3, 5, 6], 'small') === 0, 'Kleine Straße');
  assert(s([1, 2, 3, 4, 5], 'large') === 40 && s([2, 3, 4, 5, 6], 'large') === 40 && s([1, 2, 3, 4, 6], 'large') === 0, 'Große Straße');
  assert(s([6, 6, 6, 6, 6], 'kniffel') === 50 && s([6, 6, 6, 6, 5], 'kniffel') === 0, 'Kniffel');
  assert(s([1, 2, 3, 4, 6], 'chance') === 16, 'Chance');
  assert(s([0, 0, 0, 0, 0], 'chance') === 0, 'Ohne Wurf keine Punkte');
}

// ---------- Ablauf eines Zugs ----------
const seats = n => Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'Spieler ' + i, isBot: true, skill: (i + 1) / (n + 1) }));
{
  const st = K.create(seats(2), { mode: 'full' });
  const t = st.turn;
  assert(st.cats.length === 13 && st.rollsLeft === 3, 'Voller Block: 13 Felder');
  assert(!K.act(st, t, { type: 'score', cat: 'chance' }), 'Eintragen erst nach dem Würfeln');
  assert(!K.act(st, t, { type: 'hold', i: 0 }), 'Halten erst nach dem Würfeln');
  assert(!K.act(st, 1 - t, { type: 'roll' }), 'Nur wer dran ist, würfelt');
  assert(K.act(st, t, { type: 'roll' }) && st.dice.every(d => d >= 1 && d <= 6) && st.rollsLeft === 2, 'Erster Wurf');
  const kept = st.dice[0];
  assert(K.act(st, t, { type: 'hold', i: 0 }) && st.held[0], 'Würfel halten');
  K.act(st, t, { type: 'roll' });
  assert(st.dice[0] === kept, 'Gehaltener Würfel bleibt liegen');
  K.act(st, t, { type: 'roll' });
  assert(st.rollsLeft === 0 && !K.act(st, t, { type: 'roll' }), 'Höchstens drei Würfe');
  assert(!K.act(st, t, { type: 'hold', i: 1 }), 'Nach dem letzten Wurf nichts mehr halten');
  assert(!K.act(st, t, { type: 'score', cat: 'gibtsnicht' }), 'Unbekanntes Feld abgelehnt');
  const pts = K.score(st.dice, 'chance');
  assert(K.act(st, t, { type: 'score', cat: 'chance' }) && st.players[t].sheet.chance === pts, 'Eintragen');
  assert(st.turn === 1 - t && st.rollsLeft === 3 && st.held.every(h => !h), 'Nächster Spieler');
  K.act(st, st.turn, { type: 'roll' });
  K.act(st, st.turn, { type: 'score', cat: 'chance' });
  assert(st.turn === t, 'Wieder der Erste');
  K.act(st, t, { type: 'roll' });
  assert(!K.act(st, t, { type: 'score', cat: 'chance' }), 'Volles Feld nicht noch einmal');
  const quick = K.create(seats(3), { mode: 'quick' });
  assert(quick.cats.length === 7 && !quick.cats.includes('ones'), 'Schnell: nur die untere Hälfte');
}

// ---------- Komplette Partien zwischen Computer-Gegnern ----------
{
  let games = 0;
  let kniffels = 0;
  let bonus = 0;
  const totals = [];
  for (let g = 0; g < 120; g++) {
    const n = 2 + (g % 3);
    const mode = g % 4 === 3 ? 'quick' : 'full';
    const st = K.create(seats(n), { mode });
    let steps = 0;
    while (st.phase !== 'finished' && steps++ < 20000) {
      // Ab und zu gibt jemand auf
      if (g % 10 === 5 && steps === 40) {
        K.forfeit(st, (st.turn + 1) % n);
        continue;
      }
      const seat = st.turn;
      const a = K.botAct(st, seat);
      const before = JSON.stringify(st.players.map(p => p.sheet));
      assert(K.act(st, seat, a), `Computer-Zug gültig (${JSON.stringify(a)})`);
      if (a.type === 'score') assert(JSON.stringify(st.players.map(p => p.sheet)) !== before, 'Eintragen ändert den Block');
    }
    assert(st.phase === 'finished', `Partie ${g} endet`);
    const places = st.players.map(p => p.place).sort();
    assert(places.join() === Array.from({ length: n }, (_, i) => i + 1).join(), `Partie ${g}: Plätze 1–${n} vergeben (${places})`);
    // Rangfolge passt zu den Punkten (unter denen, die nicht aufgegeben haben)
    const active = st.players.filter(p => !p.out).sort((a, b) => a.place - b.place);
    for (let i = 1; i < active.length; i++) assert(K.totals(st, active[i - 1]).total >= K.totals(st, active[i]).total, `Partie ${g}: Platz ${i} hat mindestens so viele Punkte wie Platz ${i + 1}`);
    const still = st.players.filter(p => !p.out);
    still.forEach(p => {
      // Bleibt nur einer übrig, gewinnt er sofort – sonst ist am Ende jeder Block voll
      if (still.length > 1) assert(st.cats.every(c => typeof p.sheet[c] === 'number'), 'Block voll');
      if (mode === 'full') {
        totals.push(K.totals(st, p).total);
        if (K.totals(st, p).bonus) bonus++;
      }
      if (p.sheet.kniffel === 50) kniffels++;
    });
    games++;
  }
  const avg = totals.reduce((a, b) => a + b, 0) / totals.length;
  console.log(`Kniffel: ${games} Partien, Schnitt ${avg.toFixed(0)} Punkte, ${bonus} Boni, ${kniffels} Kniffel`);
  assert(avg > 170 && avg < 260, `Computer spielen ordentlich (Schnitt ${avg.toFixed(0)})`);
  assert(kniffels > 0 && bonus > 0, 'Es gibt Kniffel und Boni');
}

// ---------- Aufgeben, Bedenkzeit, Rangfolge ----------
{
  const st = K.create(seats(3), { mode: 'quick' });
  const t = st.turn;
  K.forfeit(st, t);
  assert(st.players[t].out && st.players[t].place === 3 && st.turn !== t && st.phase === 'turn', 'Wer dran ist, gibt auf: der Nächste ist dran');
  const other = st.players.findIndex((p, i) => !p.out && i !== st.turn);
  K.forfeit(st, other);
  assert(st.phase === 'finished' && st.players.find(p => !p.out).place === 1, 'Nur noch einer übrig: er gewinnt');
  assert(st.players.map(p => p.place).sort().join() === '1,2,3', 'Plätze nach dem Aufgeben');

  const st2 = K.create(seats(2), { mode: 'quick' });
  const s2 = st2.turn;
  const a1 = K.timeout(st2, s2);
  assert(a1.type === 'roll' && K.act(st2, s2, a1), 'Bedenkzeit vorbei: erst würfeln');
  const a2 = K.timeout(st2, s2);
  assert(a2.type === 'score' && K.act(st2, s2, a2) && st2.turn !== s2, 'Bedenkzeit vorbei: dann eintragen');

  // Gleichstand: obere Hälfte, dann Sitzreihenfolge
  const st3 = K.create(seats(3), { mode: 'full' });
  const fill = (p, v) => st3.cats.forEach(c => { p.sheet[c] = v[c] || 0; });
  fill(st3.players[0], { chance: 30, ones: 3 });
  fill(st3.players[1], { chance: 25, sixes: 8 });
  fill(st3.players[2], { chance: 30, ones: 3 });
  const r = K.ranking(st3);
  assert(r[0] === 1 && r[1] === 0 && r[2] === 2, `Gleichstand: obere Hälfte, dann Sitz (${r})`);

  // Ansicht: keine Interna
  const v = K.view(st2);
  assert(!('plan' in v) && v.players.every(p => !('skill' in p)), 'Ansicht ohne Interna');
}

console.log(process.exitCode ? 'Kniffel-Tests FEHLGESCHLAGEN' : 'Kniffel-Tests bestanden.');
