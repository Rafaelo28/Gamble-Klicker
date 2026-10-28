// Mau-Mau mit 32 Karten: Jeder bekommt 5 Karten. Reihum legt man eine Karte gleicher Farbe oder gleichen Werts
// auf den Ablagestapel – sonst zieht man eine Karte (die man gleich legen darf, wenn sie passt).
// Sonderkarten: 7 = der Nächste zieht zwei (mit einer 7 weitergeben, dann zieht der Übernächste vier …),
// 8 = der Nächste setzt aus, Bube = passt immer (nur nicht auf einen Buben) und man wünscht sich eine Farbe.
// Wer zuerst keine Karten mehr hat, gewinnt („Mau-Mau!“). Die anderen werden nach Kartenzahl und
// Kartenwert platziert. Läuft gegen Computer und online mit Freunden (siehe room.js).
window.GK = window.GK || {};

(function () {
  // Namen kommen im Online-Spiel von anderen Spielern – immer als Text ausgeben
  const esc = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const RANKS = ['7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
  const SUITS = ['C', 'S', 'H', 'D'];
  const SUIT_NAMES = { C: 'Kreuz', S: 'Pik', H: 'Herz', D: 'Karo' };
  const SUIT_SYMBOLS = { C: '♣', S: '♠', H: '♥', D: '♦' };
  const RANK_NAMES = { 7: 'Sieben', 8: 'Acht', 9: 'Neun', T: 'Zehn', J: 'Bube', Q: 'Dame', K: 'König', A: 'Ass' };
  const POINTS = { A: 11, T: 10, K: 4, Q: 3, J: 2 };
  const HAND = 5;
  const MAX_MOVES = 600;   // Sicherheitsnetz: so viele Züge, dann gewinnt, wer die wenigsten Karten hat

  const rank = c => c[0];
  const suit = c => c[1];
  const cardName = c => `${SUIT_NAMES[suit(c)]}-${RANK_NAMES[rank(c)]}`;

  // ---------- Regeln ----------

  function newDeck() {
    const cards = [];
    SUITS.forEach(s => RANKS.forEach(r => cards.push(r + s)));
    return GK.rng.shuffle(cards);
  }

  function log(st, text) {
    st.log.unshift(text);
    st.log.length = Math.min(st.log.length, 40);
  }

  const top = st => st.pile[st.pile.length - 1];
  const activeSeats = st => st.players.map((p, i) => i).filter(i => !st.players[i].out);

  function create(seats) {
    const deck = newDeck();
    const st = {
      players: seats.map(s => ({ id: s.id, name: s.name, avatar: s.avatar || '', isBot: !!s.isBot, skill: s.skill || 0.5, hand: [], out: false, place: null })),
      deck,
      pile: [],
      turn: GK.rng.int(seats.length),
      wish: null,
      pending7: 0,
      drawn: false,
      phase: 'play',
      last: null,
      moves: 0,
      log: [],
    };
    st.players.forEach(p => { p.hand = sortHand(deck.splice(0, HAND)); });
    // Die erste offene Karte ist keine Sonderkarte
    let i = deck.findIndex(c => !'78J'.includes(rank(c)));
    st.pile.push(deck.splice(i, 1)[0]);
    log(st, `🃏 Aufgedeckt: ${cardName(top(st))}. ${st.players[st.turn].name} beginnt.`);
    return st;
  }

  function sortHand(hand) {
    return hand.sort((a, b) => SUITS.indexOf(suit(a)) - SUITS.indexOf(suit(b)) || RANKS.indexOf(rank(a)) - RANKS.indexOf(rank(b)));
  }

  // Darf diese Karte jetzt gelegt werden?
  function playable(st, card) {
    const t = top(st);
    if (st.pending7 > 0) return rank(card) === '7';
    if (rank(card) === 'J') return rank(t) !== 'J';
    if (st.wish) return suit(card) === st.wish;
    return suit(card) === suit(t) || rank(card) === rank(t);
  }

  // Karte vom Stapel nehmen; ist er leer, wird die Ablage (ohne die oberste Karte) neu gemischt
  function takeCard(st) {
    if (!st.deck.length) {
      const keep = st.pile.pop();
      st.deck = GK.rng.shuffle(st.pile);
      st.pile = [keep];
      if (st.deck.length) log(st, '🔀 Der Ablagestapel wird neu gemischt.');
    }
    return st.deck.pop();
  }

  function drawCards(st, p, n) {
    let got = 0;
    for (let i = 0; i < n; i++) {
      const c = takeCard(st);
      if (!c) break;
      p.hand.push(c);
      got++;
    }
    sortHand(p.hand);
    return got;
  }

  function nextSeat(st, from, steps = 1) {
    const n = st.players.length;
    let i = from;
    for (let s = 0; s < steps; s++) {
      for (let k = 1; k <= n; k++) {
        const j = (i + k) % n;
        if (!st.players[j].out) {
          i = j;
          break;
        }
      }
    }
    return i;
  }

  function endTurn(st, seat, skip) {
    st.drawn = false;
    st.turn = nextSeat(st, seat, skip ? 2 : 1);
    st.moves++;
    if (st.moves >= MAX_MOVES) {
      const best = activeSeats(st).sort((a, b) => st.players[a].hand.length - st.players[b].hand.length ||
        handPoints(st.players[a].hand) - handPoints(st.players[b].hand))[0];
      log(st, `⏱️ Genug gespielt – ${st.players[best].name} hat die wenigsten Karten.`);
      finish(st, best);
    }
  }

  function act(st, seat, a) {
    if (st.phase !== 'play' || st.turn !== seat || !a) return false;
    const p = st.players[seat];
    if (a.type === 'play') {
      const card = String(a.card || '');
      if (!p.hand.includes(card) || !playable(st, card)) return false;
      if (rank(card) === 'J' && !SUITS.includes(a.wish)) return false;
      p.hand.splice(p.hand.indexOf(card), 1);
      st.pile.push(card);
      st.wish = rank(card) === 'J' ? a.wish : null;
      if (rank(card) === '7') st.pending7 += 2;
      st.last = { seat, type: 'play', card, wish: st.wish, pending7: st.pending7, n: (st.last ? st.last.n : 0) + 1 };
      log(st, `${p.name} legt ${cardName(card)}${st.wish ? ` und wünscht sich ${SUIT_NAMES[st.wish]} ${SUIT_SYMBOLS[st.wish]}` : ''}.`);
      if (!p.hand.length) {
        log(st, `🎉 Mau-Mau! ${p.name} hat keine Karten mehr.`);
        finish(st, seat);
        return true;
      }
      if (p.hand.length === 1) log(st, `🗣️ ${p.name}: „Mau!“`);
      // 8: Der Nächste setzt aus (zu zweit ist man also gleich wieder dran)
      if (rank(card) === '8') log(st, `⏭️ ${st.players[nextSeat(st, seat)].name} muss aussetzen.`);
      endTurn(st, seat, rank(card) === '8');
      return true;
    }
    if (a.type === 'draw') {
      if (st.pending7 > 0) {
        const n = drawCards(st, p, st.pending7);
        st.last = { seat, type: 'draw', count: n, n: (st.last ? st.last.n : 0) + 1 };
        log(st, `${p.name} zieht ${n} ${n === 1 ? 'Karte' : 'Karten'}.`);
        st.pending7 = 0;
        endTurn(st, seat, false);
        return true;
      }
      if (st.drawn) return false;
      const n = drawCards(st, p, 1);
      st.drawn = true;
      st.last = { seat, type: 'draw', count: n, n: (st.last ? st.last.n : 0) + 1 };
      log(st, `${p.name} zieht eine Karte.`);
      // Gibt es nichts mehr zu ziehen und passt nichts, ist man einfach weiter
      if (!n) endTurn(st, seat, false);
      return true;
    }
    if (a.type === 'pass') {
      if (!st.drawn) return false;
      log(st, `${p.name} passt.`);
      endTurn(st, seat, false);
      return true;
    }
    return false;
  }

  // Wertung der Übrigen: weniger Karten besser, dann weniger Kartenwert, dann Sitz nach dem Sieger
  function handPoints(hand) {
    return hand.reduce((s, c) => s + (POINTS[rank(c)] || 0), 0);
  }

  function finish(st, winnerSeat) {
    const n = st.players.length;
    const others = activeSeats(st).filter(i => i !== winnerSeat).sort((a, b) => {
      const pa = st.players[a];
      const pb = st.players[b];
      return pa.hand.length - pb.hand.length || handPoints(pa.hand) - handPoints(pb.hand) ||
        ((a - winnerSeat + n) % n) - ((b - winnerSeat + n) % n);
    });
    st.players[winnerSeat].place = 1;
    others.forEach((seat, i) => { st.players[seat].place = i + 2; });
    st.phase = 'finished';
    st.turn = -1;
  }

  function forfeit(st, seat) {
    const p = st.players[seat];
    if (p.out || p.place) return;
    p.place = activeSeats(st).length;
    p.out = true;
    // Die Karten kommen unter den Stapel
    st.deck = p.hand.concat(st.deck);
    p.hand = [];
    log(st, `${p.name} verlässt das Spiel (${p.place}. Platz).`);
    if (st.phase !== 'play') return;
    const left = activeSeats(st);
    if (left.length === 1) {
      st.players[left[0]].place = 1;
      st.phase = 'finished';
      st.turn = -1;
      log(st, `🏆 ${st.players[left[0]].name} gewinnt!`);
      return;
    }
    if (st.turn === seat) {
      st.drawn = false;
      st.turn = nextSeat(st, seat);
    }
  }

  // ---------- Computer-Gegner ----------

  function suitCounts(hand, except) {
    const c = { C: 0, S: 0, H: 0, D: 0 };
    hand.forEach(card => { if (card !== except && rank(card) !== 'J') c[suit(card)]++; });
    return c;
  }

  function bestWish(hand, played) {
    const c = suitCounts(hand, played);
    return SUITS.slice().sort((a, b) => c[b] - c[a])[0];
  }

  function botAct(st, seat) {
    const p = st.players[seat];
    const options = p.hand.filter(c => playable(st, c));
    if (st.pending7 > 0) return options.length ? { type: 'play', card: options[0] } : { type: 'draw' };
    if (!options.length) return st.drawn ? { type: 'pass' } : { type: 'draw' };
    let card;
    if (GK.rng.float() < (1 - p.skill) * 0.35) {
      card = options[GK.rng.int(options.length)];
    } else {
      const next = st.players[nextSeat(st, seat)];
      const counts = suitCounts(p.hand);
      const score = c => {
        let s = counts[suit(c)] * 2 + (POINTS[rank(c)] || 0) * 0.3;
        if (rank(c) === 'J') s -= p.hand.length > 2 ? 20 : -5; // Buben für den Schluss aufheben
        if ((rank(c) === '7' || rank(c) === '8') && next.hand.length <= 2) s += 12; // dem Nächsten das Leben schwer machen
        return s;
      };
      card = options.slice().sort((a, b) => score(b) - score(a))[0];
    }
    return rank(card) === 'J' ? { type: 'play', card, wish: bestWish(p.hand, card) } : { type: 'play', card };
  }

  // Bedenkzeit vorbei: wie ein vorsichtiger Computer-Gegner handeln
  function timeout(st, seat) {
    const p = st.players[seat];
    const options = p.hand.filter(c => playable(st, c));
    if (st.pending7 > 0) return options.length ? { type: 'play', card: options[0] } : { type: 'draw' };
    if (!options.length) return st.drawn ? { type: 'pass' } : { type: 'draw' };
    const card = options.find(c => rank(c) !== 'J') || options[0];
    return rank(card) === 'J' ? { type: 'play', card, wish: bestWish(p.hand, card) } : { type: 'play', card };
  }

  // ---------- Was jeder sehen darf ----------

  function view(st, seat) {
    const open = st.phase === 'finished';
    return {
      players: st.players.map((p, i) => ({
        id: p.id, name: p.name, avatar: p.avatar, isBot: p.isBot, out: p.out, place: p.place, badge: p.badge,
        count: p.hand.length,
        hand: i === seat || open ? p.hand.slice() : [],
      })),
      pile: st.pile.slice(-4),
      pileCount: st.pile.length,
      deckCount: st.deck.length,
      turn: st.turn, wish: st.wish, pending7: st.pending7, drawn: st.drawn, phase: st.phase,
      last: st.last, moves: st.moves, log: st.log.slice(),
    };
  }

  // ---------- Darstellung ----------

  function cardHtml(c, extra = '') {
    return GK.cards.html(c, false, `mm-card ${extra}`);
  }

  function setHtml(el, html) {
    if (el._html === html) return false;
    el._html = html;
    el.innerHTML = html;
    return true;
  }

  let wishFor = null; // Bube ausgewählt, Wunschfarbe fehlt noch

  function draw(container, v, ui) {
    if (!container.querySelector('.mm-table')) {
      container.innerHTML = `
        <div class="mm-table">
          <div class="mm-others"></div>
          <div class="mm-center"></div>
          <div class="mm-status"></div>
          <div class="mm-hand"></div>
          <div class="mm-actions"></div>
          <details class="poker-log mm-log"><summary>Spielverlauf</summary><ul></ul></details>
        </div>`;
      container._lastMove = null;
      container.addEventListener('click', e => {
        const cur = container._view;
        const cui = container._ui;
        if (!cur || !cui) return;
        const myTurn = cur.phase === 'play' && cur.turn === cui.mySeat;
        if (!myTurn) return;
        const card = e.target.closest('.mm-play');
        const wish = e.target.closest('.mm-wish');
        if (card) {
          const c = card.dataset.card;
          if (rank(c) === 'J') {
            wishFor = c;
            GK.sound.play('chip');
            container.querySelector('.mm-actions')._html = null;
            draw(container, cur, cui);
            return;
          }
          GK.sound.play('card');
          cui.act({ type: 'play', card: c });
        } else if (wish && wishFor) {
          GK.sound.play('card');
          cui.act({ type: 'play', card: wishFor, wish: wish.dataset.suit });
          wishFor = null;
        } else if (e.target.closest('.mm-draw')) {
          e.target.closest('.mm-draw').disabled = true;
          GK.sound.play('deal');
          cui.act({ type: 'draw' });
        } else if (e.target.closest('.mm-pass')) {
          e.target.closest('.mm-pass').disabled = true;
          cui.act({ type: 'pass' });
        } else if (e.target.closest('.mm-cancel')) {
          wishFor = null;
          container.querySelector('.mm-actions')._html = null;
          draw(container, cur, cui);
        }
      });
    }
    container._view = v;
    container._ui = ui;
    const me = ui.mySeat >= 0 ? v.players[ui.mySeat] : null;
    const myTurn = v.phase === 'play' && v.turn === ui.mySeat;
    if (!myTurn || (wishFor && me && !me.hand.includes(wishFor))) wishFor = null;
    const t = v.pile[v.pile.length - 1];
    // Für die Anzeige spielbarer Karten (gleiche Regeln wie beim Gastgeber)
    const can = c => playable({ pile: v.pile, pending7: v.pending7, wish: v.wish }, c);

    // Mitspieler
    setHtml(container.querySelector('.mm-others'), v.players.map((p, i) => {
      if (i === ui.mySeat) return '';
      const cls = ['mm-seat'];
      if (v.turn === i) cls.push('active');
      if (p.out) cls.push('out');
      const backs = v.phase === 'finished'
        ? p.hand.map(c => GK.cards.html(c, false, 'small')).join('')
        : Array.from({ length: Math.min(p.count, 8) }, () => GK.cards.html(null, true, 'small mm-back')).join('');
      return `<div class="${cls.join(' ')}">
        <div class="mm-name">${GK.cosmetics.nameTag(p)}</div>
        <div class="mm-fan">${p.out ? `☠️ ${p.place}. Platz` : backs}</div>
        <div class="mm-count">${p.out ? '' : `${p.count} ${p.count === 1 ? 'Karte' : 'Karten'}${p.count === 1 && v.phase === 'play' ? ' · <b class="mm-mau">Mau!</b>' : ''}`}${p.place && !p.out ? ` · ${p.place}. Platz` : ''}</div>
      </div>`;
    }).join(''));

    // Mitte: Stapel und Ablage
    const fresh = container._lastMove !== null && container._lastMove !== v.moves;
    setHtml(container.querySelector('.mm-center'), `
      <div class="mm-stack">
        ${GK.cards.html(null, true, 'mm-big')}
        <span class="mm-stack-count">${v.deckCount}</span>
      </div>
      <div class="mm-pile">
        ${v.pile.slice(0, -1).map((c, i) => `<span class="mm-under" style="--r:${(i * 37) % 20 - 10}deg">${GK.cards.html(c, false, 'mm-big')}</span>`).join('')}
        <span class="mm-top">${t ? GK.cards.html(t, false, `mm-big ${fresh && v.last && v.last.type === 'play' ? 'deal-in' : ''}`) : ''}</span>
      </div>
      <div class="mm-flags">
        ${v.wish ? `<span class="mm-flag wish">Wunsch: <b class="${v.wish === 'H' || v.wish === 'D' ? 'red' : ''}">${SUIT_SYMBOLS[v.wish]} ${SUIT_NAMES[v.wish]}</b></span>` : ''}
        ${v.pending7 ? `<span class="mm-flag seven">+${v.pending7} ziehen!</span>` : ''}
      </div>`);

    // Wer ist dran?
    const cur = v.turn >= 0 ? v.players[v.turn] : null;
    setHtml(container.querySelector('.mm-status'), v.phase === 'finished'
      ? (() => { const w = v.players.find(p => p.place === 1); return w ? `🎉 Mau-Mau! ${GK.cosmetics.nameTag(w)} gewinnt!` : 'Spiel vorbei'; })()
      : myTurn ? `<b>Du bist dran!</b> ${v.pending7 ? `Leg eine 7 drauf oder zieh ${v.pending7} Karten.` : v.drawn ? 'Leg die gezogene Karte (oder eine andere passende) – oder passe.' : 'Leg eine passende Karte oder zieh eine.'}`
        : `${GK.cosmetics.nameTag(cur)} ist dran …`);

    // Eigene Hand (bin ich dran, werden nicht passende Karten abgedunkelt)
    container.querySelector('.mm-hand').classList.toggle('myturn', myTurn);
    setHtml(container.querySelector('.mm-hand'), me
      ? `<div class="mm-hand-label">Deine Karten (${me.hand.length})${me.hand.length === 1 && v.phase === 'play' ? ' · <b class="mm-mau">Mau!</b>' : ''}</div>
         <div class="mm-hand-cards">${me.hand.map(c => {
           const ok = myTurn && can(c);
           return `<button type="button" class="mm-hand-card ${ok ? 'mm-play' : ''} ${wishFor === c ? 'chosen' : ''}" data-card="${c}" ${ok ? '' : 'tabindex="-1"'} aria-label="${cardName(c)}">${cardHtml(c)}</button>`;
         }).join('')}</div>`
      : '<div class="muted">Du schaust zu.</div>');

    // Knöpfe
    let actions = '';
    if (myTurn && wishFor) {
      actions = `<div class="mm-wish-box"><div>Welche Farbe wünschst du dir?</div>
        <div class="mm-wishes">${SUITS.map(s => `<button type="button" class="btn mm-wish ${s === 'H' || s === 'D' ? 'red' : ''}" data-suit="${s}">${SUIT_SYMBOLS[s]} ${SUIT_NAMES[s]}</button>`).join('')}</div>
        <button type="button" class="btn btn-small mm-cancel">Doch nicht</button></div>`;
    } else if (myTurn) {
      actions = `<div class="game-actions">
        ${v.pending7 ? `<button class="btn btn-danger btn-big mm-draw">🃏 ${v.pending7} Karten ziehen</button>`
          : v.drawn ? '<button class="btn btn-big mm-pass">➡️ Passen</button>'
          : '<button class="btn btn-primary btn-big mm-draw">🃏 Karte ziehen</button>'}
      </div>`;
    }
    setHtml(container.querySelector('.mm-actions'), actions);
    setHtml(container.querySelector('.mm-log ul'), v.log.map(l => `<li>${esc(l)}</li>`).join(''));

    // Geräusche und Erfolge bei neuen Zügen
    if (fresh && v.last) {
      if (v.last.type === 'play') {
        GK.sound.play(rank(v.last.card) === 'J' ? 'bonus' : 'card');
        if (v.last.seat === ui.mySeat && rank(v.last.card) === '7' && v.last.pending7 >= 6) GK.unlockAchievement('maumauStack');
      } else {
        GK.sound.play('deal');
      }
      if (myTurn) GK.sound.play('tick');
    }
    container._lastMove = v.moves;
  }

  GK.room.registerGame({
    id: 'maumau',
    name: 'Mau-Mau',
    icon: '🃏',
    desc: 'Farbe auf Farbe, Wert auf Wert – wer zuerst alle Karten los ist, gewinnt!',
    intro: `<p class="muted"><b>So geht's:</b> Leg eine Karte mit gleicher Farbe oder gleichem Wert auf die Ablage –
      sonst ziehst du eine. <b>7</b>: Der Nächste zieht zwei (mit einer eigenen 7 gibst du weiter). <b>8</b>: Der Nächste
      setzt aus. <b>Bube</b>: passt immer (nur nicht auf einen Buben) – du wünschst dir eine Farbe. Wer zuerst keine
      Karten mehr hat, gewinnt; die anderen werden nach ihren übrigen Karten platziert.</p>`,
    minPlayers: 2,
    maxPlayers: 4,
    bots: true,
    settings: { defaults: {} },
    create,
    actor: st => (st.phase === 'play' ? st.turn : -1),
    act,
    botAct,
    timeout,
    turnTime: () => 30000,
    botDelay: (st, solo) => (solo ? 1000 : 1200),
    autoDelay: () => null,
    advance: () => {},
    forfeit,
    placeOf: (st, seat) => (seat >= 0 && st.players[seat] ? st.players[seat].place : null),
    finished: st => st.phase === 'finished',
    view,
    draw,
    onSettle: place => { if (place === 1) GK.unlockAchievement('maumauWin'); },
  });

  // Für Tests
  GK.maumauGame = { create, act, botAct, timeout, forfeit, playable, view, handPoints, newDeck };
})();
