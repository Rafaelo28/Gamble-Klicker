# Casino (Einzelspieler-Spiele) – Entwickler-Dokumentation

Für KI-Agenten, die im Casino etwas ändern oder ein Spiel hinzufügen. Alles hier ist aus dem Code belegt;
Verweise haben die Form `datei:funktion`. Projektregeln stehen in `CLAUDE.md` und gehen im Zweifel vor.

Nicht Thema: Poker (`js/poker/`) und Spiele mit Freunden (`js/mp/room.js`). Beide melden sich zwar auch mit
`GK.casino.register` an (Kategorie `table` bzw. `friends`), haben aber eigene Regeln für Geld und Verbindung.

## 1. Die Grundlage: `js/casino/casino.js`

Eine Datei, ein IIFE, zwei öffentliche Objekte: `GK.rng` (Zufall) und `GK.casino` (alles andere).
Der gespeicherte Teil liegt in `GK.state.casino` (`js/state.js:createDefaultCasino`):

| Feld | Bedeutung |
|---|---|
| `wagered`, `won`, `rounds` | Summen über alle Spiele |
| `biggestWin`, `biggestLoss`, `biggestLossPct` | Rekorde (`…Pct` = Verlust in % des dauerhaften Einkommens pro Sekunde, für die Rangliste) |
| `vip` | VIP-Stufe 0–5 |
| `history` | letzte 15 Runden: `{ game, bet, payout, text, time }` |
| `openGame` | id des zuletzt geöffneten Spiels oder `null` (Lobby) |
| `games` | `{ spielId: Zustand }` – das, was `GK.casino.data` liefert |
| `stats` | je Spiel: `{ rounds, wagered, won, wins, biggestWin, biggestLoss, bestMult, streak, bestStreak, last }` |
| `statsSince` | Zeitpunkt, ab dem `stats` zählt (alte Spielstände, gesetzt in `js/state.js:applyData`) |

### `GK.rng` – Zufall (kryptografisch, `crypto.getRandomValues`)

| Funktion | Bedeutung |
|---|---|
| `int(max)` | Ganzzahl `0 … max-1`, ohne Verzerrung (Werte über der Grenze werden neu gezogen) |
| `float()` | Zahl in `[0, 1)` |
| `weighted(items)` | Eintrag aus `[{ weight, … }]` nach Gewicht; nutzt `int(total)`, die Gewichte müssen also eine ganze Summe ergeben |
| `shuffle(array)` | mischt das Array an Ort und Stelle (Fisher-Yates) und gibt es zurück |

Für Auslosungen immer `GK.rng`, nie `Math.random` (das nur für reine Optik, z. B. `plinko.js:throwMany`).
Funktionen, die Tests mit festem Zufall füttern sollen, nehmen den Zufall als Parameter mit `GK.rng.float` als
Standard (`race.js:makeOdds(rand)`, `race.js:drawOrder(probs, rand)`).

### `GK.casino` – Geld

| Funktion | Bedeutung |
|---|---|
| `bet(amount, gameId)` → `boolean` | Bucht den Einsatz über `GK.spend` ab und erhöht `wagered`. `false` bei `amount <= 0` oder zu wenig Geld. **Prüft kein VIP-Limit** und speichert nicht. `gameId` immer mitgeben: Läuft gerade eine Glückssträhne, wird der Einsatz für dieses Spiel gemerkt (`casino.luck[gameId]`). Räume mit Freunden setzen ohne `gameId` (kein Bonus). |
| `payout(amount)` | Zahlt die komplette Rückzahlung (Einsatz + Gewinn) über `GK.earn(amount, 'casino')` aus und erhöht `won`. Bei `amount <= 0` passiert nichts – darf also ohne Abfrage immer aufgerufen werden. |
| `refund(amount, gameId)` | Gibt einen noch nicht gespielten Einsatz zurück: Geld wieder drauf, `wagered` wieder runter, gemerkter Glückssträhnen-Einsatz entsprechend weniger. Zählt nicht als Runde. Speichert nicht. |
| `runningRound(games?)` → `{ id, text }` oder `null` | Erste laufende Runde laut `RUNNING` (große Fahrt, Import) |
| `clearRunning(games?)` | Laufende Runden verfallen lassen (nach dem Import, Einsatz bleibt abgebucht) |
| `record(gameId, bet, payout, text)` | Schließt eine Runde ab – siehe unten. Speichert. |
| `data(gameId, createDefault)` | Zustand des Spiels aus `GK.state.casino.games`; legt ihn beim ersten Zugriff mit `createDefault()` an. |
| `maxBet()` | Höchster Einsatz pro Runde laut VIP-Karte (`Infinity` auf der höchsten Stufe) |
| `vipLevel()` | aktuelle Stufe 0–5 |
| `VIP_LEVELS` | Tabelle unten |
| `buyVip()` → `boolean` | Kauft die nächste Stufe über `GK.spend`, Erfolg, Speichern, Lobby neu |

`record` in dieser Reihenfolge (`casino.js:record`):

1. **Glückssträhne** (`casino.js:luckBonus`): Gilt nur für den Teil des Einsatzes, der **während** der Strähne
   gesetzt wurde (`bet(amount, gameId)` merkt ihn in `casino.luck[gameId]`; `record` verbraucht ihn). Ist
   `payout > bet`, wird `floor((payout − bet) × Anteil × Prozent)` zusätzlich über `payout()` ausgezahlt, an den
   Verlaufstext ` · 🍀 +…` angehängt und zur Auszahlung der Runde gezählt. Runden ohne Einsatz (`bet = 0`)
   bekommen nichts. Der Bonus kommt also zentral – kein Spiel rechnet ihn selbst. Geprüft in `tests/bonus.test.js`.
