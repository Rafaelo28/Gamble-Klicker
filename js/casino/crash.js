// Kanonenkugel: Die Kugel fliegt und der Multiplikator steigt immer weiter – bis sie explodiert.
// Wer vorher abkassiert, bekommt Einsatz × Multiplikator. Wann sie explodiert, steht beim Abschuss fest.
// Verlässt man das Spiel während des Flugs (anderes Spiel, anderer Tab, Neuladen), wird sofort
// abkassiert – so kostet Neuladen nie den Einsatz.
window.GK = window.GK || {};

(function () {
  const MIN_BET = 10;
  const GROWTH = 0.11;      // Multiplikator = e^(GROWTH · Sekunden)
  const EDGE = 0.97;        // P(Explosion erst ab x) = EDGE / x
  const MAX_CRASH = 1000;
  const W = 900;
  const H = 480;
  const SCALE = 1.5;
  const CANNON = { x: 110, y: H - 120 };

  let els = {};
  let betControl;
  let ctx;
  let running = false;
  let explosion = null;   // { x, y, start, mult }
  let lastBall = null;    // letzte Position der Kugel
  let stars = [];

  function state() {
    return GK.casino.data('crash', () => ({ bet: 100, auto: { on: false, at: 2 }, round: null, last: null, history: [] }));
  }

  // ---------- Mathematik (auch für Tests) ----------

  // Explosionspunkt: P(Explosion ≥ x) = 0,97 / x (bei 3 % explodiert sie sofort)
  function crashPoint(r) {
    const value = Math.floor(EDGE / (1 - r) * 100) / 100;
    return Math.min(MAX_CRASH, Math.max(1, value));
  }

  const multAt = ms => Math.exp(GROWTH * ms / 1000);
  const timeFor = mult => Math.log(mult) / GROWTH * 1000;
  const floor2 = m => Math.floor(m * 100 + 1e-9) / 100;

  // ---------- Ablauf ----------

  function fire() {
    const s = state();
    // Schon abkassiert und die alte Kugel fliegt noch? Dann einfach die nächste abfeuern.
    if (s.round && s.round.cashed) finishRound(s.round);
    if (s.round) return;
    if (!GK.casino.bet(s.bet)) {
      GK.sound.play('denied');
      showMessage('Nicht genug Dublonen für diesen Einsatz.', 'loss');
      return;
    }
    const auto = s.auto.on ? Math.max(1.01, floor2(Number(s.auto.at) || 2)) : null;
    s.round = { bet: s.bet, crash: crashPoint(GK.rng.float()), start: Date.now(), auto, cashed: null };
    GK.save();
    explosion = null;
    GK.sound.play('cannon');
    GK.fx.shake('small');
    showMessage('🔥 Feuer! Kassier ab, bevor sie explodiert!', '');
    updateButtons();
    startLoop();
  }

  // Abkassieren zum aktuellen Multiplikator (oder genau beim Auto-Wert)
  function cashOut(reason, atMult) {
    const s = state();
    const r = s.round;
    if (!r || r.cashed) return;
    const now = atMult || floor2(multAt(Date.now() - r.start));
    if (now >= r.crash) return; // zu spät
    r.cashed = now;
    const payout = Math.floor(r.bet * now);
    GK.casino.payout(payout);
    if (now >= 10) GK.unlockAchievement('crash10');
    GK.casino.record('crash', r.bet, payout, `💰 bei ×${fmt(now)}`);
    GK.save();
    showMessage(`💰 Abkassiert bei ×${fmt(now)}: ${GK.formatMoneyHTML(payout)}${reason ? ` (${reason})` : ''}`, 'win');
    if (!reason) GK.fx.celebrate(payout, r.bet, { el: els.canvas, subtitle: `×${fmt(now)}` });
    updateButtons();
  }

  // Runde abschließen und im Verlauf festhalten
  function finishRound(r) {
    const s = state();
    s.round = null;
    s.last = { crash: r.crash, cashed: r.cashed };
    s.history.unshift(r.crash);
    s.history.length = Math.min(s.history.length, 14);
    drawHistory();
  }

  // Die Kugel explodiert: Runde vorbei
  function explode() {
    const s = state();
    const r = s.round;
    if (!r) return;
    finishRound(r);
    if (!r.cashed) {
      GK.casino.record('crash', r.bet, 0, `💥 bei ×${fmt(r.crash)}`);
      showMessage(`💥 Explodiert bei ×${fmt(r.crash)} – der Einsatz ist weg.`, 'loss');
    }
    GK.save();
    explosion = { start: performance.now(), mult: r.crash, x: lastBall ? lastBall.x : W / 2, y: lastBall ? lastBall.y : H / 2 };
    GK.sound.play('boom');
    if (!r.cashed) GK.fx.shake('small');
    updateButtons();
  }

  // Jedes Bild: Multiplikator prüfen (Auto-Abkassieren, Explosion, Spiel verlassen)
  function step() {
    const r = state().round;
    if (!r) return;
    const elapsed = Date.now() - r.start;
    const m = multAt(elapsed);
    if (!r.cashed && r.auto && r.auto < r.crash && m >= r.auto) cashOut('automatisch', r.auto);
    if (!r.cashed && !isVisible()) cashOut('Spiel verlassen');
    if (m >= r.crash) explode();
  }

  function isVisible() {
    return els.canvas && els.canvas.offsetParent !== null && document.visibilityState === 'visible';
  }

  // ---------- Darstellung ----------

  function fmt(m) {
    return GK.formatDecimal(m, 2, 2);
  }

  function startLoop() {
    if (running) return;
    running = true;
    requestAnimationFrame(frame);
  }

  function frame(now) {
    step();
    draw(now);
    updateCashLabel();
    const exploding = explosion && now - explosion.start < 1600;
    if (state().round || exploding) requestAnimationFrame(frame);
    else {
      running = false;
      draw(now);
    }
  }

  // Bildschirmposition für Zeit (ms) und Multiplikator – die Achsen wachsen mit
  function project(ms, mult, maxMs, maxMult) {
    const x = CANNON.x + 30 + (W - CANNON.x - 110) * Math.min(1, ms / maxMs);
    const y = CANNON.y - 20 - (CANNON.y - 70) * Math.min(1, Math.log(mult) / Math.log(maxMult));
    return { x, y };
  }

  function draw(now = performance.now()) {
    if (!ctx) return;
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.clearRect(0, 0, W, H);
    // Sterne
    stars.forEach(st => {
      ctx.globalAlpha = 0.4 + 0.4 * Math.sin(now / 700 + st.p);
      ctx.fillStyle = '#fff';
      ctx.fillRect(st.x, st.y, st.s, st.s);
    });
    ctx.globalAlpha = 1;
    // Meer
    const sea = ctx.createLinearGradient(0, H - 90, 0, H);
    sea.addColorStop(0, '#0e4d6b');
    sea.addColorStop(1, '#06283a');
    ctx.fillStyle = sea;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 20) ctx.lineTo(x, H - 80 + Math.sin(x / 40 + now / 500) * 5);
    ctx.lineTo(W, H);
    ctx.fill();

    const r = state().round;
    const flight = r ? Date.now() - r.start : null;
    // Kurve und Kugel
    if (r || explosion) {
      const ms = r ? flight : timeFor(explosion.mult);
      const mult = r ? multAt(ms) : explosion.mult;
      const maxMs = Math.max(8000, ms * 1.15);
      const maxMult = Math.max(2, mult * 1.25);
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      const grad = ctx.createLinearGradient(CANNON.x, 0, W, 0);
      grad.addColorStop(0, 'rgba(255, 200, 80, 0.2)');
      grad.addColorStop(1, 'rgba(255, 120, 40, 0.95)');
      ctx.strokeStyle = grad;
      ctx.beginPath();
      for (let i = 0; i <= 60; i++) {
        const t = ms * i / 60;
        const p = project(t, multAt(t), maxMs, maxMult);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      const ball = project(ms, mult, maxMs, maxMult);
      lastBall = ball;
      // Abkassiert: Markierung auf der Kurve
      const cashed = r ? r.cashed : state().last && state().last.cashed;
      if (cashed) {
        const c = project(timeFor(cashed), cashed, maxMs, maxMult);
        ctx.font = '26px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('💰', c.x, c.y - 14);
      }
      if (r) {
        const glow = ctx.createRadialGradient(ball.x, ball.y, 2, ball.x, ball.y, 26);
        glow.addColorStop(0, 'rgba(255, 220, 120, 0.9)');
        glow.addColorStop(1, 'rgba(255, 90, 20, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, 26, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1b1b1f';
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.beginPath();
        ctx.arc(ball.x - 3, ball.y - 3, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Explosion
    if (explosion) {
      const t = (now - explosion.start) / 1600;
      if (t < 1) {
        for (let i = 0; i < 18; i++) {
          const a = i / 18 * Math.PI * 2;
          const d = 20 + t * 140;
          ctx.globalAlpha = 1 - t;
          ctx.fillStyle = i % 2 ? '#ffb347' : '#ff4d2e';
          ctx.beginPath();
          ctx.arc(explosion.x + Math.cos(a) * d, explosion.y + Math.sin(a) * d, 10 * (1 - t) + 3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }
    // Schiff mit Kanone
    ctx.save();
    ctx.translate(CANNON.x, CANNON.y);
    ctx.rotate(-0.5);
    ctx.fillStyle = '#2b2b30';
    ctx.fillRect(0, -9, 54, 18);
    ctx.fillStyle = '#4a4a52';
    ctx.fillRect(48, -11, 8, 22);
    ctx.restore();
    ctx.font = '96px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🏴‍☠️', CANNON.x - 30, CANNON.y - 40);
    ctx.fillText('⛵', CANNON.x - 10, CANNON.y + 10);

    // Großer Multiplikator
    let big = '';
    let color = '#ffe58a';
    if (r) {
      big = `×${fmt(floor2(multAt(flight)))}`;
      if (r.cashed) color = '#6fdc8c';
    } else if (state().last) {
      big = `💥 ×${fmt(state().last.crash)}`;
      color = '#ff6b4a';
    }
    if (big) {
      ctx.font = '900 76px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = color;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
      ctx.shadowBlur = 12;
      ctx.fillText(big, W / 2 + 60, 110);
      ctx.shadowBlur = 0;
    }
  }

  function drawHistory() {
    const h = state().history;
    els.history.innerHTML = h.length
      ? h.map(m => `<span class="crash-chip ${m >= 10 ? 'huge' : m >= 2 ? 'high' : 'low'}">×${fmt(m)}</span>`).join('')
      : '<span class="muted small">Noch keine Schüsse.</span>';
  }

  function updateCashLabel() {
    const r = state().round;
    if (!r || r.cashed) return;
    const value = Math.floor(r.bet * floor2(multAt(Date.now() - r.start)));
    const text = GK.formatNumber(value);
    if (els.cashValue.textContent !== text) els.cashValue.textContent = text;
  }

  function updateButtons() {
    const s = state();
    const r = s.round;
    const flying = !!r && !r.cashed;
    els.fire.hidden = flying;
    els.cash.hidden = !flying;
    els.cash.disabled = !flying;
    betControl.setDisabled(flying);
    els.autoOn.checked = s.auto.on;
    els.autoOn.disabled = flying;
    els.autoAt.disabled = flying;
    if (document.activeElement !== els.autoAt) els.autoAt.value = s.auto.at;
  }

  function showMessage(html, cls) {
    els.message.className = 'game-message ' + (cls || '');
    els.message.innerHTML = html;
  }

  function init(body) {
    body.innerHTML = `
      <div class="crash-layout">
        <div class="crash-scene">
          <canvas class="crash-canvas" width="${W * SCALE}" height="${H * SCALE}"></canvas>
          <div class="crash-history"></div>
        </div>
        <div class="crash-controls">
          <div class="game-message">&nbsp;</div>
          <div class="crash-bet"></div>
          <label class="crash-auto">
            <input type="checkbox" class="crash-auto-on">
            Automatisch abkassieren bei ×
            <input type="number" class="bet-input crash-auto-at" min="1.01" step="0.1" inputmode="decimal">
          </label>
          <div class="game-actions">
            <button class="btn btn-primary btn-big crash-fire">💣 Feuer!</button>
            <button class="btn btn-primary btn-big crash-cash" hidden>💰 Abkassieren: <span class="crash-cash-value"></span></button>
          </div>
          <p class="muted small">Der Multiplikator steigt, solange die Kugel fliegt. Kassiere rechtzeitig ab –
            explodiert sie vorher, ist der Einsatz weg.</p>
        </div>
      </div>`;
    els = {
      canvas: body.querySelector('.crash-canvas'),
      history: body.querySelector('.crash-history'),
      message: body.querySelector('.game-message'),
      fire: body.querySelector('.crash-fire'),
      cash: body.querySelector('.crash-cash'),
      cashValue: body.querySelector('.crash-cash-value'),
      autoOn: body.querySelector('.crash-auto-on'),
      autoAt: body.querySelector('.crash-auto-at'),
    };
    ctx = els.canvas.getContext('2d');
    stars = Array.from({ length: 50 }, () => ({ x: Math.random() * W, y: Math.random() * (H - 140), s: 1 + Math.random() * 2, p: Math.random() * 6 }));
    betControl = GK.casino.createBetControl(body.querySelector('.crash-bet'), {
      min: MIN_BET,
      get: () => state().bet,
      set: v => { state().bet = v; },
    });
    els.fire.addEventListener('click', fire);
    // pointerdown: Abkassieren zählt sofort beim Antippen, nicht erst beim Loslassen
    els.cash.addEventListener('pointerdown', e => {
      e.preventDefault();
      cashOut();
    });
    els.cash.addEventListener('click', e => { if (e.detail === 0) cashOut(); });
    els.autoOn.addEventListener('change', () => {
      state().auto.on = els.autoOn.checked;
      GK.save();
    });
    els.autoAt.addEventListener('change', () => {
      state().auto.at = Math.max(1.01, floor2(Number(els.autoAt.value) || 2));
      els.autoAt.value = state().auto.at;
      GK.save();
    });
    // Seite wird verlassen oder in den Hintergrund geschickt: sofort abkassieren
    const leave = () => {
      const r = state().round;
      if (r && !r.cashed) cashOut('Spiel verlassen');
    };
    window.addEventListener('pagehide', leave);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') leave();
    });
    refresh();
  }

  function refresh() {
    const s = state();
    const r = s.round;
    // Flug aus einer früheren Sitzung (Seite ohne Abmelden geschlossen): jetzt abrechnen
    if (r) {
      if (!r.cashed && multAt(Date.now() - r.start) < r.crash) cashOut('Seite neu geladen');
      finishRound(r);
      if (!r.cashed) GK.casino.record('crash', r.bet, 0, `💥 bei ×${fmt(r.crash)}`);
      GK.save();
    } else {
      showMessage('Setz deinen Einsatz und feuer die Kanone ab!', '');
    }
    explosion = null;
    drawHistory();
    updateButtons();
    draw();
  }


  GK.casino.register({
    id: 'crash',
    category: 'quick',
    name: 'Kanonenkugel',
    emoji: '💣',
    desc: 'Der Multiplikator steigt – kassier ab, bevor die Kugel explodiert!',
    init,
    refresh,
    onShow: () => draw(),
    onHide: () => {
      const r = state().round;
      if (r && !r.cashed) cashOut('Spiel verlassen');
    },
    render: () => {
      if (!state().round) betControl.refresh();
    },
  });

  // Für Tests
  GK.casino.crashMath = { crashPoint, multAt, timeFor, EDGE };
})();
