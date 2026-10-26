// Texas Hold'em im Casino: Sit-&-Go-Turnier gegen 5 Computer-Gegner – oder mit Freunden
// (siehe multiplayer.js). Man zahlt einmal Eintritt in Dublonen, alle bekommen gleich viele
// Tisch-Chips. Die besten Plätze bekommen Dublonen ausgezahlt. Modi: Klassisch, Turbo und Blitz
// (nur 3, 5 oder 10 Hände, danach teilen die Besten das Preisgeld nach Chips).
// Wer gegen Computer vorzeitig aussteigt, bekommt anteilig ausgezahlt, was seine Chips wert sind.
window.GK = window.GK || {};

(function () {
  const engine = () => GK.poker.engine;
  const T = () => GK.poker.tournament;
  const HUMAN = 0;
  const SEATS = 6;

  let body;
  let timer = null;

  function state() {
    return GK.casino.data('poker', () => ({ table: null, tierId: null, lastResult: null, mode: 'classic', hands: 5 }));
  }

  function tier() {
    return T().tier(state().tierId);
  }

  // Modus des laufenden Turniers (ältere Spielstände: klassisch) bzw. der in der Lobby gewählte
  function mode() {
    const t = state().table;
    return T().mode(t ? t.mode : state().mode);
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
    const s = state();
    const table = T().createTable(seats, s.mode, s.hands);
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

  // Was bekäme man jetzt beim Aussteigen? (anteilig nach den eigenen Chips)
  function cashOutValue() {
    const t = state().table;
    return t ? T().cashOutValue(t, HUMAN, tier().entry) : 0;
  }

  function leaveTable() {
    const t = state().table;
    if (!t) return;
    const value = cashOutValue();
    const text = 'Turnier wirklich verlassen? Für deine Chips bekommst du anteilig ' +
      `${GK.formatNumber(value)} Dublonen ausgezahlt.`;
    if (!confirm(text)) return;
    engine().forfeit(t, HUMAN);
    finishTournament(value);
  }

  // cashOut: Auszahlung beim vorzeitigen Aussteigen (sonst zählt der erreichte Platz)
  function finishTournament(cashOut) {
    const s = state();
    const t = s.table;
    const tr = tier();
    const m = mode();
    const left = typeof cashOut === 'number';
    const place = t.players[HUMAN].place;
    const win = left ? cashOut : T().payout(t, HUMAN, tr.entry);
    GK.casino.payout(win);
    s.lastResult = { place, prize: win, tierName: tr.name, entry: tr.entry, left, mode: m.id };
    s.table = null;
    if (!left && place === 1) {
      GK.unlockAchievement('pokerWin');
      if (m.id === 'turbo') GK.unlockAchievement('pokerTurbo');
      if (m.id === 'blitz') GK.unlockAchievement('pokerBlitz');
      if (tr.id === 'throne') GK.unlockAchievement('pokerThrone');
    }
    const label = m.id === 'classic' ? tr.name : `${tr.name} (${T().modeLabel(m.id, t.maxHands).replace(/^\S+ /, '')})`;
    GK.casino.record('poker', tr.entry, win, left ? `Ausgestiegen · ${label}` : `${place}. Platz · ${label}`);
    afterChange();
    if (left) {
      if (win > tr.entry) GK.fx.celebrate(win, tr.entry, { subtitle: `Ausgestiegen – ${tr.name}` });
      else if (win > 0) GK.sound.play('coin');
    } else {
      GK.fx.celebrate(win, tr.entry, { level: place === 1 ? 'mega' : undefined, subtitle: `${place}. Platz – ${tr.name}` });
    }
  }

  // Kann man selbst nichts mehr tun (gepasst oder All-in)? Dann darf man die Hand vorspulen.
  function canSkip(t) {
    const me = t.players[HUMAN];
    return t.phase === 'betting' && !me.out && (!engine().inHand(me) || me.allIn);
  }

  // Die Computer-Gegner spielen die Hand sofort zu Ende
  function fastForward() {
    const t = state().table;
    if (!t || !canSkip(t)) return;
    let guard = 200;
    while (t.phase === 'betting' && t.players[t.toAct].isBot && guard-- > 0) {
      engine().act(t, GK.poker.ai.decide(t));
    }
    GK.sound.play('deal');
    afterChange();
  }

  // Nach jeder Änderung: speichern, neu zeichnen und den nächsten Schritt planen
  function afterChange() {
    const t = state().table;
    // Blitz: Nach der letzten Hand ist Schluss, die Chips entscheiden
    if (t && T().handLimitReached(t)) T().finishByChips(t);
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
    const m = mode();
    let step = null;
    let delay = 0;
    if (t.phase === 'betting' && t.players[t.toAct].isBot) {
      step = botStep;
      delay = engine().inHand(t.players[HUMAN]) ? m.botDelay : m.botDelayWatching;
    } else if (t.phase !== 'betting') {
      step = continueAfterHand;
      delay = t.result && t.result.showdown ? m.nextDelayShowdown : m.nextDelay;
      // Am Ende etwas länger, damit man das Ergebnis am Tisch sieht
      if (t.phase === 'finished') delay = Math.max(delay, 4000);
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

  function prizeLine(entry, t) {
    if (t && T().isBlitz(t)) {
      return `Die besten ${T().blitzPaidPlaces(SEATS)} teilen ${GK.formatMoneyHTML(entry * SEATS)} nach Chips`;
    }
    const p = place => GK.formatMoneyHTML(T().prize(place, entry, SEATS));
    return `🥇 ${p(1)} 🥈 ${p(2)} 🥉 ${p(3)}`;
  }

  // Blitz am Ende: Rangliste mit Auszahlungen
  function blitzRanking(t, entry) {
    return t.players.map((p, i) => ({ p, i })).sort((a, b) => a.p.place - b.p.place)
      .map(({ p, i }) => {
        const win = T().payout(t, i, entry);
        return `${p.place}. ${p.avatar || ''} ${GK.poker.ui.escapeHtml(p.name)}${win ? ` +${GK.formatMoneyHTML(win)}` : ''}`;
      }).join(' · ');
  }

  function drawLobby() {
    const r = state().lastResult;
    const m = mode();
    let resultHtml = '';
    if (r && r.left) {
      resultHtml = `<div class="poker-result ${r.prize ? 'win' : 'loss'}">🚪 Du bist im ${r.tierName} ausgestiegen` +
        (r.prize ? ` und hast anteilig ${GK.formatMoneyHTML(r.prize)} bekommen.` : '.') + '</div>';
    } else if (r) {
      resultHtml = `
      <div class="poker-result ${r.prize ? 'win' : 'loss'}">
        ${r.place === 1 ? '🏆' : r.prize ? '🎉' : '😢'}
        Du hast im ${r.tierName} den <b>${r.place}. Platz</b> belegt${r.prize
          ? ` und ${GK.formatMoneyHTML(r.prize)} gewonnen!` : '.'}
      </div>`;
    }
    body.innerHTML = `
      ${resultHtml}
      <h3 class="poker-section-title">🤖 Gegen Computer</h3>
      <p class="muted">
        <b>Sit &amp; Go-Turnier:</b> Du zahlst den Eintritt in Dublonen und bekommst – genau wie deine
        5 Computer-Gegner – gleich viele Tisch-Chips. Gespielt wird, bis einer alle Chips hat.
        Preise: 🥇 3× · 🥈 1,8× · 🥉 1,2× Eintritt. Steigst du vorher aus, bekommst du anteilig
        ausgezahlt, was deine Chips wert sind.
        <b>Blitz:</b> Nach 3, 5 oder 10 Händen ist Schluss – dann teilen die besten 4 das ganze
        Preisgeld im Verhältnis ihrer Chips.
      </p>
      ${GK.poker.ui.modePicker(m.id, T().blitzHands(state().hands), 'sp-modes')}
      <div class="casino-grid poker-tiers">
        ${T().TIERS.map(tr => `
          <div class="casino-card poker-tier">
            <div class="casino-emoji">${tr.icon}</div>
            <h3>${tr.name}</h3>
            <p>Eintritt: ${GK.formatMoneyHTML(tr.entry)}</p>
            <p class="small">${m.id === 'blitz'
              ? `Top ${T().blitzPaidPlaces(SEATS)} teilen ${GK.formatMoneyHTML(tr.entry * SEATS)}`
              : `1. Platz: ${GK.formatMoneyHTML(T().prize(1, tr.entry, SEATS))}`}</p>
            <button class="btn btn-primary poker-join" data-tier="${tr.id}">Platz nehmen</button>
            <p class="small poker-block-reason"></p>
          </div>`).join('')}
      </div>
      <h3 class="poker-section-title">👥 Mit Freunden spielen</h3>
      <div class="mp-join-panel"></div>`;
    body.querySelectorAll('.poker-join').forEach(btn => {
      btn.addEventListener('click', () => join(btn.dataset.tier));
    });
    body.querySelectorAll('.sp-modes .poker-mode').forEach(btn => {
      btn.addEventListener('click', () => {
        state().mode = btn.dataset.mode;
        GK.sound.play('chip');
        GK.save();
        drawLobby();
      });
    });
    body.querySelectorAll('.sp-modes .poker-hands-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state().hands = Number(btn.dataset.hands);
        GK.sound.play('chip');
        GK.save();
        drawLobby();
      });
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
    const m = mode();
    const { sb, bb } = engine().blinds(t);
    const handsLeft = t.handsPerLevel - ((t.handNo - 1) % t.handsPerLevel);
    const last = t.phase === 'finished' || t.players[HUMAN].out;
    const blitz = T().isBlitz(t);
    let progress;
    if (blitz) progress = t.handNo >= t.maxHands ? `🔥 Letzte Hand (${t.maxHands}/${t.maxHands})` : `Hand ${t.handNo}/${t.maxHands}`;
    else progress = t.level < t.blindLevels.length - 1 ? `Erhöhung in ${handsLeft} ${handsLeft === 1 ? 'Hand' : 'Händen'}` : 'Höchste Stufe';
    GK.poker.ui.render(body, t, {
      mySeat: HUMAN,
      info: [
        `${tr.icon} ${tr.name}`,
        T().modeLabel(m.id, t.maxHands),
        `Blinds ${GK.formatNumber(sb)}/${GK.formatNumber(bb)}`,
        progress,
        `Spieler: ${t.players.filter(p => !p.out).length}/${SEATS}`,
        prizeLine(tr.entry, t),
      ],
      notice: blitz && t.phase === 'finished' ? `🏁 Schluss! ${blitzRanking(t, tr.entry)}` : '',
      onAction: humanAct,
      onNext: continueAfterHand,
      nextLabel: last ? 'Turnier beenden ▶' : 'Nächste Hand ▶',
      onSkip: canSkip(t) ? fastForward : null,
      onLeave: last ? null : leaveTable,
      leaveLabel: `🚪 Aussteigen · ${GK.formatMoneyHTML(cashOutValue())}`,
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