2. `rounds++`, Statistik je Spiel (`casino.js:countRound`): `wins` und `streak` nur bei `payout > bet`,
   `streak = 0` nur bei `payout < bet` (Einsatz zurück lässt die Serie stehen), `bestMult = payout / bet`
   nur bei `bet > 0`.
3. Rekorde `biggestWin`, `biggestLoss`, `biggestLossPct`.
4. Eintrag vorn in `history`, auf 15 gekürzt (`HISTORY_LENGTH`). `text` wird als fertiges HTML gespeichert und
   später unverändert angezeigt – also beim Aufruf schon übersetzen.
5. Erfolg `broke`, wenn nach einem Verlust weniger als 1 Dublone übrig ist.
6. **Tagesaufgaben**: `GK.daily.track('round', { game, bet, payout })`. Daraus zählen `js/daily.js` die Aufgaben
   Runden, verschiedene Spiele, bestimmtes Spiel, Gewinne und großer Treffer (`sideSlot` zählt bei den meisten nicht mit).
7. `GK.save()`, Lobby-Kästen neu (`renderLobbyInfo`), offene Statistik im Spiel neu.

### `GK.casino` – Anmeldung, Lobby, Ablauf

| Funktion | Bedeutung |
|---|---|
| `register(game)` | Meldet ein Spiel an (Objekt siehe unten). Muss beim Laden des Skripts geschehen, vor `GK.casino.init()`. |
| `registerName(id, label)` | Nur ein Name für Verlauf und Statistik, ohne Lobby-Karte (`js/side-slot.js:init` → `'sideSlot'`). |
| `gameName(id)` | `"emoji Name"` (übersetzt) bzw. der Name aus `registerName`, sonst die id |
| `list()` | `[{ id, name, emoji, category }]` aller angemeldeten Spiele (genutzt von `js/daily.js`) |
| `openGame(id)` | Öffnet ein Spiel oder mit `null`/unbekannter id die Lobby; merkt es in `openGame`, ruft `onHide`/`onShow`, meldet `GK.track('spiel-' + id, name)` |
| `createBetControl(container, options)` | Gemeinsame Einsatz-Auswahl, siehe unten |
| `gameStats(id)` | Statistik eines Spiels (Nullwerte, wenn nie gespielt) |
| `statsHTML(id)` | Die Statistik als `<dl>` (im Spiel und im Statistik-Tab) |
| `renderAllStats(el)` | Alle gespielten Spiele für den Statistik-Tab, meistgespielte zuerst |
| `init()` | Einmal beim Start (`js/main.js`): Lobby bauen, jedes `game.init` aufrufen, letztes Spiel öffnen |
| `render()` | Aus der Spielschleife, alle 100 ms (`js/main.js:RENDER_INTERVAL`): ruft `render()` des offenen Spiels |
| `refresh()` | Nach Import/Zurücksetzen (`js/main.js:refreshAll`): ruft `refresh()` aller Spiele |
| `show()` | Wenn der Casino-Tab geöffnet wird: `onShow()` des offenen Spiels |

**Spiel-Objekt für `register`:**

```js
{ id, name, emoji, desc, category,   // name/desc: deutscher Quelltext, die Lobby ruft GK.t() darauf
  init(bodyEl),                       // Pflicht. Einmal; bodyEl ist das leere .game-body des Spiels
  refresh(),                          // optional. Zustand wurde ersetzt (Import/Zurücksetzen)
  render(),                           // optional. Alle 100 ms, solange das Spiel das offene ist
  onShow(), onHide() }                // optional. Spiel wird geöffnet / durch ein anderes bzw. die Lobby ersetzt
```

`buildLobby` setzt zusätzlich `game.root` (das `<div class="casino-game" id="game-<id>">` mit Kopfzeile,
Zurück-Knopf, aufklappbarer Statistik und `.game-body`).

**Lebenszyklus:**

- `init` läuft für alle Spiele beim Start, auch für nie geöffnete. Alle vorhandenen Spiele rufen am Ende von
  `init` selbst `refresh()` auf – dort wird der gespeicherte Zustand gezeichnet und eine unterbrochene Runde
  abgerechnet (Abschnitt 2).
- `render` läuft im Takt, sobald das Spiel das offene ist – auch während ein anderer Tab zu sehen ist
  (`casino.js:render` prüft nur `root.hidden`). Deshalb dort nur Billiges über `GK.setHTML`/`GK.setText`,
  üblich ist `if (!state().round) betControl.refresh();`.
- `onShow` kommt beim Öffnen des Spiels, beim Start für das zuletzt offene Spiel und bei jedem Wechsel auf den
  Casino-Tab. `onHide` kommt **nur**, wenn ein anderes Spiel oder die Lobby geöffnet wird – nicht beim
  Tab-Wechsel und nicht beim Schließen der Seite.

**Kategorien** (`casino.js:CATEGORIES`, Reihenfolge der Bereiche in der Lobby):

