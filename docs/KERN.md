# Kern des Spiels

Für Agenten, die Code ändern wollen. Beschreibt `js/state.js`, `js/main.js`, `js/savecode.js`,
`js/format.js`, `js/analytics.js` und den Aufbau von `index.html`. Verweise in der Form `datei:funktion`.
Projektregeln stehen in `CLAUDE.md` und gelten zusätzlich.

## 1. Aufbau und Ladereihenfolge

Kein Build, keine Module: `index.html` lädt klassische `<script>`-Dateien nacheinander, alle hängen sich an
`window.GK`. Jede Datei trägt `?v=JJJJMMTTNN` (zurzeit `2026111101`, auch die zwei CSS-Dateien) – bei jeder
JS-/CSS-Änderung **alle** Vorkommen in `index.html` auf denselben neuen Wert setzen.

| Nr. | Dateien | Liefert / Grund für die Position |
|---|---|---|
| 0 | PeerJS (CDN, cdnjs) | Verbindungen für Poker und Räume |
| 1 | `js/icons.js` | `GK.icon`, `GK.iconText`, `GK.iconifyEmoji` – „zuerst: alle anderen Skripte bauen ihre Anzeigen damit“ |
| 2 | `js/analytics.js` | `GK.track` |
| 3 | `js/format.js` | Zahlenformate, `GK.setHTML`/`GK.setText`, `GK.COIN` |
| 4 | `js/savecode.js` | `GK.saveCode` |
| 5 | `js/state.js` | `GK.state`, `GK.earn`/`spend`/`canAfford`, `GK.save`/`load`, `GK.player` |
| 6 | `js/i18n.js` | echtes `GK.t` und `GK.i18n` (ersetzt den Ersatz, siehe unten) |
| 7 | `sound`, `fx`, `achievements`, `daily`, `progress`, `clicker`, `rank`, `fleet`, `boss`, `figure`, `cosmetics`, `kraken`, `friends` | Klicker-Seite |
| 8 | `js/casino/casino.js`, `cards.js`, dann die Casino-Spiele | `casino.js` zuerst: `GK.casino`, `GK.rng` |
| 9 | `js/poker/*` (evaluator, engine, ai, tournament, table-ui, multiplayer, poker) | Poker |
| 10 | `js/mp/room.js`, dann die Spiele mit Freunden | `room.js` zuerst |
| 11 | `js/side-slot.js` | Slot neben der Klick-Münze |
| 12 | `js/i18n-ui.js` | Englisch für feste `index.html`-Texte; bewusst nach allen Spielen, damit es bei gleichen Schlüsseln gewinnt |
| 13 | `js/main.js` | Einstiegspunkt, `GK.toast`, `GK.notify` |

Warum die Reihenfolge zählt: Code, der **beim Laden** läuft (oberste Ebene einer Datei bzw. der IIFE), darf nur
benutzen, was schon geladen ist. Alles, was erst in Funktionen läuft (nach `DOMContentLoaded`), kann jedes
`GK.*` benutzen. Ein neues Skript muss vor `js/i18n-ui.js` und `js/main.js` stehen.

### Muster am Dateianfang

```js
window.GK = window.GK || {};

// Sprache: Ersatz, falls js/i18n.js (noch) nicht geladen ist – gibt den deutschen Text zurück.
GK.t = GK.t || function (s, v) { s = String(s); return v ? s.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m)) : s; };
GK.i18n = GK.i18n || { add() {}, addHtml() {}, apply() {}, set() {}, lang: 'de' };

GK.i18n.add({ 'deutscher text': 'english text' });

(function () {
  // private Konstanten und Funktionen
  GK.meinModul = { init, render, refresh };
})();
```

- Der Ersatz existiert, weil die Tests einzelne Dateien in Node laden (`global.window = global; require(...)`),
  ohne `js/i18n.js`. Dann liefert `GK.t` den deutschen Text mit eingesetzten Platzhaltern.
- `js/i18n.js` weist `GK.t` und `GK.i18n` **ohne Bedingung** neu zu. `GK.t(de, vars, ctx)`: `ctx` ist ein optionaler
  Kontext, angemeldet als Schlüssel `'ctx\u0001wort'`.
- Die Sprache kommt aus `GK.state.settings.lang` (`i18n.js:currentLang`), wird also bei jedem `GK.t`-Aufruf frisch gelesen.
- `savecode.js` und `analytics.js` haben keine Spielertexte und deshalb keinen Ersatz-Block.

