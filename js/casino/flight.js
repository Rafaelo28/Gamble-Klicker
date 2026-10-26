// Flugkapitän: Ein Flugzeug startet vom Flaggschiff und fliegt übers Meer. Unterwegs sammelt es
// Bonusbeträge (+) und Multiplikatoren (×); Raketen halbieren den Gewinn. Am Ende muss es auf dem
// Flaggschiff landen – dann gibt es den gesammelten Gewinn, sonst stürzt es ins Meer.
// Vier Geschwindigkeiten: je schneller, desto länger der Flug und desto höher (aber unsicherer) der Gewinn.
// Der ganze Flug steht beim Start fest und wird gespeichert – Neuladen zahlt trotzdem aus.
window.GK = window.GK || {};

(function () {
  const MIN_BET = 10;
  const RTP = 0.97;
  // Ereignisse: Anteil und mögliche Werte (Beträge als Vielfaches des Einsatzes)
  const EVENT_TYPES = [
    { type: 'add', weight: 50, values: [[0.2, 50], [0.5, 30], [1, 15], [2, 5]] },
    { type: 'mult', weight: 12, values: [[2, 55], [3, 27], [4, 12], [5, 6]] },
    { type: 'rocket', weight: 38, values: [[0.5, 1]] },
  ];
  const MODES = {
    slow:   { name: 'Gemütlich', icon: '🐢', events: [6, 8],   step: 1000 },
    normal: { name: 'Normal',    icon: '✈️', events: [8, 11],  step: 820 },
    fast:   { name: 'Schnell',   icon: '🚀', events: [11, 14], step: 640 },
    turbo:  { name: 'Turbo',     icon: '⚡', events: [14, 18], step: 480 },
  };
  const W = 900;
  const H = 480;
  const SCALE = 1.5;
  const PLANE_X = 230;
  const SEA_Y = H - 70;

  let els = {};
  let betControl;
  let ctx;
  let flying = null;   // laufende Animation
  let clouds = [];

  function state() {
    return GK.casino.data('flight', () => ({ bet: 100, mode: 'normal', pending: null, history: [] }));
  }

  // ---------- Mathematik (auch für Tests) ----------

  const sum = arr => arr.reduce((a, b) => a + b, 0);

  function expectedValue(values) {
    const total = sum(values.map(v => v[1]));
    return sum(values.map(([v, w]) => v * w)) / total;
  }

  // Erwarteter Gewinn-Zähler nach n Ereignissen (exakt, die Ereignisse sind unabhängig)
  function expectedCounter(n) {
    const total = sum(EVENT_TYPES.map(e => e.weight));
    const [add, mult, rocket] = EVENT_TYPES.map(e => e.weight / total);
    const addValue = expectedValue(EVENT_TYPES[0].values);
    const multValue = expectedValue(EVENT_TYPES[1].values);
    let e = 0;
    for (let i = 0; i < n; i++) e = add * (e + addValue) + mult * multValue * e + rocket * 0.5 * e;
    return e;
  }

  // Durchschnitt über alle möglichen Fluglängen eines Modus
  function modeExpectation(mode) {
    const [lo, hi] = MODES[mode].events;
    let total = 0;
    for (let n = lo; n <= hi; n++) total += expectedCounter(n);
    return total / (hi - lo + 1);
  }

  // Wahrscheinlichkeit einer Landung – so gewählt, dass im Schnitt 97 % zurückfließen
  function landingChance(mode) {
    return Math.min(0.95, RTP / modeExpectation(mode));
  }

  function rtp(mode) {
    return landingChance(mode) * modeExpectation(mode);
  }

  function pick(values) {
    const total = sum(values.map(v => v[1]));
    let roll = GK.rng.float() * total;
    for (const [v, w] of values) {
      if (roll < w) return v;
      roll -= w;
    }
    return values[values.length - 1][0];
  }

  // Einen ganzen Flug auslosen
  function makeFlight(mode) {
    const [lo, hi] = MODES[mode].events;
    const n = lo + GK.rng.int(hi - lo + 1);
    const events = [];
    let counter = 0;
    for (let i = 0; i < n; i++) {
      const total = sum(EVENT_TYPES.map(e => e.weight));
      let roll = GK.rng.float() * total;
      let kind = EVENT_TYPES[EVENT_TYPES.length - 1];
      for (const e of EVENT_TYPES) {
        if (roll < e.weight) {
          kind = e;
          break;
        }
        roll -= e.weight;
      }
      const value = pick(kind.values);
      if (kind.type === 'add') counter += value;
      else if (kind.type === 'mult') counter *= value;
      else counter *= 0.5;
      events.push({ type: kind.type, value, counter });
    }
    return { events, counter, landed: GK.rng.float() < landingChance(mode) };
  }

  // ---------- Ablauf ----------

  function start() {
    const s = state();
    if (s.pending) return;
    if (!GK.casino.bet(s.bet)) {
      GK.sound.play('denied');
      showMessage('Nicht genug Dublonen für diesen Einsatz.', 'loss');
      return;
    }
    const f = makeFlight(s.mode);
    const payout = f.landed ? Math.floor(s.bet * f.counter) : 0;
    s.pending = { bet: s.bet, mode: s.mode, events: f.events, counter: f.counter, landed: f.landed, payout };
    GK.save();
    showMessage('✈️ Abflug!', '');
    updateButtons();
    GK.sound.play('spinStart');
    flying = { p: s.pending, start: performance.now(), done: 0, shown: 0, effects: [], crashed: false, celebrated: false };
    requestAnimationFrame(frame);
  }

  // animated = nach dem Flug (sonst nach dem Neuladen)
  function settle(animated) {
    const s = state();
    const p = s.pending;
    if (!p) return;
    s.pending = null;
    GK.casino.payout(p.payout);
    s.history.unshift(p.landed ? Math.round(p.counter * 100) / 100 : 0);
    s.history.length = Math.min(s.history.length, 14);
    if (p.landed && p.counter >= 20) GK.unlockAchievement('flightAce');
    const mult = fmt(p.counter);
    GK.casino.record('flight', p.bet, p.payout, p.landed ? `🛬 Gelandet mit ×${mult}` : `🌊 Ins Meer gestürzt (×${mult})`);
    if (p.landed && p.payout > 0) {
      showMessage(`🛬 Sicher gelandet! Gewinn: ${GK.formatMoneyHTML(p.payout)} (×${mult})`, 'win');
      if (animated) GK.fx.celebrate(p.payout, p.bet, { el: els.canvas, subtitle: `Landung mit ×${mult}` });
    } else if (p.landed) {
      showMessage('🛬 Gelandet – aber ohne Beute.', '');
    } else {
      showMessage(`🌊 Knapp vorbei – das Flugzeug ist ins Meer gestürzt. (×${mult} wären es gewesen)`, 'loss');
      if (animated) GK.sound.play('lose');
    }
    drawHistory();
    updateButtons();
  }

  // ---------- Darstellung ----------

  function fmt(m) {
    return m.toLocaleString('de-DE', { minimumFractionDigits: m < 10 ? 2 : 0, maximumFractionDigits: 2 });
  }

  // Flughöhe nach jedem Ereignis: Boni heben das Flugzeug, Raketen drücken es nach unten
  function altitudes(events) {
    const alts = [SEA_Y - 70];
    let a = 210;
    events.forEach(e => {
      a += e.type === 'rocket' ? 60 : e.type === 'mult' ? -45 : -18;
      a = Math.min(330, Math.max(90, a));
      alts.push(a);
    });
    return alts;
  }

  function frame(now) {
    if (!flying) return;
    const f = flying;
    const p = f.p;
    const fast = GK.state.settings.effects === 'reduced';
    const step = MODES[p.mode].step * (fast ? 0.4 : 1);
    const t = (now - f.start) / step;          // in Ereignissen
    const n = p.events.length;
    const alts = altitudes(p.events);
    // Ereignisse, die das Flugzeug erreicht hat
    while (f.done < n && t >= f.done + 1) {
      const e = p.events[f.done];
      f.done++;
      f.effects.push({ type: e.type, at: now, y: alts[f.done] });
      if (e.type === 'add') GK.sound.play('gem', 0.9 + Math.min(e.value, 2) * 0.1);
      else if (e.type === 'mult') GK.sound.play('bonus');
      else {
        GK.sound.play('boom');
        GK.fx.shake('small');
      }
    }
    draw(now, t);
    // Landeanflug: 2 Schritte nach dem letzten Ereignis
    if (t >= n + 2.4) {
      if (!p.landed && !f.crashed) {
        f.crashed = true;
        GK.sound.play('boom');
      }
      if (t >= n + 3.2) {
        flying = null;
        settle(true);
        draw(now, n + 3.2, true);
        return;
      }
    }
    requestAnimationFrame(frame);
  }

  function draw(now = performance.now(), t = null, final = false) {
    if (!ctx) return;
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const p = flying ? flying.p : null;
    const speed = p ? 0.25 : 0.04;
    // Wolken (ziehen nach links)
    clouds.forEach(c => {
      const x = ((c.x - now * speed * c.z) % (W + 200) + W + 200) % (W + 200) - 100;
      ctx.globalAlpha = 0.25 + c.z * 0.35;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.ellipse(x, c.y, 60 * c.z + 20, 16 * c.z + 6, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 30 * c.z, c.y - 10, 34 * c.z + 10, 14 * c.z + 6, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    // Meer
    const sea = ctx.createLinearGradient(0, SEA_Y, 0, H);
    sea.addColorStop(0, '#1b6f9a');
    sea.addColorStop(1, '#073248');
    ctx.fillStyle = sea;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 20) ctx.lineTo(x, SEA_Y + Math.sin(x / 35 + now / (p ? 250 : 700)) * 4);
    ctx.lineTo(W, H);
    ctx.fill();

    if (!p || t === null) {
      // Ruhezustand: Flugzeug steht auf dem Schiff
      drawShip(PLANE_X - 40);
      drawPlane(PLANE_X, SEA_Y - 64, 0, now, false);
      drawCounter(state().pending ? state().pending.counter : null, null);
      return;
    }
    const n = p.events.length;
    const alts = altitudes(p.events);
    // Startschiff zieht nach links weg, Zielschiff kommt am Ende von rechts
    if (t < 1.5) drawShip(PLANE_X - 40 - t * 260);
    const shipX = W + 120 - Math.max(0, t - (n - 0.5)) * 300;
    const targetX = PLANE_X - 30;
    const landX = Math.max(targetX, shipX);
    if (t > n - 1) drawShip(landX);
    // Objekte, die auf das Flugzeug zufliegen
    p.events.forEach((e, i) => {
      const dist = i + 1 - t;
      if (dist < -0.05 || dist > 3) return;
      const x = PLANE_X + dist * 260;
      const y = alts[i + 1] - 4;
      if (e.type === 'rocket') drawRocket(x, y, now);
      else drawBubble(x, y, e, now, p.bet);
    });
    // Flugzeug: Höhe zwischen den Ereignissen weich überblenden
    let y;
    let tilt = 0;
    if (t <= n) {
      const i = Math.floor(t);
      const k = t - i;
      const a0 = alts[Math.min(i, n)];
      const a1 = alts[Math.min(i + 1, n)];
      const ease = k * k * (3 - 2 * k);
      y = a0 + (a1 - a0) * ease;
      tilt = (a1 - a0) / 200;
      if (t < 1) y = SEA_Y - 64 + (alts[1] - (SEA_Y - 64)) * ease;
    } else {
      // Landeanflug
      const k = Math.min(1, (t - n) / 2.4);
      const deck = SEA_Y - 64;
      const end = p.landed ? deck : SEA_Y + 10;
      y = alts[n] + (end - alts[n]) * k * k;
      tilt = p.landed ? (1 - k) * 0.25 : 0.2 + k * 0.5;
    }
    const crashed = flying && flying.crashed;
    if (!crashed || final) drawPlane(PLANE_X, y, tilt, now, true);
    if (crashed) drawSplash(PLANE_X, SEA_Y, now - flying.start);
    // Treffer-Effekte
    if (flying) {
      flying.effects = flying.effects.filter(fx => now - fx.at < 700);
      flying.effects.forEach(fx => {
        const k = (now - fx.at) / 700;
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = fx.type === 'rocket' ? '#ff6b4a' : fx.type === 'mult' ? '#c27bff' : '#ffe58a';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(PLANE_X + 30, fx.y, 20 + k * 60, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      });
    }
    const shownCounter = flying && flying.done > 0 ? p.events[flying.done - 1].counter : final ? p.counter : 0;
    drawCounter(shownCounter, p);
  }

  function drawCounter(counter, p) {
    const bet = p ? p.bet : state().bet;
    ctx.font = '900 22px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText('Gewinn', 24, 40);
    ctx.font = '900 48px system-ui, sans-serif';
    ctx.fillStyle = '#ffe58a';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 10;
    ctx.fillText(counter == null ? '–' : GK.formatNumber(Math.floor(counter * bet)), 24, 90);
    ctx.shadowBlur = 0;
    if (counter != null) {
      ctx.font = '700 20px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.fillText(`×${fmt(counter)}`, 26, 118);
    }
  }

  function drawPlane(x, y, tilt, now, running) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    // Schatten der Tragflächen
    ctx.fillStyle = '#b71c1c';
    ctx.fillRect(-14, -22, 30, 8);
    // Rumpf
    const body = ctx.createLinearGradient(0, -14, 0, 14);
    body.addColorStop(0, '#ff6b5a');
    body.addColorStop(1, '#c0281a');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, 0, 48, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    // Leitwerk
    ctx.beginPath();
    ctx.moveTo(-40, -4);
    ctx.lineTo(-58, -26);
    ctx.lineTo(-46, -26);
    ctx.lineTo(-30, -6);
    ctx.fill();
    // Tragfläche vorne
    ctx.fillStyle = '#e53935';
    ctx.fillRect(-12, 4, 34, 9);
    ctx.fillStyle = '#ffd95e';
    ctx.fillRect(-12, 4, 34, 3);
    // Cockpit
    ctx.fillStyle = '#9fd8ff';
    ctx.beginPath();
    ctx.ellipse(8, -10, 11, 7, 0, Math.PI, 0);
    ctx.fill();
    // Propeller
    ctx.fillStyle = '#333';
    ctx.fillRect(46, -3, 6, 6);
    ctx.fillStyle = running ? 'rgba(220, 220, 220, 0.55)' : '#555';
    if (running) {
      ctx.beginPath();
      ctx.ellipse(52, 0, 3, 20, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(50, -18, 3, 36);
    }
    // Totenkopf auf dem Rumpf
    ctx.font = '13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('☠️', -18, 1);
    ctx.restore();
  }

  function drawShip(x) {
    const deck = SEA_Y - 40;
    ctx.fillStyle = '#4a5560';
    ctx.beginPath();
    ctx.moveTo(x - 110, deck);
    ctx.lineTo(x + 130, deck);
    ctx.lineTo(x + 100, SEA_Y + 14);
    ctx.lineTo(x - 90, SEA_Y + 14);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#2f373f';
    ctx.fillRect(x - 110, deck - 6, 240, 8);
    ctx.fillStyle = '#ffd95e';
    for (let i = -90; i < 120; i += 30) ctx.fillRect(x + i, deck - 3, 14, 2);
    ctx.fillStyle = '#5f6b76';
    ctx.fillRect(x + 70, deck - 40, 26, 36);
    ctx.font = '22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🏴‍☠️', x + 84, deck - 52);
  }

  function drawBubble(x, y, e, now, bet) {
    const r = 26 + Math.sin(now / 200 + x) * 2;
    const g = ctx.createRadialGradient(x, y, 4, x, y, r + 14);
    g.addColorStop(0, e.type === 'mult' ? 'rgba(194, 123, 255, 0.9)' : 'rgba(255, 229, 138, 0.9)');
    g.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r + 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '900 24px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 6;
    ctx.fillText(e.type === 'mult' ? `×${e.value}` : `+${GK.formatNumber(e.value * bet)}`, x, y);
    ctx.shadowBlur = 0;
  }

  function drawRocket(x, y, now) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(255, 160, 60, 0.85)';
    ctx.beginPath();
    ctx.moveTo(28, -5);
    ctx.lineTo(48 + Math.sin(now / 40) * 6, 0);
    ctx.lineTo(28, 5);
    ctx.fill();
    ctx.fillStyle = '#e0e0e0';
    ctx.fillRect(-24, -6, 52, 12);
    ctx.fillStyle = '#d62d20';
    ctx.beginPath();
    ctx.moveTo(-24, -6);
    ctx.lineTo(-38, 0);
    ctx.lineTo(-24, 6);
    ctx.fill();
    ctx.fillStyle = '#555';
    ctx.fillRect(20, -10, 8, 20);
    // Groß und mit dunklem Rand, damit „÷2“ nicht wie ein Bonus „+2“ aussieht
    ctx.font = '900 24px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(40, 0, 0, 0.85)';
    ctx.strokeText('÷2', 0, -20);
    ctx.fillStyle = '#ff5a3a';
    ctx.fillText('÷2', 0, -20);
    ctx.restore();
  }

  function drawSplash(x, y, age) {
    const k = Math.min(1, (age % 100000) / 600);
    ctx.fillStyle = 'rgba(200, 235, 255, 0.85)';
    for (let i = 0; i < 9; i++) {
      const a = Math.PI + (i / 8) * Math.PI;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * 40 * k, y + Math.sin(a) * 60 * k, 7 * (1 - k * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawHistory() {
    const h = state().history;
    els.history.innerHTML = h.length
      ? h.map(m => (m > 0 ? `<span class="crash-chip high">🛬 ×${fmt(m)}</span>` : '<span class="crash-chip low">🌊</span>')).join('')
      : '<span class="muted small">Noch keine Flüge.</span>';
  }

  function showMessage(html, cls) {
    els.message.className = 'game-message ' + (cls || '');
    els.message.innerHTML = html;
  }

  function updateButtons() {
    const busy = !!state().pending || !!flying;
    els.start.disabled = busy;
    els.modes.forEach(b => {
      b.classList.toggle('active', b.dataset.mode === state().mode);
      b.disabled = busy;
    });
    betControl.setDisabled(busy);
  }

  function init(body) {
    body.innerHTML = `
      <div class="crash-layout">
        <div class="crash-scene flight-scene">
          <canvas class="flight-canvas" width="${W * SCALE}" height="${H * SCALE}"></canvas>
          <div class="crash-history flight-history"></div>
        </div>
        <div class="crash-controls">
          <div class="bet-label">Fluggeschwindigkeit</div>
          <div class="plinko-risks flight-modes" role="group" aria-label="Geschwindigkeit">
            ${Object.entries(MODES).map(([id, m]) => `<button type="button" class="btn btn-small flight-mode" data-mode="${id}">${m.icon} ${m.name}</button>`).join('')}
          </div>
          <div class="game-message">&nbsp;</div>
          <div class="flight-bet"></div>
          <div class="game-actions">
            <button class="btn btn-primary btn-big flight-start">✈️ Abheben!</button>
          </div>
          <p class="muted small">Unterwegs sammelt dein Flugzeug Beträge (+) und Multiplikatoren (×), Raketen
            halbieren den Gewinn. Landet es am Ende auf dem Flaggschiff, gehört der Gewinn dir – stürzt es ins
            Meer, ist der Einsatz weg. Schnellere Flüge sind länger und können mehr bringen.</p>
        </div>
      </div>`;
    els = {
      canvas: body.querySelector('.flight-canvas'),
      history: body.querySelector('.flight-history'),
      message: body.querySelector('.game-message'),
      start: body.querySelector('.flight-start'),
      modes: [...body.querySelectorAll('.flight-mode')],
    };
    ctx = els.canvas.getContext('2d');
    clouds = Array.from({ length: 9 }, () => ({ x: Math.random() * W, y: 40 + Math.random() * 250, z: 0.3 + Math.random() * 0.7 }));
    betControl = GK.casino.createBetControl(body.querySelector('.flight-bet'), {
      min: MIN_BET,
      get: () => state().bet,
      set: v => { state().bet = v; },
    });
    els.start.addEventListener('click', start);
    els.modes.forEach(btn => btn.addEventListener('click', () => {
      if (state().pending) return;
      state().mode = btn.dataset.mode;
      GK.sound.play('chip');
      GK.save();
      updateButtons();
    }));
    refresh();
  }

  function refresh() {
    flying = null;
    // Flug aus der letzten Sitzung: sofort abrechnen
    if (state().pending) settle(false);
    else showMessage('Wähle Einsatz und Geschwindigkeit – und dann ab in die Luft!', '');
    drawHistory();
    updateButtons();
    draw();
  }

  GK.casino.register({
    id: 'flight',
    category: 'quick',
    name: 'Flugkapitän',
    emoji: '✈️',
    desc: 'Sammle Multiplikatoren, weich Raketen aus und lande auf dem Flaggschiff!',
    init,
    refresh,
    onShow: () => { if (!flying) draw(); },
    render: () => {
      if (!state().pending) betControl.refresh();
    },
  });

  // Für Tests
  GK.casino.flightMath = { MODES, EVENT_TYPES, expectedCounter, modeExpectation, landingChance, rtp, makeFlight };
})();
