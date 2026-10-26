// Europäisches Roulette (0–36) mit Wett-Tisch und drehendem Kessel.
window.GK = window.GK || {};

(function () {
  const MIN_CHIP = 10;
  const SPIN_TIME = 4000; // ms
  const WHEEL_ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
    5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
  const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
  const SEGMENT = 360 / WHEEL_ORDER.length;

  // Außen-Wetten: Name, Rückzahlung (inklusive Einsatz) und Gewinnbedingung
  const OUTSIDE_BETS = {
    red:   { label: 'Rot',      mult: 2, wins: n => RED.has(n) },
    black: { label: 'Schwarz',  mult: 2, wins: n => n !== 0 && !RED.has(n) },
    even:  { label: 'Gerade',   mult: 2, wins: n => n !== 0 && n % 2 === 0 },
    odd:   { label: 'Ungerade', mult: 2, wins: n => n % 2 === 1 },
    low:   { label: '1–18',     mult: 2, wins: n => n >= 1 && n <= 18 },
    high:  { label: '19–36',    mult: 2, wins: n => n >= 19 },
    d1:    { label: '1–12',     mult: 3, wins: n => n >= 1 && n <= 12 },
    d2:    { label: '13–24',    mult: 3, wins: n => n >= 13 && n <= 24 },
    d3:    { label: '25–36',    mult: 3, wins: n => n >= 25 },
    c1:    { label: '2:1',      mult: 3, wins: n => n % 3 === 1 },
    c2:    { label: '2:1',      mult: 3, wins: n => n % 3 === 2 },
    c3:    { label: '2:1',      mult: 3, wins: n => n !== 0 && n % 3 === 0 },
  };

  let els = {};
  let chipControl;
  let spinning = false;
  let wheelAngle = 0;
  let ballAngle = 0;

  function state() {
    return GK.casino.data('roulette', () => ({ chip: 100, bets: {}, lastBets: {}, results: [], pending: null }));
  }

  function betInfo(key) {
    if (key.startsWith('n')) {
      const n = Number(key.slice(1));
      return { label: String(n), mult: 36, wins: r => r === n };
    }
    return OUTSIDE_BETS[key];
  }

  function colorOf(n) {
    return n === 0 ? 'green' : RED.has(n) ? 'red' : 'black';
  }

  function totalBets(bets) {
    return Object.values(bets).reduce((sum, v) => sum + v, 0);
  }

  // ---------- Aktionen ----------

  function placeBet(key, amount) {
    if (spinning) return false;
    if (totalBets(state().bets) + amount > GK.casino.maxBet()) {
      showMessage(`Dein Limit sind ${GK.formatNumber(GK.casino.maxBet())} Dublonen pro Drehung – eine bessere VIP-Karte erhöht es.`, 'loss');
      return false;
    }
    if (!GK.casino.bet(amount)) {
      showMessage('Nicht genug Dublonen für diesen Chip.', 'loss');
      return false;
    }
    const bets = state().bets;
    bets[key] = (bets[key] || 0) + amount;
    GK.save();
    GK.sound.play('chip');
    drawBets(undefined, key);
    return true;
  }

  function clearBets() {
    if (spinning) return;
    const s = state();
    GK.casino.refund(totalBets(s.bets));
    s.bets = {};
    GK.save();
    drawBets();
  }

  function repeatBets() {
    const last = state().lastBets;
    if (totalBets(state().bets) + totalBets(last) > GK.casino.maxBet()) {
      showMessage('Das würde dein Einsatz-Limit pro Drehung überschreiten.', 'loss');
      return;
    }
    if (!GK.canAfford(totalBets(last))) {
      showMessage('Nicht genug Dublonen, um die letzten Wetten zu wiederholen.', 'loss');
      return;
    }
    Object.entries(last).forEach(([key, amount]) => placeBet(key, amount));
  }

  function spin() {
    const s = state();
    if (spinning) return;
    if (!totalBets(s.bets)) {
      showMessage('Setze zuerst Chips auf den Tisch.', '');
      return;
    }
    const result = GK.rng.int(37);
    let payout = 0;
    Object.entries(s.bets).forEach(([key, amount]) => {
      if (betInfo(key).wins(result)) payout += amount * betInfo(key).mult;
    });
    // Ergebnis sofort speichern, ausgezahlt wird nach der Animation (oder beim Neuladen)
    s.pending = { result, payout, bet: totalBets(s.bets), bets: s.bets };
    s.lastBets = s.bets;
    s.bets = {};
    GK.save();

    spinning = true;
    updateButtons();
    showMessage('Rien ne va plus – nichts geht mehr!', '');
    drawBets();
    spinWheelTo(result, true);
    GK.sound.play('rouletteSpin', SPIN_TIME / 1000);
    setTimeout(() => settle(true), SPIN_TIME);
  }

  // animated = nach einer Drehung (sonst: nach dem Neuladen)
  function settle(animated) {
    const s = state();
    const p = s.pending;
    spinning = false;
    if (!p) {
      updateButtons();
      return;
    }
    s.pending = null;
    s.results.unshift(p.result);
    s.results.length = Math.min(s.results.length, 15);
    GK.casino.payout(p.payout);
    Object.keys(p.bets || {}).forEach(key => {
      if (key.startsWith('n') && betInfo(key).wins(p.result)) {
        GK.unlockAchievement('rouletteNumber');
        if (p.result === 0) GK.unlockAchievement('rouletteZero');
      }
    });
    const colorName = { green: 'Grün', red: 'Rot', black: 'Schwarz' }[colorOf(p.result)];
    GK.casino.record('roulette', p.bet, p.payout, `${p.result} ${colorName}`);

    const resultHtml = `<span class="roulette-num ${colorOf(p.result)}">${p.result}</span>`;
    if (p.payout > 0) {
      showMessage(`${resultHtml} ${colorName} – Gewinn: ${GK.formatMoneyHTML(p.payout)}`, 'win');
    } else {
      showMessage(`${resultHtml} ${colorName} – leider verloren.`, 'loss');
    }
    drawBets(p.result);
    drawResults();
    updateButtons();
    if (animated) {
      GK.fx.pulse(els.results.firstElementChild, 'result-pop');
      GK.fx.celebrate(p.payout, p.bet, { el: els.wheel, subtitle: `${p.result} ${colorName}` });
    }
  }

  // ---------- Darstellung ----------

  function spinWheelTo(number, animated) {
    const index = WHEEL_ORDER.indexOf(number);
    const target = 360 - (index * SEGMENT + SEGMENT / 2);
    // Mindestens 5 volle Umdrehungen weiter als jetzt
    const base = Math.ceil(wheelAngle / 360) * 360 + (animated ? 360 * 5 : 0);
    wheelAngle = base + target;
    els.wheel.style.transition = animated ? `transform ${SPIN_TIME}ms cubic-bezier(0.15, 0.6, 0.2, 1)` : 'none';
    els.wheel.style.transform = `rotate(${wheelAngle}deg)`;

    // Die Kugel läuft gegen die Drehrichtung und landet oben unter dem Zeiger – in der Gewinnzahl
    const fast = GK.state.settings.effects === 'reduced';
    ballAngle -= animated ? 360 * (fast ? 1 : 4) : 0;
    els.ballTrack.style.transition = animated ? `transform ${SPIN_TIME}ms cubic-bezier(0.1, 0.5, 0.25, 1)` : 'none';
    els.ballTrack.style.transform = `rotate(${ballAngle}deg)`;
    els.ball.classList.remove('dropped');
    if (animated) {
      void els.ball.offsetWidth;
      els.ball.classList.add('rolling');
      setTimeout(() => {
        els.ball.classList.remove('rolling');
        els.ball.classList.add('dropped');
      }, SPIN_TIME * 0.72);
    } else {
      els.ball.classList.add('dropped');
    }
  }

  function buildWheel() {
    const colors = { green: '#1e8449', red: '#b03a2e', black: '#1c1c1c' };
    const stops = WHEEL_ORDER.map((n, i) =>
      `${colors[colorOf(n)]} ${i * SEGMENT}deg ${(i + 1) * SEGMENT}deg`).join(', ');
    els.wheel.style.background = `conic-gradient(${stops})`;
    els.wheel.innerHTML = WHEEL_ORDER.map((n, i) =>
      `<span class="wheel-num" style="transform: rotate(${i * SEGMENT + SEGMENT / 2}deg)"><span>${n}</span></span>`
    ).join('') + '<div class="wheel-center"></div>';
  }

  function buildBoard() {
    let html = '<button class="rb-cell green" data-bet="n0" style="grid-row: 1 / 4; grid-column: 1">0</button>';
    for (let n = 1; n <= 36; n++) {
      const col = Math.ceil(n / 3) + 1;
      const row = 3 - ((n - 1) % 3);
      html += `<button class="rb-cell ${colorOf(n)}" data-bet="n${n}" style="grid-row: ${row}; grid-column: ${col}">${n}</button>`;
    }
    html += `
      <button class="rb-cell outside" data-bet="c3" style="grid-row: 1; grid-column: 14">2:1</button>
      <button class="rb-cell outside" data-bet="c2" style="grid-row: 2; grid-column: 14">2:1</button>
      <button class="rb-cell outside" data-bet="c1" style="grid-row: 3; grid-column: 14">2:1</button>
      <button class="rb-cell outside" data-bet="d1" style="grid-row: 4; grid-column: 2 / 6">1–12</button>
      <button class="rb-cell outside" data-bet="d2" style="grid-row: 4; grid-column: 6 / 10">13–24</button>
      <button class="rb-cell outside" data-bet="d3" style="grid-row: 4; grid-column: 10 / 14">25–36</button>
      <button class="rb-cell outside" data-bet="low" style="grid-row: 5; grid-column: 2 / 4">1–18</button>
      <button class="rb-cell outside" data-bet="even" style="grid-row: 5; grid-column: 4 / 6">Gerade</button>
      <button class="rb-cell outside red" data-bet="red" style="grid-row: 5; grid-column: 6 / 8">Rot</button>
      <button class="rb-cell outside black" data-bet="black" style="grid-row: 5; grid-column: 8 / 10">Schwarz</button>
      <button class="rb-cell outside" data-bet="odd" style="grid-row: 5; grid-column: 10 / 12">Ungerade</button>
      <button class="rb-cell outside" data-bet="high" style="grid-row: 5; grid-column: 12 / 14">19–36</button>`;
    els.board.innerHTML = html;
    els.board.querySelectorAll('.rb-cell').forEach(cell => {
      cell.addEventListener('click', () => placeBet(cell.dataset.bet, state().chip));
    });
  }

  function shortNumber(n) {
    if (n >= 1e9) return Math.floor(n / 1e9) + 'Mrd';
    if (n >= 1e6) return Math.floor(n / 1e6) + 'M';
    if (n >= 1e3) return Math.floor(n / 1e3) + 'k';
    return String(n);
  }

  // Chips auf dem Tisch anzeigen; winner = zuletzt gefallene Zahl hervorheben, placed = gerade gesetzt
  function drawBets(winner, placed) {
    // Während die Kugel rollt, liegen die gesetzten Chips noch auf dem Tisch
    const s = state();
    const bets = s.pending ? s.pending.bets : s.bets;
    els.board.querySelectorAll('.rb-cell').forEach(cell => {
      const key = cell.dataset.bet;
      let chip = cell.querySelector('.rb-chip');
      if (bets[key]) {
        if (!chip) {
          chip = document.createElement('span');
          chip.className = 'rb-chip';
          cell.appendChild(chip);
        }
        chip.textContent = shortNumber(bets[key]);
        if (key === placed) GK.fx.pulse(chip, 'chip-drop');
      } else if (chip) {
        chip.remove();
      }
      cell.classList.toggle('winner', winner !== undefined && betInfo(key).wins(winner));
    });
    els.total.innerHTML = 'Gesetzt: ' + GK.formatMoneyHTML(totalBets(bets));
  }

  function drawResults() {
    const results = state().results;
    els.results.innerHTML = results.length
      ? results.map(n => `<span class="roulette-num ${colorOf(n)}">${n}</span>`).join('')
      : '<span class="muted small">Noch keine Zahlen gefallen.</span>';
  }

  function showMessage(html, cls) {
    els.message.className = 'game-message ' + (cls || '');
    els.message.innerHTML = html;
  }

  function updateButtons() {
    els.spin.disabled = spinning;
    els.clear.disabled = spinning;
    els.repeat.disabled = spinning || !totalBets(state().lastBets);
    els.board.classList.toggle('disabled', spinning);
    chipControl.setDisabled(spinning);
  }

  function init(body) {
    body.innerHTML = `
      <div class="roulette-layout">
        <div class="roulette-wheel-area">
          <div class="wheel-pointer">▼</div>
          <div class="wheel-wrap">
            <div class="wheel"></div>
            <div class="ball-track"><div class="ball"></div></div>
          </div>
          <div class="roulette-results"></div>
        </div>
        <div class="roulette-table-area">
          <div class="roulette-board-scroll"><div class="roulette-board"></div></div>
          <div class="roulette-total"></div>
          <div class="game-message">&nbsp;</div>
          <div class="roulette-chip"></div>
          <div class="game-actions">
            <button class="btn btn-primary roulette-spin">🎡 Drehen</button>
            <button class="btn roulette-repeat">↺ Wiederholen</button>
            <button class="btn roulette-clear">✖ Wetten entfernen</button>
          </div>
          <p class="muted small">Klicke auf ein Feld, um einen Chip zu setzen. Zahl: ×36 · Dutzend/Kolonne: ×3 · Rot/Schwarz, Gerade/Ungerade, 1–18/19–36: ×2 (jeweils inklusive Einsatz).</p>
        </div>
      </div>`;
    els = {
      wheel: body.querySelector('.wheel'),
      ballTrack: body.querySelector('.ball-track'),
      ball: body.querySelector('.ball'),
      board: body.querySelector('.roulette-board'),
      total: body.querySelector('.roulette-total'),
      results: body.querySelector('.roulette-results'),
      message: body.querySelector('.game-message'),
      spin: body.querySelector('.roulette-spin'),
      repeat: body.querySelector('.roulette-repeat'),
      clear: body.querySelector('.roulette-clear'),
    };
    chipControl = GK.casino.createBetControl(body.querySelector('.roulette-chip'), {
      label: 'Chip-Wert',
      min: MIN_CHIP,
      get: () => state().chip,
      set: v => { state().chip = v; },
    });
    buildWheel();
    buildBoard();
    els.spin.addEventListener('click', spin);
    els.clear.addEventListener('click', clearBets);
    els.repeat.addEventListener('click', repeatBets);
    refresh();
  }

  function refresh() {
    spinning = false;
    const s = state();
    spinWheelTo(s.pending ? s.pending.result : (s.results[0] || 0), false);
    if (s.pending) settle(false);
    drawBets();
    drawResults();
    updateButtons();
  }

  GK.casino.register({
    id: 'roulette',
    name: 'Roulette',
    emoji: '🎡',
    desc: 'Setze auf Zahlen oder Farben – bis zu ×36.',
    init,
    refresh,
    render: () => chipControl.refresh(),
  });
})();