## 2. Start und Spielschleife (`js/main.js`)

`main.js:init` läuft bei `DOMContentLoaded`, in dieser Reihenfolge:

1. `GK.load()` – Spielstand aus `localStorage` (sonst bleibt der Standardzustand).
2. `GK.i18n.init()` – feste Texte merken und in der gespeicherten Sprache setzen.
3. `GK.room.readInviteLink()`, `GK.poker.mp.readInviteLink()` – Einladungs-Links auswerten.
4. `GK.onSave = flashSaveIndicator`; ohne Speicher: `#storage-warning` zeigen und Toast.
5. `setupTabs()`, `setupStatsActions()`, `setupSettings()`, `GK.fx.init()`, `updateHeaderHeight()` (+ `ResizeObserver`).
6. `GK.clicker.init()`, `GK.cosmetics.init()`, `GK.progress.init()`, `GK.progress.applyOfflineEarnings()`,
   `GK.fleet.init()`, `GK.casino.init()`, `GK.daily.init()`, `GK.sideSlot.init()`.
7. `GK.poker.mp.resume()`, `GK.room.resume()` – laufende Online-Partien wieder aufnehmen.
8. `showTab(GK.state.ui.tab)`, `GK.achievements.check()`, `render()`.
9. `setInterval(GK.save, 5000)`, Listener für `visibilitychange`, `pagehide`, `beforeunload`, dann `requestAnimationFrame(loop)`.

### Takt

| Was | Wie oft | Wo |
|---|---|---|
| `GK.state.playTime += s`, `GK.clicker.tick(s)`, `GK.kraken.update(s)` | jedes Bild (`requestAnimationFrame`), `s` höchstens 1 Sekunde | `main.js:loop` |
| `GK.rank.check()`, `GK.achievements.check()` | alle 1000 ms (`CHECK_INTERVAL`) | `main.js:loop` |
| `render()` | alle 100 ms (`RENDER_INTERVAL`) | `main.js:loop` |
| `GK.save()` | alle 5000 ms (`AUTOSAVE_INTERVAL`) | `setInterval` in `main.js:init` |

`main.js:render` ruft in dieser Reihenfolge auf:

```
Kopfzeile (#money, #cps, #cps-on/#cps-off, document.title)
GK.clicker.render()            immer
GK.sideSlot.render()           immer
GK.casino.render()             immer
GK.progress.update(tab === 'progress')
GK.fleet.update(tab === 'adventure')
GK.boss.update(tab === 'adventure')
GK.daily.update(tab === 'progress')
GK.achievements.render(), GK.cosmetics.render()   nur im Tab 'progress'
renderStats()                  im Tab 'casino' nur GK.friends.render(); sonst nur im Tab 'stats'
```

Die `update(sichtbar)`-Funktionen laufen immer (Logik), bekommen aber mit, ob ihr Tab offen ist. Alles in
`render` läuft 10× pro Sekunde – dort nur `GK.setHTML`/`GK.setText` verwenden.

### Tabs

Tabs in `index.html`: `clicker`, `casino`, `adventure`, `progress`, `stats`. Je Tab ein
`<button class="tab" data-tab="x">` und eine `<section id="tab-x" class="tab-panel">`.
`main.js:showTab(name)`: unbekannter Name → `clicker`; schreibt `GK.state.ui.tab`; setzt die Klasse `active`;
bei `casino` zusätzlich `GK.casino.show()`; bei allem außer `clicker` `GK.sideSlot.stopAuto()`.
`showTab` ist privat – von außen den Tab-Knopf anklicken.

### Hintergrund-Tab

`main.js:onVisibilityChange`: beim Verstecken `GK.save()`; bei der Rückkehr werden bis zu 8 Stunden
(`MAX_CATCH_UP`) nachgeholt: `playTime += s` und `GK.clicker.tick(s)` (nur wenn mehr als 1 Sekunde). `GK.kraken.update`
wird dabei **nicht** nachgeholt.

### `refreshAll` (privat in `main.js`)

Baut nach einem ersetzten Zustand alles neu auf und bleibt im offenen Tab:
`GK.clicker.refresh()`, `GK.cosmetics.refresh()`, `GK.casino.refresh()` (ruft `refresh` jedes Spiels, falls vorhanden),
`GK.sideSlot.refresh()`, `GK.poker.mp.resume()`, `GK.room.resume()`, `renderSettings()`, `GK.sound.applyVolume()`,
`GK.achievements.refresh()`, `showTab(aktuellerTab)`, `render()`.

