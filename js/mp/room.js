// Allgemeine Spielräume für Spiele mit Freunden (Lügenwürfel, Minigolf, Billard …).
//
// So funktioniert es (wie beim Poker mit Freunden):
// - Ein Spieler eröffnet einen Raum und wird Gastgeber. Er legt den Eintritt fest und bekommt einen Code.
// - Freunde treten mit dem Code bei und bestätigen den Eintritt. Die Browser verbinden sich direkt
//   (WebRTC über PeerJS). Der Gastgeber führt das Spiel aus und schickt jedem nur, was er sehen darf.
// - Das Preisgeld (alle Eintritte) wird nach Platzierung verteilt.
// - „Gegen Computer“ nutzt denselben Ablauf, nur ohne Netzwerk („solo“).
//
// Ein Spiel meldet sich mit GK.room.registerGame(def) an. def enthält die Spielregeln:
//   id, name, icon, desc, minPlayers, maxPlayers, settings: { defaults, html(s), read(el) },
//   create(seats, settings) → Zustand mit players[{ id, name, avatar, isBot }]
//   actor(z) → Platz, der dran ist (-1 = niemand) · act(z, platz, aktion) → true, wenn gültig
//   botAct(z, platz) → Aktion · timeout(z, platz) → Aktion, wenn die Bedenkzeit abläuft
//   autoDelay(z) → ms bis zum nächsten automatischen Schritt (oder null) · advance(z)
//   forfeit(z, platz) · placeOf(z, platz) → Platz (1 = Sieger) oder null · finished(z)
//   view(z, platz) → was dieser Spieler sehen darf · draw(container, view, ui) · turnTime(z)
//   optional: canAct(z, platz) → darf dieser Platz gerade handeln (statt nur actor) ·
//   phaseDeadline(z) → gemeinsame Zeitgrenze (Zeitstempel), solange niemand Bestimmtes dran ist
window.GK = window.GK || {};

