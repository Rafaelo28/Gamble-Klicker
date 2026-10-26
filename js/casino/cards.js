// Spielkarten für Blackjack und Poker.
// Eine Karte ist ein kurzer Text aus Rang + Farbe, z. B. 'AS' (Pik-Ass) oder 'TH' (Herz-Zehn),
// damit sie sich problemlos speichern und später auch über das Netzwerk verschicken lässt.
window.GK = window.GK || {};

(function () {
  const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
  const SUITS = ['S', 'H', 'D', 'C'];
  const SUIT_SYMBOLS = { S: '♠', H: '♥', D: '♦', C: '♣' };
  const RANK_LABELS = { T: '10', J: 'B', Q: 'D', K: 'K', A: 'A' }; // deutsche Bilder: Bube, Dame, König

  function createDeck(decks = 1) {
    const cards = [];
    for (let d = 0; d < decks; d++) {
      for (const suit of SUITS) {
        for (const rank of RANKS) cards.push(rank + suit);
      }
    }
    return GK.rng.shuffle(cards);
  }

  function rank(card) {
    return card[0];
  }

  function suit(card) {
    return card[1];
  }

  // Rang als Zahl: 2 … 14 (Ass)
  function rankValue(card) {
    return RANKS.indexOf(card[0]) + 2;
  }

  function label(card) {
    return (RANK_LABELS[rank(card)] || rank(card)) + SUIT_SYMBOLS[suit(card)];
  }

  // HTML für eine Karte. hidden = verdeckt; extraClass z. B. 'small' oder 'highlight'
  function html(card, hidden = false, extraClass = '') {
    if (hidden || !card) return `<div class="card card-back ${extraClass}"></div>`;
    const red = suit(card) === 'H' || suit(card) === 'D';
    const r = RANK_LABELS[rank(card)] || rank(card);
    const s = SUIT_SYMBOLS[suit(card)];
    return `<div class="card ${red ? 'red' : ''} ${extraClass}">
      <span class="card-corner">${r}<br>${s}</span>
      <span class="card-suit">${s}</span>
    </div>`;
  }

  GK.cards = { RANKS, SUITS, createDeck, rank, suit, rankValue, label, html };
})();