Aufgerufen nur nach **Import** (`#transfer-confirm`) und **Zurücksetzen** (`#reset-btn`). Der **Sprachwechsel**
(`#set-lang`) ruft `GK.i18n.set(lang)` (speichert) und dann `location.reload()` – kein `refreshAll`, weil Module
Anzeigen zwischenspeichern. Ein Modul mit eigenem Zwischenspeicher oder aufgehobenen DOM-Elementen braucht
ein `refresh()` und einen Eintrag in `refreshAll` (Casino-Spiele: `refresh` am Spielobjekt genügt).

### Meldungen

- `GK.toast(message, icon)` – kurze Zeile unten, 2,5 s, eine gleichzeitig. `icon`: Name oder Array von Argumenten für `GK.icon`.
- `GK.notify(html, duration = 5000)` – Kasten unten rechts, höchstens 3 gestapelt, Klick schließt.

Beide entstehen erst in `main.js`, also nie beim Laden einer Datei aufrufen.

## 3. Geld (`js/state.js`)

| Funktion | Verhalten |
|---|---|
| `GK.earn(amount, source)` | Kein Rückgabewert. `amount` nicht `> 0` (auch `NaN`) → nichts. Sonst `money += amount`. |
| `GK.canAfford(amount)` | `GK.state.money >= amount` |
| `GK.spend(amount)` | `false`, wenn `amount` nicht `>= 0` oder das Guthaben nicht reicht; sonst abbuchen und `true`. `GK.spend(0)` ist `true`. |

Nebenwirkungen von `GK.earn` je nach `source`:

| `source` | `totalEarned` + `allTimeEarned` | `clickEarned` | `GK.daily.track('earn', amount)` |
|---|---|---|---|
| `'click'` | ja | ja | ja |
| `'passive'` | ja | nein | ja |
| `'casino'` | **nein** | nein | nein |
| alles andere (im Code: `'boss'`, `'daily'`, `'fleet'`) oder weggelassen | ja | nein | nein |

- `earn` und `spend` speichern nicht und lösen keine Erfolge aus. Erfolge und Ränge prüft die Schleife einmal
  pro Sekunde (`GK.achievements.check`, `GK.rank.check`). Nach einem Kauf selbst `GK.save()` aufrufen.
- `spend` führt keine Statistik. Die Casino-Statistik führen `casino.js:bet` (`GK.spend` + `casino.wagered`),
  `payout` (`GK.earn(…, 'casino')` + `casino.won`) und `refund` (schreibt `money` direkt zurück, `wagered` sinkt).
- Beträge werden nicht gerundet; `money` kann Nachkommastellen haben (passives Einkommen je Bild).

```js
if (!GK.spend(preis)) return;      // erst abbuchen, dann gewähren
GK.state.upgrades.push(id);
GK.save();
```

## 4. Spielstand

### `createDefaultState` (`js/state.js`)

