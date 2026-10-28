// Tests für den Kraken-Angriff im Klicker und die Freundes-Rangliste.
// Ausführen mit: node tests/kraken.test.js
global.window = global;
global.document = { addEventListener() {}, querySelector() { return null; }, visibilityState: 'visible' };
global.location = { search: '', pathname: '/', origin: '', hash: '' };
global.history = { replaceState() {} };
const R = require('path').join(__dirname, '..', 'js') + '/';
require(R + 'state.js');
require(R + 'casino/casino.js');
require(R + 'progress.js');
require(R + 'clicker.js');
require(R + 'cosmetics.js');
require(R + 'kraken.js');
require(R + 'friends.js');
const assert = (cond, msg) => { if (!cond) { console.log('FAIL', msg); process.exitCode = 1; } };
const K = GK.kraken;
const F = GK.friends;
const total = () => Object.values(GK.state.buildings).reduce((s, n) => s + n, 0);

// ---------- Kraken: Grundregeln ----------
{
  assert(K.stealAmount(0) === 0 && K.stealAmount(1) === 1 && K.stealAmount(9) === 1 && K.stealAmount(10) === 1 && K.stealAmount(11) === 2 && K.stealAmount(250) === 25,
    'Kraken nimmt 10 % je Arm, mindestens eins');
  assert(K.releasedCount(30, 30, 3) === 0 && K.releasedCount(20, 30, 3) === 1 && K.releasedCount(11, 30, 3) === 1 && K.releasedCount(10, 30, 3) === 2 && K.releasedCount(0, 30, 3) === 3,
    'Je ein Drittel Kraft lässt ein Arm los');
  assert(K.releasedCount(1, 30, 1) === 0 && K.releasedCount(0, 30, 1) === 1, 'Ein Arm: lässt erst am Ende los');
  GK.state.buildings = { finger: 40, piggy: 12, lemonade: 3 };
  for (let i = 0; i < 50; i++) {
    const arms = K.pickArms();
    assert(arms.length === 3 && new Set(arms.map(a => a.id)).size === 3 && arms.every(a => a.held), 'Drei verschiedene Gebäude im Griff');
  }
  GK.state.buildings = { finger: 40 };
  assert(K.pickArms().length === 1, 'Nur eine Sorte: ein Arm');
  GK.state.buildings = {};
  assert(K.pickArms().length === 0 && K.begin() === false, 'Ohne Gebäude kein Angriff');
}

// Bis der Kraken auftaucht (oder wieder abtaucht) weiterspulen
function untilUp(up) {
  for (let i = 0; i < 200 && GK.state.kraken.attack && GK.state.kraken.attack.up !== up; i++) K.advance(0.05);
}

// ---------- Kraken: abgewehrt ----------
{
  GK.state.buildings = { finger: 40, piggy: 12, lemonade: 3 };
  GK.state.money = 0;
  assert(K.begin() && GK.state.kraken.attack, 'Angriff beginnt');
  const a = GK.state.kraken.attack;
  assert(!a.up && a.hp === K.HP, 'Zu Beginn ist er noch abgetaucht');
  assert(K.hit().missed && a.hp === K.HP, 'Treffer unter Wasser zählen nicht');
  let freed = [];
  let res = null;
  for (let i = 0; i < 400 && GK.state.kraken.attack; i++) {
    untilUp(true);
    res = K.hit();
    if (res && res.freed) freed = freed.concat(res.freed);
  }
  assert(res && res.defeated && res.loot > 0, 'Kraken geschlagen, mit Beute');
  assert(GK.state.money === res.loot, 'Beute gutgeschrieben');
  assert(freed.length === 3 && new Set(freed).size === 3, 'Alle drei Gebäude gerettet');
  assert(total() === 55 && GK.state.kraken.defeated === 1 && !GK.state.kraken.attack, 'Keine Gebäude verloren');
  assert(GK.state.kraken.next >= 12 * 60 && GK.state.kraken.clock === 0, 'Nächster Angriff frühestens in 12 Minuten');
}

