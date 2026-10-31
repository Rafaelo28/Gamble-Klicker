// Münzfall: Eine Münze fällt durch ein Brett voller Nägel und landet in einem Gewinnfach.
// An jedem Nagel springt sie zufällig nach links oder rechts. Die Fächer am Rand zahlen am meisten.
// Jede Münze steht beim Werfen fest und wird gespeichert – Neuladen zahlt trotzdem aus.
// Massenwurf: bis zu 5.000 Münzen auf einmal. Ein Wurf ist eine Runde; gespeichert werden nur die
// Treffer je Fach und die Auszahlung (kompakt), die einzelnen Bahnen gibt es nur für die Animation.
window.GK = window.GK || {};

(function () {
  const MIN_BET = 10;
  const ROWS = 12;
  const MAX_BALLS = 15;
  const COUNTS = [1, 10, 100, 1000, 5000];
  // Rückzahlung je Fach (inklusive Einsatz), von links nach rechts
  const RISKS = {
    low:    { name: 'Wenig Risiko', mults: [10, 3, 1.6, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 1.6, 3, 10] },
    medium: { name: 'Mittel',       mults: [33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33] },
    high:   { name: 'Viel Risiko',  mults: [170, 24, 8.1, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8.1, 24, 170] },
  };

  // Spielfeld in logischen Einheiten (der Canvas wird für scharfe Darstellung größer angelegt)
  const W = 640;
  const H = 636;
  const SCALE = 1.5;
  const SPACING = W / (ROWS + 3);
  const TOP = 60;
  const ROW_H = 40;
  const PEG_R = 5;
  const BALL_R = 9;
  const GLOW = 8;          // Schein um die Münze im vorgezeichneten Bild
  const BIN_Y = TOP + ROWS * ROW_H + 18;
  const BIN_H = 44;
  const STEP_MS = 115;
  const FALL_MS = 160;     // vom Einwurf bis zum ersten Nagel
  const COIN_MS = FALL_MS + ROWS * STEP_MS; // so lange ist jede Münze unterwegs

  let els = {};
  let betControl;
  let ctx;
  let balls = [];          // einzelne fallende Münzen: { id, mask, start, bin, ... }
  let litPegs = new Map(); // "reihe:nagel" → Zeitpunkt, bis zu dem der Nagel leuchtet
  let binBounce = new Map();
  let running = false;
  let nextId = 1;
  // Laufender Massenwurf (nur im Speicher): { coins, next, landed, paid, hits, mults, msgAt }
  let mass = null;
  // Treffer je Fach des letzten Massenwurfs – stehen unter den Fächern
  let shownHits = null;
  let coinImage = null;
  const lastSound = {};
  let lastBurst = 0;

  function state() {
    return GK.casino.data('plinko', () => ({ bet: 100, risk: 'low', pending: [], count: 1, mass: null }));
  }

  // Ältere Spielstände kennen die Anzahl noch nicht
  function countOf(s) {
    return COUNTS.includes(s.count) ? s.count : 1;
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

  // Anzahl gesetzter Bits = wie oft die Münze nach rechts gesprungen ist
  function popcount(n) {
    let c = 0;
    while (n) {
      n &= n - 1;
      c++;
    }
    return c;
  }

  // Ergebnis eines Massenwurfs: je Münze 12 zufällige Bits (ein Bit je Nagel), daraus das Fach
  function rollMany(count, bet, risk) {
    const mults = RISKS[risk].mults;
    const hits = new Array(ROWS + 1).fill(0);
    const coins = [];
    let payout = 0;
    let best = 0;
    for (let i = 0; i < count; i++) {
      const mask = GK.rng.int(1 << ROWS);
      const bin = popcount(mask);
      const win = Math.floor(bet * mults[bin]);
      hits[bin]++;
      payout += win;
      best = Math.max(best, mults[bin]);
      coins.push({ mask, bin, win });
    }
    return { coins, hits, payout, best };
  }

  // ---------- Ablauf ----------

  function drop() {
    const s = state();
    if (s.mass || s.pending.length >= MAX_BALLS) return false;
    if (!GK.casino.bet(s.bet)) {
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
    const mask = bits.reduce((m, b, i) => m | (b << i), 0);
    balls.push(Object.assign({ start: performance.now(), mask, dx: 0 }, ball));
    shownHits = null;
    GK.sound.play('coin');
    startLoop();
    updateButtons();
    return true;
  }

  // Wie lange die Münzen eines Massenwurfs nacheinander losfallen (ms)
  function releaseTime(count) {
    return Math.min(6000, 1500 + 1100 * Math.log10(count));
  }

  function throwMany(count) {
    const s = state();
    if (s.mass || s.pending.length) return false;
    const total = s.bet * count;
    if (!GK.casino.bet(total)) {
      GK.sound.play('denied');
      showMessage(`Für ${GK.formatNumber(count)} Münzen brauchst du ${GK.formatMoneyHTML(total)}.`, 'loss');
      updateButtons();
      return false;
    }
    const result = rollMany(count, s.bet, s.risk);
    // Sofort speichern: Neuladen mitten im Wurf zahlt alles aus
    s.mass = { bet: s.bet, risk: s.risk, count, total, hits: result.hits, payout: result.payout, best: result.best };
    GK.save();
    const now = performance.now();
    const spread = releaseTime(count);
    result.coins.forEach((c, i) => {
      // Gleichmäßig nacheinander, leicht durcheinander (nur fürs Auge)
      c.start = now + spread * (i + Math.random()) / count;
      c.dx = (Math.random() - 0.5) * 28;
      c.lastStep = -1;
    });
    mass = { coins: result.coins, next: 0, landed: 0, paid: 0, hits: new Array(ROWS + 1).fill(0), mults: RISKS[s.risk].mults, msgAt: 0 };
    shownHits = mass.hits;
    GK.sound.play('coin');
    startLoop();
    updateButtons();
    return true;
  }

  // Massenwurf abrechnen: am Ende der Animation, beim Überspringen oder nach dem Neuladen
  function finishMass(animated) {
    const s = state();
    const m = s.mass;
    if (!m) return;
    s.mass = null;
    mass = null;
    shownHits = m.hits;
    GK.casino.payout(m.payout);
    if (m.best >= 24) GK.unlockAchievement('plinkoEdge');
    const label = `${GK.formatNumber(m.count)} Münzen`;
    GK.casino.record('plinko', m.total, m.payout, `${label} · bestes Fach ${multText(m.best)}`);
    const net = m.payout - m.total;
    showMessage(net > 0
      ? `${label}: ${GK.formatMoneyHTML(m.payout)} – Gewinn ${GK.formatMoneyHTML(net)}`
      : `${label}: ${GK.formatMoneyHTML(m.payout)} zurück`, net > 0 ? 'win' : '');
    if (animated) {
      // Hat man das Spiel inzwischen verlassen, feiert die Bildschirmmitte
      if (net > 0) GK.fx.celebrate(m.payout, m.total, { el: els.canvas.offsetParent ? els.canvas : null, subtitle: label });
      else GK.sound.play(m.payout > 0 ? 'coin' : 'lose');
    }
    updateButtons();
  }

  // Gleiche Klänge nicht öfter als alle `gap` ms (bei Tausenden Münzen)
  function playLimited(name, gap, ...args) {
    const now = performance.now();
    if (now - (lastSound[name] || 0) < gap) return;
    lastSound[name] = now;
    GK.sound.play(name, ...args);
  }

  // Münze eines Massenwurfs ist unten angekommen (nur Anzeige – ausgezahlt wird am Ende)
  function landMass(c, now) {
    const m = mass;
    m.landed++;
    m.paid += c.win;
    m.hits[c.bin]++;
    binBounce.set(c.bin, now);
    if (m.mults[c.bin] >= 24 && now - lastBurst > 350) {
      lastBurst = now;
      const pos = binScreenPos(c.bin);
      GK.fx.burst(pos.x, pos.y, { count: 10, speed: 500, upward: true });
      playLimited('winSmall', 250);
    } else {
      playLimited('coin', 120);
    }
  }

  function stepMass(now) {
    const m = mass;
    // Alle Münzen sind gleich lange unterwegs – sie landen also in der Reihenfolge, in der sie losfielen
    while (m.next < m.coins.length && now - m.coins[m.next].start >= COIN_MS) landMass(m.coins[m.next++], now);
    let flying = false;
    for (let i = m.next; i < m.coins.length; i++) {
      const c = m.coins[i];
      if (c.start > now) break;
      flying = true;
      const step = Math.floor((now - c.start - FALL_MS) / STEP_MS);
      if (step >= 0 && step !== c.lastStep) {
        c.lastStep = step;
        litPegs.set(`${step}:${popcount(c.mask & ((1 << step) - 1)) + 1}`, now + 160);
      }
    }
    if (flying) playLimited('plink', 70, 0.8 + Math.random() * 0.6);
    if (now - m.msgAt > 150) {
      m.msgAt = now;
      showMessage(`🪙 ${GK.formatNumber(m.landed)} von ${GK.formatNumber(m.coins.length)} gelandet · ${GK.formatMoneyHTML(m.paid)}`, '');
    }
    if (m.next >= m.coins.length) finishMass(true);
  }

  // Münze ist unten angekommen (animated = false nach dem Neuladen)
  function settle(ball, animated) {
    const s = state();
    const index = s.pending.findIndex(p => p.id === ball.id);
    if (index === -1) return;
    s.pending.splice(index, 1);
    GK.casino.payout(ball.payout);
    if (ball.mult >= 24) GK.unlockAchievement('plinkoEdge');
    const mt = multText(ball.mult);
    GK.casino.record('plinko', ball.bet, ball.payout, `Fach ${mt}`);
    if (!animated) return;
    binBounce.set(ball.bin, performance.now());
    const pos = binScreenPos(ball.bin);
    if (ball.mult >= 5) {
      GK.fx.celebrate(ball.payout, ball.bet, { el: null, subtitle: `Fach ${mt}`, level: ball.mult >= 100 ? 'jackpot' : undefined });
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
      ? `${mt} – Gewinn: ${GK.formatMoneyHTML(ball.payout)}`
      : ball.payout > 0 ? `${mt} – ${GK.formatMoneyHTML(ball.payout)} zurück` : `${mt}`, ball.payout > ball.bet ? 'win' : '');
    updateButtons();
  }

  const multText = m => `${String(m).replace('.', ',')}×`;

  // ---------- Darstellung ----------

  const pegX = (row, j) => W / 2 + (j - (row + 2) / 2) * SPACING;
  const rowY = row => TOP + row * ROW_H;
  const binX = bin => W / 2 + (bin - ROWS / 2) * SPACING;

  function binScreenPos(bin) {
    const r = els.canvas.getBoundingClientRect();
    return { x: r.left + binX(bin) / W * r.width, y: r.top + (BIN_Y + BIN_H / 2) / H * r.height };
  }

  // Position einer Münze zum Zeitpunkt `now` – oder null, wenn sie unten angekommen ist.
  // mask: Bit i gesetzt = am Nagel der Reihe i nach rechts; dx: kleiner Versatz beim Einwurf
  function coinPosition(mask, start, dx, now) {
    const t = now - start;
    if (t < FALL_MS) {
      const k = t / FALL_MS;
      return { x: W / 2 + dx * (1 - k), y: 10 + (rowY(0) - PEG_R - BALL_R - 10) * k * k, step: -1 };
    }
    const step = Math.floor((t - FALL_MS) / STEP_MS);
    const k = ((t - FALL_MS) % STEP_MS) / STEP_MS;
    if (step >= ROWS) return null;
    const rights = popcount(mask & ((1 << step) - 1));
    const x0 = W / 2 + (rights - step / 2) * SPACING;
    const y0 = rowY(step) - PEG_R - BALL_R;
    const x1 = x0 + ((mask >> step) & 1 ? 0.5 : -0.5) * SPACING;
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
    // Einzelne Münzen: Nagel-Treffer leuchten lassen und klingen, unten abrechnen
    balls.forEach(ball => {
      const pos = coinPosition(ball.mask, ball.start, 0, now);
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
    if (mass) stepMass(now);
    draw(now);
    const bouncing = [...binBounce.values()].some(t => now - t < 300);
    if (balls.length || mass || bouncing || [...litPegs.values()].some(t => t > now)) {
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

  // Die Münze wird einmal mit Farbverlauf und Schein vorgezeichnet und danach nur noch kopiert –
  // so bleiben auch Tausende Münzen gleichzeitig flüssig
  function coinSprite() {
    if (coinImage) return coinImage;
    const r = BALL_R + GLOW;
    const c = document.createElement('canvas');
    c.width = c.height = Math.ceil(r * 2 * SCALE);
    const g = c.getContext('2d');
    g.scale(SCALE, SCALE);
    g.translate(r, r);
    const grad = g.createRadialGradient(-3, -3, 1, 0, 0, BALL_R);
    grad.addColorStop(0, '#fff8d0');
    grad.addColorStop(0.5, '#f5c542');
    grad.addColorStop(1, '#a87408');
    g.beginPath();
    g.arc(0, 0, BALL_R, 0, Math.PI * 2);
    g.fillStyle = grad;
    g.shadowColor = 'rgba(245, 197, 66, 0.8)';
    g.shadowBlur = 10;
    g.fill();
    coinImage = c;
    return c;
  }

  function drawCoin(x, y, size) {
    const r = (BALL_R + GLOW) * size;
    ctx.drawImage(coinSprite(), x - r, y - r, r * 2, r * 2);
  }

  function draw(now = performance.now()) {
    if (!ctx) return;
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.clearRect(0, 0, W, H);
    // Nägel (leuchtende mit hellem Hof statt shadowBlur – das wäre bei vielen Münzen zu langsam)
    for (let row = 0; row < ROWS; row++) {
      for (let j = 0; j < row + 3; j++) {
        const lit = (litPegs.get(`${row}:${j}`) || 0) > now;
        if (lit) {
          ctx.beginPath();
          ctx.arc(pegX(row, j), rowY(row), PEG_R + 7, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 217, 94, 0.35)';
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(pegX(row, j), rowY(row), lit ? PEG_R + 2 : PEG_R, 0, Math.PI * 2);
        ctx.fillStyle = lit ? '#fff3b0' : '#d7e3dc';
        ctx.fill();
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
      ctx.fillText(multText(m), binX(bin), BIN_Y + BIN_H / 2 + dy);
    });
    // Treffer je Fach beim Massenwurf
    if (shownHits) {
      ctx.font = '700 12px system-ui, sans-serif';
      ctx.fillStyle = '#d7e3dc';
      shownHits.forEach((n, bin) => {
        if (n) ctx.fillText(GK.formatNumber(n), binX(bin), BIN_Y + BIN_H + 14);
      });
    }
    // Münzen des Massenwurfs (etwas kleiner), dann die einzelnen
    if (mass) {
      for (let i = mass.next; i < mass.coins.length; i++) {
        const c = mass.coins[i];
        if (c.start > now) break;
        const pos = coinPosition(c.mask, c.start, c.dx, now);
        if (pos) drawCoin(pos.x, pos.y, 0.75);
      }
    }
    balls.forEach(ball => {
      const pos = coinPosition(ball.mask, ball.start, 0, now);
      if (pos) drawCoin(pos.x, pos.y, 1);
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
    GK.setHTML(els.message, html);
  }

  // Gesamteinsatz bei mehreren Münzen (ändert sich mit dem Einsatz, deshalb auch im Takt)
  function renderTotal() {
    const s = state();
    const count = countOf(s);
    const total = s.bet * count;
    GK.setHTML(els.total, count > 1
      ? `Gesamteinsatz: <b>${GK.formatMoneyHTML(total)}</b>` +
        (GK.canAfford(total) || s.mass ? '' : ' <span class="bet-warning">– nicht genug Dublonen</span>')
      : '');
  }

  function updateButtons() {
    const s = state();
    const count = countOf(s);
    const massRunning = !!s.mass;
    els.drop.disabled = massRunning || (count === 1 ? s.pending.length >= MAX_BALLS : s.pending.length > 0);
    GK.setText(els.drop, count === 1 ? '🪙 Münze werfen' : `🪙 ${GK.formatNumber(count)} Münzen werfen`);
    els.skip.hidden = !massRunning;
    els.counts.forEach(btn => {
      btn.classList.toggle('active', Number(btn.dataset.count) === count);
      btn.disabled = massRunning;
    });
    els.risks.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.risk === s.risk);
      btn.disabled = s.pending.length > 0 || massRunning;
    });
    betControl.setDisabled(massRunning);
    renderTotal();
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
          <div class="plinko-count-label muted small">Münzen pro Wurf</div>
          <div class="plinko-counts" role="group" aria-label="Münzen pro Wurf">
            ${COUNTS.map(n => `<button type="button" class="btn btn-small plinko-count" data-count="${n}">${GK.formatNumber(n)}</button>`).join('')}
          </div>
          <div class="plinko-total"></div>
          <div class="game-actions">
            <button class="btn btn-primary btn-big plinko-drop">🪙 Münze werfen</button>
            <button class="btn plinko-skip" hidden>⏩ Sofort auszahlen</button>
          </div>
          <p class="muted small">Die Münze springt an jedem Nagel nach links oder rechts. Je weiter sie
            nach außen fällt, desto mehr gewinnst du. Einzelne Münzen kannst du schnell nacheinander werfen –
            oder bis zu 5.000 auf einmal (der Einsatz gilt pro Münze).</p>
        </div>
      </div>`;
    els = {
      canvas: body.querySelector('.plinko-canvas'),
      message: body.querySelector('.game-message'),
      drop: body.querySelector('.plinko-drop'),
      skip: body.querySelector('.plinko-skip'),
      total: body.querySelector('.plinko-total'),
      counts: [...body.querySelectorAll('.plinko-count')],
      risks: [...body.querySelectorAll('.plinko-risk')],
    };
    ctx = els.canvas.getContext('2d');
    betControl = GK.casino.createBetControl(body.querySelector('.plinko-bet'), {
      min: MIN_BET,
      label: 'Einsatz pro Münze',
      get: () => state().bet,
      set: v => { state().bet = v; },
    });
    els.drop.addEventListener('click', () => {
      const count = countOf(state());
      if (count === 1) drop();
      else throwMany(count);
    });
    els.skip.addEventListener('click', () => {
      if (!state().mass) return;
      GK.sound.play('chip');
      finishMass(true);
    });
    els.counts.forEach(btn => btn.addEventListener('click', () => {
      if (state().mass) return;
      state().count = Number(btn.dataset.count);
      GK.sound.play('chip');
      GK.save();
      updateButtons();
    }));
    els.risks.forEach(btn => btn.addEventListener('click', () => {
      if (state().pending.length || state().mass) return;
      state().risk = btn.dataset.risk;
      shownHits = null;
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
    mass = null;
    shownHits = null;
    state().pending.slice().forEach(ball => settle(ball, false));
    if (state().mass) finishMass(false);
    else showMessage('Wirf eine Münze!', '');
    draw();
    updateButtons();
  }

  GK.casino.register({
    id: 'plinko',
    category: 'quick',
    name: 'Münzfall',
    emoji: '🪙',
    desc: 'Lass die Münze durch die Nägel fallen – außen warten bis zu ×170! Bis zu 5.000 Münzen auf einmal.',
    init,
    refresh,
    render: () => {
      betControl.refresh();
      renderTotal();
    },
  });

  // Für Tests
  GK.casino.plinkoMath = { RISKS, ROWS, COUNTS, rtp, popcount, rollMany };
})();