| Feld | Standard | Wofür | Genutzt in |
|---|---|---|---|
| `version` | `1` (`SAVE_VERSION`) | wird beim Laden immer auf 1 gesetzt, sonst nirgends ausgewertet | `state.js` |
| `money` | `0` | Guthaben | überall über `GK.earn`/`GK.spend` |
| `totalEarned` | `0` | verdient auf dieser großen Fahrt (ohne Casino) | `state.js`, `progress.js` |
| `clickEarned` | `0` | davon durch Klicks | `state.js`, `main.js` |
| `totalClicks` | `0` | Anzahl Klicks | `clicker.js`, `achievements.js`, `friends.js`, `figure.js` |
| `buildings` | `{}` | `{ gebäudeId: anzahl }` | `clicker.js`, `cosmetics.js`, `kraken.js` |
| `upgrades` | `[]` | gekaufte Upgrade-IDs | `clicker.js` |
| `playTime` | `0` | Spielzeit in Sekunden | `main.js` |
| `allTimeEarned` | `0` | verdient über alle Fahrten | `state.js`, `progress.js`, `main.js` |
| `rankSeen` | `0` | höchster schon gemeldeter Rang | `rank.js` |
| `fleet` | `createDefaultFleet()` | Flotte, siehe unten | `fleet.js` |
| `boss` | `{ level: 0, kills: 0, fights: 0 }` | höchste besiegte Stufe, Zähler | `boss.js` |
| `prestige` | `{ points: 0, journeys: 0 }` | Schatzkarten, Anzahl großer Fahrten | `progress.js` |
| `achievements` | `[]` | freigeschaltete Erfolgs-IDs | `achievements.js` |
| `buffs` | `[]` | zeitlich begrenzte Boni (`{ id, type, mult, until }`) | `progress.js` |
| `goldenClicks` | `0` | gefangene goldene Dublonen | `progress.js`, `achievements.js` |
| `crits` | `0` | kritische Klicks | `clicker.js`, `achievements.js` |
| `bestCombo` | `0` | längste Klick-Combo | `clicker.js`, `daily.js`, `achievements.js` |
| `passiveOff` | `false` | passives Einkommen ausgeschaltet | `clicker.js` |
| `casino` | `createDefaultCasino()` | siehe unten | `casino/casino.js` und alle Spiele |
| `cosmetics` | `createDefaultCosmetics()` | siehe unten | `cosmetics.js` |
| `player` | `{ name: '', avatar: '', fig: '', figOn: false }` | Name, Emoji, Figur-Code, Figur statt Emoji | `state.js` (`GK.player`), `figure.js` |
| `friendId` | `''` | eigene Kennung für die Freundes-Rangliste | `friends.js` |
| `friends` | `{}` | `{ kennung: { name, avatar, … } }` | `friends.js`, `achievements.js` |
| `friendWins` | `0` | erste Plätze mit Freunden | `friends.js`, `mp/room.js`, `poker/multiplayer.js` |
| `kraken` | `createDefaultKraken()` | siehe unten | `kraken.js` |
| `daily` | `createDefaultDaily()` | siehe unten | `daily.js` |
| `ui` | `{ tab: 'clicker' }` | zuletzt offener Tab | `main.js` |
| `settings` | `createDefaultSettings()` | siehe unten | siehe unten |
| `startedAt` | `Date.now()` | Zeitpunkt des Neuanfangs; wird nirgends gelesen | – |
| `lastSaved` | `Date.now()` | letzter `GK.save`; Grundlage für Offline-Einkommen | `state.js`, `progress.js`, `main.js` |

Verschachtelte Bereiche:

| Bereich | Felder (Standard) |
|---|---|
| `casino` | `wagered` 0, `won` 0, `rounds` 0, `biggestWin` 0, `biggestLoss` 0, `biggestLossPct` 0 (Verlust in % des Einkommens/s, Rangliste), `vip` 0 (0 Standard … 5 Kaiserkrone), `history` `[]` (`{ game, bet, payout, text, time }`), `openGame` `null`, `games` `{}` (Zustand je Spiel, über `GK.casino.data(id)`), `stats` `{}` (je Spiel: `rounds, wagered, won, wins, biggestWin, biggestLoss, bestMult, streak, bestStreak, last`), `statsSince` 0 |
| `cosmetics` | `owned` `[]`, `equipped` `{ coin: 'gold', effect: 'coins', theme: 'tavern', profile: 'sailor', table: 'felt' }`, `wheel` `null` (noch nicht gedrehtes Glücksrad) |
| `kraken` | `clock` 0 (aktive Sekunden seit dem letzten Angriff), `next` 0 (0 = noch nicht ausgelost), `attack` `null` (laufender Angriff), `defeated` 0, `escaped` 0, `stolen` 0 |
| `daily` | `day` `''` (JJJJ-MM-TT, Ortszeit), `tasks` `[]`, `streak` 0, `bonusDay` `''`, `bonuses` 0, `completed` 0 |
| `fleet` | `ships` `{}` (Stufe je Schiff), `voyages` `{}`, `last` `{}` (letztes Ziel), `treasures` `{}` (Anzahl), `peak` 0 (bestes Einkommen/s), `done` 0, `earned` 0, `log` `[]` |

### `createDefaultSettings`

| Feld | Standard | Wofür | Genutzt in |
|---|---|---|---|
| `lang` | `detectLang()`: Browser-Sprache beginnt mit `de` → `'de'`, sonst `'en'` | Sprache | `i18n.js`, `main.js` |
| `sound` | `true` | Ton an/aus | `sound.js`, `main.js` |
| `volume` | `0.7` | Lautstärke 0–1 | `sound.js` |
| `effects` | `'reduced'` bei `prefers-reduced-motion`, sonst `'full'` | setzt `body.reduced-effects` | `main.js:renderSettings` |
| `kraken` | `true` | Kraken-Angriffe erlaubt | `kraken.js` (`GK.kraken.setEnabled`) |

