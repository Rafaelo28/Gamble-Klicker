// Tests für Spielräume über ein nachgebautes Netz: Ein Gastgeber und seine Gäste laufen als getrennte „Geräte“
// (je ein eigener Spielstand) und reden über ein nachgebautes PeerJS miteinander. Geprüft wird vor allem, dass
// durch Verbindungsabbrüche kein Geld aus dem Nichts entsteht (docs/EXPLOITS.md, Befund 6):
// Plätze werden bestätigt, bevor ein Preis fließt; das Spiel wartet, solange jemand fehlt; Erstattungen
// berücksichtigen schon ausgezahlte Preise. Ausführen mit: node tests/room-net.test.js
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const R = path.join(__dirname, '..', 'js') + '/';
const assert = (cond, msg) => { if (!cond) { console.log('FAIL', msg); process.exitCode = 1; } };

// ---------- Nachgebaute Zeit: Uhr und Timer laufen nur, wenn der Test sie weiterdreht ----------
const clock = { now: 1e12, timers: [], seq: 0 };
function addTimer(fn, ms, every) {
  const t = { id: ++clock.seq, at: clock.now + Math.max(0, ms || 0), fn, every };
  clock.timers.push(t);
  return t.id;
}
const clearTimer = id => { clock.timers = clock.timers.filter(t => t.id !== (id && id.id ? id.id : id)); };
function advance(ms) {
  const end = clock.now + ms;
  for (;;) {
    const due = clock.timers.filter(t => t.at <= end).sort((a, b) => a.at - b.at || a.id - b.id)[0];
    if (!due) break;
    clock.now = Math.max(clock.now, due.at);
    if (due.every) due.at = clock.now + due.every;
    else clock.timers = clock.timers.filter(t => t !== due);
    due.fn();
  }
  clock.now = end;
}

// ---------- Nachgebautes PeerJS ----------
let hub = new Map();
let peerSeq = 0;
class Emitter {
  constructor() { this.h = {}; }
  on(ev, fn) { (this.h[ev] = this.h[ev] || []).push(fn); }
  emit(ev, arg) { (this.h[ev] || []).slice().forEach(fn => fn(arg)); }
}
class Conn extends Emitter {
  constructor(owner) { super(); this.owner = owner; this.open = false; }
  send(msg) {
    const o = this.other;
    if (!this.open || this.owner.offline || o.owner.offline) return;
    const copy = JSON.parse(JSON.stringify(msg));
    addTimer(() => { if (o.open && !o.owner.offline && !this.owner.offline) o.emit('data', copy); }, 0);
  }
  close() {
    if (!this.open) return;
    this.open = false;
    this.emit('close');
    const o = this.other;
    addTimer(() => { if (o.open && !o.owner.offline) { o.open = false; o.emit('close'); } }, 0);
  }
}
class Peer extends Emitter {
  constructor(id) {
    super();
    this.id = typeof id === 'string' ? id : 'peer' + (++peerSeq);
    this.destroyed = false;
    this.disconnected = false;
    this.offline = false; // „WLAN aus“: nichts kommt mehr an oder geht hinaus, ohne dass es jemand sofort merkt
    hub.set(this.id, this);
    addTimer(() => { if (!this.destroyed) this.emit('open', this.id); }, 0);
  }
  connect(id) {
    const a = new Conn(this);
    addTimer(() => {
      const target = hub.get(id);
      if (this.destroyed || this.offline) return;
      if (!target || target.destroyed || target.offline) {
        this.emit('error', { type: 'peer-unavailable' });
        return;
      }
      const b = new Conn(target);
      a.other = b;
      b.other = a;
      target.emit('connection', b);
      a.open = b.open = true;
      b.emit('open');
      a.emit('open');
    }, 0);
    a.other = { open: false, owner: this, emit() {} };
    return a;
  }
  reconnect() {}
  destroy() {
    this.destroyed = true;
    if (hub.get(this.id) === this) hub.delete(this.id);
  }
}

