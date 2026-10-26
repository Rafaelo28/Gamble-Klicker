// Poker-Handbewertung: findet die beste 5-Karten-Hand aus 5 bis 7 Karten.
// Ergebnis ist eine Zahl (score) – je höher, desto besser – plus ein lesbarer Name.
window.GK = window.GK || {};
GK.poker = GK.poker || {};

(function () {
  const CATEGORY_NAMES = ['Höchste Karte', 'Ein Paar', 'Zwei Paare', 'Drilling', 'Straße',
    'Flush', 'Full House', 'Vierling', 'Straight Flush'];

  const RANK_VALUE = { 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, T: 10, J: 11, Q: 12, K: 13, A: 14 };

  // Höchste Karte einer Straße in absteigend sortierten, eindeutigen Rängen (0 = keine)
  function straightHigh(ranksDesc) {
    const ranks = ranksDesc.includes(14) ? [...ranksDesc, 1] : ranksDesc; // Ass auch als 1 (5-4-3-2-A)
    let run = 1;
    for (let i = 1; i < ranks.length; i++) {
      if (ranks[i] === ranks[i - 1] - 1) {
        run++;
        if (run >= 5) return ranks[i] + 4;
      } else {
        run = 1;
      }
    }
    return 0;
  }

  function makeScore(category, kickers) {
    let score = category;
    for (let i = 0; i < 5; i++) score = score * 15 + (kickers[i] || 0);
    return score;
  }

  function evaluate(cards) {
    const counts = {};
    const bySuit = { S: [], H: [], D: [], C: [] };
    for (const card of cards) {
      const r = RANK_VALUE[card[0]];
      counts[r] = (counts[r] || 0) + 1;
      bySuit[card[1]].push(r);
    }
    const uniqueDesc = Object.keys(counts).map(Number).sort((a, b) => b - a);

    // Flush und Straight Flush
    let flushRanks = null;
    for (const suit in bySuit) {
      if (bySuit[suit].length >= 5) flushRanks = bySuit[suit].sort((a, b) => b - a);
    }
    if (flushRanks) {
      const sf = straightHigh(flushRanks);
      if (sf) {
        return { score: makeScore(8, [sf]), category: 8, name: sf === 14 ? 'Royal Flush' : 'Straight Flush' };
      }
    }

    // Gruppen nach Anzahl, dann nach Rang sortiert
    const groups = uniqueDesc.map(r => ({ r, n: counts[r] })).sort((a, b) => b.n - a.n || b.r - a.r);
    const kickersExcept = (...used) => uniqueDesc.filter(r => !used.includes(r));

    let category;
    let kickers;
    if (groups[0].n === 4) {
      category = 7;
      kickers = [groups[0].r, kickersExcept(groups[0].r)[0]];
    } else if (groups[0].n === 3 && groups[1] && groups[1].n >= 2) {
      category = 6;
      kickers = [groups[0].r, groups[1].r];
    } else if (flushRanks) {
      category = 5;
      kickers = flushRanks.slice(0, 5);
    } else if (straightHigh(uniqueDesc)) {
      category = 4;
      kickers = [straightHigh(uniqueDesc)];
    } else if (groups[0].n === 3) {
      category = 3;
      kickers = [groups[0].r, ...kickersExcept(groups[0].r).slice(0, 2)];
    } else if (groups[0].n === 2 && groups[1] && groups[1].n === 2) {
      category = 2;
      kickers = [groups[0].r, groups[1].r, kickersExcept(groups[0].r, groups[1].r)[0]];
    } else if (groups[0].n === 2) {
      category = 1;
      kickers = [groups[0].r, ...kickersExcept(groups[0].r).slice(0, 3)];
    } else {
      category = 0;
      kickers = uniqueDesc.slice(0, 5);
    }
    return { score: makeScore(category, kickers), category, name: CATEGORY_NAMES[category] };
  }

  GK.poker.evaluate = evaluate;
  GK.poker.CATEGORY_NAMES = CATEGORY_NAMES;
})();
