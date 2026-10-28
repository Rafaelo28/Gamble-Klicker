// Billard (8-Ball) für 2 Spieler: Wer zuerst eine Kugel versenkt, bekommt diese Farbe
// (Volle 1–7 oder Halbe 9–15). Wer alle eigenen Kugeln versenkt hat, muss die 8 versenken.
// Fouls (weiße Kugel versenkt, nichts oder zuerst eine fremde Kugel getroffen) geben dem
// Gegner „Ball in der Hand“: Er darf die Weiße frei hinlegen. Die 8 zu früh versenkt = verloren.
// Zielen: auf den Tisch tippen und zurückziehen (wie beim Minigolf). Die Physik rechnet nur mit
// Grundrechenarten und Wurzel – jedes Gerät kommt auf dasselbe Ergebnis.
window.GK = window.GK || {};

(function () {
  const W = 1000;
  const H = 500;
  const L = 40;
  const T = 40;
  const RT = 960;
  const B = 460;
  const R = 11;
  const MAX_SPEED = 1700;
  const DT = 1 / 120;
  const MAX_STEPS = 120 * 20;
  const FRICTION = 260;
  const DRAG = 0.25;
  const STOP = 4;
  const RAIL_BOUNCE = 0.75;
  const BALL_BOUNCE = 0.96;
  const HEAD_X = 250;           // Kopflinie: beim Anstoß liegt die Weiße links davon
  const FOOT = [740, 250];      // Fußpunkt: Spitze des Dreiecks
  const SOLIDS = [1, 2, 3, 4, 5, 6, 7];
  const STRIPES = [9, 10, 11, 12, 13, 14, 15];
  const BALL_COLORS = ['#f4f1e6', '#f5c518', '#1f5fd1', '#d62d20', '#6a2c91', '#f07c19', '#1d8a3a', '#7a1f1f', '#151515'];

  // Löcher (Mittelpunkt, Radius) und Banden (mit Lücken an den Löchern und schrägen Backen)
  const POCKETS = [[L - 4, T - 4, 24], [500, T - 8, 21], [RT + 4, T - 4, 24], [L - 4, B + 4, 24], [500, B + 8, 21], [RT + 4, B + 4, 24]];
  const C = 30; // Lücke an den Ecken
  const S = 22; // Lücke an den Seitenlöchern
  const RAILS = [
    [[L + C, T], [500 - S, T]], [[500 + S, T], [RT - C, T]],
    [[L + C, B], [500 - S, B]], [[500 + S, B], [RT - C, B]],
    [[L, T + C], [L, B - C]], [[RT, T + C], [RT, B - C]],
    // Backen
    [[L + C, T], [L + C - 14, T - 16]], [[L, T + C], [L - 16, T + C - 14]],
    [[RT - C, T], [RT - C + 14, T - 16]], [[RT, T + C], [RT + 16, T + C - 14]],
    [[L + C, B], [L + C - 14, B + 16]], [[L, B - C], [L - 16, B - C + 14]],
    [[RT - C, B], [RT - C + 14, B + 16]], [[RT, B - C], [RT + 16, B - C + 14]],
    [[500 - S, T], [500 - S + 6, T - 16]], [[500 + S, T], [500 + S - 6, T - 16]],
    [[500 - S, B], [500 - S + 6, B + 16]], [[500 + S, B], [500 + S - 6, B + 16]],
  ];

  const groupOf = n => (n >= 1 && n <= 7 ? 'solid' : n >= 9 ? 'stripe' : null);

  // ---------- Physik ----------

  // Einen Stoß ausrechnen. balls: [{ n, x, y, potted }] (wird nicht verändert)
  function simulate(balls, dx, dy, power, record) {
    const bs = balls.map(b => ({ n: b.n, x: b.x, y: b.y, vx: 0, vy: 0, potted: b.potted }));
    const cue = bs.find(b => b.n === 0);
    cue.vx = dx * power * MAX_SPEED;
    cue.vy = dy * power * MAX_SPEED;
    const potted = [];
    const events = [];
    let firstHit = null;
    let railHits = 0;
    const frames = record ? [] : null;
    let step = 0;
    for (; step < MAX_STEPS; step++) {
      // Reibung
      let fastest = 0;
      for (const b of bs) {
        if (b.potted) continue;
        const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
        if (sp > 0) {
          const next = Math.max(0, sp - (FRICTION + DRAG * sp) * DT);
          b.vx = b.vx / sp * next;
          b.vy = b.vy / sp * next;
          if (next > fastest) fastest = next;
        }
      }
      if (fastest < STOP) {
        for (const b of bs) {
          b.vx = 0;
          b.vy = 0;
        }
        break;
      }
      const parts = Math.max(1, Math.ceil(fastest * DT / (R * 0.4)));
      const dt = DT / parts;
      for (let k = 0; k < parts; k++) {
        for (const b of bs) {
          if (b.potted) continue;
          b.x += b.vx * dt;
          b.y += b.vy * dt;
        }
        // Kugeln untereinander (immer in derselben Reihenfolge)
        for (let i = 0; i < bs.length; i++) {
          const a = bs[i];
          if (a.potted) continue;
          for (let j = i + 1; j < bs.length; j++) {
            const c = bs[j];
            if (c.potted) continue;
            let nx = c.x - a.x;
            let ny = c.y - a.y;
            const d2 = nx * nx + ny * ny;
            if (d2 >= 4 * R * R) continue;
            const d = Math.sqrt(d2) || 1e-9;
            nx /= d;
            ny /= d;
            const overlap = (2 * R - d) / 2;
            a.x -= nx * overlap;
            a.y -= ny * overlap;
            c.x += nx * overlap;
            c.y += ny * overlap;
            const rel = (a.vx - c.vx) * nx + (a.vy - c.vy) * ny;
            if (rel > 0) {
              const imp = (1 + BALL_BOUNCE) / 2 * rel;
              a.vx -= imp * nx;
              a.vy -= imp * ny;
              c.vx += imp * nx;
              c.vy += imp * ny;
              if (firstHit === null && (a.n === 0 || c.n === 0)) firstHit = a.n === 0 ? c.n : a.n;
              if (record) events.push({ step, kind: 'ball', strength: rel });
            }
          }
        }
        // Banden
        for (const b of bs) {
          if (b.potted) continue;
          for (const [p, q] of RAILS) {
            const ex = q[0] - p[0];
            const ey = q[1] - p[1];
            const len2 = ex * ex + ey * ey;
            let t = ((b.x - p[0]) * ex + (b.y - p[1]) * ey) / len2;
            t = t < 0 ? 0 : t > 1 ? 1 : t;
            const cx = p[0] + t * ex;
            const cy = p[1] + t * ey;
            let nx = b.x - cx;
            let ny = b.y - cy;
            const d2 = nx * nx + ny * ny;
            if (d2 >= R * R) continue;
            const d = Math.sqrt(d2);
            if (d > 1e-9) {
              nx /= d;
              ny /= d;
            } else {
              const l = Math.sqrt(len2);
              nx = -ey / l;
              ny = ex / l;
            }
            b.x = cx + nx * R;
            b.y = cy + ny * R;
            const vn = b.vx * nx + b.vy * ny;
            if (vn < 0) {
              b.vx -= (1 + RAIL_BOUNCE) * vn * nx;
              b.vy -= (1 + RAIL_BOUNCE) * vn * ny;
              railHits++;
              if (record && -vn > 80) events.push({ step, kind: 'rail', strength: -vn });
            }
          }
          // Loch?
          for (const [px, py, pr] of POCKETS) {
            const ox = b.x - px;
            const oy = b.y - py;
            if (ox * ox + oy * oy < pr * pr) {
              b.potted = true;
              break;
            }
          }
          // Sicherheitsnetz: durch die Lochöffnung vom Tisch gerollt
          if (!b.potted && (b.x < L - 2 * R || b.x > RT + 2 * R || b.y < T - 2 * R || b.y > B + 2 * R)) b.potted = true;
          if (b.potted) {
            b.vx = 0;
            b.vy = 0;
            potted.push(b.n);
            if (record) events.push({ step, kind: 'pocket', n: b.n });
          }
        }
      }
      if (record && step % 2 === 0) frames.push(bs.map(b => (b.potted ? null : [b.x, b.y])));
    }
    if (record) frames.push(bs.map(b => (b.potted ? null : [b.x, b.y])));
    return { balls: bs.map(b => ({ n: b.n, x: b.x, y: b.y, potted: b.potted })), potted, firstHit, railHits, steps: step + 1, frames, events };
  }

  // ---------- Aufbau ----------

  function rack() {
    // Dreieck: 5 Reihen, die 8 in der Mitte, hinten links/rechts je eine Volle und eine Halbe
    const others = GK.rng.shuffle([1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15]);
    const solid = others.find(n => n < 8);
    const stripe = others.find(n => n > 8);
    const rest = others.filter(n => n !== solid && n !== stripe);
    const order = [];
    let k = 0;
    const balls = [{ n: 0, x: HEAD_X, y: 250, potted: false }];
    const dxRow = R * 2 * 0.866 + 0.5;
    for (let row = 0; row < 5; row++) {
      for (let i = 0; i <= row; i++) {
        let n;
        if (row === 2 && i === 1) n = 8;
        else if (row === 4 && i === 0) n = GK.rng.int(2) ? solid : stripe;
        else if (row === 4 && i === 4) n = order.includes(solid) || balls.some(b => b.n === solid) ? stripe : solid;
        else n = rest[k++];
        order.push(n);
        balls.push({ n, x: FOOT[0] + row * dxRow, y: FOOT[1] + (i - row / 2) * (R * 2 + 0.5), potted: false });
      }
    }
    // Falls die Ecke doppelt vergeben wurde, die fehlende Kugel nachtragen
    const have = new Set(balls.map(b => b.n));
    const missing = [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15].filter(n => !have.has(n));
    const dup = balls.filter((b, i) => balls.findIndex(c => c.n === b.n) !== i);
    dup.forEach((b, i) => { b.n = missing[i]; });
    return balls;
  }

  function create(seats) {
    const st = {
      players: seats.slice(0, 2).map(s => ({ id: s.id, name: s.name, avatar: s.avatar || '', isBot: !!s.isBot, skill: s.skill || 0.5, group: null, place: null, out: false })),
      balls: rack(), turn: GK.rng.int(2), phase: 'aim', inHand: true, kitchen: true, breakShot: true,
      lastShot: null, shotNo: 0, log: [],
    };
    log(st, `🎱 ${st.players[st.turn].name} stößt an.`);
    return st;
  }

  function log(st, text) {
    st.log.unshift(text);
    st.log.length = Math.min(st.log.length, 30);
  }

  // Darf die Weiße hier liegen?
  function validSpot(st, x, y) {
    if (!(x >= L + R && x <= RT - R && y >= T + R && y <= B - R)) return false;
    if (st.kitchen && x > HEAD_X) return false;
    return st.balls.every(b => b.n === 0 || b.potted || (b.x - x) * (b.x - x) + (b.y - y) * (b.y - y) >= 4 * R * R + 1);
  }

  // Freie Stelle für die Weiße suchen (nach einem Foul)
  function freeSpot(st) {
    for (let k = 0; k < 40; k++) {
      const x = HEAD_X - (k % 8) * 25;
      const y = 250 + (k % 2 ? 1 : -1) * Math.floor(k / 2) * 12;
      if (validSpot(st, x, y)) return [x, y];
    }
    return [HEAD_X, 250];
  }

  const remaining = (st, group) => st.balls.filter(b => !b.potted && groupOf(b.n) === group).length;

  // ---------- Regeln ----------

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
    const cue = st.balls.find(b => b.n === 0);
    if (st.inHand && Array.isArray(a.place)) {
      const [px, py] = a.place.map(Number);
      if (!validSpot(st, px, py)) return false;
      cue.x = px;
      cue.y = py;
    }
    const me = st.players[seat];
    const opp = st.players[1 - seat];
    const before = st.balls.map(b => ({ ...b }));
    const ownBefore = me.group ? remaining(st, me.group) : null;
    const r = simulate(st.balls, dx, dy, power, false);
    st.balls = r.balls;
    st.shotNo++;
    st.lastShot = { no: st.shotNo, seat, dx, dy, power, before, steps: r.steps };

    const cuePotted = r.potted.includes(0);
    const eightPotted = r.potted.includes(8);
    let foul = '';
    if (r.firstHit === null) foul = 'keine Kugel getroffen';
    else if (me.group) {
      const target = ownBefore === 0 ? 8 : null;
      if (target ? r.firstHit !== 8 : groupOf(r.firstHit) !== me.group) foul = 'zuerst eine fremde Kugel getroffen';
    } else if (r.firstHit === 8 && !st.breakShot) {
      foul = 'zuerst die 8 getroffen';
    }
    if (cuePotted) foul = 'weiße Kugel versenkt';

    // Die 8
    if (eightPotted) {
      if (st.breakShot) {
        // Beim Anstoß: die 8 kommt zurück auf den Fußpunkt
        const eight = st.balls.find(b => b.n === 8);
        eight.potted = false;
        eight.x = FOOT[0];
        eight.y = FOOT[1];
        if (!validSpot({ ...st, kitchen: false }, eight.x, eight.y)) eight.x += 3 * R;
        log(st, '🎱 Die 8 fiel beim Anstoß – sie kommt zurück auf den Tisch.');
      } else {
        const legal = me.group && ownBefore === 0 && !foul;
        finish(st, legal ? seat : 1 - seat);
        log(st, legal ? `🏆 ${me.name} versenkt die 8 und gewinnt!` : `💀 ${me.name} versenkt die 8 zu früh – ${opp.name} gewinnt!`);
        st.phase = 'rolling';
        st.after = 'finished';
        return true;
      }
    }

    // Farben verteilen, sobald jemand ohne Foul eine Kugel versenkt
    const objects = r.potted.filter(n => n !== 0 && n !== 8);
    if (!me.group && !foul && objects.length) {
      me.group = groupOf(objects[0]);
      opp.group = me.group === 'solid' ? 'stripe' : 'solid';
      log(st, `${me.name} spielt die ${me.group === 'solid' ? 'Vollen (1–7)' : 'Halben (9–15)'}.`);
    }
    const ownPotted = objects.some(n => !me.group || groupOf(n) === me.group);
    if (objects.length) log(st, `${me.name} versenkt ${objects.join(', ')}`);

    st.breakShot = false;
    st.kitchen = false;
    if (foul) {
      log(st, `❌ Foul von ${me.name}: ${foul}. ${opp.name} hat Ball in der Hand.`);
      if (cuePotted) {
        const c = st.balls.find(b => b.n === 0);
        c.potted = false;
        [c.x, c.y] = freeSpot(st);
      }
      st.inHand = true;
      st.nextTurn = 1 - seat;
    } else {
      st.inHand = false;
      st.nextTurn = ownPotted ? seat : 1 - seat;
    }
    st.phase = 'rolling';
    st.after = 'aim';
    return true;
  }

  function finish(st, winner) {
    st.players[winner].place = 1;
    st.players[1 - winner].place = 2;
    st.winner = winner;
  }

  function advance(st) {
    if (st.phase !== 'rolling') return;
    if (st.after === 'finished') {
      st.phase = 'finished';
      st.turn = -1;
      return;
    }
    st.turn = st.nextTurn;
    st.phase = 'aim';
  }

  function forfeit(st, seat) {
    if (st.phase === 'finished' || st.players[seat].place) return;
    finish(st, 1 - seat);
    st.players[seat].out = true;
    log(st, `${st.players[seat].name} gibt auf – ${st.players[1 - seat].name} gewinnt.`);
    st.phase = 'finished';
    st.turn = -1;
  }

  // ---------- Computer-Gegner ----------

  // Für jede eigene Kugel und jedes Loch den „Geisterball“ anvisieren, einige Stöße durchrechnen
  function botAct(st, seat) {
    const me = st.players[seat];
    const cue = st.balls.find(b => b.n === 0);
    let cx = cue.x;
    let cy = cue.y;
    let place = null;
    if (st.inHand) {
      // Weiße an eine gute freie Stelle legen: nahe der Mitte bzw. hinter der Kopflinie
      const spot = st.kitchen ? [HEAD_X - 10, 250] : [300 + GK.rng.int(400), 150 + GK.rng.int(200)];
      if (validSpot(st, spot[0], spot[1])) place = spot;
      else place = freeSpot(st);
      [cx, cy] = place;
    }
    const balls = st.balls.map(b => (b.n === 0 ? { ...b, x: cx, y: cy } : b));
    const own = me.group ? remaining(st, me.group) : null;
    const targets = st.balls.filter(b => !b.potted && b.n !== 0 &&
      (st.breakShot ? true : me.group ? (own === 0 ? b.n === 8 : groupOf(b.n) === me.group) : b.n !== 8));
    if (st.breakShot) {
      const a = Math.atan2(FOOT[1] - cy + (GK.rng.float() - 0.5) * 8, FOOT[0] - cx);
      return { type: 'shot', dx: Math.cos(a), dy: Math.sin(a), power: 0.95, place };
    }
    const candidates = [];
    targets.forEach(t => {
      POCKETS.forEach(([px, py]) => {
        const ux = px - t.x;
        const uy = py - t.y;
        const ul = Math.sqrt(ux * ux + uy * uy);
        const gx = t.x - ux / ul * 2 * R;
        const gy = t.y - uy / ul * 2 * R;
        const ax = gx - cx;
        const ay = gy - cy;
        const al = Math.sqrt(ax * ax + ay * ay);
        const cut = (ax * ux + ay * uy) / (al * ul);
        if (cut < 0.25) return; // zu dünn
        candidates.push({ dx: ax / al, dy: ay / al, score: cut - ul / 3000 - al / 3000 });
      });
    });
    candidates.sort((a, b) => b.score - a.score);
    let best = null;
    const evaluate = (dx, dy, power) => {
      const r = simulate(balls, dx, dy, power, false);
      let score = 0;
      if (r.potted.includes(0)) score -= 300;
      if (r.firstHit === null) score -= 250;
      else if (me.group && (own === 0 ? r.firstHit !== 8 : groupOf(r.firstHit) !== me.group)) score -= 200;
      if (r.potted.includes(8)) score += own === 0 && me.group && !r.potted.includes(0) ? 2000 : -3000;
      r.potted.forEach(n => {
        if (n === 0 || n === 8) return;
        score += !me.group || groupOf(n) === me.group ? 120 : -60;
      });
      return score;
    };
    candidates.slice(0, 10).forEach(c => {
      [0.35, 0.55, 0.8].forEach(power => {
        const score = evaluate(c.dx, c.dy, power) + c.score * 10;
        if (!best || score > best.score) best = { ...c, power, score };
      });
    });
    // Nichts Gutes gefunden: einfach eine eigene Kugel sanft anspielen
    if (!best || best.score < -100) {
      const t = targets[0] || st.balls.find(b => !b.potted && b.n !== 0);
      const ax = t.x - cx;
      const ay = t.y - cy;
      const al = Math.sqrt(ax * ax + ay * ay) || 1;
      best = { dx: ax / al, dy: ay / al, power: 0.4 };
    }
    const miss = (1 - me.skill) * 0.045;
    const angle = Math.atan2(best.dy, best.dx) + (GK.rng.float() - 0.5) * 2 * miss;
    const power = Math.min(1, Math.max(0.1, best.power * (1 + (GK.rng.float() - 0.5) * 0.2)));
    return { type: 'shot', dx: Math.cos(angle), dy: Math.sin(angle), power, place };
  }

  function timeout(st, seat) {
    const a = botAct(st, seat);
    a.power = Math.min(a.power, 0.5);
    return a;
  }

  // ---------- Darstellung ----------

  const esc = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let current = null;
  let anim = null;
  let aim = null;      // eigenes Zielen
  let place = null;    // eigene Position der Weißen bei „Ball in der Hand“
  let running = false;

  function setHtml(el, html) {
    if (el._html === html) return;
    el._html = html;
    el.innerHTML = html;
  }

  function draw(container, v, ui) {
    const prevKey = current && current.view ? `${current.view.shotNo}:${current.view.turn}` : '';
    current = { container, view: v, ui };
    if (!container.querySelector('.pool-wrap')) {
      container.innerHTML = `
        <div class="pool-wrap">
          <div class="pool-players"></div>
          <div class="pool-table"><canvas class="pool-canvas"></canvas><div class="golf-power pool-power"><span></span></div></div>
          <div class="pool-hint"></div>
          <details class="poker-log pool-log"><summary>Spielverlauf</summary><ul></ul></details>
        </div>`;
      setupInput(container.querySelector('.pool-canvas'));
      container._shotNo = null;
    }
    if (prevKey !== `${v.shotNo}:${v.turn}`) place = null;
    setHtml(container.querySelector('.pool-players'), v.players.map((p, seat) => {
      const left = p.group ? (p.group === 'solid' ? SOLIDS : STRIPES).filter(n => v.balls.some(b => b.n === n && !b.potted)) : [];
      return `<div class="pool-player ${v.turn === seat && v.phase === 'aim' ? 'active' : ''}">
        <div class="pool-name">${GK.cosmetics.nameTag(p)}${seat === ui.mySeat ? ' (du)' : ''}</div>
        <div class="pool-group">${p.group ? (p.group === 'solid' ? 'Volle' : 'Halbe') : 'Farbe noch offen'}</div>
        <div class="pool-left">${p.group ? (left.length ? left.map(n => ballChip(n)).join('') : ballChip(8) + ' jetzt die 8!') : ''}</div>
      </div>`;
    }).join('<div class="pool-vs">vs</div>'));
    const myTurn = v.phase === 'aim' && v.turn === ui.mySeat;
    let hint;
    if (v.phase === 'finished') hint = v.winner != null ? `🏆 ${esc(v.players[v.winner].name)} gewinnt!` : 'Spiel vorbei';
    else if (v.phase === 'rolling') hint = 'Die Kugeln rollen …';
    else if (myTurn) hint = v.inHand
      ? `✋ Ball in der Hand: Ziehe die weiße Kugel an eine freie Stelle${v.kitchen ? ' (links der Linie)' : ''}, dann tippe auf den Tisch und ziehe zurück zum Stoßen.`
      : '👉 Du bist dran! Tippe auf den Tisch und ziehe zurück – je weiter, desto fester. Loslassen = Stoß.';
    else hint = `${esc(v.players[v.turn].name)} ist dran …`;
    setHtml(container.querySelector('.pool-hint'), hint);
    container.querySelector('.pool-table').classList.toggle('my-turn', myTurn);
    setHtml(container.querySelector('.pool-log ul'), v.log.map(l => `<li>${esc(l)}</li>`).join(''));

    const shot = v.lastShot;
    if (shot && container._shotNo !== null && shot.no !== container._shotNo && v.phase === 'rolling') {
      const r = simulate(shot.before, shot.dx, shot.dy, shot.power, true);
      anim = { r, start: performance.now(), played: 0 };
      GK.sound.play('chip');
    }
    container._shotNo = shot ? shot.no : -1;
    startLoop();
  }

  function ballChip(n) {
    return `<span class="pool-chip ${n >= 9 ? 'stripe' : ''}" style="--c:${BALL_COLORS[n > 8 ? n - 8 : n]}">${n}</span>`;
  }

  function toTable(canvas, e) {
    const rect = canvas.getBoundingClientRect();
    return [(e.clientX - rect.left) / rect.width * W, (e.clientY - rect.top) / rect.height * H];
  }

  function cuePos(v) {
    if (place) return place;
    const c = v.balls.find(b => b.n === 0);
    return [c.x, c.y];
  }

  function setupInput(canvas) {
    canvas.addEventListener('pointerdown', e => {
      if (!current) return;
      const { view: v, ui } = current;
      if (!(v.phase === 'aim' && v.turn === ui.mySeat)) return;
      e.preventDefault();
      if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
      const p = toTable(canvas, e);
      const [cx, cy] = cuePos(v);
      if (v.inHand && (p[0] - cx) ** 2 + (p[1] - cy) ** 2 < 40 * 40) {
        aim = { move: true, now: p };
      } else {
        aim = { start: p, now: p };
      }
      startLoop();
    });
    canvas.addEventListener('pointermove', e => {
      if (!aim || !current) return;
      e.preventDefault();
      aim.now = toTable(canvas, e);
      if (aim.move) {
        const v = current.view;
        if (validSpot(v, aim.now[0], aim.now[1])) place = aim.now.slice();
      }
    });
    const release = e => {
      if (!aim || !current) return;
      const { view: v, ui } = current;
      const a = aim;
      aim = null;
      if (a.move || e.type !== 'pointerup') return;
      const dx = a.start[0] - a.now[0];
      const dy = a.start[1] - a.now[1];
      const power = Math.min(1, Math.sqrt(dx * dx + dy * dy) / 300);
      if (power >= 0.03 && v.phase === 'aim' && v.turn === ui.mySeat) {
        // Hingelegte Weiße nur vergessen, wenn der Stoß auch angekommen ist
        if (ui.act({ type: 'shot', dx, dy, power, place: v.inHand ? cuePos(v) : null })) place = null;
      }
    };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
  }

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

  // Wo trifft die Weiße in Richtung (ux, uy) zuerst auf eine Kugel? (nur Vorschau)
  function preview(v, from, ux, uy) {
    let best = null;
    v.balls.forEach(b => {
      if (b.potted || b.n === 0) return;
      const ox = b.x - from[0];
      const oy = b.y - from[1];
      const along = ox * ux + oy * uy;
      if (along <= 0) return;
      const perp2 = ox * ox + oy * oy - along * along;
      if (perp2 > 4 * R * R) return;
      const t = along - Math.sqrt(4 * R * R - perp2);
      if (!best || t < best.t) best = { t, b };
    });
    return best;
  }

  function render(now) {
    const { container, view: v, ui } = current;
    const canvas = container.querySelector('.pool-canvas');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = canvas.clientWidth || 600;
    if (canvas.width !== Math.round(cssW * dpr)) {
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssW * dpr * H / W);
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(canvas.width / W, 0, 0, canvas.width / W, 0, 0);
    drawTable(ctx);
    // Kugeln: während der Animation aus dem nachgerechneten Stoß
    let positions = v.balls.map(b => (b.potted ? null : [b.x, b.y]));
    if (anim) {
      const i = Math.max(0, Math.min(Math.floor((now - anim.start) / 1000 * 60), anim.r.frames.length - 1));
      positions = anim.r.frames[i];
      anim.r.events.forEach((ev, k) => {
        if (k >= anim.played && ev.step / 2 <= i) {
          anim.played = k + 1;
          GK.sound.play(ev.kind === 'pocket' ? 'reelStop' : ev.kind === 'ball' ? 'chip' : 'tick');
        }
      });
      if (i >= anim.r.frames.length - 1) anim = null;
    }
    const order = anim ? anim.r.balls : v.balls;
    order.forEach((b, i) => {
      let pos = positions[i];
      if (!pos) return;
      if (b.n === 0 && place && !anim) pos = place;
      drawBall(ctx, b.n, pos[0], pos[1]);
    });
    // Zielen: Queue, Linie und Geisterball
    const powerBar = container.querySelector('.pool-power span');
    if (aim && !aim.move && v.turn === ui.mySeat && v.phase === 'aim') {
      const [cx, cy] = cuePos(v);
      const dx = aim.start[0] - aim.now[0];
      const dy = aim.start[1] - aim.now[1];
      const len = Math.sqrt(dx * dx + dy * dy);
      const power = Math.min(1, len / 300);
      if (len > 2) {
        const ux = dx / len;
        const uy = dy / len;
        const hit = preview(v, [cx, cy], ux, uy);
        const reach = hit ? hit.t : 1200;
        ctx.setLineDash([8, 7]);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + ux * reach, cy + uy * reach);
        ctx.stroke();
        ctx.setLineDash([]);
        if (hit) {
          const gx = cx + ux * hit.t;
          const gy = cy + uy * hit.t;
          ctx.beginPath();
          ctx.arc(gx, gy, R, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
          ctx.stroke();
          const nx = hit.b.x - gx;
          const ny = hit.b.y - gy;
          const nl = Math.sqrt(nx * nx + ny * ny) || 1;
          ctx.strokeStyle = 'rgba(255, 229, 138, 0.9)';
          ctx.beginPath();
          ctx.moveTo(hit.b.x, hit.b.y);
          ctx.lineTo(hit.b.x + nx / nl * 70, hit.b.y + ny / nl * 70);
          ctx.stroke();
        }
        // Queue hinter der Weißen
        const back = 18 + power * 70;
        ctx.lineCap = 'round';
        ctx.lineWidth = 7;
        ctx.strokeStyle = '#c8a26a';
        ctx.beginPath();
        ctx.moveTo(cx - ux * back, cy - uy * back);
        ctx.lineTo(cx - ux * (back + 330), cy - uy * (back + 330));
        ctx.stroke();
        ctx.lineWidth = 7;
        ctx.strokeStyle = '#f4f1e6';
        ctx.beginPath();
        ctx.moveTo(cx - ux * back, cy - uy * back);
        ctx.lineTo(cx - ux * (back + 10), cy - uy * (back + 10));
        ctx.stroke();
      }
      powerBar.style.width = `${power * 100}%`;
      powerBar.parentElement.classList.add('show');
    } else {
      powerBar.parentElement.classList.remove('show');
    }
    // Ball in der Hand: Weiße hervorheben
    if (v.inHand && v.phase === 'aim' && v.turn === ui.mySeat && !anim) {
      const [cx, cy] = cuePos(v);
      ctx.beginPath();
      ctx.arc(cx, cy, R + 8 + Math.sin(now / 200) * 2, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 229, 138, 0.9)';
      ctx.lineWidth = 2;
      ctx.stroke();
      if (v.kitchen) {
        ctx.setLineDash([6, 6]);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.beginPath();
        ctx.moveTo(HEAD_X, T);
        ctx.lineTo(HEAD_X, B);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (!running) startLoop();
    }
  }

  function drawTable(ctx) {
    // Holzrahmen
    const wood = ctx.createLinearGradient(0, 0, 0, H);
    wood.addColorStop(0, '#6b3a17');
    wood.addColorStop(1, '#4a250c');
    ctx.fillStyle = wood;
    ctx.fillRect(0, 0, W, H);
    // Filz
    const felt = ctx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, 560);
    felt.addColorStop(0, '#1f8a55');
    felt.addColorStop(1, '#0f5c36');
    ctx.fillStyle = felt;
    ctx.fillRect(L - 10, T - 10, RT - L + 20, B - T + 20);
    // Banden (etwas dunkler)
    ctx.strokeStyle = '#0b4a2b';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    RAILS.slice(0, 6).forEach(([p, q]) => {
      ctx.beginPath();
      ctx.moveTo(p[0], p[1]);
      ctx.lineTo(q[0], q[1]);
      ctx.stroke();
    });
    // Löcher
    POCKETS.forEach(([x, y, r]) => {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = '#0b0b0d';
      ctx.fill();
    });
    // Rauten auf dem Rahmen
    ctx.fillStyle = '#e8d9a8';
    for (let i = 1; i < 8; i++) {
      if (i === 4) continue;
      const x = L + (RT - L) * i / 8;
      ctx.beginPath();
      ctx.arc(x, T - 22, 3, 0, Math.PI * 2);
      ctx.arc(x, B + 22, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Fußpunkt
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.arc(FOOT[0], FOOT[1], 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBall(ctx, n, x, y) {
    ctx.beginPath();
    ctx.arc(x + 2, y + 3, R, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fill();
    const color = BALL_COLORS[n > 8 ? n - 8 : n];
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, R, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = n >= 9 ? '#f4f1e6' : color;
    ctx.fillRect(x - R, y - R, 2 * R, 2 * R);
    if (n >= 9) {
      ctx.fillStyle = color;
      ctx.fillRect(x - R, y - R * 0.55, 2 * R, R * 1.1);
    }
    const shine = ctx.createRadialGradient(x - R * 0.4, y - R * 0.45, 1, x, y, R * 1.2);
    shine.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
    shine.addColorStop(0.4, 'rgba(255, 255, 255, 0)');
    shine.addColorStop(1, 'rgba(0, 0, 0, 0.3)');
    ctx.fillStyle = shine;
    ctx.fillRect(x - R, y - R, 2 * R, 2 * R);
    ctx.restore();
    if (n > 0) {
      ctx.beginPath();
      ctx.arc(x, y, R * 0.48, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.fillStyle = '#111';
      ctx.font = `900 ${n >= 10 ? 8 : 9}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(n), x, y + 0.5);
    }
  }

  const rollTime = st => Math.round(st.lastShot.steps / 120 * 1000);

  GK.room.registerGame({
    id: 'pool',
    name: 'Billard',
    icon: '🎱',
    desc: '8-Ball zu zweit – versenk deine Kugeln und dann die 8!',
    intro: `<p class="muted"><b>So geht's:</b> Wer zuerst eine Kugel versenkt, spielt diese Farbe (Volle 1–7 oder
      Halbe 9–15). Triff immer zuerst eine eigene Kugel. Sind alle eigenen weg, musst du die 8 versenken – fällt
      sie vorher, hast du verloren. Bei einem Foul hat der Gegner „Ball in der Hand“ und darf die weiße Kugel frei
      hinlegen. Zielen: auf den Tisch tippen und zurückziehen, loslassen = Stoß.</p>`,
    minPlayers: 2,
    maxPlayers: 2,
    bots: true,
    settings: { defaults: {} },
    create,
    actor: st => (st.phase === 'aim' ? st.turn : -1),
    act,
    botAct,
    timeout,
    turnTime: () => 45000,
    botDelay: (st, solo) => (solo ? 1100 : 1400),
    autoDelay: st => (st.phase === 'rolling' ? rollTime(st) + 600 : null),
    advance,
    forfeit,
    placeOf: (st, seat) => (seat >= 0 && st.players[seat] ? st.players[seat].place : null),
    finished: st => st.phase === 'finished',
    view: st => JSON.parse(JSON.stringify(st)),
    draw,
    onSettle: place => { if (place === 1) GK.unlockAchievement('poolWin'); },
  });

  // Für Tests
  GK.billiards = { simulate, create, act, advance, forfeit, botAct, rack, validSpot, POCKETS, RAILS, R };
})();