// ---------- Ein Gerät: eigener Spielstand, eigenes GK ----------
function device(name, money) {
  const ctx = vm.createContext({ console, crypto: globalThis.crypto, TextEncoder, TextDecoder });
  const g = vm.runInContext('this', ctx);
  g.window = g;
  const el = () => ({ innerHTML: '', textContent: '', hidden: false, style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, appendChild() {} });
  g.document = { addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, getElementById: el, createElement: el };
  g.location = { search: '', pathname: '/', origin: '', hash: '' };
  g.history = { replaceState() {} };
  g.navigator = { onLine: true };
  g.confirm = () => true;
  g.performance = { now: () => clock.now };
  g.setTimeout = (fn, ms) => addTimer(fn, ms);
  g.clearTimeout = clearTimer;
  g.setInterval = (fn, ms) => addTimer(fn, ms, ms);
  g.clearInterval = clearTimer;
  // „WLAN aus“ gilt für das ganze Gerät, auch für Verbindungen, die es danach neu aufbaut
  const wifi = { off: false };
  g.Peer = class extends Peer {
    get offline() { return wifi.off; }
    set offline(v) {}
  };
  vm.runInContext('Date.now = () => __now()', Object.assign(ctx, { __now: () => clock.now }));
  ['format.js', 'savecode.js', 'state.js', 'casino/casino.js', 'casino/cards.js'].forEach(f => vm.runInContext(fs.readFileSync(R + f, 'utf8'), ctx, { filename: f }));
  const GK = g.GK;
  GK.toast = () => {};
  GK.poker = { tournament: { TIERS: [] } };
  GK.sound = { play() {} };
  GK.fx = { celebrate() {} };
  GK.unlockAchievement = () => {};
  GK.figure = { mine: () => '', valid: () => '' };
  GK.rank = { mine: () => 0, valid: () => 0 };
  GK.cosmetics = { myBadge: () => '', validBadge: () => '', nameTag: p => p.name };
  GK.friends = {
    myRecords: () => null, clean: () => null, remember() {}, learnFrom() {},
    membersOut: (members, share, me, online) => members.map(m => Object.assign({}, m, { online: online(m) })),
  };
  vm.runInContext(fs.readFileSync(R + 'mp/room.js', 'utf8'), ctx, { filename: 'room.js' });
  // Ein ganz einfaches Spiel: Wer „win“ schickt, bekommt den nächsten freien Platz von oben; wer aufgibt, den
  // nächsten von unten. Bleibt einer übrig, bekommt er den letzten freien Platz.
  const lastOne = st => {
    const open = st.players.filter(p => !p.place);
    if (open.length === 1) open[0].place = st.top++;
  };
  GK.room.registerGame({
    id: 'test', name: 'Test', icon: '🧪', desc: 'Test', minPlayers: 2, maxPlayers: 4, settings: { defaults: {} },
    create: seats => ({ players: seats.map(s => Object.assign({}, s, { place: null })), top: 1, bottom: seats.length, moves: 0 }),
    actor: st => st.players.findIndex(p => !p.place),
    canAct: (st, seat) => !st.players[seat].place,
    act(st, seat, a) {
      if (a.type === 'win') { st.players[seat].place = st.top++; lastOne(st); return true; }
      if (a.type === 'move') { st.moves++; return true; }
      return false;
    },
    timeout: () => ({ type: 'move' }),
    botAct: () => ({ type: 'move' }),
    forfeit(st, seat) { if (!st.players[seat].place) { st.players[seat].place = st.bottom--; lastOne(st); } },
    placeOf: (st, seat) => (seat >= 0 && st.players[seat] ? st.players[seat].place : null),
    finished: st => st.players.every(p => p.place),
    view: st => JSON.parse(JSON.stringify(st)),
    draw() {}, turnTime: () => 45000, autoDelay: () => null, advance() {},
  });
  // Poker mit Freunden (eigener Raum-Code in js/poker/multiplayer.js, gleiche Regeln für Bestätigung und Abbruch)
  ['evaluator', 'engine', 'ai', 'tournament', 'multiplayer'].forEach(f => vm.runInContext(fs.readFileSync(R + 'poker/' + f + '.js', 'utf8'), ctx, { filename: f + '.js' }));
  Object.assign(GK.poker, { redraw() {}, singleActive: () => false, fullHouseOrBetter: () => false });
  GK.state.money = money;
  const room = () => GK.state.casino.games.room;
  return {
    pokerSession: () => GK.state.casino.games.pokerMp.session,
    name, GK, room,
    session: () => room().session,
    money: () => GK.state.money,
    peer: () => GK.room._net.peer,
    offline(flag) { wifi.off = flag; },
  };
}

