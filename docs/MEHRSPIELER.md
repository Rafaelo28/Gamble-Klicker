# Spiele mit Freunden (`js/mp/room.js`)

Entwickler-Dokumentation für alle Spiele der Casino-Kategorie „Mit Freunden“ **außer Poker**
(Poker hat eine eigene Netzwerkschicht in `js/poker/multiplayer.js`). Alles hier ist aus dem Code
belegt; Stellen, die nicht eindeutig sind, stehen unter [Offene Punkte](#9-offene-punkte).

Grundidee: `room.js` liefert Raum, Eintritt, Verbindung, Bedenkzeit, Abrechnung und „Gegen Computer“.
Ein Spiel liefert nur **Regeln** (reine Funktionen auf einem JSON-Zustand) und **Darstellung**.

---

## 1. Architektur

### 1.1 Gastgeber-Modell

- Ein Spieler eröffnet den Raum (`room.js:createRoom`) und ist **Gastgeber** (`session.role === 'host'`).
  Nur bei ihm liegt der vollständige Spielzustand (`session.state`), nur er ruft `create`, `act`,
  `advance`, `botAct`, `timeout`, `forfeit` auf.
- Gäste (`role === 'client'`) bekommen nach jeder Änderung eine Nachricht `state` mit ihrer **eigenen
  Ansicht** (`def.view(state, platz)`) und schicken nur Aktionen zurück.
- „Gegen Computer“ ist derselbe Ablauf mit `session.solo = true`: Der Spieler ist Gastgeber, es gibt
  kein Netzwerk, freie Plätze füllen Computer-Gegner (`room.js:BOTS`, 8 Stück mit `skill` 0,25–0,8).
- Der Ablauf beim Gastgeber läuft immer über `room.js:afterHostChange`: Bedenkzeit setzen → eigene
  Abrechnung → `phase = 'ended'`, wenn `finished` → `GK.save()` → `broadcast()` → `redraw()` →
  `scheduleHost()` (nächster automatischer Schritt, Computer-Zug oder Zeitablauf).

### 1.2 Verbindung

| Punkt | Umsetzung |
|---|---|
| Technik | WebRTC-Datenkanäle über **PeerJS 1.5.4** (`index.html`, von cdnjs geladen; `window.Peer`) |
| Signalisierung | Vermittlungsserver von PeerJS (Standard-Einstellungen; `room.js:peerOptions` = `{ debug: 0 }` plus `window.GK_PEER_OPTIONS`, damit Tests einen eigenen Server eintragen können) |
| Raum-Code | 5 Zeichen aus `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (`newCode`), per `GK.rng` |
| Peer-ID des Gastgebers | `'gamble-klicker-' + spielId + '-' + code` (`connectHost`). Ist die ID vergeben und der Raum noch `fresh`, wird ein neuer Code gewürfelt |
| Gast | anonymer Peer (`connectClient`), verbindet sich mit `peer.connect(id, { reliable: true })` (`openHostConn`) |
| Einladungs-Link | `…?raum=CODE&spiel=ID` (`inviteLink`); `readInviteLink` (Aufruf in `main.js:init`) öffnet das Spiel, trägt den Code vor und entfernt die Parameter aus der Adresse |
| Ohne PeerJS | `peerAvailable()` ist falsch → Knöpfe „Eröffnen“/„Beitreten“ gesperrt, „Gegen Computer“ geht weiter |

Konstanten (`room.js`, Kopf): `PROTOCOL = 1`, `HEARTBEAT = 2000`, `HEARTBEAT_TIMEOUT = 8000`,
`RETRY_DELAY = 3000`, `CONNECT_TIMEOUT = 10000`, `OFFLINE_TURN_TIME = 5000`, `ABANDON_AFTER = 30000`,
`DROP_AFTER = 90000`, `MIN_ENTRY = 100`.

Laufzeit-Verbindungsdaten stehen in `net` (nicht im Spielstand): `peer`, `conns` (Gastgeber:
`playerId → Verbindung`), `hostConn` (Gast), `status` (`idle | connecting | online | lost`), `lostSince`.
Für Tests als `GK.room._net` sichtbar.

### 1.3 Nachrichten

Alle Nachrichten sind einfache Objekte mit `type`. Scheitert `conn.send` (PeerJS kann ganze Zahlen über
2^64 nicht verpacken), geht dieselbe Nachricht als `{ type: 'json', data: JSON.stringify(msg) }` hinaus
und wird beim Empfang von `unpack` wieder ausgepackt (`room.js:send`, `unpack`).

**Gast → Gastgeber** (Auswertung in `room.js:onHostMessage`)

| `type` | Felder | Wirkung |
|---|---|---|
| `hello` | `v`, `game`, `playerId`, `name`, `avatar`, `fig`, `rank`, `badge`, `paid`, `records` | Erste Nachricht nach Verbindungsaufbau (auch nach Wiederverbinden). Prüft Version und Spiel, legt das Mitglied an (nur im Warteraum, solange Platz ist) oder ordnet die Verbindung einem bekannten `playerId` zu. `paid: true` setzt `ready`. Eine ältere Verbindung desselben Spielers wird geschlossen |
| `join` | – | Eintritt bezahlt → `member.ready = true` (nur in Phase `lobby`) |
| `action` | `action` (Objekt, spielspezifisch) | `playerAction(platz, action)` (nur in Phase `playing`) |
| `records` | `records` | Neue Rekorde nach der Abrechnung (Freundes-Rangliste) |
| `leave` | – | `playerLeft`: im Warteraum Mitglied entfernen, im Spiel `def.forfeit` |
| `ping` | – | Herzschlag, aktualisiert nur `conn.lastSeen` |

Vor einem gültigen `hello` (also ohne `conn.playerId`) wird alles andere verworfen.

**Gastgeber → Gast** (Auswertung in `room.js:onClientMessage`)

| `type` | Felder | Wirkung |
|---|---|---|
| `state` | `v`, `game`, `code`, `entry`, `settings`, `phase`, `hostId`, `fillBots`, `members`, und sobald das Spiel läuft: `view`, `mySeat`, `turnLeft` (ms oder `null`) | Vollständiger Stand für genau diesen Gast (`stateMessage`). Es gibt keine Teil-Updates |
| `error` | `fatal`, `message` | `fatal` → `endSession(message, true)` (Eintritt zurück), sonst Hinweis. Fälle: anderes Spiel, andere Protokollversion, Spiel läuft schon, Raum voll, ohne Bezahlung gestartet |
| `closed` | `reason` | Gastgeber hat den Raum geschlossen → `endSession(reason, true)` |
| `ping` | – | Herzschlag |

`members[]` in `state`: `{ playerId, name, avatar, fig, rank, badge, ready, online, records? }`
(`friends.js:membersOut`; `records` nur wenn `phase !== 'playing'`).
`turnLeft` ist eine **Restzeit**, keine Uhrzeit – der Gast rechnet `Date.now() + turnLeft` (Uhren der
Geräte müssen nicht übereinstimmen).

### 1.4 Sitzung im Spielstand

`room.js:store()` = `GK.casino.data('room', …)`:

| Feld | Inhalt |
|---|---|
| `playerId` | 16 Zeichen, einmal gewürfelt; daran erkennt der Gastgeber einen Spieler wieder |
| `lastEntry` | zuletzt gewählter Eintritt (Start: 1000) |
| `settings[spielId]` | zuletzt gewählte Optionen |
| `soloBots[spielId]` | zuletzt gewählte Zahl der Computer-Gegner |
| `session` | laufende Sitzung oder `null` – es gibt **höchstens eine** (über alle Raum-Spiele) |
| `results[spielId]` | `{ message, result }` der letzten Sitzung für die Startseite |

`session` beim **Gastgeber**: `game`, `role: 'host'`, `solo`, `code`, `fresh`, `entry`, `settings`,
`phase` (`lobby | playing | ended`), `paid: true`, `settled`, `members[]`, `fillBots`, `state`,
`deadline`, `turnKey`, `result`.

`session` beim **Gast**: `game`, `role: 'client'`, `code`, `phase` (`connecting | lobby | playing |
ended`), `joined`, `paid`, `settled`, `entry`, `settings`, `members[]`, `hostId`, `fillBots`, `view`,
`mySeat`, `deadline`, `result`.

`result` ist `{ place, prize, players }` oder `{ refunded: true }`. Weil der ganze Zustand im Spielstand
liegt, muss `state` **JSON-fähig** sein (keine Funktionen, `Map`, `Set`, DOM-Knoten).

`busyElsewhere()` verhindert parallele Sitzungen: laufendes Poker-Turnier, Poker-Raum oder ein anderer
Raum sperren das Eröffnen/Beitreten. Umgekehrt fragen `js/poker/poker.js` und
`js/poker/multiplayer.js` `GK.room.active()` ab.

### 1.5 Neuladen, Wiederverbinden, Verlassen

`GK.room.resume()` wird in `main.js:init` und `main.js:refreshAll` (nach Import/Zurücksetzen) aufgerufen.

| Fall | Verhalten |
|---|---|
| Gegen Computer, Neuladen | `resume` setzt `turnKey = null` und ruft `afterHostChange` – das Spiel geht weiter. Solange der Spielbereich nicht sichtbar ist, pausiert es (`scheduleHost`/`isVisible`); `onShow` plant neu |
| Gastgeber lädt neu | `connectHost` meldet dieselbe Peer-ID wieder an. Hält der Server sie noch fest, wird alle 3 s neu versucht (`afterPeerError` → `retry`). Zustand kommt aus dem Spielstand |
| Gast lädt neu | `connectClient` → `hello` mit `paid` aus der Sitzung. Bekannter `playerId` darf auch im laufenden Spiel wieder herein; ein unbekannter bekommt „Spiel läuft schon“ |
| Nur der Vermittlungsserver ist weg | `reconnectServer`: `peer.reconnect()` mit derselben ID; die direkten Verbindungen laufen weiter |
| Herzschlag | alle 2 s `ping`; 8 s ohne Nachricht → Verbindung gilt als tot (`heartbeat`) |
| Gast im laufenden Spiel offline | Ist er am Zug, hat er nur 5 s Bedenkzeit (`OFFLINE_TURN_TIME`), danach greift `def.timeout`. Nach 90 s ohne Verbindung: `def.forfeit` (`dropAbsentPlayers`). Ist der Gastgeber selbst offline (`hostOnline()` falsch) oder war seine Seite eingeschlafen, scheidet niemand aus |
| Gast verlässt Warteraum | `leave` + `endSession(…, true)` → Eintritt zurück |
| Gast verlässt laufendes Spiel | Rückfrage, dann `leave` und lokale Abrechnung mit dem Platz „Anzahl Spieler − schon Platzierte“ (`clientLeave`) |
| Gastgeber nicht erreichbar | Gast versucht alle 3 s neu (`hostLost`). Nach 30 s (`ABANDON_AFTER`) darf er abbrechen und bekommt den Eintritt zurück |
| Raum nicht gefunden | `peer-unavailable` vor dem ersten `state` → `endSession('Raum … nicht gefunden', true)` |
| Gastgeber schließt Warteraum | `closed` an alle, jeder bekommt seinen Eintritt zurück |
| Gastgeber verlässt laufendes Spiel | `closed` an alle (Gäste: Eintritt zurück, falls noch nicht abgerechnet); er selbst gibt auf (`def.forfeit`) und wird nach seinem Platz abgerechnet (`hostLeave`) |
| Gastgeber ist ausgeschieden | Er leitet das Spiel weiter, bis es vorbei ist (Hinweis in `drawGame`) |

---

## 2. Geld

Alle Bewegungen laufen über `GK.casino.bet / payout / refund / record` (`js/casino/casino.js`).

| Vorgang | Funktion | Details |
|---|---|---|
| Eintritt Gastgeber / gegen Computer | `room.js:createRoom` → `GK.casino.bet(entry)` | Mindestens `MIN_ENTRY` (100). **Nur gegen Computer** gilt das VIP-Limit `GK.casino.maxBet()` |
| Eintritt Gast | `room.js:clientConfirm` → `GK.casino.bet(s.entry)`, dann `join` | Der Gast übernimmt `entry` aus `state` nur, solange er nicht bezahlt hat (`onClientMessage`) |
| Abrechnung | `room.js:settle(place, view, seat)` | Einmalig (`s.settled`), nur wenn `s.paid`. `GK.casino.payout(win)`, `def.onSettle(place, s)`, `GK.casino.record(...)`, Erfolg `roomPlay` und `GK.state.friendWins` (nur mit Freunden), `GK.fx.celebrate` |
| Rückgabe | `room.js:refundEntry` → `GK.casino.refund(entry)` | über `endSession(message, true)`; nur wenn bezahlt und noch nicht abgerechnet |
| Betrag je Platz | `GK.room.payoutFor(s, view, seat, place)` → `GK.room.prize(place, entry, players, solo, paying)` | immer `Math.floor` |

**Jeder rechnet sich selbst ab**: der Gastgeber in `afterHostChange`, der Gast in `onClientMessage`,
jeweils sobald `def.placeOf(…, eigenerPlatz)` einen Platz liefert – also schon beim Ausscheiden, nicht
erst am Spielende. Es fließt kein Geld über das Netz.

**Mit Freunden** – Topf = `entry × zahlende Menschen` (`humans(view.players)`, Computer-Gegner zahlen
nichts). Anteile nach Platz unter **allen** Plätzen am Tisch (`GK.room.prizeShares(players)`):

| Plätze am Tisch | Anteile |
|---|---|
| 2 | 100 % |
| 3 | 70 % / 30 % |
| 4–5 | 65 % / 35 % |
| 6 und mehr | 50 % / 30 % / 20 % |

Gewinnt ein Computer-Gegner einen Preis, behält ihn das Casino (Beispiele in `tests/payouts.test.js`).

**Gegen Computer** – das Casino zahlt, `GK.room.soloMultipliers(players)` (`SOLO_RETURN = 0.95`):
2 Spieler → Sieger `1,9 ×` Eintritt; ab 3 Spielern → Sieger `0,95 × n − 0,5`, Platz 2 `0,5 ×`.
Diese Zahlen **nicht im Spiel anzeigen** (CLAUDE.md, Gestaltung); angezeigt werden nur die Preise in
Dublonen (`prizeText`).

---

## 3. Schnittstelle der Spieldefinition

Anmeldung: `GK.room.registerGame(def)`. `room.js` meldet das Spiel selbst bei `GK.casino.register` an
(Kategorie `friends`), das Spiel ruft `GK.casino.register` **nicht** auf.

„G“ = wird nur beim Gastgeber (auch gegen Computer) aufgerufen, „G+M“ = auch beim Gast.
`z` ist beim Gastgeber der volle Zustand, beim Gast die Ansicht aus `view`.

### 3.1 Beschreibung

| Feld | Typ | Bedeutung |
|---|---|---|
| `id` | String | Schlüssel: Casino-Karte, Spielstand, Peer-ID, Einladungs-Link, `GK.track('online-' + id)`. Nie ändern, nie übersetzen |
| `name`, `desc` | deutscher Text | `room.js` übersetzt mit `GK.t(d.name)` – englische Fassung per `GK.i18n.add` anmelden |
| `icon` | Emoji | Casino-Karte und Warteraum |
| `intro` | HTML | Erklärtext auf der Startseite; die Spiele übergeben ihn bereits als `GK.t(...)` |
| `minPlayers`, `maxPlayers` | Zahl | `maxPlayers` begrenzt Raum, Computer-Gegner und Auffüllen. `minPlayers` wird von `room.js` nicht ausgewertet (Start verlangt fest 2 bezahlte Spieler) |
| `bots` | Boolean | `true` → Kästchen „Freie Plätze mit Computer-Gegnern auffüllen“ im Warteraum, vorbelegt an (`fillBots`). Aufgefüllt wird bis `maxPlayers` |
| `settings.defaults` | Objekt | Standard-Optionen (Pflicht, ggf. `{}`) |
| `settings.html(s)` | → HTML | optional: Auswahl auf der Startseite |
| `settings.bind(el, changed)` | – | optional: Klick-Empfänger setzen, bei Änderung `changed()` rufen (speichert) |
| `settings.read(el)` | → Objekt | optional: Optionen aus dem DOM lesen; Ergebnis geht an `create` und im `state` an alle |
| `settingsText(s)` | → Text | optional: Kurzform für Warteraum und Info-Zeile |

### 3.2 Regeln

| Funktion | Wer | Wann / Vertrag |
|---|---|---|
| `create(seats, settings)` → `z` | G | `startGame`. `seats[] = { id, name, avatar, fig, rank, badge, isBot, skill? }` (Menschen zuerst, dann Computer-Gegner). Muss `z.players[]` mit mindestens `{ id, name, avatar, isBot }` in Platz-Reihenfolge liefern. `room.js` hängt danach `badge`, `fig`, `rank` an `z.players` und setzt `z.step = 0` |
| `actor(z)` → Platz oder `-1` | G | Wer ist dran? Steuert Bedenkzeit, Computer-Zug und (ohne `canAct`) wer handeln darf |
| `canAct(z, platz)` → bool | G | optional; ersetzt die Prüfung `actor(z) === platz`, wenn mehrere gleichzeitig handeln (Seeschlacht: Aufstellen) |
| `act(z, platz, aktion)` → bool | G | Aktion prüfen und anwenden. `true` nur bei gültiger Aktion – dann erhöht `room.js` `z.step` und verteilt den Stand. `aktion` kommt ungeprüft aus dem Netz (nur „ist ein Objekt“ ist sicher) |
| `botAct(z, platz)` → Aktion | G | Computer-Gegner ist dran (`botStep`); die Aktion läuft durch `act` |
| `botDelay(z, solo)` → ms | G | optional, sonst 1200 |
| `timeout(z, platz)` → Aktion | G | Bedenkzeit eines Menschen abgelaufen (`hostTimeout`). Muss eine **gültige** Aktion liefern, sonst passiert nichts mehr |
| `turnTime(z)` → ms | G | Bedenkzeit pro Zug. Gegen Computer gibt es keine Bedenkzeit |
| `phaseDeadline(z)` → Zeitstempel oder `null` | G | optional: gemeinsame Frist, wenn `actor(z) === -1` (nicht gegen Computer) |
| `autoDelay(z, solo)` → ms oder `null` | G | Nicht `null` → nach dieser Zeit ruft `room.js` `advance(z)` (Aufdecken, Animation abwarten …). Hat Vorrang vor Computer-Zug und Zeitablauf |
| `advance(z)` | G | Automatischer Schritt; `room.js` erhöht danach `z.step` |
| `forfeit(z, platz)` | G | Spieler gibt auf, verlässt das Spiel oder war 90 s offline. Muss ihm einen Platz geben und das Spiel spielbar lassen (Zug weitergeben, ggf. beenden) |
| `placeOf(z, platz)` → Platz (1 = Sieger) oder `null` | G+M | Sobald ein Wert kommt, wird dieser Spieler abgerechnet. Beim Gast mit der **Ansicht** aufgerufen; auch für fremde Plätze (Rangliste am Ende, „wer ist noch dabei“) |
| `finished(z)` → bool | G | `true` → `phase = 'ended'`. Dann müssen alle Plätze vergeben sein (`drawGame` sortiert danach) |
| `view(z, platz)` → Ansicht | G | Für jede Nachricht und fürs eigene Zeichnen. `platz` kann `-1` sein. Muss `players[]` mit `id`, `name`, `isBot` und allem enthalten, was `placeOf` und `draw` brauchen. Geheimes hier entfernen |
| `onSettle(place, session)` | G+M | optional, bei der eigenen Abrechnung (z. B. Erfolg freischalten) |

### 3.3 Darstellung

`draw(container, view, ui)` – G+M, bei **jedem** `redraw` (jede Nachricht, jede Änderung, im Zustand
„Verbindung verloren“ alle 2 s). `container` ist `.room-game` und bleibt über die Aufrufe bestehen:
DOM einmal aufbauen, danach nur geänderte Teile schreiben (alle Spiele nutzen dafür ein lokales
`setHtml(el, html)` mit Vergleich). Einen Klick-Empfänger am Container anlegen, nicht je Knopf.

`ui` = `{ mySeat, isHost, solo, ended, act, members }`:

- `ui.act(aktion)` → `true`, wenn angewendet (Gastgeber) bzw. abgeschickt (Gast); `false` ohne
  Verbindung – dann die eigene Anzeige zurücksetzen (Beispiel `darts.js:throwNow`).
- `ui.mySeat` ist `-1` bei Zuschauern ohne Platz.
- Rahmen (Info-Zeile, Hinweise, Bedenkzeit-Anzeige, Knopf „Spiel verlassen“, Rangfolge am Ende)
  zeichnet `room.js:drawGame`.

Namen anderer Spieler immer über `GK.cosmetics.nameTag(p)` (maskiert selbst) oder ein eigenes `esc()`
ausgeben. Effekte bei neuen Ereignissen über einen Zähler im Zustand erkennen (`lastMove.no`,
`lastShot.no`, `last.n`) und mit einem am Container gemerkten Wert vergleichen.

---

## 4. Rezept: neues Spiel mit Freunden

1. **Datei `js/mp/<name>.js`** nach dem Muster von `js/mp/connect4.js` (kleinstes Spiel):

```js
// Kurzbeschreibung der Regeln (deutsch).
window.GK = window.GK || {};
// Ersatz, falls js/i18n.js nicht geladen ist (Node-Tests)
GK.t = GK.t || function (s, v) { s = String(s); return v ? s.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m)) : s; };
GK.i18n = GK.i18n || { add() {}, addHtml() {}, apply() {}, set() {}, lang: 'de' };

