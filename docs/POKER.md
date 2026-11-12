# Poker (Texas Hold'em) und Freundes-Rangliste

Entwickler-Notizen für KI-Agenten. Alles hier ist aus dem Code abgelesen; Stellen, die der Code
nicht eindeutig beantwortet, sind mit **(unklar)** markiert. Projektregeln stehen in `CLAUDE.md`.

## 1. Dateien und Aufrufwege

| Datei | Namensraum | Aufgabe | Ruft auf |
|---|---|---|---|
| `js/casino/cards.js` | `GK.cards` | Kartenformat, Kartenstapel, Karten-HTML | `GK.rng.shuffle`, `GK.t` |
| `js/poker/evaluator.js` | `GK.poker.evaluate`, `CATEGORY_NAMES`, `fullHouseOrBetter` | beste 5er-Hand aus 5–7 Karten | – |
| `js/poker/engine.js` | `GK.poker.engine` | Spiellogik auf einem reinen Datenobjekt („Tisch“) | `GK.cards`, `GK.poker.evaluate`, `GK.rng.int` |
| `js/poker/ai.js` | `GK.poker.ai` | Computer-Gegner (Equity + Persönlichkeit) | `engine`, `evaluate`, `GK.cards` |
| `js/poker/tournament.js` | `GK.poker.tournament` | Tische, Modi, Blinds, Preise, Blitz, ICM | `engine.createTable`, `ai.BOTS`, `GK.rng.shuffle` |
| `js/poker/table-ui.js` | `GK.poker.ui` | Zeichnet den Tisch (für beide Spielarten) | `engine`, `evaluate`, `GK.cards`, `GK.cosmetics`, `GK.fx`, `GK.sound` |
| `js/poker/multiplayer.js` | `GK.poker.mp` | Raum mit Freunden über PeerJS | alle oben, `GK.friends`, `GK.casino`, `GK.poker.redraw/singleActive` |
| `js/poker/poker.js` | `GK.poker.redraw`, `GK.poker.singleActive` | Casino-Spiel `poker`: Lobby + Turnier gegen Computer | alle oben, `GK.casino.register` |
| `js/friends.js` | `GK.friends` | Freundes-Rangliste (Rekorde austauschen, merken, anzeigen) | `GK.state`, `GK.player`, `GK.cosmetics`, `GK.clicker`, `GK.progress`, `GK.rank`, `GK.figure` |

Ladereihenfolge in `index.html`: PeerJS 1.5.4 (cdnjs) → … `friends.js` → `casino/cards.js` → …
`evaluator` → `engine` → `ai` → `tournament` → `table-ui` → `multiplayer` → `poker` → `mp/room.js`.

Einstiegspunkte von außen:

- `js/poker/poker.js` meldet sich per `GK.casino.register({ id: 'poker', init, refresh, onShow, render })` an.
  `render` läuft im Spieltakt und ruft nur `GK.poker.mp.render` (Countdown) bzw. `updateLobbyButtons`.
- `js/main.js` ruft `GK.poker.mp.readInviteLink()` und `GK.poker.mp.resume()` beim Start, `resume()` außerdem
  nach dem Ersetzen des Spielstands; `GK.friends.render()` aus `renderStats`.
- `poker.js:drawView` entscheidet: `mp.active()` → `mp.draw(body)`, sonst eigener Tisch oder Lobby
  (die Lobby bettet `mp.renderJoinPanel` ein).

## 2. Karten und Handbewertung

**Kartenformat** (`cards.js`): Text aus Rang + Farbe, z. B. `'AS'`, `'TH'`. Ränge `2…9 T J Q K A`,
Farben `S H D C`. Die Anzeige nutzt deutsche Bilder (`J`→B, `Q`→D, per `GK.t` für Englisch zurückübersetzt).

`GK.cards`: `createDeck(decks = 1)` (gemischt über `GK.rng.shuffle`), `rank(card)`, `suit(card)`,
`rankValue(card)` (2…14), `label(card)` (Text wie `10♥`, fürs Protokoll),
`html(card, hidden = false, extraClass = '', style = '')` (`hidden` oder `card` leer/`null` → Rückseite).

**`GK.poker.evaluate(cards)`** – `cards`: Array mit 5 bis 7 Karten →
`{ score, category, name }`.

- `category` 0…8 = Index in `CATEGORY_NAMES`: Höchste Karte, Ein Paar, Zwei Paare, Drilling, Straße, Flush,
  Full House, Vierling, Straight Flush. `name` ist der deutsche Name; bei Straight Flush bis zum Ass `'Royal Flush'`
  (gleiche Kategorie 8).
- `score` (`makeScore`): `category`, danach fünf Kicker-Stellen zur Basis 15
  (`score = score * 15 + kicker`). Größer = besser, gleich = geteilter Pot. Nur innerhalb eines Aufrufs
  vergleichbar machen heißt: immer alle verfügbaren Karten (Hand + Board) übergeben.
- Ass zählt in der Straße auch als 1 (`straightHigh`, 5-4-3-2-A hat Höchstkarte 5).
- Zwei Drillinge ergeben ein Full House (`groups[1].n >= 2`); bei drei Paaren ist der Kicker die höchste
  übrige Karte (Test `two pair kicker from third pair`).
- `GK.poker.fullHouseOrBetter(name)` – prüft den **Namen** (für den Erfolg `pokerRoyal`).

Die Namen sind deutsche Quelltexte und zugleich Übersetzungsschlüssel (`table-ui.js` meldet die englischen
Fassungen an und ruft `GK.t(name)`).

## 3. Engine (`js/poker/engine.js`)