const E = 1000;
const START = 10000;

// Raum mit n Geräten aufbauen und das Spiel starten
function setup(n) {
  hub = new Map();
  clock.timers = [];
  const devs = Array.from({ length: n }, (_, i) => device('D' + i, START));
  const host = devs[0];
  host.GK.room.createRoom('test', E, {}, false);
  advance(50);
  const code = host.session().code;
  devs.slice(1).forEach(d => {
    d.GK.room.joinRoom('test', code);
    advance(50);
    d.GK.room.clientConfirm();
    advance(50);
  });
  host.session().fillBots = false;
  host.GK.room.startGame();
  advance(50);
  return devs;
}
const total = devs => devs.reduce((sum, d) => sum + d.money(), 0);
const act = (d, type) => { d.GK.room.act({ type }); advance(50); };

// ---------- Normales Spiel: Preise stimmen, Geld bleibt gleich ----------
{
  const [a, b] = setup(2);
  assert(a.session().phase === 'playing' && b.session().phase === 'playing' && b.session().view, 'Spiel läuft bei beiden');
  assert(a.money() === START - E && b.money() === START - E, 'Beide haben den Eintritt bezahlt');
  act(b, 'move');
  assert(a.session().state.moves === 1, 'Zug des Gastes kommt beim Gastgeber an');
  act(a, 'win');
  assert(a.session().phase === 'ended' && b.session().phase === 'ended', 'Spiel ist bei beiden vorbei');
  assert(a.money() === START + E && b.money() === START - E, 'Sieger bekommt den Topf, Verlierer nichts');
  assert(total([a, b]) === 2 * START, 'Geld bleibt gleich');
}
{
  const [a, b, c] = setup(3);
  act(c, 'win');
  assert(c.money() === START - E + Math.floor(3 * E * 0.7), 'Erster von dreien bekommt 70 % sofort (alle haben es gesehen)');
  assert(a.session().phase === 'playing', 'Die anderen spielen weiter');
  act(a, 'win');
  assert(total([a, b, c]) === 3 * START && a.session().phase === 'ended', 'Drei Spieler: Geld bleibt gleich');
}

// ---------- Befund 6: Gast trennt die Verbindung, Gastgeber gewinnt sofort ----------
// Früher: Der Gastgeber bekam den Topf, der Gast erstattete sich nach 30 Sekunden selbst – Geld aus dem Nichts.
{
  const [a, b] = setup(2);
  b.offline(true);            // WLAN aus – der Gastgeber merkt es erst nach 8 Sekunden
  act(a, 'win');              // Gastgeber gewinnt in genau diesem Augenblick
  assert(a.session() && !a.session().settled && a.money() === START - E, 'Gastgeber bekommt den Topf nicht, solange der Gast den Sieg nicht gesehen hat');
  advance(45000);
  assert(b.session() && !b.session().settled, 'Gast ist noch nicht abgerechnet');
  b.GK.room.clientLeave();    // „Der Gastgeber ist nicht mehr erreichbar … Eintritt zurück“
  advance(500);
  assert(!b.session() && b.money() === START, 'Gast hat sich den Eintritt erstattet');
  advance(100000);
  assert(!a.session() && a.money() === START, 'Gastgeber: Spiel abgebrochen, Eintritt zurück – kein Topf');
  assert(total([a, b]) === 2 * START, 'Kein Geld aus dem Nichts (Gast trennt, Gastgeber gewinnt)');
}

