// Lügenwürfel (Bluff): Jeder würfelt verdeckt unter seinem Becher. Reihum wird geboten, wie viele
// Würfel einer Augenzahl insgesamt auf dem Tisch liegen (Einsen zählen als Joker mit).
// Wer dran ist, bietet höher – oder ruft „Lüge!“. Dann wird aufgedeckt: Wer falsch lag, verliert
// einen Würfel. Wer keine Würfel mehr hat, ist raus. Der Letzte mit Würfeln gewinnt.
// Läuft gegen Computer und online mit Freunden (siehe room.js).
window.GK = window.GK || {};

(function () {
  const FACES = [2, 3, 4, 5, 6];
  // Namen kommen im Online-Spiel von anderen Spielern – immer als Text ausgeben
  const esc = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const PIPS = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };

  // ---------- Regeln ----------

  const activeSeats = st => st.players.map((p, i) => i).filter(i => !st.players[i].out);
  const totalDice = st => st.players.reduce((sum, p) => sum + (p.out ? 0 : p.count), 0);

  function nextActive(st, from) {
    const n = st.players.length;
    for (let k = 1; k <= n; k++) {
      const i = (from + k) % n;
      if (!st.players[i].out) return i;
    }
    return from;
  }

  function log(st, text) {
    st.log.unshift(text);
    st.log.length = Math.min(st.log.length, 30);
  }

  function create(seats, settings) {
    const dice = settings && settings.dice === 3 ? 3 : 5;
    const st = {
      players: seats.map(s => ({ id: s.id, name: s.name, avatar: s.avatar || '', isBot: !!s.isBot, skill: s.skill || 0.5, dice: [], count: dice, out: false, place: null })),
      dicePerPlayer: dice, round: 0, starter: GK.rng.int(seats.length), turn: -1,
      bid: null, bids: [], phase: 'bidding', reveal: null, log: [],
    };
    newRound(st);
    return st;
  }

  function newRound(st) {
    st.round++;
    st.players.forEach(p => { p.dice = p.out ? [] : Array.from({ length: p.count }, () => 1 + GK.rng.int(6)).sort((a, b) => a - b); });
    st.bid = null;
    st.bids = [];
    st.reveal = null;
    st.phase = 'bidding';
    if (st.players[st.starter].out) st.starter = nextActive(st, st.starter);
    st.turn = st.starter;
    log(st, `🎲 Runde ${st.round}: Alle würfeln. ${st.players[st.turn].name} beginnt.`);
  }

  function validBid(st, q, f) {
    if (!Number.isInteger(q) || !FACES.includes(f) || q < 1 || q > totalDice(st)) return false;
    return !st.bid || q > st.bid.q || (q === st.bid.q && f > st.bid.f);
  }

  // Wie viele Würfel zeigen f (oder Joker 1)?
  function countMatches(st, f) {
    return st.players.reduce((sum, p) => sum + (p.out ? 0 : p.dice.filter(d => d === f || d === 1).length), 0);
  }

  function act(st, seat, a) {
    if (st.phase !== 'bidding' || st.turn !== seat) return false;
    const p = st.players[seat];
    if (a.type === 'bid') {
      const q = Math.floor(Number(a.q));
      const f = Math.floor(Number(a.f));
      if (!validBid(st, q, f)) return false;
      st.bid = { q, f, seat };
      st.bids.push({ q, f, seat });
      p.lastBid = `${q}× ${f}`;
      log(st, `${p.name} bietet ${q}× ${f}`);
      st.turn = nextActive(st, seat);
      return true;
    }
    if (a.type === 'challenge') {
      if (!st.bid || st.bid.seat === seat) return false;
      const actual = countMatches(st, st.bid.f);
      const loser = actual >= st.bid.q ? seat : st.bid.seat;
      st.reveal = { bid: st.bid, challenger: seat, actual, loser };
      st.phase = 'reveal';
      log(st, `${p.name} ruft „Lüge!“ – es liegen ${actual}× ${st.bid.f}. ${st.players[loser].name} verliert einen Würfel.`);
      return true;
    }
    return false;
  }

  // Nach dem Aufdecken: Würfel abgeben, Ausgeschiedene, nächste Runde
  function advance(st) {
    if (st.phase !== 'reveal') return;
    const loser = st.players[st.reveal.loser];
    if (!loser.out) {
      loser.count--;
      if (loser.count <= 0) {
        loser.place = activeSeats(st).length;
        loser.out = true;
        loser.dice = [];
        log(st, `☠️ ${loser.name} hat keine Würfel mehr (${loser.place}. Platz).`);
      }
    }
    st.players.forEach(p => { p.lastBid = ''; });
    if (finishIfDecided(st)) return;
    st.starter = loser.out ? nextActive(st, st.reveal.loser) : st.reveal.loser;
    newRound(st);
  }

  function finishIfDecided(st) {
    const left = activeSeats(st);
    if (left.length > 1) return false;
    if (left.length === 1) {
      st.players[left[0]].place = 1;
      log(st, `🏆 ${st.players[left[0]].name} gewinnt!`);
    }
    st.phase = 'finished';
    st.turn = -1;
    return true;
  }

  function forfeit(st, seat) {
    const p = st.players[seat];
    if (p.out) return;
    p.place = activeSeats(st).length;
    p.out = true;
    p.count = 0;
    p.dice = [];
    log(st, `${p.name} verlässt das Spiel (${p.place}. Platz).`);
    if (finishIfDecided(st)) return;
    if (st.phase === 'bidding') {
      // Gebot eines Ausgeschiedenen zählt nicht mehr: neue Runde
      if (st.bid && st.bid.seat === seat) {
        st.starter = nextActive(st, seat);
        newRound(st);
      } else if (st.turn === seat) {
        st.turn = nextActive(st, seat);
      }
    }
  }

  // ---------- Computer-Gegner ----------

  // P(mindestens k Treffer bei n Würfeln mit Trefferchance p)
  function atLeast(n, k, p) {
    if (k <= 0) return 1;
    if (k > n) return 0;
    let sum = 0;
    let c = 1;
    for (let i = 0; i <= n; i++) {
      if (i >= k) sum += c * Math.pow(p, i) * Math.pow(1 - p, n - i);
      c = c * (n - i) / (i + 1);
    }
    return sum;
  }

  function botAct(st, seat) {
    const me = st.players[seat];
    const unknown = totalDice(st) - me.dice.length;
    const own = f => me.dice.filter(d => d === f || d === 1).length;
    const truth = (q, f) => atLeast(unknown, q - own(f), 1 / 3);
    const noise = (1 - me.skill) * 0.25;
    const rand = () => (GK.rng.float() - 0.5) * 2 * noise;
    if (!st.bid) {
      // Eröffnung: die Augenzahl, von der man selbst am meisten hat
      const best = FACES.slice().sort((a, b) => own(b) - own(a) || GK.rng.int(3) - 1)[0];
      const q = Math.max(1, Math.floor(own(best) + unknown / 3 * (0.5 + GK.rng.float() * 0.4)));
      return { type: 'bid', q, f: best };
    }
    const bidTruth = truth(st.bid.q, st.bid.f);
    if (bidTruth < 0.4 + rand()) return { type: 'challenge' };
    // Kleinste mögliche Erhöhung je Augenzahl – die wahrscheinlichste nehmen
    const options = FACES.map(f => ({ f, q: f > st.bid.f ? st.bid.q : st.bid.q + 1 }))
      .filter(o => validBid(st, o.q, o.f))
      .map(o => ({ ...o, p: truth(o.q, o.f) + rand() }))
      .sort((a, b) => b.p - a.p);
    if (!options.length || options[0].p < Math.min(0.3, bidTruth)) return { type: 'challenge' };
    return { type: 'bid', q: options[0].q, f: options[0].f };
  }

  function timeout(st) {
    if (st.bid) return { type: 'challenge' };
    return { type: 'bid', q: 1, f: 6 };
  }

  // ---------- Was jeder sehen darf ----------

  function view(st, seat) {
    const v = JSON.parse(JSON.stringify(st));
    const open = st.phase !== 'bidding';
    v.players.forEach((p, i) => {
      if (i !== seat && !open) p.dice = p.dice.map(() => 0);
      delete p.skill;
    });
    return v;
  }

  // ---------- Darstellung ----------

  function dieHtml(value, cls = '') {
    if (!value) return `<span class="die hidden ${cls}"><b>?</b></span>`;
    return `<span class="die v${value} ${value === 1 ? 'joker' : ''} ${cls}">${Array.from({ length: 9 }, (_, i) =>
      `<i class="${PIPS[value].includes(i + 1) ? 'on' : ''}"></i>`).join('')}</span>`;
  }

  // Auswahl für das eigene Gebot (bleibt erhalten, solange sich das Gebot nicht ändert)
  let choice = { key: '', q: 1, f: 2 };

  function setHtml(el, html) {
    if (el._html === html) return false;
    el._html = html;
    el.innerHTML = html;
    return true;
  }

  function draw(container, v, ui) {
    if (!container.querySelector('.dice-table')) {
      container.innerHTML = `
        <div class="dice-table">
          <div class="dice-seats"></div>
          <div class="dice-center"></div>
          <div class="dice-mine"></div>
          <div class="dice-controls"></div>
          <details class="poker-log dice-log"><summary>Spielverlauf</summary><ul></ul></details>
        </div>`;
      container._lastStep = null;
    }
    const me = ui.mySeat >= 0 ? v.players[ui.mySeat] : null;
    const reveal = v.phase === 'reveal' ? v.reveal : null;
    const matchFace = reveal ? reveal.bid.f : null;

    // Sitzplätze
    setHtml(container.querySelector('.dice-seats'), v.players.map((p, i) => {
      if (i === ui.mySeat) return '';
      const cls = ['dice-seat'];
      if (p.out) cls.push('out');
      if (v.phase === 'bidding' && v.turn === i) cls.push('active');
      if (reveal && reveal.loser === i) cls.push('loser');
      const dice = reveal
        ? p.dice.map(d => dieHtml(d, d === matchFace || d === 1 ? 'match small' : 'small')).join('')
        : p.out ? '' : `<span class="dice-cup">🥤</span><span class="dice-count">${p.count}</span>`;
      return `<div class="${cls.join(' ')}">
        <div class="dice-name">${p.avatar} ${esc(p.name)}</div>
        <div class="dice-row">${p.out ? `☠️ ${p.place}. Platz` : dice}</div>
        <div class="dice-status">${p.lastBid ? `bietet <b>${p.lastBid.replace(/(\d+)× (\d)/, '$1 × $2')}</b>` : '&nbsp;'}</div>
      </div>`;
    }).join(''));

    // Mitte: aktuelles Gebot oder Ergebnis
    let center;
    if (reveal) {
      const ok = reveal.actual >= reveal.bid.q;
      center = `<div class="dice-bid">Gebot: <b>${reveal.bid.q} ×</b> ${dieHtml(reveal.bid.f)}</div>
        <div class="dice-result ${ok ? 'ok' : 'lie'}">Es liegen <b>${reveal.actual}</b> (Einsen zählen mit) –
          ${ok ? 'das Gebot stimmt!' : 'gelogen!'} <b>${esc(v.players[reveal.loser].name)}</b> verliert einen Würfel.</div>`;
    } else if (v.phase === 'finished') {
      const winner = v.players.find(p => p.place === 1);
      center = `<div class="dice-bid">🏆 ${winner ? `${winner.avatar} ${esc(winner.name)} gewinnt!` : 'Spiel vorbei'}</div>`;
    } else if (v.bid) {
      center = `<div class="dice-bid">Gebot von ${esc(v.players[v.bid.seat].name)}: <b>${v.bid.q} ×</b> ${dieHtml(v.bid.f)}</div>
        <div class="muted small">Insgesamt liegen ${totalDice(v)} Würfel auf dem Tisch.</div>`;
    } else {
      center = `<div class="dice-bid">${esc(v.players[v.turn].name)} eröffnet die Runde …</div>
        <div class="muted small">Insgesamt liegen ${totalDice(v)} Würfel auf dem Tisch.</div>`;
    }
    setHtml(container.querySelector('.dice-center'), center);

    // Eigene Würfel
    setHtml(container.querySelector('.dice-mine'), me
      ? `<div class="dice-name">${me.avatar} Deine Würfel ${me.out ? `– ☠️ ${me.place}. Platz` : ''}</div>
         <div class="dice-row big">${me.dice.map(d => dieHtml(d, reveal && (d === matchFace || d === 1) ? 'match' : '')).join('')}</div>`
      : '<div class="muted">Du schaust zu.</div>');

    // Bedienung
    const myTurn = me && v.phase === 'bidding' && v.turn === ui.mySeat;
    const controls = container.querySelector('.dice-controls');
    if (!myTurn) {
      setHtml(controls, v.phase === 'bidding' && !me?.out
        ? `<div class="muted">${esc(v.players[v.turn].name)} ist dran …</div>` : '');
    } else {
      const key = `${v.round}:${v.bids.length}`;
      if (choice.key !== key) {
        // Vorschlag: kleinste gültige Erhöhung
        choice = { key, q: v.bid ? v.bid.q : 1, f: v.bid ? v.bid.f : 2 };
        if (v.bid) {
          if (choice.f < 6) choice.f++;
          else choice = { key, q: choice.q + 1, f: 2 };
        }
      }
      const valid = validBid(v, choice.q, choice.f);
      const html = `
        <div class="dice-pick">
          <div class="dice-qty">
            <button class="btn dice-minus" aria-label="weniger">−</button>
            <span class="dice-q">${choice.q} ×</span>
            <button class="btn dice-plus" aria-label="mehr">+</button>
          </div>
          <div class="dice-faces">${FACES.map(f => `<button class="dice-face ${f === choice.f ? 'active' : ''}" data-f="${f}">${dieHtml(f)}</button>`).join('')}</div>
        </div>
        <div class="game-actions">
          <button class="btn btn-primary btn-big dice-bid-btn" ${valid ? '' : 'disabled'}>🎲 Bieten: ${choice.q} × ${choice.f}</button>
          ${v.bid ? '<button class="btn btn-danger btn-big dice-lie">🤥 Lüge!</button>' : ''}
        </div>
        ${valid ? '' : '<div class="small loss">Du musst höher bieten: mehr Würfel oder gleich viele mit höherer Augenzahl.</div>'}`;
      if (setHtml(controls, html)) {
        controls.querySelector('.dice-minus').addEventListener('click', () => { choice.q = Math.max(1, choice.q - 1); controls._html = null; draw(container, v, ui); });
        controls.querySelector('.dice-plus').addEventListener('click', () => { choice.q = Math.min(totalDice(v), choice.q + 1); controls._html = null; draw(container, v, ui); });
        controls.querySelectorAll('.dice-face').forEach(btn => btn.addEventListener('click', () => {
          choice.f = Number(btn.dataset.f);
          controls._html = null;
          draw(container, v, ui);
        }));
        controls.querySelector('.dice-bid-btn').addEventListener('click', e => {
          e.currentTarget.disabled = true;
          GK.sound.play('chip');
          ui.act({ type: 'bid', q: choice.q, f: choice.f });
        });
        const lie = controls.querySelector('.dice-lie');
        if (lie) lie.addEventListener('click', e => {
          e.currentTarget.disabled = true;
          ui.act({ type: 'challenge' });
        });
      }
    }
    setHtml(container.querySelector('.dice-log ul'), v.log.map(l => `<li>${esc(l)}</li>`).join(''));

    // Sounds bei neuen Ereignissen
    const stepKey = `${v.round}:${v.bids.length}:${v.phase}`;
    if (container._lastStep && container._lastStep !== stepKey) {
      if (v.phase === 'reveal') {
        GK.sound.play('boom');
        const loserMe = v.reveal.loser === ui.mySeat;
        setTimeout(() => GK.sound.play(loserMe ? 'lose' : 'coin'), 500);
      } else if (v.bids.length === 0 && v.phase === 'bidding') {
        GK.sound.play('deal');
      } else if (v.phase === 'bidding') {
        GK.sound.play('chip');
      }
      if (myTurn) GK.sound.play('tick');
    }
    container._lastStep = stepKey;
  }

  GK.room.registerGame({
    id: 'dice',
    name: 'Lügenwürfel',
    icon: '🎲',
    desc: 'Bluffen, bieten, „Lüge!“ rufen – gegen Computer oder online mit Freunden.',
    intro: `<p class="muted"><b>So geht's:</b> Jeder würfelt verdeckt. Reihum wird geboten, wie viele Würfel einer
      Augenzahl <i>insgesamt</i> auf dem Tisch liegen – <b>Einsen zählen als Joker</b> immer mit. Wer dran ist,
      bietet höher (mehr Würfel oder gleich viele mit höherer Augenzahl) oder ruft <b>„Lüge!“</b>. Dann wird
      aufgedeckt: Wer falsch lag, verliert einen Würfel. Der Letzte mit Würfeln gewinnt.</p>`,
    minPlayers: 2,
    maxPlayers: 6,
    bots: true,
    settings: {
      defaults: { dice: 5 },
      html: s => `<div class="bet-label">Würfel pro Spieler</div>
        <div class="room-opts">${[3, 5].map(n => `<button type="button" class="btn btn-small room-opt ${s.dice === n ? 'active' : ''}" data-dice="${n}">${n} Würfel${n === 3 ? ' (schnell)' : ''}</button>`).join('')}</div>`,
      bind: (el, changed) => el.querySelectorAll('.room-opt').forEach(btn => btn.addEventListener('click', () => {
        el.querySelectorAll('.room-opt').forEach(b => b.classList.toggle('active', b === btn));
        GK.sound.play('chip');
        changed();
      })),
      read: el => ({ dice: Number((el.querySelector('.room-opt.active') || {}).dataset?.dice) || 5 }),
    },
    settingsText: s => `${s.dice} Würfel`,
    create,
    actor: st => (st.phase === 'bidding' ? st.turn : -1),
    act,
    botAct,
    timeout,
    turnTime: () => 30000,
    botDelay: (st, solo) => (solo ? 1100 : 1400),
    autoDelay: (st, solo) => (st.phase === 'reveal' ? (solo ? 4000 : 5000) : null),
    advance,
    forfeit,
    placeOf: (st, seat) => (seat >= 0 && st.players[seat] ? st.players[seat].place : null),
    finished: st => st.phase === 'finished',
    view,
    draw,
    onSettle: place => { if (place === 1) GK.unlockAchievement('diceWin'); },
  });

  // Für Tests
  GK.diceGame = { create, act, advance, forfeit, botAct, validBid, countMatches, atLeast, view };
})();