| id | Titel | Spiele aus `js/casino/` |
|---|---|---|
| `slots` | Automaten | slots, vsPirate, vsOcean, vsVolcano |
| `quick` | Schnelle Spiele | scratch, wheel, plinko, mines, crash, race, flight, chicken, tower, parole, keno, stopwatch |
| `market` | Börse | stocks |
| `table` | Tischspiele | roulette, blackjack, baccarat, hilo (+ Poker) |
| `friends` | Mit Freunden | (nur `js/mp/room.js`) |

Ohne `category` landet ein Spiel in `quick`. Ein Bereich ohne Spiel wird nicht gezeichnet. Innerhalb eines
Bereichs stehen die Karten in der Reihenfolge der Anmeldung, also der `<script>`-Reihenfolge in `index.html`.

**VIP-Stufen** (`casino.js:VIP_LEVELS`; schalten außerdem Poker-Tische frei):

| Stufe | Name | Preis | Limit pro Runde | Erfolg |
|---|---|---|---|---|
| 0 | Standard | 0 | 1e4 | – |
| 1 | Silber | 2,5e5 | 1e6 | `vipSilver` |
| 2 | Gold | 5e7 | 1e8 | `vipGold` |
| 3 | Diamant | 5e9 | 1e10 | `vipDiamond` |
| 4 | Schwarze Perle | 5e11 | 1e12 | `vipPearl` |
| 5 | Kaiserkrone | 5e13 | unbegrenzt | `vipEmperor` |

**`createBetControl(container, { min, get, set, label })`** hängt Eingabefeld (versteht `500k`, `2,5M` über
`GK.parseAmount`), Min/½/×2/Max und eine Anzeige an. Jeder Wert wird auf `min … min(Geld, maxBet())`
begrenzt, bevor `set` ihn bekommt; ein zu hoher Wert aus einem alten Spielstand wird beim `refresh()`
gekappt. Rückgabe: `{ refresh(), setDisabled(bool) }`. `refresh()` gehört in das `render` des Spiels (zeigt
„nicht genug Dublonen“ und das Limit aktuell), `setDisabled(true)` während einer laufenden Runde.

## 2. Geldfluss einer Runde

Feste Reihenfolge – jede Abweichung macht entweder Neuladen teuer oder zahlt doppelt:

```
1. GK.casino.bet(einsatz, ID)    → false? Meldung, abbrechen. Vorher nichts am Zustand ändern.
2. Ergebnis auslosen (GK.rng)    – so viel wie möglich schon jetzt
3. Zustand der Runde schreiben   – s.round = {…} bzw. s.pending = {…}, mit dem Einsatz DIESER Runde
4. GK.save()                     – vor jeder Animation, vor jedem setTimeout
   … Spielzüge / Animation; nach jedem Zug, der die Runde verändert, wieder GK.save() …
5. Zustand der Runde löschen     – s.round = null / s.pending = null (so kann nichts doppelt zahlen)
6. GK.casino.payout(auszahlung)  – komplette Rückzahlung inklusive Einsatz; 0 ist erlaubt
7. GK.casino.record(id, einsatz, auszahlung, text)   – immer nach payout; speichert
8. GK.save()                     – nur nötig, wenn nach record noch Zustand geändert wurde
```

Der Einsatz steht in der Runde (`r.bet`), nicht in `s.bet` – der Spieler darf `s.bet` für die nächste Runde
ändern. Auszahlungen sind ganze Dublonen: `Math.floor(r.bet * mult)`.

### „Neuladen darf keinen Einsatz kosten“ – und nichts schenken

Nach dem Neuladen läuft `init` → `refresh` mit dem gespeicherten Zustand. Die Muster im Code:

| Muster | So geht es | Beispiele |
|---|---|---|
| **A. Ergebnis vorab, `pending`** | Beim Start Ergebnis **und fertige Auszahlung** auslosen und als `s.pending` speichern; die Animation ist nur Optik. `settle(animated)` löscht `pending`, zahlt aus, verbucht. `refresh()` ruft `if (state().pending) settle(false)`. | `slots.js:spin/settle`, `roulette.js`, `wheel.js`, `race.js`, `flight.js`, `keno.js`, `baccarat.js`, `video-slots.js`, `plinko.js` (`pending` ist dort eine Liste von Münzen, der Massenwurf steht kompakt in `s.mass`), `js/side-slot.js` |
| **B. Verdeckte Lage vorab, `round`** | Beim Start die ganze verdeckte Lage auslosen und in `s.round` speichern; jeder Zug schreibt in `round` und speichert. Nach dem Neuladen geht die Runde einfach weiter (`refresh` zeigt „läuft noch“). | `mines.js` (`round.mines`), `tower.js` (`round.broken`), `parole.js` (`round.word`), `scratch.js` (`current.fields`, `current.winMult`, `settled`) |
| **C. Zug für Zug auslosen, sofort speichern** | Das Ergebnis eines Zugs wird beim Tippen ausgelost und **vor** der Animation gespeichert bzw. abgerechnet. Ein Neuladen während der Animation ändert nichts mehr. | `chicken.js:decideStep`, `hilo.js:guess`, `blackjack.js` (Kartenschuh `s.shoe` und Runde nach jeder Aktion gespeichert), auch `parole.js:submit` und `tower.js:pick` rechnen vor dem `setTimeout` ab |
| **D. Abkassieren beim Verlassen** | Zeitabhängige Runde: Explosionspunkt und Startzeit (`Date.now()`) stehen in `round`. Wird das Spiel unsichtbar (`onHide`, `pagehide`, `visibilitychange`, Prüfung je Bild in `crash.js:step`), wird sofort abkassiert. `refresh` rechnet einen Flug aus einer alten Sitzung nach. | `crash.js` |
| **E. Rückgabe beim Laden** | Geschicklichkeit lässt sich nicht nachspielen: Beim Laden gibt es den Einsatz über `GK.casino.refund` zurück – außer die Zielzeit war schon klar vorbei, dann zählt die Runde als verloren (sonst wäre Neuladen ein Ausweg aus einer verlorenen Runde). | `stopwatch.js:resume` |
| **F. Chips auf dem Tisch** | Gesetzte, noch nicht gespielte Chips sind schon mit `bet` abgebucht und stehen in `s.bets`. Zurücknehmen = `refund`. Beim Start wandern sie in `pending` (Muster A). | `roulette.js:placeBet/clearBets`, `race.js` |
| **G. Dauerhafter Bestand** | Kaufen ist `bet`, der Bestand steht in `s.holdings`; Verkaufen ist `payout` + `record` (eine Runde = ein Verkauf, `bet` = anteilige Kaufkosten). Pleite = `record(…, kosten, 0, …)`. | `stocks.js:buy/sell/goBankrupt` |
| **H. Mehrstufige Folgerunden** | Freispiele (`s.free`) und Bonusrunde (`s.bonus`) stehen im Zustand und überleben das Neuladen; ihre Gewinne werden mit Einsatz 0 verbucht (`record(id, 0, gewinn, …)`), Freispiele gesammelt am Ende. | `video-slots.js:settle/endFree/pickChest` |

