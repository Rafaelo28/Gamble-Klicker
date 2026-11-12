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
//   phaseDeadline(z) → gemeinsame Zeitgrenze (Zeitstempel), solange niemand Bestimmtes dran ist ·
//   turnKey(z) → was als neuer Zug zählt (die Bedenkzeit startet nur dann neu; sonst bei jeder Aktion)
window.GK = window.GK || {};

// Sprache: Ersatz, falls js/i18n.js (noch) nicht geladen ist – gibt den deutschen Text zurück.
GK.t = GK.t || function (s, v) { s = String(s); return v ? s.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m)) : s; };
GK.i18n = GK.i18n || { add() {}, addHtml() {}, apply() {}, set() {}, lang: 'de' };

GK.i18n.add({
  'Dieser Platz gehört schon jemand anderem.': 'This seat already belongs to someone else.',
  'Der Gastgeber hat dich aus dem Raum entfernt.': 'The host removed you from the room.',
  'Du wurdest aus diesem Raum entfernt.': 'You were removed from this room.',
  'Entfernen': 'Remove',
  'Ein Mitspieler war zu lange ohne Verbindung – das Spiel wurde abgebrochen.': 'A player was disconnected for too long – the game was cancelled.',
  'Der Gastgeber hat den Raum geschlossen.': 'The host closed the room.',
  'Der Gastgeber hat aufgegeben.': 'The host gave up.',
  ' Der Rest des Topfs wird unter den Gästen geteilt, du bekommst {money}.': ' The rest of the pot is shared among the guests, you get {money}.',
  'Gastgeber hat aufgegeben': 'Host gave up',
  'Der Gastgeber hat den Eintritt geändert – prüfe den neuen Betrag.': 'The host changed the entry fee – check the new amount.',
  'Dieser Raum spielt ein anderes Spiel.': 'This room is playing a different game.',
  'Ihr habt verschiedene Spielversionen. Bitte ladet beide die Seite neu.': 'You have different game versions. Please both reload the page.',
  'In diesem Raum läuft das Spiel schon.': 'The game in this room has already started.',
  'Der Raum ist schon voll.': 'The room is already full.',
  'Das Spiel wurde ohne dich gestartet, weil du den Eintritt noch nicht bezahlt hattest.': 'The game was started without you because you had not paid the entry fee yet.',
  'Beende zuerst dein Poker-Turnier.': 'Finish your poker tournament first.',
  'Verlasse zuerst deinen Poker-Raum.': 'Leave your poker room first.',
  'Du bist schon in einem Raum ({name}).': "You're already in a room ({name}).",
  'Der Eintritt muss mindestens {amount} Dublonen betragen.': 'The entry fee must be at least {amount} doubloons.',
  'Dein Limit sind {amount} Dublonen – eine bessere VIP-Karte erhöht es.': 'Your limit is {amount} doubloons – a better VIP card raises it.',
  'Nicht genug Dublonen für den Eintritt.': 'Not enough doubloons for the entry fee.',
  '{place}. Platz – {name}': 'Place {place} – {name}',
  ' Dein Eintritt wurde erstattet.': ' Your entry fee has been refunded.',
  'Spiel wirklich verlassen? Du belegst damit Platz {place}{rest}': 'Really leave the game? You then take place {place}{rest}',
  ' und bekommst {amount} Dublonen.': ' and receive {amount} doubloons.',
  ' und gehst leer aus.': ' and come away empty-handed.',
  'Raum schließen? Alle bekommen ihren Eintritt zurück.': 'Close the room? Everyone gets their entry fee back.',
  'Wenn du gehst, gibst du auf und das Spiel endet für alle. Deine Mitspieler bekommen ihren Eintritt zurück und teilen sich deinen.': 'If you leave, you give up and the game ends for everyone. Your fellow players get their entry fee back and share yours.',
  'Du hast den Raum geschlossen.': 'You closed the room.',
  'Spiel beendet.': 'Game finished.',
  'Du hast das Spiel verlassen.': 'You left the game.',
  'Der Raum-Code hat {n} Zeichen.': 'The room code has {n} characters.',
  'Der Gastgeber ist nicht mehr erreichbar. Spiel abbrechen? Du bekommst deinen Eintritt zurück.': 'The host is no longer reachable. Abort the game? You get your entry fee back.',
  'Spiel abgebrochen.': 'Game aborted.',
  'Raum {code} nicht gefunden. Stimmt der Code?': 'Room {code} not found. Is the code correct?',
  'Du hast den Raum verlassen.': 'You left the room.',
  'Keine Verbindung zum Gastgeber – versuche es gleich noch einmal.': 'No connection to the host – try again in a moment.',
  ' Online-Spiel nicht verfügbar – keine Internetverbindung?': ' Online play unavailable – no internet connection?',
  ' Verbindung zum Server wird erneuert – wer schon im Raum ist, bleibt verbunden …': ' Reconnecting to the server – anyone already in the room stays connected …',
  ' Raum ist online': ' Room is online',
  ' Mit dem Gastgeber verbunden': ' Connected to the host',
  ' Du kannst das Spiel auch verlassen – dann bekommst du deinen Eintritt zurück.': ' You can also leave the game – then you get your entry fee back.',
  'Keine Verbindung': 'No connection',
  ' zum Gastgeber (seit {s} s)': ' to the host (for {s} s)',
  ' – versuche es erneut …': ' – trying again …',
  ' Verbinde …': ' Connecting …',
  ' Du hast den <b>{place}. Platz</b> belegt': ' You took <b>place {place}</b>',
  ' und {money} gewonnen!': ' and won {money}!',
  'Du bist gerade in einem Raum für {name}.': "You're currently in a room for {name}.",
  'Dorthin wechseln': 'Switch to it',
  'Gegen Computer': 'Vs. computer',
  'Gegner': 'Opponents',
  'Anzahl Gegner': 'Number of opponents',
  'Spiel starten': 'Start game',
  'Mit Freunden spielen': 'Play with friends',
  'Online-Spiele brauchen eine Internetverbindung (PeerJS konnte nicht geladen werden).': 'Online games need an internet connection (PeerJS could not be loaded).',
  'Dein Name am Tisch': 'Your name at the table',
  'Anderes Bild': 'Different picture',
  'Raum eröffnen – Eintritt pro Spieler': 'Open a room – entry fee per player',
  'Eröffnen': 'Open',
  'Raum beitreten': 'Join a room',
  'Beitreten': 'Join',
  'Einsatz (Eintritt)': 'Bet (entry fee)',
  'Preise bei {n} Spielern: {prizes}': 'Prizes with {n} players: {prizes}',
  'Deine Figur änderst du unter 📊 Statistiken → 🎨 Deine Figur.': 'You change your character under 📊 Statistics → 🎨 Your character.',
  'Raum-Code ({name})': 'Room code ({name})',
  'Code kopieren': 'Copy code',
  'Einladungs-Link kopieren': 'Copy invite link',
  'Eintritt': 'Entry',
  'Preise:': 'Prizes:',
  'Suche den Raum …': 'Looking for the room …',
  'Spieler': 'Players',
  'zahlt noch': 'still paying',
  'Gastgeber': 'Host',
  'Du': 'You',
  'Der Gastgeber hat den Eintritt auf <b>{money}</b> festgelegt.': 'The host set the entry fee at <b>{money}</b>.',
  'Eintritt bezahlen und mitspielen': 'Pay entry and join',
  'Dafür hast du nicht genug Dublonen.': "You don't have enough doubloons for that.",
  'Freie Plätze mit Computer-Gegnern auffüllen': 'Fill empty seats with computer opponents',
  '(sie zahlen keinen Eintritt – gewinnen sie einen Preis, behält ihn das Casino)': '(they pay no entry fee – if they win a prize, the casino keeps it)',
  'Warte auf mindestens einen Mitspieler, der den Eintritt bezahlt hat …': 'Waiting for at least one player who has paid the entry fee …',
  'Wer noch nicht bezahlt hat, spielt nicht mit.': "Anyone who hasn't paid won't play.",
  'Alle da? Dann los!': 'Everyone here? Then go!',
  'Als Gastgeber leitest du das Spiel – lass es bitte geöffnet, bis es vorbei ist.': 'As host you run the game – please keep it open until it is over.',
  'Warte, bis der Gastgeber das Spiel startet …': 'Wait for the host to start the game …',
  'Raum schließen': 'Close room',
  'Raum verlassen': 'Leave room',
  'Raum': 'Room',
  '{names} {verb} gerade nicht verbunden – das Spiel wartet. Nach insgesamt {secs} Sekunden ohne Verbindung wird es für alle abgebrochen.': '{names} {verb} currently not connected – the game is waiting. After {secs} seconds in total without a connection it is cancelled for everyone.',
  ' Du bekommst {money} zurück – ein Teil des Topfs war schon ausgezahlt.': ' You get {money} back – part of the pot had already been paid out.',
  'Dein Platz wird gerade bestätigt – einen Moment noch.': 'Your place is being confirmed – just a moment.',
  'Das Spiel wartet, bis alle wieder verbunden sind.': 'The game is waiting until everyone is connected again.',
  'Spiel abgebrochen': 'Game cancelled',
  'sind': 'are',
  'ist': 'is',
  'Du bist raus: <b>{place}. Platz</b>': 'You are out: <b>place {place}</b>',
  ' – {money} gewonnen!': ' – won {money}!',
  ' Du leitest das Spiel weiter, bis es vorbei ist.': ' You keep running the game until it is over.',
  ' Du kannst weiter zuschauen.': ' You can keep watching.',
  'Spiel vorbei!': 'Game over!',
  'Zurück zum Start': 'Back to start',
  'Spiel verlassen': 'Leave game',
  'Zum Kopieren:': 'To copy:',
  'Code kopiert': 'Code copied',
  'Einladungs-Link kopiert': 'Invite link copied',
});

