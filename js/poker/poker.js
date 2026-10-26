// Texas Hold'em im Casino: Sit-&-Go-Turnier gegen 5 Computer-Gegner.
// Man zahlt einmal Eintritt in Dublonen, alle bekommen gleich viele Tisch-Chips.
// Die besten drei Plätze bekommen Dublonen ausgezahlt.
window.GK = window.GK || {};

(function () {
  const engine = () => GK.poker.engine;
  const START_CHIPS = 1500;
  const HANDS_PER_LEVEL = 8;
  const SEATS = 6;
  const HUMAN = 0;
  const PRIZES = [3, 1.8, 1.2]; // Vielfaches des Eintritts für Platz 1–3 (Summe = alle 6 Eintritte)
  const BLIND_LEVELS = [
    [10, 20], [15, 30], [25, 50], [50, 100], [75, 150], [100, 200], [150, 300],
    [200, 400], [300, 600], [500, 1000], [800, 1600], [1000, 2000], [1500, 3000], [2000, 4000],
  ].map(([sb, bb]) => ({ sb, bb }));

  const TIERS = [
    { id: 'harbor',  icon: '🍺', name: 'Hafenkneipe',       entry: 1000 },
    { id: 'captain', icon: '⚓', name: 'Kapitänstisch',     entry: 100000 },
    { id: 'royal',   icon: '👑', name: 'Königlicher Salon', entry: 10000000 },
  ];

  let body;
  let timer = null;
  let raiseTo = 0;
  let logOpen = false;

  function state() {
    return GK.casino.data('poker', () => ({ table: null, tierId: null, lastResult: null }));
  }

  function tier() {
    return TIERS.find(t => t.id === state().tierId);
  }

  function prize(place, entry) {
    return place <= PRIZES.length ? Math.floor(entry * PRIZES[place - 1]) : 0;
  }

  // ---------- Turnier-Ablauf ----------

  function join(tierId) {
    const tr = TIERS.find(t => t.id === tierId);
    if (!GK.casino.bet(tr.entry)) {
      GK.toast('Nicht genug Dublonen für den Eintritt.');
      return;
    }
    const bots = GK.rng.shuffle(GK.poker.ai.BOTS.slice()).slice(0, SEATS - 1);
    const seats = [{ id: 'you', name: 'Du', avatar: '🙂', isBot: false }].concat(
      bots.map((b, i) => ({ id: 'bot' + i, name: b.name, avatar: b.avatar, isBot: true, personality: b.personality })));
    const table = engine().createTable({
      seats, startChips: START_CHIPS, blindLevels: BLIND_LEVELS, handsPerLevel: HANDS_PER_LEVEL,
    });
    table.players.forEach((p, i) => { p.avatar = seats[i].avatar; });
    const s = state();
    s.table = table;
    s.tierId = tierId;
    s.lastResult = null;
    engine().startHand(table);
    afterChange();
  }

  function humanAct(action) {
    const t = state().table;
    if (!t || t.phase !== 'betting' || t.toAct !== HUMAN) return;
    engine().act(t, action);
    afterChange();
  }

  function botStep() {
    const t = state().table;
    if (!t || t.phase !== 'betting' || !t.players[t.toAct].isBot) return;
    engine().act(t, GK.poker.ai.decide(t));
    afterChange();
  }

  function continueAfterHand() {
    const t = state().table;
    if (!t || t.phase === 'betting') return;
    if (t.phase === 'finished' || t.players[HUMAN].out) {
      finishTournament();
      return;
    }
    engine().startHand(t);
    afterChange();
  }

  function leaveTable() {
    const t = state().table;
    if (!t) return;
    const place = t.players.filter(p => !p.out).length;
    const win = prize(place, tier().entry);
    const text = `Turnier wirklich verlassen? Du belegst damit Platz ${place}` +
      (win ? ` und bekommst ${GK.formatNumber(win)} Dublonen.` : ' und gehst leer aus.');
    if (!confirm(text)) return;
    engine().forfeit(t, HUMAN);
    finishTournament();
  }

  function finishTournament() {
    const s = state();
    const t = s.table;
    const tr = tier();
    const place = t.players[HUMAN].place;
    const win = prize(place, tr.entry);
    GK.casino.payout(win);
    s.lastResult = { place, prize: win, tierName: tr.name, entry: tr.entry };
    s.table = null;
    GK.casino.record('poker', tr.entry, win, `${place}. Platz · ${tr.name}`);
    afterChange();
  }

  // Nach jeder Änderung: speichern, neu zeichnen und den nächsten Schritt planen
  function afterChange() {
    GK.save();
    drawView();
    schedule();
  }

  // Der Tisch ist nur sichtbar, wenn Casino-Tab und Poker-Spiel geöffnet sind
  function isVisible() {
    return body.offsetParent !== null;
  }

  // Nächsten automatischen Schritt planen. Ist der Tisch nicht zu sehen, pausiert das Spiel,
  // bis man zurückkommt (dann ruft onShow → refresh → schedule erneut auf).
  function schedule() {
    clearTimeout(timer);
    const t = state().table;
    if (!t || !isVisible()) return;
    let step = null;
    let delay = 0;
    if (t.phase === 'betting' && t.players[t.toAct].isBot) {
      step = botStep;
      delay = engine().inHand(t.players[HUMAN]) ? 900 : 350;
    } else if (t.phase !== 'betting') {
      step = continueAfterHand;
      delay = t.result && t.result.showdown ? 4500 : 2500;
    }
    if (step) {
      timer = setTimeout(() => {
        if (isVisible()) step();
      }, delay);
    }
  }

  // ---------- Darstellung ----------

  function drawView() {
    if (state().table) drawTable();
    else drawLobby();
  }

  function drawLobby() {
    const r = state().lastResult;
    const resultHtml = r ? `
      <div class="poker-result ${r.prize ? 'win' : 'loss'}">
        ${r.place === 1 ? '🏆' : r.prize ? '🎉' : '😢'}
        Du hast im ${r.tierName} den <b>${r.place}. Platz</b> belegt${r.prize
          ? ` und ${GK.formatMoneyHTML(r.prize)} gewonnen!` : '.'}
      </div>` : '';
    body.innerHTML = `
      ${resultHtml}
      <p class="muted">
        <b>Sit &amp; Go-Turnier:</b> Du zahlst den Eintritt in Dublonen und bekommst – genau wie deine
        5 Computer-Gegner – ${GK.formatNumber(START_CHIPS)} Tisch-Chips. Die Blinds steigen alle
        ${HANDS_PER_LEVEL} Hände. Gespielt wird, bis einer alle Chips hat.
        Preise: 🥇 ${PRIZES[0]}× · 🥈 ${String(PRIZES[1]).replace('.', ',')}× · 🥉 ${String(PRIZES[2]).replace('.', ',')}× Eintritt.
      </p>
      <div class="casino-grid poker-tiers">
        ${TIERS.map(tr => `
          <div class="casino-card poker-tier">
            <div class="casino-emoji">${tr.icon}</div>
            <h3>${tr.name}</h3>
            <p>Eintritt: ${GK.formatMoneyHTML(tr.entry)}</p>
            <p class="small">1. Platz: ${GK.formatMoneyHTML(prize(1, tr.entry))}</p>
            <button class="btn btn-primary poker-join" data-tier="${tr.id}">Platz nehmen</button>
          </div>`).join('')}
        <div class="casino-card locked">
          <div class="casino-emoji">👥</div>
          <h3>Mit Freunden</h3>
          <p>Online-Raum mit Code – kommt in Phase 6</p>
        </div>
      </div>`;
    body.querySelectorAll('.poker-join').forEach(btn => {
      btn.addEventListener('click', () => join(btn.dataset.tier));
    });
    updateLobbyButtons();
  }

  function updateLobbyButtons() {
    body.querySelectorAll('.poker-join').forEach(btn => {
      btn.disabled = !GK.canAfford(TIERS.find(t => t.id === btn.dataset.tier).entry);
    });
  }

  function seatHtml(t, p, seat) {
    const showdown = t.phase !== 'betting' && t.result && t.result.showdown && engine().inHand(p);
    const showCards = seat === HUMAN || showdown;
    const winner = t.result && t.result.winners.find(w => w.seat === seat);
    const classes = ['poker-seat', 'seat-' + seat];
    if (t.phase === 'betting' && t.toAct === seat) classes.push('active');
    if (p.folded && !p.out) classes.push('folded');
    if (p.out) classes.push('out');
    if (winner) classes.push('winner');

    let status = p.lastAction;
    if (p.out) status = `Ausgeschieden (${p.place}.)`;
    else if (winner) status = `+${GK.formatNumber(winner.amount)}` + (winner.hand ? ` · ${winner.hand}` : '');
    else if (showdown && t.result.hands) status = t.result.hands[seat];

    return `<div class="${classes.join(' ')}">
      <div class="seat-cards">${p.out ? '' : p.cards.map(c => GK.cards.html(c, !showCards, 'small')).join('')}</div>
      <div class="seat-plate">
        <div class="seat-name">${p.avatar || ''} ${p.name}${t.dealer === seat ? ' <span class="dealer-btn">D</span>' : ''}</div>
        <div class="seat-chips">${GK.formatNumber(p.chips)} Chips</div>
        <div class="seat-status">${status || '&nbsp;'}</div>
      </div>
      ${p.bet ? `<div class="seat-bet">${GK.formatNumber(p.bet)}</div>` : ''}
    </div>`;
  }

  function feltMessage(t) {
    if (t.phase === 'betting') {
      return t.toAct === HUMAN ? 'Du bist dran!' : `${t.players[t.toAct].name} überlegt …`;
    }
    const winners = t.result.winners.map(w => {
      const name = t.players[w.seat].name;
      return `${name} gewinnt ${GK.formatNumber(w.amount)}${w.hand ? ` mit ${w.hand}` : ''}`;
    });
    return winners.join(' · ');
  }

  function drawTable() {
    const t = state().table;
    const oldLog = body.querySelector('.poker-log');
    if (oldLog) logOpen = oldLog.open;
    const tr = tier();
    const { sb, bb } = engine().blinds(t);
    const handsLeft = HANDS_PER_LEVEL - ((t.handNo - 1) % HANDS_PER_LEVEL);
    const playersLeft = t.players.filter(p => !p.out).length;
    const board = [0, 1, 2, 3, 4].map(i => t.board[i]
      ? GK.cards.html(t.board[i])
      : '<div class="card-placeholder"></div>').join('');

    body.innerHTML = `
      <div class="poker-info">
        <span>${tr.icon} ${tr.name}</span>
        <span>Blinds ${GK.formatNumber(sb)}/${GK.formatNumber(bb)}</span>
        <span>${t.level < BLIND_LEVELS.length - 1 ? `Erhöhung in ${handsLeft} ${handsLeft === 1 ? 'Hand' : 'Händen'}` : 'Höchste Stufe'}</span>
        <span>Spieler: ${playersLeft}/${SEATS}</span>
        <span>🥇 ${GK.formatMoneyHTML(prize(1, tr.entry))} 🥈 ${GK.formatMoneyHTML(prize(2, tr.entry))} 🥉 ${GK.formatMoneyHTML(prize(3, tr.entry))}</span>
      </div>
      <div class="poker-table">
        <div class="poker-felt">
          <div class="poker-board">${board}</div>
          <div class="poker-pot">Pot: ${GK.formatNumber(engine().pot(t))}</div>
          <div class="poker-message">${feltMessage(t)}</div>
        </div>
        ${t.players.map((p, i) => seatHtml(t, p, i)).join('')}
      </div>
      <div class="poker-controls"></div>
      <div class="poker-bottom">
        <details class="poker-log" ${logOpen ? 'open' : ''}>
          <summary>Spielverlauf</summary>
          <ul>${t.log.map(l => `<li>${l}</li>`).join('')}</ul>
        </details>
        <button class="btn btn-danger poker-leave">Turnier verlassen</button>
      </div>`;
    body.querySelector('.poker-leave').addEventListener('click', leaveTable);
    drawControls(t);
  }

  function drawControls(t) {
    const el = body.querySelector('.poker-controls');
    const me = t.players[HUMAN];
    const handName = me.cards.length && !me.out
      ? (t.board.length ? GK.poker.evaluate([...me.cards, ...t.board]).name
        : GK.cards.rank(me.cards[0]) === GK.cards.rank(me.cards[1]) ? 'Ein Paar' : '')
      : '';
    const handInfo = handName ? `<div class="poker-hand-name">Deine Hand: <b>${handName}</b></div>` : '';

    if (t.phase !== 'betting') {
      const last = t.phase === 'finished' || me.out;
      el.innerHTML = `${handInfo}<button class="btn btn-primary poker-next">${last ? 'Turnier beenden ▶' : 'Nächste Hand ▶'}</button>`;
      el.querySelector('.poker-next').addEventListener('click', continueAfterHand);
      return;
    }
    if (t.toAct !== HUMAN) {
      el.innerHTML = `${handInfo}<div class="muted">${me.folded ? 'Du hast gepasst – warte auf die nächste Hand.' : 'Warte auf die anderen Spieler …'}</div>`;
      return;
    }

    const la = engine().legalActions(t);
    const potRaise = t.currentBet + la.pot + la.toCall;
    const clampRaise = v => Math.min(Math.max(Math.round(v), la.minRaiseTo), la.maxRaiseTo);
    raiseTo = clampRaise(la.minRaiseTo);
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
          pot: potRaise,
          all: la.maxRaiseTo,
        };
        raiseTo = clampRaise(sizes[btn.dataset.size]);
        update();
      });
    });
    el.querySelectorAll('[data-act]').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.act;
        humanAct(type === 'raise' ? { type, to: raiseTo } : { type });
      });
    });
  }

  function init(el) {
    body = el;
    drawView();
  }

  function refresh() {
    clearTimeout(timer);
    drawView();
    schedule();
  }

  GK.casino.register({
    id: 'poker',
    name: "Texas Hold'em",
    emoji: '♠️',
    desc: 'Turnier gegen 5 Computer-Gegner.',
    init,
    refresh,
    onShow: refresh,
    render: () => { if (!state().table) updateLobbyButtons(); },
  });
})();