// ---------- Kraken: entkommen ----------
{
  GK.state.buildings = { finger: 40, piggy: 12, lemonade: 3 };
  K.begin();
  const arms = GK.state.kraken.attack.arms.map(x => x.id);
  let res = null;
  for (let t = 0; t < K.DURATION + 1 && !res; t += 0.05) {
    const r = K.advance(0.05);
    if (r && r.escaped) res = r;
  }
  const expected = { finger: 4, piggy: 2, lemonade: 1 };
  assert(res && res.total === 7 && res.stolen.length === 3, `Ohne Gegenwehr: 7 Gebäude weg (${res && res.total})`);
  arms.forEach(id => assert(GK.state.buildings[id] === { finger: 40, piggy: 12, lemonade: 3 }[id] - expected[id], `${id}: richtig viele gestohlen`));
  assert(GK.state.kraken.escaped === 1 && GK.state.kraken.stolen === 7 && !GK.state.kraken.attack, 'Statistik: entkommen');
  assert(K.hit() === null, 'Nach dem Angriff gibt es nichts mehr zu treffen');
}

// ---------- Kraken: teilweise abgewehrt ----------
{
  GK.state.buildings = { finger: 100, piggy: 100, lemonade: 100 };
  K.begin();
  const a = GK.state.kraken.attack;
  // Genau 10 Treffer: ein Arm lässt los, zwei stehlen
  let hits = 0;
  while (hits < 10) {
    untilUp(true);
    if (K.hit().freed) hits++;
  }
  const freedId = a.arms.find(x => !x.held).id;
  let res = null;
  while (!res) {
    const r = K.advance(0.1);
    if (r && r.escaped) res = r;
  }
  assert(res.total === 20 && res.stolen.length === 2 && GK.state.buildings[freedId] === 100, 'Teilweise abgewehrt: das gerettete Gebäude bleibt');
}

// ---------- Kraken: Zeitplan und Einstellung ----------
{
  GK.state.kraken = { clock: 0, next: 0, attack: null, defeated: 0, escaped: 0, stolen: 0 };
  GK.state.buildings = { finger: 5 };
  GK.state.ui.tab = 'clicker';
  K.update(100);
  assert(!GK.state.kraken.attack && GK.state.kraken.clock === 0, 'Unter 15 Gebäuden greift er nicht an');
  GK.state.buildings = { finger: 30 };
  K.update(1);
  const next = GK.state.kraken.next;
  assert(next >= 12 * 60 && next <= 22 * 60, 'Erster Angriff nach 12–22 Minuten');
  GK.state.ui.tab = 'casino';
  K.update(5000);
  assert(!GK.state.kraken.attack && GK.state.kraken.clock === 1, 'Im Casino zählt die Zeit nicht');
  GK.state.ui.tab = 'clicker';
  GK.state.settings.kraken = false;
  K.update(5000);
  assert(!GK.state.kraken.attack, 'Ausgeschaltet: kein Angriff');
  GK.state.settings.kraken = true;
  K.update(next);
  assert(!!GK.state.kraken.attack, 'Nach der Wartezeit greift er an');
  // Angriff pausiert außerhalb des Klickers
  const left = GK.state.kraken.attack.left;
  GK.state.ui.tab = 'casino';
  K.update(1);
  assert(GK.state.kraken.attack.left === left, 'Angriff wartet, solange man im Casino ist');
}

