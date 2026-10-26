// Texas-Hold'em-Spiellogik für ein Turnier (Sit & Go).
// Die Engine arbeitet nur mit einem einfachen Daten-Objekt (dem „Tisch“) und kennt weder
// Bildschirm noch Dublonen. So kann der Tisch gespeichert und später im Multiplayer vom
// Gastgeber an alle Mitspieler geschickt werden.
window.GK = window.GK || {};
GK.poker = GK.poker || {};

(function () {
  const LOG_LENGTH = 40;

  // seats: [{ id, name, isBot, personality }]
  function createTable({ seats, startChips, blindLevels, handsPerLevel }) {
    return {
      players: seats.map(s => ({
        id: s.id,
        name: s.name,
        isBot: !!s.isBot,
        personality: s.personality || null,
        chips: startChips,
        bet: 0,        // in dieser Setzrunde
        total: 0,      // in dieser Hand insgesamt
        cards: [],
        folded: false,
        allIn: false,
        acted: false,
        out: false,
        place: null,
        lastAction: '',
      })),
      blindLevels,
      handsPerLevel,
      level: 0,
      handNo: 0,
      dealer: GK.rng.int(seats.length),
      deck: [],
      board: [],
      street: 'preflop',
      toAct: -1,
      currentBet: 0,
      minRaise: 0,
      phase: 'waiting', // 'betting' | 'handOver' | 'finished'
      result: null,
      log: [],
    };
  }

  // ---------- Hilfsfunktionen ----------

  const isActive = p => !p.out;
  const inHand = p => !p.out && !p.folded;
  const canAct = p => !p.out && !p.folded && !p.allIn;

  function nextSeat(t, from, predicate) {
    const n = t.players.length;
    for (let i = 1; i <= n; i++) {
      const seat = (from + i) % n;
      if (predicate(t.players[seat])) return seat;
    }
    return -1;
  }

  function pot(t) {
    return t.players.reduce((sum, p) => sum + p.total, 0);
  }

  function blinds(t) {
    return t.blindLevels[t.level];
  }

  function log(t, text) {
    t.log.unshift(text);
    t.log.length = Math.min(t.log.length, LOG_LENGTH);
  }

  function pay(p, amount) {
    amount = Math.min(amount, p.chips);
    p.chips -= amount;
    p.bet += amount;
    p.total += amount;
    if (p.chips === 0) p.allIn = true;
    return amount;
  }

  // ---------- Ablauf einer Hand ----------

  function startHand(t) {
    if (t.players.filter(isActive).length < 2) {
      t.phase = 'finished';
      return;
    }
    t.handNo++;
    t.level = Math.min(Math.floor((t.handNo - 1) / t.handsPerLevel), t.blindLevels.length - 1);
    t.dealer = nextSeat(t, t.dealer, isActive);
    t.players.forEach(p => {
      Object.assign(p, { bet: 0, total: 0, cards: [], folded: p.out, allIn: false, acted: false, lastAction: '' });
    });
    t.deck = GK.cards.createDeck(1);
    t.board = [];
    t.street = 'preflop';
    t.result = null;
    t.phase = 'betting';

    t.players.forEach(p => { if (isActive(p)) p.cards = [t.deck.pop(), t.deck.pop()]; });

    // Heads-up (nur noch 2 Spieler): Der Dealer setzt den Small Blind
    const headsUp = t.players.filter(isActive).length === 2;
    const sbSeat = headsUp ? t.dealer : nextSeat(t, t.dealer, isActive);
    const bbSeat = nextSeat(t, sbSeat, isActive);
    const { sb, bb } = blinds(t);
    pay(t.players[sbSeat], sb);
    pay(t.players[bbSeat], bb);
    t.players[sbSeat].lastAction = 'Small Blind';
    t.players[bbSeat].lastAction = 'Big Blind';
    t.currentBet = bb;
    t.minRaise = bb;
    log(t, `— Hand ${t.handNo} · Blinds ${sb}/${bb} —`);

    t.toAct = bbSeat;
    advance(t);
  }

  // Was darf der Spieler am Zug gerade tun?
  function legalActions(t) {
    const p = t.players[t.toAct];
    if (!p || t.phase !== 'betting') return null;
    const toCall = Math.min(t.currentBet - p.bet, p.chips);
    const maxRaiseTo = p.bet + p.chips;
    const othersCanAct = t.players.some((o, i) => i !== t.toAct && canAct(o));
    const canRaise = maxRaiseTo > t.currentBet && othersCanAct;
    return {
      toCall,
      canCheck: t.currentBet === p.bet,
      canRaise,
      minRaiseTo: Math.min(t.currentBet + t.minRaise, maxRaiseTo),
      maxRaiseTo,
      pot: pot(t),
    };
  }

  // action: { type: 'fold' | 'check' | 'call' | 'raise', to?: Zielbetrag beim Erhöhen }
  function act(t, action) {
    const la = legalActions(t);
    if (!la) return false;
    const p = t.players[t.toAct];
    let type = action.type;
    if (type === 'check' && !la.canCheck) type = 'call';
    if (type === 'call' && la.canCheck) type = 'check';
    if (type === 'raise' && !la.canRaise) type = la.canCheck ? 'check' : 'call';

    if (type === 'fold') {
      p.folded = true;
      p.lastAction = 'Fold';
    } else if (type === 'check') {
      p.lastAction = 'Check';
    } else if (type === 'call') {
      pay(p, la.toCall);
      p.lastAction = p.allIn ? 'All-in' : `Call ${p.bet}`;
    } else if (type === 'raise') {
      const to = Math.floor(Math.min(Math.max(action.to || 0, la.minRaiseTo), la.maxRaiseTo));
      const raiseBy = to - t.currentBet;
      pay(p, to - p.bet);
      // Eine volle Erhöhung eröffnet die Setzrunde für alle anderen neu
      if (raiseBy >= t.minRaise) {
        t.minRaise = raiseBy;
        t.players.forEach(o => { if (o !== p) o.acted = false; });
      }
      t.currentBet = Math.max(t.currentBet, to);
      p.lastAction = p.allIn ? 'All-in' : `Erhöht auf ${to}`;
    } else {
      return false;
    }
    p.acted = true;
    log(t, `${p.name}: ${p.lastAction}`);
    advance(t);
    return true;
  }

  // Nächsten Spieler bestimmen oder die Setzrunde / Hand beenden
  function advance(t) {
    const remaining = t.players.filter(inHand);
    if (remaining.length === 1) {
      awardUncontested(t, t.players.indexOf(remaining[0]));
      return;
    }
    const next = nextSeat(t, t.toAct, p => canAct(p) && (!p.acted || p.bet < t.currentBet));
    if (next !== -1) {
      t.toAct = next;
      return;
    }
    nextStreet(t);
  }

  function nextStreet(t) {
    t.players.forEach(p => { p.bet = 0; p.acted = false; });
    t.currentBet = 0;
    t.minRaise = blinds(t).bb;

    if (t.street === 'river') {
      showdown(t);
      return;
    }
    t.deck.pop(); // Brennkarte
    if (t.street === 'preflop') {
      t.board.push(t.deck.pop(), t.deck.pop(), t.deck.pop());
      t.street = 'flop';
    } else if (t.street === 'flop') {
      t.board.push(t.deck.pop());
      t.street = 'turn';
    } else {
      t.board.push(t.deck.pop());
      t.street = 'river';
    }
    log(t, `${{ flop: 'Flop', turn: 'Turn', river: 'River' }[t.street]}: ${t.board.map(GK.cards.label).join(' ')}`);

    // Können höchstens noch einer setzen (Rest ist All-in), werden die Karten einfach aufgedeckt
    if (t.players.filter(canAct).length <= 1) {
      nextStreet(t);
      return;
    }
    t.toAct = nextSeat(t, t.dealer, canAct);
  }

  function awardUncontested(t, seat) {
    const winner = t.players[seat];
    const amount = pot(t);
    winner.chips += amount;
    log(t, `${winner.name} gewinnt ${amount}`);
    endHand(t, { winners: [{ seat, amount, hand: null }], showdown: false });
  }

  function showdown(t) {
    const contenders = t.players.map((p, seat) => ({ p, seat })).filter(c => inHand(c.p));
    contenders.forEach(c => { c.eval = GK.poker.evaluate([...c.p.cards, ...t.board]); });

    // Haupt- und Nebentöpfe: je Einsatz-Stufe der verbliebenen Spieler ein Topf
    const levels = [...new Set(contenders.map(c => c.p.total))].sort((a, b) => a - b);
    const won = {};
    let previous = 0;
    let distributed = 0;
    let lastWinners = [];
    levels.forEach(level => {
      const amount = t.players.reduce((sum, p) =>
        sum + Math.min(p.total, level) - Math.min(p.total, previous), 0);
      previous = level;
      if (amount <= 0) return;
      const eligible = contenders.filter(c => c.p.total >= level);
      const best = Math.max(...eligible.map(c => c.eval.score));
      const winners = orderFromDealer(t, eligible.filter(c => c.eval.score === best));
      const share = Math.floor(amount / winners.length);
      winners.forEach((c, i) => {
        // Nicht teilbare Restchips bekommt der erste Gewinner links vom Dealer
        const extra = i === 0 ? amount - share * winners.length : 0;
        won[c.seat] = (won[c.seat] || 0) + share + extra;
      });
      distributed += amount;
      lastWinners = winners;
    });
    // Sicherheitsnetz: übrige Chips (sollte nicht vorkommen) gehen an den letzten Gewinner
    const leftover = pot(t) - distributed;
    if (leftover > 0 && lastWinners.length) won[lastWinners[0].seat] += leftover;

    const winnersList = Object.entries(won).map(([seat, amount]) => {
      seat = Number(seat);
      t.players[seat].chips += amount;
      const hand = contenders.find(c => c.seat === seat).eval.name;
      log(t, `${t.players[seat].name} gewinnt ${amount} mit ${hand}`);
      return { seat, amount, hand };
    });
    const hands = {};
    contenders.forEach(c => { hands[c.seat] = c.eval.name; });
    endHand(t, { winners: winnersList, showdown: true, hands });
  }

  function orderFromDealer(t, list) {
    const n = t.players.length;
    return list.slice().sort((a, b) => ((a.seat - t.dealer + n - 1) % n) - ((b.seat - t.dealer + n - 1) % n));
  }

  function endHand(t, result) {
    t.result = result;
    t.phase = 'handOver';
    t.toAct = -1;

    // Ausgeschiedene Spieler: Wer mehr Chips in die Hand gebracht hat, bekommt den besseren Platz
    const busted = t.players.filter(p => isActive(p) && p.chips === 0).sort((a, b) => b.total - a.total);
    const activeBefore = t.players.filter(isActive).length;
    busted.forEach((p, i) => {
      p.out = true;
      p.place = activeBefore - (busted.length - 1 - i);
      log(t, `${p.name} scheidet aus (${p.place}. Platz)`);
    });
    const left = t.players.filter(isActive);
    if (left.length === 1) {
      left[0].place = 1;
      t.phase = 'finished';
      log(t, `🏆 ${left[0].name} gewinnt das Turnier!`);
    }
  }

  // Spieler gibt das Turnier auf (z. B. „Tisch verlassen“) – zählt wie Ausscheiden
  function forfeit(t, seat) {
    const p = t.players[seat];
    if (p.out) return;
    p.place = t.players.filter(isActive).length;
    p.out = true;
    p.folded = true;
    p.chips = 0;
  }

  GK.poker.engine = { createTable, startHand, legalActions, act, forfeit, pot, blinds, inHand, canAct };
})();
