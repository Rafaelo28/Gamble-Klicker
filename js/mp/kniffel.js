// Kniffel: Fünf Würfel, pro Zug bis zu dreimal würfeln – dazwischen beliebige Würfel festhalten. Danach trägt
// man das Ergebnis in ein freies Feld des Spielblocks ein (passt nichts, streicht man ein Feld mit 0 Punkten).
// Wer am Ende die meisten Punkte hat, gewinnt. Bei Gleichstand entscheidet die obere Hälfte, dann die
// Sitzreihenfolge. Läuft gegen Computer und online mit Freunden (siehe room.js).
window.GK = window.GK || {};

(function () {
  // Namen kommen im Online-Spiel von anderen Spielern – immer als Text ausgeben
  const esc = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const PIPS = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
  const UPPER = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'];
  const LOWER = ['three', 'four', 'full', 'small', 'large', 'kniffel', 'chance'];
  const CATS = {
    ones:    { name: 'Einser', face: 1 },
    twos:    { name: 'Zweier', face: 2 },
    threes:  { name: 'Dreier', face: 3 },
    fours:   { name: 'Vierer', face: 4 },
    fives:   { name: 'Fünfer', face: 5 },
    sixes:   { name: 'Sechser', face: 6 },
    three:   { name: 'Dreierpasch', hint: 'drei gleiche – alle Augen' },
    four:    { name: 'Viererpasch', hint: 'vier gleiche – alle Augen' },
    full:    { name: 'Full House', hint: 'drei + zwei gleiche – 25' },
    small:   { name: 'Kleine Straße', hint: 'vier in Folge – 30' },
    large:   { name: 'Große Straße', hint: 'fünf in Folge – 40' },
    kniffel: { name: 'Kniffel', hint: 'fünf gleiche – 50' },
    chance:  { name: 'Chance', hint: 'alle Augen' },
  };
  // Durchschnittswerte für die Computer-Gegner (was ein Feld „normalerweise“ bringt)
  const TYPICAL = { ones: 2.5, twos: 5, threes: 7.5, fours: 10, fives: 12.5, sixes: 15, three: 15, four: 9, full: 14, small: 18, large: 13, kniffel: 7, chance: 22 };
  const BONUS_AT = 63;
  const BONUS = 35;

  // ---------- Regeln ----------

  function counts(dice) {
    const c = [0, 0, 0, 0, 0, 0, 0];
    dice.forEach(d => { c[d]++; });
    return c;
  }

  const sum = dice => dice.reduce((a, b) => a + b, 0);

  function hasRun(dice, length) {
    const c = counts(dice);
    let run = 0;
    for (let f = 1; f <= 6; f++) {
      run = c[f] ? run + 1 : 0;
      if (run >= length) return true;
    }
    return false;
  }

  // Punkte, wenn man diese Würfel in das Feld cat einträgt
  function score(dice, cat) {
    if (!dice.every(d => d >= 1 && d <= 6)) return 0;
    const c = counts(dice);
    const max = Math.max(...c);
    if (CATS[cat].face) return CATS[cat].face * c[CATS[cat].face];
    switch (cat) {
      case 'three': return max >= 3 ? sum(dice) : 0;
      case 'four': return max >= 4 ? sum(dice) : 0;
      case 'full': return c.includes(3) && c.includes(2) ? 25 : 0;
      case 'small': return hasRun(dice, 4) ? 30 : 0;
      case 'large': return hasRun(dice, 5) ? 40 : 0;
      case 'kniffel': return max === 5 ? 50 : 0;
      case 'chance': return sum(dice);
      default: return 0;
    }
  }

  // Punkte eines Spielers: obere Hälfte, Bonus (nur beim vollen Block), untere Hälfte, gesamt
  function totals(st, p) {
    const upper = UPPER.filter(c => st.cats.includes(c)).reduce((s, c) => s + (p.sheet[c] || 0), 0);
    const lower = LOWER.filter(c => st.cats.includes(c)).reduce((s, c) => s + (p.sheet[c] || 0), 0);
    const bonus = st.mode === 'full' && upper >= BONUS_AT ? BONUS : 0;
    return { upper, bonus, lower, total: upper + bonus + lower };
  }

  const sheetFull = (st, p) => st.cats.every(c => p.sheet[c] != null);
  const activeSeats = st => st.players.map((p, i) => i).filter(i => !st.players[i].out);

  function log(st, text) {
    st.log.unshift(text);
    st.log.length = Math.min(st.log.length, 40);
  }

  function create(seats, settings) {
    const mode = settings && settings.mode === 'quick' ? 'quick' : 'full';
    const st = {
      mode,
      cats: mode === 'quick' ? LOWER.slice() : UPPER.concat(LOWER),
      players: seats.map(s => ({ id: s.id, name: s.name, avatar: s.avatar || '', isBot: !!s.isBot, skill: s.skill || 0.5, sheet: {}, out: false, place: null })),
      turn: GK.rng.int(seats.length),
      rollsLeft: 3,
      dice: [0, 0, 0, 0, 0],
      held: [false, false, false, false, false],
      rolls: 0,
      phase: 'turn',
      last: null,
      plan: null,
      log: [],
    };
    log(st, `🎲 ${st.players[st.turn].name} beginnt.`);
    return st;
  }

  function act(st, seat, a) {
    if (st.phase !== 'turn' || st.turn !== seat || !a) return false;
    if (a.type === 'roll') {
      if (st.rollsLeft <= 0) return false;
      st.dice = st.dice.map((d, i) => (st.held[i] && st.rollsLeft < 3 ? d : 1 + GK.rng.int(6)));
      st.rollsLeft--;
      st.rolls++;
      return true;
    }
    if (a.type === 'hold') {
      const i = Math.floor(Number(a.i));
      if (st.rollsLeft === 3 || st.rollsLeft === 0 || !(i >= 0 && i < 5)) return false;
      st.held[i] = !st.held[i];
      return true;
    }
    if (a.type === 'score') {
      const p = st.players[seat];
      if (st.rollsLeft === 3 || !st.cats.includes(a.cat) || p.sheet[a.cat] != null) return false;
      const pts = score(st.dice, a.cat);
      p.sheet[a.cat] = pts;
      st.last = { seat, cat: a.cat, pts, dice: st.dice.slice(), n: (st.last ? st.last.n : 0) + 1 };
      log(st, `${p.name}: ${CATS[a.cat].name} – ${pts ? `${pts} Punkte` : 'gestrichen'}`);
      nextTurn(st);
      return true;
    }
    return false;
  }

  // Nächster Spieler (ausgeschiedene und fertige überspringen) oder Spielende
  function nextTurn(st) {
    st.plan = null;
    if (finishIfDone(st)) return;
    const n = st.players.length;
    for (let k = 1; k <= n; k++) {
      const j = (st.turn + k) % n;
      const p = st.players[j];
      if (!p.out && !sheetFull(st, p)) {
        st.turn = j;
        break;
      }
    }
    st.rollsLeft = 3;
    st.dice = [0, 0, 0, 0, 0];
    st.held = [false, false, false, false, false];
  }

  // Rangfolge: Punkte, dann obere Hälfte, dann Sitzreihenfolge
  function ranking(st) {
    return activeSeats(st).sort((a, b) => {
      const ta = totals(st, st.players[a]);
      const tb = totals(st, st.players[b]);
      return tb.total - ta.total || tb.upper - ta.upper || a - b;
    });
  }

  function finishIfDone(st) {
    const left = activeSeats(st);
    if (left.length > 1 && !left.every(i => sheetFull(st, st.players[i]))) return false;
    ranking(st).forEach((seat, i) => { st.players[seat].place = i + 1; });
    const winner = st.players.find(p => p.place === 1);
    if (winner) log(st, `🏆 ${winner.name} gewinnt mit ${totals(st, winner).total} Punkten!`);
    st.phase = 'finished';
    st.turn = -1;
    return true;
  }

  function forfeit(st, seat) {
    const p = st.players[seat];
    if (p.out || p.place) return;
    p.place = activeSeats(st).length;
    p.out = true;
    log(st, `${p.name} verlässt das Spiel (${p.place}. Platz).`);
    if (st.phase !== 'turn') return;
    if (st.turn === seat) nextTurn(st);
    else finishIfDone(st);
  }

  // ---------- Computer-Gegner ----------

  // Wie gut ist es, diese Punkte in dieses Feld einzutragen? (mehr als „normal“ = gut)
  function value(st, p, cat, pts) {
    let v = pts - TYPICAL[cat];
    if (CATS[cat].face && st.mode === 'full') {
      // Obere Hälfte: drei gleiche halten den Bonus in Reichweite
      if (pts >= CATS[cat].face * 3) v += 6;
      const t = totals(st, p);
      if (t.upper < BONUS_AT && t.upper + pts >= BONUS_AT) v += 20;
    }
    if (cat === 'chance') v -= 4; // Chance möglichst lange aufheben
    return v;
  }

  function bestCategory(st, p, noise) {
    const open = st.cats.filter(c => p.sheet[c] == null);
    let best = open[0];
    let bestV = -Infinity;
    open.forEach(c => {
      const v = value(st, p, c, score(st.dice, c)) + (GK.rng.float() - 0.5) * noise;
      if (v > bestV) {
        bestV = v;
        best = c;
      }
    });
    return best;
  }

  // Plan für den aktuellen Wurf: eintragen oder welche Würfel halten
  function decide(st, p) {
    const open = cat => st.cats.includes(cat) && p.sheet[cat] == null;
    const noise = (1 - p.skill) * 12;
    const dice = st.dice;
    const c = counts(dice);
    if (st.rollsLeft === 0) return { score: bestCategory(st, p, noise) };
    // Fertige große Würfe sofort eintragen
    if (open('kniffel') && score(dice, 'kniffel')) return { score: 'kniffel' };
    if (open('large') && score(dice, 'large')) return { score: 'large' };
    if (open('full') && score(dice, 'full') && !(open('kniffel') && Math.max(...c) === 3 && GK.rng.float() < 0.3)) return { score: 'full' };
    // Schwächere Gegner würfeln manchmal einfach alles neu
    if (GK.rng.float() < (1 - p.skill) * 0.2) return { keep: [false, false, false, false, false] };
    // Straße anpeilen, wenn schon vier oder drei in Folge liegen
    if (open('large') || open('small')) {
      for (const run of [[2, 3, 4, 5], [1, 2, 3, 4], [3, 4, 5, 6], [3, 4, 5], [2, 3, 4], [4, 5, 6]]) {
        if (run.every(f => c[f]) && (run.length === 4 || Math.max(...c) < 3)) {
          if (run.length === 4 && !open('large') && open('small')) return { score: 'small' };
          const used = new Set();
          return { keep: dice.map(d => (run.includes(d) && !used.has(d) ? (used.add(d), true) : false)) };
        }
      }
    }
    // Sonst: die häufigste Augenzahl halten (bei Gleichstand die höhere, wenn das Feld noch frei ist)
    let face = 6;
    for (let f = 6; f >= 1; f--) {
      const better = c[f] > c[face] || (c[f] === c[face] && !open(UPPER[face - 1]) && open(UPPER[f - 1]));
      if (better) face = f;
    }
    return { keep: dice.map(d => d === face) };
  }

  function botAct(st, seat) {
    if (st.rollsLeft === 3) return { type: 'roll' };
    const p = st.players[seat];
    // Den Plan einmal je Wurf festlegen, damit das Halten nicht hin und her springt
    if (!st.plan || st.plan.seat !== seat || st.plan.rolls !== st.rolls) st.plan = Object.assign({ seat, rolls: st.rolls }, decide(st, p));
    const plan = st.plan;
    if (plan.score) return { type: 'score', cat: plan.score };
    const i = plan.keep.findIndex((k, idx) => k !== st.held[idx]);
    if (i >= 0) return { type: 'hold', i };
    return { type: 'roll' };
  }

  // Bedenkzeit vorbei: würfeln bzw. das beste Feld eintragen
  function timeout(st, seat) {
    if (st.rollsLeft === 3) return { type: 'roll' };
    return { type: 'score', cat: bestCategory(st, st.players[seat], 0) };
  }

  // ---------- Was jeder sehen darf (alles ist offen, nur Interna weg) ----------

  function view(st) {
    const v = JSON.parse(JSON.stringify(st));
    delete v.plan;
    v.players.forEach(p => { delete p.skill; });
    return v;
  }

  // ---------- Darstellung ----------

  function dieHtml(value, cls = '') {
    if (!value) return `<span class="die hidden ${cls}"><b>?</b></span>`;
    return `<span class="die v${value} ${cls}">${Array.from({ length: 9 }, (_, i) =>
      `<i class="${PIPS[value].includes(i + 1) ? 'on' : ''}"></i>`).join('')}</span>`;
  }

  function setHtml(el, html) {
    if (el._html === html) return false;
    el._html = html;
    el.innerHTML = html;
    return true;
  }

  let pick = { key: '', cat: null };

  function draw(container, v, ui) {
    if (!container.querySelector('.kf-table')) {
      container.innerHTML = `
        <div class="kf-table">
          <div class="kf-board">
            <div class="kf-turn"></div>
            <div class="kf-dice"></div>
            <div class="kf-actions"></div>
          </div>
          <div class="kf-sheet-wrap"><table class="kf-sheet"></table></div>
          <details class="poker-log kf-log"><summary>Spielverlauf</summary><ul></ul></details>
        </div>`;
      container._lastRoll = null;
      container._lastScore = null;
      // Ein Empfänger für alle Klicks (überlebt das Neuzeichnen)
      container.addEventListener('click', e => {
        const cur = container._view;
        const cui = container._ui;
        if (!cur || !cui) return;
        const myTurn = cur.phase === 'turn' && cur.turn === cui.mySeat;
        const die = e.target.closest('.kf-die');
        const cell = e.target.closest('.kf-cell.can');
        if (die && myTurn) {
          GK.sound.play('chip');
          cui.act({ type: 'hold', i: Number(die.dataset.i) });
        } else if (cell && myTurn) {
          pick.cat = cell.dataset.cat;
          GK.sound.play('chip');
          container.querySelector('.kf-actions')._html = null;
          draw(container, cur, cui);
        } else if (e.target.closest('.kf-roll') && myTurn) {
          e.target.closest('.kf-roll').disabled = true;
          GK.sound.play('deal');
          cui.act({ type: 'roll' });
        } else if (e.target.closest('.kf-write') && myTurn && pick.cat) {
          e.target.closest('.kf-write').disabled = true;
          cui.act({ type: 'score', cat: pick.cat });
        }
      });
    }
    container._view = v;
    container._ui = ui;
    const me = ui.mySeat >= 0 ? v.players[ui.mySeat] : null;
    const myTurn = v.phase === 'turn' && v.turn === ui.mySeat;
    const rolled = v.phase === 'turn' && v.rollsLeft < 3;
    const key = `${v.turn}:${v.rolls}`;
    if (pick.key !== key) pick = { key, cat: null };
    if (pick.cat && (!me || me.sheet[pick.cat] != null)) pick.cat = null;

    // Wer ist dran?
    const current = v.turn >= 0 ? v.players[v.turn] : null;
    setHtml(container.querySelector('.kf-turn'), v.phase === 'finished'
      ? (() => { const w = v.players.find(p => p.place === 1); return w ? `🏆 ${GK.cosmetics.nameTag(w)} gewinnt mit ${totals(v, w).total} Punkten!` : 'Spiel vorbei'; })()
      : myTurn ? `<b>Du bist dran!</b> ${v.rollsLeft === 3 ? 'Würfle los.' : v.rollsLeft ? `Noch ${v.rollsLeft}× würfeln – tippe Würfel an, um sie zu halten.` : 'Trag dein Ergebnis ein.'}`
        : `${GK.cosmetics.nameTag(current)} ist dran${v.rollsLeft < 3 ? ` (noch ${v.rollsLeft}× würfeln)` : ''} …`);

    // Würfel (neu gewürfelte rollen herein)
    const fresh = container._lastRoll !== null && container._lastRoll !== v.rolls;
    const diceHtml = v.dice.map((d, i) => {
      const held = v.held[i] && rolled;
      return `<button type="button" class="kf-die ${held ? 'held' : ''} ${myTurn && rolled && v.rollsLeft > 0 ? 'can' : ''}" data-i="${i}" ${myTurn && rolled && v.rollsLeft > 0 ? '' : 'tabindex="-1"'} aria-label="Würfel ${i + 1}${held ? ', gehalten' : ''}">
        ${dieHtml(d, fresh && !held ? 'roll' : '')}${held ? '<span class="kf-held">gehalten</span>' : ''}</button>`;
    }).join('');
    if (setHtml(container.querySelector('.kf-dice'), diceHtml + `<span class="kf-roll-key" hidden>${v.rolls}</span>`) && fresh) GK.sound.play('deal');
    container._lastRoll = v.rolls;

    // Knöpfe
    const pickPts = pick.cat ? score(v.dice, pick.cat) : 0;
    setHtml(container.querySelector('.kf-actions'), myTurn ? `
      <div class="game-actions">
        <button class="btn btn-primary btn-big kf-roll" ${v.rollsLeft > 0 ? '' : 'disabled'}>🎲 Würfeln${v.rollsLeft < 3 ? ` (noch ${v.rollsLeft}×)` : ''}</button>
        ${rolled ? `<button class="btn btn-big kf-write" ${pick.cat ? '' : 'disabled'}>${pick.cat
          ? `✍️ ${CATS[pick.cat].name}: ${pickPts ? `${pickPts} Punkte` : 'streichen (0)'}` : '✍️ Feld im Block wählen'}</button>` : ''}
      </div>` : '');

    // Spielblock
    const t = v.players.map(p => totals(v, p));
    const head = `<thead><tr><th></th>${v.players.map((p, i) => `<th class="${i === v.turn ? 'turn' : ''} ${p.out ? 'out' : ''}">${GK.cosmetics.nameTag(p)}${i === ui.mySeat ? ' <span class="mp-tag">Du</span>' : ''}</th>`).join('')}</tr></thead>`;
    const row = cat => `<tr><th>${CATS[cat].name}${CATS[cat].hint ? `<small>${CATS[cat].hint}</small>` : ''}</th>${v.players.map((p, i) => {
      const val = p.sheet[cat];
      if (val != null) {
        const isLast = v.last && v.last.seat === i && v.last.cat === cat;
        return `<td class="kf-cell filled ${val === 0 ? 'zero' : ''} ${isLast ? 'last' : ''}">${val === 0 ? '–' : val}</td>`;
      }
      if (i === ui.mySeat && myTurn && rolled) {
        const pts = score(v.dice, cat);
        return `<td class="kf-cell can ${pick.cat === cat ? 'picked' : ''} ${pts ? '' : 'zero'}" data-cat="${cat}">${pts || '0'}</td>`;
      }
      return '<td class="kf-cell"></td>';
    }).join('')}</tr>`;
    const sumRow = (label, fn, cls = '') => `<tr class="kf-sum ${cls}"><th>${label}</th>${t.map(fn).map(x => `<td>${x}</td>`).join('')}</tr>`;
    let body = '';
    if (v.mode === 'full') {
      body += UPPER.map(row).join('');
      body += sumRow('Obere Hälfte', x => `${x.upper} <small>/ ${BONUS_AT}</small>`);
      body += sumRow(`Bonus (+${BONUS})`, x => (x.bonus ? `+${x.bonus}` : '–'));
    }
    body += LOWER.map(row).join('');
    body += sumRow('Gesamt', x => `<b>${x.total}</b>`, 'total');
    setHtml(container.querySelector('.kf-sheet'), head + `<tbody>${body}</tbody>`);
    setHtml(container.querySelector('.kf-log ul'), v.log.map(l => `<li>${esc(l)}</li>`).join(''));

    // Eingetragen: Effekte (und Erfolg für einen eigenen Kniffel)
    if (v.last && container._lastScore !== null && container._lastScore !== v.last.n) {
      if (v.last.pts >= 25) GK.sound.play(v.last.cat === 'kniffel' ? 'jackpot' : 'bonus');
      else GK.sound.play('chip');
      if (v.last.seat === ui.mySeat && v.last.cat === 'kniffel' && v.last.pts === 50) {
        GK.unlockAchievement('kniffel50');
        GK.fx.confetti(80);
      }
    }
    container._lastScore = v.last ? v.last.n : 0;
    if (myTurn && fresh === false && container._turnSound !== key && v.rollsLeft === 3) GK.sound.play('tick');
    container._turnSound = key;
  }

  GK.room.registerGame({
    id: 'kniffel',
    name: 'Kniffel',
    icon: '🎲',
    desc: 'Würfeln, halten, eintragen – wer schafft die meisten Punkte?',
    intro: `<p class="muted"><b>So geht's:</b> Du hast pro Zug bis zu drei Würfe. Tippe Würfel an, um sie zu halten,
      und würfle die anderen neu. Danach trägst du das Ergebnis in ein freies Feld deines Spielblocks ein – passt
      nichts, streichst du ein Feld mit 0. Beim vollen Block gibt es <b>35 Bonuspunkte</b>, wenn die obere Hälfte
      mindestens 63 Punkte hat. Wer am Ende die meisten Punkte hat, gewinnt.</p>`,
    minPlayers: 2,
    maxPlayers: 4,
    bots: true,
    settings: {
      defaults: { mode: 'full' },
      html: s => `<div class="bet-label">Spielblock</div>
        <div class="room-opts">${[['full', 'Voller Block (13 Felder)'], ['quick', 'Schnell (7 Felder)']].map(([m, label]) =>
          `<button type="button" class="btn btn-small room-opt ${s.mode === m ? 'active' : ''}" data-mode="${m}">${label}</button>`).join('')}</div>`,
      bind: (el, changed) => el.querySelectorAll('.room-opt').forEach(btn => btn.addEventListener('click', () => {
        el.querySelectorAll('.room-opt').forEach(b => b.classList.toggle('active', b === btn));
        GK.sound.play('chip');
        changed();
      })),
      read: el => ({ mode: ((el.querySelector('.room-opt.active') || {}).dataset || {}).mode === 'quick' ? 'quick' : 'full' }),
    },
    settingsText: s => (s.mode === 'quick' ? 'Schnell (7 Felder)' : 'Voller Block'),
    create,
    actor: st => (st.phase === 'turn' ? st.turn : -1),
    act,
    botAct,
    timeout,
    turnTime: () => 45000,
    botDelay: (st, solo) => (st.rollsLeft < 3 && st.plan && !st.plan.score && st.plan.keep.some((k, i) => k !== st.held[i]) ? 380 : solo ? 900 : 1100),
    autoDelay: () => null,
    advance: () => {},
    forfeit,
    placeOf: (st, seat) => (seat >= 0 && st.players[seat] ? st.players[seat].place : null),
    finished: st => st.phase === 'finished',
    view,
    draw,
    onSettle: place => { if (place === 1) GK.unlockAchievement('kniffelWin'); },
  });

  // Für Tests
  GK.kniffelGame = { CATS, UPPER, LOWER, create, act, botAct, timeout, forfeit, score, totals, view, ranking };
})();