// ---------- Freundes-Rangliste ----------
{
  GK.state.friends = {};
  GK.state.friendId = '';
  const me = F.myRecords();
  assert(/^[A-Z0-9]{12}$/.test(me.id) && F.myRecords().id === me.id, 'Eigene Kennung bleibt gleich');
  assert(F.remember(me) === false && !Object.keys(GK.state.friends).length, 'Sich selbst merkt man nicht');
  const anna = { id: 'ANNA12345678', name: '  Anna  ', avatar: '🦊', badge: 'hunter', t: Date.now() - 1000, money: 5e6, earned: 9e6, net: -2000, win: 50000, loss: 12000, mult: 25, wins: 3, ach: 40,
    games: { roulette: [50000, 1000, 36], chicken: [200, 100, 2.5], '<script>': [1, 1, 1] } };
  assert(F.remember(anna) && GK.state.friends.ANNA12345678.name === 'Anna', 'Freundin gemerkt, Name bereinigt');
  const stored = GK.state.friends.ANNA12345678;
  assert(stored.games.roulette[0] === 50000 && !stored.games['<script>'], 'Nur gültige Spiele');
  assert(!F.clean({ id: 'x' }) && !F.clean(null) && !F.clean({ id: '<b>BÖSE</b>' }), 'Ungültige Kennungen abgelehnt');
  const weird = F.clean({ id: 'BEN123456789', name: 'Ben', money: Infinity, win: 'viel', mult: NaN, avatar: '<img>', badge: 'gibtsnicht' });
  assert(weird.money === 0 && weird.win === 0 && weird.mult === 0 && weird.avatar !== '<img>' && weird.badge === '', 'Kaputte Werte werden zu 0');
  // Ältere Daten ersetzen keine neueren
  assert(F.remember(Object.assign({}, anna, { t: anna.t - 5000, money: 1 })) === false && GK.state.friends.ANNA12345678.money === 5e6, 'Ältere Rekorde ersetzen keine neueren');
  assert(F.remember(Object.assign({}, anna, { t: anna.t + 500, money: 7e6 })) && GK.state.friends.ANNA12345678.money === 7e6, 'Neuere Rekorde ersetzen ältere');
  // Mitglieder aus einer Raum-Nachricht
  F.learnFrom([{ playerId: 'p1', records: Object.assign({}, anna, { id: 'CARL12345678', name: 'Carl', t: Date.now() }) }, { playerId: 'p2' }, null]);
  assert(Object.keys(GK.state.friends).length === 2, 'Aus dem Raum gelernt');
  // Mitgeschickt wird nur im Warteraum/am Ende, die eigenen Rekorde frisch
  const members = [{ playerId: 'host', name: 'Ich' }, { playerId: 'p1', name: 'Carl', records: { id: 'CARL12345678' } }];
  const shared = F.membersOut(members, true, 'host', () => true);
  assert(shared[0].records && shared[0].records.id === me.id && shared[1].records.id === 'CARL12345678' && shared[0].online, 'Im Warteraum: Rekorde dabei');
  const playing = F.membersOut(members, false, 'host', () => false);
  assert(!playing[0].records && !playing[1].records && members[1].records, 'Im Spiel: keine Rekorde, Original unverändert');
  // Höchstens 60 Freunde, die am längsten nicht gesehenen fallen heraus
  for (let i = 0; i < 70; i++) F.remember({ id: 'F' + String(i).padStart(11, '0'), name: 'F' + i, t: Date.now() });
  assert(Object.keys(GK.state.friends).length === 60, 'Höchstens 60 Freunde');
  // Eigene Rekorde aus der Statistik
  GK.state.casino.stats = { roulette: { rounds: 3, biggestWin: 700, biggestLoss: 50, bestMult: 36 }, mines: { rounds: 0 } };
  GK.state.casino.biggestWin = 700;
  const mine = F.myRecords();
  assert(mine.games.roulette[2] === 36 && !mine.games.mines && mine.mult === 36 && mine.win === 700, 'Eigene Rekorde aus der Statistik');
  assert(JSON.stringify(mine).length < 4000, 'Rekorde bleiben klein');
}

console.log(process.exitCode ? 'Kraken-/Rangliste-Tests FEHLGESCHLAGEN' : 'Kraken-/Rangliste-Tests bestanden.');
