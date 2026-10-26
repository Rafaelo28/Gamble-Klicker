// Münzfall: Eine Münze fällt durch ein Brett voller Nägel und landet in einem Gewinnfach.
// An jedem Nagel springt sie zufällig nach links oder rechts. Die Fächer am Rand zahlen am meisten.
// Jede Münze steht beim Werfen fest und wird gespeichert – Neuladen zahlt trotzdem aus.
window.GK = window.GK || {};

(function () {
  const MIN_BET = 10;
  const ROWS = 12;
  const MAX_BALLS = 15;
  const AUTO_COUNT = 10;
  // Rückzahlung je Fach (inklusive Einsatz), von links nach rechts
  const RISKS = {
    low:    { name: 'Wenig Risiko', mults: [10, 3, 1.6, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 1.6, 3, 10] },
    medium: { name: 'Mittel',       mults: [33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33] },
    high:   { name: 'Viel Risiko',  mults: [170, 24, 8.1, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8.1, 24, 170] },
  };

  // Spielfeld in logischen Einheiten (der Canvas wird für scharfe Darstellung größer angelegt)
  const W = 640;
  const H = 618;
  const SCALE = 1.5;
  const SPACING = W / (ROWS + 3);
  const TOP = 60;
  const ROW_H = 40;
  const PEG_R = 5;
  const BALL_R = 9;
  const BIN_Y = TOP + ROWS * ROW_H + 18;
  const BIN_H = 44;
  const STEP_MS = 115;

  let els = {};
  let betControl;
  let ctx;
  let balls = [];          // fallende Münzen: { id, bits, start, bin, ... }
  let litPegs = new Map(); // "reihe:nagel" → Zeitpunkt, bis zu dem der Nagel leuchtet
  let binBounce = new Map();
  let running = false;
  let autoLeft = 0;
  let autoTimer = null;
  let nextId = 1;

  function state() {
    return GK.casino.data('plinko', () => ({ bet: 100, risk: 'low', pending: [] }));
  }

  // ---------- Mathematik (auch für Tests) ----------

  function binomial(n, k) {
    let r = 1;
    for (let i = 1; i <= k; i++) r = r * (n - k + i) / i;
    return r;
  }

  function rtp(risk) {
    const mults = RISKS[risk].mults;
    return mults.reduce((sum, m, k) => sum + m * binomial(ROWS, k) / 2 ** ROWS, 0);
  }

  // ---------- Ablauf ----------

  function drop() {
    const s = state();
    if (s.pending.length >= MAX_BALLS) return false;
    if (!GK.casino.bet(s.bet)) {
      autoLeft = 0;
      GK.sound.play('denied');
      showMessage('Nicht genug Dublonen für diesen Einsatz.', 'loss');
      updateButtons();
      return false;
    }
    const bits = Array.from({ length: ROWS }, () => GK.rng.int(2));
    const bin = bits.reduce((a, b) => a + b, 0);
    const mult = RISKS[s.risk].mults[bin];
    const ball = { id: nextId++, bet: s.bet, risk: s.risk, bits, bin, mult, payout: Math.floor(s.bet * mult) };
    s.pending.push(ball);
    GK.save();
    balls.push(Object.assign({ start: performance.now() }, ball));
    GK.sound.play('coin');
    startLoop();
    updateButtons();
    return true;
  }

  function startAuto() {
    if (autoLeft > 0) {
      autoLeft = 0;
      clearTimeout(autoTimer);
      updateButtons();
      return;
    }
    autoLeft = AUTO_COUNT;
    autoStep();
  }

  function autoStep() {
    if (autoLeft <= 0) return;
    if (!els.canvas.isConnected || els.canvas.offsetParent === null) {
      autoLeft = 0;
      updateButtons();
      return;
    }
    if (drop()) autoLeft--;
    else if (state().pending.length < MAX_BALLS) autoLeft = 0;
    updateButtons();
    if (autoLeft > 0) autoTimer = setTimeout(autoStep, 260);
  }

  // Münze ist unten angekommen (animated = false nach dem Neuladen)
  function settle(ball, animated) {
    const s = state();
    const index = s.pending.findIndex(p => p.id === ball.id);
    if (index === -1) return;
    s.pending.splice(index, 1);
    GK.casino.payout(ball.payout);
    if (ball.mult >= 24) GK.unlockAchievement('plinkoEdge');
    const multText = `${String(ball.mult).replace('.', ',')}×`;
    GK.casino.record('plinko', ball.bet, ball.payout, `Fach ${multText}`);
    if (!animated) return;
    binBounce.set(ball.bin, performance.now());
    const pos = binScreenPos(ball.bin);
    if (ball.mult >= 5) {
      GK.fx.celebrate(ball.payout, ball.bet, { el: null, subtitle: `Fach ${multText}`, level: ball.mult >= 100 ? 'jackpot' : undefined });
      GK.fx.burst(pos.x, pos.y, { count: 20, speed: 600, upward: true });
    } else if (ball.payout > ball.bet) {
      GK.sound.play('winSmall');
      GK.fx.floatText(pos.x, pos.y - 30, '+' + GK.formatMoneyHTML(ball.payout - ball.bet), 'win');
    } else if (ball.payout === ball.bet) {
      GK.sound.play('coin');
    } else {
      GK.sound.play('tick');
    }
    showMessage(ball.payout > ball.bet
      ? `${multText} – Gewinn: ${GK.formatMoneyHTML(ball.payout)}`
      : ball.payout > 0 ? `${multText} – ${GK.formatMoneyHTML(ball.payout)} zurück` : `${multText}`, ball.payout > ball.bet ? 'win' : '');
    updateButtons();
  }

  // ---------- Darstellung ----------

  const pegX = (row, j) => W / 2 + (j - (row + 2) / 2) * SPACING;
  const rowY = row => TOP + row * ROW_H;
  const binX = bin => W / 2 + (bin - ROWS / 2) * SPACING;

  function binScreenPos(bin) {
    const r = els.canvas.getBoundingClientRect();
    return { x: r.left + binX(bin) / W * r.width, y: r.top + (BIN_Y + BIN_H / 2) / H * r.height };
  }

  // Position einer Münze zum Zeitpunkt `now` – oder null, wenn sie unten angekommen ist
  function ballPosition(ball, now) {
    const t = now - ball.start;
    const fallTime = 160;
    if (t < fallTime) {
      const k = t / fallTime;
      return { x: W / 2, y: 10 + (rowY(0) - PEG_R - BALL_R - 10) * k * k, step: -1 };
    }
    const step = Math.floor((t - fallTime) / STEP_MS);
    const k = ((t - fallTime) % STEP_MS) / STEP_MS;
    if (step >= ROWS) return null;
    const rights = ball.bits.slice(0, step).reduce((a, b) => a + b, 0);
    const x0 = W / 2 + (rights - step / 2) * SPACING;
    const y0 = rowY(step) - PEG_R - BALL_R;
    const x1 = x0 + (ball.bits[step] ? 0.5 : -0.5) * SPACING;
    const y1 = step + 1 < ROWS ? rowY(step + 1) - PEG_R - BALL_R : BIN_Y + 6;
    const hop = step + 1 < ROWS ? ROW_H * 0.45 : 6;
    return { x: x0 + (x1 - x0) * k, y: y0 + (y1 - y0) * k - hop * 4 * k * (1 - k), step, peg: rights + 1 };
  }

  function startLoop() {
    if (running) return;
    running = true;
    requestAnimationFrame(frame);
  }

  function frame(now) {
    // Neue Nagel-Treffer: leuchten lassen und klingen
    balls.forEach(ball => {
      const pos = ballPosition(ball, now);
      if (!pos) {
        ball.done = true;
        settle(ball, true);
        return;
      }
      if (pos.step >= 0 && pos.step !== ball.lastStep) {
        ball.lastStep = pos.step;
        litPegs.set(`${pos.step}:${pos.peg}`, now + 160);
        GK.sound.play('plink', 0.8 + pos.step / ROWS * 0.6);
      }
    });
    balls = balls.filter(b => !b.done);
    draw(now);
    const bouncing = [...binBounce.values()].some(t => now - t < 300);
    if (balls.length || bouncing || [...litPegs.values()].some(t => t > now)) {
      requestAnimationFrame(frame);
    } else {
      running = false;
      draw(now);
    }
  }

  function binColor(mult) {
    if (mult >= 10) return ['#ff4d4d', '#b3001b'];
    if (mult >= 3) return ['#ff8a3c', '#c0560e'];
    if (mult >= 1.5) return ['#ffc94d', '#c79100'];
    if (mult >= 1) return ['#9be15d', '#4c9a2a'];
    return ['#7fa7c9', '#3b5f80'];
  }

  function draw(now = performance.now()) {
    if (!ctx) return;
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.clearRect(0, 0, W, H);
    // Nägel
    for (let row = 0; row < ROWS; row++) {
      for (let j = 0; j < row + 3; j++) {
        const lit = (litPegs.get(`${row}:${j}`) || 0) > now;
        ctx.beginPath();
        ctx.arc(pegX(row, j), rowY(row), lit ? PEG_R + 2 : PEG_R, 0, Math.PI * 2);
        ctx.fillStyle = lit ? '#fff3b0' : '#d7e3dc';
        if (lit) {
          ctx.shadowColor = '#ffd95e';
          ctx.shadowBlur = 14;
        }
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
    // Fächer
    const mults = RISKS[state().risk].mults;
    mults.forEach((m, bin) => {
      const bounce = now - (binBounce.get(bin) || 0);
      const dy = bounce < 300 ? Math.sin(bounce / 300 * Math.PI) * 8 : 0;
      const x = binX(bin) - SPACING / 2 + 2;
      const [c1, c2] = binColor(m);
      const g = ctx.createLinearGradient(0, BIN_Y + dy, 0, BIN_Y + BIN_H + dy);
      g.addColorStop(0, c1);
      g.addColorStop(1, c2);
      ctx.fillStyle = g;
      roundRect(x, BIN_Y + dy, SPACING - 4, BIN_H, 8);
      ctx.fill();
      ctx.fillStyle = '#1d1400';
      ctx.font = `900 ${m >= 100 ? 13 : 15}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${String(m).replace('.', ',')}×`, binX(bin), BIN_Y + BIN_H / 2 + dy);
    });
    // Münzen
    balls.forEach(ball => {
      const pos = ballPosition(ball, now);
      if (!pos) return;
      const g = ctx.createRadialGradient(pos.x - 3, pos.y - 3, 1, pos.x, pos.y, BALL_R);
      g.addColorStop(0, '#fff8d0');
      g.addColorStop(0.5, '#f5c542');
      g.addColorStop(1, '#a87408');
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, BALL_R, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.shadowColor = 'rgba(245, 197, 66, 0.8)';
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;
    });
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function showMessage(html, cls) {
    els.message.className = 'game-message ' + (cls || '');
    els.message.innerHTML = html;
  }

  function updateButtons() {
    const s = state();
    const flying = s.pending.length > 0;
    els.drop.disabled = s.pending.length >= MAX_BALLS || autoLeft > 0;
    els.auto.textContent = autoLeft > 0 ? `Stopp (${autoLeft})` : `Auto ×${AUTO_COUNT}`;
    els.risks.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.risk === s.risk);
      btn.disabled = flying;
    });
    betControl.setDisabled(autoLeft > 0);
  }

  function init(body) {
    body.innerHTML = `
      <div class="plinko-layout">
        <div class="plinko-board">
          <canvas class="plinko-canvas" width="${W * SCALE}" height="${H * SCALE}"></canvas>
        </div>
        <div class="plinko-controls">
          <div class="plinko-risks" role="group" aria-label="Risiko">
            ${Object.entries(RISKS).map(([id, r]) => `<button type="button" class="btn btn-small plinko-risk" data-risk="${id}">${r.name}</button>`).join('')}
          </div>
          <div class="game-message">&nbsp;</div>
          <div class="plinko-bet"></div>
          <div class="game-actions">
            <button class="btn btn-primary btn-big plinko-drop">🪙 Münze werfen</button>
            <button class="btn plinko-auto"></button>
          </div>
          <p class="muted small">Die Münze springt an jedem Nagel nach links oder rechts. Je weiter sie
            nach außen fällt, desto mehr gewinnst du. Du kannst mehrere Münzen gleichzeitig werfen.</p>
        </div>
      </div>`;
    els = {
      canvas: body.querySelector('.plinko-canvas'),
      message: body.querySelector('.game-message'),
      drop: body.querySelector('.plinko-drop'),
      auto: body.querySelector('.plinko-auto'),
      risks: [...body.querySelectorAll('.plinko-risk')],
    };
    ctx = els.canvas.getContext('2d');
    betControl = GK.casino.createBetControl(body.querySelector('.plinko-bet'), {
      min: MIN_BET,
      get: () => state().bet,
      set: v => { state().bet = v; },
    });
    els.drop.addEventListener('click', () => drop());
    els.auto.addEventListener('click', startAuto);
    els.risks.forEach(btn => btn.addEventListener('click', () => {
      if (state().pending.length) return;
      state().risk = btn.dataset.risk;
      GK.sound.play('chip');
      GK.save();
      draw();
      updateButtons();
    }));
    refresh();
  }

  function refresh() {
    // Münzen, die beim Neuladen noch unterwegs waren, sofort auszahlen
    balls = [];
    autoLeft = 0;
    clearTimeout(autoTimer);
    state().pending.slice().forEach(ball => settle(ball, false));
    showMessage('Wirf eine Münze!', '');
    draw();
    updateButtons();
  }

  GK.casino.register({
    id: 'plinko',
    category: 'quick',
    name: 'Münzfall',
    emoji: '🪙',
    desc: 'Lass die Münze durch die Nägel fallen – außen warten bis zu ×170!',
    init,
    refresh,
    onHide: () => {
      autoLeft = 0;
      clearTimeout(autoTimer);
    },
    render: () => betControl.refresh(),
  });

  // Für Tests
  GK.casino.plinkoMath = { RISKS, ROWS, rtp };
})();