(function () {
  // Eigenes Symbol (js/icons.js); in den Tests ohne Browser gibt es keins
  const ic = name => (GK.icon ? GK.icon(name) : '');

  const PROTOCOL = 3; // 2: geheimes Token je Platz · 3: Plätze werden bestätigt (ack), bevor ein Preis fließt
  const ID_PREFIX = 'gamble-klicker-';
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const CODE_LENGTH = 5;
  const RETRY_DELAY = 3000;
  const CONNECT_TIMEOUT = 10000;
  const ABANDON_AFTER = 30000;
  const DROP_AFTER = 90000;        // so lange ohne Verbindung im laufenden Spiel → Spiel wird für alle abgebrochen
  const HEARTBEAT = 2000;
  const HEARTBEAT_TIMEOUT = 8000;
  const MAX_NAME = GK.player.MAX_NAME;
  const MIN_ENTRY = 100;
  const ENTRY_PRESETS = [1000, 10000, 100000, 1e6, 1e7];
  const AVATARS = GK.player.AVATARS;
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
  const awayMs = new Map(); // Gastgeber: playerId → wie lange insgesamt ohne Verbindung (nur im laufenden Spiel)
  let hostTimer = null;
  let pending = { game: null, code: '' };

  const esc = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- Gespeicherte Daten ----------

  function randomId() {
    return Array.from({ length: 16 }, () => CODE_CHARS[GK.rng.int(CODE_CHARS.length)]).join('');
  }

  function store() {
    // Name und Bild sind spielweit (GK.player), hier nur die Raum-Daten
    return GK.casino.data('room', () => {
      return {
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

  const cleanName = GK.player.cleanName;

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
    if (GK.poker && GK.poker.singleActive && GK.poker.singleActive()) return GK.t('Beende zuerst dein Poker-Turnier.');
    if (GK.poker && GK.poker.mp && GK.poker.mp.active()) return GK.t('Verlasse zuerst deinen Poker-Raum.');
    if (session()) return GK.t('Du bist schon in einem Raum ({name}).', { name: games[session().game] ? GK.t(games[session().game].name) : '' });
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
    if (!s.solo) {
      if (place === 1) GK.state.friendWins = (GK.state.friendWins || 0) + 1;
      // Neue Rekorde an den Gastgeber (der Gastgeber schickt seine eigenen mit dem Spielende)
      if (s.role === 'client') send(net.hostConn, { type: 'records', records: GK.friends.myRecords() });
    }
    setTimeout(() => GK.fx.celebrate(win, s.entry, { level: place === 1 ? 'mega' : undefined, subtitle: GK.t('{place}. Platz – {name}', { place, name: GK.t(d.name) }) }), 600);
  }

  // ---------- Bestätigte Plätze ----------
  // Ein Preis fließt erst, wenn alle, die noch nicht abgerechnet sind, den Spielstand mit diesem Platz gesehen
  // haben (sie antworten auf jeden Spielstand mit { type: 'ack', step }). Sonst könnte jemand die Verbindung
  // trennen, sich nach 30 Sekunden den Eintritt erstatten lassen – und der Sieger bekäme trotzdem den vollen
  // Topf (Geld aus dem Nichts). Gegen Computer gibt es niemanden, der bestätigen müsste.
  function placeConfirmed(s, seat) {
    // Wer selbst gegangen ist (aufgegeben), hat sich schon abgerechnet – auf ihn wartet niemand
    if (s.solo || (s.left && s.left[seat])) return true;
    const at = s.placedAt ? s.placedAt[seat] : null;
    return at != null && at <= (typeof s.confirmed === 'number' ? s.confirmed : -1);
  }

  // Gastgeber: menschliche Mitspieler, deren Platz noch nicht bestätigt ist (auf sie wird gewartet)
  function waitingFor(s) {
    if (!s || s.role !== 'host' || s.solo || !s.state) return [];
    return s.state.players.filter((p, seat) => !p.isBot && p.id !== store().playerId && !placeConfirmed(s, seat));
  }

  // Gastgeber: Fehlt gerade jemand, auf den gewartet wird? Dann steht das Spiel (keine Züge, keine Bedenkzeit).
  function someoneAway(s) {
    return !!s && s.phase === 'playing' && waitingFor(s).some(p => !net.conns.has(p.id));
  }

  // Gastgeber: neue Plätze vormerken und nachsehen, bis zu welchem Schritt alle bestätigt haben.
  // Gibt true zurück, wenn dadurch ein Platz (oder das Spielende) neu bestätigt wurde.
  function updateConfirmed(s) {
    const st = s.state;
    const step = st.step || 0;
    s.placedAt = s.placedAt || {};
    st.players.forEach((p, seat) => {
      if (def().placeOf(st, seat) && s.placedAt[seat] == null) s.placedAt[seat] = step;
    });
    if (s.finishedAt == null && def().finished(st)) s.finishedAt = step;
    const before = typeof s.confirmed === 'number' ? s.confirmed : -1;
    let seen = step;
    waitingFor(s).forEach(p => {
      const conn = net.conns.get(p.id);
      seen = Math.min(seen, conn && typeof conn.ackStep === 'number' ? conn.ackStep : -1);
    });
    s.confirmed = Math.max(before, seen);
    const fresh = at => at != null && at > before && at <= s.confirmed;
    return Object.keys(s.placedAt).some(seat => fresh(s.placedAt[seat])) || fresh(s.finishedAt);
  }

  // Was vom Topf noch da ist (alle echten Eintritte minus schon ausgezahlte Preise) und unter wie vielen
  // Menschen es noch aufzuteilen ist. Der Gastgeber weiß, welche Plätze bestätigt (= ausgezahlt) sind; ein Gast
  // rechnet vorsichtig jeden fremden Platz in seiner Ansicht als ausgezahlt. null: kein laufendes Spiel.
  function potLeft(s) {
    const host = s.role === 'host';
    const view = host ? s.state : s.view;
    if (s.solo || !view || !Array.isArray(view.players) || (s.phase !== 'playing' && s.phase !== 'ended')) return null;
    const d = def();
    const paying = humans(view.players);
    const mine = host ? seatOf(view, store().playerId) : s.mySeat;
    let paid = 0;
    let open = 0;
    view.players.forEach((p, i) => {
      if (p.isBot) return;
      const place = d.placeOf(view, i);
      if (i !== mine && place && (!host || placeConfirmed(s, i))) paid += prize(place, s.entry, view.players.length, false, paying);
      else open++;
    });
    return { left: Math.max(0, s.entry * paying - paid), open: Math.max(1, open) };
  }

  // Erstattung bei einem Abbruch: der Eintritt – aber nie mehr, als nach schon ausgezahlten Preisen noch im
  // Topf ist. Gibt den Text für die Meldung zurück ('' = nichts erstattet).
  function refundEntry() {
    const s = session();
    if (!s || s.settled || !s.paid) return '';
    const pot = potLeft(s);
    const amount = pot ? Math.min(s.entry, Math.floor(pot.left / pot.open)) : s.entry;
    s.settled = true;
    if (amount >= s.entry) {
      s.result = { refunded: true };
      GK.casino.refund(s.entry);
      return GK.t(' Dein Eintritt wurde erstattet.');
    }
    s.result = { refunded: true, prize: amount };
    if (amount > 0) GK.casino.payout(amount);
    GK.casino.record(s.game, s.entry, amount, GK.t('Spiel abgebrochen'));
    return GK.t(' Du bekommst {money} zurück – ein Teil des Topfs war schon ausgezahlt.', { money: GK.formatNumber(amount) });
  }

  function endSession(message, refund) {
    const s = session();
    if (!s) return;
    if (refund) message += refundEntry();
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

  // PeerJS verpackt ganze Zahlen über 2^64 nicht (z. B. „insgesamt verdient“ im späten Spiel) –
  // dann geht die Nachricht als Text (JSON) raus und wird beim Empfang wieder ausgepackt
  function send(conn, msg) {
    if (conn && conn.open) {
      try {
        conn.send(msg);
      } catch (e) {
        try {
          conn.send({ type: 'json', data: JSON.stringify(msg) });
        } catch (e2) {
          console.warn('Senden fehlgeschlagen:', e2);
        }
      }
    }
  }

  // Jede Nachricht eines anderen Geräts wird entschärft (GK.cleanData, js/state.js): Ein manipuliertes Gerät
  // kann so keine HTML-Schnipsel einschleusen, die bei uns in innerHTML landen
  function unpack(msg) {
    if (msg && msg.type === 'json' && typeof msg.data === 'string') {
      try {
        msg = JSON.parse(msg.data);
      } catch (e) {
        return null;
      }
    }
    return GK.cleanData(msg);
  }

  // ========== Gastgeber ==========

  function createRoom(gameId, entry, settings, solo, bots) {
    entry = Math.floor(GK.parseAmount(entry) || 0);
    const d = games[gameId];
    if (entry < MIN_ENTRY) return GK.toast(GK.t('Der Eintritt muss mindestens {amount} Dublonen betragen.', { amount: GK.formatNumber(MIN_ENTRY) }));
    const busy = busyElsewhere();
    if (busy) return GK.toast(busy);
    if (solo && entry > GK.casino.maxBet()) return GK.toast(GK.t('Dein Limit sind {amount} Dublonen – eine bessere VIP-Karte erhöht es.', { amount: GK.formatNumber(GK.casino.maxBet()) }));
    if (!GK.casino.bet(entry)) return GK.toast(GK.t('Nicht genug Dublonen für den Eintritt.'));
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
      members: [{ playerId: me.playerId, name: GK.player.name(), avatar: GK.player.avatar(), fig: GK.figure.mine(), rank: GK.rank.mine(), badge: GK.cosmetics.myBadge(), ready: true }],
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
      onHostMessage(conn, unpack(msg));
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
      // Eine Verbindung gehört genau einem Spieler – sonst könnte eine Verbindung viele „Geister“ anlegen
      if (conn.playerId && conn.playerId !== playerId) return;
      s.secrets = s.secrets || {};
      if ((s.banned || []).includes(playerId)) {
        send(conn, { type: 'error', fatal: true, message: 'Du wurdest aus diesem Raum entfernt.' });
        return;
      }
      let m = member(playerId);
      // Ein vorhandener Platz gehört nur dem, der dessen geheimes Token kennt (bekommt nur dieser Spieler selbst)
      if (m && s.secrets[playerId] && msg.secret !== s.secrets[playerId]) {
        send(conn, { type: 'error', fatal: true, message: 'Dieser Platz gehört schon jemand anderem.' });
        return;
      }
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
      if (s.phase === 'lobby') {
        m.badge = GK.cosmetics.validBadge(msg.badge); // Namensschild aus der Schatzkammer
        m.fig = GK.figure.valid(msg.fig);             // eigene Figur
        m.rank = GK.rank.valid(msg.rank);             // Rang (je 1.000-mal mehr verdient)
      }
      takeRecords(m, msg.records);
      if (msg.paid) m.ready = true;
      const old = net.conns.get(playerId);
      conn.playerId = playerId;
      net.conns.set(playerId, conn);
      if (old && old !== conn) old.close();
      if (!s.secrets[playerId]) s.secrets[playerId] = newSecret();
      send(conn, { type: 'secret', secret: s.secrets[playerId] });
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
    } else if (msg.type === 'ack' && s.phase === 'playing' && s.state) {
      // Der Gast hat den Spielstand bis zu diesem Schritt gesehen (siehe placeConfirmed)
      const step = Math.floor(Number(msg.step));
      if (!(step >= 0)) return;
      conn.ackStep = Math.min(s.state.step || 0, step);
      if (updateConfirmed(s)) afterHostChange();
    } else if (msg.type === 'records') {
      // Neue Rekorde nach dem Spiel (für die Freundes-Rangliste)
      const m = member(conn.playerId);
      if (m && takeRecords(m, msg.records)) {
        GK.save();
        if (s.phase !== 'playing') broadcast();
      }
    } else if (msg.type === 'leave') {
      playerLeft(conn.playerId);
      setTimeout(() => conn.close(), 500);
    }
  }

  // Geheimes Token für einen Platz (nur der Spieler selbst bekommt es)
  function newSecret() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    return Array.from({ length: 24 }, () => chars[GK.rng.int(chars.length)]).join('');
  }

  // Gastgeber entfernt jemanden im Warteraum (z. B. Unbekannte, die den Code erraten haben)
  function kickMember(playerId) {
    const s = session();
    if (!s || s.role !== 'host' || s.phase !== 'lobby' || playerId === store().playerId) return;
    s.members = s.members.filter(m => m.playerId !== playerId);
    if (s.secrets) delete s.secrets[playerId];
    s.banned = (s.banned || []).concat(playerId).slice(-50);
    const conn = net.conns.get(playerId);
    if (conn) {
      send(conn, { type: 'kicked' });
      net.conns.delete(playerId);
      setTimeout(() => conn.close(), 500);
    }
    GK.sound.play('click');
    afterHostChange();
  }

  // Rekorde eines Mitspielers merken und mit dem Raum teilen
  function takeRecords(m, records) {
    const r = GK.friends.clean(records);
    if (!r) return false;
    // Ein Platz bleibt bei einer Ranglisten-ID, und keine ID von jemand anderem im Raum – sonst könnte ein Gast
    // unter vielen (oder fremden) IDs Einträge anlegen bzw. überschreiben
    const s = session();
    if (m.records && m.records.id !== r.id) return false;
    if (s && s.members.some(o => o !== m && o.records && o.records.id === r.id)) return false;
    m.records = r;
    GK.friends.remember(r);
    return true;
  }

  function seatOf(state, playerId) {
    return state ? state.players.findIndex(p => p.id === playerId) : -1;
  }

  function playerAction(seat, action) {
    const s = session();
    const d = def();
    if (!s.state || seat < 0 || !action || typeof action !== 'object') return;
    if (someoneAway(s)) return; // das Spiel wartet auf jemanden ohne Verbindung
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
        s.left = s.left || {};
        s.left[seat] = true;
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
    let seats = ready.map(m => ({ id: m.playerId, name: m.name, avatar: m.avatar, fig: m.fig || '', rank: m.rank || 0, badge: m.badge || '', isBot: false }));
    const bots = s.solo ? botCount : (s.fillBots ? d.maxPlayers - seats.length : 0);
    seats = seats.concat(botSeats(Math.max(0, Math.min(bots, d.maxPlayers - seats.length))));
    s.state = d.create(seats, s.settings || d.settings.defaults);
    // Namensschilder (Schatzkammer) und Figuren an die Spieler hängen – die Spiele kennen sie nicht
    s.state.players.forEach(p => {
      const seat = seats.find(x => x.id === p.id);
      if (seat && seat.badge) p.badge = seat.badge;
      if (seat && seat.fig) p.fig = seat.fig;
      if (seat && seat.rank) p.rank = seat.rank;
    });
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
    if (!s || !s.state || someoneAway(s)) return;
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
      if (!s.solo) updateConfirmed(s);
      const actor = d.actor(st);
      // Was als neuer Zug zählt, kann das Spiel festlegen (sonst jede Aktion) – z. B. darf bei Kniffel das
      // Halten eines Würfels die Bedenkzeit nicht immer wieder neu starten
      const key = d.turnKey ? `${d.turnKey(st)}:${actor}` : `${st.step}:${actor}`;
      if (someoneAway(s)) {
        // Jemand ist ohne Verbindung: Das Spiel wartet. Die Bedenkzeit beginnt neu, wenn alle wieder da sind.
        s.deadline = null;
        s.turnKey = null;
      } else if (key !== s.turnKey) {
        s.turnKey = key;
        const human = actor >= 0 && !st.players[actor].isBot;
        s.deadline = human && !s.solo ? Date.now() + d.turnTime(st) : null;
        // Gemeinsame Zeitgrenze, wenn niemand Bestimmtes am Zug ist (z. B. alle stellen ihre Flotte auf)
        if (actor < 0 && d.phaseDeadline && !s.solo) s.deadline = d.phaseDeadline(st) || null;
      }
      const meSeat = seatOf(st, store().playerId);
      // Eigener Preis und Spielende erst, wenn alle den Platz bzw. das Ende gesehen haben (placeConfirmed)
      const place = d.placeOf(st, meSeat);
      if (place && placeConfirmed(s, meSeat)) settle(place, st, meSeat);
      if (d.finished(st) && (s.solo || (s.finishedAt != null && s.finishedAt <= s.confirmed))) s.phase = 'ended';
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
    if (!s || s.role !== 'host' || s.phase !== 'playing' || someoneAway(s)) return;
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
      // Rekorde für die Freundes-Rangliste nur im Warteraum und am Spielende mitschicken
      members: GK.friends.membersOut(s.members, s.phase !== 'playing', store().playerId,
        m => m.playerId === store().playerId || net.conns.has(m.playerId)),
    };
    if (s.state) {
      const seat = seatOf(s.state, playerId);
      msg.view = def().view(s.state, seat);
      msg.mySeat = seat;
      // step: Der Gast bestätigt ihn mit „ack“. settleOk: Der Platz dieses Spielers ist von allen gesehen worden
      msg.step = s.state.step || 0;
      msg.settleOk = seat >= 0 && placeConfirmed(s, seat);
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
        text = GK.t('Spiel wirklich verlassen? Du belegst damit Platz {place}{rest}', { place, rest: win ? GK.t(' und bekommst {amount} Dublonen.', { amount: GK.formatNumber(win) }) : GK.t(' und gehst leer aus.') });
      }
    } else if (s.phase === 'lobby') {
      text = GK.t('Raum schließen? Alle bekommen ihren Eintritt zurück.');
    } else if (s.phase === 'playing') {
      text = GK.t('Wenn du gehst, gibst du auf und das Spiel endet für alle. Deine Mitspieler bekommen ihren Eintritt zurück und teilen sich deinen.');
    }
    if (text && !confirm(text)) return;
    // Mitten im Spiel gibt der Gastgeber auf: Die Gäste bekommen ihren Eintritt zurück und teilen sich seinen
    // (sonst könnte ein verlierender Gastgeber den Sieg eines Gastes einfach ungültig machen)
    const forfeit = s.phase === 'playing' && meSeat >= 0 && !d.placeOf(st, meSeat);
    if (!s.solo) net.conns.forEach(conn => send(conn, { type: 'closed', reason: forfeit ? 'Der Gastgeber hat aufgegeben.' : 'Der Gastgeber hat den Raum geschlossen.', forfeit }));
    if (forfeit) {
      d.forfeit(st, meSeat);
      // Mit Freunden geht der Gastgeber leer aus (letzter Platz) – der Rest des Topfs gehört den Gästen
      settle(s.solo ? d.placeOf(st, meSeat) || st.players.length : st.players.length, st, meSeat);
    }
    const message = s.phase === 'lobby' ? GK.t('Du hast den Raum geschlossen.') : s.phase === 'ended' ? GK.t('Spiel beendet.') : GK.t('Du hast das Spiel verlassen.');
    // Im Warteraum und bei einem eigenen, noch nicht bestätigten Platz gibt es den Eintritt zurück
    setTimeout(() => endSession(message, s.phase === 'lobby' || s.phase === 'playing'), s.solo ? 0 : 300);
  }

  // ========== Mitspieler ==========

  function joinRoom(gameId, code) {
    code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== CODE_LENGTH) return GK.toast(GK.t('Der Raum-Code hat {n} Zeichen.', { n: CODE_LENGTH }));
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
        endSession(GK.t('Raum {code} nicht gefunden. Stimmt der Code?', { code: s.code }), true);
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
      send(conn, { type: 'hello', v: PROTOCOL, game: s.game, playerId: me.playerId, name: GK.player.name(), avatar: GK.player.avatar(), fig: GK.figure.mine(), rank: GK.rank.mine(), badge: GK.cosmetics.myBadge(), paid: session().paid, secret: session().secret || '', records: GK.friends.myRecords() });
      redraw();
    });
    conn.on('data', msg => {
      conn.lastSeen = Date.now();
      onClientMessage(unpack(msg));
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
      if (msg.fatal) endSession(GK.t(String(msg.message || '')), true);
      else GK.toast(GK.t(String(msg.message || '')));
      return;
    }
    if (msg.type === 'secret') {
      s.secret = String(msg.secret || '').slice(0, 64);
      GK.save();
      return;
    }
    if (msg.type === 'kicked') {
      endSession(GK.t('Der Gastgeber hat dich aus dem Raum entfernt.'), true);
      return;
    }
    if (msg.type === 'closed') {
      if (msg.forfeit && s.phase === 'playing') hostForfeited(GK.t(String(msg.reason || '')));
      else endSession(GK.t(String(msg.reason || '')), true);
      return;
    }
    const entry = Math.floor(Number(msg.entry));
    if (msg.type !== 'state' || msg.game !== s.game || !(entry >= MIN_ENTRY)) return;
    if (!s.paid) {
      // Ändert sich der Eintritt, bevor man bezahlt hat, muss man ihn erst wieder sehen können
      if (s.entry && s.entry !== entry) s.entryChangedAt = Date.now();
      s.entry = entry;
    }
    s.settings = msg.settings || null;
    s.joined = true;
    s.phase = msg.phase;
    s.members = Array.isArray(msg.members) ? msg.members : [];
    GK.friends.learnFrom(s.members);
    s.hostId = msg.hostId;
    s.fillBots = !!msg.fillBots;
    s.view = msg.view || null;
    s.mySeat = typeof msg.mySeat === 'number' ? msg.mySeat : -1;
    s.deadline = typeof msg.turnLeft === 'number' ? Date.now() + msg.turnLeft : null;
    // Den eigenen Preis gibt es erst, wenn alle den Platz gesehen haben (settleOk, siehe placeConfirmed)
    if (s.view && s.mySeat >= 0 && msg.settleOk === true) {
      const place = def().placeOf(s.view, s.mySeat);
      if (place) settle(place, s.view, s.mySeat);
    }
    GK.save();
    // Erst speichern, dann bestätigen: Was bestätigt ist, kennt dieses Gerät auch nach einem Neuladen
    if (s.view && typeof msg.step === 'number') send(net.hostConn, { type: 'ack', step: msg.step });
    redraw();
  }

  // Gastgeber hat mitten im Spiel aufgegeben: Die Gäste teilen sich, was noch im Topf ist (ohne schon
  // ausgezahlte Preise) – also ihren Eintritt plus einen Anteil am Eintritt des Gastgebers
  function hostForfeited(reason) {
    const s = session();
    if (!s || s.settled || !s.paid) {
      endSession(reason, true);
      return;
    }
    const pot = potLeft(s);
    if (!pot) {
      endSession(reason, true);
      return;
    }
    // Der Gastgeber geht leer aus: Was noch im Topf ist, teilen sich die Gäste, die noch nicht abgerechnet sind
    const win = Math.floor(pot.left / Math.max(1, pot.open - 1));
    s.settled = true;
    s.result = { refunded: true, prize: win };
    GK.casino.payout(win);
    GK.casino.record(s.game, s.entry, win, GK.t('Gastgeber hat aufgegeben'));
    endSession(reason + GK.t(' Der Rest des Topfs wird unter den Gästen geteilt, du bekommst {money}.', { money: GK.formatNumber(win) }), false);
  }

  function clientConfirm() {
    const s = session();
    if (!s || s.paid || !s.entry) return;
    if (s.entryChangedAt && Date.now() - s.entryChangedAt < 3000) {
      GK.toast(GK.t('Der Gastgeber hat den Eintritt geändert – prüfe den neuen Betrag.'));
      return;
    }
    if (!GK.casino.bet(s.entry)) {
      GK.sound.play('denied');
      GK.toast(GK.t('Nicht genug Dublonen für den Eintritt.'));
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
      endSession(GK.t('Du hast den Raum verlassen.'), true);
      return;
    }
    if (s.phase === 'playing' && view && s.mySeat >= 0 && !s.settled) {
      const hostGone = net.status === 'lost' && Date.now() - net.lostSince >= ABANDON_AFTER;
      if (hostGone) {
        if (!confirm(GK.t('Der Gastgeber ist nicht mehr erreichbar. Spiel abbrechen? Du bekommst deinen Eintritt zurück.'))) return;
        endSession(GK.t('Spiel abgebrochen.'), true);
        return;
      }
      // Platz steht schon fest, ist aber noch nicht von allen bestätigt: nicht ohne Preis gehen
      if (d.placeOf(view, s.mySeat)) {
        GK.toast(GK.t('Dein Platz wird gerade bestätigt – einen Moment noch.'));
        return;
      }
      const players = view.players.length;
      const place = players - view.players.filter((p, i) => d.placeOf(view, i)).length;
      const win = payoutFor(s, view, s.mySeat, place);
      if (!confirm(GK.t('Spiel wirklich verlassen? Du belegst damit Platz {place}{rest}', { place, rest: win ? GK.t(' und bekommst {amount} Dublonen.', { amount: GK.formatNumber(win) }) : GK.t(' und gehst leer aus.') }))) return;
      send(net.hostConn, { type: 'leave' });
      settle(place, view, s.mySeat);
    }
    setTimeout(() => endSession(GK.t('Du hast den Raum verlassen.'), false), 300);
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
      // War die Seite des Gastgebers eingeschlafen (z. B. iPad gesperrt), zählt diese Zeit nicht als Abwesenheit
      const dt = net.lastBeat && now - net.lastBeat <= 10000 ? now - net.lastBeat : 0;
      net.lastBeat = now;
      dropAbsentPlayers(dt);
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

  // Solange im laufenden Spiel jemand ohne Verbindung ist, wartet das Spiel (someoneAway). Ist jemand insgesamt
  // zu lange weg, wird es für alle abgebrochen und jeder bekommt seinen Eintritt zurück – passend dazu, dass
  // sich ein Gast nach 30 Sekunden ohne Gastgeber selbst erstatten darf. Die Zeit zählt über das ganze Spiel
  // zusammen, damit niemand durch ständiges Trennen und Verbinden endlos Zeit schinden kann.
  // dt: Millisekunden seit dem letzten Herzschlag
  function dropAbsentPlayers(dt) {
    const s = session();
    if (!s || s.role !== 'host' || s.phase !== 'playing' || !s.state) {
      awayMs.clear();
      return;
    }
    // Ist der Gastgeber selbst offline, liegt es an ihm – dann zählt die Zeit für niemanden
    if (!hostOnline()) return;
    let abort = false;
    waitingFor(s).forEach(p => {
      if (net.conns.has(p.id)) return;
      const ms = (awayMs.get(p.id) || 0) + dt;
      awayMs.set(p.id, ms);
      if (ms >= DROP_AFTER) abort = true;
    });
    if (abort) abortForAll();
  }

  // Gastgeber bricht das laufende Spiel ab: alle (auch er selbst) bekommen ihren Eintritt zurück
  function abortForAll() {
    const s = session();
    if (!s || s.role !== 'host') return;
    const reason = 'Ein Mitspieler war zu lange ohne Verbindung – das Spiel wurde abgebrochen.';
    net.conns.forEach(conn => send(conn, { type: 'closed', reason }));
    awayMs.clear();
    setTimeout(() => endSession(GK.t(reason), true), 300);
  }

  // Eigene Aktion: beim Gastgeber direkt anwenden, sonst an den Gastgeber schicken.
  // false = konnte nicht übertragen werden (keine Verbindung) – das Spiel kann seine Anzeige zurücksetzen
  function act(action) {
    const s = session();
    if (!s) return false;
    if (s.role === 'host') {
      if (someoneAway(s)) {
        GK.toast(GK.t('Das Spiel wartet, bis alle wieder verbunden sind.'));
        return false;
      }
      playerAction(seatOf(s.state, store().playerId), action);
      return true;
    }
    if (!net.hostConn || !net.hostConn.open) {
      GK.toast(GK.t('Keine Verbindung zum Gastgeber – versuche es gleich noch einmal.'));
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
    if (!peerAvailable()) return '<span class="mp-status lost">' + ic('dot') + GK.t(' Online-Spiel nicht verfügbar – keine Internetverbindung?') + '</span>';
    if (net.status === 'online') {
      if (s.role === 'host' && net.peer && net.peer.disconnected && !net.peer.destroyed) {
        return '<span class="mp-status connecting">' + ic('dot') + GK.t(' Verbindung zum Server wird erneuert – wer schon im Raum ist, bleibt verbunden …') + '</span>';
      }
      return s.role === 'host' ? '<span class="mp-status online">' + ic('dot') + GK.t(' Raum ist online') + '</span>' : '<span class="mp-status online">' + ic('dot') + GK.t(' Mit dem Gastgeber verbunden') + '</span>';
    }
    if (net.status === 'lost') {
      const ms = net.lostSince ? Date.now() - net.lostSince : 0;
      // Nur wer noch mitspielt (nicht schon ausgeschieden und abgerechnet), bekommt den Eintritt zurück
      const gone = s.role === 'client' && s.phase === 'playing' && !s.settled && ms >= ABANDON_AFTER
        ? GK.t(' Du kannst das Spiel auch verlassen – dann bekommst du deinen Eintritt zurück.') : '';
      return `<span class="mp-status lost">${ic('dot')} ${GK.t('Keine Verbindung')}${s.role === 'client' ? GK.t(' zum Gastgeber (seit {s} s)', { s: Math.floor(ms / 1000) }) : ''}${GK.t(' – versuche es erneut …')}${gone}</span>`;
    }
    return '<span class="mp-status connecting">' + ic('dot') + GK.t(' Verbinde …') + '</span>';
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
      const extra = res && !res.refunded ? GK.t(' Du hast den <b>{place}. Platz</b> belegt', { place: res.place }) + (res.prize ? GK.t(' und {money} gewonnen!', { money: GK.formatMoneyHTML(res.prize) }) : '.') : '';
      resultHtml = `<div class="poker-result ${res && res.prize ? 'win' : ''}">${esc(r.message)}${extra}</div>`;
    }
    const otherRoom = session() && session().game !== gameId
      ? `<p class="warning">${GK.t('Du bist gerade in einem Raum für {name}.', { name: esc(GK.t(games[session().game].name)) })} <button class="btn btn-small room-goto">${GK.t('Dorthin wechseln')}</button></p>` : '';
    const soloBots = me.soloBots[gameId] || Math.min(3, d.maxPlayers - 1);
    container.innerHTML = `
      ${resultHtml}
      ${otherRoom}
      <div class="room-intro">${d.intro || ''}</div>
      ${d.settings.html ? `<div class="room-settings">${d.settings.html(settings)}</div>` : ''}
      <h3 class="poker-section-title">${ic('robot')}${GK.t('Gegen Computer')}</h3>
      <div class="room-solo">
        ${d.maxPlayers > 2 ? `
          <div class="bet-label">${GK.t('Gegner')}</div>
          <div class="room-bots" role="group" aria-label="${GK.t('Anzahl Gegner')}">
            ${Array.from({ length: d.maxPlayers - 1 }, (_, i) => i + 1).map(n => `<button type="button" class="btn btn-small room-bot-count ${n === soloBots ? 'active' : ''}" data-n="${n}">${n}</button>`).join('')}
          </div>` : ''}
        <div class="room-solo-bet"></div>
        <div class="room-solo-prize small"></div>
        <button class="btn btn-primary btn-big room-solo-start">${ic('play')}${GK.t('Spiel starten')}</button>
      </div>
      <h3 class="poker-section-title">${ic('users')}${GK.t('Mit Freunden spielen')}</h3>
      ${peerAvailable() ? '' : `<p class="warning">${GK.t('Online-Spiele brauchen eine Internetverbindung (PeerJS konnte nicht geladen werden).')}</p>`}
      <div class="mp-forms">
        <div class="mp-form">
          <label class="bet-label">${GK.t('Dein Name am Tisch')}</label>
          <div class="bet-row">
            <button type="button" class="btn mp-avatar room-avatar" title="${GK.t('Anderes Bild')}">${GK.figure.avatarHTML()}</button>
            <input class="bet-input mp-name room-name" maxlength="${MAX_NAME}" value="${esc(GK.player.name())}">
          </div>
        </div>
        <div class="mp-form">
          <label class="bet-label">${GK.t('Raum eröffnen – Eintritt pro Spieler')}</label>
          <div class="bet-row">
            <input class="bet-input mp-entry room-entry" ${GK.AMOUNT_INPUT} value="${GK.formatAmount(me.lastEntry)}">
            <button type="button" class="btn btn-primary room-create">${GK.t('Eröffnen')}</button>
          </div>
          <div class="small amount-preview room-entry-preview"></div>
          <div class="bet-row mp-presets">
            ${ENTRY_PRESETS.map(v => `<button type="button" class="btn btn-small room-preset" data-entry="${v}">${GK.formatNumber(v)}</button>`).join('')}
          </div>
        </div>
        <div class="mp-form">
          <label class="bet-label">${GK.t('Raum beitreten')}</label>
          <div class="bet-row">
            <input class="bet-input mp-code-input room-code" maxlength="${CODE_LENGTH}" placeholder="CODE" value="${pending.game === gameId ? esc(pending.code) : ''}" autocomplete="off">
            <button type="button" class="btn btn-primary room-join">${GK.t('Beitreten')}</button>
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
      label: GK.t('Einsatz (Eintritt)'),
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
      container.querySelector('.room-solo-prize').innerHTML = GK.t('Preise bei {n} Spielern: {prizes}', { n, prizes: prizeText(soloEntry, n, true) });
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
      nameInput.value = GK.player.setName(nameInput.value);
    };
    nameInput.addEventListener('change', saveName);
    container.querySelector('.room-avatar').addEventListener('click', e => {
      if (GK.figure.mine()) GK.toast(GK.t('Deine Figur änderst du unter 📊 Statistiken → 🎨 Deine Figur.'));
      else e.currentTarget.textContent = GK.player.nextAvatar();
    });
    const entryInput = container.querySelector('.room-entry');
    const updatePreview = GK.amountPreview(entryInput, container.querySelector('.room-entry-preview'));
    container.querySelectorAll('.room-preset').forEach(btn => btn.addEventListener('click', () => {
      entryInput.value = GK.formatAmount(Number(btn.dataset.entry));
      updatePreview();
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
    // Plätze am Tisch (mit Computer-Gegnern) und echte Spieler, die Eintritt zahlen
    const paying = Math.max(2, members.length);
    const players = isHost || s.phase === 'lobby' ? (d.bots && s.fillBots ? Math.max(d.maxPlayers, paying) : paying) : 0;
    const hostId = isHost ? store().playerId : s.hostId;
    const readyCount = members.filter(m => m.ready).length;
    const mustConfirm = !isHost && !s.paid && s.entry && s.phase === 'lobby';
    container.innerHTML = `
      <div class="mp-room">
        <div class="mp-code-box">
          <div class="muted small">${GK.t('Raum-Code ({name})', { name: esc(GK.t(d.name)) })}</div>
          <div class="mp-code">${s.code}</div>
          ${isHost ? `
            <div class="bet-row">
              <button class="btn btn-small room-copy-code">${ic('copy')}${GK.t('Code kopieren')}</button>
              <button class="btn btn-small room-copy-link">${ic('link')}${GK.t('Einladungs-Link kopieren')}</button>
            </div>` : ''}
        </div>
        ${s.entry ? `<p class="mp-tier-info">${d.icon} <b>${esc(GK.t(d.name))}</b> · ${GK.t('Eintritt')} ${GK.formatMoneyHTML(s.entry)}
          ${d.settingsText && s.settings ? ` · ${d.settingsText(s.settings)}` : ''}<br>${GK.t('Preise:')} ${players ? prizeText(s.entry, players, false, paying) : ''}</p>` : ''}
        ${s.phase === 'connecting' ? `<p class="muted">${GK.t('Suche den Raum …')}</p>` : `
          <h3>${GK.t('Spieler')} (${members.length}/${d.maxPlayers})</h3>
          <ul class="mp-members">
            ${members.map(m => `<li class="${m.ready ? '' : 'not-ready'}">
              <span>${GK.cosmetics.nameTag(m)}</span>
              ${m.ready ? '' : `<span class="mp-tag waiting">${ic('hourglass')} ${GK.t('zahlt noch')}</span>`}
              ${m.playerId === hostId ? `<span class="mp-tag">${ic('crown')} ${GK.t('Gastgeber')}</span>` : ''}
              ${m.playerId === store().playerId ? `<span class="mp-tag">${GK.t('Du')}</span>` : ''}
              ${isHost && s.phase === 'lobby' && m.playerId !== store().playerId
                ? `<button type="button" class="btn btn-small mp-kick" data-kick="${esc(m.playerId)}" aria-label="${GK.t('Entfernen')}" title="${GK.t('Entfernen')}">✕</button>` : ''}
            </li>`).join('')}
          </ul>
          ${mustConfirm ? `
            <div class="mp-confirm">
              <p>${GK.t('Der Gastgeber hat den Eintritt auf <b>{money}</b> festgelegt.', { money: GK.formatMoneyHTML(s.entry) })}</p>
              <button class="btn btn-primary btn-big room-confirm" ${GK.canAfford(s.entry) ? '' : 'disabled'}>${ic('bag')}${GK.t('Eintritt bezahlen und mitspielen')}</button>
              ${GK.canAfford(s.entry) ? '' : `<p class="loss small">${GK.t('Dafür hast du nicht genug Dublonen.')}</p>`}
            </div>` : ''}
          ${isHost ? `
            ${d.bots ? `<label class="mp-check"><input type="checkbox" class="room-fill" ${s.fillBots ? 'checked' : ''}> ${GK.t('Freie Plätze mit Computer-Gegnern auffüllen')}
              <span class="muted small">${GK.t('(sie zahlen keinen Eintritt – gewinnen sie einen Preis, behält ihn das Casino)')}</span></label>` : ''}
            <div class="game-actions">
              <button class="btn btn-primary btn-big room-start" ${readyCount < 2 ? 'disabled' : ''}>▶ ${GK.t('Spiel starten')}</button>
            </div>
            <p class="muted small">${readyCount < 2 ? GK.t('Warte auf mindestens einen Mitspieler, der den Eintritt bezahlt hat …')
              : readyCount < members.length ? GK.t('Wer noch nicht bezahlt hat, spielt nicht mit.') : GK.t('Alle da? Dann los!')}
              ${GK.t('Als Gastgeber leitest du das Spiel – lass es bitte geöffnet, bis es vorbei ist.')}</p>`
            : s.paid ? `<p class="muted">${GK.t('Warte, bis der Gastgeber das Spiel startet …')}</p>` : ''}
        `}
        <p>${statusLine()}</p>
        <button class="btn btn-danger room-leave">${isHost ? GK.t('Raum schließen') : GK.t('Raum verlassen')}</button>
      </div>`;
    container.querySelector('.room-leave').addEventListener('click', () => (isHost ? hostLeave() : clientLeave()));
    const confirmBtn = container.querySelector('.room-confirm');
    if (confirmBtn) confirmBtn.addEventListener('click', clientConfirm);
    container.querySelectorAll('.mp-kick').forEach(btn => btn.addEventListener('click', () => kickMember(btn.dataset.kick)));
    if (isHost && s.phase === 'lobby') {
      const fill = container.querySelector('.room-fill');
      if (fill) fill.addEventListener('change', e => {
        s.fillBots = e.target.checked;
        afterHostChange();
      });
      container.querySelector('.room-start').addEventListener('click', () => startGame());
      container.querySelector('.room-copy-code').addEventListener('click', () => copyText(s.code, GK.t('Code kopiert')));
      container.querySelector('.room-copy-link').addEventListener('click', () => copyText(inviteLink(s), GK.t('Einladungs-Link kopiert')));
    }
  }

  function copyText(text, done) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => GK.toast(done + ' ✅'), () => prompt(GK.t('Zum Kopieren:'), text));
    } else {
      prompt(GK.t('Zum Kopieren:'), text);
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
      s.solo ? `${ic('robot')} ${GK.t('Gegen Computer')}` : `${ic('users')} ${GK.t('Raum')} ${s.code}`,
      d.settingsText && s.settings ? d.settingsText(s.settings) : '',
      `${GK.t('Eintritt')} ${GK.formatMoneyHTML(s.entry)}`,
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
        notices.push(`${ic('warning')} ${GK.t('{names} {verb} gerade nicht verbunden – das Spiel wartet. Nach insgesamt {secs} Sekunden ohne Verbindung wird es für alle abgebrochen.', { names: away.join(', '), verb: away.length > 1 ? GK.t('sind') : GK.t('ist'), secs: DROP_AFTER / 1000 })}`);
      }
    }
    if (s.result && !s.result.refunded && s.phase !== 'ended') {
      notices.push(GK.t('Du bist raus: <b>{place}. Platz</b>', { place: s.result.place }) + (s.result.prize ? GK.t(' – {money} gewonnen!', { money: GK.formatMoneyHTML(s.result.prize) }) : '.') +
        (isHost && !s.solo ? GK.t(' Du leitest das Spiel weiter, bis es vorbei ist.') : GK.t(' Du kannst weiter zuschauen.')));
    }
    if (s.phase === 'ended') {
      const ranking = view.players.map((p, i) => ({ p, place: d.placeOf(view, i) })).sort((a, b) => a.place - b.place)
        .map(({ p, place }) => `${place}. ${GK.cosmetics.nameTag(p)}`).join(' · ');
      notices.push(`${ic('flag')} ${GK.t('Spiel vorbei!')} ${ranking}`);
    }
    const notice = container.querySelector('.room-notice');
    setHtml(notice, notices.join('<br>'));
    notice.hidden = !notices.length;
    const leaveLabel = s.phase === 'ended' ? GK.t('Zurück zum Start') : myPlace || mySeat < 0 ? GK.t('Raum verlassen') : GK.t('Spiel verlassen');
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
    GK.setHTML(el, secs >= 0 ? `${ic('hourglass')} ${secs} s` : '');
    el.classList.toggle('urgent', secs >= 0 && secs <= 5);
  }

  // ---------- Anmeldung der Spiele im Casino ----------

  function registerGame(d) {
    games[d.id] = d;
    GK.casino.register({
      id: d.id,
      category: 'friends',
      name: GK.t(d.name),
      emoji: d.icon,
      desc: GK.t(d.desc),
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
    createRoom, joinRoom, startGame, act, clientConfirm, clientLeave, hostLeave, heartbeat, // für Tests
    _net: net, // für Tests
  };
})();