### Laden und Migration: `state.js:applyData(data)`

Privat; genutzt von `GK.load` und `GK.importSave`. Gibt `false` zurück, wenn `data` kein Objekt ist oder `data.money`
keine endliche Zahl – **das ist die einzige Prüfung**. Danach:

1. `GK.state = Object.assign(createDefaultState(), data, { version: 1 })` – fehlende Felder der obersten Ebene
   bekommen so automatisch ihren Standard; unbekannte Felder aus `data` bleiben erhalten.
2. Flach aufgefüllt (`Object.assign(Standard, data.x)`): `casino`, `ui`, `settings`, `prestige`, `cosmetics`,
   `kraken`, `daily`, `fleet`, `boss`, `player`, zusätzlich eine Ebene tiefer `cosmetics.equipped`.
3. Typ-Reparaturen: `fleet.ships/voyages/last/treasures` müssen Objekte sein, `fleet.log`, `daily.tasks`,
   `cosmetics.owned` Arrays, `boss.level` eine ganze Zahl ≥ 0, `friends` ein Objekt.
4. Sonderfälle für alte Spielstände:
   - `casino.stats` fehlt, aber `rounds > 0` → `statsSince = Date.now()`.
   - Keine gültige gespeicherte Sprache → `'de'` (nur ganz neue Spieler bekommen die Browser-Sprache).
   - `player` fehlt → Name/Bild aus `casino.games.room` bzw. `casino.games.pokerMp` übernehmen.
   - `allTimeEarned` fehlt → `= totalEarned`.

### Speichern, Laden, Zurücksetzen

| Funktion | Verhalten |
|---|---|
| `GK.save()` | `false` ohne Speicher oder bei Fehler. Setzt `lastSaved`, schreibt `JSON.stringify(GK.state)` nach `localStorage['gamble-klicker-save']`, ruft `GK.onSave` auf. |
| `GK.load()` | Liest den Schlüssel und ruft `applyData`; `false` bei fehlendem oder beschädigtem Stand (dann bleibt der Standardzustand). |
| `GK.exportSave()` | `GK.saveCode.encode(GK.state)` |
| `GK.importSave(text)` | `decode` + `applyData` + `GK.save()`; `false` bei ungültigem Code. Danach muss der Aufrufer neu aufbauen (`main.js:refreshAll`). |
| `GK.resetSave()` | Löscht den Schlüssel, `GK.state = createDefaultState()`. Speichert nicht selbst. |
| `GK.storageAvailable` | Ergebnis von `detectStorage()` beim Laden der Datei |
| `GK.onSave` | optionaler Callback (`main.js` setzt `flashSaveIndicator`) |

Zeitpunkte: alle 5 s, beim Verstecken der Seite, bei `pagehide` und `beforeunload`, per Knopf `#save-btn`, in
`GK.importSave`, `GK.i18n.set`, `GK.player.setName`/`nextAvatar` – und ausdrücklich in den Modulen nach Käufen
und Rundenschritten (rund 120 Aufrufe von `GK.save()` in `js/`). `state.js` bittet außerdem per
`navigator.storage.persist()` um dauerhaften Speicher.

### Offline-Fortschritt

- **Spiel geschlossen**: `progress.js:applyOfflineEarnings` (einmal in `init`). Ab 60 s seit `lastSaved` und nur bei
  eingeschaltetem passivem Einkommen: `GK.clicker.getCpsPermanent() × min(Sekunden, 8 h) × 0,5`, gebucht als
  `GK.earn(betrag, 'passive')`, mit `GK.notify`.
- **Tab im Hintergrund**: `main.js:onVisibilityChange`, bis 8 h über `GK.clicker.tick` (siehe Abschnitt 2).
- Flotten-Fahrten laufen über Zeitstempel weiter (`fleet.js`, nicht Teil dieses Dokuments).

### Rezept: neues Feld, ohne alte Spielstände zu brechen

1. **Einfaches Feld auf oberster Ebene** (Zahl, Text, Wahrheitswert): nur in `createDefaultState` eintragen. Fertig.
2. **Feld in einem bestehenden Bereich** (`casino`, `settings`, `cosmetics`, `kraken`, `daily`, `fleet`): in die
   jeweilige `createDefault…`-Funktion eintragen. Bei `boss`, `prestige`, `player`, `ui` steht der Standard
   **doppelt** (in `createDefaultState` und als Literal in `applyData`) – beide Stellen ändern.
