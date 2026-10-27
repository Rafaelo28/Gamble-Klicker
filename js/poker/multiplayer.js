// Texas Hold'em mit Freunden im Online-Raum.
//
// So funktioniert es:
// - Ein Spieler eröffnet einen Raum und wird Gastgeber. Er bekommt einen Raum-Code.
// - Freunde geben den Code ein. Die Browser verbinden sich direkt miteinander (WebRTC über
//   die Bibliothek PeerJS; deren kostenloser Server hilft nur beim Finden der Mitspieler).
// - Der Gastgeber legt den Eintritt und den Modus (Klassisch, Turbo oder Blitz) fest. Wer beitritt, sieht ihn und bestätigt die Zahlung.
//   Alle bekommen gleich viele Tisch-Chips, das Preisgeld sind alle Eintritte zusammen.
// - Der Gastgeber führt die Spiel-Engine aus, steuert die Computer-Gegner und schickt jedem
//   Spieler nur die Karten, die er sehen darf.
// - Gastgeber und Mitspieler können die Seite neu laden: Der Raum wird gespeichert und die
//   Verbindung automatisch wieder aufgebaut.
window.GK = window.GK || {};
GK.poker = GK.poker || {};

(function () {
  const PROTOCOL = 3; // 3: Blitz-Modus (Auszahlung nach Chips)
  const ID_PREFIX = 'gamble-klicker-';
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // ohne leicht verwechselbare Zeichen (0/O, 1/I)
  const CODE_LENGTH = 5;
  const OFFLINE_TURN_TIME = 5000;  // Bedenkzeit, wenn die Verbindung des Spielers weg ist
  const RETRY_DELAY = 3000;
  const CONNECT_TIMEOUT = 10000;
  const ABANDON_AFTER = 30000;     // so lange muss der Gastgeber weg sein, bis man mit Erstattung gehen darf
  const DROP_AFTER = 90000;        // so lange ohne Verbindung am Tisch → scheidet aus
  const HEARTBEAT = 2000;          // Lebenszeichen alle 2 Sekunden …
  const HEARTBEAT_TIMEOUT = 8000;  // … bleibt es so lange aus, gilt die Verbindung als getrennt
  const MAX_NAME = 16;
  const MIN_ENTRY = 100;
  const ENTRY_PRESETS = [1000, 10000, 100000, 1e6, 1e7];
  const AVATARS = ['😎', '🤠', '🧐', '😺', '🐸', '🦊', '🐼', '🐯', '🦄', '🐙', '🦈', '🐵'];

  const engine = () => GK.poker.engine;
  const T = () => GK.poker.tournament;
  const esc = text => GK.poker.ui.escapeHtml(text);

  // Laufende Verbindung – wird nicht gespeichert, sondern nach dem Neuladen neu aufgebaut
  const net = {
    peer: null,
    conns: new Map(),  // Gastgeber: playerId → Verbindung
    hostConn: null,    // Mitspieler: Verbindung zum Gastgeber
    status: 'idle',    // 'connecting' | 'online' | 'lost'
    lostSince: null,
    retryTimer: null,
    connectTimer: null,
    serverTimer: null, // erneutes Anmelden beim Vermittlungsserver
    pendingConn: null, // Mitspieler: laufender Verbindungsversuch zum Gastgeber
  };
  let hostTimer = null;
  let pendingCode = '';
  const offlineSince = new Map(); // Gastgeber: playerId → seit wann ohne Verbindung

  // ---------- Gespeicherte Daten ----------

  function store() {
    return GK.casino.data('pokerMp', () => ({
      name: 'Spieler ' + (100 + GK.rng.int(900)),
      avatar: AVATARS[GK.rng.int(AVATARS.length)],
      playerId: randomId(),
      lastEntry: 1000,
      lastMode: 'classic',
      lastHands: 5,
      session: null,
      lastResult: null,
    }));
  }

  function session() {
    return store().session;
  }

  function active() {
    return !!session();
  }

  function randomId() {
    return Array.from({ length: 16 }, () => CODE_CHARS[GK.rng.int(CODE_CHARS.length)]).join('');
  }

  function newCode() {
    return Array.from({ length: CODE_LENGTH }, () => CODE_CHARS[GK.rng.int(CODE_CHARS.length)]).join('');
  }

  function cleanName(name) {
    return String(name || '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME) || 'Gast';
  }

  function inviteLink(code) {
    return location.origin + location.pathname + '?raum=' + code;
  }

  function peerAvailable() {
    return typeof window.Peer === 'function';
  }

  function peerOptions() {
    // Für Tests kann ein eigener PeerJS-Server eingetragen werden (window.GK_PEER_OPTIONS)
    return Object.assign({ debug: 0 }, window.GK_PEER_OPTIONS || {});
  }

  // ---------- Dublonen: Eintritt, Auszahlung, Erstattung ----------

  // Anzeige-Infos zum Raum (Eintritt legt der Gastgeber fest)
  function sessionTier() {
    return { icon: '👥', name: 'Freundesrunde', entry: session().entry };
  }

  // Spielmodus des Raums (Räume älterer Versionen: klassisch)
  function sessionMode() {
    return T().mode(session().mode);
  }

  // Name des Modus, z. B. „⏱️ Blitz · 5 Hände“
  function sessionModeLabel() {
    return T().modeLabel(session().mode, session().hands);
  }

  // Preise des Raums als Text
  function prizeText(entry, players, blitz) {
    if (blitz) return `Die besten ${T().blitzPaidPlaces(players)} teilen ${GK.formatMoneyHTML(entry * players)} nach Chips`;
    return T().prizeShares(players).map((_, i) => `${['🥇', '🥈', '🥉'][i]} ${GK.formatMoneyHTML(T().prize(i + 1, entry, players))}`).join(' ');
  }

  // Eigenen Platz abrechnen (genau einmal pro Turnier). win: Auszahlung in Dublonen
  function settle(place, players, win) {
    const s = session();
    if (!s || s.settled || !s.paid) return;
    const tr = sessionTier();
    s.settled = true;
    s.result = { place, prize: win, players };
    GK.casino.payout(win);
    GK.unlockAchievement('pokerMpPlay');
    if (place === 1) GK.unlockAchievement('pokerMpWin');
    GK.casino.record('poker', tr.entry, win, `${place}. Platz · Freundesrunde`);
    setTimeout(() => GK.fx.celebrate(win, tr.entry, { level: place === 1 ? 'mega' : undefined, subtitle: `${place}. Platz – Freundesrunde` }), 600);
  }

  // Gibt true zurück, wenn tatsächlich etwas erstattet wurde
  function refundEntry() {
    const s = session();
    if (!s || s.settled || !s.paid) return false;
    s.settled = true;
    s.result = { refunded: true };
    GK.casino.refund(sessionTier().entry);
    return true;
  }

  // Raum verlassen und Ergebnis für die Poker-Lobby merken.
  // refund: Eintritt erstatten, falls das Turnier für mich noch nicht abgerechnet ist.
  function endSession(message, refund) {
    const s = session();
    if (!s) return;
    if (refund && refundEntry()) message += ' Dein Eintritt wurde erstattet.';
    const tr = s.entry ? sessionTier() : null;
    store().lastResult = { message, result: s.result || null, tierName: tr ? tr.name : '' };
    store().session = null;
    clearTimeout(hostTimer);
    destroyPeer();
    GK.save();
    GK.poker.redraw();
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
  // ganzen Tisch: die Verbindung meldet sich dann selbst mit „close“, der Herzschlag erkennt den Rest.
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

  function createRoom(entry, modeId, hands) {
    entry = Math.floor(Number(entry) || 0);
    if (entry < MIN_ENTRY) return GK.toast(`Der Eintritt muss mindestens ${GK.formatNumber(MIN_ENTRY)} Dublonen betragen.`);
    if (GK.poker.singleActive()) return GK.toast('Beende zuerst dein Turnier gegen die Computer-Gegner.');
    if (GK.room && GK.room.active()) return GK.toast('Verlasse zuerst deinen anderen Spielraum.');
    if (!GK.casino.bet(entry)) return GK.toast('Nicht genug Dublonen für den Eintritt.');
    const me = store();
    me.lastEntry = entry;
    me.lastMode = T().mode(modeId).id;
    me.lastHands = T().blitzHands(hands);
    me.session = {
      role: 'host',
      code: newCode(),
      fresh: true,            // Raum-Code noch nicht beim Server angemeldet
      entry,
      mode: me.lastMode,
      hands: me.lastHands,
      phase: 'lobby',
      paid: true,
      settled: false,
      members: [{ playerId: me.playerId, name: me.name, avatar: me.avatar, ready: true }],
      fillBots: true,
      table: null,
      deadline: null,
      turnKey: null,
    };
    me.lastResult = null;
    GK.save();
    connectHost();
    GK.poker.redraw();
  }

  function connectHost() {
    destroyPeer();
    const s = session();
    net.status = 'connecting';
    const peer = new window.Peer(ID_PREFIX + s.code, peerOptions());
    net.peer = peer;
    peer.on('open', () => {
      session().fresh = false;
      net.status = 'online';
      GK.save();
      GK.poker.redraw();
    });
    peer.on('connection', setupHostConn);
    peer.on('disconnected', () => {
      // Nur die Verbindung zum Vermittlungs-Server ist weg – bestehende Spieler bleiben verbunden
      if (net.peer === peer) {
        reconnectServer(peer);
        GK.poker.redraw();
      }
    });
    peer.on('error', err => {
      if (net.peer !== peer) return;
      const s2 = session();
      if (!s2) return;
      if (err.type === 'unavailable-id' && s2.fresh) {
        s2.code = newCode(); // Code zufällig schon vergeben → neuen nehmen
        connectHost();
        return;
      }
      // z. B. nach dem Neuladen hält der Server den alten Code noch kurz fest → neu aufbauen
      afterPeerError(peer, () => {
        net.status = 'lost';
        GK.poker.redraw();
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

  function onHostConnClosed(conn) {
    const s = session();
    if (!s || s.role !== 'host' || !conn.playerId) return;
    if (net.conns.get(conn.playerId) !== conn) return; // bereits durch neue Verbindung ersetzt
    net.conns.delete(conn.playerId);
    if (s.phase === 'lobby') {
      // Im Warteraum: Spieler entfernen. Kommt er zurück, tritt er einfach erneut bei.
      s.members = s.members.filter(m => m.playerId !== conn.playerId);
    } else if (s.table) {
      const p = s.table.players.find(pl => pl.id === conn.playerId);
      if (p) p.offline = true;
    }
    afterHostChange();
  }

  function onHostMessage(conn, msg) {
    const s = session();
    if (!s || s.role !== 'host' || !msg || typeof msg !== 'object') return;

    if (msg.type === 'hello') {
      if (msg.v !== PROTOCOL) {
        send(conn, { type: 'error', fatal: true, message: 'Ihr habt verschiedene Spielversionen. Bitte ladet beide die Seite neu.' });
        return;
      }
      const playerId = String(msg.playerId || '').slice(0, 32);
      const name = cleanName(msg.name);
      const avatar = AVATARS.includes(msg.avatar) ? msg.avatar : AVATARS[0];
      if (!playerId || playerId === store().playerId) return;
      let member = s.members.find(m => m.playerId === playerId);
      if (!member) {
        if (s.phase !== 'lobby') {
          send(conn, { type: 'error', fatal: true, message: 'In diesem Raum läuft das Spiel schon.' });
          return;
        }
        if (s.members.length >= T().MAX_SEATS) {
          send(conn, { type: 'error', fatal: true, message: 'Der Raum ist schon voll.' });
          return;
        }
        member = { playerId, name, avatar, ready: false };
        s.members.push(member);
      } else if (s.phase === 'lobby') {
        member.name = name;
        member.avatar = avatar;
      }
      if (msg.paid) member.ready = true; // hat den Eintritt schon bezahlt (z. B. nach dem Neuladen)
      const old = net.conns.get(playerId);
      conn.playerId = playerId;
      net.conns.set(playerId, conn);
      if (old && old !== conn) old.close();
      if (s.table) {
        const p = s.table.players.find(pl => pl.id === playerId);
        if (p) p.offline = false;
      }
      afterHostChange();
      return;
    }

    if (!conn.playerId || msg.type === 'ping') return;
    if (msg.type === 'join' && s.phase === 'lobby') {
      const member = s.members.find(m => m.playerId === conn.playerId);
      if (member) member.ready = true;
      afterHostChange();
    } else if (msg.type === 'action' && s.phase === 'playing') {
      const seat = s.table.players.findIndex(p => p.id === conn.playerId);
      playerAction(seat, msg.action);
    } else if (msg.type === 'leave') {
      playerLeft(conn.playerId);
      setTimeout(() => conn.close(), 500);
    }
  }

  function cleanAction(action) {
    const type = action && ['fold', 'check', 'call', 'raise'].includes(action.type) ? action.type : 'fold';
    return { type, to: Math.floor(Number(action && action.to) || 0) };
  }

  function playerAction(seat, action) {
    const t = session().table;
    if (seat < 0 || t.phase !== 'betting' || t.toAct !== seat) return;
    engine().act(t, cleanAction(action));
    afterHostChange();
  }

  function playerLeft(playerId) {
    const s = session();
    if (s.phase === 'lobby') {
      s.members = s.members.filter(m => m.playerId !== playerId);
    } else if (s.phase === 'playing') {
      const seat = s.table.players.findIndex(p => p.id === playerId);
      if (seat >= 0) engine().forfeit(s.table, seat);
    }
    net.conns.delete(playerId);
    afterHostChange();
  }

  function startGame() {
    const s = session();
    if (s.role !== 'host' || s.phase !== 'lobby' || s.members.filter(m => m.ready).length < 2) return;
    // Wer den Eintritt noch nicht bezahlt hat, spielt nicht mit
    s.members.filter(m => !m.ready).forEach(m => {
      const conn = net.conns.get(m.playerId);
      send(conn, { type: 'error', fatal: true, message: 'Das Spiel wurde ohne dich gestartet, weil du den Eintritt noch nicht bezahlt hattest.' });
      net.conns.delete(m.playerId);
      if (conn) setTimeout(() => conn.close(), 500);
    });
    s.members = s.members.filter(m => m.ready);
    let seats = s.members.map(m => ({ id: m.playerId, name: m.name, avatar: m.avatar, isBot: false }));
    if (s.fillBots) seats = seats.concat(T().botSeats(T().MAX_SEATS - seats.length));
    s.table = T().createTable(seats, s.mode, s.hands);
    s.phase = 'playing';
    engine().startHand(s.table);
    afterHostChange();
  }

  function hostNextHand() {
    const s = session();
    if (!s || s.role !== 'host' || s.phase !== 'playing' || s.table.phase === 'betting') return;
    engine().startHand(s.table);
    afterHostChange();
  }

  function hostBotStep() {
    const t = session().table;
    if (t.phase !== 'betting' || !t.players[t.toAct].isBot) return;
    engine().act(t, GK.poker.ai.decide(t));
    afterHostChange();
  }

  // Bedenkzeit abgelaufen: checken, wenn möglich – sonst passen
  function hostTimeout() {
    const t = session().table;
    if (t.phase !== 'betting' || t.players[t.toAct].isBot) return;
    engine().act(t, { type: engine().legalActions(t).canCheck ? 'check' : 'fold' });
    afterHostChange();
  }

  function turnKey(t) {
    return t.phase === 'betting' ? `${t.handNo}:${t.street}:${t.toAct}:${t.log.length}` : null;
  }

  // Nach jeder Änderung am Gastgeber: Bedenkzeit, eigene Abrechnung, speichern, an alle senden
  function afterHostChange() {
    const s = session();
    if (!s || s.role !== 'host') return;
    const t = s.table;
    if (t) {
      const key = turnKey(t);
      if (key !== s.turnKey) {
        s.turnKey = key;
        const p = key && t.players[t.toAct];
        s.deadline = p && !p.isBot ? Date.now() + (p.offline ? OFFLINE_TURN_TIME : sessionMode().turnTime) : null;
      }
      // Blitz: Nach der letzten Hand ist Schluss, die Chips entscheiden
      if (T().handLimitReached(t)) T().finishByChips(t);
      const meSeat = t.players.findIndex(p => p.id === store().playerId);
      const me = t.players[meSeat];
      if (t.result && t.result.hands && t.result.hands[meSeat] === 'Royal Flush') GK.unlockAchievement('pokerRoyal');
      if (me.out || t.phase === 'finished') settle(me.place, t.players.length, T().payout(t, meSeat, s.entry));
      if (t.phase === 'finished') s.phase = 'ended';
    }
    GK.save();
    broadcast();
    GK.poker.redraw();
    scheduleHost();
  }

  function scheduleHost() {
    clearTimeout(hostTimer);
    const s = session();
    if (!s || s.role !== 'host' || s.phase !== 'playing') return;
    const t = s.table;
    const m = sessionMode();
    if (t.phase === 'betting') {
      if (t.players[t.toAct].isBot) hostTimer = setTimeout(hostBotStep, m.botDelay);
      else hostTimer = setTimeout(hostTimeout, Math.max(0, s.deadline - Date.now()));
    } else {
      hostTimer = setTimeout(hostNextHand, t.result && t.result.showdown ? m.nextDelayShowdown : m.nextDelay + 500);
    }
  }

  // Tisch für einen Spieler: fremde Karten verdeckt (außer beim Showdown), kein Kartenstapel
  function viewFor(t, seat) {
    const view = JSON.parse(JSON.stringify(t));
    delete view.deck;
    view.players.forEach((p, i) => {
      delete p.personality;
      const shown = t.phase !== 'betting' && t.result && t.result.showdown && engine().inHand(t.players[i]);
      if (i !== seat && !shown) p.cards = p.cards.map(() => null);
    });
    return view;
  }

  function stateMessage(playerId) {
    const s = session();
    const msg = {
      type: 'state',
      v: PROTOCOL,
      code: s.code,
      entry: s.entry,
      mode: s.mode,
      hands: s.hands,
      phase: s.phase,
      hostId: store().playerId,
      fillBots: s.fillBots,
      members: s.members.map(m => ({ ...m, online: m.playerId === store().playerId || net.conns.has(m.playerId) })),
    };
    if (s.table) {
      const seat = s.table.players.findIndex(p => p.id === playerId);
      msg.view = viewFor(s.table, seat);
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
    let text;
    if (s.phase === 'lobby') {
      text = 'Raum schließen? Alle bekommen ihren Eintritt zurück.';
    } else if (s.phase === 'playing') {
      const t = s.table;
      const me = t.players.find(p => p.id === store().playerId);
      text = me.out
        ? 'Wenn du gehst, endet das Turnier für alle. Deine Mitspieler bekommen ihren Eintritt zurück.'
        : `Wenn du gehst, endet das Turnier für alle. Deine Mitspieler bekommen ihren Eintritt zurück, du belegst Platz ${t.players.filter(p => !p.out).length}.`;
    }
    if (text && !confirm(text)) return;
    net.conns.forEach(conn => send(conn, { type: 'closed', reason: 'Der Gastgeber hat den Raum geschlossen.' }));
    if (s.phase === 'playing') {
      const t = s.table;
      const seat = t.players.findIndex(p => p.id === store().playerId);
      if (!t.players[seat].out) engine().forfeit(t, seat);
      settle(t.players[seat].place, t.players.length, T().payout(t, seat, s.entry));
    }
    // Kurz warten, damit die Nachricht noch rausgeht
    setTimeout(() => endSession(s.phase === 'lobby' ? 'Du hast den Raum geschlossen.' : 'Du hast den Raum verlassen.', s.phase === 'lobby'), 300);
  }

  // ========== Mitspieler ==========

  function joinRoom(code) {
    code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== CODE_LENGTH) return GK.toast(`Der Raum-Code hat ${CODE_LENGTH} Zeichen.`);
    if (GK.poker.singleActive()) return GK.toast('Beende zuerst dein Turnier gegen die Computer-Gegner.');
    if (GK.room && GK.room.active()) return GK.toast('Verlasse zuerst deinen anderen Spielraum.');
    store().session = {
      role: 'client',
      code,
      phase: 'connecting',
      joined: false,          // schon einmal im Raum gewesen?
      paid: false,
      settled: false,
      entry: null,
      members: [],
      hostId: null,
      fillBots: true,
      view: null,
      mySeat: -1,
      deadline: null,
      result: null,
    };
    store().lastResult = null;
    GK.save();
    connectClient();
    GK.poker.redraw();
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
    const conn = net.peer.connect(ID_PREFIX + s.code, { reliable: true });
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
      send(conn, { type: 'hello', v: PROTOCOL, playerId: me.playerId, name: me.name, avatar: me.avatar, paid: session().paid });
      GK.poker.redraw();
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

  // Verbindung zum Gastgeber verloren → regelmäßig neu versuchen
  function hostLost() {
    const s = session();
    net.hostConn = null;
    if (!s || s.role !== 'client' || s.phase === 'ended') return;
    if (net.status !== 'lost') net.lostSince = Date.now();
    net.status = 'lost';
    GK.poker.redraw();
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
    if (msg.type !== 'state' || !(entry >= MIN_ENTRY)) return;
    // Der Eintritt wird erst bezahlt, wenn der Spieler ihn bestätigt (clientConfirm)
    if (!s.paid) s.entry = entry;
    s.mode = T().mode(msg.mode).id;
    s.hands = T().blitzHands(msg.hands);
    s.joined = true;
    s.phase = msg.phase;
    s.members = Array.isArray(msg.members) ? msg.members : [];
    s.hostId = msg.hostId;
    s.fillBots = !!msg.fillBots;
    s.view = msg.view || null;
    s.mySeat = typeof msg.mySeat === 'number' ? msg.mySeat : -1;
    s.deadline = typeof msg.turnLeft === 'number' ? Date.now() + msg.turnLeft : null;

    const me = s.view && s.view.players[s.mySeat];
    if (me) {
      if (s.view.result && s.view.result.hands && s.view.result.hands[s.mySeat] === 'Royal Flush') GK.unlockAchievement('pokerRoyal');
      if (me.out || s.view.phase === 'finished') settle(me.place, s.view.players.length, T().payout(s.view, s.mySeat, s.entry));
    }
    GK.save();
    GK.poker.redraw();
  }

  // Mitspieler bestätigt den Eintritt, den der Gastgeber festgelegt hat
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
    GK.poker.redraw();
  }

  function clientLeave() {
    const s = session();
    const me = s.view && s.view.players[s.mySeat];
    if (s.phase === 'connecting' || s.phase === 'lobby') {
      send(net.hostConn, { type: 'leave' });
      endSession('Du hast den Raum verlassen.', true);
      return;
    }
    if (s.phase === 'playing' && me && !me.out && !s.settled) {
      const hostGone = net.status === 'lost' && Date.now() - net.lostSince >= ABANDON_AFTER;
      if (hostGone) {
        if (!confirm('Der Gastgeber ist nicht mehr erreichbar. Turnier abbrechen? Du bekommst deinen Eintritt zurück.')) return;
        endSession('Turnier abgebrochen.', true);
        return;
      }
      const place = s.view.players.filter(p => !p.out).length;
      // Wer aufgibt, verliert seine Chips – im Blitz zählen nur die Chips am Ende
      const win = T().isBlitz(s.view) ? 0 : T().prize(place, sessionTier().entry, s.view.players.length);
      if (!confirm(`Turnier wirklich verlassen? Du belegst damit Platz ${place}` +
        (win ? ` und bekommst ${GK.formatNumber(win)} Dublonen.` : ' und gehst leer aus.'))) return;
      send(net.hostConn, { type: 'leave' });
      settle(place, s.view.players.length, win);
    }
    setTimeout(() => endSession('Du hast den Raum verlassen.', false), 300);
  }

  // ========== Gemeinsam ==========

  // Herzschlag: Verschwindet jemand ohne Abmeldung (Fenster zu, Internet weg), merkt das die
  // Browser-Verbindung nicht zuverlässig. Deshalb schicken sich beide Seiten Lebenszeichen.
  function heartbeat() {
    const s = session();
    if (!s) return;
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
    // Statuszeile (z. B. „keine Verbindung seit … s“) aktuell halten
    if (net.status === 'lost') GK.poker.redraw();
  }
  setInterval(heartbeat, HEARTBEAT);

  // Ist der Gastgeber selbst gerade mit dem Netz verbunden? (Vermittlungsserver erreichbar, Browser online)
  function hostOnline() {
    return net.status === 'online' && !!net.peer && !net.peer.destroyed && !net.peer.disconnected && navigator.onLine !== false;
  }

  // Wer länger ohne Verbindung ist, scheidet aus – sonst warten alle anderen bei jeder Hand auf ihn
  function dropAbsentPlayers(now) {
    const s = session();
    // Ist der Gastgeber selbst offline, liegt es an ihm – dann scheidet niemand aus
    if (!s || s.role !== 'host' || s.phase !== 'playing' || !s.table || !hostOnline()) {
      offlineSince.clear();
      return;
    }
    const t = s.table;
    let changed = false;
    t.players.forEach((p, seat) => {
      if (p.isBot || p.out || p.id === store().playerId || net.conns.has(p.id)) {
        offlineSince.delete(p.id);
        return;
      }
      if (!offlineSince.has(p.id)) offlineSince.set(p.id, now);
      else if (now - offlineSince.get(p.id) >= DROP_AFTER && t.phase !== 'finished') {
        engine().forfeit(t, seat);
        offlineSince.delete(p.id);
        changed = true;
      }
    });
    if (changed) afterHostChange();
  }

  function myAction(action) {
    const s = session();
    if (s.role === 'host') {
      playerAction(s.table.players.findIndex(p => p.id === store().playerId), action);
    } else if (!net.hostConn || !net.hostConn.open) {
      GK.toast('Keine Verbindung zum Gastgeber – versuche es gleich noch einmal.');
    } else {
      send(net.hostConn, { type: 'action', action });
    }
  }

  // Nach dem Laden der Seite: gespeicherten Raum wieder verbinden
  function resume() {
    clearTimeout(hostTimer);
    destroyPeer();
    const s = session();
    if (!s) return;
    if (!peerAvailable()) {
      net.status = 'lost';
      return;
    }
    if (s.role === 'host') {
      s.turnKey = null; // Bedenkzeit neu starten
      connectHost();
      afterHostChange();
    } else {
      connectClient();
    }
  }

  // Einladungs-Link (…?raum=CODE): Poker öffnen und den Code eintragen
  function readInviteLink() {
    const params = new URLSearchParams(location.search);
    const code = (params.get('raum') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!code || (params.get('spiel') && params.get('spiel') !== 'poker')) return;
    pendingCode = code.slice(0, CODE_LENGTH);
    GK.state.ui.tab = 'casino';
    GK.state.casino.openGame = 'poker';
    params.delete('raum');
    const rest = params.toString();
    history.replaceState(null, '', location.pathname + (rest ? '?' + rest : '') + location.hash);
  }

  // ---------- Darstellung ----------

  function statusLine() {
    const s = session();
    if (!peerAvailable()) return '<span class="mp-status lost">🔴 Multiplayer nicht verfügbar – keine Internetverbindung?</span>';
    if (net.status === 'online') {
      if (s.role === 'host' && net.peer && net.peer.disconnected && !net.peer.destroyed) {
        return '<span class="mp-status connecting">🟡 Verbindung zum Server wird erneuert – wer schon am Tisch sitzt, bleibt verbunden …</span>';
      }
      return s.role === 'host'
        ? '<span class="mp-status online">🟢 Raum ist online</span>'
        : '<span class="mp-status online">🟢 Mit dem Gastgeber verbunden</span>';
    }
    if (net.status === 'lost') {
      const ms = net.lostSince ? Date.now() - net.lostSince : 0;
      // Nur wer noch mitspielt (nicht schon ausgeschieden und abgerechnet), bekommt den Eintritt zurück
      const gone = s.role === 'client' && s.phase === 'playing' && !s.settled && ms >= ABANDON_AFTER
        ? ' Du kannst das Turnier auch verlassen – dann bekommst du deinen Eintritt zurück.' : '';
      return `<span class="mp-status lost">🔴 Keine Verbindung${s.role === 'client' ? ` zum Gastgeber (seit ${Math.floor(ms / 1000)} s)` : ''} – versuche es erneut …${gone}</span>`;
    }
    return '<span class="mp-status connecting">🟡 Verbinde …</span>';
  }

  // Formular in der Poker-Lobby: Name, Raum eröffnen, Raum beitreten
  function renderJoinPanel(el) {
    const me = store();
    const result = me.lastResult;
    let resultHtml = '';
    if (result) {
      const r = result.result;
      const extra = r && !r.refunded
        ? ` Du hast den <b>${r.place}. Platz</b> belegt${r.prize ? ` und ${GK.formatMoneyHTML(r.prize)} gewonnen!` : '.'}`
        : '';
      resultHtml = `<div class="poker-result ${r && r.prize ? 'win' : ''}">${esc(result.message)}${extra}</div>`;
    }
    el.innerHTML = `
      ${resultHtml}
      <p class="muted">
        Spielt online zusammen: Einer eröffnet einen Raum und schickt den anderen den Raum-Code.
        Jeder zahlt den Eintritt, alle bekommen gleich viele Tisch-Chips,
        freie Plätze können Computer-Gegner übernehmen.
      </p>
      ${peerAvailable() ? '' : '<p class="warning">Der Multiplayer braucht eine Internetverbindung (die Bibliothek PeerJS konnte nicht geladen werden).</p>'}
      <div class="mp-forms">
        <div class="mp-form">
          <label class="bet-label" for="mp-name">Dein Name am Tisch</label>
          <div class="bet-row">
            <button type="button" class="btn mp-avatar" title="Anderes Bild">${me.avatar}</button>
            <input id="mp-name" class="bet-input mp-name" maxlength="${MAX_NAME}" value="${esc(me.name)}">
          </div>
        </div>
        <div class="mp-form">
          <label class="bet-label" for="mp-entry">Raum eröffnen – Eintritt pro Spieler</label>
          <div class="mp-mode-slot">${GK.poker.ui.modePicker(T().mode(me.lastMode).id, T().blitzHands(me.lastHands), 'mp-modes')}</div>
          <div class="bet-row">
            <input id="mp-entry" type="number" class="bet-input mp-entry" min="${MIN_ENTRY}" step="100" inputmode="numeric" value="${me.lastEntry}">
            <button type="button" class="btn btn-primary mp-create">Eröffnen</button>
          </div>
          <div class="bet-row mp-presets">
            ${ENTRY_PRESETS.map(v => `<button type="button" class="btn btn-small mp-preset" data-entry="${v}">${GK.formatNumber(v)}</button>`).join('')}
          </div>
          <span class="small mp-create-reason"></span>
        </div>
        <div class="mp-form">
          <label class="bet-label" for="mp-code">Raum beitreten</label>
          <div class="bet-row">
            <input id="mp-code" class="bet-input mp-code-input" maxlength="${CODE_LENGTH}" placeholder="CODE" value="${esc(pendingCode)}" autocomplete="off">
            <button type="button" class="btn btn-primary mp-join">Beitreten</button>
          </div>
        </div>
      </div>`;

    const nameInput = el.querySelector('.mp-name');
    nameInput.addEventListener('change', () => {
      store().name = cleanName(nameInput.value);
      nameInput.value = store().name;
      GK.save();
    });
    el.querySelector('.mp-avatar').addEventListener('click', e => {
      const next = AVATARS[(AVATARS.indexOf(store().avatar) + 1) % AVATARS.length];
      store().avatar = next;
      e.currentTarget.textContent = next;
      GK.save();
    });
    const save = () => { store().name = cleanName(nameInput.value); };
    const entryInput = el.querySelector('.mp-entry');
    el.querySelectorAll('.mp-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        entryInput.value = btn.dataset.entry;
        GK.sound.play('chip');
        updateJoinPanel(el);
      });
    });
    entryInput.addEventListener('input', () => updateJoinPanel(el));
    // Modus-Auswahl neu zeichnen (beim Blitz erscheint die Zahl der Hände)
    const slot = el.querySelector('.mp-mode-slot');
    const bindModes = () => {
      slot.querySelectorAll('.poker-mode').forEach(btn => {
        btn.addEventListener('click', () => {
          store().lastMode = btn.dataset.mode;
          redrawModes();
        });
      });
      slot.querySelectorAll('.poker-hands-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          store().lastHands = Number(btn.dataset.hands);
          redrawModes();
        });
      });
    };
    const redrawModes = () => {
      slot.innerHTML = GK.poker.ui.modePicker(T().mode(store().lastMode).id, T().blitzHands(store().lastHands), 'mp-modes');
      bindModes();
      updateJoinPanel(el);
      GK.sound.play('chip');
      GK.save();
    };
    bindModes();
    el.querySelector('.mp-create').addEventListener('click', () => {
      save();
      createRoom(entryInput.value, store().lastMode, store().lastHands);
    });
    el.querySelector('.mp-join').addEventListener('click', () => {
      save();
      pendingCode = '';
      joinRoom(el.querySelector('.mp-code-input').value);
    });
    if (pendingCode) el.querySelector('.mp-code-input').scrollIntoView({ block: 'center' });
  }

  function updateJoinPanel(root) {
    const input = root.querySelector('.mp-entry');
    if (!input) return;
    const entry = Math.floor(Number(input.value) || 0);
    let reason = '';
    if (!peerAvailable()) reason = 'Keine Verbindung zum Internet';
    else if (entry < MIN_ENTRY) reason = `Mindestens ${GK.formatNumber(MIN_ENTRY)} Dublonen`;
    else if (!GK.canAfford(entry)) reason = 'Nicht genug Dublonen';
    else if (T().mode(store().lastMode).id === 'blitz') reason = `Bei 6 Spielern teilen die besten 4 ${GK.formatNumber(entry * 6)} Dublonen nach Chips`;
    else reason = `Bei 6 Spielern gewinnt Platz 1: ${GK.formatNumber(T().prize(1, entry, 6))} Dublonen`;
    root.querySelector('.mp-create-reason').classList.toggle('ok', !!reason.startsWith('Bei'));
    root.querySelector('.mp-create').disabled = !reason.startsWith('Bei');
    root.querySelector('.mp-create-reason').textContent = reason;
    root.querySelector('.mp-join').disabled = !peerAvailable();
  }

  function draw(container) {
    const s = session();
    if (s.phase === 'connecting' || s.phase === 'lobby') drawRoom(container);
    else drawGame(container);
  }

  function drawRoom(container) {
    const s = session();
    const isHost = s.role === 'host';
    const tr = s.entry ? sessionTier() : null;
    const members = s.members;
    const players = isHost || s.phase === 'lobby'
      ? (s.fillBots ? T().MAX_SEATS : Math.max(2, members.length)) : 0;
    const prizes = tr && players ? prizeText(tr.entry, players, sessionMode().id === 'blitz') : '';
    const hostId = isHost ? store().playerId : s.hostId;
    const readyCount = members.filter(m => m.ready).length;
    const mustConfirm = !isHost && !s.paid && s.entry && s.phase === 'lobby';

    container.innerHTML = `
      <div class="mp-room">
        <div class="mp-code-box">
          <div class="muted small">Raum-Code</div>
          <div class="mp-code">${s.code}</div>
          ${isHost ? `
            <div class="bet-row">
              <button class="btn btn-small mp-copy-code">📋 Code kopieren</button>
              <button class="btn btn-small mp-copy-link">🔗 Einladungs-Link kopieren</button>
            </div>` : ''}
        </div>
        ${tr ? `<p class="mp-tier-info">${tr.icon} <b>${tr.name}</b> · ${sessionModeLabel()} · Eintritt ${GK.formatMoneyHTML(tr.entry)}<br>Preise: ${prizes}</p>` : ''}
        ${s.phase === 'connecting' ? '<p class="muted">Suche den Raum …</p>' : `
          <h3>Spieler (${members.length}/${T().MAX_SEATS})</h3>
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
              <button class="btn btn-primary btn-big mp-confirm-btn" ${GK.canAfford(s.entry) ? '' : 'disabled'}>💰 Eintritt bezahlen und mitspielen</button>
              ${GK.canAfford(s.entry) ? '' : '<p class="loss small">Dafür hast du nicht genug Dublonen.</p>'}
            </div>` : ''}
          ${isHost ? `
            <label class="mp-check"><input type="checkbox" class="mp-fill" ${s.fillBots ? 'checked' : ''}> Freie Plätze mit Computer-Gegnern auffüllen</label>
            <div class="game-actions">
              <button class="btn btn-primary btn-big mp-start" ${readyCount < 2 ? 'disabled' : ''}>▶ Spiel starten</button>
            </div>
            <p class="muted small">${readyCount < 2 ? 'Warte auf mindestens einen Mitspieler, der den Eintritt bezahlt hat …'
              : readyCount < members.length ? 'Wer noch nicht bezahlt hat, spielt nicht mit.' : 'Alle da? Dann los!'}
              Als Gastgeber leitest du den Tisch – lass das Spiel bitte geöffnet, bis das Turnier vorbei ist.</p>`
            : s.paid ? '<p class="muted">Warte, bis der Gastgeber das Spiel startet …</p>' : ''}
        `}
        <p>${statusLine()}</p>
        <button class="btn btn-danger mp-leave">${isHost ? 'Raum schließen' : 'Raum verlassen'}</button>
      </div>`;

    container.querySelector('.mp-leave').addEventListener('click', () => (isHost ? hostLeave() : clientLeave()));
    if (mustConfirm) container.querySelector('.mp-confirm-btn').addEventListener('click', clientConfirm);
    if (isHost && s.phase === 'lobby') {
      container.querySelector('.mp-fill').addEventListener('change', e => {
        s.fillBots = e.target.checked;
        afterHostChange();
      });
      container.querySelector('.mp-start').addEventListener('click', startGame);
      container.querySelector('.mp-copy-code').addEventListener('click', () => copyText(s.code, 'Code kopiert'));
      container.querySelector('.mp-copy-link').addEventListener('click', () => copyText(inviteLink(s.code), 'Einladungs-Link kopiert'));
    }
  }

  function copyText(text, done) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => GK.toast(done + ' ✅'), () => prompt('Zum Kopieren:', text));
    } else {
      prompt('Zum Kopieren:', text);
    }
  }

  function drawGame(container) {
    const s = session();
    const isHost = s.role === 'host';
    const t = isHost ? s.table : s.view;
    if (!t) {
      container.innerHTML = `<p>${statusLine()}</p>`;
      return;
    }
    const mySeat = isHost ? t.players.findIndex(p => p.id === store().playerId) : s.mySeat;
    const tr = sessionTier();
    const players = t.players.length;
    const { sb, bb } = engine().blinds(t);
    const me = t.players[mySeat];

    const notices = [];
    if (net.status !== 'online') notices.push(statusLine());
    if (s.result && !s.result.refunded && s.phase !== 'ended') {
      notices.push(`Du bist ausgeschieden: <b>${s.result.place}. Platz</b>${s.result.prize ? ` – ${GK.formatMoneyHTML(s.result.prize)} gewonnen!` : '.'}` +
        (isHost ? ' Du leitest den Tisch weiter, bis das Turnier vorbei ist.' : ' Du kannst weiter zuschauen.'));
    }
    const blitz = T().isBlitz(t);
    if (s.phase === 'ended') {
      const ranking = t.players.map((p, i) => ({ p, win: blitz ? T().payout(t, i, tr.entry) : 0 }))
        .sort((a, b) => a.p.place - b.p.place)
        .map(({ p, win }) => `${p.place}. ${p.avatar || ''} ${esc(p.name)}${win ? ` +${GK.formatMoneyHTML(win)}` : ''}`).join(' · ');
      notices.push(`🏁 Turnier vorbei! ${ranking}` + (s.result && !s.result.refunded
        ? `<br>Dein Ergebnis: <b>${s.result.place}. Platz</b>${s.result.prize ? ` – ${GK.formatMoneyHTML(s.result.prize)} gewonnen!` : '.'}` : ''));
    }

    GK.poker.ui.render(container, t, {
      mySeat,
      info: [
        `👥 Raum ${s.code}`,
        sessionModeLabel(),
        `Blinds ${GK.formatNumber(sb)}/${GK.formatNumber(bb)}`,
        ...(blitz ? [t.handNo >= t.maxHands ? `🔥 Letzte Hand (${t.maxHands}/${t.maxHands})` : `Hand ${t.handNo}/${t.maxHands}`] : []),
        `Spieler: ${t.players.filter(p => !p.out).length}/${players}`,
        prizeText(tr.entry, players, blitz),
      ],
      onAction: myAction,
      onNext: isHost && s.phase === 'playing' ? hostNextHand : null,
      notice: notices.join('<br>'),
      deadline: t.phase === 'betting' && !t.players[t.toAct].isBot ? s.deadline : null,
      onLeave: isHost ? hostLeave : clientLeave,
      leaveLabel: s.phase === 'ended' ? 'Zurück zur Lobby' : (me && me.out) || !me ? 'Raum verlassen' : 'Turnier verlassen',
    });
  }

  // Regelmäßig (alle 100 ms): Countdown aktualisieren
  function render(container) {
    GK.poker.ui.tick(container);
  }

  GK.poker.mp = {
    active,
    draw,
    render,
    renderJoinPanel,
    updateJoinPanel,
    resume,
    readInviteLink,
    // für Tests
    _net: net,
  };
})();
