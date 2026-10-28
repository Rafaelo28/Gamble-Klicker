// Freundes-Rangliste ohne eigenen Server: Wer zusammen in einem Raum ist (Spiele mit Freunden oder Poker),
// schickt seine Rekorde mit. Jedes Gerät merkt sich die Rekorde seiner Freunde und zeigt eine Rangliste –
// mit dem Stand vom letzten gemeinsamen Spiel. Es wird nichts ins Internet hochgeladen.
window.GK = window.GK || {};

(function () {
  const MAX_FRIENDS = 60;
  const MAX_GAMES = 80;
  const ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  // Ranglisten: Gesamtwerte und je Spiel (games[id] = [größter Gewinn, größter Verlust, bester Treffer])
  const BOARDS = [
    { id: 'money',  icon: '💰', name: 'Vermögen',             money: true },
    { id: 'earned', icon: '📈', name: 'Insgesamt verdient',   money: true },
    { id: 'net',    icon: '🎲', name: 'Casino-Bilanz',        money: true, signed: true },
    { id: 'win',    icon: '🏆', name: 'Größter Gewinn',       money: true },
    { id: 'loss',   icon: '💸', name: 'Größter Verlust',      money: true },
    { id: 'mult',   icon: '🎯', name: 'Bester Treffer',       mult: true },
    { id: 'wins',   icon: '🥇', name: 'Siege mit Freunden' },
    { id: 'ach',    icon: '🏅', name: 'Erfolge' },
  ];
  const GAME_BOARDS = [
    { id: 0, icon: '🏆', name: 'Größter Gewinn', money: true },
    { id: 1, icon: '💸', name: 'Größter Verlust', money: true },
    { id: 2, icon: '🎯', name: 'Bester Treffer', mult: true },
  ];

  let board = 'money';
  let gameBoard = 0;
  let game = '';
  let lastHtml = '';

  // Eigene Kennung für die Rangliste (gleich für Räume und Poker, damit niemand doppelt auftaucht)
  function myId() {
    if (!GK.state.friendId) GK.state.friendId = Array.from({ length: 12 }, () => ID_CHARS[GK.rng.int(ID_CHARS.length)]).join('');
    return GK.state.friendId;
  }

  const num = x => (typeof x === 'number' && isFinite(x) ? x : 0);

  // Eigene Rekorde zum Mitschicken
  function myRecords() {
    const s = GK.state;
    const c = s.casino;
    const games = {};
    let mult = 0;
    Object.keys(c.stats || {}).forEach(id => {
      const st = c.stats[id];
      if (!st || !st.rounds) return;
      games[id] = [num(st.biggestWin), num(st.biggestLoss), num(st.bestMult)];
      mult = Math.max(mult, num(st.bestMult));
    });
    return {
      id: myId(),
      name: GK.player.name(),
      avatar: GK.player.avatar(),
      badge: GK.cosmetics.myBadge(),
      t: Date.now(),
      money: Math.floor(num(s.money)),
      earned: Math.floor(num(s.allTimeEarned)),
      net: Math.floor(num(c.won) - num(c.wagered)),
      win: num(c.biggestWin),
      loss: num(c.biggestLoss),
      mult,
      wins: num(s.friendWins),
      ach: s.achievements.length,
      games,
    };
  }

  // Empfangene Rekorde prüfen: nur bekannte Felder, nur endliche Zahlen, Namen bereinigt
  function clean(r) {
    if (!r || typeof r !== 'object' || typeof r.id !== 'string' || !/^[A-Z0-9]{6,16}$/.test(r.id)) return null;
    const out = {
      id: r.id,
      name: GK.player.cleanName(r.name),
      avatar: GK.player.AVATARS.includes(r.avatar) ? r.avatar : GK.player.AVATARS[0],
      badge: GK.cosmetics.validBadge(r.badge),
      t: Math.min(Date.now(), num(r.t)) || Date.now(),
      games: {},
    };
    BOARDS.forEach(b => { out[b.id] = num(r[b.id]); });
    if (r.games && typeof r.games === 'object') {
      Object.keys(r.games).slice(0, MAX_GAMES).forEach(id => {
        const g = r.games[id];
        if (/^[a-z0-9-]{1,24}$/.test(id) && Array.isArray(g)) out.games[id] = [0, 1, 2].map(i => Math.max(0, num(g[i])));
      });
    }
    return out;
  }

  // Rekorde eines Freundes merken (neuere ersetzen ältere)
  function remember(records) {
    const r = clean(records);
    if (!r || r.id === myId()) return false;
    const all = GK.state.friends;
    const old = all[r.id];
    if (old && old.t > r.t) return false;
    all[r.id] = Object.assign(r, { seen: Date.now() });
    // Nicht unbegrenzt sammeln: die am längsten nicht gesehenen fallen heraus
    const ids = Object.keys(all);
    if (ids.length > MAX_FRIENDS) {
      ids.sort((a, b) => all[a].seen - all[b].seen).slice(0, ids.length - MAX_FRIENDS).forEach(id => delete all[id]);
    }
    lastHtml = '';
    return true;
  }

  // Alle Mitglieder eines Raums merken (Mitspieler-Ansicht)
  function learnFrom(members) {
    if (!Array.isArray(members)) return;
    let changed = false;
    members.forEach(m => { if (m && m.records && remember(m.records)) changed = true; });
    if (changed) GK.save();
  }

  // Mitglieder für eine Nachricht an die Mitspieler: Rekorde nur, wenn share (Warteraum und Spielende),
  // die eigenen immer frisch
  function membersOut(members, share, myPlayerId, online) {
    return members.map(m => {
      const out = Object.assign({}, m, { online: online(m) });
      delete out.records;
      if (share) {
        if (m.playerId === myPlayerId) out.records = myRecords();
        else if (m.records) out.records = m.records;
      }
      return out;
    });
  }

  function forget(id) {
    const f = GK.state.friends[id];
    if (!f || !confirm(`${f.name} aus der Freundes-Rangliste entfernen? Spielt ihr wieder zusammen, taucht er oder sie wieder auf.`)) return;
    delete GK.state.friends[id];
    GK.save();
    render(true);
  }

  // ---------- Darstellung (Statistik-Tab) ----------

  function value(r, b) {
    if (game) return r.games[game] ? r.games[game][b.id] : null;
    return r[b.id];
  }

  function formatValue(v, b) {
    if (v == null) return '–';
    if (b.mult) return v > 0 ? `×${v >= 100 ? GK.formatNumber(Math.floor(v)) : new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(v)}` : '–';
    if (b.money) return `${b.signed && v > 0 ? '+' : b.signed && v < 0 ? '−' : ''}${GK.formatMoneyHTML(Math.abs(v))}`;
    return GK.formatNumber(v);
  }

  function gameIds() {
    const ids = new Set(Object.keys(myRecords().games));
    Object.values(GK.state.friends).forEach(f => Object.keys(f.games).forEach(id => ids.add(id)));
    return [...ids].sort((a, b) => GK.casino.gameName(a).localeCompare(GK.casino.gameName(b), 'de'));
  }

  // Auswahl (Spiel und Rangliste) – wird nur neu gebaut, wenn sich die Auswahl oder die Spiele ändern
  function controlsHtml() {
    const boards = game ? GAME_BOARDS : BOARDS;
    const current = game ? gameBoard : board;
    const ids = gameIds();
    return `
      <select class="bet-input fb-game" aria-label="Spiel">
        <option value="">🌍 Gesamt</option>
        ${ids.map(id => `<option value="${id}" ${id === game ? 'selected' : ''}>${GK.casino.gameName(id)}</option>`).join('')}
      </select>
      <div class="fb-boards" role="group" aria-label="Rangliste">
        ${boards.map(x => `<button type="button" class="btn btn-small fb-board ${x.id === current ? 'active' : ''}" data-board="${x.id}">${x.icon} ${x.name}</button>`).join('')}
      </div>`;
  }

  // „Stand vor …“ auf Minuten gerundet, damit sich die Liste nicht jede Sekunde ändert
  function ago(t) {
    const minutes = Math.floor((Date.now() - t) / 60000);
    return minutes < 1 ? 'gerade eben' : `vor ${GK.formatDuration(minutes * 60)}`;
  }

  function listHtml() {
    const boards = game ? GAME_BOARDS : BOARDS;
    const b = boards.find(x => x.id === (game ? gameBoard : board)) || boards[0];
    const me = Object.assign(myRecords(), { me: true });
    const rows = Object.values(GK.state.friends).concat(me)
      .map(r => ({ r, v: value(r, b) }))
      .sort((x, y) => (y.v == null ? -Infinity : y.v) - (x.v == null ? -Infinity : x.v));
    let place = 0;
    let lastV;
    return rows.map(({ r, v }, i) => {
      if (v !== lastV) place = i + 1;
      lastV = v;
      const medal = v != null && place <= 3 ? ['🥇', '🥈', '🥉'][place - 1] : `${place}.`;
      return `<li class="${r.me ? 'me' : ''}">
        <span class="fb-place">${medal}</span>
        <span class="fb-name">${GK.cosmetics.nameTag(r)}${r.me ? ' <span class="mp-tag">Du</span>' : ''}
          ${r.me ? '' : `<span class="muted small fb-seen">Stand: ${ago(r.t)}</span>`}</span>
        <span class="fb-value">${formatValue(v, b)}</span>
        ${r.me ? '<span class="fb-remove"></span>' : `<button type="button" class="fb-remove" data-id="${r.id}" aria-label="Entfernen" title="Aus der Rangliste entfernen">✕</button>`}
      </li>`;
    }).join('');
  }

  let lastList = '';
  let lastListAt = 0;

  function render(force) {
    const el = document.getElementById('friends-board');
    if (!el) return;
    const empty = !Object.keys(GK.state.friends).length;
    if (empty) {
      const html = `<p class="muted">Noch keine Freunde in der Rangliste. Spielt zusammen in einem Raum (<b>Spiele mit Freunden</b>
        oder <b>Poker mit Freunden</b>) – dann tauschen eure Spiele die Rekorde automatisch aus.</p>`;
      if (lastHtml !== html) {
        el.innerHTML = html;
        lastHtml = html;
        lastList = '';
      }
      return;
    }
    if (game && !gameIds().includes(game)) game = '';
    if (!el.querySelector('.fb-list')) {
      el.innerHTML = `<div class="fb-controls"></div><ol class="fb-list"></ol>
        <p class="muted small">Die Werte deiner Freunde stammen vom letzten gemeinsamen Spiel. Jeder sieht nur die Freunde,
        mit denen er selbst zusammen gespielt hat.</p>`;
      lastHtml = '';
      lastList = '';
    }
    if (!el._fbBound) {
      el._fbBound = true;
      // Ein Klick-Empfänger für alles – überlebt das Neuzeichnen der Liste
      el.addEventListener('click', e => {
        const remove = e.target.closest('button.fb-remove');
        const pick = e.target.closest('.fb-board');
        if (remove) forget(remove.dataset.id);
        else if (pick) {
          if (game) gameBoard = Number(pick.dataset.board);
          else board = pick.dataset.board;
          GK.sound.play('chip');
          render(true);
        }
      });
      el.addEventListener('change', e => {
        if (!e.target.classList.contains('fb-game')) return;
        game = e.target.value;
        GK.sound.play('chip');
        render(true);
      });
    }
    const controls = controlsHtml();
    if (controls !== lastHtml) {
      lastHtml = controls;
      el.querySelector('.fb-controls').innerHTML = controls;
      force = true;
    }
    // Die Liste höchstens alle 3 Sekunden neu zeichnen (das eigene Guthaben ändert sich ständig)
    const now = Date.now();
    if (!force && now - lastListAt < 3000) return;
    const list = listHtml();
    if (list !== lastList) {
      lastList = list;
      lastListAt = now;
      el.querySelector('.fb-list').innerHTML = list;
    }
  }

  GK.friends = { BOARDS, myId, myRecords, clean, remember, learnFrom, membersOut, render };
})();
