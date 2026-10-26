// Darstellung eines Poker-Tisches – gemeinsam für das Spiel gegen Computer und mit Freunden.
// Der eigene Platz wird immer unten in der Mitte angezeigt.
window.GK = window.GK || {};
GK.poker = GK.poker || {};

(function () {
  const engine = () => GK.poker.engine;

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
    if (p.out) status = `Ausgeschieden (${p.place}.)`;
    else if (winner) status = `+${GK.formatNumber(winner.amount)}` + (winner.hand ? ` · ${winner.hand}` : '');
    else if (showdown && t.result.hands) status = t.result.hands[seat];
    if (p.offline && !p.out) status = '📡 Verbindung weg';

    return `<div class="${classes.join(' ')}">
      <div class="seat-cards">${p.out ? '' : p.cards.map((c, i) => GK.cards.html(c, !showCards, cardClass, cardStyle(i))).join('')}</div>
      <div class="seat-plate">
        <div class="seat-name">${p.avatar || ''} ${escapeHtml(p.name)}${t.dealer === seat ? ' <span class="dealer-btn">D</span>' : ''}</div>
        <div class="seat-chips">${GK.formatNumber(p.chips)} Chips</div>
        <div class="seat-status">${status ? escapeHtml(status) : '&nbsp;'}</div>
      </div>
      ${p.bet ? `<div class="seat-bet">${GK.formatNumber(p.bet)}</div>` : ''}
    </div>`;
  }

  function feltMessage(t, mySeat) {
    if (t.phase === 'betting') {
      return t.toAct === mySeat ? 'Du bist dran!' : `${escapeHtml(t.players[t.toAct].name)} überlegt …`;
    }
    if (!t.result) return '';
    return t.result.winners.map(w =>
      `${escapeHtml(t.players[w.seat].name)} gewinnt ${GK.formatNumber(w.amount)}${w.hand ? ` mit ${w.hand}` : ''}`
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
   *   onLeave, leaveLabel,
   *   notice,            Hinweis über den Knöpfen (z. B. Verbindungsprobleme)
   *   deadline,          Zeitpunkt (ms), bis zu dem der Spieler am Zug handeln muss
   * }
   */
  function render(container, t, opts) {
    const oldLog = container.querySelector('.poker-log');
    if (oldLog) container.dataset.logOpen = oldLog.open ? '1' : '';
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

    container.innerHTML = `
      <div class="poker-info">${opts.info.map(i => `<span>${i}</span>`).join('')}</div>
      <div class="poker-table">
        <div class="poker-felt">
          <div class="poker-board">${board}</div>
          <div class="poker-pot">Pot: ${GK.formatNumber(engine().pot(t))}</div>
          <div class="poker-message">${feltMessage(t, opts.mySeat)}</div>
          <div class="turn-timer" data-deadline="${opts.deadline || ''}"></div>
        </div>
        ${t.players.map((p, i) => seatHtml(t, p, i, opts, anim)).join('')}
      </div>
      ${opts.notice ? `<div class="poker-notice">${opts.notice}</div>` : ''}
      <div class="poker-controls"></div>
      <div class="poker-bottom">
        <details class="poker-log" ${container.dataset.logOpen ? 'open' : ''}>
          <summary>Spielverlauf</summary>
          <ul>${t.log.map(l => `<li>${escapeHtml(l)}</li>`).join('')}</ul>
        </details>
        ${opts.onLeave ? `<button class="btn btn-danger poker-leave">${opts.leaveLabel || 'Turnier verlassen'}</button>` : ''}
      </div>`;
    if (opts.onLeave) container.querySelector('.poker-leave').addEventListener('click', opts.onLeave);
    renderControls(container.querySelector('.poker-controls'), t, opts);
    tick(container);
    playEffects(container, t, opts, anim);
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
    el.textContent = deadline && seconds >= 0 ? `⏱ ${seconds} s` : '';
    el.classList.toggle('urgent', seconds <= 5);
  }

  function renderControls(el, t, opts) {
    const me = t.players[opts.mySeat];
    const handName = me && me.cards.length && me.cards[0] && !me.out
      ? (t.board.length ? GK.poker.evaluate([...me.cards, ...t.board]).name
        : GK.cards.rank(me.cards[0]) === GK.cards.rank(me.cards[1]) ? 'Ein Paar' : '')
      : '';
    const handInfo = handName ? `<div class="poker-hand-name">Deine Hand: <b>${handName}</b></div>` : '';

    if (t.phase !== 'betting') {
      if (opts.onNext) {
        el.innerHTML = `${handInfo}<button class="btn btn-primary poker-next">${opts.nextLabel || 'Nächste Hand ▶'}</button>`;
        el.querySelector('.poker-next').addEventListener('click', opts.onNext);
      } else {
        el.innerHTML = `${handInfo}<div class="muted">${t.phase === 'finished' ? 'Das Turnier ist vorbei.' : 'Gleich geht es mit der nächsten Hand weiter …'}</div>`;
      }
      return;
    }
    if (!me || t.toAct !== opts.mySeat) {
      const text = !me || me.out ? 'Du schaust zu.'
        : me.folded ? 'Du hast gepasst – warte auf die nächste Hand.' : 'Warte auf die anderen Spieler …';
      el.innerHTML = `${handInfo}<div class="muted">${text}</div>`;
      return;
    }

    const la = engine().legalActions(t);
    const clampRaise = v => Math.min(Math.max(Math.round(v), la.minRaiseTo), la.maxRaiseTo);
    let raiseTo = clampRaise(la.minRaiseTo);
    const betWord = t.currentBet === 0 ? 'Setzen' : 'Erhöhen auf';

    el.innerHTML = `
      ${handInfo}
      <div class="game-actions">
        <button class="btn btn-danger" data-act="fold">Passen</button>
        <button class="btn" data-act="call">${la.canCheck ? 'Checken' : `Mitgehen ${GK.formatNumber(la.toCall)}`}</button>
        ${la.canRaise ? `<button class="btn btn-primary" data-act="raise">${betWord} <span class="raise-value"></span></button>` : ''}
      </div>
      ${la.canRaise && la.minRaiseTo < la.maxRaiseTo ? `
        <div class="raise-row">
          <input type="range" class="raise-slider" min="${la.minRaiseTo}" max="${la.maxRaiseTo}" step="1">
          <button class="btn btn-small" data-size="min">Min</button>
          <button class="btn btn-small" data-size="half">½ Pot</button>
          <button class="btn btn-small" data-size="pot">Pot</button>
          <button class="btn btn-small" data-size="all">All-in</button>
        </div>` : ''}`;

    const valueEl = el.querySelector('.raise-value');
    const slider = el.querySelector('.raise-slider');
    const update = () => {
      if (valueEl) valueEl.textContent = raiseTo >= la.maxRaiseTo ? `${GK.formatNumber(raiseTo)} (All-in)` : GK.formatNumber(raiseTo);
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
        opts.onAction(type === 'raise' ? { type, to: raiseTo } : { type });
      });
    });
  }

  GK.poker.ui = { render, tick, escapeHtml };
})();
