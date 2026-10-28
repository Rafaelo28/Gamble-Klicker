// Flugkapitän: Ein Flugzeug startet vom Flugzeugträger und fliegt übers Meer. Die Flugbahn ist jedes
// Mal anders: Boni (+1, +2, +5, +10) und Multiplikatoren (×2 bis ×5) erhöhen den Multiplikator und geben
// Auftrieb, ÷2-Zeichen und Raketen halbieren ihn und lassen das Flugzeug absacken. Am Ende muss es auf
// dem Flugzeugträger landen – dann gibt es Einsatz × Multiplikator, sonst stürzt es ins Meer.
// Vier Geschwindigkeiten: je schneller, desto länger der Flug und desto höher (aber unsicherer) der Gewinn.
// Der ganze Flug steht beim Start fest und wird gespeichert – Neuladen zahlt trotzdem aus.
window.GK = window.GK || {};

(function () {
  const MIN_BET = 10;
  const RTP = 0.97;
  const START = 1;   // Multiplikator beim Abflug
  // Ereignisse: Anteil und mögliche Werte. „cut“ halbiert – als ÷2-Zeichen oder als Rakete.
  const EVENT_TYPES = [
    { type: 'add', weight: 42, values: [[1, 66], [2, 24], [5, 8], [10, 2]] },
    { type: 'mult', weight: 8, values: [[2, 60], [3, 25], [4, 10], [5, 5]] },
    { type: 'cut', weight: 50, values: [[2, 1]] },
  ];
  const MODES = {
    slow:   { name: 'Gemütlich', icon: '🐢', events: [3, 5],   step: 1050 },
    normal: { name: 'Normal',    icon: '🏃', events: [5, 8],   step: 850 },
    fast:   { name: 'Schnell',   icon: '🐇', events: [7, 11],  step: 650 },
    turbo:  { name: 'Turbo',     icon: '⚡', events: [10, 15], step: 480 },
  };
  const W = 900;
  const H = 480;
  const SCALE = 1.5;
  const PLANE_X = 230;
  const SEA_Y = H - 70;
  const UNIT = 260;         // so viele Pixel legt das Flugzeug pro Zeiteinheit zurück
  const DECK_A = 64;        // Höhe über dem Meer, wenn das Flugzeug auf dem Deck steht
  const LOW = 100;          // Flugkorridor (Höhe über dem Meer in Pixeln)
  const HIGH = 330;
  const TAKEOFF = 1;        // Dauer des Starts
  const METERS = 2.5;       // Pixel → Meter für die Anzeige
  const DIST_METERS = 150;  // Meter pro Zeiteinheit

  let els = {};
  let betControl;
  let ctx;
  let flying = null;   // laufende Animation
  let ended = null;    // Endbild des letzten Flugs (bleibt bis zum nächsten Start stehen)
  let clouds = [];
  let islands = [];
  let hudText = {};

  function state() {
    return GK.casino.data('flight', () => ({ bet: 100, mode: 'normal', pending: null, history: [] }));
  }

  // ---------- Mathematik (auch für Tests) ----------

  const sum = arr => arr.reduce((a, b) => a + b, 0);

  function expectedValue(values) {
    const total = sum(values.map(v => v[1]));
    return sum(values.map(([v, w]) => v * w)) / total;
  }

  // Erwarteter Multiplikator nach n Ereignissen (exakt, die Ereignisse sind unabhängig)
  function expectedCounter(n) {
    const total = sum(EVENT_TYPES.map(e => e.weight));
    const [add, mult, cut] = EVENT_TYPES.map(e => e.weight / total);
    const addValue = expectedValue(EVENT_TYPES[0].values);
    const multValue = expectedValue(EVENT_TYPES[1].values);
    const cutValue = expectedValue(EVENT_TYPES[2].values.map(([v, w]) => [1 / v, w]));
    let e = START;
    for (let i = 0; i < n; i++) e = add * (e + addValue) + mult * multValue * e + cut * cutValue * e;
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

  function pickType() {
    let roll = GK.rng.float() * sum(EVENT_TYPES.map(e => e.weight));
    for (const e of EVENT_TYPES) {
      if (roll < e.weight) return e;
      roll -= e.weight;
    }
    return EVENT_TYPES[EVENT_TYPES.length - 1];
  }

  // Einen ganzen Flug auslosen. at = Zeitpunkt, an dem das Flugzeug das Ereignis erreicht.
  function makeFlight(mode) {
    const [lo, hi] = MODES[mode].events;
    const n = lo + GK.rng.int(hi - lo + 1);
    const events = [];
    let counter = START;
    let at = 0.6;
    for (let i = 0; i < n; i++) {
      const kind = pickType();
      const value = pick(kind.values);
      at += i === 0 ? 1 + GK.rng.float() * 0.5 : 0.75 + GK.rng.float() * 0.6;
      let type = kind.type;
      if (type === 'add') counter += value;
      else if (type === 'mult') counter *= value;
      else {
        counter /= value;
        type = GK.rng.float() < 0.5 ? 'div' : 'rocket';
      }
      events.push({ type, value, counter, at: Math.round(at * 100) / 100 });
    }
    return { events, counter, landed: GK.rng.float() < landingChance(mode) };
  }

  // ---------- Flugbahn ----------

  // Auftrieb bzw. Absacken durch ein Ereignis (Pixel pro Zeiteinheit)
  function impulse(e) {
    if (e.type === 'add') return 100 + 10 * e.value;
    if (e.type === 'mult') return 150 + 25 * e.value;
    return e.type === 'rocket' ? -185 : -145;
  }

  // Flugbahn als kleine Physik-Simulation: das Flugzeug sinkt langsam, Wind lässt es schaukeln,
  // Boni geben Schub nach oben, ÷2 und Raketen drücken es nach unten. Jeder Flug sieht anders aus.
  const DT = 0.02;
  function buildPath(events) {
    const end = events[events.length - 1].at;
    const count = Math.ceil(end / DT) + 2;
    const alt = new Array(count);
    const cruise = 170 + Math.random() * 70;
    const winds = [0, 1].map(() => ({ f: 0.3 + Math.random() * 0.5, p: Math.random() * 6.3, s: 60 + Math.random() * 80 }));
    let a = DECK_A;
    let v = 0;
    let next = 0;
    for (let i = 0; i < count; i++) {
      const t = i * DT;
      if (t <= TAKEOFF) {
        a = DECK_A + (cruise - DECK_A) * smooth(t / TAKEOFF);
        v = 0;
      } else {
        let acc = -18 - v * 1.4;
        winds.forEach(w => { acc += w.s * Math.sin(w.f * 6.283 * t + w.p); });
        if (a < LOW + 40) acc += (LOW + 40 - a) * 12;
        if (a > HIGH - 40) acc -= (a - HIGH + 40) * 12;
        v += acc * DT;
        a += v * DT;
      }
      while (next < events.length && events[next].at <= t + 1e-9) {
        v += impulse(events[next]);
        next++;
      }
      if (t > TAKEOFF) {
        if (a < LOW) {
          a = LOW;
          v = Math.max(v, 0);
        }
        if (a > HIGH) {
          a = HIGH;
          v = Math.min(v, 0);
        }
      }
      alt[i] = a;
    }
    return { alt, end };
  }

  function altAt(path, t) {
    const x = Math.max(0, Math.min(t, path.end)) / DT;
    const i = Math.floor(x);
    const last = path.alt.length - 1;
    const a0 = path.alt[Math.min(i, last)];
    const a1 = path.alt[Math.min(i + 1, last)];
    return a0 + (a1 - a0) * (x - i);
  }

  // Symbole, an denen das Flugzeug vorbeifliegt (deutlich über oder unter der Flugbahn)
  function buildDecoys(events, path) {
    const list = [];
    let t = 2.2;
    while (t < path.end - 0.5) {
      if (!events.some(e => Math.abs(e.at - t) < 0.45)) {
        const off = 110 + Math.random() * 60;
        const near = [-0.3, -0.15, 0, 0.15, 0.3].map(d => altAt(path, t + d));
        const fits = a => a >= 70 && a <= 345 && near.every(n => Math.abs(n - a) >= 90);
        const a = altAt(path, t);
        const sides = [a + off, a - off].filter(fits);
        if (sides.length) {
          const r = Math.random();
          const kind = r < 0.5 ? { type: 'add', value: [1, 1, 2, 5, 10][Math.floor(Math.random() * 5)] }
            : r < 0.72 ? { type: 'mult', value: 2 + Math.floor(Math.random() * 4) }
            : { type: 'div', value: 2 };
          list.push(Object.assign({ at: t, a: sides[Math.floor(Math.random() * sides.length)] }, kind));
        }
      }
      t += 0.55 + Math.random() * 0.5;
    }
    return list;
  }

  // ---------- Ablauf ----------

  function start() {
    const s = state();
    if (s.pending || flying) return;
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
    updateMoney();
    GK.sound.play('spinStart');
    ended = null;
    const path = buildPath(f.events);
    flying = {
      p: s.pending, path, decoys: buildDecoys(f.events, path), start: performance.now(),
      done: 0, effects: [], sputter: false, outcomeAt: 0, hitAt: 0,
    };
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
    const mult = fmt(p.counter);
    GK.casino.record('flight', p.bet, p.payout, p.landed ? `🛬 Gelandet mit ×${mult}` : `🌊 Ins Meer gestürzt (×${mult})`);
    if (p.landed && p.payout > 0) {
      showMessage(`🛬 Sicher gelandet! Gewinn: ${GK.formatMoneyHTML(p.payout)} (×${mult})`, p.payout >= p.bet ? 'win' : '');
      if (animated && p.payout >= p.bet) GK.fx.celebrate(p.payout, p.bet, { el: els.canvas, subtitle: `Landung mit ×${mult}` });
    } else if (p.landed) {
      showMessage('🛬 Gelandet – aber ohne Beute.', '');
    } else {
      showMessage(`🌊 Knapp vorbei – das Flugzeug ist ins Meer gestürzt. (×${mult} wären es gewesen)`, 'loss');
      if (animated) GK.sound.play('lose');
    }
    drawHistory();
    updateButtons();
    updateMoney();
  }

  // ---------- Darstellung ----------

  function fmt(m) {
    return m.toLocaleString('de-DE', { minimumFractionDigits: m < 10 ? 2 : 0, maximumFractionDigits: 2 });
  }

  // Landeanflug: so lange nach dem letzten Ereignis setzt das Flugzeug auf (oder stürzt ab),
  // danach wird abgerechnet
  const APPROACH = 2.2;
  const END = 3.6;

  function frame(now) {
    if (!flying) return;
    const f = flying;
    const p = f.p;
    const fast = GK.state.settings.effects === 'reduced';
    const step = MODES[p.mode].step * (fast ? 0.4 : 1);
    const t = (now - f.start) / step;          // in Zeiteinheiten
    const n = p.events.length;
    const end = f.path.end;
    // Ereignisse, die das Flugzeug erreicht hat
    while (f.done < n && t >= p.events[f.done].at) {
      const e = p.events[f.done];
      f.done++;
      f.effects.push({ type: e.type, value: e.value, at: now, y: SEA_Y - altAt(f.path, e.at) });
      if (e.type === 'add') GK.sound.play('gem', 0.9 + Math.min(e.value, 5) * 0.06);
      else if (e.type === 'mult') GK.sound.play('powerup');
      else if (e.type === 'div') GK.sound.play('denied');
      else {
        f.hitAt = now;
        GK.sound.play('boom');
        GK.fx.shake('small');
      }
    }
    // Absturz kündigt sich an: der Motor stottert
    if (!p.landed && !f.sputter && t >= end + 0.9) {
      f.sputter = true;
      GK.sound.play('denied');
    }
    // Aufsetzen bzw. Aufprall aufs Wasser
    if (!f.outcomeAt && t >= end + APPROACH) {
      f.outcomeAt = now;
      if (p.landed) GK.sound.play('reelStop');
      else {
        GK.sound.play('boom');
        GK.fx.shake('small');
      }
    }
    if (t >= end + END) {
      // Das Endbild bleibt stehen, bis der nächste Flug startet
      flying = null;
      // Endbild mit fertigem Banner – auch wenn die Animation übersprungen wurde (z. B. App gewechselt)
      ended = { p, path: f.path, decoys: f.decoys, t: end + END, outcomeAt: Math.min(f.outcomeAt || now, now - 1000) };
      settle(true);
      draw(now);
      return;
    }
    draw(now, t);
    requestAnimationFrame(frame);
  }

  const smooth = k => k * k * (3 - 2 * k);
  const clamp01 = k => Math.max(0, Math.min(1, k));

  // Höhe (über dem Meer) und Bildschirm-x des Flugzeugs zu jedem Zeitpunkt, auch im Landeanflug
  function planeAt(sc, t) {
    const p = sc.p;
    const path = sc.path;
    const end = path.end;
    let x = PLANE_X;
    let a;
    if (t <= end) a = altAt(path, t);
    else {
      const k = clamp01((t - end) / APPROACH);
      const aEnd = altAt(path, end);
      if (p.landed) {
        // Sinkflug aufs Deck, aufsetzen, ausrollen
        a = aEnd + (DECK_A - aEnd) * smooth(k);
        const r = clamp01((t - end - APPROACH) / 0.9);
        x += 40 * (1 - (1 - r) * (1 - r));
        a += 7 * Math.sin(Math.PI * r) * (1 - r);
      } else {
        // Motor stottert, das Flugzeug sackt durch und stürzt vor dem Schiff ins Meer
        const mid = aEnd + (DECK_A - aEnd) * 0.35;
        const drop = clamp01((k - 0.35) / 0.65);
        a = aEnd + (mid - aEnd) * smooth(Math.min(1, k / 0.35)) + (-10 - mid) * drop * drop;
      }
    }
    return { x, a };
  }

  // Neigung aus der Flugrichtung (das Bild zieht mit UNIT Pixeln pro Zeiteinheit vorbei)
  function tiltAt(sc, t) {
    const h = 0.04;
    const p0 = planeAt(sc, t - h);
    const p1 = planeAt(sc, t + h);
    const tilt = Math.atan2(p0.a - p1.a, p1.x - p0.x + 2 * h * UNIT);
    return Math.max(-0.6, Math.min(0.9, tilt));
  }

  // Wo das Zielschiff gerade ist: bei einer Landung bremst es genau unter dem Flugzeug,
  // bei einem Absturz ist es noch zu weit weg
  function targetShipX(p, end, t) {
    const from = W + 150;
    const to = p.landed ? PLANE_X - 30 : PLANE_X + 360;
    const u = clamp01((t - (end - 0.6)) / (APPROACH + 0.6));
    return from + (to - from) * (1 - (1 - u) * (1 - u));
  }

  function draw(now = performance.now(), tNow = null) {
    if (!ctx) return;
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const sc = flying || ended;
    const t = sc ? (flying ? tNow : sc.t) : 0;
    const scroll = t * UNIT;
    drawSky(scroll, now);

    if (!sc) {
      // Ruhezustand: Flugzeug steht auf dem Träger
      drawShip(PLANE_X - 40);
      drawPlane(PLANE_X, SEA_Y - DECK_A, 0, false);
      const bet = state().bet;
      drawWinLabel(PLANE_X, SEA_Y - DECK_A, bet, START, false);
      updateHud(0, 0, START);
      return;
    }
    const p = sc.p;
    const path = sc.path;
    const end = path.end;
    // Startschiff zieht nach links weg, Zielschiff kommt am Ende von rechts
    if (t < 2) drawShip(PLANE_X - 40 - scroll);
    if (t > end - 1) drawShip(targetShipX(p, end, t));
    // Symbole, an denen das Flugzeug vorbeifliegt
    sc.decoys.forEach(d => {
      const x = PLANE_X + (d.at - t) * UNIT;
      if (x > -60 && x < W + 60) drawSymbol(x, SEA_Y - d.a, d, now, 0.85);
    });
    // Symbole auf der Flugbahn (werden eingesammelt) und Raketen, die auf das Flugzeug zufliegen
    p.events.forEach(e => {
      const dist = e.at - t;
      if (dist < 0) return;
      const y = SEA_Y - altAt(path, e.at);
      if (e.type === 'rocket') {
        const x = PLANE_X + 50 + dist * UNIT * 1.8;
        if (x < W + 80) drawRocket(x, y, now);
      } else {
        const x = PLANE_X + dist * UNIT;
        if (x < W + 60) drawSymbol(x, y, e, now, 1);
      }
    });
    // Flugzeug
    const outcomeAt = flying ? flying.outcomeAt : sc.outcomeAt;
    const pos = planeAt(sc, t);
    let y = SEA_Y - pos.a;
    let tilt = tiltAt(sc, t);
    const crashed = !p.landed && outcomeAt;
    if (!p.landed && t > end) tilt += clamp01((t - end) / APPROACH - 0.35) * 0.4;
    // Kondensstreifen
    if (!crashed && t > 0.3) drawTrail(sc, t);
    if (!p.landed && t > end + APPROACH * 0.35 && !outcomeAt) drawSmoke(pos.x, y, now, clamp01((t - end) / APPROACH - 0.35));
    // Nach einem Raketentreffer wackelt das Flugzeug kurz
    const hitAge = flying && flying.hitAt ? now - flying.hitAt : 9999;
    if (hitAge < 500) y += Math.sin(hitAge / 25) * 6 * (1 - hitAge / 500);
    if (!crashed) drawPlane(pos.x, y, tilt, true);
    else {
      // Versinken: nur der Teil über dem Wasser ist zu sehen
      const age = now - outcomeAt;
      if (flying && age < 900) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, W, SEA_Y);
        ctx.clip();
        drawPlane(pos.x + age / 30, SEA_Y + 6 + age / 18, 0.95, false);
        ctx.restore();
      }
      drawSplash(PLANE_X + 30, SEA_Y, flying ? age : 5000);
    }
    const done = flying ? flying.done : p.events.length;
    const counter = done > 0 ? p.events[done - 1].counter : START;
    if (flying) drawEffects(now);
    if (!crashed) drawWinLabel(pos.x, y, p.bet, counter, false);
    // Ergebnis groß anzeigen
    if (outcomeAt) {
      const k = clamp01((now - outcomeAt) / 250);
      if (p.landed) drawBanner(`🛬 GELANDET! ×${fmt(p.counter)}`, '#2fa866', k);
      else drawBanner('🌊 ABGESTÜRZT – Träger verfehlt', '#c62828', k);
    } else if (t > end + 0.2) {
      drawBanner('Landeanflug …', 'rgba(0, 0, 0, 0.45)', 1);
    }
    updateHud(crashed ? 0 : pos.a - DECK_A, Math.min(t, end + APPROACH) * DIST_METERS, counter);
  }

  function drawSky(scroll, now) {
    // Wolken (ziehen nach links, nahe schneller als ferne)
    clouds.forEach(c => {
      const x = ((c.x - scroll * 0.45 * c.z - now * 0.004 * c.z) % (W + 200) + W + 200) % (W + 200) - 100;
      ctx.globalAlpha = 0.25 + c.z * 0.35;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.ellipse(x, c.y, 60 * c.z + 20, 16 * c.z + 6, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 30 * c.z, c.y - 10, 34 * c.z + 10, 14 * c.z + 6, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    // Inseln am Horizont
    islands.forEach(isl => {
      const x = ((isl.x - scroll * 0.12) % (W + 600) + W + 600) % (W + 600) - 300;
      ctx.fillStyle = 'rgba(40, 110, 90, 0.55)';
      ctx.beginPath();
      ctx.ellipse(x, SEA_Y + 2, isl.w, isl.h, 0, Math.PI, 0);
      ctx.fill();
      ctx.font = `${Math.round(isl.h * 0.9)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('🌴', x - isl.w * 0.3, SEA_Y - isl.h + 6);
    });
    // Meer
    const sea = ctx.createLinearGradient(0, SEA_Y, 0, H);
    sea.addColorStop(0, '#1b6f9a');
    sea.addColorStop(1, '#073248');
    ctx.fillStyle = sea;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 20) ctx.lineTo(x, SEA_Y + Math.sin((x + scroll * 0.8) / 35 + now / 700) * 4);
    ctx.lineTo(W, H);
    ctx.fill();
    // Schaumkronen
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    for (let i = 0; i < 9; i++) {
      const x = ((i * 137 - scroll * 0.8) % W + W) % W;
      ctx.fillRect(x, SEA_Y + 18 + (i % 3) * 16, 26, 3);
    }
  }

  function drawTrail(sc, t) {
    ctx.save();
    ctx.lineCap = 'round';
    for (let k = 1; k <= 14; k++) {
      const tt = t - k * 0.06;
      if (tt < 0.2) break;
      const a = planeAt(sc, tt).a;
      const b = planeAt(sc, tt + 0.06).a;
      const x0 = PLANE_X - 48 - k * 0.06 * UNIT;
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.4 * (1 - k / 15)})`;
      ctx.lineWidth = 5 - k * 0.25;
      ctx.beginPath();
      ctx.moveTo(x0, SEA_Y - a);
      ctx.lineTo(x0 + 0.06 * UNIT, SEA_Y - b);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Treffer-Effekte: Ring, aufsteigende Zahl, bei Raketen eine Explosion
  function drawEffects(now) {
    flying.effects = flying.effects.filter(fx => now - fx.at < 1000);
    flying.effects.forEach(fx => {
      const k = (now - fx.at) / 1000;
      const good = fx.type === 'add' || fx.type === 'mult';
      const color = fx.type === 'mult' ? '#d9a6ff' : good ? '#ffe58a' : '#ff6b4a';
      ctx.save();
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(PLANE_X + 20, fx.y, 20 + k * 70, 0, Math.PI * 2);
      ctx.stroke();
      if (fx.type === 'rocket' && k < 0.6) {
        const e = k / 0.6;
        [['#fff3b0', 0.5], ['#ffb03a', 0.8], ['#ff5a2a', 1]].forEach(([c, s]) => {
          ctx.globalAlpha = (1 - e) * 0.9;
          ctx.fillStyle = c;
          ctx.beginPath();
          ctx.arc(PLANE_X + 46, fx.y, (14 + e * 46) * s, 0, Math.PI * 2);
          ctx.fill();
        });
      }
      ctx.globalAlpha = 1 - k * k;
      ctx.font = '900 34px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const text = fx.type === 'add' ? `+${fx.value}` : fx.type === 'mult' ? `×${fx.value}` : '÷2';
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.strokeText(text, PLANE_X + 20, fx.y - 40 - k * 60);
      ctx.fillStyle = color;
      ctx.fillText(text, PLANE_X + 20, fx.y - 40 - k * 60);
      ctx.restore();
    });
  }

  function roundRect(x0, y0, w, h, r) {
    // Abgerundetes Rechteck selbst zeichnen (ctx.roundRect gibt es erst ab Safari 16)
    ctx.beginPath();
    ctx.moveTo(x0 + r, y0);
    ctx.arcTo(x0 + w, y0, x0 + w, y0 + h, r);
    ctx.arcTo(x0 + w, y0 + h, x0, y0 + h, r);
    ctx.arcTo(x0, y0 + h, x0, y0, r);
    ctx.arcTo(x0, y0, x0 + w, y0, r);
    ctx.closePath();
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
    roundRect(cx - w / 2, cy - 28, w, 56, 16);
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

  // Aktueller Gewinn als Schild über (oder bei großer Höhe unter) dem Flugzeug
  function drawWinLabel(x, y, bet, counter, lost) {
    const text = GK.formatNumber(Math.floor(bet * counter));
    ctx.save();
    ctx.font = '900 26px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const w = Math.max(96, ctx.measureText(text).width + 34);
    const cy = y < 140 ? y + 64 : y - 66;
    ctx.fillStyle = 'rgba(10, 25, 40, 0.78)';
    roundRect(x - w / 2, cy - 22, w, 44, 12);
    ctx.fill();
    ctx.strokeStyle = counter >= START ? 'rgba(255, 217, 94, 0.85)' : 'rgba(255, 120, 90, 0.85)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = lost ? 'rgba(255, 255, 255, 0.55)' : '#ffe58a';
    ctx.fillText(text, x, cy + 1);
    ctx.restore();
  }

  function drawPlane(x, y, tilt, running) {
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

  // Flugzeugträger mit Landebahn und Brücke (die Brücke steht vorne, vor dem Landeplatz)
  function drawShip(x) {
    const deck = SEA_Y - 40;
    ctx.fillStyle = '#4a5560';
    ctx.beginPath();
    ctx.moveTo(x - 120, deck);
    ctx.lineTo(x + 200, deck);
    ctx.lineTo(x + 164, SEA_Y + 14);
    ctx.lineTo(x - 96, SEA_Y + 14);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#2f373f';
    ctx.fillRect(x - 120, deck - 6, 320, 8);
    // Mittellinie der Landebahn
    ctx.fillStyle = '#f2f2f2';
    for (let i = -104; i < 140; i += 28) ctx.fillRect(x + i, deck - 3, 14, 2);
    // Landelichter
    ctx.fillStyle = '#ffd95e';
    for (let i = -116; i < 200; i += 32) ctx.fillRect(x + i, deck - 7, 4, 3);
    // Brücke mit Flagge
    ctx.fillStyle = '#5f6b76';
    ctx.fillRect(x + 150, deck - 42, 28, 36);
    ctx.fillStyle = '#9fd8ff';
    ctx.fillRect(x + 154, deck - 36, 20, 6);
    ctx.fillStyle = '#5f6b76';
    ctx.fillRect(x + 162, deck - 58, 3, 16);
    ctx.font = '22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('🏴‍☠️', x + 174, deck - 56);
  }

  // Bonus (+), Multiplikator (×) oder ÷2 als leuchtende Kugel
  function drawSymbol(x, y, e, now, alpha) {
    const colors = { add: ['rgba(255, 229, 138, 0.95)', '#fff6c8'], mult: ['rgba(194, 123, 255, 0.95)', '#f1dcff'], div: ['rgba(255, 80, 60, 0.95)', '#ffd0c8'] };
    const [glow, text] = colors[e.type];
    const r = 24 + Math.sin(now / 200 + x / 50) * 2;
    ctx.save();
    ctx.globalAlpha = alpha;
    const g = ctx.createRadialGradient(x, y, 4, x, y, r + 14);
    g.addColorStop(0, glow);
    g.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r + 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '900 26px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = e.type === 'add' ? `+${e.value}` : e.type === 'mult' ? `×${e.value}` : '÷2';
    // Dunkler Rand, damit „÷2“ nicht wie ein Bonus „+2“ aussieht
    ctx.lineWidth = 5;
    ctx.strokeStyle = e.type === 'div' ? 'rgba(60, 0, 0, 0.9)' : 'rgba(0, 0, 0, 0.6)';
    ctx.strokeText(label, x, y);
    ctx.fillStyle = e.type === 'div' ? '#ff5a3a' : text;
    ctx.fillText(label, x, y);
    ctx.restore();
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
    ctx.font = '900 24px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
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

  // Anzeige unter dem Flugfeld (nur neu schreiben, wenn sich etwas ändert)
  function setText(key, html) {
    if (hudText[key] === html) return;
    hudText[key] = html;
    els[key].innerHTML = html;
  }

  function updateHud(altitude, distance, counter) {
    if (!els.alt) return;
    setText('alt', `${GK.formatNumber(Math.max(0, Math.round(altitude * METERS)))} m`);
    setText('dist', `${GK.formatNumber(Math.max(0, Math.round(distance)))} m`);
    setText('mult', `×${fmt(counter)}`);
    els.mult.classList.toggle('low', counter < START);
  }

  function updateMoney() {
    if (!els.balance) return;
    const p = state().pending;
    setText('balance', GK.formatMoneyHTML(GK.state.money));
    setText('total', GK.formatMoneyHTML(p ? p.bet : state().bet));
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
      const active = b.dataset.mode === state().mode;
      b.classList.toggle('active', active);
      b.setAttribute('aria-pressed', active);
      b.disabled = busy;
    });
    betControl.setDisabled(busy);
  }

  function init(body) {
    body.innerHTML = `
      <div class="crash-layout">
        <div class="crash-scene flight-scene">
          <canvas class="flight-canvas" width="${W * SCALE}" height="${H * SCALE}"></canvas>
          <div class="flight-hud">
            <div class="fh-stats">
              <div class="fh-stat"><span class="fh-label">Höhe</span><b class="fh-alt"></b></div>
              <div class="fh-stat"><span class="fh-label">Distanz</span><b class="fh-dist"></b></div>
              <div class="fh-stat"><span class="fh-label">Multiplikator</span><b class="fh-mult"></b></div>
            </div>
            <div class="fh-money"><span class="fh-label">Guthaben</span><b class="fh-balance"></b></div>
            <div class="fh-speeds" role="group" aria-label="Fluggeschwindigkeit">
              ${Object.entries(MODES).map(([id, m]) => `<button type="button" class="fh-speed flight-mode" data-mode="${id}" title="${m.name}" aria-label="${m.name}"><span class="fh-icon">${m.icon}</span><span class="fh-name">${m.name}</span></button>`).join('')}
            </div>
            <div class="fh-money right"><span class="fh-label">Gesamteinsatz</span><b class="fh-total"></b></div>
          </div>
          <div class="crash-history flight-history"></div>
        </div>
        <div class="crash-controls">
          <div class="game-message">&nbsp;</div>
          <div class="flight-bet"></div>
          <div class="game-actions">
            <button class="btn btn-primary btn-big flight-start">✈️ Abheben!</button>
          </div>
          <p class="muted small">Dein Flugzeug startet mit ×1. Unterwegs erhöhen +1, +2, +5 und +10 den
            Multiplikator, ×2 bis ×5 vervielfachen ihn – und geben Auftrieb. ÷2 und Raketen halbieren ihn und
            lassen das Flugzeug absacken. Landet es am Ende auf dem Flugzeugträger, bekommst du Einsatz ×
            Multiplikator – stürzt es ins Meer, ist der Einsatz weg. Schnellere Flüge sind länger und können
            mehr bringen.</p>
        </div>
      </div>`;
    els = {
      canvas: body.querySelector('.flight-canvas'),
      history: body.querySelector('.flight-history'),
      message: body.querySelector('.game-message'),
      start: body.querySelector('.flight-start'),
      modes: [...body.querySelectorAll('.flight-mode')],
      alt: body.querySelector('.fh-alt'),
      dist: body.querySelector('.fh-dist'),
      mult: body.querySelector('.fh-mult'),
      balance: body.querySelector('.fh-balance'),
      total: body.querySelector('.fh-total'),
    };
    hudText = {};
    ctx = els.canvas.getContext('2d');
    clouds = Array.from({ length: 9 }, () => ({ x: Math.random() * W, y: 40 + Math.random() * 250, z: 0.3 + Math.random() * 0.7 }));
    islands = Array.from({ length: 3 }, (_, i) => ({ x: i * 520 + Math.random() * 200, w: 50 + Math.random() * 60, h: 14 + Math.random() * 12 }));
    betControl = GK.casino.createBetControl(body.querySelector('.flight-bet'), {
      min: MIN_BET,
      get: () => state().bet,
      set: v => {
        state().bet = v;
        updateMoney();
        if (!flying && !ended) draw();
      },
    });
    els.start.addEventListener('click', start);
    els.modes.forEach(btn => btn.addEventListener('click', () => {
      if (state().pending || flying) return;
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
    updateMoney();
    draw();
  }

  GK.casino.register({
    id: 'flight',
    category: 'quick',
    name: 'Flugkapitän',
    emoji: '✈️',
    desc: 'Sammle Multiplikatoren, weich Raketen aus und lande auf dem Flugzeugträger!',
    init,
    refresh,
    onShow: () => { if (!flying) draw(); },
    render: () => {
      if (!state().pending) betControl.refresh();
      updateMoney();
    },
  });

  // Für Tests
  GK.casino.flightMath = {
    MODES, EVENT_TYPES, START, expectedCounter, modeExpectation, landingChance, rtp, makeFlight,
    buildPath, altAt, buildDecoys, LOW, HIGH,
  };
})();
