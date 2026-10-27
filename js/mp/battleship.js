// Seeschlacht (Schiffe versenken): 10 × 10 Felder, jeder hat fünf Schiffe (5, 4, 3, 3, 2 Felder),
// die sich nicht berühren dürfen. Erst stellen beide gleichzeitig ihre Flotte auf, dann wird
// abwechselnd geschossen – wer trifft, darf nochmal. Wer zuerst alle Schiffe versenkt, gewinnt.
// Der Gastgeber schickt jedem nur die eigenen Schiffe und die schon versenkten des Gegners.
window.GK = window.GK || {};

(function () {
  const N = 10;
  const FLEET = [
    { len: 5, name: 'Flaggschiff' },
    { len: 4, name: 'Fregatte' },
    { len: 3, name: 'Brigg' },
    { len: 3, name: 'Schoner' },
    { len: 2, name: 'Beiboot' },
  ];
  const PLACE_TIME = 60000;
  const LETTERS = 'ABCDEFGHIJ';
  // Raster der Schüsse: 0 = unbekannt, 1 = Wasser, 2 = Treffer
  const MISS = 1;
  const HIT = 2;

  // ---------- Flotte ----------

  function cells(ship) {
    return Array.from({ length: ship.len }, (_, k) => (ship.v ? [ship.x, ship.y + k] : [ship.x + k, ship.y]));
  }

  // Liegen die Schiffe im Feld, ohne sich zu überschneiden oder zu berühren (auch nicht schräg)?
  function apart(ships) {
    const taken = new Map();
    for (let i = 0; i < ships.length; i++) {
      for (const [x, y] of cells(ships[i])) {
        if (x < 0 || y < 0 || x >= N || y >= N) return false;
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const other = taken.get(`${x + dx}:${y + dy}`);
            if (other !== undefined && other !== i) return false;
          }
        }
        taken.set(`${x}:${y}`, i);
      }
    }
    return true;
  }

  // Passt die Flotte? Fünf Schiffe mit den richtigen Längen, sauber verteilt
  function validFleet(ships) {
    if (!Array.isArray(ships) || ships.length !== FLEET.length) return false;
    if (!ships.every((s, i) => s && s.len === FLEET[i].len && Number.isInteger(s.x) && Number.isInteger(s.y))) return false;
    return apart(ships);
  }

  function cleanFleet(ships) {
    if (!Array.isArray(ships)) return null;
    const out = ships.slice(0, FLEET.length).map((s, i) => ({ x: Number(s && s.x), y: Number(s && s.y), len: FLEET[i].len, v: !!(s && s.v), sunk: false }));
    return validFleet(out) ? out : null;
  }

  // Zufällige Flotte: die Schiffe der Reihe nach (größte zuerst) an freie Stellen legen
  function randomFleet() {
    for (;;) {
      const ships = [];
      for (const f of FLEET) {
        for (let tries = 0; tries < 200; tries++) {
          const v = GK.rng.float() < 0.5;
          const ship = { x: GK.rng.int(v ? N : N - f.len + 1), y: GK.rng.int(v ? N - f.len + 1 : N), len: f.len, v, sunk: false };
          if (apart(ships.concat([ship]))) {
            ships.push(ship);
            break;
          }
        }
      }
      if (ships.length === FLEET.length) return ships;
    }
  }

  // ---------- Regeln ----------

  function create(seats) {
    const st = {
      players: seats.slice(0, 2).map(s => ({
        id: s.id, name: s.name, avatar: s.avatar || '', isBot: !!s.isBot, skill: s.skill || 0.5,
        place: null, out: false, ready: !!s.isBot, ships: randomFleet(), grid: new Array(N * N).fill(0),
      })),
      phase: 'place', turn: GK.rng.int(2), placeUntil: Date.now() + PLACE_TIME, lastShot: null, log: [],
    };
    if (st.players.every(p => p.ready)) st.phase = 'battle';
    return st;
  }

  function startBattle(st) {
    st.players.forEach(p => { p.ready = true; });
    st.phase = 'battle';
    st.log.unshift(`⚓ Alle Flotten liegen bereit – ${st.players[st.turn].name} schießt zuerst!`);
  }

  function shipAt(player, x, y) {
    return player.ships.find(s => cells(s).some(([cx, cy]) => cx === x && cy === y));
  }

  function finish(st, winner, text) {
    st.players[winner].place = 1;
    st.players[1 - winner].place = 2;
    st.phase = 'finished';
    st.turn = -1;
    st.log.unshift(text);
  }

  function act(st, seat, a) {
    const me = st.players[seat];
    if (!a || !me) return false;
    if (st.phase === 'place') {
      if (me.ready) return false;
      if (a.type === 'place') {
        const ships = cleanFleet(a.ships);
        if (!ships) return false;
        me.ships = ships;
        return true;
      }
      if (a.type === 'ready') {
        me.ready = true;
        if (st.players.every(p => p.ready)) startBattle(st);
        return true;
      }
      return false;
    }
    if (st.phase !== 'battle' || st.turn !== seat || a.type !== 'fire') return false;
    const x = Number(a.x);
    const y = Number(a.y);
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= N || y >= N) return false;
    const foe = st.players[1 - seat];
    const i = y * N + x;
    if (foe.grid[i]) return false;
    const ship = shipAt(foe, x, y);
    foe.grid[i] = ship ? HIT : MISS;
    let sunk = null;
    if (ship && cells(ship).every(([cx, cy]) => foe.grid[cy * N + cx] === HIT)) {
      ship.sunk = true;
      sunk = FLEET[foe.ships.indexOf(ship)].name;
      st.log.unshift(`💥 ${me.name} versenkt das ${sunk} von ${foe.name}!`);
    }
    st.lastShot = { by: seat, x, y, hit: !!ship, sunk, no: (st.lastShot ? st.lastShot.no : 0) + 1 };
    if (foe.ships.every(s => s.sunk)) {
      finish(st, seat, `🏆 ${me.name} hat die ganze Flotte versenkt!`);
      return true;
    }
    if (!ship) st.turn = 1 - seat; // Treffer: nochmal schießen
    return true;
  }

  // Aufstellzeit vorbei: alle legen los, so wie ihre Flotte gerade steht
  function advance(st) {
    if (st.phase === 'place') startBattle(st);
  }

  function forfeit(st, seat) {
    if (st.phase === 'finished') return;
    st.players[seat].out = true;
    finish(st, 1 - seat, `${st.players[seat].name} gibt auf.`);
  }

  // ---------- Computer-Gegner ----------

  // Für jedes freie Feld zählen, wie viele Lagen der übrigen Schiffe hineinpassen.
  // Liegen schon Treffer offen, zählen nur Lagen, die diese Treffer abdecken (dann stark gewichtet).
  function heatmap(foe) {
    const grid = foe.grid;
    const blocked = new Array(N * N).fill(false);
    foe.ships.filter(s => s.sunk).forEach(s => cells(s).forEach(([x, y]) => {
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const cx = x + dx;
          const cy = y + dy;
          if (cx >= 0 && cy >= 0 && cx < N && cy < N) blocked[cy * N + cx] = true;
        }
      }
    }));
    const openHits = [];
    for (let i = 0; i < N * N; i++) if (grid[i] === HIT && !blocked[i]) openHits.push(i);
    const heat = new Array(N * N).fill(0);
    const lens = foe.ships.filter(s => !s.sunk).map(s => s.len);
    for (const len of lens) {
      for (const v of [false, true]) {
        for (let y = 0; y < (v ? N - len + 1 : N); y++) {
          for (let x = 0; x < (v ? N : N - len + 1); x++) {
            let ok = true;
            let covered = 0;
            const idx = [];
            for (let k = 0; k < len && ok; k++) {
              const i = v ? (y + k) * N + x : y * N + x + k;
              if (grid[i] === MISS || blocked[i]) ok = false;
              else if (grid[i] === HIT) covered++;
              idx.push(i);
            }
            if (!ok) continue;
            const w = openHits.length ? (covered ? Math.pow(40, covered) : 0) : 1;
            if (!w) continue;
            idx.forEach(i => { if (!grid[i]) heat[i] += w; });
          }
        }
      }
    }
    return { heat, openHits };
  }

  function unknownCells(foe) {
    const out = [];
    for (let i = 0; i < N * N; i++) if (!foe.grid[i]) out.push(i);
    return out;
  }

  const fire = i => ({ type: 'fire', x: i % N, y: Math.floor(i / N) });

  function botAct(st, seat) {
    const me = st.players[seat];
    const foe = st.players[1 - seat];
    const free = unknownCells(foe);
    const { heat, openHits } = heatmap(foe);
    const sloppy = GK.rng.float() < (1 - me.skill) * (openHits.length ? 0.3 : 0.7);
    if (sloppy) {
      if (!openHits.length) return fire(free[GK.rng.int(free.length)]);
      // Schwächere Gegner suchen nur um einen Treffer herum, ohne zu überlegen
      const around = [];
      openHits.forEach(i => {
        const x = i % N;
        const y = Math.floor(i / N);
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
          const cx = x + dx;
          const cy = y + dy;
          if (cx >= 0 && cy >= 0 && cx < N && cy < N && !foe.grid[cy * N + cx]) around.push(cy * N + cx);
        });
      });
      if (around.length) return fire(around[GK.rng.int(around.length)]);
    }
    let best = -1;
    let options = [];
    free.forEach(i => {
      if (heat[i] > best) { best = heat[i]; options = [i]; } else if (heat[i] === best) options.push(i);
    });
    return fire(options[GK.rng.int(options.length)]);
  }

  function timeout(st, seat) {
    const free = unknownCells(st.players[1 - seat]);
    return fire(free[GK.rng.int(free.length)]);
  }

  // Was ein Platz sehen darf: eigene Schiffe ganz, vom Gegner nur die versenkten (am Ende alle)
  function view(st, seat) {
    return {
      phase: st.phase,
      turn: st.turn,
      lastShot: st.lastShot,
      log: st.log.slice(0, 6),
      players: st.players.map((p, i) => ({
        id: p.id, name: p.name, avatar: p.avatar, isBot: p.isBot, place: p.place, out: p.out, ready: p.ready,
        grid: p.grid.slice(),
        ships: (i === seat || st.phase === 'finished' ? p.ships : p.ships.filter(s => s.sunk)).map(s => ({ ...s, idx: p.ships.indexOf(s) })),
        sunk: p.ships.map(s => s.sunk),
      })),
    };
  }

  // ---------- Darstellung ----------

  const esc = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function setHtml(el, html) {
    if (el._html === html) return false;
    el._html = html;
    el.innerHTML = html;
    return true;
  }

  function gridHtml(side) {
    let html = '<span class="bs-label"></span>';
    for (let x = 0; x < N; x++) html += `<span class="bs-label">${LETTERS[x]}</span>`;
    for (let y = 0; y < N; y++) {
      html += `<span class="bs-label">${y + 1}</span>`;
      for (let x = 0; x < N; x++) html += `<button type="button" class="bs-cell" data-side="${side}" data-i="${y * N + x}" aria-label="${LETTERS[x]}${y + 1}"></button>`;
    }
    return html;
  }

  // Klassen je Feld: Wasser, Schiff (mit Bug/Heck), Fehlschuss, Treffer, versenkt
  function paint(gridEl, grid, ships, opts) {
    const cls = new Array(N * N).fill(null).map(() => ['bs-cell']);
    ships.forEach(s => {
      cells(s).forEach(([x, y], k) => {
        const c = cls[y * N + x];
        c.push('ship', s.v ? 'v' : 'h');
        if (k === 0) c.push('bow');
        if (k === s.len - 1) c.push('stern');
        if (s.sunk) c.push('sunk');
        if (opts.selected === s.idx) c.push('selected');
      });
    });
    for (let i = 0; i < N * N; i++) {
      if (grid[i] === MISS) cls[i].push('miss');
      if (grid[i] === HIT) cls[i].push('hit');
      if (opts.target && !grid[i]) cls[i].push('target');
      if (opts.fresh === i) cls[i].push(grid[i] === HIT ? 'boom' : 'splash');
    }
    gridEl.querySelectorAll('.bs-cell').forEach(el => {
      const str = cls[Number(el.dataset.i)].join(' ');
      if (el.className !== str) el.className = str;
    });
  }

  function fleetHtml(p) {
    return `<div class="bs-fleet">${FLEET.map((f, i) => `<span class="bs-mini ${p.sunk[i] ? 'gone' : ''}" title="${f.name}">${'<i></i>'.repeat(f.len)}</span>`).join('')}</div>`;
  }

  let current = null;

  // Eigene Flotte beim Aufstellen: Schiff antippen = auswählen, nochmal = drehen, freies Feld = verschieben
  function placeTap(container, i) {
    const { view: v, ui } = current;
    const me = v.players[ui.mySeat];
    if (!me || me.ready) return;
    const fleet = (container._fleet || me.ships).map(s => ({ x: s.x, y: s.y, len: s.len, v: s.v }));
    const x = i % N;
    const y = Math.floor(i / N);
    const hit = fleet.findIndex(s => cells(s).some(([cx, cy]) => cx === x && cy === y));
    let changed = null;
    if (hit >= 0 && hit !== container._sel) {
      container._sel = hit;
      GK.sound.play('click');
    } else if (hit >= 0) {
      // Drehen um das angetippte Feld; passt es nicht, ein Stück verschieben
      const s = fleet[hit];
      const k = s.v ? y - s.y : x - s.x;
      const turned = { ...s, v: !s.v, x: s.v ? x - k : x, y: s.v ? y : y - k };
      changed = fit(fleet, hit, turned);
    } else if (container._sel != null && container._sel >= 0) {
      changed = fit(fleet, container._sel, { ...fleet[container._sel], x, y });
    }
    if (changed === false) {
      GK.sound.play('denied');
      GK.fx.pulse(container.querySelector('.bs-own .bs-grid'), 'nope');
    } else if (changed) {
      GK.sound.play('chip');
      container._fleet = changed;
      if (!ui.act({ type: 'place', ships: changed })) container._fleet = null;
    }
    draw(container, v, ui);
  }

  // Schiff an neue Stelle setzen; ragt es hinaus, an den Rand schieben; gibt false zurück, wenn es nicht geht
  function fit(fleet, idx, ship) {
    const s = { ...ship };
    s.x = Math.max(0, Math.min(N - (s.v ? 1 : s.len), s.x));
    s.y = Math.max(0, Math.min(N - (s.v ? s.len : 1), s.y));
    const next = fleet.map((f, i) => (i === idx ? s : f));
    return validFleet(next) ? next : false;
  }

  function draw(container, v, ui) {
    if (!container.querySelector('.bs-wrap')) {
      container.innerHTML = `
        <div class="bs-wrap">
          <div class="pool-players bs-players"></div>
          <div class="bs-seas">
            <div class="bs-sea bs-enemy"><div class="bs-title"></div><div class="bs-grid">${gridHtml('enemy')}</div></div>
            <div class="bs-sea bs-own"><div class="bs-title"></div><div class="bs-grid">${gridHtml('own')}</div></div>
          </div>
          <div class="bs-hint"></div>
          <div class="game-actions bs-actions">
            <button type="button" class="btn bs-shuffle">🎲 Neu verteilen</button>
            <button type="button" class="btn btn-primary bs-ready">✅ Bereit</button>
          </div>
          <div class="bs-log muted small"></div>
        </div>`;
      container._lastNo = null;
      container.querySelector('.bs-seas').addEventListener('click', e => {
        const cell = e.target.closest('.bs-cell');
        if (!cell || !current) return;
        const { view: cv, ui: u } = current;
        const i = Number(cell.dataset.i);
        if (cell.dataset.side === 'own' && cv.phase === 'place') placeTap(container, i);
        else if (cell.dataset.side === 'enemy' && cv.phase === 'battle' && cv.turn === u.mySeat) {
          if (cv.players[1 - u.mySeat].grid[i]) return;
          GK.sound.play('cannon');
          u.act({ type: 'fire', x: i % N, y: Math.floor(i / N) });
        }
      });
      container.querySelector('.bs-shuffle').addEventListener('click', () => {
        if (!current) return;
        const fleet = randomFleet().map(s => ({ x: s.x, y: s.y, len: s.len, v: s.v }));
        container._fleet = fleet;
        container._sel = -1;
        GK.sound.play('flip');
        if (!current.ui.act({ type: 'place', ships: fleet })) container._fleet = null;
        draw(container, current.view, current.ui);
      });
      container.querySelector('.bs-ready').addEventListener('click', () => {
        if (!current) return;
        GK.sound.play('horn');
        container._sel = -1;
        current.ui.act({ type: 'ready' });
      });
    }
    current = { view: v, ui };
    const seat = ui.mySeat >= 0 ? ui.mySeat : 0;
    const me = v.players[seat];
    const foe = v.players[1 - seat];
    const placing = v.phase === 'place';
    const myTurn = v.phase === 'battle' && v.turn === ui.mySeat;
    // Eigene Flotte beim Aufstellen: lokale Änderung gilt, bis der Gastgeber sie bestätigt hat
    if (container._fleet && JSON.stringify(container._fleet.map(s => [s.x, s.y, s.v])) === JSON.stringify(me.ships.map(s => [s.x, s.y, s.v]))) container._fleet = null;
    if (!placing || me.ready) { container._fleet = null; container._sel = -1; }
    const myShips = container._fleet ? container._fleet.map((s, idx) => ({ ...s, idx, sunk: false })) : me.ships;
    const wrap = container.querySelector('.bs-wrap');
    wrap.classList.toggle('placing', placing);
    wrap.classList.toggle('my-turn', myTurn);
    setHtml(container.querySelector('.bs-players'), v.players.map((p, i) => `
      <div class="pool-player ${v.turn === i && v.phase === 'battle' ? 'active' : ''}">
        <div class="pool-name">${p.avatar} ${esc(p.name)}${i === ui.mySeat ? ' (du)' : ''}</div>
        ${placing ? `<div class="pool-group">${p.ready ? '✅ bereit' : '⏳ stellt auf …'}</div>` : fleetHtml(p)}
      </div>`).join('<span class="pool-vs">vs</span>'));
    const last = v.lastShot;
    const isNew = last && container._lastNo !== null && last.no !== container._lastNo;
    const freshEnemy = isNew && last.by === seat ? last.y * N + last.x : -1;
    const freshOwn = isNew && last.by !== seat ? last.y * N + last.x : -1;
    setHtml(container.querySelector('.bs-enemy .bs-title'), `🎯 Meer von ${esc(foe.name)}`);
    setHtml(container.querySelector('.bs-own .bs-title'), placing ? '⚓ Deine Flotte' : '⚓ Dein Meer');
    paint(container.querySelector('.bs-enemy .bs-grid'), foe.grid, foe.ships, { target: myTurn, fresh: freshEnemy });
    paint(container.querySelector('.bs-own .bs-grid'), me.grid, ui.mySeat >= 0 ? myShips : [], { selected: placing && !me.ready ? container._sel : -1, fresh: freshOwn });
    if (isNew) {
      if (last.sunk) GK.sound.play('horn');
      else GK.sound.play(last.hit ? 'boom' : 'plink', 0.6);
      if (last.by !== seat && last.hit) GK.fx.pulse(container.querySelector('.bs-own .bs-grid'), 'nope');
    }
    container._lastNo = last ? last.no : -1;
    const actions = container.querySelector('.bs-actions');
    actions.hidden = !placing || ui.mySeat < 0 || me.ready;
    let hint;
    if (v.phase === 'finished') {
      const winner = v.players.findIndex(p => p.place === 1);
      hint = winner === ui.mySeat ? '🏆 Alle feindlichen Schiffe versenkt – du gewinnst!' : `🏁 ${esc(v.players[winner].name)} gewinnt die Seeschlacht.`;
    } else if (placing) {
      if (ui.mySeat < 0) hint = 'Die Flotten werden aufgestellt …';
      else if (me.ready) hint = `✅ Bereit! Warte auf ${esc(foe.name)} …`;
      else hint = 'Stelle deine Flotte auf: Schiff antippen = auswählen, nochmal antippen = drehen, freies Feld antippen = dorthin fahren.';
    } else if (myTurn) {
      hint = last && last.by === seat && last.hit
        ? (last.sunk ? `💥 Versenkt: ${last.sunk}! Du darfst nochmal.` : '🔥 Treffer! Du darfst nochmal.')
        : '🎯 Feuer frei! Tippe auf ein Feld im gegnerischen Meer.';
    } else {
      hint = last && last.by !== seat && last.hit
        ? `🔥 ${esc(foe.name)} hat getroffen${last.sunk ? ` und dein ${last.sunk} versenkt` : ''} …`
        : `${esc(foe.name)} zielt …`;
    }
    setHtml(container.querySelector('.bs-hint'), hint);
    setHtml(container.querySelector('.bs-log'), v.log.slice(0, 3).map(l => `<div>${esc(l)}</div>`).join(''));
  }

  GK.room.registerGame({
    id: 'battleship',
    name: 'Seeschlacht',
    icon: '⚓',
    desc: 'Schiffe versenken – zu zweit online oder gegen den Computer.',
    intro: `<p class="muted"><b>So geht's:</b> Jeder versteckt fünf Schiffe in seinem Meer. Dann wird abwechselnd
      geschossen – wer trifft, darf gleich nochmal. Wer zuerst die ganze gegnerische Flotte versenkt, gewinnt.</p>`,
    minPlayers: 2,
    maxPlayers: 2,
    bots: true,
    settings: { defaults: {} },
    create,
    actor: st => (st.phase === 'battle' ? st.turn : -1),
    canAct: (st, seat) => (st.phase === 'place' ? !!st.players[seat] && !st.players[seat].ready : st.phase === 'battle' && st.turn === seat),
    phaseDeadline: st => (st.phase === 'place' ? st.placeUntil : null),
    act,
    botAct,
    timeout,
    turnTime: () => 20000,
    botDelay: (st, solo) => (solo ? 800 : 1000),
    autoDelay: (st, solo) => (st.phase === 'place' && !solo ? Math.max(0, st.placeUntil - Date.now()) : null),
    advance,
    forfeit,
    placeOf: (st, seat) => (seat >= 0 && st.players[seat] ? st.players[seat].place : null),
    finished: st => st.phase === 'finished',
    view,
    draw,
    onSettle: place => { if (place === 1) GK.unlockAchievement('seaWin'); },
  });

  // Für Tests
  GK.battleship = { N, FLEET, cells, validFleet, randomFleet, create, act, advance, forfeit, botAct, view, heatmap };
})();