Nur im Speicher (und in `refresh` zurückzusetzen) bleibt, was kein Geld bewegt: `busy`, laufende Timer, das
halb getippte Wort (`parole.js: typed`), Animationszustand.

### Große Fahrt (Prestige)

`js/progress.js:prestigeBlocker` fragt `GK.casino.runningRound()` und gibt einen Text zurück, solange noch
Geld in einer Runde steckt – sonst ließe sich ein Einsatz über die große Fahrt retten (dabei wird `money` auf 0
gesetzt). Die Liste steht an **einer** Stelle: `GK.casino.RUNNING` (`js/casino/casino.js`), je Spiel
`{ id, on(g), clear(g), text, keep? }`. Sie gilt auch für den Import: Mit laufender Runde wird nicht importiert,
und im importierten Stand verfallen laufende Runden (`clearRunning`, außer `keep`, z. B. Aktien) – sonst ließe sich
eine Runde mit bekanntem Ausgang (Totenköpfe der Schatzinsel, Mast-Kletterei) immer wieder laden.

## 3. Rezept: neues Casino-Spiel hinzufügen

Vorlage: `js/casino/parole.js` (neuestes Spiel) oder `js/casino/tower.js` (kürzer). Checkliste:

- [ ] **Datei** `js/casino/<id>.js`. Oben ein deutscher Kopfkommentar: Regeln und wie die Runde das Neuladen übersteht.
- [ ] **Ersatz für `GK.t`/`GK.i18n`** – die zwei Zeilen wie in jeder Casino-Datei, damit die Datei in Node ohne
      `js/i18n.js` lädt.
- [ ] **i18n-Block** `GK.i18n.add({ 'deutscher Text': 'english text', … })` für jeden Text, auch `name`, `desc`
      und Verlaufstexte. Schlüssel ist der deutsche Quelltext. Dasselbe deutsche Wort mit anderer Bedeutung:
      Kontext als drittes Argument (`baccarat.js`: `GK.t(NAMES[x], null, 'bac')`, siehe `js/i18n.js`).
- [ ] **Zustand** nur über `state() { return GK.casino.data('<id>', () => ({ bet: 100, round: null, last: null })); }`.
      Nie Schlüssel oder Felder übersetzen.
- [ ] **Mathematik** als reine Funktionen ohne DOM (Abschnitt „auch für Tests“), am Dateiende als
      `GK.casino.<id>Math = { … }` exportieren.
- [ ] **Ablauf** nach Abschnitt 2; eines der Muster A–E wählen und im Kopfkommentar benennen.
- [ ] **`GK.casino.register({ … })`** mit `id`, `category`, `name`, `emoji`, `desc`, `init`, `refresh`, `render`.
- [ ] **`index.html`**: `<script src="js/casino/<id>.js?v=…">` zwischen die anderen Casino-Skripte (Position =
      Platz in der Lobby), und **alle** `?v=…` der Seite auf einen neuen Wert `JJJJMMTTNN` setzen.
- [ ] **CSS** in `css/style.css`: eigener Abschnitt `/* ---------- Name ---------- */` am Ende der Spiel-Abschnitte,
      erste Zeile der Karten-Akzent `.casino-card[data-game="<id>"] { --accent: rgba(…); }`, alle Klassen mit
      kurzem Präfix (`pa-` Parole, `tw-` Mast-Kletterei). Gemeinsame Bausteine wiederverwenden: `.mines-layout` /
      `.mines-controls` (Spielfeld + Bedienung), `.game-message` (`win`/`loss`), `.game-actions`, `.btn btn-primary
      btn-big`, `.bet-label`. Regeln für das iPad aus `CLAUDE.md` beachten (Hover nur in `@media (hover: hover)`,
      Dauer-Animationen nur `transform`/`opacity`).
