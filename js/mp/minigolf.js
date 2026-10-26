// Minigolf in der Piratenbucht: 3 oder 6 Bahnen, 2–4 Spieler, wer die wenigsten Schläge braucht, gewinnt.
// Zielen: irgendwo auf die Bahn tippen und zurückziehen (wie eine Schleuder), loslassen = Schlag.
// Die Physik rechnet nur mit + − × ÷ und Wurzel – so kommt auf jedem Gerät genau dasselbe heraus.
// Der Gastgeber rechnet jeden Schlag aus, alle anderen spielen ihn zur Anzeige nach.
window.GK = window.GK || {};

(function () {
  const W = 1000;
  const H = 600;
  const R = 9;               // Ball
  const HOLE_R = 16;
  const MAX_SPEED = 1500;    // Einheiten pro Sekunde bei voller Kraft
  const DT = 1 / 120;
  const MAX_STEPS = 120 * 25;
  const FRICTION = 150;      // Abbremsen pro Sekunde
  const SAND_FRICTION = 900;
  const DRAG = 0.35;
  const STOP = 5;
  const CAPTURE = 560;       // schneller rollt der Ball über das Loch hinweg
  const WALL_BOUNCE = 0.78;
  const BUMPER_BOUNCE = 1.12;
  const MAX_STROKES = 7;
  const COLORS = ['#ffffff', '#ff6b6b', '#5ad8ff', '#ffd95e'];

  // Rechteck als Wand-Polygon
  const box = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];

  // Die Bahnen: Rand (Polygon), innere Wände (Strecken), Bumper (Kanonenkugeln), Sand, Wasser, Gefälle
  const HOLES = [
    {
      name: 'Anlegestelle', par: 2, tee: [130, 300], hole: [860, 300],
      outline: box(60, 190, 880, 220),
      walls: [], bumpers: [[500, 300, 32]], sand: [], water: [], slopes: [],
    },
    {
      name: 'Kanonen-Kurve', par: 3, tee: [130, 150], hole: [610, 470],
      outline: [[60, 60], [710, 60], [710, 540], [510, 540], [510, 250], [60, 250]],
      walls: [], bumpers: [[600, 140, 22], [665, 215, 18], [560, 330, 16]], sand: [], water: [], slopes: [],
    },
    {
      name: 'Sandbank', par: 3, tee: [130, 300], hole: [860, 300],
      outline: box(60, 140, 880, 320),
      walls: [[[500, 140], [500, 255]], [[500, 345], [500, 460]]],
      bumpers: [], sand: [[280, 140, 140, 110], [280, 350, 140, 110], [700, 230, 70, 140]], water: [], slopes: [],
    },
    {
      name: 'Haifischbecken', par: 3, tee: [140, 300], hole: [860, 300],
      outline: box(60, 60, 880, 480),
      walls: [], bumpers: [[500, 110, 16], [500, 490, 16]], sand: [], water: [[370, 200, 260, 200]], slopes: [],
    },
    {
      name: 'Schatzhügel', par: 3, tee: [130, 300], hole: [830, 300],
      outline: box(60, 90, 880, 420),
      walls: [], bumpers: [[460, 180, 20], [460, 420, 20]], sand: [],
      water: [], slopes: [[260, 90, 140, 420, 0, 210], [620, 90, 120, 420, -230, 0]],
    },
    {
      name: 'Totenkopf-Insel', par: 4, tee: [180, 150], hole: [850, 460],
      outline: box(60, 60, 880, 480),
      walls: [[[330, 60], [330, 400]], [[660, 200], [660, 540]]],
      bumpers: [[495, 300, 26]], sand: [[760, 60, 180, 110]], water: [[340, 470, 70, 70]], slopes: [],
    },
  ];

  // Alle Wände eines Lochs als Strecken
  const segmentCache = new Map();
  function segments(hole) {
    if (segmentCache.has(hole)) return segmentCache.get(hole);
    const segs = [];
    hole.outline.forEach((p, i) => segs.push([p, hole.outline[(i + 1) % hole.outline.length]]));
    hole.walls.forEach(w => segs.push(w));
    segmentCache.set(hole, segs);
    return segs;
  }

  const inRect = (x, y, r) => x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3];

  // ---------- Physik ----------

  // Einen Schlag ausrechnen. record = Bahn für die Animation aufzeichnen
  function simulate(hole, start, dx, dy, power, record) {
    let x = start[0];
    let y = start[1];
    let vx = dx * power * MAX_SPEED;
    let vy = dy * power * MAX_SPEED;
    const segs = segments(hole);
    const path = record ? [x, y] : null;
    const bounces = [];
    let holed = false;
    let water = false;
    let stuck = 0;
    let step = 0;
    for (; step < MAX_STEPS; step++) {
      let friction = FRICTION;
      let slope = false;
      for (const s of hole.sand) if (inRect(x, y, s)) friction = SAND_FRICTION;
      for (const s of hole.slopes) {
        if (inRect(x, y, s)) {
          vx += s[4] * DT;
          vy += s[5] * DT;
          slope = true;
        }
      }
      let speed = Math.sqrt(vx * vx + vy * vy);
      if (speed > 0) {
        const next = Math.max(0, speed - (friction + DRAG * speed) * DT);
        vx = vx / speed * next;
        vy = vy / speed * next;
        speed = next;
      }
      // In kleinen Schritten bewegen, damit der Ball nicht durch Wände rutscht
      const parts = Math.max(1, Math.ceil(speed * DT / (R * 0.5)));
      for (let k = 0; k < parts; k++) {
        x += vx * DT / parts;
        y += vy * DT / parts;
        for (const [a, b] of segs) {
          const ex = b[0] - a[0];
          const ey = b[1] - a[1];
          const len2 = ex * ex + ey * ey;
          let t = ((x - a[0]) * ex + (y - a[1]) * ey) / len2;
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          const cx = a[0] + t * ex;
          const cy = a[1] + t * ey;
          let nx = x - cx;
          let ny = y - cy;
          const d2 = nx * nx + ny * ny;
          if (d2 < R * R) {
            const d = Math.sqrt(d2);
            if (d > 1e-9) {
              nx /= d;
              ny /= d;
            } else {
              const l = Math.sqrt(len2);
              nx = -ey / l;
              ny = ex / l;
            }
            x = cx + nx * R;
            y = cy + ny * R;
            const vn = vx * nx + vy * ny;
            if (vn < 0) {
              vx = (vx - (1 + WALL_BOUNCE) * vn * nx) * 0.98;
              vy = (vy - (1 + WALL_BOUNCE) * vn * ny) * 0.98;
              if (record && -vn > 60) bounces.push({ step, kind: 'wall', strength: -vn });
            }
          }
        }
        for (const [bx, by, br] of hole.bumpers) {
          let nx = x - bx;
          let ny = y - by;
          const d2 = nx * nx + ny * ny;
          const min = R + br;
          if (d2 < min * min) {
            const d = Math.sqrt(d2) || 1e-9;
            nx /= d;
            ny /= d;
            x = bx + nx * min;
            y = by + ny * min;
            const vn = vx * nx + vy * ny;
            if (vn < 0) {
              vx -= (1 + BUMPER_BOUNCE) * vn * nx;
              vy -= (1 + BUMPER_BOUNCE) * vn * ny;
              const sp = Math.sqrt(vx * vx + vy * vy);
              if (sp > MAX_SPEED) {
                vx = vx / sp * MAX_SPEED;
                vy = vy / sp * MAX_SPEED;
              }
              if (record) bounces.push({ step, kind: 'bumper', strength: -vn });
            }
          }
        }
      }
      speed = Math.sqrt(vx * vx + vy * vy);
      // Loch
      const hx = x - hole.hole[0];
      const hy = y - hole.hole[1];
      if (hx * hx + hy * hy < HOLE_R * HOLE_R && speed < CAPTURE) {
        holed = true;
        x = hole.hole[0];
        y = hole.hole[1];
      }
      // Wasser: Ball geht unter
      for (const w of hole.water) if (inRect(x, y, w)) water = true;
      if (record && (step % 2 === 0 || holed || water)) path.push(x, y);
      if (holed || water) break;
      if (speed < STOP) {
        if (!slope) break;
        if (++stuck > 90) break;
      } else {
        stuck = 0;
      }
    }
    return { x, y, holed, water, steps: step + 1, path, bounces };
  }

  // ---------- Regeln ----------

  function holeOf(st) {
    return HOLES[st.course[st.hole]];
  }

  function create(seats, settings) {
    const count = settings && settings.holes === 3 ? 3 : 6;
    const course = count === 3 ? [0, 2, 5] : [0, 1, 2, 3, 4, 5];
    const st = {
      players: seats.map((s, i) => ({
        id: s.id, name: s.name, avatar: s.avatar || '', isBot: !!s.isBot, skill: s.skill || 0.5,
        color: COLORS[i % COLORS.length], strokes: [], total: 0, ball: null, done: false, out: false, place: null,
      })),
      course, hole: 0, turn: 0, phase: 'aim', lastShot: null, shotNo: 0, log: [],
    };
    startHole(st);
    return st;
  }

  function startHole(st) {
    const h = holeOf(st);
    st.players.forEach(p => {
      p.ball = h.tee.slice();
      p.done = p.out;
      p.strokes[st.hole] = 0;
    });
    st.phase = 'aim';
    st.lastShot = null;
    st.turn = st.players.findIndex(p => !p.done);
    log(st, `⛳ Bahn ${st.hole + 1}: ${h.name} (Par ${h.par})`);
  }

  function log(st, text) {
    st.log.unshift(text);
    st.log.length = Math.min(st.log.length, 30);
  }

  function act(st, seat, a) {
    if (st.phase !== 'aim' || st.turn !== seat || !a || a.type !== 'shot') return false;
    let dx = Number(a.dx);
    let dy = Number(a.dy);
    let power = Number(a.power);
    if (!isFinite(dx) || !isFinite(dy) || !isFinite(power)) return false;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1e-6) return false;
    dx /= len;
    dy /= len;
    power = Math.min(1, Math.max(0.03, power));
    const p = st.players[seat];
    const h = holeOf(st);
    const from = p.ball.slice();
    const r = simulate(h, from, dx, dy, power, false);
    p.strokes[st.hole]++;
    st.shotNo++;
    if (r.water) {
      p.strokes[st.hole]++; // Strafschlag, zurück an den Startpunkt des Schlags
      log(st, `💦 ${p.name} landet im Wasser (+1 Strafschlag)`);
    } else {
      p.ball = [r.x, r.y];
    }
    if (r.holed) {
      p.done = true;
      const n = p.strokes[st.hole];
      log(st, `🎉 ${p.name} lochte mit ${n} ${n === 1 ? 'Schlag' : 'Schlägen'} ein${n === 1 ? ' – ASS!' : ''}`);
    } else if (p.strokes[st.hole] >= MAX_STROKES) {
      p.done = true;
      p.strokes[st.hole] = MAX_STROKES + 1;
      log(st, `⌛ ${p.name} hat die ${MAX_STROKES} Schläge aufgebraucht (zählt ${MAX_STROKES + 1})`);
    }
    st.lastShot = { no: st.shotNo, seat, from, dx, dy, power, steps: r.steps, holed: r.holed, water: r.water };
    st.phase = 'rolling';
    return true;
  }

  // Nach dem Rollen: nächster Spieler, nächste Bahn oder Ende
  function advance(st) {
    if (st.phase === 'rolling') {
      const next = nextTurn(st, st.turn);
      if (next >= 0) {
        st.turn = next;
        st.phase = 'aim';
      } else {
        st.phase = 'holeDone';
        st.players.forEach(p => { p.total = p.strokes.reduce((a, b) => a + b, 0); });
      }
    } else if (st.phase === 'holeDone') {
      if (st.hole + 1 < st.course.length) {
        st.hole++;
        startHole(st);
      } else {
        finish(st);
      }
    }
  }

  // Reihum: der nächste, der noch nicht eingelocht hat
  function nextTurn(st, from) {
    const n = st.players.length;
    for (let k = 1; k <= n; k++) {
      const i = (from + k) % n;
      if (!st.players[i].done) return i;
    }
    return -1;
  }

  function finish(st) {
    const ranked = st.players.map((p, i) => i).filter(i => !st.players[i].out)
      .sort((a, b) => st.players[a].total - st.players[b].total || a - b);
    ranked.forEach((seat, k) => { st.players[seat].place = k + 1; });
    st.phase = 'finished';
    st.turn = -1;
    if (ranked.length) log(st, `🏆 ${st.players[ranked[0]].name} gewinnt mit ${st.players[ranked[0]].total} Schlägen!`);
  }

  function forfeit(st, seat) {
    const p = st.players[seat];
    if (p.out || st.phase === 'finished') return;
    p.place = st.players.filter(q => !q.out).length;
    p.out = true;
    p.done = true;
    log(st, `${p.name} verlässt das Spiel (${p.place}. Platz)`);
    const left = st.players.filter(q => !q.out);
    if (left.length <= 1) {
      st.players.forEach(q => { q.total = q.strokes.reduce((a, b) => a + b, 0); });
      finish(st);
      return;
    }
    if (st.phase === 'aim' && st.turn === seat) {
      const next = nextTurn(st, seat);
      if (next >= 0) st.turn = next;
      else st.phase = 'holeDone';
    }
  }

  // ---------- Computer-Gegner ----------

  // Viele Schläge durchprobieren und den besten nehmen – mit etwas Ungenauigkeit je nach Können
  function botAct(st, seat) {
    const p = st.players[seat];
    const h = holeOf(st);
    const tx = h.hole[0] - p.ball[0];
    const ty = h.hole[1] - p.ball[1];
    const base = Math.atan2(ty, tx);
    const dist = Math.sqrt(tx * tx + ty * ty);
    let best = null;
    for (let i = 0; i < 90; i++) {
      const angle = i < 30 ? base + (GK.rng.float() - 0.5) * 0.6 : GK.rng.float() * Math.PI * 2;
      const power = i < 30 ? Math.min(1, 0.15 + dist / 900 + GK.rng.float() * 0.35) : 0.2 + GK.rng.float() * 0.8;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      const r = simulate(h, p.ball, dx, dy, power, false);
      const ex = r.x - h.hole[0];
      const ey = r.y - h.hole[1];
      const score = r.holed ? 0 : r.water ? 2000 : Math.sqrt(ex * ex + ey * ey);
      if (!best || score < best.score) best = { score, dx, dy, power, angle };
      if (r.holed) break;
    }
    const miss = (1 - p.skill) * 0.12;
    const angle = best.angle + (GK.rng.float() - 0.5) * 2 * miss;
    const power = Math.min(1, Math.max(0.05, best.power * (1 + (GK.rng.float() - 0.5) * 2 * miss)));
    return { type: 'shot', dx: Math.cos(angle), dy: Math.sin(angle), power };
  }

  // Bedenkzeit vorbei: vorsichtig Richtung Loch
  function timeout(st, seat) {
    const p = st.players[seat];
    const h = holeOf(st);
    return { type: 'shot', dx: h.hole[0] - p.ball[0], dy: h.hole[1] - p.ball[1], power: 0.35 };
  }

  // ---------- Darstellung ----------

  const esc = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let anim = null;   // laufende Schlag-Animation
  let aim = null;    // eigenes Zielen
  let current = null; // { container, view, ui }

  function draw(container, v, ui) {
    current = { container, view: v, ui };
    if (!container.querySelector('.golf-wrap')) {
      container.innerHTML = `
        <div class="golf-wrap">
          <div class="golf-head"></div>
          <div class="golf-course"><canvas class="golf-canvas"></canvas><div class="golf-power"><span></span></div></div>
          <div class="golf-hint"></div>
          <div class="golf-score"></div>
        </div>`;
      setupInput(container.querySelector('.golf-canvas'));
      container._shotNo = null;
    }
    const h = holeOf(v);
    const turnName = v.turn >= 0 ? v.players[v.turn].name : '';
    setHtml(container.querySelector('.golf-head'), `<b>Bahn ${v.hole + 1}/${v.course.length}: ${h.name}</b> · Par ${h.par}`);
    const myTurn = v.phase === 'aim' && v.turn === ui.mySeat;
    let hint;
    if (v.phase === 'finished') hint = '🏁 Alle Bahnen gespielt!';
    else if (v.phase === 'holeDone') hint = '⛳ Bahn geschafft – gleich geht es weiter …';
    else if (v.phase === 'rolling') hint = `${esc(v.players[v.lastShot.seat].name)} hat geschlagen …`;
    else if (myTurn) hint = '👉 Du bist dran! Tippe auf die Bahn und ziehe zurück – je weiter, desto fester. Loslassen = Schlag.';
    else hint = `${esc(turnName)} ist dran …`;
    setHtml(container.querySelector('.golf-hint'), hint);
    container.querySelector('.golf-course').classList.toggle('my-turn', myTurn);
    setHtml(container.querySelector('.golf-score'), scoreTable(v, ui));

    // Neuer Schlag: Animation starten (Bahn lokal nachrechnen)
    const shot = v.lastShot;
    if (shot && container._shotNo !== null && shot.no !== container._shotNo && v.phase === 'rolling') {
      const r = simulate(h, shot.from, shot.dx, shot.dy, shot.power, true);
      const ace = shot.seat === ui.mySeat && shot.holed && v.players[shot.seat].strokes[v.hole] === 1;
      anim = { shot, r, start: performance.now(), holeKey: `${v.hole}`, played: 0, ace };
      GK.sound.play('chip');
    }
    container._shotNo = shot ? shot.no : -1;
    if (v.phase !== 'rolling' && anim && performance.now() - anim.start > anim.r.path.length / 2 / 60 * 1000) anim = null;
    startLoop();
  }

  function setHtml(el, html) {
    if (el._html === html) return;
    el._html = html;
    el.innerHTML = html;
  }

  function scoreTable(v, ui) {
    const holes = v.course.map(i => HOLES[i]);
    const head = `<tr><th></th>${holes.map((h, i) => `<th class="${i === v.hole ? 'now' : ''}">${i + 1}</th>`).join('')}<th>Σ</th></tr>
      <tr class="par"><td>Par</td>${holes.map(h => `<td>${h.par}</td>`).join('')}<td>${holes.reduce((s, h) => s + h.par, 0)}</td></tr>`;
    const rows = v.players.map((p, seat) => {
      const total = p.strokes.reduce((a, b) => a + (b || 0), 0);
      return `<tr class="${seat === v.turn && v.phase === 'aim' ? 'turn' : ''} ${p.out ? 'out' : ''}">
        <td><span class="golf-dot" style="background:${p.color}"></span>${p.avatar} ${esc(p.name)}${seat === ui.mySeat ? ' (du)' : ''}</td>
        ${holes.map((h, i) => {
          const n = p.strokes[i];
          const cls = n === undefined ? '' : n === 1 ? 'ace' : n < h.par ? 'under' : n > h.par ? 'over' : 'even';
          return `<td class="${cls}">${n === undefined || (i === v.hole && !p.done && n === 0) ? '' : n}${i === v.hole && !p.done && n > 0 ? '…' : ''}</td>`;
        }).join('')}
        <td><b>${total}</b>${p.place ? ` <span class="golf-place">${p.place}.</span>` : ''}</td>
      </tr>`;
    }).join('');
    return `<table class="golf-table">${head}${rows}</table>`;
  }

  // ---------- Zielen per Ziehen (Touch und Maus) ----------

  function toCourse(canvas, e) {
    const rect = canvas.getBoundingClientRect();
    return [(e.clientX - rect.left) / rect.width * W, (e.clientY - rect.top) / rect.height * H];
  }

  function setupInput(canvas) {
    canvas.addEventListener('pointerdown', e => {
      if (!current) return;
      const { view: v, ui } = current;
      if (!(v.phase === 'aim' && v.turn === ui.mySeat)) return;
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      aim = { start: toCourse(canvas, e), now: toCourse(canvas, e) };
      startLoop();
    });
    canvas.addEventListener('pointermove', e => {
      if (!aim) return;
      e.preventDefault();
      aim.now = toCourse(canvas, e);
    });
    const release = e => {
      if (!aim || !current) return;
      const { view: v, ui } = current;
      const dx = aim.start[0] - aim.now[0];
      const dy = aim.start[1] - aim.now[1];
      const power = Math.min(1, Math.sqrt(dx * dx + dy * dy) / 260);
      aim = null;
      if (e.type === 'pointerup' && power >= 0.04 && v.phase === 'aim' && v.turn === ui.mySeat) {
        ui.act({ type: 'shot', dx, dy, power });
      }
    };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
  }

  // ---------- Zeichnen ----------

  let running = false;

  function startLoop() {
    if (running) return;
    running = true;
    requestAnimationFrame(frame);
  }

  function frame(now) {
    if (!current || !current.container.isConnected) {
      running = false;
      return;
    }
    render(now);
    if (anim || aim) requestAnimationFrame(frame);
    else running = false;
  }

  function render(now) {
    const { container, view: v, ui } = current;
    const canvas = container.querySelector('.golf-canvas');
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = canvas.clientWidth || 600;
    if (canvas.width !== Math.round(cssW * dpr)) {
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssW * dpr * H / W);
    }
    const ctx = canvas.getContext('2d');
    const s = canvas.width / W;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    const h = holeOf(v);
    drawCourse(ctx, h, now);

    // Bälle: der gerade geschlagene folgt der Animation
    let animPos = null;
    if (anim && anim.holeKey === `${v.hole}`) {
      const t = (now - anim.start) / 1000;
      const i = Math.min(Math.floor(t * 60), anim.r.path.length / 2 - 1);
      animPos = [anim.r.path[i * 2], anim.r.path[i * 2 + 1]];
      // Geräusche an Banden und Bumpern
      anim.r.bounces.forEach((b, k) => {
        if (k >= anim.played && b.step / 2 <= i) {
          anim.played = k + 1;
          GK.sound.play(b.kind === 'bumper' ? 'plink' : 'tick');
        }
      });
      if (i >= anim.r.path.length / 2 - 1) {
        if (anim.r.holed) {
          GK.sound.play('gem');
          if (anim.ace) GK.unlockAchievement('golfAce');
          const rect = canvas.getBoundingClientRect();
          GK.fx.burst(rect.left + h.hole[0] / W * rect.width, rect.top + h.hole[1] / H * rect.height, { count: 16, kind: 'sparkle', speed: 400 });
        } else if (anim.r.water) {
          GK.sound.play('lose');
        }
        anim = null;
      }
    }
    v.players.forEach((p, seat) => {
      if (p.out) return;
      let pos = p.ball;
      if (animPos && v.lastShot && seat === v.lastShot.seat) pos = animPos;
      else if (p.done && pos[0] === h.hole[0] && pos[1] === h.hole[1]) return; // eingelocht
      drawBall(ctx, pos, p.color, seat === v.turn && v.phase === 'aim');
    });

    // Ziel-Pfeil
    const powerBar = container.querySelector('.golf-power span');
    if (aim && v.turn === ui.mySeat) {
      const me = v.players[ui.mySeat];
      const dx = aim.start[0] - aim.now[0];
      const dy = aim.start[1] - aim.now[1];
      const len = Math.sqrt(dx * dx + dy * dy);
      const power = Math.min(1, len / 260);
      if (len > 2) {
        const ux = dx / len;
        const uy = dy / len;
        const L = 40 + power * 220;
        ctx.setLineDash([10, 8]);
        ctx.lineWidth = 4;
        ctx.strokeStyle = `rgba(255, ${Math.round(230 - power * 160)}, 80, 0.95)`;
        ctx.beginPath();
        ctx.moveTo(me.ball[0], me.ball[1]);
        ctx.lineTo(me.ball[0] + ux * L, me.ball[1] + uy * L);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(me.ball[0] + ux * L, me.ball[1] + uy * L, 7, 0, Math.PI * 2);
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fill();
      }
      powerBar.style.width = `${power * 100}%`;
      powerBar.parentElement.classList.add('show');
    } else {
      powerBar.parentElement.classList.remove('show');
    }
  }

  function drawCourse(ctx, h, now) {
    // Meer drumherum
    ctx.fillStyle = '#0d4a63';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.lineWidth = 3;
    for (let y = 20; y < H; y += 40) {
      ctx.beginPath();
      for (let x = 0; x <= W; x += 20) ctx.lineTo(x, y + Math.sin(x / 30 + now / 900 + y) * 4);
      ctx.stroke();
    }
    // Rasen
    ctx.beginPath();
    h.outline.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = '#2e9a4f';
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    for (let x = 0; x < W; x += 80) ctx.fillRect(x, 0, 40, H);
    // Sand, Wasser, Gefälle
    h.sand.forEach(([x, y, w, hh]) => {
      ctx.fillStyle = '#e8cf8a';
      ctx.fillRect(x, y, w, hh);
      ctx.fillStyle = 'rgba(160, 120, 50, 0.25)';
      for (let i = 0; i < 30; i++) ctx.fillRect(x + ((i * 37) % w), y + ((i * 53) % hh), 3, 3);
    });
    h.water.forEach(([x, y, w, hh]) => {
      ctx.fillStyle = '#1f78b4';
      ctx.fillRect(x, y, w, hh);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 2;
      for (let yy = y + 15; yy < y + hh; yy += 25) {
        ctx.beginPath();
        for (let xx = x; xx <= x + w; xx += 10) ctx.lineTo(xx, yy + Math.sin(xx / 12 + now / 400) * 3);
        ctx.stroke();
      }
      ctx.font = '34px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🦈', x + w / 2 + Math.sin(now / 1500) * (w / 3), y + hh / 2);
    });
    h.slopes.forEach(([x, y, w, hh, ax, ay]) => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
      ctx.fillRect(x, y, w, hh);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 3;
      const len = Math.sqrt(ax * ax + ay * ay);
      const ux = ax / len;
      const uy = ay / len;
      const shift = (now / 40) % 60;
      for (let cx = x + 30; cx < x + w; cx += 60) {
        for (let cy = y + 30; cy < y + hh; cy += 60) {
          const px = cx + ux * (shift - 30);
          const py = cy + uy * (shift - 30);
          ctx.beginPath();
          ctx.moveTo(px - ux * 10 - uy * 8, py - uy * 10 + ux * 8);
          ctx.lineTo(px, py);
          ctx.lineTo(px - ux * 10 + uy * 8, py - uy * 10 - ux * 8);
          ctx.stroke();
        }
      }
    });
    ctx.restore();
    // Abschlag
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fillRect(h.tee[0] - 18, h.tee[1] - 18, 36, 36);
    // Loch mit Fahne
    ctx.beginPath();
    ctx.arc(h.hole[0], h.hole[1], HOLE_R, 0, Math.PI * 2);
    ctx.fillStyle = '#111';
    ctx.fill();
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(h.hole[0], h.hole[1]);
    ctx.lineTo(h.hole[0], h.hole[1] - 60);
    ctx.stroke();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.moveTo(h.hole[0], h.hole[1] - 60);
    ctx.lineTo(h.hole[0] + 34 + Math.sin(now / 300) * 3, h.hole[1] - 50);
    ctx.lineTo(h.hole[0], h.hole[1] - 40);
    ctx.fill();
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('☠️', h.hole[0] + 14, h.hole[1] - 46);
    // Wände
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#7a4a1e';
    ctx.lineWidth = 12;
    ctx.beginPath();
    h.outline.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.stroke();
    h.walls.forEach(([a, b]) => {
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    });
    // Bumper (Kanonenkugeln)
    h.bumpers.forEach(([x, y, r]) => {
      const g = ctx.createRadialGradient(x - r / 3, y - r / 3, 2, x, y, r);
      g.addColorStop(0, '#6a6a74');
      g.addColorStop(1, '#1b1b20');
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
    });
  }

  function drawBall(ctx, pos, color, active) {
    if (active) {
      ctx.beginPath();
      ctx.arc(pos[0], pos[1], R + 7, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 229, 138, 0.9)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(pos[0] + 2, pos[1] + 3, R, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(pos[0], pos[1], R, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Animation braucht Zeit: Schritte / 120 pro Sekunde, gezeigt mit 60 Bildern pro Sekunde (jeder 2. Schritt)
  function rollTime(st) {
    return Math.round(st.lastShot.steps / 120 * 1000);
  }

  GK.room.registerGame({
    id: 'golf',
    name: 'Minigolf',
    icon: '⛳',
    desc: 'Sechs Bahnen in der Piratenbucht – wer braucht die wenigsten Schläge?',
    intro: `<p class="muted"><b>So geht's:</b> Tippe auf die Bahn und ziehe zurück wie bei einer Schleuder – je weiter,
      desto fester der Schlag. Bälle stören sich gegenseitig nicht. Wasser kostet einen Strafschlag, nach
      ${MAX_STROKES} Schlägen ist Schluss (zählt ${MAX_STROKES + 1}). Wer am Ende die wenigsten Schläge hat, gewinnt.</p>`,
    minPlayers: 2,
    maxPlayers: 4,
    bots: true,
    settings: {
      defaults: { holes: 6 },
      html: s => `<div class="bet-label">Bahnen</div>
        <div class="room-opts">${[3, 6].map(n => `<button type="button" class="btn btn-small room-opt ${s.holes === n ? 'active' : ''}" data-holes="${n}">${n} Bahnen${n === 3 ? ' (kurz)' : ''}</button>`).join('')}</div>`,
      bind: (el, changed) => el.querySelectorAll('.room-opt').forEach(btn => btn.addEventListener('click', () => {
        el.querySelectorAll('.room-opt').forEach(b => b.classList.toggle('active', b === btn));
        GK.sound.play('chip');
        changed();
      })),
      read: el => ({ holes: Number((el.querySelector('.room-opt.active') || {}).dataset?.holes) || 6 }),
    },
    settingsText: s => `${s.holes} Bahnen`,
    create,
    actor: st => (st.phase === 'aim' ? st.turn : -1),
    act,
    botAct,
    timeout,
    turnTime: () => 40000,
    botDelay: (st, solo) => (solo ? 900 : 1200),
    autoDelay: st => (st.phase === 'rolling' ? rollTime(st) + 700 : st.phase === 'holeDone' ? 3200 : null),
    advance,
    forfeit,
    placeOf: (st, seat) => (seat >= 0 && st.players[seat] ? st.players[seat].place : null),
    finished: st => st.phase === 'finished',
    view: st => JSON.parse(JSON.stringify(st)),
    draw,
    onSettle: place => { if (place === 1) GK.unlockAchievement('golfWin'); },
  });

  // Für Tests
  GK.minigolf = { HOLES, simulate, create, act, advance, forfeit, botAct, segments };
})();
