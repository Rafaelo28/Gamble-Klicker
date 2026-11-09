// Darstellung eines Poker-Tisches – gemeinsam für das Spiel gegen Computer und mit Freunden.
// Der eigene Platz wird immer unten in der Mitte angezeigt.
window.GK = window.GK || {};
// Sprache: Ersatz, falls js/i18n.js (noch) nicht geladen ist – gibt den deutschen Text zurück.
GK.t = GK.t || function (s, v) { s = String(s); return v ? s.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m)) : s; };
GK.i18n = GK.i18n || { add() {}, addHtml() {}, apply() {}, set() {}, lang: 'de' };
GK.i18n.add({
  'Out ({place}.)': 'Out ({place}.)',
  'Ausgeschieden ({place}.)': 'Out ({place}.)',
  '📡 Verbindung weg': '📡 Connection lost',
  '{n} Chips': '{n} chips',
  'Du bist dran!': "It's your turn!",
  '{name} überlegt …': '{name} is thinking …',
  '{name} gewinnt {amount}': '{name} wins {amount}',
  ' mit {hand}': ' with {hand}',
  'Höchste Karte': 'High Card',
  'Ein Paar': 'One Pair',
  'Zwei Paare': 'Two Pair',
  'Drilling': 'Three of a Kind',
  'Straße': 'Straight',
  'Flush': 'Flush',
  'Full House': 'Full House',
  'Vierling': 'Four of a Kind',
  'Straight Flush': 'Straight Flush',
  'Royal Flush': 'Royal Flush',
  'Pot: {n}': 'Pot: {n}',
  'Spielverlauf': 'Game log',
  'Turnier verlassen': 'Leave tournament',
  'Deine Hand: {hand}': 'Your hand: {hand}',
  'Nächste Hand ▶': 'Next hand ▶',
  'Das Turnier ist vorbei.': 'The tournament is over.',
  'Gleich geht es mit der nächsten Hand weiter …': 'The next hand starts shortly …',
  'Du schaust zu.': 'You are watching.',
  'Du hast gepasst – warte auf die nächste Hand.': 'You folded – wait for the next hand.',
  'Du bist All-in – jetzt heißt es Daumen drücken!': 'You are all-in – fingers crossed!',
  'Warte auf die anderen Spieler …': 'Waiting for the other players …',
  'Hand vorspulen': 'Skip hand',
  'Setzen': 'Bet',
  'Erhöhen auf': 'Raise to',
  'pk\u0001Passen': 'Fold',
  'Checken': 'Check',
  'Mitgehen {n}': 'Call {n}',
  'Min': 'Min',
  '½ Pot': '½ Pot',
  'Pot': 'Pot',
  'All-in': 'All-in',
  '{n} (All-in)': '{n} (all-in)',
  'Spielmodus': 'Game mode',
  'Anzahl Hände': 'Number of hands',
  'Wie viele Hände?': 'How many hands?',
  'Klassisch': 'Classic',
  'Turbo': 'Turbo',
  'Blitz': 'Blitz',
  '1.500 Chips, Blinds steigen alle 8 Hände': '1,500 chips, blinds rise every 8 hands',
  '1.000 Chips, Blinds steigen alle 3 Hände, flotte Gegner': '1,000 chips, blinds rise every 3 hands, nimble opponents',
  'Nur 3, 5 oder 10 Hände – danach zählen die Chips': 'Only 3, 5 or 10 hands – then the chips decide',
});
GK.poker = GK.poker || {};