3. **Neuer verschachtelter Bereich**: eigene `createDefault…`-Funktion, in `createDefaultState` verwenden **und**
   in `applyData` `GK.state.x = Object.assign(createDefaultX(), data.x);` ergänzen. Ohne diese Zeile bekommen
   spätere Zusatzfelder des Bereichs bei alten Spielständen keinen Standard (Schritt 1 füllt nur die oberste Ebene).
4. **Arrays/Objekte**: in `applyData` eine Typ-Reparatur ergänzen, wenn der Code sonst abstürzt
   (`if (!Array.isArray(...)) ... = []`). Das Auffüllen ist flach – tiefere Ebenen einzeln behandeln (wie `cosmetics.equipped`).
5. Bestehende Felder nicht umbenennen oder umdeuten. Muss ein alter Wert umgerechnet werden, in `applyData` am
   Fehlen des neuen Felds erkennen (Vorbild `allTimeEarned`); `version` taugt dafür nicht, sie ist immer 1.
6. Zustand eines Casino-Spiels gehört nicht hierher, sondern nach `GK.casino.data(id, createDefault)`.
7. Test ergänzen: alten Stand ohne das Feld laden (`GK.importSave` mit einem Base64-JSON) und prüfen.

## 5. Spielstand-Code (`js/savecode.js`)

Öffentlich ist nur `GK.saveCode`:

| Funktion | Verhalten |
|---|---|
| `encode(obj)` | Objekt → Code (Base64-Text). Jedes Mal anders (zufälliges Salz). |
| `decode(text)` | Code → Objekt, oder `null` bei beschädigt/unbekannt. Schneidet Leerraum am Rand ab. |
| `_sha256hex(text)` | nur für Tests |

Format vor dem Base64: `MAGIC(1) = 0xa7 · VER(1) = 1 · SALT(12) · TAG(16) · GEHEIMTEXT(N)`.

- Schlüssel: `base = SHA256(SECRET ‖ salt)`, `enc = SHA256(base ‖ 0x01)`, `mac = SHA256(base ‖ 0x02)`.
  `SECRET` ist ein fester Text im Quellcode – Verschleierung, kein Geheimnis.
- Verschleierung: `JSON.stringify(obj)` als UTF-8, XOR mit dem Schlüsselstrom `SHA256(enc ‖ zähler32)` in 32-Byte-Blöcken.
- Prüfsumme: die ersten 16 Bytes von `HMAC-SHA256(mac, header ‖ salt ‖ geheimtext)`, Vergleich ohne frühen Abbruch.
  Stimmt sie nicht → `null`.
- Alte Codes: Beginnt der Inhalt nicht mit `0xa7 0x01` (oder ist er kürzer als 30 Bytes), wird er als reines Base64
  eines JSON-Textes gelesen. `0xa7` ist ungleich `{`, deshalb sind beide Formate unterscheidbar.
- Alles synchron, eigenes SHA-256, keine Bibliothek – rechnet in Browser, `file://` und Node gleich. Braucht
  `TextEncoder`, `TextDecoder`, `btoa`, `atob`.

`decode` liefert beliebiges JSON zurück; ob es ein Spielstand ist, prüft erst `state.js:applyData`.

## 6. Zahlenformate und Anzeige-Helfer (`js/format.js`)

Zahlen bleiben in beiden Sprachen in deutscher Schreibweise (`de-DE`).