Die Engine kennt **weder Bildschirm noch Dublonen noch Zeit**: keine DOM-Zugriffe, kein `GK.earn/spend`,
keine Timer, kein `GK.t`. Sie verändert nur das Tisch-Objekt. Das Objekt ist JSON-fähig (Test:
`JSON.parse(JSON.stringify(t))` in jeder Lage) – deshalb kann es gespeichert und verschickt werden.

### Tisch-Objekt (`createTable({ seats, startChips, blindLevels, handsPerLevel })`)

`seats: [{ id, name, isBot, personality }]`

| Feld | Inhalt |
|---|---|
| `players[]` | siehe unten; der Index ist der „Platz“ (`seat`) |
| `blindLevels` | `[{ sb, bb }]` |
| `handsPerLevel` | Hände je Blind-Stufe |
| `level` | aktuelle Stufe (Index) |
| `handNo` | Nummer der Hand (0 vor der ersten) |
| `dealer` | Platz des Dealers (Start: `GK.rng.int`) |
| `deck` | restlicher Stapel (geheim!) |
| `board` | Gemeinschaftskarten (0–5) |
| `street` | `'preflop' \| 'flop' \| 'turn' \| 'river'` |
| `toAct` | Platz am Zug, `-1` = niemand |
| `currentBet` | höchster Einsatz der Setzrunde |
| `minRaise` | Mindest-Erhöhung (Differenz) |
| `phase` | `'waiting' \| 'betting' \| 'handOver' \| 'finished'` |
| `result` | `null` oder `{ winners: [{ seat, amount, hand }], showdown, hands? }` (`hands`: Platz → Handname, nur beim Showdown; `hand` ist `null` ohne Showdown) |
| `log` | neueste Zeile zuerst, höchstens 40 (`LOG_LENGTH`), deutsche Texte |

Spieler: `id, name, isBot, personality, chips, bet` (diese Setzrunde), `total` (diese Hand), `cards`,
`folded, allIn, acted, out, place, lastAction`.

Zusätze von außerhalb der Engine: `tournament.createTable` setzt `table.mode`, `table.maxHands` (nur Blitz) und
je Spieler `avatar`, `badge`, `fig`, `rank`; `multiplayer.js` setzt `player.offline`.

### Schnittstelle

`GK.poker.engine = { createTable, startHand, legalActions, act, forfeit, pot, blinds, inHand, canAct }`

| Funktion | Bedeutung |
|---|---|
| `startHand(t)` | neue Hand; bei weniger als 2 Aktiven stattdessen `finishIfDecided` |
| `legalActions(t)` | `null` (nicht in `betting`) oder `{ toCall, canCheck, canRaise, minRaiseTo, maxRaiseTo, pot }` |
| `act(t, { type, to? })` | Aktion des Spielers `t.toAct`; `true`, wenn ausgeführt |
| `forfeit(t, seat)` | Spieler gibt das Turnier auf |
| `pot(t)`, `blinds(t)` | Summe aller `total`; `t.blindLevels[t.level]` |
| `inHand(p)`, `canAct(p)` | nicht `out`/`folded`; zusätzlich nicht `allIn` |

### Ablauf einer Hand

1. `startHand`: `handNo++`, `level = min(floor((handNo-1)/handsPerLevel), letzte Stufe)`, Dealer weiter,
   Spieler zurücksetzen (`folded = out`), neuer Stapel, je 2 Karten, Blinds per `pay` (deckelt auf vorhandene
   Chips, setzt `allIn`). Heads-up: der Dealer setzt den Small Blind. `currentBet = minRaise = bb`,
   `toAct = bbSeat`, dann `advance` → erster Spieler nach dem Big Blind.
2. `act` → `advance`: nur noch einer in der Hand → `awardUncontested`; sonst nächster Platz mit
   `canAct && (!acted || bet < currentBet)`; gibt es keinen → `nextStreet`.
3. `nextStreet`: `bet`/`acted` zurück, `currentBet = 0`, `minRaise = bb`; nach dem River → `showdown`; sonst
   Brennkarte, Karten aufs Board, Protokoll. Können höchstens noch einer setzen, ruft es sich selbst weiter auf
   (Karten werden einfach aufgedeckt). Sonst `toAct` = erster `canAct` nach dem Dealer.
4. `showdown` oder `awardUncontested` → `endHand(t, result)`: `phase = 'handOver'`, `toAct = -1`, Spieler mit
   0 Chips scheiden aus (`out`, `place`), dann `finishIfDecided` (ein Aktiver übrig → `place = 1`,
   `phase = 'finished'`).
5. Der Aufrufer startet die nächste Hand selbst (`startHand`) – die Engine wartet in `handOver`.

### Aktionen (`act`)

`type`: `'fold' | 'check' | 'call' | 'raise'`; `to` ist beim Erhöhen der **Zielbetrag** der Setzrunde, nicht
die Differenz. Unpassende Aktionen werden umgedeutet statt abgelehnt: `check` ohne Erlaubnis → `call`, `call` bei
`canCheck` → `check`, `raise` ohne `canRaise` → `check`/`call`. `to` wird auf `[minRaiseTo, maxRaiseTo]`
begrenzt und abgerundet. Unbekannter `type` → `false`.

- `canRaise` verlangt, dass noch ein anderer Spieler handeln kann.
- Nur eine **volle** Erhöhung (`raiseBy >= minRaise`) setzt `minRaise` neu und öffnet die Runde wieder
  (`acted = false` bei allen anderen). Ein kleineres All-in hebt nur `currentBet`.
- `lastAction`/Protokoll: `'Fold'`, `'Check'`, `'Call N'`, `'Erhöht auf N'`, `'All-in'`, `'Small Blind'`,
  `'Big Blind'`, `'Aufgegeben'`.

### Side-Pots (`showdown`)