- [ ] **Lobby-Bild** in `js/icons.js`: Eintrag `<id>: …` im Objekt `GAMES` (wird zu `#g-<id>`). Ohne Eintrag zeigt
      `GK.gameIcon` das `emoji`. Symbole in Knöpfen über `ic('name')` mit der Schutzhülle
      `const ic = (name, cls) => (GK.icon ? GK.icon(name, cls) : '');`.
- [ ] **`GK.casino.RUNNING`** (`js/casino/casino.js`): Eintrag für die laufende Runde ergänzen (`on`, `clear`,
      `text`) und den Text im i18n-Block von `js/progress.js` anmelden.
- [ ] **`GK.casino.bet(betrag, '<id>')`** und `refund(betrag, '<id>')` immer mit Spiel-ID (Glückssträhne).
- [ ] **Erfolge** (falls gewünscht) in `js/achievements.js`, ausgelöst mit `GK.unlockAchievement('<id>')`.
- [ ] **Test**: Mathematik in `tests/casino.test.js` (Datei dort in die `require`-Liste aufnehmen) oder eine eigene
      `tests/<id>.test.js` wie `tests/parole.test.js`. Mindestens: Tabellen stimmig, Rückzahlung im erwarteten
      Bereich (gerechnet und/oder simuliert), Zufall gleichmäßig.
- [ ] **Im Browser** (Playwright, auch `devices['iPad (gen 7)']` hoch und quer): keine Konsolenfehler, kein seitliches
      Scrollen, Kontostand = Start − Einsätze + Auszahlungen, Neuladen mitten in der Runde.
- [ ] **Texte**: Spiel in `README.md` (Spieleliste und Kurzliste), Abschnitt „Erweiterung: …“ in `PROJEKTPLAN.md`,
      neue Testdatei in `CLAUDE.md` unter „Testen“ (und in der Testliste der `README.md`).

### Minimales Gerüst

```js
// Münzwurf: Kopf oder Zahl. Das Ergebnis steht beim Start fest und wird gespeichert – Neuladen zahlt trotzdem aus.
window.GK = window.GK || {};

// Sprache: Ersatz, falls js/i18n.js (noch) nicht geladen ist – gibt den deutschen Text zurück.
GK.t = GK.t || function (s, v) { s = String(s); return v ? s.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m)) : s; };
GK.i18n = GK.i18n || { add() {}, addHtml() {}, apply() {}, set() {}, lang: 'de' };

GK.i18n.add({
  'Münzwurf': 'Coin Toss',
  'Kopf oder Zahl?': 'Heads or tails?',
  'Nicht genug Dublonen für diesen Einsatz.': 'Not enough Doubloons for this bet.',
  'Werfen': 'Toss',
  '🪙 Gewonnen: {money}': '🪙 Won: {money}',
  'Leider verloren.': 'Sorry, you lost.',
  'Kopf': 'Heads',
  'Zahl': 'Tails',
});

(function () {
  const MIN_BET = 10;
  const MULT = 1.94;
  let els = {};
  let betControl;
  let busy = false;
  let timer = 0;

  function state() {
    return GK.casino.data('coin', () => ({ bet: 100, pending: null, last: null }));
  }

  // ---------- Mathematik (auch für Tests) ----------
  const toss = () => GK.rng.int(2) === 0;

  // ---------- Ablauf ----------
  function start() {
    const s = state();
    if (s.pending || busy) return;
    if (!GK.casino.bet(s.bet, 'parole')) {
      GK.sound.play('denied');
      showMessage(GK.t('Nicht genug Dublonen für diesen Einsatz.'), 'loss');
      return;
    }
    const win = toss();
    // Ergebnis sofort speichern: Neuladen während der Animation zahlt trotzdem aus
    s.pending = { bet: s.bet, win, payout: win ? Math.floor(s.bet * MULT) : 0 };
    GK.save();
    busy = true;
    render();
    timer = setTimeout(() => settle(true), 600);
  }

  // animated = nach der Animation (sonst nach dem Neuladen)
  function settle(animated) {
    const s = state();
    const p = s.pending;
    busy = false;
    if (!p) return;
    s.pending = null;
    s.last = p;
    GK.casino.payout(p.payout);
    GK.casino.record('coin', p.bet, p.payout, GK.t(p.win ? 'Kopf' : 'Zahl'));
    GK.save(); // s.last kam nach record dazu
    showMessage(p.win ? GK.t('🪙 Gewonnen: {money}', { money: GK.formatMoneyHTML(p.payout) }) : GK.t('Leider verloren.'), p.win ? 'win' : 'loss');
    if (animated && p.win) GK.fx.celebrate(p.payout, p.bet, { el: els.start });
    render();
  }

  // ---------- Darstellung ----------
  function render() {
    els.start.disabled = busy;
    betControl.setDisabled(busy);
  }

  function showMessage(html, cls) {
    els.message.className = 'game-message ' + (cls || '');
    els.message.innerHTML = html;
  }

  function init(body) {
    body.innerHTML = `
      <div class="game-message">&nbsp;</div>
      <div class="coin-bet"></div>
      <div class="game-actions"><button class="btn btn-primary btn-big coin-start">${GK.t('Werfen')}</button></div>`;
    els = { message: body.querySelector('.game-message'), start: body.querySelector('.coin-start') };
    betControl = GK.casino.createBetControl(body.querySelector('.coin-bet'), {
      min: MIN_BET,
      get: () => state().bet,
      set: v => { state().bet = v; },
    });
    els.start.addEventListener('click', start);
    refresh();
  }

  // Auch nach Import/Zurücksetzen: Speicherzustand zurücksetzen, unterbrochene Runde abrechnen
  function refresh() {
    busy = false;
    clearTimeout(timer);
    if (state().pending) settle(false);
    render();
  }

  GK.casino.register({
    id: 'coin', category: 'quick', name: 'Münzwurf', emoji: '🪙', desc: 'Kopf oder Zahl?',
    init, refresh,
    render: () => { if (!state().pending) betControl.refresh(); },
  });

  // Für Tests
  GK.casino.coinMath = { MULT, toss };
})();
```

