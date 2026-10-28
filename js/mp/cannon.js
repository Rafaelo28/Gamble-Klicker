// Kanonenduell: Zwei Piratenschiffe, dazwischen eine Insel. Abwechselnd wird gefeuert – zielen wie mit
// einer Schleuder (ziehen und loslassen), der Wind ändert sich jede Runde. Wer das gegnerische Schiff
// zuerst versenkt (100 Lebenspunkte), gewinnt.
// Die Flugbahn wird nur mit + − × ÷ und Wurzel gerechnet: Jedes Gerät kommt auf exakt dieselbe Bahn.
// Der Gastgeber entscheidet, die anderen spielen den Schuss zur Anzeige nach.
window.GK = window.GK || {};

(function () {
  const W = 1000;
  const H = 500;
  const SEA = 420;             // Wasserlinie
  const GRAVITY = 400;         // Pixel/s²
  const MAX_SPEED = 680;       // Pixel/s bei voller Kraft
  const WIND_ACCEL = 70;       // Pixel/s² bei Windstärke 1
  const DT = 1 / 60;
  const MAX_STEPS = 900;
  const DIRECT = 40;           // Schaden bei einem direkten Treffer
  const BLAST = 80;            // Explosionsradius
  const BLAST_DAMAGE = 30;
  const HP = 100;
  const HULL = { w: 45, top: 385 };
  const MAST = { w: 5, top: 300 };

  // ---------- Spielfeld und Flugbahn ----------

  function makeIsland() {
    const cx = 500 + GK.rng.int(81) - 40;
    const h = 130 + GK.rng.int(61);
    const hw = 120 + GK.rng.int(51);
    const pts = [[-1, 0], [-0.6, 0.45], [-0.2, 0.95], [0.1, 1], [0.45, 0.55], [1, 0]];
    return pts.map(([fx, fy]) => [Math.round(cx + fx * hw), Math.round(SEA - fy * h)]);
  }

  // Höhe der Insel an der Stelle x (Wasserlinie, wenn dort keine Insel ist)
  function groundAt(island, x) {
    if (x <= island[0][0] || x >= island[island.length - 1][0]) return SEA;
    for (let i = 1; i < island.length; i++) {
      const [x1, y1] = island[i];
      const [x0, y0] = island[i - 1];
      if (x <= x1) return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
    }
    return SEA;
  }

  function muzzle(st, seat) {
    const p = st.players[seat];
    return { x: p.x + (seat === 0 ? 38 : -38), y: 378 };
  }

  function hitsShip(ship, x, y) {
    return (Math.abs(x - ship.x) <= HULL.w && y >= HULL.top && y <= SEA + 4) || (Math.abs(x - ship.x) <= MAST.w && y >= MAST.top && y < HULL.top);
  }

  // Schuss simulieren: Richtung (ux, uy) mit Länge 1, Kraft 0–1, Wind −1…1.
  // Ergebnis: Einschlag (x, y), was getroffen wurde und (auf Wunsch) die ganze Bahn
  function simulate(field, seat, ux, uy, power, wind, record) {
    const start = muzzle(field, seat);
    let x = start.x;
    let y = start.y;
    let vx = ux * power * MAX_SPEED;
    let vy = uy * power * MAX_SPEED;
    const path = record ? [[x, y]] : null;
    for (let step = 1; step <= MAX_STEPS; step++) {
      vx += wind * WIND_ACCEL * DT;
      vy += GRAVITY * DT;
      x += vx * DT;
      y += vy * DT;
      if (record) path.push([x, y]);
      for (let s = 0; s < field.players.length; s++) {
        if (s === seat && step < 12) continue; // die eigene Kanone verlassen
        if (hitsShip(field.players[s], x, y)) return { x, y, what: 'ship', ship: s, steps: step, path };
      }
      if (y >= groundAt(field.island, x)) return { x, y, what: y >= SEA - 0.5 ? 'water' : 'island', steps: step, path };
      if (x < -300 || x > W + 300) return { x, y, what: 'out', steps: step, path };
    }
    return { x, y, what: 'out', steps: MAX_STEPS, path };
  }

  // Schaden für jedes Schiff: direkter Treffer oder Explosion in der Nähe
  function damage(field, impact) {
    return field.players.map((p, s) => {
      if (impact.what === 'out') return 0;
      if (impact.what === 'ship' && impact.ship === s) return DIRECT;
      const dx = impact.x - p.x;
      const dy = impact.y - 400;
      const d = Math.sqrt(dx * dx + dy * dy);
      return d < BLAST ? Math.round(BLAST_DAMAGE * (1 - d / BLAST)) : 0;
    });
  }

  // ---------- Regeln ----------

  const newWind = () => Math.round(GK.rng.float() * 20 - 10) / 10;

  function create(seats) {
    const st = {
      players: seats.slice(0, 2).map((s, i) => ({
        id: s.id, name: s.name, avatar: s.avatar || '', isBot: !!s.isBot, skill: s.skill || 0.5,
        place: null, out: false, hp: HP, hits: 0, x: i === 0 ? 90 + GK.rng.int(81) : 830 + GK.rng.int(81),
      })),
      island: makeIsland(),
      turn: GK.rng.int(2), wind: newWind(), phase: 'aim', lastShot: null, shots: 0, log: [],
    };
    return st;
  }

  function act(st, seat, a) {
    if (st.phase !== 'aim' || st.turn !== seat || !a || a.type !== 'fire') return false;
    const dx = Number(a.dx);
    const dy = Number(a.dy);
    const power = Number(a.power);
    if (![dx, dy, power].every(Number.isFinite)) return false;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1e-6 || power < 0.05) return false;
    const ux = dx / len;
    const uy = dy / len;
    const pw = Math.min(1, power);
    const impact = simulate(st, seat, ux, uy, pw, st.wind, false);
    const dmg = damage(st, impact);
    const hpBefore = st.players.map(p => p.hp);
    st.players.forEach((p, s) => { p.hp = Math.max(0, p.hp - dmg[s]); });
    if (dmg[1 - seat] > 0) st.players[seat].hits++;
    st.shots++;
    st.lastShot = {
      seat, ux, uy, power: pw, wind: st.wind, what: impact.what, x: impact.x, y: impact.y, steps: impact.steps,
      damage: dmg, hpBefore, no: (st.lastShot ? st.lastShot.no : 0) + 1,
    };
    st.phase = 'flying';
    return true;
  }

  // Nach dem Flug: Sieg prüfen, sonst ist der andere dran (mit neuem Wind)
  function advance(st) {
    if (st.phase !== 'flying') return;
    const shooter = st.lastShot.seat;
    const sunk = st.players.map(p => p.hp <= 0);
    if (sunk[0] || sunk[1]) {
      // Versenken sich beide, gewinnt der Getroffene – wer schießt, trägt das Risiko
      const winner = sunk[1 - shooter] && !sunk[shooter] ? shooter : 1 - shooter;
      finish(st, winner, `🏆 ${st.players[winner].name} versenkt das gegnerische Schiff!`);
      return;
    }
    st.turn = 1 - shooter;
    st.wind = newWind();
    st.phase = 'aim';
  }

  function finish(st, winner, text) {
    st.players[winner].place = 1;
    st.players[1 - winner].place = 2;
    st.phase = 'finished';
    st.turn = -1;
    st.log.unshift(text);
  }

  function forfeit(st, seat) {
    if (st.phase === 'finished') return;
    st.players[seat].out = true;
    finish(st, 1 - seat, `${st.players[seat].name} streicht die Flagge.`);
  }

  // ---------- Computer-Gegner ----------

  function gauss() {
    let u = 0;
    while (u === 0) u = GK.rng.float();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * GK.rng.float());
  }

  // Viele Schüsse durchrechnen, den besten nehmen – und je nach Können daneben zielen
  function botAct(st, seat) {
    const me = st.players[seat];
    const foe = st.players[1 - seat];
    const sign = foe.x > me.x ? 1 : -1;
    let best = null;
    for (let k = 0.15; k <= 3.01; k += 0.07) {
      const len = Math.sqrt(1 + k * k);
      const ux = sign / len;
      const uy = -k / len;
      for (let power = 0.3; power <= 1.0001; power += 0.02) {
        const imp = simulate(st, seat, ux, uy, power, st.wind, false);
        const dmg = damage(st, imp);
        const score = dmg[1 - seat] * 10 - dmg[seat] * 12 - Math.abs(imp.x - foe.x) * 0.05;
        if (!best || score > best.score) best = { score, k, power };
      }
    }
    const sp = 0.02 + (1 - me.skill) * 0.1;
    const sk = 0.05 + (1 - me.skill) * 0.4;
    const k = Math.max(0.05, best.k + gauss() * sk);
    const len = Math.sqrt(1 + k * k);
    return { type: 'fire', dx: sign / len, dy: -k / len, power: Math.max(0.1, Math.min(1, best.power + gauss() * sp)) };
  }

  // Zeit abgelaufen: ein Schuss ins Blaue
  function timeout(st, seat) {
    const sign = st.players[1 - seat].x > st.players[seat].x ? 1 : -1;
    return { type: 'fire', dx: sign, dy: -1, power: 0.55 + GK.rng.float() * 0.3 };
  }

  // ---------- Darstellung ----------

  const esc = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const SCALE = 1.5;
  const COLORS = ['#f5c542', '#e0453a'];
  const MAX_PULL = 0.3;        // Ziehweg für volle Kraft (Anteil der Bildbreite)
  let shown = null;

  function setHtml(el, html) {
    if (el._html === html) return false;
    el._html = html;
    el.innerHTML = html;
    return true;
  }

  // Lebenspunkte zur Anzeige: während ein Schuss fliegt, noch die alten Werte
  function shownHp(container, v, seat) {
    const a = container._anim;
    if (a && v.lastShot && a.no === v.lastShot.no && performance.now() < a.impactAt) return v.lastShot.hpBefore[seat];
    return v.players[seat].hp;
  }

  function drawShip(g, p, seat, hp, now) {
    const bob = Math.sin(now / 600 + seat * 2) * 2;
    g.save();
    g.translate(p.x, bob);
    if (seat === 1) g.scale(-1, 1);
    const sinking = hp <= 0;
    if (sinking) {
      g.translate(0, 18);
      g.rotate(0.25);
    }
    // Rumpf
    g.fillStyle = '#5a3a1e';
    g.beginPath();
    g.moveTo(-50, 386);
    g.lineTo(52, 386);
    g.lineTo(40, 418);
    g.lineTo(-42, 418);
    g.closePath();
    g.fill();
    g.fillStyle = '#3a2412';
    g.fillRect(-50, 384, 102, 6);
    g.fillStyle = '#2a1a0c';
    for (let i = -30; i <= 30; i += 20) g.fillRect(i, 395, 7, 6);
    // Kanone
    g.fillStyle = '#222';
    g.fillRect(24, 374, 18, 7);
    // Mast und Segel
    g.fillStyle = '#4a3018';
    g.fillRect(-3, 300, 6, 86);
    g.fillStyle = '#f2ead6';
    g.beginPath();
    g.moveTo(-28, 312);
    g.quadraticCurveTo(-4, 330, -28, 372);
    g.lineTo(26, 372);
    g.quadraticCurveTo(46, 330, 26, 312);
    g.closePath();
    g.fill();
    g.fillStyle = COLORS[seat];
    g.beginPath();
    g.moveTo(3, 300);
    g.lineTo(30, 306);
    g.lineTo(3, 312);
    g.closePath();
    g.fill();
    g.restore();
  }

  function drawScene(container, g, v, ui, now) {
    // Himmel und Sonne
    const sky = g.createLinearGradient(0, 0, 0, SEA);
    sky.addColorStop(0, '#f7a35c');
    sky.addColorStop(0.55, '#f9d29a');
    sky.addColorStop(1, '#bfe3f2');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, SEA);
    g.fillStyle = 'rgba(255, 240, 200, 0.9)';
    g.beginPath();
    g.arc(820, 120, 46, 0, Math.PI * 2);
    g.fill();
    // Insel mit Palme
    g.fillStyle = '#d9b46a';
    g.beginPath();
    g.moveTo(v.island[0][0], SEA);
    v.island.forEach(([x, y]) => g.lineTo(x, y));
    g.closePath();
    g.fill();
    // Grün auf der oberen Hälfte, genau in der Form der Insel
    const top = v.island[3];
    g.save();
    g.beginPath();
    g.moveTo(v.island[0][0], SEA);
    v.island.forEach(([x, y]) => g.lineTo(x, y));
    g.closePath();
    g.clip();
    g.fillStyle = '#5f9a45';
    g.beginPath();
    g.moveTo(v.island[0][0], 0);
    for (let x = v.island[0][0]; x <= v.island[v.island.length - 1][0]; x += 12) g.lineTo(x, top[1] + (SEA - top[1]) * 0.5 + Math.sin(x / 9) * 4);
    g.lineTo(v.island[v.island.length - 1][0], 0);
    g.closePath();
    g.fill();
    g.restore();
    g.strokeStyle = '#6b4a22';
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(top[0], top[1] + 2);
    g.quadraticCurveTo(top[0] + 10, top[1] - 30, top[0] + 4, top[1] - 58);
    g.stroke();
    g.fillStyle = '#2f8a3a';
    for (let i = 0; i < 5; i++) {
      g.save();
      g.translate(top[0] + 4, top[1] - 58);
      g.rotate(-2.6 + i * 1.05 + Math.sin(now / 900 + i) * 0.05);
      g.beginPath();
      g.ellipse(22, 0, 24, 6, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    // Schiffe
    v.players.forEach((p, s) => drawShip(g, p, s, shownHp(container, v, s), now));
    // Meer mit Wellen
    g.fillStyle = '#1f5f8f';
    g.beginPath();
    g.moveTo(0, H);
    for (let x = 0; x <= W; x += 20) g.lineTo(x, SEA + Math.sin(x / 40 + now / 500) * 3);
    g.lineTo(W, H);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(255, 255, 255, 0.15)';
    g.fillRect(0, SEA + 14, W, 3);
    // Lebensbalken über den Schiffen
    v.players.forEach((p, s) => {
      const hp = shownHp(container, v, s);
      g.fillStyle = 'rgba(0, 0, 0, 0.55)';
      g.fillRect(p.x - 42, 272, 84, 12);
      g.fillStyle = hp > 50 ? '#5fd17a' : hp > 25 ? '#f5c542' : '#e0453a';
      g.fillRect(p.x - 40, 274, 80 * hp / HP, 8);
      g.fillStyle = '#fff';
      g.font = '700 15px system-ui, sans-serif';
      g.textAlign = 'center';
      g.fillText(`${hp}`, p.x, 266);
    });
    // Wind
    const wind = v.phase === 'flying' && v.lastShot ? v.lastShot.wind : v.wind;
    g.fillStyle = 'rgba(0, 0, 0, 0.35)';
    g.fillRect(W / 2 - 90, 14, 180, 40);
    g.fillStyle = '#fff';
    g.font = '700 17px system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText(`💨 Wind ${wind === 0 ? 'still' : (wind > 0 ? '→ ' : '← ') + Math.abs(wind).toFixed(1).replace('.', ',')}`, W / 2, 40);
    if (wind) {
      g.strokeStyle = '#bfe3ff';
      g.lineWidth = 4;
      const len = Math.abs(wind) * 70;
      const dir = wind > 0 ? 1 : -1;
      g.beginPath();
      g.moveTo(W / 2 - dir * len / 2, 64);
      g.lineTo(W / 2 + dir * len / 2, 64);
      g.lineTo(W / 2 + dir * (len / 2 - 8), 58);
      g.moveTo(W / 2 + dir * len / 2, 64);
      g.lineTo(W / 2 + dir * (len / 2 - 8), 70);
      g.stroke();
    }
  }

  function frame(container) {
    const canvas = container.querySelector('.duel-canvas');
    if (!canvas || !canvas.isConnected || !shown) {
      container._raf = null;
      return;
    }
    if (canvas.offsetParent !== null) {
      const { view: v, ui } = shown;
      const g = canvas.getContext('2d');
      const now = performance.now();
      g.setTransform(SCALE, 0, 0, SCALE, 0, 0);
      g.clearRect(0, 0, W, H);
      drawScene(container, g, v, ui, now);
      // Flug und Einschlag
      const a = container._anim;
      if (a) {
        const i = Math.floor((now - a.start) / (1000 * DT));
        if (i < a.path.length) {
          g.strokeStyle = 'rgba(60, 40, 30, 0.35)';
          g.lineWidth = 3;
          g.beginPath();
          a.path.slice(Math.max(0, i - 18), i + 1).forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y)));
          g.stroke();
          const [x, y] = a.path[Math.max(0, i)];
          g.fillStyle = '#1b1b1b';
          g.beginPath();
          g.arc(x, y, 7, 0, Math.PI * 2);
          g.fill();
        } else {
          if (!a.boomed) {
            a.boomed = true;
            GK.sound.play(a.what === 'water' || a.what === 'out' ? 'plink' : 'boom', 0.5);
            if (a.hitFoe) GK.fx.pulse(canvas, 'nope');
          }
          const k = (now - a.impactAt) / 900;
          if (k < 1 && a.what !== 'out') {
            const [x, y] = a.path[a.path.length - 1];
            if (a.what === 'water') {
              g.fillStyle = `rgba(220, 240, 255, ${1 - k})`;
              for (let j = 0; j < 7; j++) {
                g.beginPath();
                g.arc(x + (j - 3) * 9 * (0.5 + k), y - 40 * k * (1 - Math.abs(j - 3) / 4) - 4, 5, 0, Math.PI * 2);
                g.fill();
              }
            } else {
              g.fillStyle = `rgba(255, ${150 + 80 * k}, 60, ${1 - k})`;
              g.beginPath();
              g.arc(x, y, 18 + 50 * k, 0, Math.PI * 2);
              g.fill();
              g.fillStyle = `rgba(80, 80, 80, ${0.6 * (1 - k)})`;
              g.beginPath();
              g.arc(x, y - 30 * k, 12 + 30 * k, 0, Math.PI * 2);
              g.fill();
            }
            if (a.damageText) {
              g.fillStyle = `rgba(255, 90, 60, ${1 - k})`;
              g.font = '900 28px system-ui, sans-serif';
              g.textAlign = 'center';
              g.fillText(a.damageText, a.textX, 240 - 30 * k);
            }
          } else if (k >= 1) container._anim = null;
        }
      }
      // Zielen
      const aim = container._aim;
      const myTurn = v.phase === 'aim' && v.turn === ui.mySeat && !ui.ended;
      if (myTurn) {
        const m = muzzle(v, ui.mySeat);
        if (container._lastAim && !aim) drawAim(g, m, container._lastAim, 0.3);
        if (aim) drawAim(g, m, aim, 1);
      }
    }
    container._raf = requestAnimationFrame(() => frame(container));
  }

  function drawAim(g, m, aim, alpha) {
    const len = 50 + aim.power * 150;
    g.globalAlpha = alpha;
    g.strokeStyle = '#fff';
    g.lineWidth = 3;
    g.setLineDash([8, 7]);
    g.beginPath();
    g.moveTo(m.x, m.y);
    g.lineTo(m.x + aim.ux * len, m.y + aim.uy * len);
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = '#ffe066';
    g.beginPath();
    g.arc(m.x + aim.ux * len, m.y + aim.uy * len, 6, 0, Math.PI * 2);
    g.fill();
    if (alpha === 1) {
      const deg = Math.round(Math.atan2(-aim.uy, Math.abs(aim.ux)) * 180 / Math.PI); // nur zur Anzeige
      g.font = '800 18px system-ui, sans-serif';
      g.textAlign = 'center';
      g.fillStyle = '#fff';
      g.strokeStyle = 'rgba(0, 0, 0, 0.7)';
      g.lineWidth = 4;
      const text = `Kraft ${Math.round(aim.power * 100)} % · ${deg}°`;
      g.strokeText(text, m.x + aim.ux * len, m.y + aim.uy * len - 18);
      g.fillText(text, m.x + aim.ux * len, m.y + aim.uy * len - 18);
    }
    g.globalAlpha = 1;
  }

  // Zielen wie mit einer Schleuder: irgendwo aufs Bild tippen und nach hinten ziehen
  function pointerAim(container, e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width * W;
    const py = (e.clientY - rect.top) / rect.height * H;
    const s = container._drag;
    const dx = s.x - px;
    const dy = s.y - py;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 4) {
      container._aim = null;
      return;
    }
    container._aim = { ux: dx / len, uy: dy / len, power: Math.min(1, len / (MAX_PULL * W)) };
  }

  function draw(container, v, ui) {
    if (!container.querySelector('.duel-wrap')) {
      container.innerHTML = `
        <div class="duel-wrap">
          <div class="pool-players duel-players"></div>
          <div class="pool-table duel-table"><canvas class="duel-canvas" width="${W * SCALE}" height="${H * SCALE}"></canvas></div>
          <div class="pool-hint duel-hint"></div>
          <div class="duel-log muted small"></div>
        </div>`;
      const canvas = container.querySelector('.duel-canvas');
      canvas.addEventListener('pointerdown', e => {
        if (!shown) return;
        const { view: cv, ui: u } = shown;
        if (cv.phase !== 'aim' || cv.turn !== u.mySeat || u.ended) return;
        const rect = canvas.getBoundingClientRect();
        container._drag = { x: (e.clientX - rect.left) / rect.width * W, y: (e.clientY - rect.top) / rect.height * H };
        container._aim = null;
        if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
      });
      canvas.addEventListener('pointermove', e => { if (container._drag) pointerAim(container, e); });
      canvas.addEventListener('pointerup', e => {
        if (!container._drag) return;
        pointerAim(container, e);
        container._drag = null;
        const aim = container._aim;
        container._aim = null;
        if (!aim || aim.power < 0.08 || !shown) return;
        const { view: cv, ui: u } = shown;
        if (cv.phase !== 'aim' || cv.turn !== u.mySeat) return;
        container._lastAim = aim;
        if (u.act({ type: 'fire', dx: aim.ux, dy: aim.uy, power: aim.power })) GK.sound.play('cannon');
      });
      canvas.addEventListener('pointercancel', () => { container._drag = null; container._aim = null; });
      container._lastNo = null;
    }
    shown = { view: v, ui };
    // Neuer Schuss: Bahn selbst nachrechnen (ergibt exakt dieselbe wie beim Gastgeber)
    const s = v.lastShot;
    if (s && container._lastNo !== null && s.no !== container._lastNo) {
      const field = { players: v.players, island: v.island };
      const r = simulate(field, s.seat, s.ux, s.uy, s.power, s.wind, true);
      const now = performance.now();
      const foe = 1 - s.seat;
      const big = s.damage[foe] || s.damage[s.seat];
      container._anim = {
        no: s.no, path: r.path, what: s.what, start: now, impactAt: now + r.steps * 1000 * DT,
        hitFoe: s.damage[foe] > 0, damageText: big ? `−${big}` : '', textX: v.players[s.damage[foe] ? foe : s.seat].x,
      };
      if (s.seat !== ui.mySeat) GK.sound.play('cannon');
      if (s.seat === ui.mySeat && s.what === 'ship' && s.damage[foe] === DIRECT) GK.unlockAchievement('duelDirect');
    }
    container._lastNo = s ? s.no : -1;
    if (!container._raf) container._raf = requestAnimationFrame(() => frame(container));
    const myTurn = v.phase === 'aim' && v.turn === ui.mySeat && !ui.ended;
    container.querySelector('.duel-table').classList.toggle('my-turn', myTurn);
    setHtml(container.querySelector('.duel-players'), v.players.map((p, i) => `
      <div class="pool-player ${v.turn === i && v.phase === 'aim' ? 'active' : ''}">
        <div class="pool-name"><span class="duel-flag" style="background:${COLORS[i]}"></span> ${GK.cosmetics.nameTag(p)}${i === ui.mySeat ? ' (du)' : ''}</div>
        <div class="pool-group">❤️ ${p.hp} · 🎯 ${p.hits} Treffer</div>
      </div>`).join('<span class="pool-vs">vs</span>'));
    let hint;
    if (v.phase === 'finished') {
      const w = v.players.findIndex(p => p.place === 1);
      hint = w === ui.mySeat ? '🏆 Das gegnerische Schiff sinkt – du gewinnst!' : `🏁 ${esc(v.players[w].name)} gewinnt das Duell.`;
    } else if (v.phase === 'flying') hint = '💥 Die Kugel fliegt …';
    else if (myTurn) hint = '👉 Du bist dran: aufs Bild tippen, nach hinten ziehen (wie eine Schleuder) und loslassen. Achte auf den Wind!';
    else hint = `${esc(v.players[v.turn].name)} zielt …`;
    setHtml(container.querySelector('.duel-hint'), hint);
    setHtml(container.querySelector('.duel-log'), v.log.slice(0, 2).map(l => `<div>${esc(l)}</div>`).join(''));
  }

  GK.room.registerGame({
    id: 'duel',
    name: 'Kanonenduell',
    icon: '💥',
    desc: 'Zwei Schiffe, eine Insel, wechselnder Wind – wer versenkt zuerst?',
    intro: `<p class="muted"><b>So geht's:</b> Abwechselnd feuert jeder eine Kanonenkugel ab. Zum Zielen aufs Bild tippen,
      nach hinten ziehen und loslassen – je weiter du ziehst, desto kräftiger der Schuss. Der Wind ändert sich
      jede Runde. Ein direkter Treffer kostet 40 Lebenspunkte, Einschläge in der Nähe weniger.</p>`,
    minPlayers: 2,
    maxPlayers: 2,
    bots: true,
    settings: { defaults: {} },
    create,
    actor: st => (st.phase === 'aim' ? st.turn : -1),
    act,
    botAct,
    timeout,
    turnTime: () => 25000,
    botDelay: (st, solo) => (solo ? 1200 : 1500),
    autoDelay: st => (st.phase === 'flying' ? Math.round(st.lastShot.steps * 1000 * DT) + 1300 : null),
    advance,
    forfeit,
    placeOf: (st, seat) => (seat >= 0 && st.players[seat] ? st.players[seat].place : null),
    finished: st => st.phase === 'finished',
    view: st => JSON.parse(JSON.stringify(st)),
    draw,
    onSettle: place => { if (place === 1) GK.unlockAchievement('duelWin'); },
  });

  // Für Tests
  GK.cannonDuel = { W, H, SEA, HP, DIRECT, create, act, advance, forfeit, botAct, timeout, simulate, damage, groundAt, muzzle };
})();