Kein gespeichertes Pot-Objekt: Die Töpfe werden beim Showdown aus den `total`-Werten berechnet. Für jede
Einsatz-Stufe der verbliebenen Spieler (aufsteigend) ein Topf: `Σ min(total, stufe) − min(total, vorige)`
über **alle** Spieler (auch gepasste). Anspruch haben verbliebene Spieler mit `total >= stufe`; der beste
`score` gewinnt, bei Gleichstand wird geteilt, Restchips bekommt der erste Gewinner links vom Dealer
(`orderFromDealer`). Chips oberhalb der höchsten Stufe (nur von gepassten Spielern möglich) gehen als
„Sicherheitsnetz“ an den letzten Gewinner.

### Ausscheiden und Aufgeben

- `endHand`: Scheiden mehrere gleichzeitig aus, bekommt den besseren Platz, wer mehr Chips in die Hand
  gebracht hat (`total`).
- `forfeit(t, seat)`: `place` = Zahl der noch Aktiven, `out = folded = true`, `chips = 0` (verfallen – die
  Chip-Summe am Tisch sinkt), Einsätze bleiben im Pot. War er am Zug → `advance`; bleibt nur einer in der Hand →
  `awardUncontested`. Außerhalb von `betting` → `finishIfDecided`.

## 4. Turnier (`js/poker/tournament.js`)

Konstanten: `START_CHIPS = 1500`, `HANDS_PER_LEVEL = 8`, `MAX_SEATS = 6`, `BLITZ_HANDS = [3, 5, 10]`.

**Blind-Stufen** (`BLIND_LEVELS`, sb/bb): 10/20, 15/30, 25/50, 50/100, 75/150, 100/200, 150/300, 200/400,
300/600, 500/1000, 800/1600, 1000/2000, 1500/3000, 2000/4000 (danach bleibt die letzte Stufe).

**Modi** (`MODES`, `mode(id)` – unbekannt/fehlend → `classic`):

| | `classic` | `turbo` | `blitz` |
|---|---|---|---|
| Start-Chips | 1500 | 1000 | 1000 |
| Hände je Stufe | 8 | 3 | 1 |
| `botDelay` / `botDelayWatching` (ms) | 900 / 350 | 380 / 120 | 380 / 120 |
| `nextDelay` / `nextDelayShowdown` (ms) | 2500 / 4500 | 1200 / 2200 | 1200 / 2200 |
| `turnTime` (ms, nur mit Freunden) | 30000 | 15000 | 15000 |
| Ende | einer hat alle Chips | einer hat alle Chips | nach `maxHands` Händen |

Blitz (`tableSettings`): `blindLevels = BLIND_LEVELS.slice(max(0, 9 − n))`, also endet die letzte Hand bei 3 und
5 Händen auf 300/600, bei 10 Händen auf 500/1000. `blitzHands(n)` lässt nur 3, 5, 10 zu (sonst 5).

**Tische gegen Computer** (`TIERS`, `tier(id)`; id · Eintritt · nötige VIP-Stufe, geprüft in
`poker.js:tierBlockReason` über `GK.casino.vipLevel()`): `harbor` Hafenkneipe 1.000 · 0 — `captain` Kapitänstisch
1e5 · 1 — `royal` Königlicher Salon 1e7 · 2 — `diamond` Diamanten-Saal 1e9 · 3 — `pearl` Perlen-Lounge 1e11 · 4 —
`throne` Thron des Kaisers 1e13 · 5.

Der Kommentar bei `TIERS` nennt die VIP-Stufe auch für „einen Raum eröffnen“; `multiplayer.js` prüft aber
keine VIP-Stufe und nutzt `TIERS` nicht (freier Eintritt ab 100). **(unklar, ob gewollt)**

**Preise**

| Funktion | Ergebnis |
|---|---|
| `prizeShares(players)` | ≥6: `[0.5, 0.3, 0.2]` · 4–5: `[0.65, 0.35]` · 3: `[0.7, 0.3]` · 2: `[1]` |
| `prize(place, entry, players, paying = players)` | `floor(entry × paying × Anteil)`, sonst 0. Gegen Computer ist `paying = 6 × 0,95` (`poker.js:SOLO_PAYING`, 95 % wie die anderen Spiele gegen Computer): 2,85× / 1,71× / 1,14× Eintritt |
| `blitzPaidPlaces(players)` | `min(4, max(1, players − 2))` |
| `blitzPayouts(stacks, entry, players, paying = players)` | Die Besten teilen `entry × paying` im Verhältnis ihrer Chips (abgerundet); Gleichstand an der Grenze zählt mit; Stack 0 bekommt nichts |
| `handLimitReached(t)` | Blitz, `phase === 'handOver'`, `handNo >= maxHands` |
| `finishByChips(t)` | Plätze nach Chips (Gleichstand: kleinerer Platz-Index), `phase = 'finished'` |
| `payout(t, seat, entry, paying = t.players.length)` | nicht Blitz: `prize(p.place, …)`; Blitz: 0 solange `out` oder nicht `finished`, sonst `blitzPayouts[seat]` |
| `icm(stacks, prizes)` | erwarteter Preis je Spieler (Malmuth-Harville) |
| `cashOutValue(t, seat, entry)` | Wert des Platzes beim Aussteigen |
| `createTable(seats, modeId, hands)` | Engine-Tisch + `mode`, `maxHands`, `avatar/badge/fig/rank` |
| `botSeats(count)` | zufällige Bots aus `ai.BOTS`, ids `bot0…` |
| `modeLabel(modeId, hands, plain)` | z. B. „Blitz · 5 Hände“, mit Symbol außer bei `plain` |

`paying` = Zahl derer, die wirklich Eintritt bezahlt haben. Gegen Computer ist es die Tischgröße (6), mit
Freunden die Zahl der Menschen (`multiplayer.js:mpPayout`).