| Funktion | Ergebnis | Beispiel |
|---|---|---|
| `GK.formatNumber(n, allowDecimals = false)` | Geldbetrag als Text. Ab 1 Mio. zwei Nachkommastellen + geschütztes Leerzeichen + Einheit (`Mio.` … `Dezd.` = 10^63). Darunter `Math.floor`. Mit `allowDecimals` eine Nachkommastelle, wenn `|n| < 100` und nicht ganzzahlig. Nicht endlich → `'∞'`. | `1234567` → `1,23 Mio.`; `1234.5` → `1.234`; `(12.34, true)` → `12,3` |
| `GK.formatMoneyHTML(n, allowDecimals = false)` | `<span class="money">` + `formatNumber` + `&nbsp;` + `GK.COIN` | für `innerHTML`/`GK.setHTML` |
| `GK.COIN` | `<i class="dublone" aria-hidden="true"></i>` | Währungssymbol (CSS) |
| `GK.formatDecimal(n, minDigits, maxDigits)` | Dezimalzahl, Format je Stellen-Paar zwischengespeichert | `(2.456, 2, 2)` → `2,46` |
| `GK.formatAmount(n)` | kurze, wieder einlesbare Schreibweise für Eingabefelder; Einheit nur, wenn höchstens zwei Nachkommastellen nötig sind, sonst volle Zahl. Nicht endlich → `''`. | `2.5e9` → `2,5 Mrd.`; `1234567` → `1.234.567` |
| `GK.parseAmount(value)` | Eingabe → Zahl, unbekannt → `NaN`. Zahlen kommen unverändert zurück. Nicht gerundet. | `'500k'` → `500000`; `'2,5M'` → `2500000`; `'1B'` → `1e9`; `'1 Bio.'` → `1e12`; `'1.234,56'` → `1234.56`; `'-5'` → `NaN` |
| `GK.AMOUNT_INPUT` | Attribut-Text für Betragsfelder (Text-Tastatur, keine Autokorrektur, Platzhalter) | `` `<input class="bet-input" ${GK.AMOUNT_INPUT}>` `` |
| `GK.amountPreview(input, target)` | zeigt beim Tippen in `target`, welcher Betrag gemeint ist; gibt die `update`-Funktion zurück | – |
| `GK.formatDuration(seconds)` | `T.`/`Std.`/`Min.`; Sekunden nur, wenn weder Tage noch Stunden | `3725` → `1 Std. 2 Min.`; `45` → `45 Sek.` |
| `GK.setHTML(el, html)` | schreibt `innerHTML` nur bei Änderung (Vergleich mit `el._html`); `el` darf fehlen | Anzeigen im 100-ms-Takt |
| `GK.setText(el, text)` | schreibt `textContent` nur bei Änderung | Anzeigen im 100-ms-Takt |

Abkürzungen in `parseAmount`: `k`/`t`/`tsd` = 10^3, `m`/`mio` = 10^6, `b`/`mrd` = 10^9 (B wie englisch „billion“),
`bio`/`billion` = 10^12, dazu alle Einheiten der Anzeige bis `dezd`. Groß/klein, Leerzeichen und Punkte in der
Abkürzung sind egal.

Wann was:

- Betrag als reiner Text (`textContent`, Toast, Titel): `formatNumber`. Mit Münze in HTML: `formatMoneyHTML`.
- Multiplikatoren, Prozent, alles mit festen Nachkommastellen: `formatDecimal` – nicht `toLocaleString` mit Optionen.
- Wert **in** ein Eingabefeld schreiben: `formatAmount` (nicht `formatNumber`: das rundet auf zwei Stellen).
  Wert **aus** einem Feld lesen: `parseAmount`, dann `isFinite` prüfen und selbst `Math.floor`.
- Alles, was im Takt geschrieben wird: `setHTML`/`setText`.

## 7. Besucherzählung (`js/analytics.js`)

`GK.track(path, title)` zählt ein Ereignis bei GoatCounter. `title` ist optional (Standard: `path`).

- Jeder `path` höchstens einmal pro Seitenbesuch. Lokal (`file:`, `localhost`, `127.*`, `10.*`, `192.168.*`, `[::1]`)
  passiert nichts – auch das Zählskript wird nicht geladen.
- Bis das Zählskript geladen ist, werden Zählungen gesammelt und danach gesendet.
- `analytics.js:send` entfernt für den Moment des Zählens die Adresszusätze (`?raum=…`) und kürzt den Referrer.
- Der Seitenaufruf wird nach dem Start einmal mit festem Titel `Gamble Klicker` gezählt (der echte Titel enthält
  den Kontostand), und erst wenn die Seite sichtbar ist.

Erlaubt sind nur feste Pfade und Namen wie `GK.track('spiel-poker', 'Poker')`. **Nie** Namen, Raum-Codes,
Spieler-IDs, Beträge oder Spielstände in `path` oder `title` einbauen.

## 8. Stolperfallen

1. **Keine Referenz auf `GK.state` oder Teile davon aufheben** (Modul-Variable, Closure über längere Zeit).
   `applyData` und `GK.resetSave` ersetzen das ganze Objekt; eine alte Referenz schreibt dann ins Leere.
   Immer frisch `GK.state.…` bzw. `GK.casino.data(id)` lesen; `const s = GK.state` nur innerhalb einer Funktion.
