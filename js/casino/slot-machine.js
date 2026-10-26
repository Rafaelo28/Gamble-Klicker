// Gemeinsame Slot-Technik für die große Slot-Maschine im Casino und den Side-Slot im Klicker:
// Symbole, Gewinntabelle und drehende Walzen.
window.GK = window.GK || {};

(function () {
  // Gewicht = wie oft das Symbol auf der Walze vorkommt (gleich für alle 3 Walzen).
  // three/two = Auszahlung als Vielfaches des Einsatzes. Auszahlungsquote: 96,2 %.
  const SYMBOLS = [
    { id: 'cherry',  icon: '🍒', weight: 22, three: 10,  two: 2 },
    { id: 'lemon',   icon: '🍋', weight: 20, three: 15,  two: 0 },
    { id: 'orange',  icon: '🍊', weight: 18, three: 15,  two: 0 },
    { id: 'grape',   icon: '🍇', weight: 15, three: 25,  two: 1 },
    { id: 'bell',    icon: '🔔', weight: 10, three: 50,  two: 2 },
    { id: 'star',    icon: '⭐', weight: 7,  three: 100, two: 3 },
    { id: 'diamond', icon: '💎', weight: 4,  three: 200, two: 5 },
    { id: 'seven',   icon: '<span class="seven">7</span>', weight: 2, three: 777, two: 10 },
  ];
  const byId = Object.fromEntries(SYMBOLS.map(s => [s.id, s]));
  const SPIN_TIMES = [1000, 1350, 1700]; // ms bis zum Halt jeder Walze

  function randomSymbol() {
    return GK.rng.weighted(SYMBOLS).id;
  }

  // Ergebnis einer Drehung: mult = Rückzahlung inklusive Einsatz, win = Walzen, die leuchten
  function evaluate(reels) {
    if (reels[0] === reels[1] && reels[1] === reels[2]) {
      return { mult: byId[reels[0]].three, text: `3× ${byId[reels[0]].icon}`, win: [0, 1, 2], jackpot: reels[0] === 'seven' };
    }
    for (const id of new Set(reels)) {
      if (reels.filter(r => r === id).length === 2 && byId[id].two > 0) {
        return { mult: byId[id].two, text: `2× ${byId[id].icon}`, win: [0, 1, 2].filter(i => reels[i] === id) };
      }
    }
    return { mult: 0, text: 'Kein Gewinn', win: [] };
  }

  // Auszahlungsquote exakt berechnen (für Tests und die Gewinntabelle)
  function rtp() {
    const total = SYMBOLS.reduce((sum, s) => sum + s.weight, 0);
    let sum = 0;
    for (const a of SYMBOLS) for (const b of SYMBOLS) for (const c of SYMBOLS) {
      sum += (a.weight * b.weight * c.weight) / total ** 3 * evaluate([a.id, b.id, c.id]).mult;
    }
    return sum;
  }

  function cell(id) {
    return `<div class="reel-cell">${byId[id].icon}</div>`;
  }

  /**
   * Drei Walzen in `container` anlegen. Jede Walze zeigt 3 Felder, die Gewinnlinie ist die Mitte.
   * options.spinTimes: Laufzeit jeder Walze in ms (Standard: 1000 / 1350 / 1700)
   * Gibt { show(reels), spin(reels, onDone), highlight(indexe) } zurück.
   */
  function createReels(container, options = {}) {
    const spinTimes = options.spinTimes || SPIN_TIMES;
    container.classList.add('reels');
    container.innerHTML = [0, 1, 2].map(() => '<div class="reel"><div class="reel-strip"></div></div>').join('') +
      '<div class="reel-payline"></div>';
    const reels = [...container.querySelectorAll('.reel')];
    const strips = reels.map(r => r.querySelector('.reel-strip'));
    let current = ['seven', 'seven', 'seven'];
    let neighbors = current.map(() => [randomSymbol(), randomSymbol()]);
    let timers = [];
    let ticking = null;

    function show(result) {
      current = result.slice();
      neighbors = current.map(() => [randomSymbol(), randomSymbol()]);
      strips.forEach((strip, i) => {
        strip.style.transition = 'none';
        strip.style.transform = 'translateY(0)';
        strip.innerHTML = cell(neighbors[i][0]) + cell(current[i]) + cell(neighbors[i][1]);
      });
      highlight([]);
    }

    function highlight(indexes) {
      reels.forEach((r, i) => r.classList.toggle('win', indexes.includes(i)));
    }

    // Walzen drehen und nacheinander auf `result` (Mitte) stoppen
    function spin(result, onDone) {
      timers.forEach(clearTimeout);
      timers = [];
      clearInterval(ticking);
      highlight([]);
      const fast = GK.state.settings.effects === 'reduced';
      const cellHeight = reels[0].clientHeight / 3 || 40;
      ticking = setInterval(() => GK.sound.play('tick'), 75);
      GK.sound.play('spinStart');

      strips.forEach((strip, i) => {
        const filler = 14 + i * 6;
        const finalNeighbors = [randomSymbol(), randomSymbol()];
        let html = cell(neighbors[i][0]) + cell(current[i]) + cell(neighbors[i][1]);
        for (let k = 0; k < filler; k++) html += cell(randomSymbol());
        html += cell(finalNeighbors[0]) + cell(result[i]) + cell(finalNeighbors[1]);
        strip.innerHTML = html;
        strip.style.transition = 'none';
        strip.style.transform = 'translateY(0)';
        strip.classList.add('blur');
        void strip.offsetHeight; // Startposition übernehmen, bevor die Animation beginnt
        const duration = fast ? Math.min(300 + i * 150, spinTimes[i]) : spinTimes[i];
        const distance = (filler + 3) * cellHeight;
        strip.style.transition = `transform ${duration}ms cubic-bezier(0.2, 0.75, 0.3, 1.04)`;
        strip.style.transform = `translateY(-${distance}px)`;
        timers.push(setTimeout(() => strip.classList.remove('blur'), duration * 0.8));
        timers.push(setTimeout(() => {
          GK.sound.play('reelStop');
          GK.fx.pulse(reels[i], 'reel-bump');
          neighbors[i] = finalNeighbors;
          current[i] = result[i];
          if (i === 2) {
            clearInterval(ticking);
            ticking = null;
            show(result);
            onDone();
          }
        }, duration));
      });
    }

    show(current);
    return { show, spin, highlight };
  }

  GK.slotMachine = { SYMBOLS, byId, randomSymbol, evaluate, rtp, createReels };
})();