// ---------- Solange jemand fehlt, wartet das Spiel; kommt er zurück, geht es weiter ----------
{
  const [a, b] = setup(2);
  act(a, 'move');
  b.offline(true);
  advance(12000);             // Herzschlag: Gastgeber merkt, dass der Gast fehlt
  assert(!a.GK.room._net.conns.size, 'Gastgeber hat die Verbindung des Gastes aufgegeben');
  const moves = a.session().state.moves;
  act(a, 'win');
  advance(20000);             // früher hätte der Gast alle 5 Sekunden automatisch gezogen
  assert(a.session().state.moves === moves && !a.session().state.players.some(p => p.place), 'Keine Züge, solange jemand fehlt');
  assert(a.session().deadline === null, 'Keine Bedenkzeit, solange jemand fehlt');
  b.offline(false);
  advance(8000);              // Gast verbindet sich neu
  assert(a.GK.room._net.conns.size === 1 && a.session().deadline > clock.now, 'Gast ist zurück, die Bedenkzeit läuft neu');
  act(b, 'win');
  assert(a.session().phase === 'ended' && b.money() === START + E && a.money() === START - E, 'Nach der Rückkehr geht das Spiel normal zu Ende');
  assert(total([a, b]) === 2 * START, 'Geld bleibt gleich (kurze Abwesenheit)');
}

// ---------- Abwesenheit zählt zusammen: ständiges Trennen und Verbinden schindet keine Zeit ----------
{
  const [a, b] = setup(2);
  for (let i = 0; i < 6 && a.session(); i++) {
    b.offline(true);
    advance(30000);
    b.offline(false);
    advance(8000);
  }
  assert(!a.session() && a.money() === START, 'Nach insgesamt über 90 Sekunden Abwesenheit bricht der Gastgeber ab');
  // Der Gast war beim Abbruch gerade weg: Er findet den Raum nicht mehr und erstattet sich selbst
  b.offline(false);
  advance(45000);
  b.GK.room.clientLeave();
  advance(500);
  assert(!b.session() && b.money() === START, 'Der Gast bekommt nach dem Abbruch seinen Eintritt zurück');
}

// ---------- Gastgeber verschwindet und kommt wieder: Er gewinnt nicht gegen Abwesende ----------
{
  const [a, b] = setup(2);
  a.offline(true);
  advance(40000);
  b.GK.room.clientLeave();
  advance(500);
  assert(b.money() === START, 'Gast hat sich nach 30 Sekunden ohne Gastgeber erstattet');
  a.offline(false);
  act(a, 'win');
  advance(120000);
  assert(!a.session() && a.money() === START, 'Gastgeber bekommt nur seinen Eintritt zurück');
  assert(total([a, b]) === 2 * START, 'Kein Geld aus dem Nichts (Gastgeber verschwindet)');
}

// ---------- Drei Spieler: Nach einem ausgezahlten Preis gibt es nur noch den Rest des Topfs zurück ----------
{
  const [a, b, c] = setup(3);
  act(c, 'win');              // C wird Erster und bekommt 2.100 von 3.000
  b.offline(true);
  advance(45000);
  b.GK.room.clientLeave();
  advance(500);
  const rest = Math.floor((3 * E - Math.floor(3 * E * 0.7)) / 2);
  assert(b.money() === START - E + rest, 'Gast bekommt nur seinen Anteil am Rest des Topfs (' + rest + ')');
  advance(100000);
  assert(!a.session() && a.money() === START - E + rest, 'Gastgeber bekommt beim Abbruch denselben Anteil');
  assert(total([a, b, c]) <= 3 * START, 'Kein Geld aus dem Nichts (Abbruch nach ausgezahltem Preis)');
}

// ---------- Drei Spieler: Ein Sieg, den nicht alle gesehen haben, wird nicht ausgezahlt ----------
{
  const [a, b, c] = setup(3);
  b.offline(true);
  act(c, 'win');
  assert(!c.session().settled && c.money() === START - E, 'Kein Preis, solange B den Sieg nicht gesehen hat');
  advance(45000);
  b.GK.room.clientLeave();
  advance(120000);
  assert(a.money() === START && b.money() === START && c.money() === START, 'Abbruch: alle drei bekommen ihren Eintritt zurück');
}