Das Gerüst ist ein Beispiel und kein vorhandenes Spiel (`coin` gibt es im Repo nicht).

### Tests aufsetzen

Reine Mathematik braucht nur zwei Zeilen Vorbereitung (`tests/parole.test.js`, `tests/casino.test.js`):
`global.window = global;` und `require` von `js/casino/casino.js` plus der Spieldatei – `GK.rng` läuft in Node,
`register` sammelt nur ein. Wer den **Ablauf** testet (`bet`, `payout`, `record`), braucht `js/format.js`,
`js/state.js` und Attrappen für `document`, `location`, `history`, `GK.sound`; `record` zeichnet die Lobby neu,
deshalb ersetzt `tests/chicken.test.js` `GK.casino.record` durch eine Liste und `tests/stocks.test.js` stellt
`document.getElementById = () => ({})` und `GK.poker = { tournament: { TIERS: [] } }` bereit.

## 4. Alle Spiele

„Zustand“ = Standardwert in `GK.casino.data(id, …)`. „Neuladen“ verweist auf die Muster A–H aus Abschnitt 2.
„Quote“ = Rückzahlung im Schnitt laut Konstante im Code bzw. geprüftem Bereich im Test.

| id | Datei | Name | Kat. | Kurzregel | Zustandsfelder | Neuladen | Test-Objekt | Quote / Ausgewogenheit |
|---|---|---|---|---|---|---|---|---|
| `slots` | `slots.js` (+ `slot-machine.js`) | Slot-Maschine | slots | 3 Walzen, 1 Linie; 3 gleiche bis ×777, bei manchen Symbolen zahlen 2 gleiche | `bet, reels, pending` | A | `GK.slotMachine` (`rtp`, `evaluate`, `SYMBOLS`), `GK.casino.slotsRtp` | 96,2 % laut Kommentar; Test 0,94–0,98 |
| `sideSlot` | `js/side-slot.js` | Side-Slot (unter der Klick-Münze, keine Lobby-Karte) | – | wie `slots`, feste Einsatzstufen `STEPS` bis `maxBet()` | `bet, reels, pending` | A | wie `slots` | wie `slots` |
| `vsPirate`, `vsOcean`, `vsVolcano` | `video-slots.js` | Schatz der Karibik, Tiefsee-Perlen, Vulkan-Gold | slots | 5 Walzen × 3 Reihen, 20 Linien, WILD, Scatter → Freispiele mit Multiplikator, 3 Bonus-Symbole → Schatzkisten | `bet, stops, pending, free, bonus` | A + H | `GK.videoSlots` (`THEMES`, `STRIPS`, `evaluate`, `evalLine`, `rtp`, …) | Test: `rtp(theme).total` 0,93–0,975 |
| `scratch` | `scratch.js` | Rubbellose | quick | 9 Felder rubbeln, 3 gleiche Beträge gewinnen; 7 Lospreise, Auto-Rubbeln, 10 Lose sofort | `ticketId, current, count` | B (`current.settled`) | `GK.casino.scratchRtp`, `scratchMakeFields` | 99 % (`PRIZES`); Test 0,97–1,0 |
| `roulette` | `roulette.js` | Roulette | table | Europäisch 0–36, Chips auf Zahlen und einfache Chancen | `chip, bets, lastBets, results, pending` | F + A | `rouletteMath` | Test: jede Wette exakt 36/37 |
| `blackjack` | `blackjack.js` | Blackjack | table | 6 Decks, Dealer steht auf 17, Blackjack 3:2, Verdoppeln, Teilen bis 4 Hände | `bet, shoe, round` | C | `blackjackRules` (`handValue`, `isBlackjack`) | keine Quote im Code oder Test |
| `baccarat` | `baccarat.js` | Baccarat | table | Punto Banco, 8 Decks; Spieler ×2, Bank ×1,95, Unentschieden ×9 | `bet, choice, pending, last, road` | A | `baccaratMath` | Test: Spieler 0,98–0,995, Bank 0,98–0,997, Unentschieden 0,82–0,89 |
| `hilo` | `hilo.js` | Höher oder tiefer | table | Nächste Karte höher/tiefer (gleich zählt), 3× überspringen, auszahlen nach jedem Treffer, ab ×10.000 automatisch | `bet, round, last, history` | C | `hiloMath` | `RTP = 0,97`; Simulation 0,945–0,99 |
| `wheel` | `wheel.js` | Glücksrad | quick | Rad mit gewichteten Feldern, ⭐ startet Bonusrad; täglich ein Gratis-Dreh (als Runde mit Einsatz 0 verbucht) | `bet, pending, lastFree, results` | A | `wheelMath` | Test 0,94–0,99; Gewichte ergeben 100 |
| `plinko` | `plinko.js` | Münzfall | quick | Münze fällt durch 12 Nagelreihen, 3 Risikostufen, Massenwurf 1–5.000 Münzen | `bet, risk, pending[], count, mass` | A | `plinkoMath` | Test je Risiko 0,97–0,995 |
| `mines` | `mines.js` | Schatzinsel | quick | 25 Felder, 1/3/5/10/20 Totenköpfe, jederzeit abkassieren | `bet, skulls, round, last` | B | `minesMath` | `EDGE = 0,97`; Test 0,95–0,971 für jeden Ausstieg |
| `crash` | `crash.js` | Kanonenkugel | quick | Multiplikator steigt bis zur Explosion; abkassieren von Hand oder automatisch | `bet, auto{on,at}, round, last, history` | D | `crashMath` | `EDGE = 0,97`, 3 % sofortige Explosion; Test 0,94–0,98 bei ×2 |
| `race` | `race.js` | Schiffsrennen | quick | 5 Schiffe, je Rennen neue Quoten (`next`), Chips auf ein oder mehrere Schiffe | `chip, bets, next, pending, last` | F + A | `raceMath` | `EDGE = 0,95`; Test je Schiff 0,85–0,951 |
| `flight` | `flight.js` | Flugkapitän | quick | Flug sammelt +/×/÷ und Raketen, muss landen; 4 Geschwindigkeiten | `bet, mode, pending, history` | A | `flightMath` | `RTP = 0,97`; Test Rechnung 0,965–0,975 |
| `chicken` | `chicken.js` | Chicken Road | quick | 20 Spuren in 4 Abschnitten, 4 Schwierigkeiten, auszahlen nach jedem Schritt | `bet, diff, round, last, history` | C | `chickenMath` (auch `startRound`, `decideStep`, `finishRound`, `state`) | `RTP = 0,97`; `tests/chicken.test.js` 0,955–0,97 für jeden Ausstieg |
| `tower` | `tower.js` | Mast-Kletterei | quick | 9 Stufen, je Stufe Seile mit morschen darunter, 4 Schwierigkeiten | `bet, mode, round, last` | B | `towerMath` | `RTP = 0,97`; Test 0,955–0,97 je Stufe |
| `parole` | `parole.js` | Geheime Parole | quick | Wort mit 5 Buchstaben in 6 Versuchen; ×12 / 3 / 1,5 / 1 / 0,5 / 0,2 je Versuch; Wortliste nach Spielsprache | `bet, round, last` | B | `paroleMath` | Geschicklichkeit. `tests/parole.test.js`: Rechner, der die Liste kennt, holt 1,1–1,8 (Obergrenze) |
| `keno` | `keno.js` | Schatzkarten-Keno | quick | 1–10 von 40 Inseln markieren, 10 werden gezogen | `bet, picks, pending, last, history` | A | `kenoMath` | Test `rtp(picks)` 0,94–0,97 |
| `stopwatch` | `stopwatch.js` | Stoppuhr | quick | Uhr bei Zielzeit (2–10 s) stoppen; ×2 exakt, ×1 bei ±1, ×0,6 bis ±3, ×0,2 bis ±6 Hundertstel | `bet, round, last, best, exact` | E | `stopwatchMath` | Geschicklichkeit. Test: Streuung ±0,02 s → 0,95–1,1; ±0,05 s → 0,5–0,75 |
| `stocks` | `stocks.js` | Hafenbörse | market | Anteile an 6 Firmen kaufen/verkaufen; Kurs läuft jede Sekunde weiter (bis 8 Std. nachgerechnet), Pleiten | `bet, selected, lastTick, stocks, holdings, news` | G | `stockMath` | Kauf ×1,02, Verkauf ×0,99, mit Anteilen fällt der Kurs; `tests/stocks.test.js`: Halten bringt in unter 5 % der Fälle Gewinn |