(function () {
  const PROTOCOL = 1;
  const ID_PREFIX = 'gamble-klicker-';
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const CODE_LENGTH = 5;
  const OFFLINE_TURN_TIME = 5000;
  const RETRY_DELAY = 3000;
  const CONNECT_TIMEOUT = 10000;
  const ABANDON_AFTER = 30000;
  const DROP_AFTER = 90000;        // so lange ohne Verbindung im laufenden Spiel → scheidet aus
  const HEARTBEAT = 2000;
  const HEARTBEAT_TIMEOUT = 8000;
  const MAX_NAME = 16;
  const MIN_ENTRY = 100;
  const ENTRY_PRESETS = [1000, 10000, 100000, 1e6, 1e7];
  const AVATARS = ['😎', '🤠', '🧐', '😺', '🐸', '🦊', '🐼', '🐯', '🦄', '🐙', '🦈', '🐵'];
  // Computer-Gegner (skill: 0 = vorsichtig/schwach … 1 = stark)
  const BOTS = [
    { name: "Käpt'n Blaubart", avatar: '🏴‍☠️', skill: 0.8 },
    { name: 'Einäugige Jenny', avatar: '🦜', skill: 0.6 },
    { name: 'Long John', avatar: '🦿', skill: 0.7 },
    { name: 'Smutje Karl', avatar: '🍲', skill: 0.35 },
    { name: 'Die Holländerin', avatar: '⚓', skill: 0.75 },
    { name: 'Rum-Rudi', avatar: '🍺', skill: 0.25 },
    { name: 'Kraken-Kurt', avatar: '🐙', skill: 0.5 },
    { name: 'Möwen-Mia', avatar: '🕊️', skill: 0.45 },
  ];

  const games = {};
  const containers = {};   // Spiel-ID → Bereich im Casino, in dem gezeichnet wird
  const net = { peer: null, conns: new Map(), hostConn: null, status: 'idle', lostSince: null, retryTimer: null, connectTimer: null, serverTimer: null, pendingConn: null };
  const offlineSince = new Map(); // Gastgeber: playerId → seit wann ohne Verbindung (nur im laufenden Spiel)
  let hostTimer = null;
  let pending = { game: null, code: '' };

  const esc = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- Gespeicherte Daten ----------

  function randomId() {
    return Array.from({ length: 16 }, () => CODE_CHARS[GK.rng.int(CODE_CHARS.length)]).join('');
  }

  function store() {
    return GK.casino.data('room', () => {
      // Gleicher Name und gleiches Bild wie beim Poker mit Freunden
      const poker = GK.state.casino.games.pokerMp;
      return {
        name: poker ? poker.name : 'Spieler ' + (100 + GK.rng.int(900)),
        avatar: poker ? poker.avatar : AVATARS[GK.rng.int(AVATARS.length)],
        playerId: randomId(),
        lastEntry: 1000,
        settings: {},
        soloBots: {},
        session: null,
        results: {},
      };
    });
  }

  function session() {
    return store().session;
  }

  function active(gameId) {
    const s = session();
    return !!s && (!gameId || s.game === gameId);
  }

  function def() {
    return session() && games[session().game];
  }

  function newCode() {
    return Array.from({ length: CODE_LENGTH }, () => CODE_CHARS[GK.rng.int(CODE_CHARS.length)]).join('');
  }

  function cleanName(name) {
    return String(name || '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME) || 'Gast';
  }

  function peerAvailable() {
    return typeof window.Peer === 'function';
  }

  function peerOptions() {
    return Object.assign({ debug: 0 }, window.GK_PEER_OPTIONS || {});
  }

  function inviteLink(s) {
    return `${location.origin}${location.pathname}?raum=${s.code}&spiel=${s.game}`;
  }

  // Anteil am Preisgeld je Platz (wie beim Poker) – mit Freunden teilen sich alle Eintritte
  function prizeShares(players) {
    if (players >= 6) return [0.5, 0.3, 0.2];
    if (players >= 4) return [0.65, 0.35];
    if (players === 3) return [0.7, 0.3];
    return [1];
  }

  // Gegen Computer zahlen die Computer-Gegner keinen echten Eintritt, das Casino zahlt die Preise.
  // Nur der Sieger macht Gewinn, Platz 2 bekommt ab 3 Spielern den halben Einsatz zurück. Bei gleich
  // starken Gegnern fließen so im Schnitt 95 % zurück – wie bei den anderen Casino-Spielen.
  const SOLO_RETURN = 0.95;
  function soloMultipliers(players) {
    const round = x => Math.round(x * 100) / 100; // 2,35 statt 2,3499999…
    return players <= 2 ? [round(2 * SOLO_RETURN)] : [round(SOLO_RETURN * players - 0.5), 0.5];
  }

  // players = alle Plätze am Tisch, paying = wer echten Eintritt bezahlt hat (ohne Computer-Gegner)
  function prize(place, entry, players, solo, paying = players) {
    if (solo) {
      const mult = soloMultipliers(players);
      return place >= 1 && place <= mult.length ? Math.floor(entry * mult[place - 1]) : 0;
    }
    const shares = prizeShares(players);
    return place >= 1 && place <= shares.length ? Math.floor(entry * paying * shares[place - 1]) : 0;
  }

  const humans = players => players.filter(p => !p.isBot).length;

  // Auszahlung für einen Platz. Gegen Computer: Casino-Tabelle. Mit Freunden: Das Preisgeld sind nur die
  // echten Eintritte, verteilt nach Platz – Computer-Gegner zahlen nichts, können aber Preise gewinnen
  // (die behält dann das Casino).
  function payoutFor(s, view, seat, place) {
    if (s.solo) return prize(place, s.entry, view.players.length, true);
    return prize(place, s.entry, view.players.length, false, humans(view.players));
  }

  function prizeText(entry, players, solo, paying = players) {
    const places = solo ? soloMultipliers(players).length : prizeShares(players).length;
    return Array.from({ length: places }, (_, i) => `${['🥇', '🥈', '🥉'][i]} ${GK.formatMoneyHTML(prize(i + 1, entry, players, solo, paying))}`).join(' ');
  }

  // Läuft gerade woanders ein Spiel, das diesen Raum ausschließt?
  function busyElsewhere() {
    if (GK.poker && GK.poker.singleActive && GK.poker.singleActive()) return 'Beende zuerst dein Poker-Turnier.';
    if (GK.poker && GK.poker.mp && GK.poker.mp.active()) return 'Verlasse zuerst deinen Poker-Raum.';
    if (session()) return `Du bist schon in einem Raum (${games[session().game] ? games[session().game].name : ''}).`;
    return '';
  }

  // ---------- Dublonen ----------

  function settle(place, view, seat) {
    const s = session();
    if (!s || s.settled || !s.paid) return;
    const d = def();
    const players = view.players.length;
    const win = payoutFor(s, view, seat, place);
    s.settled = true;
    s.result = { place, prize: win, players };
    GK.casino.payout(win);
    if (!s.solo) GK.unlockAchievement('roomPlay');
    if (d.onSettle) d.onSettle(place, s);
    GK.casino.record(s.game, s.entry, win, `${place}. Platz · ${s.solo ? 'gegen Computer' : 'mit Freunden'}`);
    setTimeout(() => GK.fx.celebrate(win, s.entry, { level: place === 1 ? 'mega' : undefined, subtitle: `${place}. Platz – ${d.name}` }), 600);
  }

  function refundEntry() {
    const s = session();
    if (!s || s.settled || !s.paid) return false;
    s.settled = true;
    s.result = { refunded: true };
    GK.casino.refund(s.entry);
    return true;
  }

  function endSession(message, refund) {
    const s = session();
    if (!s) return;
    if (refund && refundEntry()) message += ' Dein Eintritt wurde erstattet.';
    store().results[s.game] = { message, result: s.result || null };
    store().session = null;
    clearTimeout(hostTimer);
    destroyPeer();
    GK.save();
    redraw(s.game);
  }

  // ---------- Verbindung ----------

  function destroyPeer() {
    clearTimeout(net.retryTimer);
    clearTimeout(net.connectTimer);
    clearTimeout(net.serverTimer);
    net.conns.forEach(c => c.close());
    net.conns.clear();
    if (net.hostConn) net.hostConn.close();
    net.hostConn = null;
    if (net.pendingConn) net.pendingConn.close();
    net.pendingConn = null;
    // Erst abmelden, dann zerstören: PeerJS meldet beim Zerstören noch „disconnected“
    const peer = net.peer;
    net.peer = null;
    if (peer) peer.destroy();
    net.status = 'idle';
    net.lostSince = null;
  }

  function retry(fn) {
    clearTimeout(net.retryTimer);
    net.retryTimer = setTimeout(() => { if (active()) fn(); }, RETRY_DELAY);
  }

  // Nur die Verbindung zum Vermittlungsserver ist weg: die direkten Verbindungen zwischen den Browsern
  // laufen weiter. Mit derselben ID neu anmelden – so lange, bis es klappt.
  function reconnectServer(peer) {
    clearTimeout(net.serverTimer);
    net.serverTimer = setTimeout(() => {
      if (net.peer === peer && !peer.destroyed && peer.disconnected) peer.reconnect();
    }, RETRY_DELAY);
  }

  // PeerJS meldet einen Fehler, bevor es den Peer zerstört bzw. vom Server trennt – deshalb erst
  // einen Takt später entscheiden. Fehler einzelner Verbindungen (z. B. WebRTC) betreffen nicht den
  // ganzen Raum: die Verbindung meldet sich dann selbst mit „close“, der Herzschlag erkennt den Rest.
  function afterPeerError(peer, whenDestroyed) {
    setTimeout(() => {
      if (net.peer !== peer || !active()) return;
      if (peer.destroyed) whenDestroyed();
      else if (peer.disconnected) reconnectServer(peer);
    }, 0);
  }

  function send(conn, msg) {
    if (conn && conn.open) {
      try {
        conn.send(msg);
      } catch (e) {
        console.warn('Senden fehlgeschlagen:', e);
      }
    }
  }

  // ========== Gastgeber ==========

  function createRoom(gameId, entry, settings, solo, bots) {
    entry = Math.floor(Number(entry) || 0);
    const d = games[gameId];
    if (entry < MIN_ENTRY) return GK.toast(`Der Eintritt muss mindestens ${GK.formatNumber(MIN_ENTRY)} Dublonen betragen.`);
    const busy = busyElsewhere();
    if (busy) return GK.toast(busy);
    if (solo && entry > GK.casino.maxBet()) return GK.toast(`Dein Limit sind ${GK.formatNumber(GK.casino.maxBet())} Dublonen – eine bessere VIP-Karte erhöht es.`);
    if (!GK.casino.bet(entry)) return GK.toast('Nicht genug Dublonen für den Eintritt.');
    const me = store();
    me.lastEntry = entry;
    me.settings[gameId] = settings;
    me.session = {
      game: gameId,
      role: 'host',
      solo: !!solo,
      code: solo ? '' : newCode(),
      fresh: true,
      entry,
      settings,
      phase: 'lobby',
      paid: true,
      settled: false,
      members: [{ playerId: me.playerId, name: me.name, avatar: me.avatar, ready: true }],
      fillBots: !!d.bots,
      state: null,
      deadline: null,
      turnKey: null,
    };
    me.results[gameId] = null;
    GK.save();
    if (solo) {
      startGame(bots);
    } else {
      if (GK.track) GK.track('online-' + gameId, 'Online: ' + d.name);
      connectHost();
      redraw(gameId);
    }
  }

  function connectHost() {
    destroyPeer();
    const s = session();
    net.status = 'connecting';
    const peer = new window.Peer(ID_PREFIX + s.game + '-' + s.code, peerOptions());
    net.peer = peer;
    peer.on('open', () => {
      session().fresh = false;
      net.status = 'online';
      GK.save();
      redraw();
    });
    peer.on('connection', setupHostConn);
    peer.on('disconnected', () => {
      if (net.peer === peer) {
        reconnectServer(peer);
        redraw();
      }
    });
    peer.on('error', err => {
      if (net.peer !== peer) return;
      const s2 = session();
      if (!s2) return;
      if (err.type === 'unavailable-id' && s2.fresh) {
        s2.code = newCode();
        connectHost();
        return;
      }
      // Raum ganz weg (z. B. hält der Server den Code nach dem Neuladen noch kurz fest) → neu aufbauen
      afterPeerError(peer, () => {
        net.status = 'lost';
        redraw();
        retry(connectHost);
      });
    });
  }

  function setupHostConn(conn) {
    conn.lastSeen = Date.now();
    conn.on('data', msg => {
      conn.lastSeen = Date.now();
      onHostMessage(conn, msg);
    });
    const closed = () => onHostConnClosed(conn);
    conn.on('close', closed);
    conn.on('error', closed);
  }

  function member(playerId) {
    return session().members.find(m => m.playerId === playerId);
  }

  function onHostConnClosed(conn) {
    const s = session();
    if (!s || s.role !== 'host' || !conn.playerId) return;
    if (net.conns.get(conn.playerId) !== conn) return;
    net.conns.delete(conn.playerId);
    if (s.phase === 'lobby') s.members = s.members.filter(m => m.playerId !== conn.playerId);
    afterHostChange();
  }

  function onHostMessage(conn, msg) {
    const s = session();
    if (!s || s.role !== 'host' || !msg || typeof msg !== 'object') return;
    if (msg.type === 'hello') {
      if (msg.v !== PROTOCOL || msg.game !== s.game) {
        send(conn, { type: 'error', fatal: true, message: msg.game !== s.game ? 'Dieser Raum spielt ein anderes Spiel.' : 'Ihr habt verschiedene Spielversionen. Bitte ladet beide die Seite neu.' });
        return;
      }
      const playerId = String(msg.playerId || '').slice(0, 32);
      if (!playerId || playerId === store().playerId) return;
      let m = member(playerId);
      if (!m) {
        if (s.phase !== 'lobby') {
          send(conn, { type: 'error', fatal: true, message: 'In diesem Raum läuft das Spiel schon.' });
          return;
        }
        if (s.members.length >= games[s.game].maxPlayers) {
          send(conn, { type: 'error', fatal: true, message: 'Der Raum ist schon voll.' });
          return;
        }
        m = { playerId, name: cleanName(msg.name), avatar: AVATARS.includes(msg.avatar) ? msg.avatar : AVATARS[0], ready: false };
        s.members.push(m);
      }
      if (msg.paid) m.ready = true;
      const old = net.conns.get(playerId);
      conn.playerId = playerId;
      net.conns.set(playerId, conn);
      if (old && old !== conn) old.close();
      afterHostChange();
      return;
    }
    if (!conn.playerId || msg.type === 'ping') return;
    if (msg.type === 'join' && s.phase === 'lobby') {
      const m = member(conn.playerId);
      if (m) m.ready = true;
      afterHostChange();
    } else if (msg.type === 'action' && s.phase === 'playing') {
      playerAction(seatOf(s.state, conn.playerId), msg.action);
    } else if (msg.type === 'leave') {
      playerLeft(conn.playerId);
      setTimeout(() => conn.close(), 500);
    }
  }

  function seatOf(state, playerId) {
    return state ? state.players.findIndex(p => p.id === playerId) : -1;
  }

  function playerAction(seat, action) {
    const s = session();
    const d = def();
    if (!s.state || seat < 0 || !action || typeof action !== 'object') return;
    // Spiele, in denen mehrere gleichzeitig handeln (z. B. Flotte aufstellen), sagen das über canAct
    if (!(d.canAct ? d.canAct(s.state, seat) : d.actor(s.state) === seat)) return;
    if (d.act(s.state, seat, action)) {
      s.state.step = (s.state.step || 0) + 1;
      afterHostChange();
    }
  }

  function playerLeft(playerId) {
    const s = session();
    if (s.phase === 'lobby') {
      s.members = s.members.filter(m => m.playerId !== playerId);
    } else if (s.phase === 'playing') {
      const seat = seatOf(s.state, playerId);
      if (seat >= 0) {
        def().forfeit(s.state, seat);
        s.state.step = (s.state.step || 0) + 1;
      }
    }
    net.conns.delete(playerId);
    afterHostChange();
  }

  function botSeats(count) {
    return GK.rng.shuffle(BOTS.slice()).slice(0, count).map((b, i) => ({ id: 'bot' + i, name: b.name, avatar: b.avatar, isBot: true, skill: b.skill }));
  }

  function startGame(botCount) {
    const s = session();
    const d = def();
    if (s.role !== 'host' || s.phase !== 'lobby') return;
    const ready = s.members.filter(m => m.ready);
    if (!s.solo && ready.length < 2) return;
    s.members.filter(m => !m.ready).forEach(m => {
      const conn = net.conns.get(m.playerId);
      send(conn, { type: 'error', fatal: true, message: 'Das Spiel wurde ohne dich gestartet, weil du den Eintritt noch nicht bezahlt hattest.' });
      net.conns.delete(m.playerId);
      if (conn) setTimeout(() => conn.close(), 500);
    });
    s.members = ready;
    let seats = ready.map(m => ({ id: m.playerId, name: m.name, avatar: m.avatar, isBot: false }));
    const bots = s.solo ? botCount : (s.fillBots ? d.maxPlayers - seats.length : 0);
    seats = seats.concat(botSeats(Math.max(0, Math.min(bots, d.maxPlayers - seats.length))));
    s.state = d.create(seats, s.settings || d.settings.defaults);
    s.state.step = 0;
    s.phase = 'playing';
    afterHostChange();
  }

  function hostTimeout() {
    const s = session();
    const d = def();
    if (!s || !s.state) return;
    const seat = d.actor(s.state);
    if (seat < 0 || s.state.players[seat].isBot) return;
    playerAction(seat, d.timeout(s.state, seat));
  }

  function botStep() {
    const s = session();
    const d = def();
    if (!s || !s.state) return;
    const seat = d.actor(s.state);
    if (seat < 0 || !s.state.players[seat].isBot) return;
    playerAction(seat, d.botAct(s.state, seat));
  }

  function autoStep() {
    const s = session();
    if (!s || !s.state) return;
    def().advance(s.state);
    s.state.step = (s.state.step || 0) + 1;
    afterHostChange();
  }

  // Nach jeder Änderung beim Gastgeber: Bedenkzeit, eigene Abrechnung, speichern, an alle senden
  function afterHostChange() {
    const s = session();
    if (!s || s.role !== 'host') return;
    const d = def();
    const st = s.state;
    if (st) {
      const actor = d.actor(st);
      const key = `${st.step}:${actor}`;
      if (key !== s.turnKey) {
        s.turnKey = key;
        const human = actor >= 0 && !st.players[actor].isBot;
        const offline = human && !s.solo && st.players[actor].id !== store().playerId && !net.conns.has(st.players[actor].id);
        s.deadline = human && !s.solo ? Date.now() + (offline ? OFFLINE_TURN_TIME : d.turnTime(st)) : null;
        // Gemeinsame Zeitgrenze, wenn niemand Bestimmtes am Zug ist (z. B. alle stellen ihre Flotte auf)
        if (actor < 0 && d.phaseDeadline && !s.solo) s.deadline = d.phaseDeadline(st) || null;
      }
      const meSeat = seatOf(st, store().playerId);
      const place = d.placeOf(st, meSeat);
      if (place) settle(place, st, meSeat);
      if (d.finished(st)) s.phase = 'ended';
    }
    GK.save();
    broadcast();
    redraw();
    scheduleHost();
  }

  function isVisible() {
    const c = session() && containers[session().game];
    return !!c && c.offsetParent !== null;
  }

  function scheduleHost() {
    clearTimeout(hostTimer);
    const s = session();
    if (!s || s.role !== 'host' || s.phase !== 'playing') return;
    // Gegen Computer pausiert das Spiel, solange man nicht hinschaut
    if (s.solo && !isVisible()) return;
    const d = def();
    const st = s.state;
    const delay = d.autoDelay(st, s.solo);
    if (delay != null) {
      hostTimer = setTimeout(autoStep, delay);
      return;
    }
    const actor = d.actor(st);
    if (actor < 0) return;
    if (st.players[actor].isBot) hostTimer = setTimeout(botStep, d.botDelay ? d.botDelay(st, s.solo) : 1200);
    else if (s.deadline) hostTimer = setTimeout(hostTimeout, Math.max(0, s.deadline - Date.now()));
  }

  function stateMessage(playerId) {
    const s = session();
    const msg = {
      type: 'state', v: PROTOCOL, game: s.game, code: s.code, entry: s.entry, settings: s.settings, phase: s.phase,
      hostId: store().playerId, fillBots: s.fillBots,
      members: s.members.map(m => ({ ...m, online: m.playerId === store().playerId || net.conns.has(m.playerId) })),
    };
    if (s.state) {
      const seat = seatOf(s.state, playerId);
      msg.view = def().view(s.state, seat);
      msg.mySeat = seat;
      msg.turnLeft = s.deadline ? Math.max(0, s.deadline - Date.now()) : null;
    }
    return msg;
  }

  function broadcast() {
    net.conns.forEach((conn, playerId) => send(conn, stateMessage(playerId)));
  }

  function hostLeave() {
    const s = session();
    const st = s.state;
    const meSeat = seatOf(st, store().playerId);
    const d = def();
    let text = '';
    if (s.solo) {
      if (s.phase === 'playing' && !d.placeOf(st, meSeat)) {
        const place = st.players.length - st.players.filter((p, i) => d.placeOf(st, i)).length;
        const win = prize(place, s.entry, st.players.length, true);
        text = `Spiel wirklich verlassen? Du belegst damit Platz ${place}${win ? ` und bekommst ${GK.formatNumber(win)} Dublonen.` : ' und gehst leer aus.'}`;
      }
    } else if (s.phase === 'lobby') {
      text = 'Raum schließen? Alle bekommen ihren Eintritt zurück.';
    } else if (s.phase === 'playing') {
      text = 'Wenn du gehst, endet das Spiel für alle. Deine Mitspieler bekommen ihren Eintritt zurück.';
    }
    if (text && !confirm(text)) return;
    if (!s.solo) net.conns.forEach(conn => send(conn, { type: 'closed', reason: 'Der Gastgeber hat den Raum geschlossen.' }));
    if (s.phase === 'playing' && meSeat >= 0 && !d.placeOf(st, meSeat)) {
      d.forfeit(st, meSeat);
      settle(d.placeOf(st, meSeat) || st.players.length, st, meSeat);
    }
    const message = s.phase === 'lobby' ? 'Du hast den Raum geschlossen.' : s.phase === 'ended' ? 'Spiel beendet.' : 'Du hast das Spiel verlassen.';
    setTimeout(() => endSession(message, s.phase === 'lobby'), s.solo ? 0 : 300);
  }

  // ========== Mitspieler ==========

  function joinRoom(gameId, code) {
    code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== CODE_LENGTH) return GK.toast(`Der Raum-Code hat ${CODE_LENGTH} Zeichen.`);
    const busy = busyElsewhere();
    if (busy) return GK.toast(busy);
    store().session = {
      game: gameId, role: 'client', code, phase: 'connecting', joined: false, paid: false, settled: false,
      entry: null, settings: null, members: [], hostId: null, fillBots: false, view: null, mySeat: -1, deadline: null, result: null,
    };
    store().results[gameId] = null;
    GK.save();
    if (GK.track) GK.track('online-' + gameId, 'Online: ' + games[gameId].name);
    connectClient();
    redraw(gameId);
  }

  function connectClient() {
    destroyPeer();
    net.status = 'connecting';
    const peer = new window.Peer(peerOptions());
    net.peer = peer;
    // Nach einem Neuverbinden mit dem Server steht die Verbindung zum Gastgeber meist noch
    peer.on('open', () => { if (!net.hostConn || !net.hostConn.open) openHostConn(); });
    peer.on('disconnected', () => { if (net.peer === peer) reconnectServer(peer); });
    peer.on('error', err => {
      if (net.peer !== peer) return;
      const s = session();
      if (err.type === 'peer-unavailable' && s && !s.joined) {
        endSession(`Raum ${s.code} nicht gefunden. Stimmt der Code?`, true);
        return;
      }
      if (err.type === 'peer-unavailable') {
        hostLost(); // Gastgeber gerade nicht erreichbar → regelmäßig neu versuchen
        return;
      }
      afterPeerError(peer, hostLost);
    });
  }

  function openHostConn() {
    const s = session();
    if (!s || !net.peer || net.peer.destroyed) return;
    if (net.peer.disconnected) {
      reconnectServer(net.peer); // nach dem Neuverbinden baut der „open“-Handler die Verbindung auf
      return;
    }
    const conn = net.peer.connect(ID_PREFIX + s.game + '-' + s.code, { reliable: true });
    // Nur ein Verbindungsversuch zur Zeit: einen älteren, noch nicht offenen abbrechen
    const older = net.pendingConn;
    net.pendingConn = conn;
    if (older && !older.open) older.close();
    clearTimeout(net.connectTimer);
    net.connectTimer = setTimeout(() => {
      if (!conn.open && net.pendingConn === conn) {
        net.pendingConn = null;
        conn.close();
        hostLost();
      }
    }, CONNECT_TIMEOUT);
    conn.on('open', () => {
      clearTimeout(net.connectTimer);
      if (net.pendingConn === conn) net.pendingConn = null;
      conn.lastSeen = Date.now();
      const previous = net.hostConn;
      net.hostConn = conn;
      if (previous && previous !== conn) previous.close();
      net.status = 'online';
      net.lostSince = null;
      const me = store();
      send(conn, { type: 'hello', v: PROTOCOL, game: s.game, playerId: me.playerId, name: me.name, avatar: me.avatar, paid: session().paid });
      redraw();
    });
    conn.on('data', msg => {
      conn.lastSeen = Date.now();
      onClientMessage(msg);
    });
    // Nur die aktuelle Verbindung (oder der laufende Versuch) zählt – alte, ersetzte nicht
    const lost = () => {
      if (net.hostConn === conn) hostLost();
      else if (net.pendingConn === conn) {
        net.pendingConn = null;
        if (!net.hostConn || !net.hostConn.open) hostLost();
      }
    };
    conn.on('close', lost);
    conn.on('error', lost);
  }

  function hostLost() {
    const s = session();
    net.hostConn = null;
    if (!s || s.role !== 'client' || s.phase === 'ended') return;
    if (net.status !== 'lost') net.lostSince = Date.now();
    net.status = 'lost';
    redraw();
    retry(() => {
      const peer = net.peer;
      if (!peer || peer.destroyed) connectClient();
      else if (peer.disconnected) reconnectServer(peer); // danach verbindet der „open“-Handler
      else openHostConn();
    });
  }

  function onClientMessage(msg) {
    const s = session();
    if (!s || s.role !== 'client' || !msg || typeof msg !== 'object') return;
    if (msg.type === 'ping') return;
    if (msg.type === 'error') {
      if (msg.fatal) endSession(msg.message, true);
      else GK.toast(msg.message);
      return;
    }
    if (msg.type === 'closed') {
      endSession(msg.reason, true);
      return;
    }
    const entry = Math.floor(Number(msg.entry));
    if (msg.type !== 'state' || msg.game !== s.game || !(entry >= MIN_ENTRY)) return;
    if (!s.paid) s.entry = entry;
    s.settings = msg.settings || null;
    s.joined = true;
    s.phase = msg.phase;
    s.members = Array.isArray(msg.members) ? msg.members : [];
    s.hostId = msg.hostId;
    s.fillBots = !!msg.fillBots;
    s.view = msg.view || null;
    s.mySeat = typeof msg.mySeat === 'number' ? msg.mySeat : -1;
    s.deadline = typeof msg.turnLeft === 'number' ? Date.now() + msg.turnLeft : null;
    if (s.view && s.mySeat >= 0) {
      const place = def().placeOf(s.view, s.mySeat);
      if (place) settle(place, s.view, s.mySeat);
    }
    GK.save();
    redraw();
  }

  function clientConfirm() {
    const s = session();
    if (!s || s.paid || !s.entry) return;
    if (!GK.casino.bet(s.entry)) {
      GK.sound.play('denied');
      GK.toast('Nicht genug Dublonen für den Eintritt.');
      return;
    }
    s.paid = true;
    GK.sound.play('chip');
    GK.save();
    send(net.hostConn, { type: 'join' });
    redraw();
  }

  function clientLeave() {
    const s = session();
    const d = def();
    const view = s.view;
    if (s.phase === 'connecting' || s.phase === 'lobby') {
      send(net.hostConn, { type: 'leave' });
      endSession('Du hast den Raum verlassen.', true);
      return;
    }
    if (s.phase === 'playing' && view && s.mySeat >= 0 && !d.placeOf(view, s.mySeat) && !s.settled) {
      const hostGone = net.status === 'lost' && Date.now() - net.lostSince >= ABANDON_AFTER;
      if (hostGone) {
        if (!confirm('Der Gastgeber ist nicht mehr erreichbar. Spiel abbrechen? Du bekommst deinen Eintritt zurück.')) return;
        endSession('Spiel abgebrochen.', true);
        return;
      }
      const players = view.players.length;
      const place = players - view.players.filter((p, i) => d.placeOf(view, i)).length;
      const win = payoutFor(s, view, s.mySeat, place);
      if (!confirm(`Spiel wirklich verlassen? Du belegst damit Platz ${place}${win ? ` und bekommst ${GK.formatNumber(win)} Dublonen.` : ' und gehst leer aus.'}`)) return;
      send(net.hostConn, { type: 'leave' });
      settle(place, view, s.mySeat);
    }
    setTimeout(() => endSession('Du hast den Raum verlassen.', false), 300);
  }

  // ========== Gemeinsam ==========

  function heartbeat() {
    const s = session();
    if (!s || s.solo) return;
    const now = Date.now();
    if (s.role === 'host') {
      net.conns.forEach(conn => {
        if (now - conn.lastSeen > HEARTBEAT_TIMEOUT) {
          conn.close();
          onHostConnClosed(conn);
        } else {
          send(conn, { type: 'ping' });
        }
      });
      // War die Seite des Gastgebers eingeschlafen (z. B. iPad gesperrt), zählt die Abwesenheit neu
      if (net.lastBeat && now - net.lastBeat > 10000) offlineSince.clear();
      net.lastBeat = now;
      dropAbsentPlayers(now);
    } else if (net.hostConn) {
      const conn = net.hostConn;
      if (now - conn.lastSeen > HEARTBEAT_TIMEOUT) {
        net.hostConn = null;
        conn.close();
        hostLost();
      } else {
        send(conn, { type: 'ping' });
      }
    }
    if (net.status === 'lost') redraw();
  }
  const heartbeatTimer = setInterval(heartbeat, HEARTBEAT);
  if (heartbeatTimer.unref) heartbeatTimer.unref(); // nur für die Tests in Node

  // Ist der Gastgeber selbst gerade mit dem Netz verbunden? (Vermittlungsserver erreichbar, Browser online)
  function hostOnline() {
    return net.status === 'online' && !!net.peer && !net.peer.destroyed && !net.peer.disconnected && navigator.onLine !== false;
  }

  // Wer im laufenden Spiel zu lange keine Verbindung hat, scheidet aus – sonst warten alle anderen
  // bei jedem seiner Züge auf die Bedenkzeit
  function dropAbsentPlayers(now) {
    const s = session();
    const d = def();
    // Ist der Gastgeber selbst offline, liegt es an ihm – dann scheidet niemand aus
    if (!s || s.role !== 'host' || s.phase !== 'playing' || !s.state || !hostOnline()) {
      offlineSince.clear();
      return;
    }
    const st = s.state;
    let changed = false;
    st.players.forEach((p, seat) => {
      if (p.isBot || p.id === store().playerId || d.placeOf(st, seat) || net.conns.has(p.id)) {
        offlineSince.delete(p.id);
        return;
      }
      if (!offlineSince.has(p.id)) offlineSince.set(p.id, now);
      else if (now - offlineSince.get(p.id) >= DROP_AFTER && !d.finished(st)) {
        d.forfeit(st, seat);
        offlineSince.delete(p.id);
        changed = true;
      }
    });
    if (changed) {
      st.step = (st.step || 0) + 1;
      afterHostChange();
    }
  }

  // Eigene Aktion: beim Gastgeber direkt anwenden, sonst an den Gastgeber schicken.
  // false = konnte nicht übertragen werden (keine Verbindung) – das Spiel kann seine Anzeige zurücksetzen
  function act(action) {
    const s = session();
    if (!s) return false;
    if (s.role === 'host') {
      playerAction(seatOf(s.state, store().playerId), action);
      return true;
    }
    if (!net.hostConn || !net.hostConn.open) {
      GK.toast('Keine Verbindung zum Gastgeber – versuche es gleich noch einmal.');
      return false;
    }
    send(net.hostConn, { type: 'action', action });
    return true;
  }

  function resume() {
    clearTimeout(hostTimer);
    destroyPeer();
    const s = session();
    if (!s) return;
    if (!games[s.game]) {
      store().session = null;
      return;
    }
    if (s.solo) {
      s.turnKey = null;
      afterHostChange();
      return;
    }
    if (!peerAvailable()) {
      net.status = 'lost';
      return;
    }
    if (s.role === 'host') {
      s.turnKey = null;
      connectHost();
      afterHostChange();
    } else {
      connectClient();
    }
  }

  // Einladungs-Link (…?raum=CODE&spiel=ID): Spiel öffnen und den Code eintragen
  function readInviteLink() {
    const params = new URLSearchParams(location.search);
    const game = params.get('spiel');
    const code = (params.get('raum') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!code || !game || !games[game]) return;
    pending = { game, code: code.slice(0, CODE_LENGTH) };
    GK.state.ui.tab = 'casino';
    GK.state.casino.openGame = game;
    params.delete('raum');
    params.delete('spiel');
    const rest = params.toString();
    history.replaceState(null, '', location.pathname + (rest ? '?' + rest : '') + location.hash);
  }

  // ---------- Darstellung ----------

  function redraw(gameId) {
    const id = gameId || (session() && session().game);
    if (id && containers[id]) draw(containers[id], id);
  }

  function statusLine() {
    const s = session();
    if (s.solo) return '';
    if (!peerAvailable()) return '<span class="mp-status lost">🔴 Online-Spiel nicht verfügbar – keine Internetverbindung?</span>';
    if (net.status === 'online') {
      if (s.role === 'host' && net.peer && net.peer.disconnected && !net.peer.destroyed) {
        return '<span class="mp-status connecting">🟡 Verbindung zum Server wird erneuert – wer schon im Raum ist, bleibt verbunden …</span>';
      }
      return s.role === 'host' ? '<span class="mp-status online">🟢 Raum ist online</span>' : '<span class="mp-status online">🟢 Mit dem Gastgeber verbunden</span>';
    }
    if (net.status === 'lost') {
      const ms = net.lostSince ? Date.now() - net.lostSince : 0;
      // Nur wer noch mitspielt (nicht schon ausgeschieden und abgerechnet), bekommt den Eintritt zurück
      const gone = s.role === 'client' && s.phase === 'playing' && !s.settled && ms >= ABANDON_AFTER
        ? ' Du kannst das Spiel auch verlassen – dann bekommst du deinen Eintritt zurück.' : '';
      return `<span class="mp-status lost">🔴 Keine Verbindung${s.role === 'client' ? ` zum Gastgeber (seit ${Math.floor(ms / 1000)} s)` : ''} – versuche es erneut …${gone}</span>`;
    }
    return '<span class="mp-status connecting">🟡 Verbinde …</span>';
  }

  // Hauptfunktion für den Spielbereich: Startseite, Warteraum oder Spiel
  function draw(container, gameId) {
    containers[gameId] = container;
    const s = session();
    if (!s || s.game !== gameId) drawStart(container, gameId);
    else if (s.phase === 'connecting' || s.phase === 'lobby') drawLobby(container);
    else drawGame(container);
  }

  function setHtml(el, html) {
    if (el._html === html) return false;
    el._html = html;
    el.innerHTML = html;
    return true;
  }

  // Startseite eines Spiels: gegen Computer oder mit Freunden
  function drawStart(container, gameId) {
    const d = games[gameId];
    const me = store();
    const settings = Object.assign({}, d.settings.defaults, me.settings[gameId]);
    const r = me.results[gameId];
    let resultHtml = '';
    if (r) {
      const res = r.result;
      const extra = res && !res.refunded ? ` Du hast den <b>${res.place}. Platz</b> belegt${res.prize ? ` und ${GK.formatMoneyHTML(res.prize)} gewonnen!` : '.'}` : '';
      resultHtml = `<div class="poker-result ${res && res.prize ? 'win' : ''}">${esc(r.message)}${extra}</div>`;
    }
    const otherRoom = session() && session().game !== gameId
      ? `<p class="warning">Du bist gerade in einem Raum für ${esc(games[session().game].name)}. <button class="btn btn-small room-goto">Dorthin wechseln</button></p>` : '';
    const soloBots = me.soloBots[gameId] || Math.min(3, d.maxPlayers - 1);
    container.innerHTML = `
      ${resultHtml}
      ${otherRoom}
      <div class="room-intro">${d.intro || ''}</div>
      ${d.settings.html ? `<div class="room-settings">${d.settings.html(settings)}</div>` : ''}
      <h3 class="poker-section-title">🤖 Gegen Computer</h3>
      <div class="room-solo">
        ${d.maxPlayers > 2 ? `
          <div class="bet-label">Gegner</div>
          <div class="room-bots" role="group" aria-label="Anzahl Gegner">
            ${Array.from({ length: d.maxPlayers - 1 }, (_, i) => i + 1).map(n => `<button type="button" class="btn btn-small room-bot-count ${n === soloBots ? 'active' : ''}" data-n="${n}">${n}</button>`).join('')}
          </div>` : ''}
        <div class="room-solo-bet"></div>
        <div class="room-solo-prize small"></div>
        <button class="btn btn-primary btn-big room-solo-start">${d.icon} Spiel starten</button>
      </div>
      <h3 class="poker-section-title">👥 Mit Freunden spielen</h3>
      ${peerAvailable() ? '' : '<p class="warning">Online-Spiele brauchen eine Internetverbindung (PeerJS konnte nicht geladen werden).</p>'}
      <div class="mp-forms">
        <div class="mp-form">
          <label class="bet-label">Dein Name am Tisch</label>
          <div class="bet-row">
            <button type="button" class="btn mp-avatar room-avatar" title="Anderes Bild">${me.avatar}</button>
            <input class="bet-input mp-name room-name" maxlength="${MAX_NAME}" value="${esc(me.name)}">
          </div>
        </div>
        <div class="mp-form">
          <label class="bet-label">Raum eröffnen – Eintritt pro Spieler</label>
          <div class="bet-row">
            <input type="number" class="bet-input mp-entry room-entry" min="${MIN_ENTRY}" step="100" inputmode="numeric" value="${me.lastEntry}">
            <button type="button" class="btn btn-primary room-create">Eröffnen</button>
          </div>
          <div class="bet-row mp-presets">
            ${ENTRY_PRESETS.map(v => `<button type="button" class="btn btn-small room-preset" data-entry="${v}">${GK.formatNumber(v)}</button>`).join('')}
          </div>
        </div>
        <div class="mp-form">
          <label class="bet-label">Raum beitreten</label>
          <div class="bet-row">
            <input class="bet-input mp-code-input room-code" maxlength="${CODE_LENGTH}" placeholder="CODE" value="${pending.game === gameId ? esc(pending.code) : ''}" autocomplete="off">
            <button type="button" class="btn btn-primary room-join">Beitreten</button>
          </div>
        </div>
      </div>`;

    const readSettings = () => (d.settings.read ? d.settings.read(container) : d.settings.defaults);
    const goto = container.querySelector('.room-goto');
    if (goto) goto.addEventListener('click', () => GK.casino.openGame(session().game));
    if (d.settings.bind) d.settings.bind(container, () => {
      me.settings[gameId] = readSettings();
      GK.save();
      updateSoloPrize();
    });
    // Gegen Computer
    let soloEntry = Math.max(MIN_ENTRY, me.lastEntry);
    const betControl = GK.casino.createBetControl(container.querySelector('.room-solo-bet'), {
      label: 'Einsatz (Eintritt)',
      min: MIN_ENTRY,
      get: () => soloEntry,
      set: v => {
        soloEntry = v;
        updateSoloPrize();
      },
    });
    container._betControl = betControl;
    const updateSoloPrize = () => {
      const n = (me.soloBots[gameId] || soloBots) + 1;
      container.querySelector('.room-solo-prize').innerHTML = `Preise bei ${n} Spielern: ${prizeText(soloEntry, n, true)}`;
    };
    updateSoloPrize();
    container.querySelectorAll('.room-bot-count').forEach(btn => btn.addEventListener('click', () => {
      me.soloBots[gameId] = Number(btn.dataset.n);
      container.querySelectorAll('.room-bot-count').forEach(b => b.classList.toggle('active', b === btn));
      GK.sound.play('chip');
      GK.save();
      updateSoloPrize();
    }));
    container.querySelector('.room-solo-start').addEventListener('click', () => {
      createRoom(gameId, soloEntry, readSettings(), true, me.soloBots[gameId] || soloBots);
    });
    // Mit Freunden
    const nameInput = container.querySelector('.room-name');
    const saveName = () => {
      me.name = cleanName(nameInput.value);
      nameInput.value = me.name;
      GK.save();
    };
    nameInput.addEventListener('change', saveName);
    container.querySelector('.room-avatar').addEventListener('click', e => {
      me.avatar = AVATARS[(AVATARS.indexOf(me.avatar) + 1) % AVATARS.length];
      e.currentTarget.textContent = me.avatar;
      GK.save();
    });
    const entryInput = container.querySelector('.room-entry');
    container.querySelectorAll('.room-preset').forEach(btn => btn.addEventListener('click', () => {
      entryInput.value = btn.dataset.entry;
      GK.sound.play('chip');
    }));
    container.querySelector('.room-create').addEventListener('click', () => {
      saveName();
      createRoom(gameId, entryInput.value, readSettings(), false);
    });
    container.querySelector('.room-join').addEventListener('click', () => {
      saveName();
      pending = { game: null, code: '' };
      joinRoom(gameId, container.querySelector('.room-code').value);
    });
    container.querySelector('.room-create').disabled = !peerAvailable();
    container.querySelector('.room-join').disabled = !peerAvailable();
  }

  function drawLobby(container) {
    const s = session();
    const d = def();
    const isHost = s.role === 'host';
    const members = s.members;
    // Preise hängen nur an den echten Spielern – Computer-Gegner zahlen und gewinnen nichts
    // Plätze am Tisch (mit Computer-Gegnern) und echte Spieler, die Eintritt zahlen
    const paying = Math.max(2, members.length);
    const players = isHost || s.phase === 'lobby' ? (d.bots && s.fillBots ? Math.max(d.maxPlayers, paying) : paying) : 0;
    const hostId = isHost ? store().playerId : s.hostId;
    const readyCount = members.filter(m => m.ready).length;
    const mustConfirm = !isHost && !s.paid && s.entry && s.phase === 'lobby';
    container.innerHTML = `
      <div class="mp-room">
        <div class="mp-code-box">
          <div class="muted small">Raum-Code (${esc(d.name)})</div>
          <div class="mp-code">${s.code}</div>
          ${isHost ? `
            <div class="bet-row">
              <button class="btn btn-small room-copy-code">📋 Code kopieren</button>
              <button class="btn btn-small room-copy-link">🔗 Einladungs-Link kopieren</button>
            </div>` : ''}
        </div>
        ${s.entry ? `<p class="mp-tier-info">${d.icon} <b>${esc(d.name)}</b> · Eintritt ${GK.formatMoneyHTML(s.entry)}
          ${d.settingsText && s.settings ? ` · ${d.settingsText(s.settings)}` : ''}<br>Preise: ${players ? prizeText(s.entry, players, false, paying) : ''}</p>` : ''}
        ${s.phase === 'connecting' ? '<p class="muted">Suche den Raum …</p>' : `
          <h3>Spieler (${members.length}/${d.maxPlayers})</h3>
          <ul class="mp-members">
            ${members.map(m => `<li class="${m.ready ? '' : 'not-ready'}">
              <span>${m.avatar} ${esc(m.name)}</span>
              ${m.ready ? '' : '<span class="mp-tag waiting">⏳ zahlt noch</span>'}
              ${m.playerId === hostId ? '<span class="mp-tag">👑 Gastgeber</span>' : ''}
              ${m.playerId === store().playerId ? '<span class="mp-tag">Du</span>' : ''}
            </li>`).join('')}
          </ul>
          ${mustConfirm ? `
            <div class="mp-confirm">
              <p>Der Gastgeber hat den Eintritt auf <b>${GK.formatMoneyHTML(s.entry)}</b> festgelegt.</p>
              <button class="btn btn-primary btn-big room-confirm" ${GK.canAfford(s.entry) ? '' : 'disabled'}>💰 Eintritt bezahlen und mitspielen</button>
              ${GK.canAfford(s.entry) ? '' : '<p class="loss small">Dafür hast du nicht genug Dublonen.</p>'}
            </div>` : ''}
          ${isHost ? `
            ${d.bots ? `<label class="mp-check"><input type="checkbox" class="room-fill" ${s.fillBots ? 'checked' : ''}> Freie Plätze mit Computer-Gegnern auffüllen
              <span class="muted small">(sie zahlen keinen Eintritt – gewinnen sie einen Preis, behält ihn das Casino)</span></label>` : ''}
            <div class="game-actions">
              <button class="btn btn-primary btn-big room-start" ${readyCount < 2 ? 'disabled' : ''}>▶ Spiel starten</button>
            </div>
            <p class="muted small">${readyCount < 2 ? 'Warte auf mindestens einen Mitspieler, der den Eintritt bezahlt hat …'
              : readyCount < members.length ? 'Wer noch nicht bezahlt hat, spielt nicht mit.' : 'Alle da? Dann los!'}
              Als Gastgeber leitest du das Spiel – lass es bitte geöffnet, bis es vorbei ist.</p>`
            : s.paid ? '<p class="muted">Warte, bis der Gastgeber das Spiel startet …</p>' : ''}
        `}
        <p>${statusLine()}</p>
        <button class="btn btn-danger room-leave">${isHost ? 'Raum schließen' : 'Raum verlassen'}</button>
      </div>`;
    container.querySelector('.room-leave').addEventListener('click', () => (isHost ? hostLeave() : clientLeave()));
    const confirmBtn = container.querySelector('.room-confirm');
    if (confirmBtn) confirmBtn.addEventListener('click', clientConfirm);
    if (isHost && s.phase === 'lobby') {
      const fill = container.querySelector('.room-fill');
      if (fill) fill.addEventListener('change', e => {
        s.fillBots = e.target.checked;
        afterHostChange();
      });
      container.querySelector('.room-start').addEventListener('click', () => startGame());
      container.querySelector('.room-copy-code').addEventListener('click', () => copyText(s.code, 'Code kopiert'));
      container.querySelector('.room-copy-link').addEventListener('click', () => copyText(inviteLink(s), 'Einladungs-Link kopiert'));
    }
  }

  function copyText(text, done) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => GK.toast(done + ' ✅'), () => prompt('Zum Kopieren:', text));
    } else {
      prompt('Zum Kopieren:', text);
    }
  }

  // Spiel läuft (oder ist vorbei): Rahmen mit Infos und Verlassen-Knopf, darin zeichnet das Spiel
  function drawGame(container) {
    const s = session();
    const d = def();
    const isHost = s.role === 'host';
    const view = isHost ? (s.state && d.view(s.state, seatOf(s.state, store().playerId))) : s.view;
    if (!view) {
      container.innerHTML = `<p>${statusLine()}</p>`;
      return;
    }
    const mySeat = isHost ? seatOf(s.state, store().playerId) : s.mySeat;
    if (!container.querySelector(':scope > .room-frame')) {
      container.innerHTML = `
        <div class="room-frame">
          <div class="room-info poker-info"></div>
          <div class="room-game"></div>
          <div class="room-notice poker-notice" hidden></div>
          <div class="room-bottom">
            <span class="room-timer turn-timer"></span>
            <button class="btn btn-danger room-leave"></button>
          </div>
        </div>`;
      container.querySelector('.room-leave').addEventListener('click', () => (session().role === 'host' ? hostLeave() : clientLeave()));
    }
    const players = view.players.length;
    const myPlace = mySeat >= 0 ? d.placeOf(view, mySeat) : null;
    const info = [
      s.solo ? `${d.icon} Gegen Computer` : `👥 Raum ${s.code}`,
      d.settingsText && s.settings ? d.settingsText(s.settings) : '',
      `Eintritt ${GK.formatMoneyHTML(s.entry)}`,
      s.solo ? prizeText(s.entry, players, true)
        : prizeText(s.entry, players, false, humans(view.players)),
    ].filter(Boolean);
    setHtml(container.querySelector('.room-info'), info.map(i => `<span>${i}</span>`).join(''));
    const notices = [];
    const serverGone = isHost && net.peer && net.peer.disconnected && !net.peer.destroyed;
    if (!s.solo && (net.status !== 'online' || serverGone)) notices.push(statusLine());
    if (!s.solo && s.phase === 'playing') {
      const online = id => (isHost ? id === store().playerId || net.conns.has(id) : (s.members.find(m => m.playerId === id) || {}).online !== false);
      const away = view.players.filter((p, i) => p.id && !p.isBot && !d.placeOf(view, i) && !online(p.id)).map(p => esc(p.name));
      if (away.length && (isHost || net.status === 'online')) {
        notices.push(`📴 ${away.join(', ')} ${away.length > 1 ? 'sind' : 'ist'} gerade nicht verbunden – wer länger als ${DROP_AFTER / 1000} Sekunden weg ist, scheidet aus.`);
      }
    }
    if (s.result && !s.result.refunded && s.phase !== 'ended') {
      notices.push(`Du bist raus: <b>${s.result.place}. Platz</b>${s.result.prize ? ` – ${GK.formatMoneyHTML(s.result.prize)} gewonnen!` : '.'}` +
        (isHost && !s.solo ? ' Du leitest das Spiel weiter, bis es vorbei ist.' : ' Du kannst weiter zuschauen.'));
    }
    if (s.phase === 'ended') {
      const ranking = view.players.map((p, i) => ({ p, place: d.placeOf(view, i) })).sort((a, b) => a.place - b.place)
        .map(({ p, place }) => `${place}. ${p.avatar || ''} ${esc(p.name)}`).join(' · ');
      notices.push(`🏁 Spiel vorbei! ${ranking}`);
    }
    const notice = container.querySelector('.room-notice');
    setHtml(notice, notices.join('<br>'));
    notice.hidden = !notices.length;
    const leaveLabel = s.phase === 'ended' ? 'Zurück zum Start' : myPlace || mySeat < 0 ? 'Raum verlassen' : 'Spiel verlassen';
    setHtml(container.querySelector('.room-leave'), leaveLabel);
    d.draw(container.querySelector('.room-game'), view, {
      mySeat,
      isHost,
      solo: !!s.solo,
      ended: s.phase === 'ended',
      act,
      members: s.members,
    });
    tick(container);
  }

  // Bedenkzeit anzeigen (wird regelmäßig aufgerufen)
  function tick(container) {
    const s = session();
    const el = container && container.querySelector('.room-timer');
    if (!el || !s) return;
    const secs = s.deadline ? Math.ceil((s.deadline - Date.now()) / 1000) : -1;
    el.textContent = secs >= 0 ? `⏱ ${secs} s` : '';
    el.classList.toggle('urgent', secs >= 0 && secs <= 5);
  }

  // ---------- Anmeldung der Spiele im Casino ----------

  function registerGame(d) {
    games[d.id] = d;
    GK.casino.register({
      id: d.id,
      category: 'friends',
      name: d.name,
      emoji: d.icon,
      desc: d.desc,
      init: body => draw(body, d.id),
      refresh: () => containers[d.id] && draw(containers[d.id], d.id),
      onShow: () => {
        if (containers[d.id]) draw(containers[d.id], d.id);
        if (active(d.id)) scheduleHost();
      },
      render: () => {
        const c = containers[d.id];
        if (!c) return;
        if (active(d.id)) tick(c);
        else if (c._betControl) c._betControl.refresh();
      },
    });
  }

  GK.room = {
    registerGame, active, resume, readInviteLink, prize, prizeShares, soloMultipliers, payoutFor, BOTS,
    _net: net, // für Tests
  };
})();
