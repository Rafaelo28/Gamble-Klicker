// Video-Slots: Automaten mit 5 Walzen, 3 Reihen und 20 Gewinnlinien.
// - WILD ersetzt alle normalen Symbole.
// - Ab 3 Scatter-Symbolen (egal wo) gibt es Freispiele mit Gewinn-Multiplikator.
// - 3 Bonus-Symbole auf den Walzen 1, 3 und 5 starten die Bonusrunde (Schatzkisten öffnen).
// Jede Drehung steht beim Start fest und wird gespeichert; Freispiele und Bonusrunde
// überstehen das Neuladen. Die Themen (Aussehen) stehen unten in THEMES.
window.GK = window.GK || {};

(function () {
  const REELS = 5;
  const ROWS = 3;
  const MIN_BET = 20;
  const AUTO_SPINS = 10;

  // 20 Gewinnlinien: Reihe (0 oben, 1 Mitte, 2 unten) je Walze
  const LINES = [
    [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0], [2, 1, 0, 1, 2],
    [0, 0, 1, 2, 2], [2, 2, 1, 0, 0], [1, 0, 0, 0, 1], [1, 2, 2, 2, 1], [0, 1, 1, 1, 0],
    [2, 1, 1, 1, 2], [1, 0, 1, 2, 1], [1, 2, 1, 0, 1], [0, 1, 0, 1, 0], [2, 1, 2, 1, 2],
    [1, 1, 0, 1, 1], [1, 1, 2, 1, 1], [0, 2, 0, 2, 0], [2, 0, 2, 0, 2], [0, 2, 2, 2, 0],
  ];
  const LINE_COLORS = ['#ffd95e', '#ff6b6b', '#6fdc8c', '#5ad8ff', '#c27bff', '#ff9f3c', '#ff5ad1', '#9be15d',
    '#f5c542', '#4dd0e1', '#ffb347', '#e57373', '#81c784', '#64b5f6', '#ba68c8', '#ffd54f', '#4db6ac', '#f06292', '#aed581', '#7986cb'];

  // Auszahlung je Linie als Vielfaches des Linieneinsatzes (Einsatz / 20) für 3, 4 und 5 gleiche
  const PAYS = {
    H1: [50, 200, 1000], H2: [30, 120, 500], H3: [20, 80, 300], H4: [18, 60, 200],
    L1: [12, 35, 120], L2: [10, 30, 100], L3: [8, 25, 80], L4: [6, 20, 60],
  };
  const SCATTER_PAYS = { 3: 2, 4: 10, 5: 50 };   // × Gesamteinsatz
  const BONUS_VALUES = [2, 3, 3, 4, 5, 5, 6, 8, 10, 12, 15, 25]; // Schatzkisten (× Gesamteinsatz)
  const BONUS_PICKS = 3;

  // Wie oft jedes Symbol auf den Walzen 1–5 vorkommt (gleich für alle Themen).
  // Scatter (S) und Bonus (B) liegen mit Abstand, damit eine Walze höchstens eins davon zeigt.
  const REEL_COUNTS = [
    { W: 1, S: 1, B: 2, H1: 2, H2: 3, H3: 3, H4: 4, L1: 5, L2: 5, L3: 6, L4: 7 },
    { W: 2, S: 2, B: 0, H1: 2, H2: 3, H3: 3, H4: 4, L1: 5, L2: 5, L3: 6, L4: 7 },
    { W: 2, S: 1, B: 2, H1: 2, H2: 3, H3: 4, H4: 4, L1: 5, L2: 5, L3: 6, L4: 6 },
    { W: 2, S: 2, B: 0, H1: 2, H2: 3, H3: 4, H4: 4, L1: 5, L2: 6, L3: 6, L4: 6 },
    { W: 2, S: 1, B: 2, H1: 3, H2: 3, H3: 4, H4: 5, L1: 5, L2: 6, L3: 6, L4: 6 },
  ];

  const THEMES = [
    {
      id: 'vsPirate', name: 'Schatz der Karibik', emoji: '🏴‍☠️', cls: 'vs-pirate',
      desc: '5 Walzen, 20 Linien, Freispiele ×3 und Schatzkisten-Bonus.',
      freeSpins: { 3: 10, 4: 15, 5: 20 }, freeMult: 3,
      symbols: {
        W: { icon: '☠️', label: 'WILD' }, S: { icon: '🗺️', label: 'FREISPIELE' }, B: { icon: '🧰', label: 'BONUS' },
        H1: { icon: '👑' }, H2: { icon: '🦜' }, H3: { icon: '⚓' }, H4: { icon: '🗡️' },
        L1: { letter: 'A' }, L2: { letter: 'K' }, L3: { letter: 'Q' }, L4: { letter: 'J' },
      },
      bonus: { title: 'Schatzkisten', chest: '🧰', open: '💰', text: 'Öffne 3 Schatzkisten!' },
    },
    {
      id: 'vsOcean', name: 'Tiefsee-Perlen', emoji: '🐙', cls: 'vs-ocean',
      desc: '5 Walzen, 20 Linien, 15 Freispiele ×2 und Muschel-Bonus.',
      freeSpins: { 3: 15, 4: 20, 5: 25 }, freeMult: 2,
      symbols: {
        W: { icon: '🔱', label: 'WILD' }, S: { icon: '🐚', label: 'FREISPIELE' }, B: { icon: '🦪', label: 'BONUS' },
        H1: { icon: '🧜‍♀️' }, H2: { icon: '🦈' }, H3: { icon: '🐙' }, H4: { icon: '🐠' },
        L1: { letter: 'A' }, L2: { letter: 'K' }, L3: { letter: 'Q' }, L4: { letter: 'J' },
      },
      bonus: { title: 'Perlenmuscheln', chest: '🦪', open: '⚪', text: 'Öffne 3 Muscheln!' },
    },
    {
      id: 'vsVolcano', name: 'Vulkan-Gold', emoji: '🌋', cls: 'vs-volcano',
      desc: '5 Walzen, 20 Linien, heiße Freispiele ×5 und Götzen-Bonus.',
      freeSpins: { 3: 6, 4: 10, 5: 15 }, freeMult: 5,
      symbols: {
        W: { icon: '🔥', label: 'WILD' }, S: { icon: '🌋', label: 'FREISPIELE' }, B: { icon: '🗿', label: 'BONUS' },
        H1: { icon: '💎' }, H2: { icon: '🦎' }, H3: { icon: '🥥' }, H4: { icon: '🌺' },
        L1: { letter: 'A' }, L2: { letter: 'K' }, L3: { letter: 'Q' }, L4: { letter: 'J' },
      },
      bonus: { title: 'Steingötzen', chest: '🗿', open: '🪙', text: 'Weck 3 Steingötzen!' },
    },
  ];

  // ---------- Walzen ----------

  // Kleiner Zufallsgenerator mit festem Startwert: Die Walzen sehen bei jedem Laden gleich aus
  function seeded(seed) {
    return function () {
      seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function buildStrip(counts, seed) {
    const rand = seeded(seed);
    const regular = [];
    Object.entries(counts).forEach(([sym, n]) => {
      if (sym !== 'S' && sym !== 'B') for (let i = 0; i < n; i++) regular.push(sym);
    });
    for (let i = regular.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [regular[i], regular[j]] = [regular[j], regular[i]];
    }
    const specials = [];
    for (let i = 0; i < (counts.S || 0); i++) specials.push('S');
    for (let i = 0; i < (counts.B || 0); i++) specials.push('B');
    const length = regular.length + specials.length;
    const strip = [];
    const gap = length / Math.max(1, specials.length);
    let next = 0;
    let k = 0;
    for (let pos = 0; pos < length; pos++) {
      if (k < specials.length && pos >= Math.round(next)) {
        strip.push(specials[k++]);
        next += gap;
      } else {
        strip.push(regular.shift());
      }
    }
    return strip;
  }

  const STRIPS = REEL_COUNTS.map((counts, i) => buildStrip(counts, 1234 + i * 77));

  // Sichtbares Fenster: grid[walze][reihe]
  function windowAt(stops) {
    return STRIPS.map((strip, r) => [-1, 0, 1].map(d => strip[(stops[r] + d + strip.length) % strip.length]));
  }

  function randomStops() {
    return STRIPS.map(strip => GK.rng.int(strip.length));
  }

  // ---------- Gewinne ----------

  // Gewinn einer Linie (Symbole von links nach rechts): { sym, count, pay } – pay in Linieneinsätzen
  function evalLine(syms) {
    let best = { sym: null, count: 0, pay: 0 };
    // WILDs von links zählen wie das stärkste Symbol
    let wilds = 0;
    while (wilds < REELS && syms[wilds] === 'W') wilds++;
    if (wilds >= 3) best = { sym: 'H1', count: wilds, pay: PAYS.H1[wilds - 3] };
    const target = syms.find(s => s !== 'W');
    if (target && PAYS[target]) {
      let count = 0;
      while (count < REELS && (syms[count] === 'W' || syms[count] === target)) count++;
      if (count >= 3 && PAYS[target][count - 3] > best.pay) best = { sym: target, count, pay: PAYS[target][count - 3] };
    } else if (!target) {
      best = { sym: 'H1', count: REELS, pay: PAYS.H1[2] };
    }
    return best;
  }

  // Ganze Drehung auswerten. Beträge in Dublonen (bet = Gesamteinsatz)
  function evaluate(theme, grid, bet, mult = 1) {
    const lineBet = bet / LINES.length;
    const lineWins = [];
    LINES.forEach((line, index) => {
      const syms = line.map((row, reel) => grid[reel][row]);
      const win = evalLine(syms);
      if (win.pay > 0) {
        lineWins.push({ index, sym: win.sym, count: win.count, amount: Math.floor(win.pay * lineBet * mult) });
      }
    });
    const scatterPos = [];
    const bonusPos = [];
    grid.forEach((col, reel) => col.forEach((sym, row) => {
      if (sym === 'S') scatterPos.push([reel, row]);
      if (sym === 'B') bonusPos.push([reel, row]);
    }));
    const scatters = scatterPos.length;
    const scatterWin = Math.floor((SCATTER_PAYS[Math.min(scatters, 5)] || 0) * bet * mult);
    const freeSpins = scatters >= 3 ? theme.freeSpins[Math.min(scatters, 5)] : 0;
    const bonus = [0, 2, 4].every(reel => grid[reel].includes('B'));
    const total = lineWins.reduce((sum, w) => sum + w.amount, 0) + scatterWin;
    return { lineWins, scatterPos, bonusPos, scatters, scatterWin, freeSpins, bonus, total };
  }

  // ---------- Exakte Auszahlungsquote (für Tests) ----------

  function rtp(theme) {
    const marg = REEL_COUNTS.map(counts => {
      const len = Object.values(counts).reduce((a, b) => a + b, 0);
      return Object.entries(counts).filter(([, n]) => n > 0).map(([sym, n]) => [sym, n / len]);
    });
    // Linien: alle Symbolkombinationen einer Linie durchrechnen (Walzen sind unabhängig)
    let line = 0;
    (function walk(reel, syms, p) {
      if (reel === REELS) {
        line += p * evalLine(syms).pay;
        return;
      }
      marg[reel].forEach(([sym, q]) => walk(reel + 1, syms.concat(sym), p * q));
    })(0, [], 1);
    const lineRtp = line * LINES.length / LINES.length; // 20 Linien × Linieneinsatz = Gesamteinsatz
    // Scatter: jede Walze zeigt höchstens einen (Abstand auf der Walze)
    const q = REEL_COUNTS.map(c => 3 * (c.S || 0) / Object.values(c).reduce((a, b) => a + b, 0));
    let dist = [1];
    q.forEach(p => {
      const next = new Array(dist.length + 1).fill(0);
      dist.forEach((v, k) => {
        next[k] += v * (1 - p);
        next[k + 1] += v * p;
      });
      dist = next;
    });
    const scatterRtp = dist.reduce((sum, v, k) => sum + v * (SCATTER_PAYS[k] || 0), 0);
    const pBonus = [0, 2, 4].reduce((p, r) => p * 3 * (REEL_COUNTS[r].B || 0) / Object.values(REEL_COUNTS[r]).reduce((a, b) => a + b, 0), 1);
    const bonusValue = BONUS_PICKS * BONUS_VALUES.reduce((a, b) => a + b, 0) / BONUS_VALUES.length;
    // Freispiele: jede Freispiel-Drehung bringt mult × (Linien + Scatter) + Bonus, Freispiele können neu starten
    const perFree = theme.freeMult * (lineRtp + scatterRtp) + pBonus * bonusValue;
    const extraSpins = dist.reduce((sum, v, k) => sum + v * (k >= 3 ? theme.freeSpins[k] : 0), 0);
    const freeRtp = dist.reduce((sum, v, k) => sum + (k >= 3 ? v * theme.freeSpins[k] / (1 - extraSpins) * perFree : 0), 0);
    const pFree = dist.slice(3).reduce((a, b) => a + b, 0);
    return { total: lineRtp + scatterRtp + freeRtp + pBonus * bonusValue, line: lineRtp, scatter: scatterRtp, free: freeRtp, bonus: pBonus * bonusValue, pFree, pBonus };
  }

  // ---------- Automat (Darstellung und Ablauf) ----------

  function createMachine(theme) {
    let els = {};
    let betControl;
    let busy = false;
    let autoLeft = 0;
    let timers = [];
    let ticking = null;

    function state() {
      return GK.casino.data(theme.id, () => ({ bet: 100, stops: [0, 0, 0, 0, 0], pending: null, free: null, bonus: null }));
    }

    const sym = id => theme.symbols[id];

    function cellHtml(id, extra = '') {
      const s = sym(id);
      const inner = s.letter
        ? `<span class="vs-letter vs-${id}">${s.letter}</span>`
        : `<span class="vs-icon">${s.icon}</span>${s.label ? `<span class="vs-label">${s.label}</span>` : ''}`;
      return `<div class="vs-cell vs-sym-${id} ${extra}">${inner}</div>`;
    }

    function randomSymbol(reel) {
      const strip = STRIPS[reel];
      return strip[GK.rng.int(strip.length)];
    }

    // Fenster ohne Animation zeigen
    function show(grid) {
      els.strips.forEach((strip, r) => {
        strip.style.transition = 'none';
        strip.style.transform = 'translateY(0)';
        strip.innerHTML = grid[r].map(id => cellHtml(id)).join('');
      });
      clearWins();
    }

    function clearWins() {
      els.lines.innerHTML = '';
      els.reels.forEach(r => r.classList.remove('anticipation'));
    }

    // Walzen drehen; anticipation = ab 2 Freispiel-Symbolen drehen die übrigen Walzen länger
    function animate(grid, onDone) {
      timers.forEach(clearTimeout);
      timers = [];
      clearWins();
      const free = !!(state().free && state().free.started);
      const fast = GK.state.settings.effects === 'reduced';
      const cellH = els.reels[0].clientHeight / ROWS || 80;
      GK.sound.play('spinStart');
      clearInterval(ticking);
      ticking = setInterval(() => GK.sound.play('tick'), 80);
      let extra = 0;
      let scatters = 0;
      const stopAt = [];
      for (let r = 0; r < REELS; r++) {
        const base = fast ? 250 + r * 120 : (free ? 650 : 900) + r * (free ? 180 : 260);
        if (scatters >= 2) extra += fast ? 200 : 800;
        stopAt.push(base + extra);
        scatters += grid[r].filter(x => x === 'S').length;
      }
      els.strips.forEach((strip, r) => {
        const filler = 12 + r * 4 + Math.round((stopAt[r] - stopAt[0]) / 120);
        const current = [...strip.children].map(c => c.outerHTML).join('');
        let html = current;
        for (let k = 0; k < filler; k++) html += cellHtml(randomSymbol(r));
        html += grid[r].map(id => cellHtml(id)).join('');
        strip.innerHTML = html;
        strip.style.transition = 'none';
        strip.style.transform = 'translateY(0)';
        strip.classList.add('blur');
        void strip.offsetHeight;
        strip.style.transition = `transform ${stopAt[r]}ms cubic-bezier(0.2, 0.7, 0.3, 1.03)`;
        strip.style.transform = `translateY(-${(filler + ROWS) * cellH}px)`;
        timers.push(setTimeout(() => strip.classList.remove('blur'), stopAt[r] * 0.85));
        // Spannung: die nächste Walze leuchtet, wenn schon 2 Freispiel-Symbole liegen
        timers.push(setTimeout(() => {
          GK.sound.play('reelStop');
          GK.fx.pulse(els.reels[r], 'reel-bump');
          if (grid[r].includes('S')) GK.sound.play('gem', 0.9 + r * 0.06);
          if (grid[r].includes('B') && [0, 2, 4].includes(r)) GK.sound.play('chip');
          const seen = grid.slice(0, r + 1).flat().filter(x => x === 'S').length;
          if (seen >= 2 && r + 1 < REELS) els.reels[r + 1].classList.add('anticipation');
          els.reels[r].classList.remove('anticipation');
          if (r === REELS - 1) {
            clearInterval(ticking);
            ticking = null;
            show(grid);
            onDone();
          }
        }, stopAt[r]));
      });
    }

    // Gewinnlinien einzeichnen und Gewinnsymbole leuchten lassen
    function showWins(grid, ev) {
      const cells = els.strips.map(strip => [...strip.children]);
      const w = els.window.clientWidth;
      const h = els.window.clientHeight;
      const reelRect = els.reelsBox.getBoundingClientRect();
      const winRect = els.window.getBoundingClientRect();
      const colW = reelRect.width / REELS;
      const rowH = reelRect.height / ROWS;
      const ox = reelRect.left - winRect.left;
      const oy = reelRect.top - winRect.top;
      els.lines.setAttribute('viewBox', `0 0 ${w} ${h}`);
      els.lines.innerHTML = ev.lineWins.map(win => {
        const pts = LINES[win.index].map((row, reel) => `${ox + colW * (reel + 0.5)},${oy + rowH * (row + 0.5)}`).join(' ');
        return `<polyline points="${pts}" stroke="${LINE_COLORS[win.index]}" />`;
      }).join('');
      ev.lineWins.forEach(win => {
        LINES[win.index].slice(0, win.count).forEach((row, reel) => cells[reel][row] && cells[reel][row].classList.add('win'));
      });
      if (ev.scatters >= 3) ev.scatterPos.forEach(([reel, row]) => cells[reel][row].classList.add('win', 'feature'));
      if (ev.bonus) ev.bonusPos.forEach(([reel, row]) => cells[reel][row].classList.add('win', 'feature'));
    }

    // ---------- Ablauf ----------

    function spin() {
      const s = state();
      if (busy || s.pending || s.bonus) return;
      const freeMode = s.free && s.free.left > 0;
      if (s.free && !freeMode) return;
      if (freeMode && !s.free.started) return;
      let bet = s.bet;
      if (freeMode) {
        bet = s.free.bet;
        s.free.left--;
      } else if (!GK.casino.bet(bet)) {
        autoLeft = 0;
        GK.sound.play('denied');
        showMessage('Nicht genug Dublonen für diesen Einsatz.', 'loss');
        updateUi();
        return;
      }
      const stops = randomStops();
      s.pending = { bet, stops, free: !!freeMode };
      s.stops = stops;
      GK.save();
      busy = true;
      els.win.innerHTML = '&nbsp;';
      updateUi();
      animate(windowAt(stops), () => settle(true));
    }

    // Drehung abrechnen. animated = nach der Animation (sonst nach dem Neuladen)
    function settle(animated) {
      const s = state();
      const p = s.pending;
      busy = false;
      if (!p) return;
      s.pending = null;
      const grid = windowAt(p.stops);
      const ev = evaluate(theme, grid, p.bet, p.free ? theme.freeMult : 1);
      GK.casino.payout(ev.total);
      if (p.free) s.free.won += ev.total;
      else GK.casino.record(theme.id, p.bet, ev.total, winText(ev));
      if (ev.total >= p.bet * 100) GK.unlockAchievement('vsBigWin');
      // Freispiele (auch neu ausgelöst während der Freispiele)
      let newFree = false;
      if (ev.freeSpins) {
        GK.unlockAchievement('vsFree');
        if (s.free) {
          s.free.left += ev.freeSpins;
          s.free.total += ev.freeSpins;
        } else {
          s.free = { left: ev.freeSpins, total: ev.freeSpins, bet: p.bet, won: 0, started: false };
        }
        newFree = true;
      }
      if (ev.bonus) {
        GK.unlockAchievement('vsBonus');
        s.bonus = { bet: p.bet, values: GK.rng.shuffle(BONUS_VALUES.slice()), picks: [] };
      }
      GK.save();

      if (animated) {
        showWins(grid, ev);
        if (ev.total > 0) {
          els.win.innerHTML = `${winText(ev)} – Gewinn: ${GK.formatMoneyHTML(ev.total)}`;
          GK.fx.pulse(els.win, 'vs-win-pop');
          if (ev.total >= p.bet * 5 || !p.free) GK.fx.celebrate(ev.total, p.bet, { el: els.window, subtitle: theme.name, quiet: true });
        } else {
          els.win.innerHTML = '&nbsp;';
        }
        if (ev.total >= p.bet * 30 || ev.freeSpins || ev.bonus) autoLeft = 0;
      }
      afterSpin(animated, newFree);
    }

    // Was kommt als Nächstes? Bonus, Freispiel-Start, nächstes Freispiel, Ende der Freispiele, Automatik
    function afterSpin(animated, newFree) {
      const s = state();
      const delay = animated ? 1100 : 0;
      if (s.bonus) {
        timers.push(setTimeout(showBonus, delay));
      } else if (s.free && newFree && (!s.free.started || animated)) {
        timers.push(setTimeout(() => showFreeStart(!s.free.started ? 'start' : 'more'), delay));
      } else if (s.free && s.free.left > 0) {
        if (s.free.started && animated) timers.push(setTimeout(spin, 900));
        else if (!animated) showFreeStart('resume');
      } else if (s.free && s.free.left === 0) {
        timers.push(setTimeout(endFree, delay));
      } else if (autoLeft > 0 && animated) {
        autoLeft--;
        timers.push(setTimeout(spin, 650));
      }
      updateUi();
    }

    function endFree() {
      const s = state();
      const f = s.free;
      if (!f || f.left > 0 || s.bonus || busy) return;
      s.free = null;
      GK.casino.record(theme.id, 0, f.won, `Freispiele: ${f.total} Spiele`);
      GK.save();
      overlay(`
        <div class="vs-ov-title">Freispiele vorbei!</div>
        <div class="vs-ov-big">${GK.formatMoneyHTML(f.won)}</div>
        <div>aus ${f.total} Freispielen</div>
        <button class="btn btn-primary btn-big vs-ov-btn">Weiter</button>`, () => closeOverlay());
      if (f.won > 0) GK.fx.celebrate(f.won, f.bet, { el: els.window, subtitle: 'Freispiele' });
      updateUi();
    }

    function showFreeStart(kind) {
      const f = state().free;
      if (!f) return;
      GK.sound.play('bonus');
      const title = kind === 'more' ? `+ Weitere Freispiele!` : kind === 'resume' ? 'Deine Freispiele warten' : `${f.total} FREISPIELE!`;
      overlay(`
        <div class="vs-ov-title">${title}</div>
        <div class="vs-ov-big">${theme.symbols.S.icon} ×${theme.freeMult}</div>
        <div>${f.left} Freispiele · alle Gewinne ×${theme.freeMult}</div>
        <button class="btn btn-primary btn-big vs-ov-btn">${kind === 'resume' ? 'Weiterspielen' : 'Los geht’s!'}</button>`, () => {
        closeOverlay();
        state().free.started = true;
        GK.save();
        updateUi();
        spin();
      });
      if (kind !== 'resume') {
        GK.fx.confetti(80);
        const pos = GK.fx.center(els.window);
        GK.fx.burst(pos.x, pos.y, { count: 30, kind: 'sparkle', speed: 600 });
      }
    }

    // ---------- Bonusrunde ----------

    function showBonus() {
      const b = state().bonus;
      if (!b) return;
      GK.sound.play('bonus');
      const done = b.picks.length >= BONUS_PICKS;
      overlay(`
        <div class="vs-ov-title">⭐ BONUS: ${theme.bonus.title} ⭐</div>
        <div class="vs-ov-text">${theme.bonus.text} <span class="vs-bonus-sum"></span></div>
        <div class="vs-chests">
          ${b.values.map((v, i) => `<button class="vs-chest" data-i="${i}">${theme.bonus.chest}</button>`).join('')}
        </div>
        <button class="btn btn-primary btn-big vs-ov-btn" ${done ? '' : 'hidden'}>Einsammeln</button>`, () => {
        closeOverlay();
        continueAfterBonus();
      });
      els.overlay.querySelector('.vs-chests').addEventListener('click', e => {
        const chest = e.target.closest('.vs-chest');
        if (chest) pickChest(Number(chest.dataset.i));
      });
      renderChests();
    }

    // Nach der Bonusrunde: neue Freispiele starten, laufende fortsetzen oder beenden
    function continueAfterBonus() {
      const f = state().free;
      if (f && !f.started) showFreeStart('start');
      else if (f && f.left > 0) spin();
      else if (f) endFree();
      updateUi();
    }

    function pickChest(i) {
      const s = state();
      const b = s.bonus;
      if (!b || b.picks.includes(i) || b.picks.length >= BONUS_PICKS) return;
      b.picks.push(i);
      GK.sound.play('gem', 0.8 + b.picks.length * 0.15);
      if (b.picks.length >= BONUS_PICKS) {
        const mult = b.picks.reduce((sum, k) => sum + b.values[k], 0);
        const payout = Math.floor(b.bet * mult);
        GK.casino.payout(payout);
        GK.casino.record(theme.id, 0, payout, `Bonus: ${theme.bonus.title} ×${mult}`);
        s.bonus = null;
        GK.save();
        renderChests(b);
        els.overlay.querySelector('.vs-ov-btn').hidden = false;
        GK.fx.celebrate(payout, b.bet, { el: els.window, subtitle: `${theme.bonus.title} ×${mult}` });
      } else {
        GK.save();
        renderChests();
      }
      const chest = els.overlay.querySelector(`.vs-chest[data-i="${i}"]`);
      if (chest) {
        const pos = GK.fx.center(chest);
        GK.fx.burst(pos.x, pos.y, { count: 12, kind: 'sparkle', speed: 350 });
      }
    }

    // finished: abgeschlossene Bonusrunde (alle Kisten zeigen)
    function renderChests(finished) {
      const b = finished || state().bonus;
      if (!b || !els.overlay.querySelector('.vs-chests')) return;
      els.overlay.querySelectorAll('.vs-chest').forEach(chest => {
        const i = Number(chest.dataset.i);
        const picked = b.picks.includes(i);
        chest.classList.toggle('open', picked);
        chest.classList.toggle('missed', !!finished && !picked);
        chest.disabled = picked || !!finished;
        chest.innerHTML = picked || finished
          ? `<span>${theme.bonus.open}</span><b>×${b.values[i]}</b>`
          : theme.bonus.chest;
      });
      const sum = b.picks.reduce((s, k) => s + b.values[k], 0);
      els.overlay.querySelector('.vs-bonus-sum').innerHTML = b.picks.length
        ? `Bisher: <b>×${sum}</b> = ${GK.formatMoneyHTML(Math.floor(b.bet * sum))}` : '';
    }

    // ---------- Darstellung ----------

    function winText(ev) {
      const parts = [];
      if (ev.lineWins.length) parts.push(`${ev.lineWins.length} ${ev.lineWins.length === 1 ? 'Linie' : 'Linien'}`);
      if (ev.scatters >= 3) parts.push(`${ev.scatters}× ${theme.symbols.S.icon}`);
      if (ev.bonus) parts.push('Bonus');
      return parts.join(' · ') || 'Kein Gewinn';
    }

    function overlay(html, onButton) {
      els.overlay.innerHTML = `<div class="vs-ov-box">${html}</div>`;
      els.overlay.hidden = false;
      const btn = els.overlay.querySelector('.vs-ov-btn');
      if (btn) btn.addEventListener('click', onButton);
    }

    function closeOverlay() {
      els.overlay.hidden = true;
      els.overlay.innerHTML = '';
    }

    function showMessage(html, cls) {
      els.win.className = 'vs-win ' + (cls || '');
      els.win.innerHTML = html;
    }

    function updateUi() {
      const s = state();
      const freeMode = !!s.free;
      els.machine.classList.toggle('free-mode', freeMode);
      els.status.innerHTML = freeMode
        ? `🎉 Freispiele: <b>${s.free.total - s.free.left}/${s.free.total}</b> · ×${theme.freeMult} · Gewinn <b>${GK.formatMoneyHTML(s.free.won)}</b>`
        : '';
      const locked = busy || freeMode || !!s.bonus || !!s.pending;
      els.spin.disabled = locked;
      els.auto.disabled = (busy && autoLeft === 0) || freeMode || !!s.bonus;
      els.auto.textContent = autoLeft > 0 ? `Stopp (${autoLeft})` : `Auto ×${AUTO_SPINS}`;
      betControl.setDisabled(locked || autoLeft > 0);
      renderPaytable();
    }

    function renderPaytable() {
      const lineBet = state().bet / LINES.length;
      const html = Object.keys(PAYS).map(id => `
        <div class="vs-pay-row">${cellHtml(id, 'mini')}
          <span>${PAYS[id].map((m, k) => `${k + 3}× <b>${GK.formatNumber(Math.floor(m * lineBet))}</b>`).join(' · ')}</span>
        </div>`).join('');
      if (els.pays._html !== html) {
        els.pays._html = html;
        els.pays.innerHTML = html;
      }
    }

    function init(body) {
      body.innerHTML = `
        <div class="vs-layout">
          <div class="vs-machine ${theme.cls}">
            <div class="vs-top">
              <div class="vs-title">${theme.emoji} ${theme.name}</div>
              <div class="vs-status"></div>
            </div>
            <div class="vs-front">
              <div class="vs-window">
                <div class="vs-reels">${Array.from({ length: REELS }, () => '<div class="vs-reel"><div class="vs-strip"></div></div>').join('')}</div>
                <svg class="vs-lines" preserveAspectRatio="none"></svg>
                <div class="vs-overlay" hidden></div>
              </div>
            </div>
            <div class="vs-win">Zieh am Hebel!</div>
            <div class="vs-bet"></div>
            <div class="game-actions">
              <button class="btn vs-auto"></button>
            </div>
          </div>
          <div class="paytable vs-paytable">
            <h3>Gewinne bei deinem Einsatz</h3>
            <div class="vs-pays"></div>
            <p class="small">${cellHtml('W', 'mini')} ersetzt alle Symbole außer ${theme.symbols.S.icon} und ${theme.symbols.B.icon}.</p>
            <p class="small">3, 4 oder 5 × ${theme.symbols.S.icon} irgendwo: <b>${theme.freeSpins[3]}, ${theme.freeSpins[4]} oder ${theme.freeSpins[5]} Freispiele</b>
              mit allen Gewinnen ×${theme.freeMult}.</p>
            <p class="small">${theme.symbols.B.icon} auf Walze 1, 3 und 5: <b>Bonusrunde</b> – ${theme.bonus.text}</p>
            <p class="muted small">20 Gewinnlinien, gezählt von links. Beträge in Dublonen.</p>
          </div>
        </div>`;
      els = {
        machine: body.querySelector('.vs-machine'),
        window: body.querySelector('.vs-window'),
        reelsBox: body.querySelector('.vs-reels'),
        reels: [...body.querySelectorAll('.vs-reel')],
        strips: [...body.querySelectorAll('.vs-strip')],
        lines: body.querySelector('.vs-lines'),
        overlay: body.querySelector('.vs-overlay'),
        status: body.querySelector('.vs-status'),
        win: body.querySelector('.vs-win'),
        spin: GK.slotMachine.createLever({ onPull: spin, className: 'vs-spin' }),
        auto: body.querySelector('.vs-auto'),
        pays: body.querySelector('.vs-pays'),
      };
      body.querySelector('.vs-front').appendChild(els.spin);
      betControl = GK.casino.createBetControl(body.querySelector('.vs-bet'), {
        min: MIN_BET,
        get: () => state().bet,
        set: v => { state().bet = v; },
      });
      els.auto.addEventListener('click', () => {
        if (autoLeft > 0) {
          autoLeft = 0;
          updateUi();
          return;
        }
        autoLeft = AUTO_SPINS - 1;
        spin();
      });
      refresh();
    }

    function refresh() {
      timers.forEach(clearTimeout);
      timers = [];
      busy = false;
      autoLeft = 0;
      closeOverlay();
      const s = state();
      show(windowAt(s.stops));
      // Beim Neuladen unterbrochene Drehung sofort abrechnen, dann offene Freispiele/Bonus anbieten
      if (s.pending) settle(false);
      else afterSpin(false, false);
      updateUi();
    }

    return {
      id: theme.id,
      category: 'slots',
      name: theme.name,
      emoji: theme.emoji,
      desc: theme.desc,
      init,
      refresh,
      onHide: () => { autoLeft = 0; },
      render: () => {
        betControl.refresh();
        renderPaytable();
      },
    };
  }

  THEMES.forEach(theme => {
    if (GK.casino.register) GK.casino.register(createMachine(theme));
  });

  GK.videoSlots = { THEMES, LINES, PAYS, STRIPS, REEL_COUNTS, BONUS_VALUES, BONUS_PICKS, windowAt, randomStops, evalLine, evaluate, rtp };
})();
