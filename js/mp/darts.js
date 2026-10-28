// Darts in der Taverne: 2–4 Spieler, 3, 5 oder 8 Runden mit je 3 Pfeilen. Wer am Ende die meisten
// Punkte hat, gewinnt (bei Gleichstand an der Spitze gibt es ein Stechen).
// Zielen: aufs Brett tippen, das Fadenkreuz zittert wie eine echte Hand – im richtigen Moment werfen.
// Der Gastgeber wertet jeden Pfeil (mit Streuung) und schickt das Ergebnis an alle.
window.GK = window.GK || {};

(function () {
  // Felder im Uhrzeigersinn, oben beginnend
  const SECTORS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
  // Radien im Verhältnis zum Außenrand des Doppelrings (echte Maße in mm / 170)
  const RING = { bull: 6.35 / 170, outerBull: 15.9 / 170, tripleIn: 99 / 170, tripleOut: 107 / 170, doubleIn: 162 / 170 };
  const DARTS_PER_TURN = 3;
  const MAX_SHOOTOUTS = 3;
  // Jeder Pfeil streut etwas – auch bei perfektem Timing. Sonst trifft man mit etwas Geduld fast immer
  // Bull oder Dreifach-20 und schlägt die Computer-Gegner jedes Mal.
  const SCATTER = 0.07;
  const WOBBLE = 0.14;         // wie stark die Hand zittert (gutes Timing lohnt sich)
  const T20 = { x: 0, y: -(RING.tripleIn + RING.tripleOut) / 2 };

  // ---------- Wertung ----------

  function score(x, y) {
    const r = Math.sqrt(x * x + y * y);
    if (r <= RING.bull) return { points: 50, label: 'Bull' };
    if (r <= RING.outerBull) return { points: 25, label: '25' };
    if (r > 1) return { points: 0, label: 'Daneben' };
    let angle = Math.atan2(x, -y) * 180 / Math.PI;
    if (angle < 0) angle += 360;
    const n = SECTORS[Math.floor(((angle + 9) % 360) / 18)];
    if (r >= RING.tripleIn && r <= RING.tripleOut) return { points: 3 * n, label: `T${n}` };
    if (r >= RING.doubleIn) return { points: 2 * n, label: `D${n}` };
    return { points: n, label: String(n) };
  }

  function gauss() {
    let u = 0;
    while (u === 0) u = GK.rng.float();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * GK.rng.float());
  }

  // Zittern der Hand zum Zeitpunkt t (Sekunden) – auch für die Anzeige beim Zielen
  function wobble(t) {
    return {
      x: WOBBLE * (0.75 * Math.sin(1.9 * t) + 0.35 * Math.sin(4.3 * t + 1)),
      y: WOBBLE * (0.75 * Math.cos(1.5 * t) + 0.35 * Math.sin(3.7 * t)),
    };
  }

  // ---------- Regeln ----------

  function create(seats, settings) {
    const rounds = [3, 5, 8].includes(settings && settings.rounds) ? settings.rounds : 5;
    const players = seats.slice(0, 4).map(s => ({
      id: s.id, name: s.name, avatar: s.avatar || '', isBot: !!s.isBot, skill: s.skill || 0.5,
      place: null, out: false, score: 0, best: 0, turns: [], darts: [],
    }));
    const start = GK.rng.int(players.length);
    const order = players.map((_, i) => (start + i) % players.length);
    return { players, rounds, round: 1, shootout: 0, order, idx: 0, phase: 'throw', lastDart: null, log: [] };
  }

  const current = st => st.order[st.idx];

  function act(st, seat, a) {
    if (st.phase !== 'throw' || current(st) !== seat || !a || a.type !== 'throw') return false;
    let x = Number(a.x);
    let y = Number(a.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    x = Math.max(-1.45, Math.min(1.45, x)) + gauss() * SCATTER;
    y = Math.max(-1.45, Math.min(1.45, y)) + gauss() * SCATTER;
    const p = st.players[seat];
    const s = score(x, y);
    p.darts.push({ x, y, points: s.points, label: s.label });
    p.score += s.points;
    p.best = Math.max(p.best, s.points);
    st.lastDart = { seat, x, y, points: s.points, label: s.label, no: (st.lastDart ? st.lastDart.no : 0) + 1 };
    if (p.darts.length >= DARTS_PER_TURN) {
      const total = p.darts.reduce((sum, d) => sum + d.points, 0);
      p.turns.push(total);
      if (total >= 100) st.log.unshift(`🎯 ${p.name} wirft ${total}!`);
      st.phase = 'show';
    }
    return true;
  }

  // Nach den drei Pfeilen: nächster Spieler, nächste Runde oder Ende
  function advance(st) {
    if (st.phase !== 'show') return;
    let idx = st.idx + 1;
    while (idx < st.order.length && st.players[st.order[idx]].out) idx++;
    if (idx < st.order.length) {
      startTurn(st, idx);
      return;
    }
    // Runde vorbei
    const active = st.players.map((p, i) => i).filter(i => !st.players[i].out);
    if (!st.shootout && st.round < st.rounds) {
      st.round++;
      st.order = st.order.filter(i => !st.players[i].out);
      startTurn(st, 0);
      return;
    }
    const top = Math.max(...active.map(i => st.players[i].score));
    const leaders = active.filter(i => st.players[i].score === top);
    if (leaders.length > 1 && st.shootout < MAX_SHOOTOUTS) {
      st.shootout++;
      st.order = leaders;
      st.log.unshift(`⚔️ Gleichstand mit ${top} Punkten – Stechen!`);
      startTurn(st, 0);
      return;
    }
    finish(st);
  }

  function startTurn(st, idx) {
    st.idx = idx;
    st.players[st.order[idx]].darts = [];
    st.phase = 'throw';
  }

  // Plätze nach Punkten; Gleichstand: höchster Einzelwurf, dann Sitzplatz
  function finish(st) {
    const active = st.players.map((p, i) => i).filter(i => !st.players[i].out);
    active.sort((a, b) => st.players[b].score - st.players[a].score || st.players[b].best - st.players[a].best || a - b);
    active.forEach((seat, k) => { st.players[seat].place = k + 1; });
    st.phase = 'finished';
    st.idx = -1;
    st.log.unshift(`🏆 ${st.players[active[0]].name} gewinnt mit ${st.players[active[0]].score} Punkten!`);
  }

  function forfeit(st, seat) {
    const p = st.players[seat];
    if (p.out || st.phase === 'finished') return;
    p.place = st.players.filter(q => !q.out).length;
    p.out = true;
    st.log.unshift(`${p.name} verlässt die Taverne (${p.place}. Platz).`);
    if (st.players.filter(q => !q.out).length <= 1) {
      finish(st);
      return;
    }
    // War er gerade dran, geht es mit dem Nächsten weiter
    if (st.phase === 'throw' && current(st) === seat) {
      p.darts = [];
      st.phase = 'show';
      advance(st);
    }
  }

  // ---------- Computer-Gegner ----------

  function botAct(st, seat) {
    const skill = st.players[seat].skill;
    // Alle zielen auf die Dreifach-20, schwächere ungenauer (dazu kommt die Streuung, die jeder hat)
    const sigma = (1 - skill) * 0.13;
    return { type: 'throw', x: T20.x + gauss() * sigma, y: T20.y + gauss() * sigma };
  }

  // Zeit abgelaufen: ein hastiger Wurf
  function timeout() {
    return { type: 'throw', x: gauss() * 0.3, y: -0.42 + gauss() * 0.3 };
  }

  // ---------- Darstellung ----------

  const esc = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const SIZE = 600;          // Zeichenfläche (logisch)
  const SCALE = 1.5;
  const R = 200;             // Pixel für den Außenrand des Doppelrings
  let boardImage = null;
  let shown = null;

  function setHtml(el, html) {
    if (el._html === html) return false;
    el._html = html;
    el.innerHTML = html;
    return true;
  }

  // Das Brett einmal vorzeichnen
  function renderBoard() {
    const c = document.createElement('canvas');
    c.width = SIZE * SCALE;
    c.height = SIZE * SCALE;
    const g = c.getContext('2d');
    g.scale(SCALE, SCALE);
    g.translate(SIZE / 2, SIZE / 2);
    // Holzwand-Hintergrund und Rand
    g.fillStyle = '#1b1210';
    g.beginPath();
    g.arc(0, 0, R * 1.32, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#8a6a2a';
    g.lineWidth = 6;
    g.stroke();
    const ring = (r0, r1, colorA, colorB) => {
      for (let i = 0; i < 20; i++) {
        const a0 = (i * 18 - 9 - 90) * Math.PI / 180;
        const a1 = (i * 18 + 9 - 90) * Math.PI / 180;
        g.beginPath();
        g.arc(0, 0, r1 * R, a0, a1);
        g.arc(0, 0, r0 * R, a1, a0, true);
        g.closePath();
        g.fillStyle = i % 2 ? colorB : colorA;
        g.fill();
      }
    };
    ring(RING.doubleIn, 1, '#c8262c', '#1f8a3e');
    ring(RING.tripleOut, RING.doubleIn, '#141414', '#efe2bf');
    ring(RING.tripleIn, RING.tripleOut, '#c8262c', '#1f8a3e');
    ring(RING.outerBull, RING.tripleIn, '#141414', '#efe2bf');
    g.fillStyle = '#1f8a3e';
    g.beginPath();
    g.arc(0, 0, RING.outerBull * R, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#c8262c';
    g.beginPath();
    g.arc(0, 0, RING.bull * R, 0, Math.PI * 2);
    g.fill();
    // Drähte
    g.strokeStyle = 'rgba(210, 210, 210, 0.55)';
    g.lineWidth = 1;
    [RING.outerBull, RING.tripleIn, RING.tripleOut, RING.doubleIn, 1].forEach(r => {
      g.beginPath();
      g.arc(0, 0, r * R, 0, Math.PI * 2);
      g.stroke();
    });
    // Zahlen
    g.fillStyle = '#f4e7c5';
    g.font = '700 26px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    SECTORS.forEach((n, i) => {
      const a = (i * 18 - 90) * Math.PI / 180;
      g.fillText(String(n), Math.cos(a) * R * 1.16, Math.sin(a) * R * 1.16);
    });
    return c;
  }

  function drawDart(g, d, k) {
    // k: 0 = gerade geworfen (groß) … 1 = steckt
    const x = SIZE / 2 + d.x * R;
    const y = SIZE / 2 + d.y * R;
    const size = 1 + (1 - k) * 1.4;
    g.save();
    g.translate(x, y);
    g.globalAlpha = 0.4 + 0.6 * k;
    g.fillStyle = 'rgba(0, 0, 0, 0.45)';
    g.beginPath();
    g.ellipse(6 * size, 8 * size, 5 * size, 3 * size, 0.5, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
    // Schaft und Flügel (schräg nach rechts unten)
    g.strokeStyle = '#d9d9d9';
    g.lineWidth = 3 * size;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(14 * size, 18 * size);
    g.stroke();
    g.fillStyle = '#ffcf3e';
    g.beginPath();
    g.moveTo(12 * size, 14 * size);
    g.lineTo(26 * size, 20 * size);
    g.lineTo(18 * size, 30 * size);
    g.closePath();
    g.fill();
    g.fillStyle = '#ff4d2e';
    g.beginPath();
    g.arc(0, 0, 3.5 * size, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  function frame(container) {
    const canvas = container.querySelector('.darts-canvas');
    if (!canvas || !canvas.isConnected || !shown) {
      container._raf = null;
      return;
    }
    const { view: v, ui } = shown;
    const g = canvas.getContext('2d');
    if (!boardImage) boardImage = renderBoard();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.drawImage(boardImage, 0, 0);
    g.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    const now = performance.now();
    // Pfeile des Spielers, der gerade wirft (oder gerade geworfen hat)
    const seat = v.idx >= 0 ? v.order[v.idx] : -1;
    if (seat >= 0) {
      const darts = v.players[seat].darts;
      darts.forEach((d, i) => {
        const fresh = i === darts.length - 1 && container._dartAt && v.lastDart && v.lastDart.seat === seat;
        const k = fresh ? Math.min(1, Math.max(0, (now - container._dartAt) / 220)) : 1;
        drawDart(g, d, k);
      });
    }
    // Fadenkreuz beim eigenen Wurf
    const mine = v.phase === 'throw' && seat === ui.mySeat && !ui.ended;
    if (mine) {
      const w = wobble(now / 1000);
      const aim = container._aim || T20;
      const x = SIZE / 2 + (aim.x + w.x) * R;
      const y = SIZE / 2 + (aim.y + w.y) * R;
      g.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      g.setLineDash([4, 4]);
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(SIZE / 2 + aim.x * R, SIZE / 2 + aim.y * R, WOBBLE * R * 1.1, 0, Math.PI * 2);
      g.stroke();
      g.setLineDash([]);
      g.strokeStyle = '#ffe066';
      g.lineWidth = 2.5;
      g.shadowColor = 'rgba(0, 0, 0, 0.9)';
      g.shadowBlur = 4;
      g.beginPath();
      g.arc(x, y, 11, 0, Math.PI * 2);
      g.moveTo(x - 18, y);
      g.lineTo(x - 5, y);
      g.moveTo(x + 5, y);
      g.lineTo(x + 18, y);
      g.moveTo(x, y - 18);
      g.lineTo(x, y - 5);
      g.moveTo(x, y + 5);
      g.lineTo(x, y + 18);
      g.stroke();
      g.shadowBlur = 0;
    }
    container._raf = requestAnimationFrame(() => frame(container));
  }

  // Wurf abgeschickt, aber noch nicht gewertet? Nach 4 Sekunden ohne Antwort (Verbindung weg)
  // darf man es nochmal versuchen
  function thrownRecently(container, no) {
    return container._thrownFor === no && Date.now() - (container._thrownAt || 0) < 4000;
  }

  function throwNow(container) {
    if (!shown) return;
    const { view: v, ui } = shown;
    // Nur ein Wurf pro Pfeil, bis der Gastgeber ihn gewertet hat
    const no = v.lastDart ? v.lastDart.no : 0;
    if (v.phase !== 'throw' || v.order[v.idx] !== ui.mySeat || thrownRecently(container, no)) return;
    container._thrownFor = no;
    container._thrownAt = Date.now();
    // Kommt keine Antwort, den Knopf nach Ablauf der Sperre wieder freigeben
    setTimeout(() => { if (shown && container._thrownFor === no) draw(container, shown.view, shown.ui); }, 4100);
    const w = wobble(performance.now() / 1000);
    const aim = container._aim || T20;
    GK.sound.play('click');
    // Keine Verbindung: Knopf wieder freigeben, damit man es gleich nochmal versuchen kann
    if (!ui.act({ type: 'throw', x: aim.x + w.x, y: aim.y + w.y })) {
      container._thrownFor = undefined;
      draw(container, v, ui);
    }
  }

  function setAim(container, e) {
    if (!shown) return;
    const { view: v, ui } = shown;
    if (v.phase !== 'throw' || v.order[v.idx] !== ui.mySeat) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width * SIZE - SIZE / 2) / R;
    const y = ((e.clientY - rect.top) / rect.height * SIZE - SIZE / 2) / R;
    container._aim = { x: Math.max(-1.3, Math.min(1.3, x)), y: Math.max(-1.3, Math.min(1.3, y)) };
  }

  function draw(container, v, ui) {
    if (!container.querySelector('.darts-wrap')) {
      container.innerHTML = `
        <div class="darts-wrap">
          <div class="golf-head darts-head"></div>
          <div class="darts-main">
            <div class="darts-board">
              <canvas class="darts-canvas" width="${SIZE * SCALE}" height="${SIZE * SCALE}"></canvas>
            </div>
            <div class="darts-side">
              <div class="darts-turn"></div>
              <button type="button" class="btn btn-primary btn-big darts-throw">🎯 Werfen!</button>
              <div class="darts-hint"></div>
              <div class="darts-scores"></div>
            </div>
          </div>
          <div class="darts-log muted small"></div>
        </div>`;
      const canvas = container.querySelector('.darts-canvas');
      canvas.addEventListener('pointerdown', e => {
        setAim(container, e);
        if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
        container._dragging = true;
      });
      canvas.addEventListener('pointermove', e => { if (container._dragging) setAim(container, e); });
      const stop = () => { container._dragging = false; };
      canvas.addEventListener('pointerup', stop);
      canvas.addEventListener('pointercancel', stop);
      container.querySelector('.darts-throw').addEventListener('click', () => throwNow(container));
      container._lastNo = null;
    }
    shown = { view: v, ui };
    const seat = v.idx >= 0 ? v.order[v.idx] : -1;
    const myTurn = v.phase === 'throw' && seat === ui.mySeat && !ui.ended;
    // Neuer Pfeil: Flug-Animation und Ton
    const d = v.lastDart;
    if (d && container._lastNo !== null && d.no !== container._lastNo) {
      container._dartAt = performance.now();
      GK.sound.play(d.points >= 50 ? 'bonus' : d.points ? 'chip' : 'plink', 0.5);
      if (d.seat === ui.mySeat && d.points === 50) GK.unlockAchievement('dartsBull');
      const p = v.players[d.seat];
      if (p.darts.length === DARTS_PER_TURN && p.darts.reduce((s, x) => s + x.points, 0) === 180) {
        GK.sound.play('jackpot');
        if (d.seat === ui.mySeat) GK.unlockAchievement('darts180');
      }
    }
    container._lastNo = d ? d.no : -1;
    if (!container._raf) container._raf = requestAnimationFrame(() => frame(container));
    const head = v.phase === 'finished' ? '🏁 Spiel vorbei'
      : v.shootout ? `⚔️ Stechen${v.shootout > 1 ? ` (${v.shootout})` : ''}` : `🍺 Runde ${v.round} von ${v.rounds}`;
    setHtml(container.querySelector('.darts-head'), head);
    const ranked = v.players.map((p, i) => i).sort((a, b) => v.players[b].score - v.players[a].score);
    setHtml(container.querySelector('.darts-scores'), ranked.map(i => {
      const p = v.players[i];
      return `<div class="darts-row ${i === seat && v.phase !== 'finished' ? 'active' : ''} ${p.out ? 'out' : ''}">
        <span class="darts-name">${p.avatar} ${esc(p.name)}${i === ui.mySeat ? ' (du)' : ''}</span>
        <span class="darts-last">${p.turns.length ? `+${p.turns[p.turns.length - 1]}` : ''}</span>
        <b class="darts-total">${p.out ? '–' : p.score}</b>
      </div>`;
    }).join(''));
    const darts = seat >= 0 ? v.players[seat].darts : [];
    setHtml(container.querySelector('.darts-turn'), seat >= 0
      ? Array.from({ length: DARTS_PER_TURN }, (_, k) => `<span class="darts-slot ${darts[k] ? (darts[k].points >= 50 || darts[k].label[0] === 'T' ? 'great' : darts[k].points ? 'hit' : 'miss') : ''}">${darts[k] ? darts[k].label : '🎯'}</span>`).join('')
        + `<span class="darts-sum">= ${darts.reduce((s, x) => s + x.points, 0)}</span>`
      : '');
    const btn = container.querySelector('.darts-throw');
    btn.disabled = !myTurn || thrownRecently(container, d ? d.no : 0);
    btn.hidden = v.phase === 'finished';
    let hint;
    if (v.phase === 'finished') {
      const w = v.players.findIndex(p => p.place === 1);
      hint = w === ui.mySeat ? '🏆 Du bist der Champion der Taverne!' : `🏁 ${esc(v.players[w].name)} gewinnt.`;
    } else if (myTurn) {
      hint = `Pfeil ${darts.length + 1} von ${DARTS_PER_TURN}: Tippe aufs Brett zum Zielen – dann im richtigen Moment werfen!`;
    } else if (seat >= 0) {
      hint = v.phase === 'show' ? `${esc(v.players[seat].name)} hat ${darts.reduce((s, x) => s + x.points, 0)} Punkte geworfen.` : `${esc(v.players[seat].name)} wirft …`;
    } else hint = '';
    setHtml(container.querySelector('.darts-hint'), hint);
    setHtml(container.querySelector('.darts-log'), v.log.slice(0, 3).map(l => `<div>${esc(l)}</div>`).join(''));
  }

  GK.room.registerGame({
    id: 'darts',
    name: 'Darts in der Taverne',
    icon: '🎯',
    desc: 'Drei Pfeile pro Runde – wer trifft am besten? Für 2 bis 4 Spieler.',
    intro: `<p class="muted"><b>So geht's:</b> Reihum wirft jeder drei Pfeile. Tippe aufs Brett, um zu zielen –
      die Hand zittert, also wirf im richtigen Moment. Ganz genau landet kein Pfeil, ein bisschen streut jeder Wurf.
      Dreifach-Ring zählt dreifach, der äußere Ring doppelt,
      das Bull in der Mitte 50 Punkte. Nach der letzten Runde gewinnt, wer die meisten Punkte hat.</p>`,
    minPlayers: 2,
    maxPlayers: 4,
    bots: true,
    settings: {
      defaults: { rounds: 5 },
      html: s => `<div class="bet-label">Runden</div>
        <div class="room-opts">${[3, 5, 8].map(n => `<button type="button" class="btn btn-small room-opt ${s.rounds === n ? 'active' : ''}" data-rounds="${n}">${n} Runden</button>`).join('')}</div>`,
      bind: (el, changed) => el.querySelectorAll('.room-opt').forEach(btn => btn.addEventListener('click', () => {
        el.querySelectorAll('.room-opt').forEach(b => b.classList.toggle('active', b === btn));
        GK.sound.play('chip');
        changed();
      })),
      read: el => ({ rounds: Number((el.querySelector('.room-opt.active') || {}).dataset?.rounds) || 5 }),
    },
    settingsText: s => `${s.rounds} Runden`,
    create,
    actor: st => (st.phase === 'throw' ? current(st) : -1),
    act,
    botAct,
    timeout,
    turnTime: () => 20000,
    botDelay: (st, solo) => (solo ? 900 : 1100),
    autoDelay: st => (st.phase === 'show' ? 1800 : null),
    advance,
    forfeit,
    placeOf: (st, seat) => (seat >= 0 && st.players[seat] ? st.players[seat].place : null),
    finished: st => st.phase === 'finished',
    view: st => JSON.parse(JSON.stringify(st)),
    draw,
    onSettle: place => { if (place === 1) GK.unlockAchievement('dartsWin'); },
  });

  // Für Tests
  GK.darts = { SECTORS, RING, T20, WOBBLE, score, wobble, create, act, advance, forfeit, botAct, timeout };
})();