**Anteilige Auszahlung** (`cashOutValue`, nur gegen Computer genutzt): Stacks der Aktiven; läuft eine Hand,
zählen die Einsätze (`total`) mit, die eigenen sind aber verloren und werden gleichmäßig auf die nicht gepassten
anderen verteilt. Klassisch/Turbo: `floor(icm(stacks, Preise für Platz 1…Aktive)[seat])`. Blitz:
`blitzPayouts(stacks, …)[seat]`, als wäre jetzt Schluss. Tests: Summe aller Werte + schon vergebene Preise
≤ Preisgeld; zwischen zwei Händen fehlen höchstens Rundungsreste.

`handLimitReached`/`finishByChips` ruft **nicht** die Engine auf – das muss der Aufrufer nach jeder Änderung tun
(`poker.js:afterChange`, `multiplayer.js:afterHostChange`).

## 5. Computer-Gegner (`js/poker/ai.js`)

`GK.poker.ai = { BOTS, equity, decide }`

- `equity(holeCards, board, opponents, simulations = 300)` → 0…1. Monte-Carlo: unbekannte Karten teilweise
  mischen (`Math.random`, nicht `GK.rng`), Board auffüllen, jedem Gegner 2 Zufallskarten geben, vergleichen.
  Gleichstand zählt `1 / (ties + 1)`.
- `decide(t)` → Aktion für `t.toAct`. Größen: `strength = eq × (Gegner + 1)` (1 = Durchschnitt),
  `potOdds = toCall / (pot + toCall)`, `expensive = toCall > pot × 0,5`,
  `raiseThreshold = 1,55 − aggr × 0,45 (+ 0,6 wenn teuer)`.
  1. Erhöhen, wenn `canRaise && strength >= raiseThreshold && roll < 0,6 + aggr × 0,35`
     (Größe: Pot × 0,5–0,9, bei `strength > 2,2` Pot × 0,9–1,5).
  2. Bei `canCheck`: Bluff-Erhöhung mit `roll < bluff × 0,2` (halber Pot), sonst Check.
  3. Call, wenn `eq >= potOdds × (1 + tight × 0,5)`.
  4. Selten Bluff-Erhöhung (`roll < bluff × 0,06`, nicht wenn teuer), sonst Fold.
  `raiseTo(factor)`: auf Vielfache des Big Blind gerundet, mindestens `minRaise`; läge das Ziel über 60 % von
  `maxRaiseTo` → gleich All-in.

| Bot | tight | aggr | bluff |
|---|---|---|---|
| Käpt'n Blaubart | 0,3 | 0,7 | 0,4 |
| Einäugige Jenny | 0,7 | 0,3 | 0,1 |
| Smutje Karl | 0,1 | 0,2 | 0,15 |
| Long John | 0,4 | 0,9 | 0,6 |
| Die Holländerin | 0,5 | 0,5 | 0,3 |
| Rum-Rudi | 0,15 | 0,5 | 0,5 |

Ohne `personality`: `{ tight: 0.5, aggr: 0.5, bluff: 0.2 }`.

**Aufwand**: je Entscheidung 300 Simulationen × (1 + Gegner) Aufrufe von `evaluate`, synchron. Die Tests
spielen 30 komplette Turniere damit durch. `poker.js:fastForward` ruft `decide` bis zu 200-mal am Stück.

## 6. Gegen Computer (`js/poker/poker.js`)

Zustand: `GK.casino.data('poker')` = `{ table, tierId, lastResult, mode, hands }` – immer über `state()` lesen,
nie eine Referenz aufheben (beim Import wird `GK.state` ersetzt; gilt genauso für `store()`/`session()` in §7).

- `table`: das komplette Engine-Objekt (inklusive `deck`) oder `null`. `mode`/`hands` sind die Wahl in der Lobby;
  im laufenden Turnier gilt `table.mode` (alte Spielstände ohne Feld → klassisch).
- `lastResult`: `{ place, prize, tierName, entry, left, mode }` für die Meldung in der Lobby.
- Der Mensch sitzt immer auf Platz 0 (`HUMAN`), dazu 5 Bots (`SEATS = 6`).

Ablauf:

| Schritt | Funktion |
|---|---|
| Platz nehmen | `join(tierId)`: prüft VIP/Guthaben und dass kein Raum aktiv ist (`GK.poker.mp.active()`, `GK.room.active()`), `GK.casino.bet(entry)`, Tisch anlegen, `startHand` |
| eigene Aktion | `humanAct` → `engine.act` |
| Bot-Zug | `botStep` → `ai.decide` → `engine.act` |
| nach der Hand | `continueAfterHand`: `finished` oder selbst `out` → `finishTournament`, sonst `startHand` |
| vorspulen | `fastForward` (nur wenn `canSkip`: gepasst oder All-in) |
| aussteigen | `leaveTable`: Wert berechnen, `confirm`, `engine.forfeit`, `finishTournament(wert)` |

**Speichern/Fortsetzen**: Jede Änderung endet in `afterChange` (Blitz-Ende prüfen, Erfolg `pokerRoyal`,
`GK.save()`, `drawView`, `schedule`). Nach dem Neuladen liegt der Tisch wieder in `state().table` und
`refresh`/`onShow` setzt den Ablauf fort. `schedule` plant den nächsten Schritt per `setTimeout` nur, wenn der
Tisch sichtbar ist (`body.offsetParent !== null`); sonst pausiert das Turnier, bis man zurückkommt. Am Ende
mindestens 4 s Pause.

**Abrechnung** (`finishTournament(cashOut)`): `win = cashOut` (ausgestiegen) oder
`T.payout(t, HUMAN, entry)`; `GK.casino.payout(win)`; `table = null`;
`GK.casino.record('poker', entry, win, text)`. Erfolge nur bei Platz 1 ohne Aussteigen: `pokerWin`,
`pokerTurbo`, `pokerBlitz`, `pokerThrone`. Wer ausscheidet, wird sofort abgerechnet (der Rest des Turniers wird
nicht weitergespielt).