Hilfsdateien ohne eigenes Spiel: `cards.js` (`GK.cards`: Karten als Text wie `'AS'`, `createDeck(decks)` liefert
ein gemischtes Blatt, `html(card)` zeichnet), `slot-machine.js` (`GK.slotMachine`: Symbole, `evaluate`,
`createReels`, `createLever` – der Hebel wird auch von den Video-Slots benutzt).

## 5. Gestaltungsregeln

- **Keine Auszahlungsquoten und keine Gewinnchancen im Spiel anzeigen**, keine Sprüche wie „Das Haus gewinnt
  immer“ (`CLAUDE.md`). Erlaubt und üblich ist, was der Spieler zum Spielen braucht: der Multiplikator der
  nächsten Stufe (`tower.js`), eine Gewinntabelle (`keno.js`, `parole.js`), Quoten der Schiffe (`race.js`).
  Die Zahlen `RTP`/`EDGE` bleiben im Code und in den Tests.
- Es ist Spielgeld. Dublonen bewegen sich im Casino nur über `bet`, `payout`, `refund`, `record`.
- iPad zuerst (810 × 1080 und 1080 × 810, Touch): große Tippflächen, kein seitliches Scrollen. Layout
  `.mines-layout` (`flex-wrap`) setzt die Bedienung auf schmalen Geräten unter das Spielfeld.
- Meldungen in `.game-message` mit Klasse `win`, `loss` oder leer; ein Emoji am Anfang wird über
  `GK.iconifyLead` zum eigenen Symbol.
- Gewinne feiern mit `GK.fx.celebrate(payout, bet, { el, subtitle })` (`js/fx.js:celebrate`): feiert je nach
  Höhe, spielt bei `payout <= 0` selbst den Verlust-Ton (außer `quiet`) und bei `payout <= bet` nur einen
  Münz-Ton. Nur nach einer echten Animation aufrufen (`animated`), nicht beim Abrechnen nach dem Neuladen.