// ---------- Gastgeber gibt auf: Die Gäste teilen sich, was im Topf ist ----------
{
  const [a, b, c] = setup(3);
  a.GK.room.hostLeave();
  advance(1000);
  assert(a.money() === START - E, 'Gastgeber verliert seinen Eintritt');
  assert(b.money() === START + E / 2 && c.money() === START + E / 2, 'Gäste: Eintritt zurück plus halber Eintritt des Gastgebers');
  assert(total([a, b, c]) === 3 * START, 'Geld bleibt gleich (Gastgeber gibt auf)');
}
{
  const [a, b, c] = setup(3);
  act(c, 'win');
  a.GK.room.hostLeave();
  advance(1000);
  assert(b.money() === START - E + (3 * E - Math.floor(3 * E * 0.7)), 'Nach einem ausgezahlten Preis bekommt der letzte Gast nur den Rest');
  assert(total([a, b, c]) === 3 * START, 'Geld bleibt gleich (Gastgeber gibt nach ausgezahltem Preis auf)');
}

// ---------- Gast gibt auf: wie bisher ----------
{
  const [a, b] = setup(2);
  b.GK.room.clientLeave();
  advance(1000);
  assert(a.money() === START + E && b.money() === START - E && a.session().phase === 'ended', 'Gast gibt auf: Gastgeber gewinnt den Topf');
}

// ========== Poker mit Freunden ==========
function setupPoker(n) {
  hub = new Map();
  clock.timers = [];
  const devs = Array.from({ length: n }, (_, i) => device('P' + i, START));
  const host = devs[0];
  host.GK.poker.mp.createRoom(E, 'classic');
  advance(50);
  const code = host.pokerSession().code;
  devs.slice(1).forEach(d => {
    d.GK.poker.mp.joinRoom(code);
    advance(50);
    d.GK.poker.mp.clientConfirm();
    advance(50);
  });
  host.pokerSession().fillBots = false;
  host.GK.poker.mp.startGame();
  advance(50);
  return devs;
}

// Gast gibt auf: Der Gastgeber gewinnt den Topf (der Gast hat sich selbst abgerechnet, auf ihn wartet niemand)
{
  const [a, b] = setupPoker(2);
  assert(a.pokerSession().phase === 'playing' && b.pokerSession().view && a.money() === START - E && b.money() === START - E, 'Poker: Turnier läuft, beide haben bezahlt');
  b.GK.poker.mp.clientLeave();
  advance(1000);
  assert(a.pokerSession().phase === 'ended' && a.money() === START + E && b.money() === START - E, 'Poker: Gast gibt auf, Gastgeber gewinnt den Topf');
}

// Gast trennt die Verbindung: Das Turnier wartet (früher passte er alle 5 Sekunden automatisch und verlor),
// er erstattet sich selbst, der Gastgeber bricht ab – niemand gewinnt etwas
{
  const [a, b] = setupPoker(2);
  b.offline(true);
  advance(12000);
  const hand = a.pokerSession().table.handNo;
  const log = a.pokerSession().table.log.length;
  advance(33000);
  assert(a.pokerSession().table.handNo === hand && a.pokerSession().table.log.length === log && a.pokerSession().deadline === null, 'Poker: keine Züge, solange jemand fehlt');
  b.GK.poker.mp.clientLeave();
  advance(500);
  assert(!b.pokerSession() && b.money() === START, 'Poker: Gast hat sich den Eintritt erstattet');
  advance(100000);
  assert(!a.pokerSession() && a.money() === START, 'Poker: Gastgeber bricht ab und bekommt nur seinen Eintritt zurück');
  assert(total([a, b]) === 2 * START, 'Poker: kein Geld aus dem Nichts');
}

// Gastgeber gibt auf: Die Gäste teilen sich den Topf, der Gastgeber geht leer aus
{
  const [a, b, c] = setupPoker(3);
  a.GK.poker.mp.hostLeave();
  advance(1000);
  assert(a.money() === START - E && b.money() === START + E / 2 && c.money() === START + E / 2, 'Poker: Gastgeber gibt auf, Gäste teilen sich seinen Eintritt');
  assert(total([a, b, c]) === 3 * START, 'Poker: Geld bleibt gleich (Gastgeber gibt auf)');
}

console.log(process.exitCode ? 'Raum-Netz-Tests FEHLGESCHLAGEN' : 'Raum-Netz-Tests bestanden.');