Für andere Module: `GK.poker.redraw()` (neu zeichnen) und `GK.poker.singleActive()` (läuft ein Computer-Turnier?).

## 7. Mit Freunden (`js/poker/multiplayer.js`)

### Verbindung

- **PeerJS 1.5.4** (WebRTC-Datenkanal, `reliable: true`); der öffentliche PeerJS-Server vermittelt nur.
  `window.GK_PEER_OPTIONS` kann für Tests einen eigenen Server eintragen. Fehlt `window.Peer` → Hinweis, kein
  Multiplayer.
- **Raum-Code**: 5 Zeichen aus `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`. Peer-ID des Gastgebers:
  `'gamble-klicker-' + code`. Ist die ID bei einem frischen Raum vergeben (`unavailable-id`), wird ein neuer Code
  gewürfelt. Mitspieler bekommen eine zufällige Peer-ID.
- **Einladungs-Link**: `…?raum=CODE` (`readInviteLink` öffnet Casino → Poker und füllt das Code-Feld; ignoriert
  Links mit `spiel=` ≠ `poker`).
- **Stern-Topologie**: Mitspieler sind nur mit dem Gastgeber verbunden (`net.conns` beim Gastgeber, `net.hostConn`
  beim Mitspieler).
- **Herzschlag**: alle 2 s `ping` in beide Richtungen; 8 s ohne Nachricht → Verbindung gilt als getrennt.
  Mitspieler versuchen alle 3 s neu (`RETRY_DELAY`), Verbindungsaufbau bricht nach 10 s ab.

### Gastgeber-Modell

Der Gastgeber führt als Einziger die Engine aus, steuert Bots und Bedenkzeit und kennt alle Karten. Mitspieler
schicken Aktionen und zeichnen nur die empfangene Ansicht. Nach jeder Änderung: `afterHostChange` (Bedenkzeit,
Blitz-Ende, eigene Abrechnung, `GK.save`, `broadcast`, `redraw`, `scheduleHost`).

`scheduleHost`: Bot → `hostBotStep` nach `botDelay`; Mensch → `hostTimeout` bei Ablauf von `deadline` (Check, wenn
möglich, sonst Fold); nach der Hand → `hostNextHand` nach `nextDelayShowdown` bzw. `nextDelay + 500`.
Bedenkzeit: `turnTime` des Modus, bei `offline` nur 5 s. `turnKey(t)` erkennt, ob ein neuer Zug begonnen hat.

### Nachrichten (`PROTOCOL = 4`, seit dem Platz-Token)

| Richtung | `type` | Felder | Wirkung |
|---|---|---|---|
| M → G | `hello` | `v, playerId, secret, name, avatar, fig, rank, badge, paid, records` | Anmelden/Wiederverbinden. Falsches `v`, Spiel läuft schon (unbekannte `playerId`), Raum voll, falsches Platz-Token oder entfernt → `error` (fatal). Eine Verbindung gehört genau einer `playerId` |
| M → G | `join` | – | Eintritt bezahlt → `member.ready = true` (nur im Warteraum) |
| M → G | `action` | `action: { type, to }` | Zug; wird mit `cleanAction` bereinigt und nur angenommen, wenn der Platz am Zug ist |
| M → G | `records` | `records` | neue Rekorde nach der Abrechnung (Rangliste) |
| M → G | `leave` | – | Warteraum: Mitglied entfernen; im Spiel: `engine.forfeit` |
| G → M | `state` | `v, code, entry, mode, hands, phase, hostId, fillBots, members[]`, mit Tisch zusätzlich `view, mySeat, turnLeft` | kompletter Stand, bei jeder Änderung an alle |
| G → M | `error` | `fatal, message` | fatal → Raum verlassen mit Erstattung; sonst Toast |
| G → M | `secret` | `secret` | Platz-Token, nur an diesen Mitspieler (gespeichert, mit jedem `hello` zurück) |
| G → M | `kicked` | – | im Warteraum entfernt (Knopf „Entfernen“) → verlassen mit Erstattung |
| G → M | `closed` | `reason, forfeit` | Gastgeber hat geschlossen → verlassen mit Erstattung; `forfeit` (Aufgabe mitten im Turnier): Eintritt plus Anteil am Eintritt des Gastgebers |
| beide | `ping` | – | Lebenszeichen |
| beide | `json` | `data` (JSON-Text) | Umschlag, falls `conn.send` scheitert (PeerJS verpackt sehr große ganze Zahlen nicht); `unpack` packt aus |

`members[]`: `{ playerId, name, avatar, fig, rank, badge, ready, online, records? }` (`GK.friends.membersOut`;
`records` nur außerhalb von `phase === 'playing'`). `turnLeft` ist eine Restzeit in ms (keine Uhrzeit), der
Mitspieler rechnet `Date.now() + turnLeft`. Die Texte in `error.message`/`closed.reason` sind deutsche
Klartexte vom Gastgeber; der Mitspieler zeigt sie über `GK.t` (Übersetzungen in `room.js` angemeldet).

### Geheime Karten

`viewFor(t, seat)`: tiefe Kopie ohne `deck` und ohne `personality`; fremde Karten werden zu `null` (Anzahl bleibt),
außer beim Showdown für Spieler, die noch in der Hand sind. `table-ui.js` zeichnet `null` als Rückseite.
Zuschauer/Unbekannte bekommen `mySeat = -1`.

### Sitzung und Wiederverbinden

Gespeichert in `GK.casino.data('pokerMp')` = `{ playerId, lastEntry, lastMode, lastHands, session, lastResult }`.
`playerId` (16 Zeichen) ist dauerhaft und identifiziert den Spieler am Tisch (`players[].id`).

