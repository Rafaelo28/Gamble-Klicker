// Baccarat (Punto Banco): Setze auf Spieler, Bank oder Unentschieden. Beide Seiten bekommen zwei Karten,
// eventuell eine dritte nach festen Regeln. Wer näher an 9 liegt, gewinnt (es zählt nur die Einerstelle).
// Spieler zahlt 1:1, Bank 0,95:1, Unentschieden 8:1 – bei Unentschieden bekommt man Einsätze auf Spieler
// oder Bank zurück. Die Hand steht beim Austeilen fest und wird gespeichert (Neuladen zahlt aus).
window.GK = window.GK || {};

(function () {
  const MIN_BET = 10;
  const DECKS = 8;
  // Rückzahlung (inklusive Einsatz) je Wette
  const PAYS = { player: 2, banker: 1.95, tie: 9 };
  const NAMES = { player: 'Spieler', banker: 'Bank', tie: 'Unentschieden' };
  const STEP = 520;

  let els = {};
  let betControl;
  let dealing = null;

  function state() {
    return GK.casino.data('baccarat', () => ({ bet: 100, choice: 'player', pending: null, last: null, road: [] }));
  }

  // ---------- Regeln (auch für Tests) ----------

  // Punktwert: Ass 1, 2–9 wie aufgedruckt, 10 und Bilder 0
  function points(card) {
    const r = GK.cards.rank(card);
    if (r === 'A') return 1;
    if ('TJQK'.includes(r)) return 0;
    return Number(r);
  }

  const total = cards => cards.reduce((s, c) => s + points(c), 0) % 10;

  // Bekommt die Bank eine dritte Karte? (third = dritte Karte des Spielers oder null)
  function bankerDraws(bankTotal, third) {
    if (third == null) return bankTotal <= 5;
    const x = points(third);
    if (bankTotal <= 2) return true;
    if (bankTotal === 3) return x !== 8;
    if (bankTotal === 4) return x >= 2 && x <= 7;
    if (bankTotal === 5) return x >= 4 && x <= 7;
    if (bankTotal === 6) return x === 6 || x === 7;
    return false;
  }

  // Eine Hand aus einem gemischten Schuh (Karten werden abwechselnd gegeben: Spieler, Bank, Spieler, Bank)
  function playHand(shoe = GK.cards.createDeck(DECKS)) {
    const player = [shoe.pop()];
    const banker = [shoe.pop()];
    player.push(shoe.pop());
    banker.push(shoe.pop());
    const order = ['player', 'banker', 'player', 'banker'];
    const natural = total(player) >= 8 || total(banker) >= 8;
    if (!natural) {
      let third = null;
      if (total(player) <= 5) {
        third = shoe.pop();
        player.push(third);
        order.push('player');
      }
      if (bankerDraws(total(banker), third)) {
        banker.push(shoe.pop());
        order.push('banker');
      }
    }
    const p = total(player);
    const b = total(banker);
    return { player, banker, order, natural, winner: p > b ? 'player' : b > p ? 'banker' : 'tie' };
  }

  // Rückzahlung für eine Wette auf `choice`
  function payoutMult(choice, winner) {
    if (winner === 'tie') return choice === 'tie' ? PAYS.tie : 1; // Spieler/Bank: Einsatz zurück
    return choice === winner ? PAYS[choice] : 0;
  }

  // ---------- Ablauf ----------

  function deal() {
    const s = state();
    if (s.pending || dealing) return;
    if (!GK.casino.bet(s.bet)) {
      GK.sound.play('denied');
      showMessage('Nicht genug Dublonen für diesen Einsatz.', 'loss');
      return;
    }
    const hand = playHand();
    const payout = Math.floor(s.bet * payoutMult(s.choice, hand.winner));
    const p = Object.assign({ bet: s.bet, choice: s.choice, payout }, hand);
    s.pending = p;
    GK.save();
    showMessage(`Einsatz auf <b>${NAMES[p.choice]}</b> – die Karten kommen …`, '');
    dealing = { shown: 0 };
    render();
    const fast = GK.state.settings.effects === 'reduced';
    const next = () => {
      if (!dealing || s.pending !== p) return;
      dealing.shown++;
      GK.sound.play('deal');
      render(true);
      if (dealing.shown < p.order.length) setTimeout(next, fast ? 120 : STEP);
      else setTimeout(() => settle(true), fast ? 200 : 700);
    };
    setTimeout(next, fast ? 80 : 250);
  }

  // animated = nach dem Austeilen (sonst nach dem Neuladen)
  function settle(animated) {
    const s = state();
    const p = s.pending;
    dealing = null;
    if (!p) return;
    s.pending = null;
    s.last = p;
    GK.casino.payout(p.payout);
    s.road.push(p.winner[0]);
    if (s.road.length > 36) s.road.splice(0, s.road.length - 36);
    const pt = total(p.player);
    const bt = total(p.banker);
    const text = p.winner === 'tie' ? `🤝 Unentschieden ${pt} zu ${bt}`
      : `${p.winner === 'player' ? '🔵' : '🔴'} ${NAMES[p.winner]} gewinnt ${Math.max(pt, bt)} zu ${Math.min(pt, bt)}`;
    GK.casino.record('baccarat', p.bet, p.payout, `${text} · gesetzt: ${NAMES[p.choice]}`);
    if (p.choice === 'tie' && p.winner === 'tie') GK.unlockAchievement('baccaratTie');
    if (p.payout > p.bet) {
      showMessage(`${text}! Gewinn: ${GK.formatMoneyHTML(p.payout)}`, 'win');
      if (animated) GK.fx.celebrate(p.payout, p.bet, { el: els.table, subtitle: text });
    } else if (p.payout === p.bet) {
      showMessage(`${text} – du bekommst deinen Einsatz zurück.`, '');
    } else {
      showMessage(`${text} – diesmal leider nicht.`, 'loss');
      if (animated) GK.sound.play('lose');
    }
    GK.save();
    render();
  }

  // ---------- Darstellung ----------

  function render(fresh) {
    const s = state();
    const view = s.pending || s.last;
    let shownPlayer = [];
    let shownBanker = [];
    if (view) {
      const count = dealing ? dealing.shown : view.order.length;
      let pi = 0;
      let bi = 0;
      view.order.slice(0, count).forEach(side => {
        if (side === 'player') shownPlayer.push(view.player[pi++]);
        else shownBanker.push(view.banker[bi++]);
      });
    }
    const lastSide = view && dealing && dealing.shown ? view.order[dealing.shown - 1] : null;
    const cardsHtml = (cards, side) => cards.map((c, i) =>
      GK.cards.html(c, false, `${i === 2 ? 'bac-third' : ''} ${fresh && side === lastSide && i === cards.length - 1 ? 'deal-in' : ''}`)).join('');
    els.player.innerHTML = cardsHtml(shownPlayer, 'player') || '<div class="card-placeholder"></div><div class="card-placeholder"></div>';
    els.banker.innerHTML = cardsHtml(shownBanker, 'banker') || '<div class="card-placeholder"></div><div class="card-placeholder"></div>';
    els.playerTotal.textContent = shownPlayer.length ? total(shownPlayer) : '';
    els.bankerTotal.textContent = shownBanker.length ? total(shownBanker) : '';
    const done = view && !dealing;
    els.table.classList.toggle('win-player', !!(done && view.winner === 'player'));
    els.table.classList.toggle('win-banker', !!(done && view.winner === 'banker'));
    els.table.classList.toggle('win-tie', !!(done && view.winner === 'tie'));
    const busy = !!(s.pending || dealing);
    els.choices.forEach(b => {
      const active = b.dataset.choice === (view && busy ? view.choice : s.choice);
      b.classList.toggle('active', active);
      b.setAttribute('aria-pressed', active);
      b.disabled = busy;
    });
    els.deal.disabled = busy;
    betControl.setDisabled(busy);
    els.road.innerHTML = s.road.length
      ? s.road.map(r => `<span class="bac-bead ${r}">${r === 'p' ? 'S' : r === 'b' ? 'B' : 'U'}</span>`).join('')
      : '<span class="muted small">Noch keine Hände.</span>';
  }

  function showMessage(html, cls) {
    if (!els.message) return;
    els.message.className = 'game-message ' + (cls || '');
    els.message.innerHTML = html;
  }

  function init(body) {
    body.innerHTML = `
      <div class="bac-table">
        <div class="bac-side bac-player-side">
          <div class="bac-label">🔵 Spieler <span class="bac-total bac-player-total"></span></div>
          <div class="bj-cards bac-player"></div>
        </div>
        <div class="bac-side bac-banker-side">
          <div class="bac-label">🔴 Bank <span class="bac-total bac-banker-total"></span></div>
          <div class="bj-cards bac-banker"></div>
        </div>
        <div class="bac-rules">Spieler zahlt 1:1 · Bank zahlt 0,95:1 · Unentschieden zahlt 8:1</div>
      </div>
      <div class="bac-road" aria-label="Letzte Hände"></div>
      <div class="bac-choices" role="group" aria-label="Wette">
        <button type="button" class="btn bac-choice player" data-choice="player">🔵 Spieler<small>zahlt 1:1</small></button>
        <button type="button" class="btn bac-choice tie" data-choice="tie">🤝 Unentschieden<small>zahlt 8:1</small></button>
        <button type="button" class="btn bac-choice banker" data-choice="banker">🔴 Bank<small>zahlt 0,95:1</small></button>
      </div>
      <div class="game-message">&nbsp;</div>
      <div class="bac-bet"></div>
      <div class="game-actions">
        <button class="btn btn-primary btn-big bac-deal">🃏 Austeilen</button>
      </div>
      <p class="muted small bac-help">Wer näher an 9 liegt, gewinnt – es zählt nur die Einerstelle (Bilder und Zehnen zählen 0,
        Ass zählt 1). Ob eine dritte Karte kommt, bestimmen feste Regeln. Bei Unentschieden bekommst du Einsätze
        auf Spieler oder Bank zurück.</p>`;
    els = {
      table: body.querySelector('.bac-table'),
      player: body.querySelector('.bac-player'),
      banker: body.querySelector('.bac-banker'),
      playerTotal: body.querySelector('.bac-player-total'),
      bankerTotal: body.querySelector('.bac-banker-total'),
      road: body.querySelector('.bac-road'),
      message: body.querySelector('.game-message'),
      deal: body.querySelector('.bac-deal'),
      choices: [...body.querySelectorAll('.bac-choice')],
    };
    betControl = GK.casino.createBetControl(body.querySelector('.bac-bet'), {
      min: MIN_BET,
      get: () => state().bet,
      set: v => { state().bet = v; },
    });
    els.deal.addEventListener('click', deal);
    els.choices.forEach(btn => btn.addEventListener('click', () => {
      if (state().pending || dealing) return;
      state().choice = btn.dataset.choice;
      GK.sound.play('chip');
      GK.save();
      render();
    }));
    refresh();
  }

  function refresh() {
    dealing = null;
    // Hand aus der letzten Sitzung: sofort abrechnen
    if (state().pending) settle(false);
    else showMessage('Spieler, Bank oder Unentschieden? Wähle deine Wette und teile aus.', '');
    render();
  }

  GK.casino.register({
    id: 'baccarat',
    category: 'table',
    name: 'Baccarat',
    emoji: '🎴',
    desc: 'Spieler oder Bank? Wer näher an 9 kommt, gewinnt.',
    init,
    refresh,
    render: () => {
      if (!state().pending && !dealing) betControl.refresh();
    },
  });

  // Für Tests
  GK.casino.baccaratMath = { PAYS, points, total, bankerDraws, playHand, payoutMult };
})();