- Einstellung „weniger Effekte“ beachten: `GK.state.settings.effects === 'reduced'` verkürzt Wartezeiten
  (`tower.js:pick`, `parole.js:submit`, `baccarat.js:deal`).
- Zahlen: `GK.formatNumber`, `GK.formatMoneyHTML`, Multiplikatoren über `GK.formatDecimal(m, min, max)` – nicht
  `toLocaleString`.
- Töne über `GK.sound.play(name)`; abgelehnter Einsatz spielt `'denied'`.

## 6. Stolperfallen

- **`bet()` kennt kein Limit.** Das VIP-Limit setzt nur `createBetControl` durch. Wer Einsätze anders bildet
  (Chips, feste Preise, Vielfache), prüft `GK.casino.maxBet()` selbst: `roulette.js:placeBet`, `race.js:placeBet`,
  `scratch.js:buy`, `js/side-slot.js:spin`. (`plinko.js:throwMany` setzt `s.bet × Anzahl` ohne diese Prüfung.)
- **Nie eine Referenz auf den Zustand aufheben.** Beim Import/Zurücksetzen wird `GK.state` ersetzt; immer frisch
  über `state()` lesen. In einem `setTimeout` deshalb prüfen, ob die Runde noch dieselbe ist
  (`baccarat.js:deal`: `if (!dealing || s.pending !== p) return;`).
- **`createDefault` greift nur, wenn das Spiel noch gar keinen Zustand hat.** Ein später ergänztes Feld fehlt in
  alten Spielständen; beim Lesen absichern (`plinko.js:countOf`, `stats.biggestLoss || 0`).
- **`refresh()` muss alles zurücksetzen, was nur im Speicher lebt** (`busy`, Timer, Animationen) und eine
  unterbrochene Runde abrechnen – es läuft beim Start *und* nach jedem Import.
- **`record` nach `payout`, und die Runde vorher löschen.** `record` speichert; steht `round`/`pending` dann noch
  im Zustand, zahlt ein Neuladen genau in diesem Moment doppelt.
- **Erst `bet`, dann Zustand ändern.** Schlägt `bet` fehl, darf nichts verändert sein.
- **`refund` und `bet` speichern nicht** – danach selbst `GK.save()` aufrufen.
- **`payout` ist die volle Rückzahlung**, nicht der Gewinn. „Einsatz zurück“ ist `payout(bet)`.
- **`record(id, 0, gewinn, …)`** (Gratis-Dreh, Freispiele, Bonus) zählt als gewonnene Runde, bekommt keinen
  Glückssträhnen-Bonus und fließt nicht in `bestMult` ein.
- **Der Glückssträhnen-Bonus steht nicht in der Meldung des Spiels.** Er wird in `record` ausgezahlt und zeigt
  sich selbst (schwebender Text); die Beträge in `p.payout` oder `s.last.payout` enthalten ihn nicht.
- **`onHide` kommt nicht beim Tab-Wechsel.** Wer auf Tastatur hört oder Zeit misst, prüft die Sichtbarkeit selbst:
  `parole.js:onKey` (`els.board.offsetParent === null`), `crash.js:isVisible`. Tastatur-Listener in `onShow`
  an- und in `onHide` abmelden und Eingabefelder ausnehmen (`parole.js:onKey`).
- **`render()` läuft alle 100 ms.** Dort kein `innerHTML` auf großen Bereichen; `GK.setHTML`/`GK.setText`
  schreiben nur bei Änderung. Die Spiele zeichnen ihr Spielfeld bei Ereignissen, nicht im Takt.
- **Zeit über Neuladen hinweg** mit einem Zeitstempel im Zustand (`crash.js: round.start`, `stopwatch.js: round.at`);
  `performance.now()` beginnt nach dem Neuladen neu und taugt nur zum Messen innerhalb einer Sitzung. Für alles,
  was sich durch Verstellen der Geräte-Uhr lohnen würde (Buffs, Fahrten, Tageswechsel), `GK.now()` nehmen
  (`js/state.js`, läuft nie rückwärts).
- **Verlaufstexte sind HTML und werden nicht nachübersetzt.** Sie bleiben in der Sprache, in der die Runde
  gespielt wurde. Keine ungeprüften Eingaben hineinschreiben.
- **Dateien müssen in Node laden.** Oberste Ebene ohne DOM-Zugriff; `GK.icon`, `GK.gameIcon`, `GK.iconifyLead`,
  `GK.track`, `GK.daily` können fehlen und werden deshalb überall mit `GK.x ? … : …` abgefragt. Timer nur
  hinter einer Prüfung starten (`stocks.js:startTimer`).
- **Tagesaufgabe „bestimmtes Spiel“** (`js/daily.js:quickGames`) wählt aus allen Spielen der Kategorien `quick`,
  `slots`, `table` außer Poker. Ein neues Spiel dort sollte also in wenigen Runden spielbar sein.
- **Versionsnummer vergessen**: Ohne neues `?v=…` in `index.html` mischen Browser alte und neue Dateien.
- **`GK.casino.RUNNING` vergessen**: Dann lässt sich ein laufender Einsatz über die große Fahrt mitnehmen und eine
  Runde mit bekanntem Ausgang per Import wiederholen.