| `session`-Feld | Gastgeber | Mitspieler |
|---|---|---|
| `role` | `'host'` | `'client'` |
| `code`, `entry`, `mode`, `hands`, `members`, `fillBots` | ja | ja (vom Gastgeber übernommen) |
| `phase` | `'lobby' \| 'playing' \| 'ended'` | zusätzlich `'connecting'` |
| `paid`, `settled`, `result` | ja | ja |
| Tisch | `table` (voll) | `view`, `mySeat` |
| sonst | `fresh`, `deadline`, `turnKey` | `joined`, `hostId`, `deadline` |

`net` (Peer, Verbindungen, Status) wird **nicht** gespeichert. `resume()` baut nach dem Laden alles neu auf:
Gastgeber meldet sich mit demselben Code an und startet die Bedenkzeit neu; Mitspieler verbinden sich und senden
`hello` mit `paid`. Bekannte `playerId` darf auch im laufenden Spiel zurück.

Verbindungsabbruch: im Warteraum wird das Mitglied entfernt; im Spiel `player.offline = true`. Nach 90 s
(`DROP_AFTER`) ohne Verbindung bricht der Gastgeber das Turnier für alle mit Erstattung ab (`dropAbsentPlayers` →
`abortForAll`), aber nur solange er selbst online ist. Ist der Gastgeber 30 s (`ABANDON_AFTER`) nicht erreichbar,
darf ein Mitspieler mit Erstattung abbrechen – beides passt zusammen, es entsteht kein Geld aus dem Nichts.
Verlässt der Gastgeber das laufende Turnier, gibt er auf: Mitspieler, die noch dabei sind, bekommen ihren
Eintritt zurück und teilen sich seinen (`closed` mit `forfeit` → `hostForfeited`).

### Computer-Gegner im Raum

`session.fillBots` (Standard an): `startGame` füllt auf `MAX_SEATS` mit `T.botSeats` auf. Bots zahlen keinen
Eintritt; das Preisgeld sind nur die Eintritte der Menschen (`paying = humans(t)`), verteilt nach Platz bzw.
Chips unter **allen** am Tisch – einen Preis eines Bots behält das Casino. Start nur mit mindestens 2 bezahlten
Mitgliedern; wer nicht bezahlt hat, fliegt mit `error` aus dem Raum.

### Abrechnung

- Eintritt: Gastgeber in `createRoom` (`GK.casino.bet`, mindestens 100), Mitspieler erst in `clientConfirm`.
- `settle(place, players, win)`: genau einmal (`session.settled`), `GK.casino.payout`, Erfolge `pokerMpPlay`/
  `pokerMpWin`, `GK.casino.record('poker', …)`, `GK.state.friendWins++` bei Platz 1; Mitspieler senden danach
  `records`. Ausgelöst, sobald man `out` ist oder der Tisch `finished` – beim Gastgeber in `afterHostChange`,
  beim Mitspieler in `onClientMessage`. **Jedes Gerät rechnet sich selbst ab**, mit `mpPayout` auf dem eigenen
  Tisch bzw. der empfangenen Ansicht.
- `refundEntry`/`endSession(message, refund)`: Erstattung per `GK.casino.refund`, solange nicht abgerechnet.
- Aufgeben als Mitspieler (`clientLeave`): Platz = Zahl der noch Aktiven, Preis nach `T.prize`, im Blitz 0.
  Eine anteilige Auszahlung (ICM) gibt es mit Freunden nicht.

### Unterschiede zu `js/mp/room.js`

| | Poker (`multiplayer.js`) | Räume (`room.js`) |
|---|---|---|
| Peer-ID | `gamble-klicker-<code>` | `gamble-klicker-<spiel>-<code>` |
| Protokoll | `PROTOCOL = 4` | `PROTOCOL = 2`, `hello`/`state` tragen zusätzlich `game` |
| Speicher | `GK.casino.data('pokerMp')` | `GK.casino.data('room')` |
| Einladungs-Link | `?raum=CODE` | `?raum=CODE&spiel=ID` |
| Raum-Optionen | `mode`, `hands` | `settings` (je Spiel) |
| Spielregeln | fest: Engine + Turnier | über `GK.room.registerGame(def)` |
| Gegen Computer | eigener Code in `poker.js` (ohne Netz) | derselbe Ablauf als `solo` |

Nachrichtentypen, Herzschlag-Zeiten, `membersOut`/Rangliste und der Ablauf Eintritt → Abrechnung sind gleich
aufgebaut, aber **doppelt vorhanden** – Korrekturen an der Verbindungslogik gehören meist in beide Dateien.
Beide schließen sich gegenseitig aus (`GK.room.active()` / `GK.poker.mp.active()` / `GK.poker.singleActive()`).

## 8. Darstellung (`js/poker/table-ui.js`)

`GK.poker.ui = { render, tick, escapeHtml, modePicker }`

`render(container, t, opts)` zeichnet Info-Zeile, Filz (Board, Pot, Meldung, Countdown), alle Plätze, Hinweis,
Knöpfe, Protokoll und den Verlassen-Knopf. `t` ist ein Engine-Tisch **oder** eine Ansicht aus `viewFor`.

| `opts` | Bedeutung |
|---|---|
| `mySeat` | eigener Platz (immer unten Mitte; `-1` = Zuschauer) |
| `info` | Array aus HTML-Stücken über dem Tisch |
| `onAction(action)` | eigene Aktion `{ type }` bzw. `{ type: 'raise', to }` |
| `onNext`, `nextLabel` | „Nächste Hand“; `null` → nur Hinweistext |
| `onSkip` | „Hand vorspulen“ oder `null` |
| `onLeave`, `leaveLabel` | Verlassen-Knopf (`null` → versteckt) |
| `notice` | HTML-Hinweis über den Knöpfen |
| `deadline` | Zeitstempel (ms) für den Countdown |

