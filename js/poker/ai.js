// Computer-Gegner für Texas Hold'em.
// Jeder Bot schätzt seine Gewinnchance (Equity), indem er die unbekannten Karten
// mehrere hundert Mal zufällig durchspielt, und entscheidet dann je nach Persönlichkeit.
window.GK = window.GK || {};
GK.poker = GK.poker || {};

(function () {
  const SIMULATIONS = 300;

  // tight: wirft eher weg · aggr: erhöht gern · bluff: blufft öfter
  const BOTS = [
    { name: "Käpt'n Blaubart", avatar: '🏴‍☠️', personality: { tight: 0.3, aggr: 0.7, bluff: 0.4 } },
    { name: 'Einäugige Jenny', avatar: '🦜',  personality: { tight: 0.7, aggr: 0.3, bluff: 0.1 } },
    { name: 'Smutje Karl',     avatar: '🍲',  personality: { tight: 0.1, aggr: 0.2, bluff: 0.15 } },
    { name: 'Long John',       avatar: '🦿',  personality: { tight: 0.4, aggr: 0.9, bluff: 0.6 } },
    { name: 'Die Holländerin', avatar: '⚓',  personality: { tight: 0.5, aggr: 0.5, bluff: 0.3 } },
    { name: 'Rum-Rudi',        avatar: '🍺',  personality: { tight: 0.15, aggr: 0.5, bluff: 0.5 } },
  ];

  // Gewinnchance gegen `opponents` Gegner mit unbekannten Karten (0 … 1)
  function equity(holeCards, board, opponents, simulations = SIMULATIONS) {
    const known = new Set([...holeCards, ...board]);
    const deck = [];
    for (const s of GK.cards.SUITS) {
      for (const r of GK.cards.RANKS) {
        if (!known.has(r + s)) deck.push(r + s);
      }
    }
    const needBoard = 5 - board.length;
    const need = needBoard + opponents * 2;
    let score = 0;

    for (let sim = 0; sim < simulations; sim++) {
      // Teilweises Mischen: nur so viele Karten wie nötig (Math.random genügt für die Schätzung)
      for (let i = 0; i < need; i++) {
        const j = i + Math.floor(Math.random() * (deck.length - i));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
      const fullBoard = board.concat(deck.slice(0, needBoard));
      const mine = GK.poker.evaluate(holeCards.concat(fullBoard)).score;
      let best = true;
      let ties = 0;
      for (let o = 0; o < opponents; o++) {
        const start = needBoard + o * 2;
        const theirs = GK.poker.evaluate([deck[start], deck[start + 1], ...fullBoard]).score;
        if (theirs > mine) {
          best = false;
          break;
        }
        if (theirs === mine) ties++;
      }
      if (best) score += 1 / (ties + 1);
    }
    return score / simulations;
  }

  // Entscheidung für den Bot, der gerade am Zug ist
  function decide(t) {
    const engine = GK.poker.engine;
    const me = t.players[t.toAct];
    const la = engine.legalActions(t);
    const pers = me.personality || { tight: 0.5, aggr: 0.5, bluff: 0.2 };
    const opponents = t.players.filter((p, i) => i !== t.toAct && engine.inHand(p)).length;
    const eq = equity(me.cards, t.board, opponents);
    const strength = eq * (opponents + 1); // 1 = durchschnittliche Hand bei dieser Gegnerzahl
    const potOdds = la.toCall / (la.pot + la.toCall);
    const roll = Math.random();
    const bb = engine.blinds(t).bb;

    const raiseTo = factor => {
      const size = Math.max(t.minRaise, Math.round((la.pot * factor) / bb) * bb);
      let to = t.currentBet + size;
      // Wenn ohnehin der Großteil des Stapels drin wäre: gleich All-in
      if (to > la.maxRaiseTo * 0.6) to = la.maxRaiseTo;
      return { type: 'raise', to };
    };

    // Teure Situation (großer Einsatz im Verhältnis zum Pot) → nur mit starken Händen erhöhen
    const expensive = la.toCall > la.pot * 0.5;
    const raiseThreshold = 1.55 - pers.aggr * 0.45 + (expensive ? 0.6 : 0);

    if (la.canRaise && strength >= raiseThreshold && roll < 0.6 + pers.aggr * 0.35) {
      return raiseTo(strength > 2.2 ? 0.9 + roll * 0.6 : 0.5 + roll * 0.4);
    }
    if (la.canCheck) {
      if (la.canRaise && roll < pers.bluff * 0.2) return raiseTo(0.5);
      return { type: 'check' };
    }
    const required = potOdds * (1 + pers.tight * 0.5);
    if (eq >= required) return { type: 'call' };
    if (la.canRaise && !expensive && roll < pers.bluff * 0.06) return raiseTo(0.7);
    return { type: 'fold' };
  }

  GK.poker.ai = { BOTS, equity, decide };
})();