2. **`GK.i18n.add` vor `js/i18n.js` geht verloren.** `icons.js`, `analytics.js`, `format.js`, `savecode.js` und
   `state.js` laden vor `i18n.js`; ihr `GK.i18n` ist der leere Ersatz, den `i18n.js` danach ersetzt. Betroffen ist
   zurzeit nur `format.js` – in Node nachgeprüft: Die dort angemeldeten Übersetzungen (`'T.'`, `'Std.'`, `'Min.'`,
   `'Sek.'`) wirken nicht, `GK.formatDuration` liefert auch auf Englisch `1 Std. 2 Min.`. Englisch für Texte dieser
   frühen Dateien in einer später geladenen Datei anmelden.
3. **Nicht übersetzte Texte in `format.js`**: die Warnung in `GK.amountPreview` und der Platzhalter in
   `GK.AMOUNT_INPUT` stehen ohne `GK.t` im Code.
4. **`GK.t` nicht beim Laden der Datei auswerten** (z. B. in Konstanten-Tabellen): Der Spielstand und damit die
   Sprache sind erst nach `GK.load()` bekannt. Deutsche Texte in Tabellen ablegen und erst beim Anzeigen
   `GK.t(def.name)` aufrufen (so machen es `casino.js` und `progress.js`).
5. **Importierte Daten sind ungeprüft.** `applyData` prüft nur `money`; alles andere wird übernommen. Alte
   Base64-Codes haben keine Prüfsumme und lassen sich frei bearbeiten. Texte aus dem Spielstand (Namen, Verlauf …)
   nie ungeschützt in `innerHTML` setzen. Siehe `docs/EXPLOITS.md` (Prüfbericht, falls vorhanden).
6. **`'casino'` als Quelle ist kein „verdient“**: Wer eine Belohnung mit `GK.earn(x, 'casino')` bucht, erhöht weder
   `totalEarned` noch `allTimeEarned` (Ränge, Schatzkarten). Umgekehrt zählt ein Casino-Gewinn ohne `'casino'`
   fälschlich als verdient. Casino-Spiele gehen immer über `GK.casino.bet/payout/refund/record`.
7. **`GK.earn` schluckt ungültige Beträge still** (`NaN`, `0`, negativ) und gibt nichts zurück. `GK.spend` gibt
   `false` zurück – den Rückgabewert immer prüfen, bevor etwas gewährt wird.
8. **Speichern ist Sache des Aufrufers.** Bis zum nächsten Autosave vergehen bis zu 5 s; nach Käufen und nach
   jedem Schritt einer laufenden Runde sofort `GK.save()`.
9. **`GK.setHTML` und direktes `innerHTML` nicht mischen.** Der Vergleich läuft über `el._html`; wer das Element
   nebenher direkt beschreibt, bekommt beim nächsten `setHTML` mit gleichem Text keine Aktualisierung.
10. **Zeitsprünge**: `loop` begrenzt einen Schritt auf 1 s, `onVisibilityChange` ruft `GK.clicker.tick` aber mit bis
    zu 28 800 s auf einmal auf. Wer sich in `tick` einhängt, muss mit großen `seconds` umgehen können.
11. **Tab-abhängiges Zeichnen**: Neue Anzeigen in `main.js:render` nur schreiben, wenn ihr Tab offen ist
    (Vorbild `renderStats`), sonst kostet es 10× pro Sekunde Zeit auf dem iPad.
12. **`showTab`, `refreshAll`, `render` sind privat** in der IIFE von `main.js`. Ein neues Modul wird dort
    eingetragen (`init`, `render`, ggf. `refreshAll`), nicht von außen aufgerufen.
13. **Sprachwechsel lädt die Seite neu.** Zustand, der nur im Speicher liegt, ist danach weg – ein weiterer
    Grund, laufende Runden sofort zu speichern.
14. **Tests laden einzelne Dateien in Node** (`global.window = global`). Code auf oberster Ebene einer Kern-Datei
    darf deshalb kein `document` voraussetzen; `state.js` prüft `window.matchMedia` und `localStorage` ab.
15. **`manifest.webmanifest`** (`start_url` und `scope` `./`, `display: standalone`) und die `apple-*`-Meta-Angaben
    machen das Spiel zur Home-Bildschirm-App. Einen Service Worker gibt es in `index.html` nicht; gegen alte
    Dateien hilft allein die Versionsnummer `?v=`.