- `tick(container)` aktualisiert nur den Countdown (wird im Takt aufgerufen).
- `modePicker(selected, hands, cls)` liefert HTML für die Modus-Wahl; die Klick-Behandlung macht der Aufrufer
  (`.poker-mode[data-mode]`, `.poker-hands-btn[data-hands]`).
- `escapeHtml(text)` – Namen und Protokollzeilen kommen von anderen Spielern.
- Sitzanordnung: `POSITIONS` für 2–6 Spieler, CSS-Klassen `seat-0…5`.
- Das Gerüst wird einmal angelegt; `setHtml` ersetzt Teile nur bei Änderung, damit ein Tipp auf einen Knopf
  nicht verloren geht, während Gegner schnell spielen. Zustand hängt am Element: `container._pokerOpts`,
  `container._pokerSeen`, `el._html`, `el._opts`.
- Animationen/Sounds (`animationState`, `playEffects`) entstehen aus dem Vergleich mit dem letzten Zeichnen;
  nach dem Neuladen wird nichts animiert. Die Sounds erkennen Aktionen per Regex im obersten Protokolleintrag.
- Einsatz-Knöpfe: Min, ½ Pot, Pot, All-in und Schieberegler; Werte werden auf `[minRaiseTo, maxRaiseTo]` begrenzt.

## 9. Freundes-Rangliste (`js/friends.js`)

Kein Server: Wer in einem Raum ist (Poker oder `room.js`), schickt seine Rekorde mit; jedes Gerät merkt sich die
Rekorde seiner Freunde (Stand vom letzten gemeinsamen Spiel).

`GK.friends = { BOARDS, myId, myRecords, clean, remember, learnFrom, membersOut, render }`

### Format (`myRecords()`)

`id` (12 Zeichen, `GK.state.friendId`, wird bei Bedarf erzeugt), `name`, `avatar`, `fig`, `badge`, `t`
(Zeitstempel), die Werte aller `BOARDS` und `games: { spielId: [größter Gewinn, größter Verlust, bester Treffer] }`
(nur Spiele mit `rounds > 0`). Test: das Ganze bleibt unter 4.000 Zeichen JSON.

| `BOARDS`-id | Name | Quelle | Format-Flag |
|---|---|---|---|
| `worth` | Vermögen mit Gebäuden | `money + GK.clicker.buildingsWorth()` | `money` |
| `rank` | Rang | `GK.rank.mine()` | `rank` |
| `boss` | Boss-Stufe | `state.boss.level` | – |
| `net` | Casino-Bilanz | `casino.won − casino.wagered` | `money`, `signed` |
| `win` | Größter Gewinn | `casino.biggestWin` | `money` |
| `lossPct` | Verlust in % vom Einkommen | `casino.biggestLossPct` (1 Nachkommastelle) | `pct` |
| `clicks` | Klicks | `state.totalClicks` | – |
| `incomeMult` | Multiplikator | `GK.progress.permanentMult()` (2 Stellen) | `mult` |
| `money` | Guthaben | `state.money` | `money` |
| `earned` | Insgesamt verdient | `state.allTimeEarned` | `money` |
| `loss` | Größter Verlust | `casino.biggestLoss` | `money` |
| `mult` | Bester Treffer | Maximum aller `stats[id].bestMult` | `mult` |
| `wins` | Siege mit Freunden | `state.friendWins` | – |
| `ach` | Erfolge | `state.achievements.length` | – |

Je Spiel gibt es `GAME_BOARDS` (Index 0–2 im `games`-Array).

### Austausch

- Mitspieler → Gastgeber: in `hello.records` und nach der Abrechnung als Nachricht `records`.
- Gastgeber: `takeRecords(member, records)` → `clean` → `member.records` + `remember`.
- Gastgeber → alle: `membersOut(members, share, myPlayerId, online)` hängt `records` nur an, wenn `share`
  (`phase !== 'playing'`, also Warteraum und Ende); die eigenen werden jedes Mal frisch erzeugt.
- Mitspieler: `learnFrom(msg.members)` → `remember` je Mitglied, `GK.save()` bei Änderung.

### Prüfung (`clean(r)`)

Empfangene Werte sind nicht vertrauenswürdig. `clean` gibt `null` zurück, wenn `id` nicht auf
`/^[A-Z0-9]{6,16}$/` passt, und baut sonst ein **neues** Objekt nur aus bekannten Feldern:

- `name` über `GK.player.cleanName`, `avatar` nur aus `GK.player.AVATARS`, `fig` über `GK.figure.valid`,
  `badge` über `GK.cosmetics.validBadge`.
- `t` höchstens jetzt (keine Zukunft).
- Jeder `BOARDS`-Wert: endliche Zahl, sonst `null` (Anzeige „–“, z. B. ältere Spielversion); negativ nur bei
  `signed`, sonst auf 0 gehoben.
- `rank`: `GK.rank.valid(floor(…))`; fehlt er, wird er aus `earned` berechnet (`GK.rank.of`).
- `games`: höchstens 80 Einträge, Schlüssel `/^[a-z0-9-]{1,24}$/`, je drei nicht negative Zahlen.

Es wird nur die Form geprüft – ob die Zahlen stimmen, kann niemand nachprüfen.

### Speicherung (`remember`)

`GK.state.friends[id] = bereinigte Rekorde + seen`. Die eigene Kennung wird ignoriert, ältere `t` ersetzen
keine neueren, höchstens 60 Freunde (die am längsten nicht gesehenen fallen heraus). Felder in `js/state.js`:
`friendId: ''`, `friends: {}`, `friendWins: 0`; `applyData` repariert ein fehlendes `friends`.

