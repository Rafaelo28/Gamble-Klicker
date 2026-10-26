// Blackjack gegen den Dealer: 6 Decks, Dealer steht auf 17, Blackjack zahlt 3:2,
// Verdoppeln (auch nach Teilen) und Teilen bis zu 4 Hände. Jede geteilte Hand darf so viele
// Karten ziehen, wie sie möchte – auch geteilte Asse.
// Jede Aktion wird sofort gespeichert – eine angefangene Runde übersteht das Neuladen.
window.GK = window.GK || {};

(function () {
  const MIN_BET = 10;
  const DECKS = 6;
  const RESHUFFLE_AT = 78; // neu mischen, wenn weniger als ein Viertel übrig ist
  const MAX_HANDS = 4;

  let els = {};
  let betControl;
  // Welche Karten waren beim letzten Zeichnen schon zu sehen? Nur neue Karten fliegen herein.
  let seen = { round: null, dealer: 0, hands: [], holeHidden: true };
  let celebration = null; // Gewinn, der nach dem Austeilen gefeiert wird

  function state() {
    return GK.casino.data('blackjack', () => ({ bet: 100, shoe: [], round: null }));
  }

  // ---------- Regeln ----------

  function cardValue(card) {
    const r = GK.cards.rank(card);
    if (r === 'A') return 11;
    if ('TJQK'.includes(r)) return 10;
    return Number(r);
  }

  // Punktwert einer Hand; soft = ein Ass zählt noch als 11
  function handValue(cards) {
    let total = 0;
    let aces = 0;
    cards.forEach(c => {
      total += cardValue(c);
      if (GK.cards.rank(c) === 'A') aces++;
    });
    while (total > 21 && aces > 0) {
      total -= 10;
      aces--;
    }
    return { total, soft: aces > 0 };
  }

  function isBlackjack(cards) {
    return cards.length === 2 && handValue(cards).total === 21;
  }

  function draw() {
    return state().shoe.pop();
  }

  function activeHand() {
    const round = state().round;
    return round && !round.finished ? round.hands[round.active] : null;
  }

  function canDouble(hand) {
    return hand && hand.cards.length === 2 && GK.canAfford(hand.bet);
  }

  function canSplit(hand) {
    const round = state().round;
    return hand && hand.cards.length === 2 && round.hands.length < MAX_HANDS &&
      cardValue(hand.cards[0]) === cardValue(hand.cards[1]) && GK.canAfford(hand.bet);
  }

  // ---------- Ablauf ----------

  function deal() {
    const s = state();
    if (s.round && !s.round.finished) return;
    if (!GK.casino.bet(s.bet)) {
      showMessage('Nicht genug Dublonen für diesen Einsatz.', 'loss');
      return;
    }
    if (s.shoe.length < RESHUFFLE_AT) s.shoe = GK.cards.createDeck(DECKS);

    const hand = { cards: [], bet: s.bet, done: false, split: false };
    s.round = { hands: [hand], active: 0, dealer: [], finished: false, results: [] };
    hand.cards.push(draw());
    s.round.dealer.push(draw());
    hand.cards.push(draw());
    s.round.dealer.push(draw());

    // Bei Blackjack (Spieler oder Dealer) ist die Runde sofort vorbei
    if (isBlackjack(hand.cards) || isBlackjack(s.round.dealer)) {
      hand.done = true;
      finishRound();
    } else {
      GK.save();
    }
    renderTable();
  }

  function hit() {
    const hand = activeHand();
    if (!hand) return;
    hand.cards.push(draw());
    if (handValue(hand.cards).total >= 21) hand.done = true;
    nextHand();
  }

  function stand() {
    const hand = activeHand();
    if (!hand) return;
    hand.done = true;
    nextHand();
  }

  function double() {
    const hand = activeHand();
    if (!canDouble(hand) || !GK.casino.bet(hand.bet)) return;
    hand.bet *= 2;
    hand.doubled = true;
    hand.cards.push(draw());
    hand.done = true;
    nextHand();
  }

  function split() {
    const round = state().round;
    const hand = activeHand();
    if (!canSplit(hand) || !GK.casino.bet(hand.bet)) return;
    const second = { cards: [hand.cards.pop()], bet: hand.bet, done: false, split: true };
    hand.split = true;
    hand.cards.push(draw());
    second.cards.push(draw());
    round.hands.splice(round.active + 1, 0, second);
    if (handValue(hand.cards).total === 21) hand.done = true;
    nextHand();
  }

  // Zur nächsten offenen Hand wechseln – oder der Dealer ist dran
  function nextHand() {
    const round = state().round;
    while (round.active < round.hands.length && round.hands[round.active].done) {
      round.active++;
      const next = round.hands[round.active];
      // Nach dem Teilen bekommt die nächste Hand ihre zweite Karte bereits beim Teilen
      if (next && handValue(next.cards).total === 21) next.done = true;
    }
    if (round.active >= round.hands.length) {
      finishRound();
    } else {
      GK.save();
    }
    renderTable();
  }

  function finishRound() {
    const round = state().round;
    const allBust = round.hands.every(h => handValue(h.cards).total > 21);
    const dealerHasBj = isBlackjack(round.dealer);
    const playerNatural = round.hands.length === 1 && !round.hands[0].split && isBlackjack(round.hands[0].cards);

    // Dealer zieht bis mindestens 17 (steht auch auf Soft 17)
    if (!allBust && !playerNatural && !dealerHasBj) {
      while (handValue(round.dealer).total < 17) round.dealer.push(draw());
    }
    const dealerTotal = handValue(round.dealer).total;

    let totalBet = 0;
    let totalPayout = 0;
    round.results = round.hands.map(hand => {
      const total = handValue(hand.cards).total;
      let payout = 0;
      let text;
      if (total > 21) {
        text = 'Überkauft';
      } else if (playerNatural && !dealerHasBj) {
        payout = hand.bet * 2.5;
        text = 'Blackjack!';
      } else if (dealerHasBj && !playerNatural) {
        text = 'Dealer hat Blackjack';
      } else if (dealerTotal > 21 || total > dealerTotal) {
        payout = hand.bet * 2;
        text = dealerTotal > 21 ? 'Dealer überkauft' : 'Gewonnen';
      } else if (total === dealerTotal) {
        payout = hand.bet;
        text = 'Unentschieden';
      } else {
        text = 'Verloren';
      }
      payout = Math.floor(payout);
      totalBet += hand.bet;
      totalPayout += payout;
      return { text, payout };
    });

    round.finished = true;
    round.totalBet = totalBet;
    round.totalPayout = totalPayout;
    GK.casino.payout(totalPayout);
    if (playerNatural && !dealerHasBj) GK.unlockAchievement('bjNatural');
    if (round.hands.length > 1 && round.results.every(r => r.payout > 0 && r.text !== 'Unentschieden')) {
      GK.unlockAchievement('bjSplitWin');
    }
    const summary = round.results.map(r => r.text).join(' / ');
    GK.casino.record('blackjack', totalBet, totalPayout, summary);
    celebration = { payout: totalPayout, bet: totalBet, natural: playerNatural && !dealerHasBj, text: summary };
  }

  // ---------- Darstellung ----------

  function valueLabel(cards) {
    const v = handValue(cards);
    if (isBlackjack(cards)) return 'Blackjack';
    return v.soft && v.total < 21 ? `${v.total - 10}/${v.total}` : String(v.total);
  }

  function renderTable() {
    const s = state();
    const round = s.round;
    if (!round) {
      els.dealer.innerHTML = '<div class="card-placeholder"></div><div class="card-placeholder"></div>';
      els.dealerValue.textContent = '';
      els.hands.innerHTML = '<div class="bj-hand"><div class="bj-cards"><div class="card-placeholder"></div><div class="card-placeholder"></div></div></div>';
      showMessage('Wähle deinen Einsatz und klicke auf „Austeilen“.', '');
      updateButtons();
      return;
    }

    const hideHole = !round.finished;
    const prev = seen.round === round ? seen : { dealer: 0, hands: [], holeHidden: true };
    let delay = 0;
    // Neue Karten nacheinander hereinfliegen lassen (mit Sound)
    const cardHtml = (card, hidden, isNew, flip) => {
      if (!isNew && !flip) return GK.cards.html(card, hidden);
      const d = delay;
      delay += 0.18;
      setTimeout(() => GK.sound.play(flip ? 'flip' : 'card'), d * 1000);
      return GK.cards.html(card, hidden, flip ? 'flip-in' : 'deal-in', `animation-delay: ${d}s`);
    };
    const handsHtml = round.hands.map(hand => hand.cards.map((c, j) => ({ c, j })));
    // Reihenfolge wie beim echten Austeilen: erst die Spieler-Hände, dann der Dealer
    const handCards = handsHtml.map((cards, i) =>
      cards.map(({ c, j }) => cardHtml(c, false, j >= (prev.hands[i] || 0), false)).join(''));
    els.dealer.innerHTML = round.dealer.map((c, i) => {
      const isNew = i >= prev.dealer;
      const flip = i === 1 && !isNew && prev.holeHidden && !hideHole;
      return cardHtml(c, hideHole && i === 1, isNew, flip);
    }).join('');
    seen = { round, dealer: round.dealer.length, hands: round.hands.map(h => h.cards.length), holeHidden: hideHole };
    els.dealerValue.textContent = hideHole ? String(handValue([round.dealer[0]]).total) : valueLabel(round.dealer);

    els.hands.classList.toggle('split', round.hands.length > 1);
    els.hands.innerHTML = round.hands.map((hand, i) => {
      const active = !round.finished && i === round.active;
      const result = round.finished ? round.results[i] : null;
      const resultCls = result ? (result.payout > hand.bet ? 'win' : result.payout === hand.bet ? '' : 'loss') : '';
      return `<div class="bj-hand ${active ? 'active' : ''} ${result ? 'done-' + (resultCls || 'push') : ''}">
        <div class="bj-cards">${handCards[i]}</div>
        <div class="bj-hand-info">
          ${round.hands.length > 1 ? `<span class="bj-hand-no">Hand ${i + 1}</span>` : ''}
          <span class="bj-value">${valueLabel(hand.cards)}</span>
          <span class="bj-bet">${GK.formatMoneyHTML(hand.bet)}${hand.doubled ? ' (verdoppelt)' : ''}</span>
          ${result ? `<span class="bj-result ${resultCls}" style="animation-delay: ${delay + 0.1}s">${result.text}</span>` : ''}
        </div>
      </div>`;
    }).join('');

    if (celebration) {
      const c = celebration;
      celebration = null;
      setTimeout(() => GK.fx.celebrate(c.payout, c.bet, {
        el: els.hands, level: c.natural ? 'big' : undefined, subtitle: c.natural ? 'Blackjack!' : c.text,
      }), (delay + 0.25) * 1000);
    }

    if (round.finished) {
      const diff = round.totalPayout - round.totalBet;
      if (diff > 0) showMessage(`Gewinn: +${GK.formatMoneyHTML(diff)}`, 'win');
      else if (diff === 0) showMessage('Einsatz zurück.', '');
      else showMessage(`Verloren: −${GK.formatMoneyHTML(-diff)}`, 'loss');
    } else {
      showMessage(round.hands.length > 1
        ? `Hand ${round.active + 1} von ${round.hands.length} ist dran: Karte oder bleiben?` : 'Karte oder bleiben?', '');
    }
    updateButtons();
  }

  function showMessage(html, cls) {
    els.message.className = 'game-message ' + (cls || '');
    els.message.innerHTML = html;
  }

  function updateButtons() {
    const round = state().round;
    const playing = round && !round.finished;
    const hand = activeHand();
    els.deal.hidden = playing;
    els.playActions.hidden = !playing;
    els.hit.textContent = round && round.hands.length > 1 && hand ? `Karte für Hand ${round.active + 1}` : 'Karte';
    els.double.disabled = !canDouble(hand);
    els.split.disabled = !canSplit(hand);
    betControl.setDisabled(playing);
  }

  function init(body) {
    body.innerHTML = `
      <div class="bj-table">
        <div class="bj-area">
          <div class="bj-label">Dealer <span class="bj-dealer-value"></span></div>
          <div class="bj-cards bj-dealer"></div>
        </div>
        <div class="bj-rules">Blackjack zahlt 3:2 · Dealer steht auf 17</div>
        <div class="bj-area">
          <div class="bj-label">Deine Hand</div>
          <div class="bj-hands"></div>
        </div>
      </div>
      <div class="game-message">&nbsp;</div>
      <div class="bj-bet"></div>
      <div class="game-actions">
        <button class="btn btn-primary bj-deal">🃏 Austeilen</button>
        <span class="bj-play-actions">
          <button class="btn btn-primary bj-hit">Karte</button>
          <button class="btn bj-stand">Bleiben</button>
          <button class="btn bj-double">Verdoppeln</button>
          <button class="btn bj-split">Teilen</button>
        </span>
      </div>`;
    els = {
      dealer: body.querySelector('.bj-dealer'),
      dealerValue: body.querySelector('.bj-dealer-value'),
      hands: body.querySelector('.bj-hands'),
      message: body.querySelector('.game-message'),
      deal: body.querySelector('.bj-deal'),
      playActions: body.querySelector('.bj-play-actions'),
      double: body.querySelector('.bj-double'),
      split: body.querySelector('.bj-split'),
      hit: body.querySelector('.bj-hit'),
    };
    betControl = GK.casino.createBetControl(body.querySelector('.bj-bet'), {
      min: MIN_BET,
      get: () => state().bet,
      set: v => { state().bet = v; },
    });
    els.deal.addEventListener('click', deal);
    els.hit.addEventListener('click', hit);
    body.querySelector('.bj-stand').addEventListener('click', stand);
    els.double.addEventListener('click', double);
    els.split.addEventListener('click', split);
    refresh();
  }

  function refresh() {
    // Nach dem Neuladen nichts hereinfliegen lassen, sondern den Stand direkt zeigen
    const round = state().round;
    celebration = null;
    seen = round
      ? { round, dealer: round.dealer.length, hands: round.hands.map(h => h.cards.length), holeHidden: !round.finished }
      : { round: null, dealer: 0, hands: [], holeHidden: true };
    renderTable();
  }

  GK.casino.register({
    id: 'blackjack',
    category: 'table',
    name: 'Blackjack',
    emoji: '🃏',
    desc: 'Komm näher an 21 als der Dealer.',
    init,
    refresh,
    render: () => {
      betControl.refresh();
      updateButtons();
    },
  });

  GK.casino.blackjackRules = { handValue, isBlackjack };
})();
