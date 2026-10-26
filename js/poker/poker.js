// Texas Hold'em im Casino: Sit-&-Go-Turnier gegen 5 Computer-Gegner – oder mit Freunden
// (siehe multiplayer.js). Man zahlt einmal Eintritt in Dublonen, alle bekommen gleich viele
// Tisch-Chips. Die besten Plätze bekommen Dublonen ausgezahlt.
window.GK = window.GK || {};

(function () {
  const engine = () => GK.poker.engine;
  const T = () => GK.poker.tournament;
  const HUMAN = 0;
  const SEATS = 6;

  let body;
  let timer = null;

  function state() {
    return GK.casino.data('poker', () => ({ table: null, tierId: null, lastResult: null }));
  }

  function tier() {
    return T().tier(state().tierId);
  }

  function mpActive() {
    return GK.poker.mp && GK.poker.mp.active();
  }

  // Darf man an diesem Tisch spielen? (VIP-Stufe und Eintritt)
  function tierBlockReason(tr) {
    if (GK.casino.vipLevel() < tr.vip) return `Nur mit ${GK.casino.VIP_LEVELS[tr.vip].name}-Karte`;
    if (!GK.canAfford(tr.entry)) return 'Nicht genug Dublonen';
    return '';
  }

  // ---------- Turnier-Ablauf ----------

  function join(tierId) {
    const tr = T().tier(tierId);
    const reason = tierBlockReason(tr);
    if (reason || mpActive()) {
      GK.toast(reason || 'Du bist gerade in einem Raum mit Freunden.');
      return;
    }
    GK.casino.bet(tr.entry);
    const seats = [{ id: 'you', name: 'Du', avatar: '🙂', isBot: false }].concat(T().botSeats(SEATS - 1));
    const table = T().createTable(seats);
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
    const win = T().prize(place, tier().entry, SEATS);
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
    const win = T().prize(place, tr.entry, SEATS);
    GK.casino.payout(win);
    s.lastResult = { place, prize: win, tierName: tr.name, entry: tr.entry };
    s.table = null;
    if (place === 1) GK.unlockAchievement('pokerWin');
    GK.casino.record('poker', tr.entry, win, `${place}. Platz · ${tr.name}`);
    afterChange();
    GK.fx.celebrate(win, tr.entry, { level: place === 1 ? 'mega' : undefined, subtitle: `${place}. Platz – ${tr.name}` });
  }

  // Nach jeder Änderung: speichern, neu zeichnen und den nächsten Schritt planen
  function afterChange() {
    const t = state().table;
    if (t && t.result && t.result.hands && t.result.hands[HUMAN] === 'Royal Flush') {
      GK.unlockAchievement('pokerRoyal');
    }
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
    if (mpActive()) GK.poker.mp.draw(body);
    else if (state().table) drawTable();
    else drawLobby();
  }

  function prizeLine(entry) {
    const p = place => GK.formatMoneyHTML(T().prize(place, entry, SEATS));
    return `🥇 ${p(1)} 🥈 ${p(2)} 🥉 ${p(3)}`;
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
      <h3 class="poker-section-title">🤖 Gegen Computer</h3>
      <p class="muted">
        <b>Sit &amp; Go-Turnier:</b> Du zahlst den Eintritt in Dublonen und bekommst – genau wie deine
        5 Computer-Gegner – ${GK.formatNumber(T().START_CHIPS)} Tisch-Chips. Die Blinds steigen alle
        ${T().HANDS_PER_LEVEL} Hände. Gespielt wird, bis einer alle Chips hat.
        Preise: 🥇 3× · 🥈 1,8× · 🥉 1,2× Eintritt.
      </p>
      <div class="casino-grid poker-tiers">
        ${T().TIERS.map(tr => `
          <div class="casino-card poker-tier">
            <div class="casino-emoji">${tr.icon}</div>
            <h3>${tr.name}</h3>
            <p>Eintritt: ${GK.formatMoneyHTML(tr.entry)}</p>
            <p class="small">1. Platz: ${GK.formatMoneyHTML(T().prize(1, tr.entry, SEATS))}</p>
            <button class="btn btn-primary poker-join" data-tier="${tr.id}">Platz nehmen</button>
            <p class="small poker-block-reason"></p>
          </div>`).join('')}
      </div>
      <h3 class="poker-section-title">👥 Mit Freunden spielen</h3>
      <div class="mp-join-panel"></div>`;
    body.querySelectorAll('.poker-join').forEach(btn => {
      btn.addEventListener('click', () => join(btn.dataset.tier));
    });
    GK.poker.mp.renderJoinPanel(body.querySelector('.mp-join-panel'));
    updateLobbyButtons();
  }

  function updateLobbyButtons() {
    body.querySelectorAll('.poker-tier').forEach(card => {
      const btn = card.querySelector('.poker-join');
      const reason = tierBlockReason(T().tier(btn.dataset.tier));
      btn.disabled = !!reason;
      card.querySelector('.poker-block-reason').textContent = reason;
    });
    GK.poker.mp.updateJoinPanel(body);
  }

  function drawTable() {
    const t = state().table;
    const tr = tier();
    const { sb, bb } = engine().blinds(t);
    const handsLeft = T().HANDS_PER_LEVEL - ((t.handNo - 1) % T().HANDS_PER_LEVEL);
    const last = t.phase === 'finished' || t.players[HUMAN].out;
    GK.poker.ui.render(body, t, {
      mySeat: HUMAN,
      info: [
        `${tr.icon} ${tr.name}`,
        `Blinds ${GK.formatNumber(sb)}/${GK.formatNumber(bb)}`,
        t.level < T().BLIND_LEVELS.length - 1 ? `Erhöhung in ${handsLeft} ${handsLeft === 1 ? 'Hand' : 'Händen'}` : 'Höchste Stufe',
        `Spieler: ${t.players.filter(p => !p.out).length}/${SEATS}`,
        prizeLine(tr.entry),
      ],
      onAction: humanAct,
      onNext: continueAfterHand,
      nextLabel: last ? 'Turnier beenden ▶' : 'Nächste Hand ▶',
      onLeave: leaveTable,
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
    desc: 'Turnier gegen Computer – oder online mit Freunden.',
    init,
    refresh,
    onShow: refresh,
    render: () => {
      if (mpActive()) GK.poker.mp.render(body);
      else if (!state().table) updateLobbyButtons();
    },
  });

  // Für den Multiplayer: Neu zeichnen, wenn sich dort etwas ändert
  GK.poker.redraw = () => { if (body) drawView(); };
  // Läuft gerade ein Turnier gegen Computer? (Dann kann man keinem Raum beitreten)
  GK.poker.singleActive = () => !!state().table;
})();