### Anzeige (`render(force)`)

Zeichnet in jedes sichtbare `.friends-board` (Casino-Übersicht und Statistik-Tab in `index.html`): Auswahl
Spiel („Gesamt“ oder ein Spiel), Knöpfe je Rangliste, Erklärung (`HINTS`), Liste mit eigener Zeile („Du“),
Stand („vor …“) und Entfernen-Knopf (`forget`). Gleiche Werte teilen den Platz, `null` steht hinten.
Aufruf aus `main.js:renderStats` im Takt; die Liste wird höchstens alle 3 s und nur bei Änderung neu geschrieben
(`el._fbControls`, `el._fbList`, `version`).

### Rezept: neue Ranglisten-Kategorie

1. Den Wert in `myRecords()` unter einer neuen id eintragen (`num(...)`, sinnvoll runden).
2. Einen Eintrag in `BOARDS` ergänzen: `{ id, icon, name }` plus Flag `money`, `mult`, `pct`, `rank` oder
   `signed` (darf negativ sein). Mehr braucht `clean` nicht – es läuft über `BOARDS`.
3. Passt kein Flag, `formatValue` erweitern.
4. Optional eine Erklärung in `HINTS`.
5. Name und Erklärung in `GK.i18n.add({...})` oben in der Datei auf Englisch anmelden.
6. Stammt der Wert aus einem neuen Spielstand-Feld: Standardwert in `js/state.js`.
7. Test in `tests/kraken.test.js` (Freundes-Teil) ergänzen; `?v=…` in `index.html` erhöhen.

Ältere Versionen schicken das Feld nicht → `null` → „–“. Die Protokollnummer muss dafür nicht steigen. Eine neue
Wertung **je Spiel** bräuchte dagegen eine vierte Stelle im `games`-Array (`GAME_BOARDS`, `myRecords`, `clean`).

## 10. Stolperfallen

- **`place` ist nicht `out`**: Im Blitz haben am Ende auch Spieler mit Chips einen Platz. `payout` unterscheidet
  das; eigene Auswertungen müssen `T.isBlitz(t)` beachten.
- **Blitz-Ende gehört dem Aufrufer**: nach jeder Engine-Änderung `handLimitReached` → `finishByChips` prüfen.
- **`raise.to` ist der Zielbetrag**, nicht der Aufschlag. `act` deutet ungültige Aktionen um, statt `false`
  zu liefern.
- **Deutsche Texte im Tisch**: `log`, `lastAction` und die Handnamen in `result` werden als deutscher Text
  gespeichert und verschickt. Handnamen übersetzt die Anzeige per `GK.t(name)`; Protokoll und `lastAction`
  bleiben deutsch. Wer Wortlaute ändert, bricht `fullHouseOrBetter` (Namen) und die Sound-Erkennung in
  `table-ui.js:playEffects` (Regex auf `Fold`, `Call`, `Erhöht`, `All-in`, `Check`).
- **`forfeit` vernichtet Chips**: die Chip-Summe am Tisch ist danach kleiner. Tests mit fester Summe gelten
  nur ohne Aufgeben.
- **`deck` nie verschicken**: Ansichten für Mitspieler immer über `viewFor`. Neue geheime Felder am Tisch
  müssen dort entfernt werden.
- **Mitspieler-Ansicht hat `null`-Karten**: Code, der `p.cards` auswertet (z. B. `evaluate`), muss das abfangen
  (`table-ui.js:renderControls` prüft `me.cards[0]`).
- **Kein Schutz gegen Schummeln**: Der Gastgeber kennt alle Karten, `hello.paid` wird geglaubt, und jedes Gerät
  zahlt sich selbst aus. Das ist so gebaut (Spielgeld unter Freunden).
- **Aufgeben als Mitspieler** rechnet den Platz lokal aus der letzten Ansicht, der Gastgeber über
  `engine.forfeit`. Ändert sich der Tisch dazwischen, können beide Werte abweichen. **(unklar, ob das in der
  Praxis auftritt)**
- **Protokoll ändern**: Bei unverträglichen Änderungen an Nachrichten oder Tisch `PROTOCOL` erhöhen – der
  Gastgeber weist andere Versionen mit einer Meldung ab. Zusätzliche, optionale Felder brauchen das nicht.
- **Gespeicherte Räume und Tische überleben Updates**: neue Felder am Tisch/an der Sitzung mit Rückfall lesen
  (Vorbild: `T.mode(t.mode)`, `T.blitzHands(hands)`).
- **Sehr große Zahlen**: `send` fällt auf den `json`-Umschlag zurück; neue Empfangswege müssen `unpack` nutzen.
- **Kommentar vs. Code**: In `multiplayer.js:drawRoom` steht „Computer-Gegner zahlen und gewinnen nichts“ –
  tatsächlich können sie Preise gewinnen, die dann das Casino behält (`mpPayout`, `tests/payouts.test.js`).
  Die Preisangabe im Warteraum ist eine Schätzung (`paying = max(2, Mitglieder)`, auch Unbezahlte zählen).
- **Timer**: Gegen Computer pausiert das Turnier, wenn der Tisch nicht sichtbar ist; der Gastgeber eines Raums
  läuft dagegen unabhängig von der Sichtbarkeit weiter (`scheduleHost`).
- **Tests**: `tests/poker.test.js` (Bewertung, Engine, Turnier), `tests/payouts.test.js` (Preise mit Freunden über
  `GK.poker.mp._payout`), `tests/kraken.test.js` (Freundes-Teil). Die Netzwerk-Schicht von `multiplayer.js` hat
  keinen Node-Test – nur im Browser prüfbar (zwei Seiten, ggf. `window.GK_PEER_OPTIONS`).
