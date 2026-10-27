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
  let ended = null;    // Endbild des letzten Flugs (bleibt bis zum nächsten Start stehen)
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
    ended = null;
    flying = { p: s.pending, start: performance.now(), done: 0, effects: [], sputter: false, outcomeAt: 0 };
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

  // Landeanflug: so viele Schritte nach dem letzten Ereignis setzt das Flugzeug auf (oder stürzt ab),
  // danach wird abgerechnet
  const APPROACH = 2.2;
  const END = 3.6;

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
    // Absturz kündigt sich an: der Motor stottert
    if (!p.landed && !f.sputter && t >= n + 0.9) {
      f.sputter = true;
      GK.sound.play('denied');
    }
    // Aufsetzen bzw. Aufprall aufs Wasser
    if (!f.outcomeAt && t >= n + APPROACH) {
      f.outcomeAt = now;
      if (p.landed) GK.sound.play('reelStop');
      else {
        GK.sound.play('boom');
        GK.fx.shake('small');
      }
    }
    if (t >= n + END) {
      // Das Endbild bleibt stehen, bis der nächste Flug startet
      flying = null;
      // Endbild mit fertigem Banner – auch wenn die Animation übersprungen wurde (z. B. App gewechselt)
      ended = { p, t: n + END, outcomeAt: Math.min(f.outcomeAt || now, now - 1000) };
      settle(true);
      draw(now);
      return;
    }
    draw(now, t);
    requestAnimationFrame(frame);
  }

  const smooth = k => k * k * (3 - 2 * k);
  const clamp01 = k => Math.max(0, Math.min(1, k));

  // Wo das Zielschiff gerade ist: bei einer Landung bremst es genau unter dem Flugzeug,
  // bei einem Absturz ist es noch zu weit weg
  function targetShipX(p, t) {
    const n = p.events.length;
    const from = W + 150;
    const to = p.landed ? PLANE_X - 30 : PLANE_X + 360;
    const u = clamp01((t - (n - 0.6)) / (APPROACH + 0.6));
    return from + (to - from) * (1 - (1 - u) * (1 - u));
  }

  function draw(now = performance.now(), tNow = null) {
    if (!ctx) return;
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const sc = flying || ended;
    const speed = flying ? 0.25 : 0.04;
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
    for (let x = 0; x <= W; x += 20) ctx.lineTo(x, SEA_Y + Math.sin(x / 35 + now / (flying ? 250 : 700)) * 4);
    ctx.lineTo(W, H);
    ctx.fill();

    if (!sc) {
      // Ruhezustand: Flugzeug steht auf dem Schiff
      drawShip(PLANE_X - 40);
      drawPlane(PLANE_X, SEA_Y - 64, 0, now, false);
      drawCounter(state().pending ? state().pending.counter : null, null);
      return;
    }
    const p = sc.p;
    const t = flying ? tNow : sc.t;
    const n = p.events.length;
    const alts = altitudes(p.events);
    // Startschiff zieht nach links weg, Zielschiff kommt am Ende von rechts
    if (t < 1.5) drawShip(PLANE_X - 40 - t * 260);
    if (t > n - 1) drawShip(targetShipX(p, t));
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
    let x = PLANE_X;
    let y;
    let tilt = 0;
    const deck = SEA_Y - 64;
    const outcomeAt = flying ? flying.outcomeAt : sc.outcomeAt;
    if (t <= n) {
      const i = Math.floor(t);
      const k = t - i;
      const a0 = alts[Math.min(i, n)];
      const a1 = alts[Math.min(i + 1, n)];
      y = a0 + (a1 - a0) * smooth(k);
      tilt = (a1 - a0) / 200;
      if (t < 1) y = deck + (alts[1] - deck) * smooth(k);
    } else if (p.landed) {
      // Sinkflug aufs Deck, aufsetzen, ausrollen
      const k = clamp01((t - n) / APPROACH);
      y = alts[n] + (deck - alts[n]) * smooth(k);
      tilt = 0.12 * Math.sin(Math.PI * k);
      const r = clamp01((t - n - APPROACH) / 0.9);
      x += 40 * (1 - (1 - r) * (1 - r));
      y -= 7 * Math.sin(Math.PI * r) * (1 - r);
    } else {
      // Motor stottert, das Flugzeug sackt durch und stürzt vor dem Schiff ins Meer
      const k = clamp01((t - n) / APPROACH);
      const drop = clamp01((k - 0.35) / 0.65);
      y = alts[n] + (deck - alts[n]) * 0.35 * smooth(Math.min(1, k / 0.35)) + (SEA_Y + 10 - (alts[n] + (deck - alts[n]) * 0.35)) * drop * drop;
      tilt = 0.1 + drop * 0.8;
      if (drop > 0 && !outcomeAt) drawSmoke(x, y, now, drop);
    }
    const crashed = !p.landed && outcomeAt;
    if (!crashed) drawPlane(x, y, tilt, now, true);
    else {
      // Versinken: nur der Teil über dem Wasser ist zu sehen
      const age = now - outcomeAt;
      if (flying && age < 900) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, W, SEA_Y);
        ctx.clip();
        drawPlane(x + age / 30, SEA_Y + 6 + age / 18, 0.95, now, false);
        ctx.restore();
      }
      drawSplash(PLANE_X + 30, SEA_Y, flying ? age : 5000);
    }
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
    const shownCounter = flying ? (flying.done > 0 ? p.events[flying.done - 1].counter : 0) : p.counter;
    drawCounter(shownCounter, p, !p.landed && !!outcomeAt);
    // Ergebnis groß anzeigen
    if (outcomeAt) {
      const k = clamp01((now - outcomeAt) / 250);
      if (p.landed) drawBanner(`🛬 GELANDET! ×${fmt(p.counter)}`, '#2fa866', k);
      else drawBanner('🌊 ABGESTÜRZT – Schiff verfehlt', '#c62828', k);
    } else if (t > n + 0.2) {
      drawBanner('Landeanflug …', 'rgba(0, 0, 0, 0.45)', 1);
    }
  }

  function drawBanner(text, color, k) {
    ctx.save();
    ctx.globalAlpha = k;
    ctx.font = '900 30px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + 48;
    const cx = W / 2 + 60;
    const cy = 70;
    ctx.fillStyle = color;
    // Abgerundetes Rechteck selbst zeichnen (ctx.roundRect gibt es erst ab Safari 16)
    const x0 = cx - w / 2;
    const y0 = cy - 28;
    const r = 16;
    ctx.beginPath();
    ctx.moveTo(x0 + r, y0);
    ctx.arcTo(x0 + w, y0, x0 + w, y0 + 56, r);
    ctx.arcTo(x0 + w, y0 + 56, x0, y0 + 56, r);
    ctx.arcTo(x0, y0 + 56, x0, y0, r);
    ctx.arcTo(x0, y0, x0 + w, y0, r);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 6;
    ctx.fillText(text, cx, cy + 1);
    ctx.restore();
  }

  function drawSmoke(x, y, now, k) {
    for (let j = 0; j < 6; j++) {
      const off = ((now / 6) % 30) + j * 30;
      ctx.globalAlpha = Math.max(0, 0.55 - j * 0.09) * Math.min(1, k * 3);
      ctx.fillStyle = '#4a4a4a';
      ctx.beginPath();
      ctx.arc(x - 40 - off, y - 12 - j * 5, 9 + j * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawCounter(counter, p, lost) {
    const bet = p ? p.bet : state().bet;
    ctx.font = '900 22px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText('Gewinn', 24, 40);
    ctx.font = '900 48px system-ui, sans-serif';
    ctx.fillStyle = lost ? 'rgba(255, 255, 255, 0.55)' : '#ffe58a';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 10;
    const text = counter == null ? '–' : GK.formatNumber(Math.floor(counter * bet));
    ctx.fillText(text, 24, 90);
    ctx.shadowBlur = 0;
    if (lost) {
      ctx.strokeStyle = '#ff5a3a';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(20, 74);
      ctx.lineTo(28 + ctx.measureText(text).width, 74);
      ctx.stroke();
    }
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
    if (age < 900) {
      const k = age / 900;
      ctx.fillStyle = `rgba(210, 240, 255, ${0.9 * (1 - k)})`;
      for (let i = 0; i < 11; i++) {
        const dx = (i - 5) * 9 * (0.4 + k);
        const up = (1 - Math.abs(i - 5) / 6) * 90;
        ctx.beginPath();
        ctx.arc(x + dx, y - up * (k * 2 - k * k * 1.6) - 4, 6 * (1 - k * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Ringe und Blasen auf dem Wasser
    const r = Math.min(1, age / 1200);
    ctx.strokeStyle = 'rgba(220, 245, 255, 0.6)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(x, y + 6, 20 + 50 * r, 5 + 8 * r, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(220, 245, 255, 0.7)';
    [[-14, 2], [6, -2], [18, 4]].forEach(([dx, dy], i) => {
      ctx.beginPath();
      ctx.arc(x + dx, y + dy + 4 - ((age / 12 + i * 9) % 12), 3, 0, Math.PI * 2);
      ctx.fill();
    });
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
    ended = null;
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
