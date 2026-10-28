// Vier gewinnt: 7 Spalten, 6 Reihen. Wer zuerst vier eigene Steine in einer Reihe hat (waagerecht,
// senkrecht oder schräg), gewinnt. Ist das Brett voll, wird es geleert und weitergespielt.
// Zu zweit online oder gegen einen Computer-Gegner (sucht mehrere Züge voraus).
window.GK = window.GK || {};

(function () {
  const COLS = 7;
  const ROWS = 6;
  const DISCS = ['gold', 'red'];

  // ---------- Regeln ----------

  // Brett: board[spalte] = Steine von unten nach oben (0 oder 1)
  function create(seats) {
    const st = {
      players: seats.slice(0, 2).map(s => ({ id: s.id, name: s.name, avatar: s.avatar || '', isBot: !!s.isBot, skill: s.skill || 0.5, place: null, out: false })),
      board: Array.from({ length: COLS }, () => []),
      turn: GK.rng.int(2), starter: 0, phase: 'play', winLine: null, lastMove: null, games: 1, log: [],
    };
    st.starter = st.turn;
    return st;
  }

  function winLine(board, col, row) {
    const me = board[col][row];
    const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
    for (const [dx, dy] of dirs) {
      const line = [[col, row]];
      for (const sign of [1, -1]) {
        let c = col + dx * sign;
        let r = row + dy * sign;
        while (c >= 0 && c < COLS && r >= 0 && r < ROWS && board[c][r] === me) {
          line.push([c, r]);
          c += dx * sign;
          r += dy * sign;
        }
      }
      if (line.length >= 4) return line;
    }
    return null;
  }

  function act(st, seat, a) {
    if (st.phase !== 'play' || st.turn !== seat || !a || a.type !== 'drop') return false;
    const col = Math.floor(Number(a.col));
    if (!(col >= 0 && col < COLS) || st.board[col].length >= ROWS) return false;
    st.board[col].push(seat);
    const row = st.board[col].length - 1;
    st.lastMove = { col, row, seat, no: (st.lastMove ? st.lastMove.no : 0) + 1 };
    const line = winLine(st.board, col, row);
    if (line) {
      st.winLine = line;
      st.players[seat].place = 1;
      st.players[1 - seat].place = 2;
      st.phase = 'finished';
      st.turn = -1;
      st.log.unshift(`🏆 ${st.players[seat].name} hat vier in einer Reihe!`);
      return true;
    }
    if (st.board.every(c => c.length >= ROWS)) {
      // Unentschieden: Brett leeren, der andere beginnt
      st.phase = 'full';
      st.log.unshift('Das Brett ist voll – unentschieden! Es geht von vorne los.');
      return true;
    }
    st.turn = 1 - seat;
    return true;
  }

  function advance(st) {
    if (st.phase !== 'full') return;
    st.board = Array.from({ length: COLS }, () => []);
    st.starter = 1 - st.starter;
    st.turn = st.starter;
    st.games++;
    st.lastMove = null;
    st.phase = 'play';
  }

  function forfeit(st, seat) {
    if (st.phase === 'finished') return;
    st.players[seat].place = 2;
    st.players[seat].out = true;
    st.players[1 - seat].place = 1;
    st.phase = 'finished';
    st.turn = -1;
    st.log.unshift(`${st.players[seat].name} gibt auf.`);
  }

  // ---------- Computer-Gegner (Minimax mit Alpha-Beta) ----------

  function scoreWindow(cells, me) {
    const mine = cells.filter(c => c === me).length;
    const theirs = cells.filter(c => c === 1 - me).length;
    const empty = cells.filter(c => c === undefined).length;
    if (mine === 4) return 1000;
    if (mine === 3 && empty === 1) return 6;
    if (mine === 2 && empty === 2) return 2;
    if (theirs === 3 && empty === 1) return -8;
    return 0;
  }

  function evaluate(board, me) {
    let score = 0;
    for (let r = 0; r < ROWS; r++) if (board[3][r] === me) score += 3;
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        if (c + 3 < COLS) score += scoreWindow([0, 1, 2, 3].map(k => board[c + k][r]), me);
        if (r + 3 < ROWS) score += scoreWindow([0, 1, 2, 3].map(k => board[c][r + k]), me);
        if (c + 3 < COLS && r + 3 < ROWS) score += scoreWindow([0, 1, 2, 3].map(k => board[c + k][r + k]), me);
        if (c + 3 < COLS && r - 3 >= 0) score += scoreWindow([0, 1, 2, 3].map(k => board[c + k][r - k]), me);
      }
    }
    return score;
  }

  const ORDER = [3, 2, 4, 1, 5, 0, 6];

  function minimax(board, depth, alpha, beta, player, me) {
    if (depth === 0) return evaluate(board, me);
    let moved = false;
    let best = player === me ? -Infinity : Infinity;
    for (const c of ORDER) {
      if (board[c].length >= ROWS) continue;
      moved = true;
      board[c].push(player);
      let value;
      if (winLine(board, c, board[c].length - 1)) value = (player === me ? 100000 : -100000) * (depth + 1);
      else value = minimax(board, depth - 1, alpha, beta, 1 - player, me);
      board[c].pop();
      if (player === me) {
        best = Math.max(best, value);
        alpha = Math.max(alpha, value);
      } else {
        best = Math.min(best, value);
        beta = Math.min(beta, value);
      }
      if (alpha >= beta) break;
    }
    return moved ? best : 0;
  }

  function botAct(st, seat) {
    const me = st.players[seat];
    const board = st.board.map(c => c.slice());
    const depth = 2 + Math.round(me.skill * 4); // 2 bis 6 Züge voraus
    const moves = [];
    for (const c of ORDER) {
      if (board[c].length >= ROWS) continue;
      board[c].push(seat);
      const value = winLine(board, c, board[c].length - 1) ? 1e9 : minimax(board, depth - 1, -Infinity, Infinity, 1 - seat, seat);
      board[c].pop();
      moves.push({ c, value });
    }
    moves.sort((a, b) => b.value - a.value);
    // Schwächere Gegner übersehen ab und zu etwas – aber nie einen sicheren Sieg oder eine sichere Niederlage
    const decisive = value => Math.abs(value) >= 50000;
    if (moves.length > 1 && !decisive(moves[0].value) && !decisive(moves[1].value) && GK.rng.float() < (1 - me.skill) * 0.25) {
      return { type: 'drop', col: moves[1].c };
    }
    return { type: 'drop', col: moves[0].c };
  }

  function timeout(st) {
    const free = ORDER.filter(c => st.board[c].length < ROWS);
    return { type: 'drop', col: free[0] };
  }

  // ---------- Darstellung ----------

  const esc = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function setHtml(el, html) {
    if (el._html === html) return false;
    el._html = html;
    el.innerHTML = html;
    return true;
  }

  function draw(container, v, ui) {
    if (!container.querySelector('.c4-wrap')) {
      container.innerHTML = `
        <div class="c4-wrap">
          <div class="pool-players c4-players"></div>
          <div class="c4-board">${Array.from({ length: COLS }, (_, c) => `
            <button class="c4-col" data-col="${c}" aria-label="Spalte ${c + 1}">
              ${Array.from({ length: ROWS }, (_, r) => `<span class="c4-cell" data-r="${ROWS - 1 - r}"></span>`).join('')}
            </button>`).join('')}</div>
          <div class="c4-hint"></div>
        </div>`;
      container.querySelector('.c4-board').addEventListener('click', e => {
        const col = e.target.closest('.c4-col');
        if (!col || !current) return;
        const { view, ui: u } = current;
        if (view.phase !== 'play' || view.turn !== u.mySeat) return;
        if (view.board[Number(col.dataset.col)].length >= ROWS) return;
        GK.sound.play('chip');
        u.act({ type: 'drop', col: Number(col.dataset.col) });
      });
      container._lastNo = null;
    }
    current = { view: v, ui };
    setHtml(container.querySelector('.c4-players'), v.players.map((p, seat) => `
      <div class="pool-player c4-player ${v.turn === seat && v.phase === 'play' ? 'active' : ''}">
        <span class="c4-disc ${DISCS[seat]}"></span> ${GK.cosmetics.nameTag(p)}${seat === ui.mySeat ? ' (du)' : ''}
      </div>`).join('<span class="pool-vs">vs</span>'));
    const myTurn = v.phase === 'play' && v.turn === ui.mySeat;
    const win = new Set((v.winLine || []).map(([c, r]) => `${c}:${r}`));
    const last = v.lastMove;
    const isNew = last && container._lastNo !== null && last.no !== container._lastNo;
    container.querySelectorAll('.c4-col').forEach(colEl => {
      const c = Number(colEl.dataset.col);
      colEl.disabled = !myTurn || v.board[c].length >= ROWS;
      colEl.querySelectorAll('.c4-cell').forEach(cell => {
        const r = Number(cell.dataset.r);
        const owner = v.board[c][r];
        const cls = ['c4-cell'];
        if (owner !== undefined) cls.push('filled', DISCS[owner]);
        if (win.has(`${c}:${r}`)) cls.push('win');
        if (isNew && last.col === c && last.row === r) cls.push('drop');
        const str = cls.join(' ');
        if (cell.className !== str) {
          cell.className = str;
          if (isNew && last.col === c && last.row === r) cell.style.setProperty('--fall', ROWS - r);
        }
      });
    });
    if (isNew) GK.sound.play(v.phase === 'finished' ? 'bonus' : 'reelStop');
    container._lastNo = last ? last.no : -1;
    let hint;
    if (v.phase === 'finished') {
      const winner = v.players.findIndex(p => p.place === 1);
      hint = winner === ui.mySeat ? '🏆 Vier in einer Reihe – du gewinnst!' : `🏁 ${esc(v.players[winner].name)} gewinnt.`;
    } else if (v.phase === 'full') hint = '🤝 Unentschieden – das Brett wird geleert …';
    else if (myTurn) hint = '👉 Du bist dran – tippe auf eine Spalte!';
    else hint = `${esc(v.players[v.turn].name)} überlegt …`;
    setHtml(container.querySelector('.c4-hint'), hint);
  }

  let current = null;

  GK.room.registerGame({
    id: 'connect4',
    name: 'Vier gewinnt',
    icon: '🔴',
    desc: 'Vier in einer Reihe – zu zweit online oder gegen den Computer.',
    intro: `<p class="muted"><b>So geht's:</b> Abwechselnd wirft jeder einen Stein in eine Spalte. Wer zuerst vier
      eigene Steine in einer Reihe hat – waagerecht, senkrecht oder schräg – gewinnt. Ist das Brett voll,
      geht es von vorne los.</p>`,
    minPlayers: 2,
    maxPlayers: 2,
    bots: true,
    settings: { defaults: {} },
    create,
    actor: st => (st.phase === 'play' ? st.turn : -1),
    act,
    botAct,
    timeout,
    turnTime: () => 25000,
    botDelay: (st, solo) => (solo ? 700 : 900),
    autoDelay: st => (st.phase === 'full' ? 2500 : null),
    advance,
    forfeit,
    placeOf: (st, seat) => (seat >= 0 && st.players[seat] ? st.players[seat].place : null),
    finished: st => st.phase === 'finished',
    view: st => JSON.parse(JSON.stringify(st)),
    draw,
    onSettle: place => { if (place === 1) GK.unlockAchievement('c4Win'); },
  });

  // Für Tests
  GK.connect4 = { create, act, advance, forfeit, botAct, winLine, COLS, ROWS };
})();
