// Texas Hold'em im Casino: Sit-&-Go-Turnier gegen 5 Computer-Gegner – oder mit Freunden
// (siehe multiplayer.js). Man zahlt einmal Eintritt in Dublonen, alle bekommen gleich viele
// Tisch-Chips. Die besten Plätze bekommen Dublonen ausgezahlt. Modi: Klassisch, Turbo und Blitz
// (nur 3, 5 oder 10 Hände, danach teilen die Besten das Preisgeld nach Chips).
// Wer gegen Computer vorzeitig aussteigt, bekommt anteilig ausgezahlt, was seine Chips wert sind.
window.GK = window.GK || {};
// Sprache: Ersatz, falls js/i18n.js (noch) nicht geladen ist – gibt den deutschen Text zurück.
GK.t = GK.t || function (s, v) { s = String(s); return v ? s.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m)) : s; };
GK.i18n = GK.i18n || { add() {}, addHtml() {}, apply() {}, set() {}, lang: 'de' };
GK.i18n.add({
  'Nur mit {name}-Karte': 'Only with the {name} card',
  'Nicht genug Dublonen': 'Not enough Doubloons',
  'Du bist gerade in einem Raum mit Freunden.': 'You are currently in a room with friends.',
  'Turnier wirklich verlassen? Für deine Chips bekommst du anteilig {n} Dublonen ausgezahlt.': 'Really leave the tournament? For your chips you get a prorated payout of {n} Doubloons.',
  'Ausgestiegen – {name}': 'Cashed out – {name}',
  '{place}. Platz – {name}': 'Place {place} – {name}',
  'Ausgestiegen · {label}': 'Cashed out · {label}',
  '{place}. Platz · {label}': 'Place {place} · {label}',
  'Die besten {n} teilen {pool} nach Chips': 'The top {n} share {pool} by chips',
  '{place}. Platz': 'place {place}',
  'Du bist im {tier} ausgestiegen und hast anteilig {n} bekommen.': 'You cashed out at the {tier} and received a prorated {n}.',
  'Du bist im {tier} ausgestiegen.': 'You cashed out at the {tier}.',
  'Du hast im {tier} {place} belegt und {n} gewonnen!': 'You finished in {place} at the {tier} and won {n}!',
  'Du hast im {tier} {place} belegt.': 'You finished in {place} at the {tier}.',
  'Gegen Computer': 'Vs. computer',
  'Mit Freunden spielen': 'Play with friends',
  '<b>Sit &amp; Go-Turnier:</b> Du zahlst den Eintritt in Dublonen und bekommst – genau wie deine 5 Computer-Gegner – gleich viele Tisch-Chips. Gespielt wird, bis einer alle Chips hat. Preise: 🥇 3× · 🥈 1,8× · 🥉 1,2× Eintritt. Steigst du vorher aus, bekommst du anteilig ausgezahlt, was deine Chips wert sind. <b>Blitz:</b> Nach 3, 5 oder 10 Händen ist Schluss – dann teilen die besten 4 das ganze Preisgeld im Verhältnis ihrer Chips.': '<b>Sit &amp; Go tournament:</b> You pay the entry in Doubloons and receive – just like your 5 computer opponents – the same number of table chips. Play continues until someone has all the chips. Prizes: 🥇 3× · 🥈 1.8× · 🥉 1.2× entry. If you cash out early, you get a prorated payout of what your chips are worth. <b>Blitz:</b> After 3, 5 or 10 hands it ends – then the top 4 share the whole prize pool in proportion to their chips.',
  'Eintritt: {n}': 'Entry: {n}',
  'Top {k} teilen {pool}': 'Top {k} share {pool}',
  '1. Platz: {n}': '1st place: {n}',
  'Platz nehmen': 'Take a seat',
  'Erhöhung in {n} Hand': 'Blinds rise in {n} hand',
  'Erhöhung in {n} Händen': 'Blinds rise in {n} hands',
  'Höchste Stufe': 'Top level',
  'Letzte Hand ({a}/{b})': 'Last hand ({a}/{b})',
  'Hand {a}/{b}': 'Hand {a}/{b}',
  'Spieler: {a}/{b}': 'Players: {a}/{b}',
  'Schluss! {ranking}': 'Finished! {ranking}',
  'Turnier beenden ▶': 'Finish tournament ▶',
  'Nächste Hand ▶': 'Next hand ▶',
  'Aussteigen · {n}': 'Cash out · {n}',
  'Turnier gegen Computer – oder online mit Freunden.': 'Tournament vs. computer – or online with friends.',
  'Hafenkneipe': 'Harbor Tavern',
  'Kapitänstisch': "Captain's Table",
  'Königlicher Salon': 'Royal Salon',
  'Diamanten-Saal': 'Diamond Hall',
  'Perlen-Lounge': 'Pearl Lounge',
  'Thron des Kaisers': "Emperor's Throne",
});