GK.i18n.add({ 'Mein Spiel': 'My game', 'Kurztext.': 'Short text.', 'Du bist dran!': "You're up!" });

(function () {
  function create(seats) {
    return {
      players: seats.slice(0, 2).map(s => ({ id: s.id, name: s.name, avatar: s.avatar || '',
        isBot: !!s.isBot, skill: s.skill || 0.5, place: null, out: false })),
      turn: GK.rng.int(2), phase: 'play', last: null, log: [],
    };
  }
  function act(st, seat, a) {            // alles prüfen: a kommt aus dem Netz
    if (st.phase !== 'play' || st.turn !== seat || !a || a.type !== 'move') return false;
    // … Zug anwenden, bei Spielende place setzen, phase = 'finished', turn = -1
    st.turn = 1 - seat;
    return true;
  }
  function forfeit(st, seat) {
    if (st.phase === 'finished') return;
    st.players[seat].place = 2; st.players[seat].out = true;
    st.players[1 - seat].place = 1; st.phase = 'finished'; st.turn = -1;
  }
  const botAct = (st, seat) => ({ type: 'move' /* … */ });
  const timeout = (st, seat) => ({ type: 'move' /* gültiger Notzug */ });

  function draw(container, v, ui) {
    if (!container.querySelector('.my-wrap')) {
      container.innerHTML = '<div class="my-wrap"><div class="my-hint"></div></div>';
      container.addEventListener('click', e => { /* … ui aus container._ui … ui.act({ type: 'move' }) */ });
    }
    container._view = v; container._ui = ui;
    GK.setHTML(container.querySelector('.my-hint'), v.turn === ui.mySeat ? GK.t('Du bist dran!') : '');
  }

  GK.room.registerGame({
    id: 'mygame', name: 'Mein Spiel', icon: '🎲', desc: 'Kurztext.', intro: '',
    minPlayers: 2, maxPlayers: 2, bots: true, settings: { defaults: {} },
    create, act, botAct, timeout, forfeit, draw,
    actor: st => (st.phase === 'play' ? st.turn : -1),
    turnTime: () => 30000,
    autoDelay: () => null, advance: () => {},
    placeOf: (st, seat) => (seat >= 0 && st.players[seat] ? st.players[seat].place : null),
    finished: st => st.phase === 'finished',
    view: st => JSON.parse(JSON.stringify(st)),   // bei geheimen Daten: je Platz filtern
  });

  GK.mygame = { create, act, forfeit, botAct, timeout };   // für Tests
})();
```

2. **`index.html`**: `<script src="js/mp/<name>.js?v=…">` nach `js/mp/room.js` und vor `js/i18n-ui.js`
   eintragen; **alle** `?v=…` auf einen neuen Wert setzen (`JJJJMMTTNN`).
3. **CSS** in `css/style.css` (eigener Klassen-Präfix wie `c4-`, `kf-`). iPad-Regeln aus CLAUDE.md:
   große Tippflächen, Hover nur in `@media (hover: hover)`, Dauer-Animationen nur `transform`/`opacity`.
4. **i18n**: jeden angezeigten Text in `GK.t('…')`, englische Fassung per `GK.i18n.add` in derselben
   Datei. `id`, Aktions-`type`, Zustandsfelder nie übersetzen.
5. **Test `tests/<name>.test.js`** (ohne Browser, Muster `tests/connect4.test.js`):

```js
global.window = global;
const R = require('path').join(__dirname, '..', 'js') + '/';
require(R + 'state.js');            // GK.player (room.js braucht es beim Laden)
require(R + 'casino/casino.js');    // GK.rng, GK.casino.register / data
require(R + 'mp/room.js');
require(R + 'mp/<name>.js');
```

   Prüfen: ungültige Aktionen werden abgewiesen, komplette Partien zwischen Computer-Gegnern enden
   (Schleife `act(st, turn, botAct(st, turn))` bzw. `advance`, mit Zähler als Notbremse), `forfeit`,
   jede Platzierung genau einmal, bei geheimen Daten die Ansicht eines fremden Platzes.
   `tests/maumau.test.js` lädt zusätzlich `casino/cards.js`; `tests/payouts.test.js` braucht wegen Poker
   Attrappen für `document`, `location`, `history`.
6. Test in die Liste in **CLAUDE.md** aufnehmen; optional Erfolg in `js/achievements.js` und per
   `onSettle` freischalten.
7. Im Browser prüfen (Playwright, iPad hoch/quer): gegen Computer, Neuladen mitten im Spiel,
   Kontostand = Start − Eintritt + Preis.

`room.js` selbst muss für ein neues Spiel **nicht** geändert werden.

---

## 5. Deterministische Physik (Minigolf, Billard, Kanonenduell)

**Regel** (CLAUDE.md): In der Simulation nur `+ − × ÷` und `Math.sqrt` – keine Winkel-, Potenz- oder
Logarithmusfunktionen. Diese liefern je nach Gerät/Browser leicht andere Ergebnisse.

**Warum es darauf ankommt:** Der Gastgeber rechnet den Schuss in `act` aus und schickt im Zustand das
Ergebnis **und** die Eingabe (`lastShot`). Jeder Gast rechnet die Bahn in `draw` lokal mit
`simulate(…, record = true)` nach, nur für die Animation. Weicht die Rechnung ab, endet die Animation an
einer anderen Stelle als der vom Gastgeber gemeldete Stand.

| Spiel | `simulate` | Schrittweite | `lastShot` (Eingabe fürs Nachspielen) | Wartezeit (`autoDelay`) |
|---|---|---|---|---|
| Minigolf | `minigolf.js:simulate(hole, start, dx, dy, power, record)` | `DT = 1/120`, höchstens 3000 Schritte, Teilschritte bei hohem Tempo | `{ no, seat, from, dx, dy, power, steps, holed, water }` | `rollTime(st) + 700` |
| Billard | `billiards.js:simulate(balls, dx, dy, power, record)` | `DT = 1/120`, höchstens 2400 Schritte, Teilschritte | `{ no, seat, dx, dy, power, before, steps }` (`before` = Kugeln vor dem Stoß) | `rollTime(st) + 600` |
| Kanonenduell | `cannon.js:simulate(field, seat, ux, uy, power, wind, record)` | `DT = 1/60`, höchstens 900 Schritte | `{ seat, ux, uy, power, wind, what, x, y, steps, damage, hpBefore, no }` | `steps × 1000 × DT + 1300` |

So setzen die Spiele die Regel um:

- Richtung als **Vektor** `(dx, dy)` statt Winkel; `act` normiert mit `Math.sqrt` und begrenzt `power`.
  Im Zustand steht die bereits normierte Eingabe – alle rechnen mit denselben Zahlen.
- Feste Schrittweite, feste Obergrenze der Schritte, Reibung/Abprallen nur mit Grundrechenarten.
- `record` darf das Ergebnis nicht beeinflussen (nur zusätzlich Bahn/Bilder sammeln).
- Die Phase `rolling`/`flying` überbrückt die Animation: `autoDelay` liefert die Dauer aus `steps`,
  danach schaltet `advance` weiter.
- **Erlaubt** sind Winkelfunktionen außerhalb der Simulation: in `botAct` (läuft nur beim Gastgeber, das
  Ergebnis ist wieder ein Vektor – `minigolf.js:botAct`, `billiards.js:botAct`), beim Zeichnen
  (Canvas-Bögen, Wellen) und für reine Anzeigen (`cannon.js:drawAim`, Gradzahl).
- Zufall (`GK.rng`) gehört nie in `simulate`, nur in `create`, `botAct`, `timeout`, `advance`.

Darts ist **kein** solches Spiel: `darts.js:score` nutzt `Math.atan2`, `gauss` nutzt `Math.log`/`Math.cos`.
Das ist in Ordnung, weil nur der Gastgeber wertet und das fertige Ergebnis (`lastDart`) verschickt.

So prüfen es die Tests:

| Test | Prüfung |
|---|---|
| `tests/cannon.test.js` | Liest den Quelltext und verbietet `Math.sin/cos/tan/atan/asin/acos/pow/exp/log/hypot` in `groundAt`, `muzzle`, `hitsShip`, `simulate`, `damage`. 200 Zufallsschüsse: Ergebnis identisch auf einer per JSON kopierten Spielfeld-Kopie |
| `tests/minigolf.test.js` | Je Bahn 20 Zufallsschläge: `simulate` mit und ohne `record` liefert dasselbe; Ball bleibt innerhalb der Bahn |
| `tests/billiards.test.js` | 30 Zufallsstöße: Kugeln mit und ohne `record` identisch (`JSON.stringify`); keine Kugel verlässt den Tisch ohne Loch |

Eine Quelltext-Prüfung wie beim Kanonenduell gibt es für Minigolf und Billard nicht.

---

## 6. Alle Spiele

Alle haben `bots: true` und Computer-Gegner mit `skill`. Export = Objekt für die Tests.

| `id` | Datei | Spieler | Optionen (`settings`) | Geheim | Bedenkzeit | Export | Besonderheiten |
|---|---|---|---|---|---|---|---|
| `dice` | `dice.js` | 2–6 | `dice`: 3 oder **5** | ja | 30 s | `GK.diceGame` | Lügenwürfel. Fremde Würfel sind in `view` bis zum Aufdecken `0`. Phase `reveal` mit `autoDelay` 4–5 s |
| `kniffel` | `kniffel.js` | 2–4 | `mode`: **`full`** (13 Felder) oder `quick` (7) | nein | 45 s | `GK.kniffelGame` | `view` entfernt nur `plan` und `skill`. Jedes Halten ist eine eigene Aktion |
| `maumau` | `maumau.js` | 2–4 | – | ja | 30 s | `GK.maumauGame` | `view` baut ein eigenes Objekt: fremde Hände leer (nur `count`), Stapel nur als Anzahl, Ablage nur die obersten 4 |
| `golf` | `minigolf.js` | 2–4 | `holes`: 3 oder **6** | nein | 40 s | `GK.minigolf` | Deterministische Physik, Phasen `aim → rolling → holeDone` |
| `pool` | `billiards.js` | 2 | – | nein | 45 s | `GK.billiards` | 8-Ball, deterministische Physik; Aktion `shot` kann `place` (Weiße hinlegen) enthalten |
| `connect4` | `connect4.js` | 2 | – | nein | 25 s | `GK.connect4` | Minimax-Gegner; volles Brett → Phase `full`, `advance` leert es |
| `battleship` | `battleship.js` | 2 | – | ja | 20 s | `GK.battleship` | Einziges Spiel mit `canAct` und `phaseDeadline`: beide stellen gleichzeitig auf (60 s, `placeUntil`). `view` zeigt vom Gegner nur versenkte Schiffe |
| `darts` | `darts.js` | 2–4 | `rounds`: 3, **5** oder 8 | nein | 20 s | `GK.darts` | Gastgeber addiert Streuung zum Wurf; Stechen bei Gleichstand (höchstens 3) |
| `duel` | `cannon.js` | 2 | – | nein | 25 s | `GK.cannonDuel` | Kanonenduell, deterministische Flugbahn, Wind je Runde neu |

Fett = Standardwert. `id` und Dateiname weichen bei `golf`, `pool`, `duel` ab.
Aktionstypen: `dice` `bid`/`challenge` · `kniffel` `roll`/`hold`/`score` · `maumau` `play`/`draw`/`pass` ·
`golf`, `pool` `shot` · `connect4` `drop` · `battleship` `place`/`ready`/`fire` · `darts` `throw` · `duel` `fire`.

---

## 7. Daten im Netz und ihre Prüfung

Verbindungen bestehen nur zwischen Gastgeber und jedem Gast, nicht zwischen Gästen.

| Daten | Wo | Prüfung beim Empfang |
|---|---|---|
| `playerId` (Raum) | `hello` | `String(...).slice(0, 32)`; leer oder gleich dem des Gastgebers → verworfen |
| Name | `hello`, `members`, `view.players` | `GK.player.cleanName` (höchstens 16 Zeichen, sonst „Gast“) |
| Bild | `hello` | muss in `GK.player.AVATARS` stehen |
| Figur-Code `fig` | `hello` | `GK.figure.valid` (nur im Warteraum übernommen) |
| Rang `rank` | `hello` | `GK.rank.valid` (nur im Warteraum) |
| Namensschild `badge` | `hello` | `GK.cosmetics.validBadge` (nur im Warteraum) |
| Rekorde `records` | `hello`, `records`, `members[].records` | `GK.friends.clean`: ID-Muster, nur bekannte Felder, nur endliche Zahlen; gespeichert über `GK.friends.remember` / `learnFrom` |
| Aktion | `action` | `room.js`: Platz ≥ 0, ist Objekt, Spieler darf handeln; alles Weitere in `def.act` |
| Eintritt | `state.entry` | `Math.floor(Number(...)) >= MIN_ENTRY`, sonst wird die Nachricht verworfen |
| Protokoll, Spiel | `hello.v`, `hello.game`, `state.game` | müssen passen |

`records` (`friends.js:myRecords`) enthält u. a. Freundes-ID, Name, Bild, Figur, Rang, Namensschild,
Vermögen, Kontostand, „insgesamt verdient“, Casino-Bilanz, Klicks, Zahl der Erfolge und Bestwerte je
Casino-Spiel. Rekorde gehen nur im Warteraum und nach Spielende mit (`stateMessage`), nicht während des
Spiels. Feldliste und Rangliste: `js/friends.js`.

Der Gast **vertraut dem Gastgeber**: `settings`, `phase`, `members`, `view` und `mySeat` aus `state`
werden ohne weitere Prüfung übernommen, und der Gast rechnet seinen Preis aus dieser Ansicht ab.

Besucherzählung: nur `GK.track('online-' + id, 'Online: ' + name)` beim Eröffnen/Beitreten – nie Codes,
Namen oder IDs (CLAUDE.md).

---

## 8. Stolperfallen

- **`act` ist die einzige Verteidigungslinie.** Zahlen mit `Number`/`Math.floor` holen, auf
  Endlichkeit und Bereich prüfen, Phase und Platz prüfen (siehe `battleship.js:cleanFleet`,
  `minigolf.js:act`). `false` zurückgeben, ohne den Zustand anzufassen.
- **Zustand nur beim Gastgeber ändern.** `draw` darf `view` nie verändern; lokale Auswahl (z. B.
  gewähltes Feld in `kniffel.js`, `pick`) lebt außerhalb des Zustands.
- **Geheimes gehört in `view`, nicht ins CSS.** `view: st => JSON.parse(JSON.stringify(st))` ist nur
  für Spiele ohne Geheimnisse richtig. Wer `view` als neues Objekt baut (Mau-Mau, Seeschlacht), muss
  `id`, `name`, `avatar`, `isBot`, `place`, `out`, `badge` selbst übernehmen – `payoutFor` zählt
  Menschen über `view.players[].isBot`, `placeOf` liest die Ansicht.
- **`placeOf` läuft beim Gast auf der Ansicht** und löst die Auszahlung aus. Plätze müssen deshalb in
  der Ansicht stehen und dürfen sich nach der Vergabe nicht mehr ändern (abgerechnet wird einmal).
- **`timeout` und `botAct` müssen gültige Aktionen liefern.** Weist `act` sie ab, plant `room.js`
  nichts Neues (`afterHostChange` läuft nur nach gültiger Aktion) und das Spiel steht.
- **Bedenkzeit hängt an `step:actor`** (`turnKey`). Jede gültige Aktion erhöht `step` und startet die
  Frist neu, auch wenn derselbe Spieler dran bleibt.
- **`autoDelay` hat Vorrang.** Solange es eine Zahl liefert, gibt es weder Computer-Zug noch Zeitablauf.
- **Phasen ohne `actor`** (`-1`) brauchen `autoDelay` oder `canAct` + `phaseDeadline`, sonst wartet das
  Spiel ewig. Gegen Computer gibt es keine Fristen (Seeschlacht: Aufstellen ohne Zeitlimit).
- **`forfeit` in jeder Phase.** Es wird beim Verlassen, nach 90 s offline und beim Gehen des
  Gastgebers aufgerufen – auch während `rolling`/`reveal` und wenn der Spieler gerade dran ist.
- **Zustand klein und JSON-fähig halten.** Er wird nach jeder Aktion gespeichert und an jeden Gast
  geschickt; Protokolle kürzen (`log.length = 30…40`). Zeitpunkte nur als Zeitstempel des Gastgebers
  (`placeUntil`) – Gäste bekommen Restzeiten über `turnLeft`.
- **Texte im Zustand sind nicht übersetzt.** `st.log` und die Fehlermeldungen des Gastgebers
  (`error.message`, `closed.reason`) entstehen als deutsche Strings beim Gastgeber und werden beim Gast
  unverändert angezeigt.
- **Fremde Texte maskieren** (`esc`, `GK.cosmetics.nameTag`), auch im Protokoll.
- **Zahlen über 2^64** in Nachrichten sind durch den JSON-Ausweichweg in `send` abgedeckt – in eigenen
  Feldern trotzdem keine `Infinity`/`NaN` (gehen bei JSON verloren).
- **Kein eigenes `GK.casino.bet/payout`** im Spiel: Geld bewegt ausschließlich `room.js`.
- **Versionsnummer** in `index.html` bei jeder JS/CSS-Änderung erhöhen. Ändert sich das
  Nachrichtenformat oder die Bedeutung des Zustands unverträglich, `PROTOCOL` erhöhen (dann lehnt der
  Gastgeber alte Fassungen mit einer Meldung ab).
- **Node-Tests** haben kein DOM, kein `GK.icon`, kein `GK.cosmetics`: Regeln und Darstellung trennen,
  `ic = name => (GK.icon ? GK.icon(name) : '')` wie in den vorhandenen Spielen.

---

## 9. Offene Punkte

- `minPlayers` steht in jeder Definition, wird in `room.js` aber nirgends gelesen. Ob das Absicht ist,
  geht aus dem Code nicht hervor.
- Mau-Mau und Seeschlacht übernehmen in ihrer `view` nur `badge`, nicht `fig`/`rank`. Vermutlich fehlen
  dadurch Figur und Rang am Namen in diesen beiden Spielen – nicht im Browser geprüft.
- `intro: GK.t(...)` und `GK.t(d.name)` in `registerGame` werden beim Laden der Skripte ausgewertet,
  also vor `GK.load()`. Ob dabei schon die gespeicherte Sprache gilt bzw. was nach dem Umschalten der
  Sprache passiert, wurde nicht geprüft.
- Welchen Vermittlungsserver PeerJS ohne `GK_PEER_OPTIONS` nutzt, steht nicht im Repo (Standard der
  Bibliothek).
- Verlässt ein Gast das laufende Spiel ohne Verbindung (vor Ablauf der 30 s), rechnet er lokal ab; die
  Nachricht `leave` kommt dann nicht an und der Gastgeber wertet ihn erst nach 90 s als ausgeschieden.
  Ob beide Seiten dabei immer denselben Platz ermitteln, ist nicht durch Tests abgedeckt.
- Es gibt keine Tests für `room.js` mit echter Verbindung; getestet sind Regeln der Spiele und
  `prize`/`payoutFor`.