(function () {
  const engine = () => GK.poker.engine;
  // Eigenes Symbol (in Node-Tests gibt es keins → Emoji)
  const ic = (name, emoji) => (GK.icon ? GK.icon(name) : emoji || '');

  // Welche der 6 Sitz-Positionen am Tisch bei wie vielen Spielern benutzt werden
  // (0 = unten Mitte, dann im Uhrzeigersinn: 1 unten links … 5 unten rechts)
  const POSITIONS = {
    2: [0, 3],
    3: [0, 2, 4],
    4: [0, 1, 3, 5],
    5: [0, 1, 2, 4, 5],
    6: [0, 1, 2, 3, 4, 5],
  };

  function positionOf(seat, mySeat, count) {
    const offset = mySeat >= 0 ? mySeat : 0;
    return POSITIONS[count][(seat - offset + count) % count];
  }

  function seatHtml(t, p, seat, opts, anim) {
    const me = seat === opts.mySeat;
    const showdown = t.phase !== 'betting' && t.result && t.result.showdown && engine().inHand(p);
    const showCards = me || showdown;
    // Neue Hand: Karten fliegen herein · Showdown: Karten drehen sich um
    const cardClass = anim.newHand ? 'small deal-in' : showdown && !me && !anim.wasRevealed ? 'small flip-in' : 'small';
    const cardStyle = i => (anim.newHand ? `animation-delay: ${(anim.order(seat) * 2 + i) * 0.07}s` : '');
    const winner = t.result && t.phase !== 'betting' && t.result.winners.find(w => w.seat === seat);
    const classes = ['poker-seat', 'seat-' + positionOf(seat, opts.mySeat, t.players.length)];
    if (t.phase === 'betting' && t.toAct === seat) classes.push('active');
    if (p.folded && !p.out) classes.push('folded');
    if (p.out) classes.push('out');
    if (winner) classes.push('winner');
    if (me) classes.push('me');

    let status = p.lastAction;
    if (p.out) status = GK.t('Ausgeschieden ({place}.)', { place: p.place });
    else if (winner) status = `+${GK.formatNumber(winner.amount)}` + (winner.hand ? ` · ${GK.t(winner.hand)}` : '');
    else if (showdown && t.result.hands) status = GK.t(t.result.hands[seat]);
    if (p.offline && !p.out) status = GK.t('📡 Verbindung weg');

    return `<div class="${classes.join(' ')}">
      <div class="seat-cards">${p.out ? '' : p.cards.map((c, i) => GK.cards.html(c, !showCards, cardClass, cardStyle(i))).join('')}</div>
      <div class="seat-plate">
        <div class="seat-name">${GK.cosmetics ? GK.cosmetics.nameTag(p) : `${p.avatar || ''} ${escapeHtml(p.name)}`}${t.dealer === seat ? ' <span class="dealer-btn">D</span>' : ''}</div>
        <div class="seat-chips">${GK.t('{n} Chips', { n: GK.formatNumber(p.chips) })}</div>
        <div class="seat-status">${status ? escapeHtml(status) : '&nbsp;'}</div>
      </div>
      ${p.bet ? `<div class="seat-bet">${GK.formatNumber(p.bet)}</div>` : ''}
    </div>`;
  }

  function feltMessage(t, mySeat) {
    if (t.phase === 'betting') {
      return t.toAct === mySeat ? GK.t('Du bist dran!') : GK.t('{name} überlegt …', { name: escapeHtml(t.players[t.toAct].name) });
    }
    if (!t.result) return '';
    return t.result.winners.map(w =>
      GK.t('{name} gewinnt {amount}', { name: escapeHtml(t.players[w.seat].name), amount: GK.formatNumber(w.amount) })
      + (w.hand ? GK.t(' mit {hand}', { hand: GK.t(w.hand) }) : '')
    ).join(' · ');
  }

  // Namen kommen im Multiplayer von anderen Spielern – deshalb immer als Text ausgeben
  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /**
   * Zeichnet den Tisch in `container`.
   * opts: {
   *   mySeat,            eigener Platz
   *   info: [html],      Zeile über dem Tisch
   *   onAction(action),  eigene Aktion (Passen, Checken, …)
   *   onNext,            „Nächste Hand“ – nur wer den Tisch leitet; sonst null
   *   nextLabel,
   *   onSkip,            „Hand vorspulen“, wenn man selbst nichts mehr tun kann; sonst null
   *   onLeave, leaveLabel,
   *   notice,            Hinweis über den Knöpfen (z. B. Verbindungsprobleme)
   *   deadline,          Zeitpunkt (ms), bis zu dem der Spieler am Zug handeln muss
   * }
   */
  function render(container, t, opts) {
    const anim = animationState(container, t, opts);
    let boardDelay = 0;
    const board = [0, 1, 2, 3, 4].map(i => {
      if (!t.board[i]) return '<div class="card-placeholder"></div>';
      if (i < anim.prevBoard) return GK.cards.html(t.board[i]);
      const d = boardDelay;
      boardDelay += 0.15;
      setTimeout(() => GK.sound.play('card'), d * 1000);
      return GK.cards.html(t.board[i], false, 'deal-in', `animation-delay: ${d}s`);
    }).join('');

    // Das Grundgerüst wird nur einmal angelegt. Knöpfe werden nur ersetzt, wenn sie sich ändern –
    // sonst ginge ein Tipp verloren, während die Gegner (z. B. im Turbo-Modus) schnell spielen.
    if (!container.querySelector(':scope > .poker-table')) {
      container.innerHTML = `
        <div class="poker-info"></div>
        <div class="poker-table"></div>
        <div class="poker-notice" hidden></div>
        <div class="poker-controls"></div>
        <div class="poker-bottom">
          <details class="poker-log">
            <summary>${GK.t('Spielverlauf')}</summary>
            <ul></ul>
          </details>
          <button class="btn btn-danger poker-leave" hidden></button>
        </div>`;
      container.querySelector('.poker-leave').addEventListener('click', () => {
        const leave = container._pokerOpts.onLeave;
        if (leave) leave();
      });
    }
    container._pokerOpts = opts;
    const $ = sel => container.querySelector(`:scope > ${sel}`);
    setHtml($('.poker-info'), opts.info.map(i => `<span>${i}</span>`).join(''));
    $('.poker-table').innerHTML = `
      <div class="poker-felt">
        <div class="poker-board">${board}</div>
        <div class="poker-pot">${GK.t('Pot: {n}', { n: GK.formatNumber(engine().pot(t)) })}</div>
        <div class="poker-message">${feltMessage(t, opts.mySeat)}</div>
        <div class="turn-timer" data-deadline="${opts.deadline || ''}"></div>
      </div>
      ${t.players.map((p, i) => seatHtml(t, p, i, opts, anim)).join('')}`;
    const notice = $('.poker-notice');
    setHtml(notice, opts.notice || '');
    notice.hidden = !opts.notice;
    setHtml(container.querySelector('.poker-log ul'), t.log.map(l => `<li>${escapeHtml(l)}</li>`).join(''));
    const leave = container.querySelector('.poker-leave');
    setHtml(leave, opts.leaveLabel || GK.t('Turnier verlassen'));
    leave.hidden = !opts.onLeave;
    renderControls($('.poker-controls'), t, opts);
    tick(container);
    playEffects(container, t, opts, anim);
  }

  // Inhalt nur ersetzen, wenn er sich geändert hat. Gibt true zurück, wenn neu aufgebaut wurde.
  function setHtml(el, html) {
    if (el._html === html) return false;
    el._html = html;
    el.innerHTML = html;
    return true;
  }

  // Vergleicht mit dem letzten Zeichnen: Was ist neu? (Nach dem Neuladen wird nichts animiert.)
  function animationState(container, t, opts) {
    const prev = container._pokerSeen;
    const showdown = t.phase !== 'betting' && !!(t.result && t.result.showdown);
    const resultKey = t.phase !== 'betting' ? `${t.handNo}:${t.phase}` : '';
    const now = { handNo: t.handNo, board: t.board.length, revealed: showdown, logTop: t.log[0], resultKey };
    container._pokerSeen = now;
    const active = t.players.map((p, i) => i).filter(i => !t.players[i].out);
    const order = seat => (active.indexOf(seat) - active.indexOf(t.dealer) + active.length) % active.length;
    if (!prev) return { newHand: false, prevBoard: t.board.length, wasRevealed: showdown, order, newLog: false, newResult: false };
    const newHand = prev.handNo !== t.handNo;
    if (newHand) setTimeout(() => GK.sound.play('deal'), 0);
    return {
      newHand,
      prevBoard: newHand ? 0 : prev.board,
      wasRevealed: !newHand && prev.revealed,
      order,
      newLog: prev.logTop !== now.logTop,
      newResult: !!resultKey && prev.resultKey !== resultKey,
    };
  }

  // Sounds und Funken passend zu dem, was gerade passiert ist
  function playEffects(container, t, opts, anim) {
    if (anim.newLog && t.phase === 'betting' && !anim.newHand) {
      const last = t.log[0] || '';
      if (/Fold/.test(last)) GK.sound.play('flip');
      else if (/Call|Erhöht|All-in/.test(last)) GK.sound.play('chip');
      else if (/Check/.test(last)) GK.sound.play('tick');
    }
    if (anim.newResult && t.result) {
      const iWon = t.result.winners.some(w => w.seat === opts.mySeat);
      const seatEl = container.querySelector('.poker-seat.me');
      if (iWon && seatEl) {
        GK.sound.play('winSmall');
        const pos = GK.fx.center(seatEl);
        GK.fx.burst(pos.x, pos.y, { count: 16, speed: 520, upward: true });
        GK.fx.burst(pos.x, pos.y, { count: 10, kind: 'sparkle', speed: 260 });
      } else {
        GK.sound.play('chip');
      }
      GK.fx.pulse(container.querySelector('.poker-pot'), 'fx-pulse');
    }
  }

  // Countdown für den Spieler am Zug aktualisieren (wird regelmäßig aufgerufen)
  function tick(container) {
    const el = container.querySelector('.turn-timer');
    if (!el) return;
    const deadline = Number(el.dataset.deadline);
    const seconds = Math.ceil((deadline - Date.now()) / 1000);
    setHtml(el, deadline && seconds >= 0 ? `${ic('hourglass', '⏱')} ${seconds} s` : '');
    el.classList.toggle('urgent', seconds <= 5);
  }

  function renderControls(el, t, opts) {
    const me = t.players[opts.mySeat];
    const handName = me && me.cards.length && me.cards[0] && !me.out && !me.folded
      ? (t.board.length ? GK.poker.evaluate([...me.cards, ...t.board]).name
        : GK.cards.rank(me.cards[0]) === GK.cards.rank(me.cards[1]) ? 'Ein Paar' : '')
      : '';
    const handInfo = handName ? `<div class="poker-hand-name">${GK.t('Deine Hand: {hand}', { hand: `<b>${GK.t(handName)}</b>` })}</div>` : '';
    // Die Knöpfe rufen immer die aktuellen Funktionen auf (el._opts), auch wenn sie nicht neu gebaut wurden
    el._opts = opts;
    const call = (name, ...args) => {
      el._html = null; // nach einer Aktion beim nächsten Zeichnen auf jeden Fall neu aufbauen
      if (el._opts[name]) el._opts[name](...args);
    };

    if (t.phase !== 'betting') {
      if (opts.onNext) {
        if (setHtml(el, `${handInfo}<button class="btn btn-primary poker-next">${opts.nextLabel || GK.t('Nächste Hand ▶')}</button>`)) {
          el.querySelector('.poker-next').addEventListener('click', () => call('onNext'));
        }
      } else {
        setHtml(el, `${handInfo}<div class="muted">${t.phase === 'finished' ? GK.t('Das Turnier ist vorbei.') : GK.t('Gleich geht es mit der nächsten Hand weiter …')}</div>`);
      }
      return;
    }
    if (!me || t.toAct !== opts.mySeat) {
      const text = !me || me.out ? GK.t('Du schaust zu.')
        : me.folded ? GK.t('Du hast gepasst – warte auf die nächste Hand.')
          : me.allIn ? GK.t('Du bist All-in – jetzt heißt es Daumen drücken!') : GK.t('Warte auf die anderen Spieler …');
      const html = `${handInfo}<div class="muted">${text}</div>` +
        (opts.onSkip ? `<button class="btn poker-skip">${ic('forward', '⏩')}${GK.t('Hand vorspulen')}</button>` : '');
      if (setHtml(el, html) && opts.onSkip) {
        el.querySelector('.poker-skip').addEventListener('click', e => {
          e.currentTarget.disabled = true;
          call('onSkip');
        });
      }
      return;
    }

    const la = engine().legalActions(t);
    const clampRaise = v => Math.min(Math.max(Math.round(v), la.minRaiseTo), la.maxRaiseTo);
    let raiseTo = clampRaise(la.minRaiseTo);
    const betWord = t.currentBet === 0 ? GK.t('Setzen') : GK.t('Erhöhen auf');

    const changed = setHtml(el, `
      ${handInfo}
      <div class="game-actions">
        <button class="btn btn-danger" data-act="fold">${GK.t('Passen', null, 'pk')}</button>
        <button class="btn" data-act="call">${la.canCheck ? GK.t('Checken') : GK.t('Mitgehen {n}', { n: GK.formatNumber(la.toCall) })}</button>
        ${la.canRaise ? `<button class="btn btn-primary" data-act="raise">${betWord} <span class="raise-value"></span></button>` : ''}
      </div>
      ${la.canRaise && la.minRaiseTo < la.maxRaiseTo ? `
        <div class="raise-row">
          <input type="range" class="raise-slider" min="${la.minRaiseTo}" max="${la.maxRaiseTo}" step="1">
          <button class="btn btn-small" data-size="min">${GK.t('Min')}</button>
          <button class="btn btn-small" data-size="half">${GK.t('½ Pot')}</button>
          <button class="btn btn-small" data-size="pot">${GK.t('Pot')}</button>
          <button class="btn btn-small" data-size="all">${GK.t('All-in')}</button>
        </div>` : ''}`);
    if (!changed) return; // gleiche Lage: Knöpfe und gewählter Betrag bleiben, wie sie sind

    const valueEl = el.querySelector('.raise-value');
    const slider = el.querySelector('.raise-slider');
    const update = () => {
      if (valueEl) valueEl.textContent = raiseTo >= la.maxRaiseTo ? GK.t('{n} (All-in)', { n: GK.formatNumber(raiseTo) }) : GK.formatNumber(raiseTo);
      if (slider) slider.value = raiseTo;
    };
    update();
    if (slider) {
      slider.addEventListener('input', () => {
        raiseTo = clampRaise(Number(slider.value));
        update();
      });
    }
    el.querySelectorAll('[data-size]').forEach(btn => {
      btn.addEventListener('click', () => {
        const sizes = {
          min: la.minRaiseTo,
          half: t.currentBet + (la.pot + la.toCall) / 2,
          pot: t.currentBet + la.pot + la.toCall,
          all: la.maxRaiseTo,
        };
        raiseTo = clampRaise(sizes[btn.dataset.size]);
        update();
      });
    });
    el.querySelectorAll('[data-act]').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.act;
        el.querySelectorAll('button').forEach(b => { b.disabled = true; }); // kein Doppelklick
        call('onAction', type === 'raise' ? { type, to: raiseTo } : { type });
      });
    });
  }

  // Auswahl Klassisch/Turbo/Blitz (für Computer-Turniere und neue Räume mit Freunden).
  // Beim Blitz kommt die Zahl der Hände dazu.
  function modePicker(selected, hands, cls) {
    const T = GK.poker.tournament;
    return `<div class="poker-modes ${cls}" role="group" aria-label="${GK.t('Spielmodus')}">
      ${Object.values(T.MODES).map(m => `
        <button type="button" class="poker-mode ${m.id === selected ? 'active' : ''}" data-mode="${m.id}">
          <span class="poker-mode-name">${ic(m.sym, m.icon)} ${GK.t(m.name)}</span>
          <span class="poker-mode-desc">${GK.t(m.desc)}</span>
        </button>`).join('')}
      ${selected === 'blitz' ? `
        <div class="poker-hands" role="group" aria-label="${GK.t('Anzahl Hände')}">
          <span>${GK.t('Wie viele Hände?')}</span>
          ${T.BLITZ_HANDS.map(n => `<button type="button" class="poker-hands-btn ${n === hands ? 'active' : ''}" data-hands="${n}">${n}</button>`).join('')}
        </div>` : ''}
    </div>`;
  }

  GK.poker.ui = { render, tick, escapeHtml, modePicker };
})();