(function () {
  const engine = () => GK.poker.engine;
  const T = () => GK.poker.tournament;
  const HUMAN = 0;
  const ic = name => (GK.icon ? GK.icon(name) : '');
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
    if (GK.casino.vipLevel() < tr.vip) return GK.t('Nur mit {name}-Karte', { name: GK.casino.VIP_LEVELS[tr.vip].name });
    if (!GK.canAfford(tr.entry)) return GK.t('Nicht genug Dublonen');
    return '';
  }

  // ---------- Turnier-Ablauf ----------

  function join(tierId) {
    const tr = T().tier(tierId);
    const reason = tierBlockReason(tr);
    if (reason || mpActive() || (GK.room && GK.room.active())) {
      GK.toast(reason || GK.t('Du bist gerade in einem Raum mit Freunden.'));
      return;
    }
    GK.casino.bet(tr.entry);
    const seats = [{ id: 'you', name: GK.player.name(), avatar: GK.player.avatar(), fig: GK.figure.mine(), rank: GK.rank.mine(), badge: GK.cosmetics.myBadge(), isBot: false }].concat(T().botSeats(SEATS - 1));
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
    const text = GK.t('Turnier wirklich verlassen? Für deine Chips bekommst du anteilig {n} Dublonen ausgezahlt.', { n: GK.formatNumber(value) });
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
    const label = m.id === 'classic' ? GK.t(tr.name) : `${GK.t(tr.name)} (${T().modeLabel(m.id, t.maxHands, true)})`;
    GK.casino.record('poker', tr.entry, win, left ? GK.t('Ausgestiegen · {label}', { label }) : GK.t('{place}. Platz · {label}', { place, label }));
    afterChange();
    if (left) {
      if (win > tr.entry) GK.fx.celebrate(win, tr.entry, { subtitle: GK.t('Ausgestiegen – {name}', { name: GK.t(tr.name) }) });
      else if (win > 0) GK.sound.play('coin');
    } else {
      GK.fx.celebrate(win, tr.entry, { level: place === 1 ? 'mega' : undefined, subtitle: GK.t('{place}. Platz – {name}', { place, name: GK.t(tr.name) }) });
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
    if (t && t.result && t.result.hands && GK.poker.fullHouseOrBetter(t.result.hands[HUMAN])) {
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
      return GK.t('Die besten {n} teilen {pool} nach Chips', { n: T().blitzPaidPlaces(SEATS), pool: GK.formatMoneyHTML(entry * SEATS) });
    }
    const p = place => GK.formatMoneyHTML(T().prize(place, entry, SEATS));
    return `🥇 ${p(1)} 🥈 ${p(2)} 🥉 ${p(3)}`;
  }

  // Blitz am Ende: Rangliste mit Auszahlungen
  function blitzRanking(t, entry) {
    return t.players.map((p, i) => ({ p, i })).sort((a, b) => a.p.place - b.p.place)
      .map(({ p, i }) => {
        const win = T().payout(t, i, entry);
        return `${p.place}. ${GK.cosmetics.nameTag(p)}${win ? ` +${GK.formatMoneyHTML(win)}` : ''}`;
      }).join(' · ');
  }

  function drawLobby() {
    const r = state().lastResult;
    const m = mode();
    let resultHtml = '';
    if (r && r.left) {
      const tier = GK.t(r.tierName);
      resultHtml = `<div class="poker-result ${r.prize ? 'win' : 'loss'}">${ic('door')} ` +
        (r.prize
          ? GK.t('Du bist im {tier} ausgestiegen und hast anteilig {n} bekommen.', { tier, n: GK.formatMoneyHTML(r.prize) })
          : GK.t('Du bist im {tier} ausgestiegen.', { tier })) + '</div>';
    } else if (r) {
      const tier = GK.t(r.tierName);
      const place = `<b>${GK.t('{place}. Platz', { place: r.place })}</b>`;
      resultHtml = `
      <div class="poker-result ${r.prize ? 'win' : 'loss'}">
        ${r.place === 1 ? '🏆' : r.prize ? '🎉' : '😢'}
        ${r.prize
          ? GK.t('Du hast im {tier} {place} belegt und {n} gewonnen!', { tier, place, n: GK.formatMoneyHTML(r.prize) })
          : GK.t('Du hast im {tier} {place} belegt.', { tier, place })}
      </div>`;
    }
    body.innerHTML = `
      ${resultHtml}
      <h3 class="poker-section-title">${ic('robot')}${GK.t('Gegen Computer')}</h3>
      <p class="muted">
        ${GK.t('<b>Sit &amp; Go-Turnier:</b> Du zahlst den Eintritt in Dublonen und bekommst – genau wie deine 5 Computer-Gegner – gleich viele Tisch-Chips. Gespielt wird, bis einer alle Chips hat. Preise: 🥇 3× · 🥈 1,8× · 🥉 1,2× Eintritt. Steigst du vorher aus, bekommst du anteilig ausgezahlt, was deine Chips wert sind. <b>Blitz:</b> Nach 3, 5 oder 10 Händen ist Schluss – dann teilen die besten 4 das ganze Preisgeld im Verhältnis ihrer Chips.')}
      </p>
      ${GK.poker.ui.modePicker(m.id, T().blitzHands(state().hands), 'sp-modes')}
      <div class="casino-grid poker-tiers">
        ${T().TIERS.map(tr => `
          <div class="casino-card poker-tier">
            <div class="casino-emoji">${tr.icon}</div>
            <h3>${GK.t(tr.name)}</h3>
            <p>${GK.t('Eintritt: {n}', { n: GK.formatMoneyHTML(tr.entry) })}</p>
            <p class="small">${m.id === 'blitz'
              ? GK.t('Top {k} teilen {pool}', { k: T().blitzPaidPlaces(SEATS), pool: GK.formatMoneyHTML(tr.entry * SEATS) })
              : GK.t('1. Platz: {n}', { n: GK.formatMoneyHTML(T().prize(1, tr.entry, SEATS)) })}</p>
            <button class="btn btn-primary poker-join" data-tier="${tr.id}">${GK.t('Platz nehmen')}</button>
            <p class="small poker-block-reason"></p>
          </div>`).join('')}
      </div>
      <h3 class="poker-section-title">${ic('users')}${GK.t('Mit Freunden spielen')}</h3>
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
    if (blitz) progress = t.handNo >= t.maxHands ? `${ic('flame')} ${GK.t('Letzte Hand ({a}/{b})', { a: t.maxHands, b: t.maxHands })}` : GK.t('Hand {a}/{b}', { a: t.handNo, b: t.maxHands });
    else progress = t.level < t.blindLevels.length - 1 ? (handsLeft === 1 ? GK.t('Erhöhung in {n} Hand', { n: handsLeft }) : GK.t('Erhöhung in {n} Händen', { n: handsLeft })) : GK.t('Höchste Stufe');
    GK.poker.ui.render(body, t, {
      mySeat: HUMAN,
      info: [
        `${tr.icon} ${GK.t(tr.name)}`,
        T().modeLabel(m.id, t.maxHands),
        `Blinds ${GK.formatNumber(sb)}/${GK.formatNumber(bb)}`,
        progress,
        GK.t('Spieler: {a}/{b}', { a: t.players.filter(p => !p.out).length, b: SEATS }),
        prizeLine(tr.entry, t),
      ],
      notice: blitz && t.phase === 'finished' ? `${ic('flag')} ${GK.t('Schluss! {ranking}', { ranking: blitzRanking(t, tr.entry) })}` : '',
      onAction: humanAct,
      onNext: continueAfterHand,
      nextLabel: last ? GK.t('Turnier beenden ▶') : GK.t('Nächste Hand ▶'),
      onSkip: canSkip(t) ? fastForward : null,
      onLeave: last ? null : leaveTable,
      leaveLabel: `${ic('door')}${GK.t('Aussteigen · {n}', { n: GK.formatMoneyHTML(cashOutValue()) })}`,
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
    category: 'table',
    name: 'Poker',
    emoji: '♠️',
    desc: GK.t('Turnier gegen Computer – oder online mit Freunden.'),
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
