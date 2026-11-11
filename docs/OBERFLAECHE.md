# Oberfläche: Sprache, Symbole, Effekte, Ton, CSS

Nachschlagewerk für alles, was der Spieler sieht und hört. Projektregeln stehen in `CLAUDE.md`;
hier steht, wie die Bausteine tatsächlich funktionieren. Zeilennummern sind ungefähr (Stand `?v=2026111101`).

| Thema | Datei | Namensraum |
|---|---|---|
| Sprache | `js/i18n.js`, `js/i18n-ui.js` | `GK.t`, `GK.i18n` |
| Symbole | `js/icons.js`, `css/icons.css` | `GK.icon`, `GK.gameIcon`, `GK.iconFor`, `GK.iconText`, `GK.iconifyEmoji`, `GK.iconifyLead`, `GK.icons` |
| Effekte | `js/fx.js` | `GK.fx` |
| Ton | `js/sound.js` | `GK.sound` |
| Sparsames Schreiben ins DOM | `js/format.js` | `GK.setHTML`, `GK.setText`, `GK.formatDecimal`, `GK.COIN`, `GK.formatMoneyHTML` |
| Meldungen | `js/main.js` | `GK.toast`, `GK.notify` |
| Aussehen | `css/style.css` (≈10.600 Zeilen), `css/icons.css` | – |

Ladereihenfolge in `index.html`: `icons.js` zuerst (alle anderen bauen damit), dann `format.js`, `state.js`,
`i18n.js`, `sound.js`, `fx.js`, … alle Spiele …, **`i18n-ui.js` als vorletztes**, `main.js` zuletzt.

---

## 1. Sprache (Deutsch = Quelle, Englisch = Übersetzung)

### Wie es funktioniert (`js/i18n.js`)

Es gibt zwei Wörterbücher: `EN` (deutscher Quelltext → englischer Text) und `EN_HTML` (`data-i18n`-Schlüssel → englisches HTML).
Die aktuelle Sprache ist `GK.state.settings.lang` (`'de'` oder `'en'`; alles andere gilt als `'de'`).

| Aufruf | Wirkung |
|---|---|
| `GK.t(de, vars?, ctx?)` | Bei `en`: schlägt `EN[ctx + '\u0001' + de]` nach (falls `ctx` gesetzt), sonst `EN[de]`. Kein Treffer oder Sprache `de` → deutscher Text. Danach werden `{name}`-Platzhalter aus `vars` eingesetzt (unbekannte Platzhalter bleiben stehen). |
| `GK.i18n.add(map)` | Meldet Übersetzungen für `GK.t` **und** für feste Textknoten/Attribute an (`Object.assign(EN, map)` – spätere Einträge überschreiben frühere). |
| `GK.i18n.addHtml(map)` | Englisches HTML für ganze Elemente mit `data-i18n="schlüssel"`. |
| `GK.i18n.init()` | Einmal beim Start (`main.js:init`, nach `GK.load()`): merkt sich alle festen Texte der Seite und zeigt sie in der aktuellen Sprache. |
| `GK.i18n.apply()` | Setzt die gemerkten festen Texte neu (ohne neu zu merken). |
| `GK.i18n.set(lang)` | Schreibt `settings.lang`, ruft `GK.save()`, wendet feste Texte an, gibt die Sprache zurück. |
| `GK.i18n.lang` | Getter: `'de'` oder `'en'`. |
| `GK.i18n.available` | `['de', 'en']`. |

**Feste Texte in `index.html`** – `init()` macht einen Schnappschuss von drei Dingen:

1. Elemente mit `data-i18n` → ganzes `innerHTML` wird getauscht (Schlüssel aus `EN_HTML`). Derzeit: `fleet-intro`, `prestige-intro`, `cos-intro`.
2. Alle übrigen Textknoten in `<body>` mit mindestens 2 Zeichen (außer in `SCRIPT`/`STYLE`/`NOSCRIPT` und außerhalb von `data-i18n`).
   Nachgeschlagen wird der getrimmte Text, innere Umbrüche/Mehrfach-Leerzeichen zu **einem** Leerzeichen zusammengefasst; Rand-Leerzeichen bleiben erhalten.
3. Die Attribute `placeholder`, `title`, `aria-label`.

Der Schnappschuss entsteht **beim Start**, also bevor die Module ihre Anzeigen aufbauen. Später per JS erzeugter Inhalt
wird davon nicht erfasst – der muss selbst über `GK.t` laufen.

**Beim Umschalten** (`main.js:setupSettings`, `#set-lang`): `GK.i18n.set(wert)` und danach `location.reload()`.
Das Neuladen ist Absicht: Module mit Render-Caches bauen so alles in der neuen Sprache auf; laufende Runden sind gespeichert.
`applyStatic` setzt außerdem `<html lang>`.

**Standardsprache**: `js/state.js:createDefaultSettings` → `detectLang()`: Browser-Sprache beginnt mit `de` → Deutsch, sonst Englisch.
Alte Spielstände ohne gültiges `lang` bekommen `'de'` (`state.js:applyData`).

**Ohne `i18n.js`** (Tests laden einzelne Dateien): Jede Datei beginnt mit einem Ersatz wie
`GK.i18n = GK.i18n || { add() {}, addHtml() {}, apply() {}, set() {}, lang: 'de' };` bzw. `GK.t` gibt Deutsch zurück.

### Rezept: neuer Text aus JavaScript

```js
// oben in der Datei, die den Text benutzt
GK.i18n.add({
  'Du hast {n} Schätze gefunden!': 'You found {n} treasures!',
});
// an der Stelle der Anzeige
GK.toast(GK.t('Du hast {n} Schätze gefunden!', { n: anzahl }));
```

Gleiches deutsches Wort, verschiedene englische Bedeutung → Kontext:
`GK.i18n.add({ 'bj\u0001Karte': 'Hit' })` und `GK.t('Karte', null, 'bj')` (Beispiele: `js/casino/blackjack.js`, `baccarat.js` `bac`, `poker/table-ui.js` `pk`).

Zusammengesetzte Sätze: Teile einzeln übersetzen und als Platzhalter einsetzen (`js/daily.js`:
`GK.t('Kaufe {n} {ding}', { n, ding: GK.t('Upgrades') })`).

### Rezept: neuer fester Text in `index.html`

- Reiner Text oder Attribut: deutsch in `index.html` schreiben, in `js/i18n-ui.js` unter `GK.i18n.add({...})` den **exakten** Text
  (ein Leerzeichen statt Umbruch) als Schlüssel eintragen.
- Fließtext mit Auszeichnung (`<b>` …): Element mit `data-i18n="mein-schluessel"` versehen und das englische HTML in
  `GK.i18n.addHtml({ 'mein-schluessel': '…' })` eintragen.
- Text, der von Auszeichnung unterbrochen ist und **kein** `data-i18n` hat, zerfällt in mehrere Textknoten; jeder braucht einen
  eigenen Schlüssel (siehe Fußzeile: `'Gamble Klicker · Entwickelt von Rafael ('` und `') mit der Community · …'`).

### Nie übersetzen

Schlüssel, IDs, Netzwerk-Nachrichten, Spielstand-Felder, `GK.track`-Namen. Zahlen bleiben in deutscher Schreibweise
(`GK.formatNumber`, `GK.formatDecimal`). Einzelzeichen-Textknoten (z. B. das „D“ im Logo) überspringt `snapshot` absichtlich.

### Typische Fehler

- Schlüssel weicht ab (Satzzeichen, `…` statt `...`, typografische Anführungszeichen, Emoji, geschütztes Leerzeichen) → es bleibt stumm Deutsch.
- Platzhalter-Namen in Deutsch und Englisch unterschiedlich → `{x}` bleibt wörtlich stehen. Erlaubt ist nur `\w+` in den Klammern.
- Werte vor `GK.t` in den Text einbauen (Template-String) → Schlüssel passt nie. Immer `{platzhalter}` verwenden.
- `GK.t` auf Modul-Ebene beim Laden auswerten und das Ergebnis speichern: Zu dem Zeitpunkt ist der Spielstand noch nicht geladen
  (`GK.load()` läuft erst in `main.js:init`), es gilt also nicht die gespeicherte Sprache. Deutsche Texte in Daten ablegen und erst
  beim Anzeigen übersetzen (`GK.t(game.name)` in `casino.js`).
- Gleicher deutscher Schlüssel in zwei Dateien mit verschiedenem Englisch: die später geladene gewinnt. `i18n-ui.js` lädt
  deshalb fast zuletzt, damit die festen Texte Vorrang haben. Bei Konflikt `ctx` benutzen.

---

## 2. Symbole (`js/icons.js`, `css/icons.css`)

Ein unsichtbares SVG-Sprite (`#gk-sprite`) wird beim Laden an den Anfang von `<body>` gesetzt (`inject`). Zwei Sätze:

| Satz | ID im Sprite | Raster | Aufruf | Ergebnis |
|---|---|---|---|---|
| kleine Symbole | `#i-NAME` | 24 × 24 | `GK.icon(name, extraClass?)` | `<svg class="ic ic-NAME …"><use href="#i-NAME"/></svg>` |
| Spielbilder (Lobby) | `#g-ID` | 48 × 48 | `GK.gameIcon(id, fallback?)` | `<svg class="ic ic-game">…` oder `fallback` (Emoji), wenn `GAMES[id]` fehlt |

Alle Funktionen liefern **HTML-Text**, kein Element. In Node (kein `document`) wird nur nichts eingefügt.
`GK.icons = { names, games, emoji, spriteHTML }` gibt die Listen zur Laufzeit zurück.

### Stil der kleinen Symbole

Linie 2 px rund in `currentColor`, blasse Fläche (30 %), Akzent in `--ica` (Standard `--gold`). Bausteine in `icons.js`:

| Helfer | Bedeutung |
|---|---|
| `T`, `F`, `A`, `AS` | Attribut-Strings: blasse Fläche, volle Textfarbe, Gold-Fläche (`--ica`), Gold-Linie |
| `c(x,y,r)`, `rr(x,y,w,h,r)` | Kreis bzw. Rechteck mit runden Ecken als Pfad-Daten |
| `star(cx,cy,R,r,k,rot?)`, `gear(cx,cy,R,r,k)` | Stern/Zahnrad als Pfad-Daten |
| `duo(d, tone?)` | Fläche + Umriss desselben Pfads |
| `circ(x,y,r,attrs?)`, `duoC(x,y,r,tone?)` | `<circle>` bzw. Fläche + Umriss |

CSS-Größen: `.ic` (1,15em), `.ic-sm` (1em), `.ic-lg` (1,5em). Akzentfarben: `.ic-gold/.ic-silver/.ic-bronze` (Medaillen),
`.rk-t1…rk-t5` (Ränge), `.vip-ic-1/2`, `.ic-blue/.ic-red`. Auf goldenem Grund (`.tab.active`, `.btn-primary`, `.buff`, `.vip-card`)
wird `--ica: currentColor` gesetzt, sonst verschwindet der Akzent.

### Alle Symbolnamen (`ICONS`)

- **Tabs, Kopfzeile, Allgemeines**: `tap dice anchor trophy chart sound volume mute save pause bag coins clover swords gem scroll
  calendar map bolt sparkle chest users user gear palette kraken upload download trash warning sailboat slot cards trend star crown
  ticket medal pearl lock unlock check close gift hourglass flame target wind flag robot copy link wheel question back compass skull
  cannon ship eye burst comet volcano temple bank atlantis piggy lemon kiosk ring pickaxe flask island dragon portal trident ghost
  blackhole mirror galaxy hand fist planet handshake`
- **Knöpfe in Spielen**: `play stop roulette repeat shuffle bomb step up down forward plane news door pen shout heart wave briefcase
  shield moon dot`
- **Erfolge und Aufgaben**: `castle globe bricks city key stopwatch ball spyglass`
- **Rang-Abzeichen**: `boot mop rope helm hat laurel stars`

### Alle Spielbilder (`GAMES`, Schlüssel = Spiel-ID)

`slots vsPirate vsOcean vsVolcano scratch wheel plinko mines crash race flight chicken tower parole keno stopwatch stocks
roulette blackjack baccarat hilo poker dice kniffel maumau golf pool connect4 battleship darts duel`

Zeichen-Helfer für Spielbilder (jedes Bild liegt in einer Gruppe mit Umriss `INK`, 1,6 px):

| Helfer | Bedeutung |
|---|---|
| `p(d, fill, extra?)` | Pfad mit Füllfarbe; `extra` = zusätzliche Attribute als String (führendes Leerzeichen!) |
| `o(x, y, r, fill, extra?)` | Kreis |
| `R(x, y, w, h, r, fill, extra?)` | Rechteck mit runden Ecken |
| `coin(x, y, r)` | Goldmünze mit Innenring |
| `glint(x, y, s)` | weißer Vierzack-Glanz |
| `txt(x, y, size, fill, s, extra?)` | zentrierter Text in Cinzel |
| `card(x, y, w, h, rot, inner?)` | gedrehte Spielkarte |
| `spade / heart / diamond / club (x, y, s, fill)` | Kartenfarben |
| `die(x, y, s, rot, pips, fill?, pip?)` + `PIPS[1…6]` | Würfel |
| `waves(y)`, `wedges(cx, cy, r, colors)` | Wellenlinie, Kreissegmente (Rad, Roulette, Darts) |

Feste Farben: `INK #22160a`, `GOLD url(#gk-gold)` (Verlauf im Sprite), `GOLD_D #b07d0c`, `CREAM #f6ecd2`, `RED #d0453d`, `RED_D #8e2620`,
`TEAL #2bb3a0`, `SEA #2f86c9`, `SEA_D #1b4f7a`, `WOOD #9a6332`, `WOOD_D #5e3a1a`, `GREEN #3fa35c`, `BLACK #26262c`.

### Emoji → Symbol

`EMOJI` (in `icons.js`) ordnet Emojis einen Symbolnamen oder `[name, zusatzklasse]` zu; Emojis ohne Eintrag bleiben Emojis.
Erkannt wird mit und ohne Variantenzeichen U+FE0F.

Vollständige Zuordnung (Symbolname ← Emojis):

- `tap` 👆 🖱️ · `fist` 🦾 ✊ · `coins` 🪙 💸 🤑 · `bag` 💰 · `trophy` 🏆 · `crown` 👑 · `trend` 📈 · `chart` 📊 · `gear` 🏭 ⚙️
- `castle` 🏰 · `globe` 🌍 · `comet` 🌠 ☄️ · `bricks` 🧱 🏗️ · `city` 🏙️ 🌆 · `chest` 🗂️ 🧰 · `skull` 🏴‍☠️ ☠️ 💀 · `dragon` 🐉 · `galaxy` 🌌
- `trident` 🔱 · `burst` 💥 · `star` ⭐ 🌟 · `sparkle` 💫 ✨ 🎉 🦄 🔔 · `sailboat` ⛵ · `compass` 🧭 · `ship` 🚢 · `gem` 💎 💠 · `swords` ⚔️
- `kraken` 🐙 · `scroll` 📜 · `up` ⬆️ · `down` ⬇️ · `target` 🎯 🕳️ 🔴 💯 · `flame` 🔥 · `volcano` 🌋 · `handshake` 🤝 · `planet` 🪐
- `temple` ⚜️ · `palette` 🎨 🧥 · `key` 🗝️ 🔑 · `calendar` 📅 🗓️ · `anchor` ⚓ · `dice` 🎲 · `ticket` 🎟️ 🎫 · `slot` 7️⃣ 🎰 · `roulette` 🟢
- `wheel` 🎡 · `cards` 🃏 ♠️ ✌️ 4️⃣ · `gift` 🎁 · `island` 🏝️ · `stopwatch` ⏱️ · `hourglass` ⏳ ⌛ · `bomb` 💣 · `step` 🐔 · `eye` 🔮
- `spyglass` 🔭 · `map` 🗺️ · `piggy` 🫙 🐷 · `medal` 🏅 🎖️ sowie 🥇 (`ic-gold`) 🥈 (`ic-silver`) 🥉 (`ic-bronze`) · `pearl` 🖤 · `bolt` ⚡
- `pen` 📝 ✏️ · `flag` ⛳ 🚩 🏁 📯 · `ball` 🎱 · `users` 👥 · `user` 👤 · `lock` 🔒 · `unlock` 🔓 · `check` ✅ ✔️ · `close` ❌ · `warning` ⚠️
- `pause` ⏸️ · `play` ▶️ · `repeat` 🔁 🔄 · `shield` 🛡️ · `heart` ❤️ · `save` 💾 · `moon` 🌙 · `clover` 🍀 · `robot` 🤖 · `flask` 🧪
- `news` 📰 · `wave` 🌊 · `briefcase` 💼 · `boot` 🐀 · `mop` 🧹 · `rope` 🪢 · `helm` ☸️ · `wind` 💨 · `plane` ✈️ 🛬 🛫

| Funktion | Wirkung |
|---|---|
| `GK.iconFor(emoji, extraClass?)` | SVG-HTML zum Emoji, `''` ohne Eintrag. |
| `GK.iconText(text)` | Reiner Text → HTML-sicher (`& < > " '` maskiert), bekannte Emojis werden Symbole. Basis von `GK.toast`. |
| `GK.iconifyEmoji(root)` | Ersetzt bekannte Emojis in **allen** Textknoten unter `root`; überspringt `.emoji-keep` und `svg`. Wird von `GK.notify` benutzt. |
| `GK.iconifyLead(root)` | Ersetzt nur **das erste Wort** des ersten Textknotens, wenn es ein bekanntes Emoji ist. Steigt in erste Kind-Elemente ab, hält bei `svg`/`.emoji-keep` an. Für Meldungszeilen der Spiele, damit Walzen-/Karten-Symbole im Text bleiben. |

Übliches Muster in Casino-Spielen (z. B. `js/casino/mines.js`, `tower.js`, `parole.js`): Meldung per `innerHTML` setzen, danach
`if (GK.iconifyLead) GK.iconifyLead(els.message);`.

### Rezept: neues Lobby-Bild für ein Spiel

1. In `icons.js` unter `GAMES` einen Eintrag mit **der Spiel-ID** als Schlüssel anlegen (48 × 48, aus `p/o/R/coin/glint/…` zusammensetzen).
2. Mehr ist nicht nötig: `js/casino/casino.js` ruft `GK.gameIcon(game.id, game.emoji)` für Lobby-Karte (`.casino-emoji`, 76 px, ≤ 600 px Breite: 60 px)
   und Spielkopf (`.game-header h2`) auf. Ohne Eintrag erscheint das Emoji des Spiels.
3. Optional Kartenfarbe: `.casino-card[data-game="id"] { --accent: rgba(...); }` in `style.css`.
4. Versionsnummer `?v=` erhöhen.

### Rezept: neues kleines Symbol

1. In `ICONS` einen Eintrag `name: …` im Raster 24 × 24 ergänzen (Umriss über `duo`/`duoC`, Akzent mit `A`/`AS`).
2. Benutzen: `GK.icon('name')`. Soll ein Emoji in Toasts/Meldungen automatisch dazu werden: Eintrag in `EMOJI` ergänzen.
3. Sondergrößen/-farben in `css/icons.css` (kontextbezogen, z. B. `.mein-kasten .ic { … }`).
4. In `index.html` direkt: `<svg class="ic ic-name" aria-hidden="true"><use href="#i-name"/></svg>` (so beim Ton-Knopf).

---

## 3. Effekte (`js/fx.js`, `GK.fx`)

Partikel laufen auf einer bildschirmfüllenden Zeichenfläche `.fx-canvas` (z-index 75, `pointer-events: none`), höchstens 450 Partikel,
die Schleife läuft nur, solange Partikel leben. „Reduziert“ heißt `GK.state.settings.effects === 'reduced'` (intern `reduced()`).

| Funktion | Wirkung | Bei „reduziert“ |
|---|---|---|
| `init()` | Legt die Zeichenfläche an, hängt `resize` an. Einmal aus `main.js:init`. | – |
| `burst(x, y, opts?)` | Partikel von einem Punkt (Fensterkoordinaten). `opts`: `count` (20), `speed` (600), `kind` (`'coin'` Standard, `'confetti'`, `'bubble'`, `'emoji'`, `'flame'`, `'firework'`, sonst Funkeln z. B. `'sparkle'`), `upward` + `spread` (1,6) für Fächer nach oben, `size`, `colors` (4 Münzfarben: Glanz, Mitte, Schatten, Rand), `char` (Zeichen bei `'emoji'`, Standard ✨). | macht nichts |
| `confetti(count = 120)` | Konfetti-Kanonen von beiden unteren Seiten. | macht nichts |
| `coinRain(seconds = 2, density = 40)` | Goldmünzen regnen von oben; mehrere Aufrufe verlängern/verstärken. | macht nichts |
| `pulse(el, cls = 'fx-pulse')` | Setzt eine CSS-Klasse mit kurzer Animation und entfernt sie bei `animationend`/`animationcancel` wieder. Läuft sie schon, wird sie neu gestartet (ein erzwungenes Layout). `el` darf `null` sein. | **läuft immer** – Beruhigung nur über CSS |
| `shake(strength = 'small')` | `pulse(main, 'fx-shake')` bzw. `'fx-shake-big'` bei `'big'`. | macht nichts |
| `flash()` | Heller Blitz (`.fx-flash`, 0,7 s). | macht nichts |
| `floatText(x, y, html, cls = '')` | Aufsteigender Text `.fx-float` (1,6 s), z. B. `'win'`, `'win big'`. `html` wird als HTML gesetzt. | **läuft immer** |
| `banner(level, amount, subtitle?)` | Vollbild-Banner `.win-banner`; `level`: `'big'` (2,6 s), `'mega'` (3,4 s), `'jackpot'` (4,4 s). Betrag zählt hoch, Tippen schließt, ein neues Banner ersetzt das alte. | **läuft immer** (CSS stoppt Strahlen/Titel-Animation) |
| `celebrate(payout, bet, opts?)` | Feiert passend zur Höhe und gibt die Stufe zurück (siehe unten). `opts`: `el` (Ausgangspunkt der Münzen, sonst Bildmitte), `level` (Stufe erzwingen), `subtitle`, `quiet` (kein Verlust-Ton). | Ton, Banner, Text und Kontostand-Pop bleiben; Partikel, Blitz, Wackeln fallen weg |
| `center(el)` | Mittelpunkt `{x, y}` eines Elements im Fenster (ohne `el`: Fenstermitte). | – |

`celebrate` im Detail (`payout` = Auszahlung inkl. Einsatz):

| Bedingung | Rückgabe | Was passiert |
|---|---|---|
| `payout <= 0` | `'lose'` | Ton `lose` (außer `quiet`) |
| `payout <= bet` | `'push'` | Ton `coin` |
| Verhältnis < 5 | `'small'` | `winSmall`, Münzen + Funkeln, `floatText('+Gewinn')` |
| ≥ 5 | `'big'` | Banner, `winBig`, Münzen, Konfetti, Blitz |
| ≥ 20 | `'mega'` | Banner, `winMega`, + Münzregen, kleines Wackeln |
| ≥ 100 | `'jackpot'` | Banner, `jackpot`, + großer Münzregen, großes Wackeln, zweites Konfetti |

Bei jedem Gewinn zusätzlich `pulse(.wallet, 'fx-wallet')`. Banner und `floatText` zeigen den **Netto**-Gewinn (`payout − bet`).

### Verwandte Helfer außerhalb von `fx.js`

| Funktion | Datei | Wirkung |
|---|---|---|
| `GK.setHTML(el, html)` | `js/format.js` | Schreibt `innerHTML` nur, wenn sich `html` gegenüber dem zuletzt **über `setHTML`** geschriebenen Wert (`el._html`) ändert. |
| `GK.setText(el, text)` | `js/format.js` | Schreibt `textContent` nur bei Änderung (vergleicht mit dem echten Inhalt). |
| `GK.toast(message, icon?)` | `js/main.js` | Kurze Meldung unten mittig (`#toast`, 2,5 s, ersetzt die vorige). `message` ist **reiner Text** (wird maskiert, Emojis → Symbole). `icon`: Symbolname oder `[name, klasse]`, steht davor. |
| `GK.notify(html, duration = 5000)` | `js/main.js` | Karte im Stapel `#notify-stack` (oben rechts unter der Kopfzeile, höchstens 3), nimmt HTML, ruft `iconifyEmoji`, Tippen schließt. |

---

## 4. Ton (`js/sound.js`, `GK.sound`)

Alle Töne entstehen live über Web Audio (Oszillatoren + Rauschen), es gibt keine Sounddateien.

| Funktion | Wirkung |
|---|---|
| `play(name, ...args)` | Spielt `SOUNDS[name]`. Stumm, wenn Ton aus, Name unbekannt, kein Audio-Kontext oder Kontext nicht `running`. Weitere Argumente gehen an den Ton (siehe Tabelle). |
| `unlock()` | Erzeugt/weckt den Audio-Kontext und spielt einmal einen stillen Puffer. Hängt automatisch an `pointerdown`, `touchend`, `keydown` (capture) – muss nicht von Hand aufgerufen werden. |
| `setEnabled(on)` | `settings.sound`, ggf. `unlock()`, Lautstärke anwenden, speichern. |
| `setVolume(v)` | `settings.volume` auf 0…1 begrenzt, anwenden, speichern. |
| `applyVolume()` | Master-Lautstärke = `sound ? volume × 0,6 : 0`. Nach Import/Zurücksetzen (`main.js:refreshAll`). |

Einstellungen: `GK.state.settings.sound` (Standard `true`), `.volume` (Standard `0.7`); bedient über `#sound-toggle` (Kopfzeile),
`#set-sound`, `#set-volume` in `main.js:setupSettings`.

iOS: Vor der ersten Berührung ist der Kontext `suspended`, `play` tut dann nichts. Töne, die ohne Berührung starten
(z. B. direkt nach dem Laden), sind auf dem iPad stumm – das ist kein Fehler.

### Alle Tonnamen

| Gruppe | Namen |
|---|---|
| Klicker & Kaufen | `click`, `coin`, `buy`, `upgrade`, `denied`, `crit`, `combo`, `milestone`, `powerup` |
| Fortschritt | `achievement`, `golden`, `collect`, `bonus` |
| Gewinn/Verlust | `winSmall`, `winBig`, `winMega`, `jackpot`, `lose` |
| Automaten & Rad | `tick`, `reelStop`, `lever`, `spinStart`, `rouletteSpin` |
| Karten & Chips | `card`, `flip`, `deal`, `chip`, `scratch` |
| Sonstige Spiele | `plink`, `cannon`, `boom`, `dig`, `gem`, `horn` |

Zusatzargument: `plink(pitch = 1)`, `gem(pitch = 1)` (Tonhöhe als Faktor), `rouletteSpin(duration = 4)` (Sekunden).
Alle anderen Töne ignorieren weitere Argumente.

Drosselung (Mindestabstand in ms, sonst wird der Aufruf verworfen): `click 30`, `scratch 70`, `tick 25`, `chip 40`, `card 60`, `plink 30`, `dig 60`.

Neuer Ton: Eintrag in `SOUNDS` als `name(t, …)` aus `tone(freq, start, dauer, opts)`, `noise(start, dauer, opts)`, `ping`, `jingle`, `arpeggio`
zusammensetzen; `t` ist die Startzeit im Audio-Kontext.

---

## 5. CSS (`css/style.css`, `css/icons.css`)

### Variablen (`:root`, `style.css` Zeile 9–67)

| Gruppe | Variablen |
|---|---|
| Flächen | `--bg`, `--bg-panel`, `--bg-panel-hover`, `--panel` (Verlauf), `--border`, `--border-soft`, `--radius` (16px), `--shadow` |
| Gold | `--gold #f5c542`, `--gold-light #ffe58a`, `--gold-dark #b8860b`, `--gold-grad`, `--ink-on-gold #2a1d00` |
| Text & Zustand | `--text`, `--text-muted`, `--win #6fdc8c`, `--loss #ff8a80`, `--danger`, `--red`, `--cream`, `--focus-ring` |
| Gesperrt | `--disabled-bg`, `--disabled-border`, `--disabled-text` |
| Schrift | `--font-display` (Cinzel, nur H2/Logo), `--fs-xs 0.8rem`, `--fs-sm 0.875rem`, `--fs-base 1rem`, `--fs-md 1.125rem`, `--fs-lg 1.375rem`, `--fs-xl 1.625rem`, `--fs-2xl 2rem` |
| Abstände | `--space-1…6` = 4, 8, 12, 16, 24, 32 px |
| Layout | `--header-height` (wird von `main.js:updateHeaderHeight` auf die echte Höhe gesetzt) |
| Farbthema (Schatzkammer) | `--header-bg`, `--btn-bg`, `--glow-1…3` |
| Casino-Look (Schatzkammer) | `--felt`, `--felt-flat`, `--rail`, `--rail-glow`, `--card-back`, `--card-back-edge`, `--card-back-mark`, `--card-back-mark-color` |
| Münz-Design | `--coin-face`, `--coin-rim`, `--coin-rim-2`, `--coin-glow`, `--coin-letter`, `--coin-letter-shadow`, `--coin-ring`, `--coin-rays` (`.coin-skin-*`) |

Text nie kleiner als `--fs-xs`. Neue Regeln sollen Variablen statt fester Farbwerte benutzen, damit Farbthemen greifen.

### Wiederverwendbare Bausteine

| Klasse(n) | Zweck |
|---|---|
| `.panel` (auch `.shop-section`, `.casino-info-box`, `.paytable`, `.mp-forms`, `.stats-list`, `.settings`) | Kasten-Look: Verlauf, weicher Goldrand, Schatten |
| `.btn`, `.btn-primary`, `.btn-danger`, `.btn-small`, `.btn-big` | Knöpfe; `btn-primary` = golden mit Lichtreflex |
| `.icon-btn` | runder 44-px-Knopf (Ton an/aus) |
| `.amount-btn` (`.active`) | Mengen-/Betragswahl |
| `.tabs`, `.tab` (`.active`), `.tab-icon`, `.tab-panel` (`.active`) | Hauptnavigation; Panels heißen `#tab-NAME` |
| `.muted`, `.small`, `.win`, `.loss`, `.warning`, `.section-gap` | Texthelfer |
| `.money`, `.dublone` | Betrag ohne Umbruch, Münz-Zeichen (`GK.COIN`, `GK.formatMoneyHTML`) |
| `.game-header`, `.game-stats-btn`, `.game-stats…` | Kopf eines geöffneten Spiels, Statistik je Spiel |
| `.game-message` (`.win`) | Meldungszeile eines Spiels; `.win` poppt auf |
| `.game-actions` | Knopfreihe, zentriert, umbrechend |
| `.bet-control`, `.bet-label`, `.bet-row`, `.bet-input`, `.bet-display`, `.bet-warning`, `.bet-limit`, `.amount-preview` | Einsatz-Auswahl; wird von `casino.js:createBetControl` erzeugt (Min, ½, ×2, Max) |
| `.wheel-layout/.plinko-layout/.mines-layout/.crash-layout` + `…-controls` | Spielfeld links, Bedienung rechts, schmal untereinander. `.mines-layout` wird auch von Mast-Kletterei und Geheimer Parole benutzt. |
| `.card`, `.card.red`, `.card.small`, `.card-back`, `.card-placeholder`, `.deal-in`, `.flip-in` | Spielkarten |
| `.casino-grid`, `.casino-card` (`.locked`, `data-game`), `.casino-emoji`, `.casino-section-title` | Lobby |
| `.paytable`, `.paytable-icon` | Tabellen in Spielen |
| `.setting`, `.setting-hint`, `.switch` | Einstellungszeilen, Schalter (Checkbox) |
| `.toast` (`.show`), `.notify-stack`, `.notify` (`.hide`), `.notify-icon` | Meldungen |
| `.mp-forms`, `.mp-status` (`.online`, `.connecting`), `.mp-tag`, `.mp-check`, `.room-…` | Spiele mit Freunden (`js/mp/room.js`) |
| `.fx-pulse`, `.fx-float` (`.win`, `.big`), `.fx-wallet`, `.fx-shake`, `.fx-shake-big`, `.fx-flash`, `.win-banner` | gehören zu `GK.fx` |
| `.emoji-keep` | Emoji darin wird nicht durch ein Symbol ersetzt |

Ebenen (z-index): Kopfzeile 30 · `.fx-flash` 74 · `.fx-canvas` 75 · `.fx-float` 76 · `.win-banner` 80 · `.toast` 90.

### Präfixe je Spiel/Bereich

Jedes Spiel hat ein eigenes Klassen-Präfix; ein neues Spiel bekommt ein neues, kurzes, noch unbenutztes Präfix.

| Präfix | Bereich | Präfix | Bereich |
|---|---|---|---|
| `slot-`, `reel-` | Slot-Maschine, Walzen | `vs-` | Video-Slots |
| `sb-`, `scratch-` | Rubbellose | `rb-` | Roulette |
| `bj-` | Blackjack (teils auch Baccarat) | `bac-` | Baccarat |
| `hilo-` | Höher oder tiefer | `wheel-` | Glücksrad |
| `plinko-` | Münzfall | `mine-`, `mines-` | Schatzinsel |
| `crash-` | Kanonenkugel (einige Klassen von anderen Spielen mitbenutzt) | `race-` | Schiffsrennen |
| `fh-`, `flight-` | Flugkapitän (`fh-` auch Chicken Road) | `cr-` | Chicken Road |
| `tw-` | Mast-Kletterei | `pa-` | Geheime Parole |
| `kn-` | Schatzkarten-Keno | `sw-` | Stoppuhr |
| `seat-`, `poker-` | Poker-Tisch | `mp-`, `room-` | Räume/Freunde allgemein |
| `dice-` | Lügenwürfel | `kf-` | Kniffel |
| `mm-` | Mau-Mau | `golf-` | Minigolf (auch von Billard/Darts mitbenutzt) |
| `pool-` | Billard (auch von anderen Freundes-Spielen mitbenutzt) | `c4-` | Vier gewinnt |
| `bs-` | Seeschlacht | `duel-` | Kanonenduell |
| `side-` | Side-Slot | `kr-` | Kraken |
| `cos-`, `nt-`, `ts-` | Schatzkammer | `fig-` | Eigene Figur |
| `rank-`, `rk-t1…5` (in `icons.css`) | Ränge | `ft-`, `fd-` | Flotte |
| `boss-` | Bosskämpfe | `fb-` | Freundes-Rangliste |
| `daily-` | Tägliche Aufgaben | `vip-` | VIP-Karte |

### Abschnitte in `style.css` (ungefähre Zeilen)

| Zeile | Abschnitt | Zeile | Abschnitt |
|---|---|---|---|
| 8 | Farben & Grundlagen | 213 | Kopfzeile & Tabs |
| 380 | Knöpfe & Eingaben | 479 | Klicker |
| 776 | Side-Slot | 875 | Shop: Upgrades & Gebäude |
| 1253 | Tägliche Aufgaben | 1383 | Kraken-Angriff |
| 1612 | Freundes-Rangliste | 1711 | Casino: Lobby |
| 1885 | Casino: gemeinsame Bausteine, Statistik je Spiel | 2053 | Spielkarten |
| 2158 | Walzen, Hebel (2247), Slot-Maschine (2384) | 2473 | Rubbellose |
| 2800 | Roulette (+3304 Kugel & Chips) | 2971 | Blackjack (+3368) |
| 3074 | Texas Hold'em (+3383, 3753, 3850) | 3400 | Statistiken & Einstellungen |
| 3543 | Toast | 3565 | Fortschritt: Boni, goldene Dublone, Meldungen |
| 3738 | VIP-Karte | 3978 | Effekte |
| 4072 | Gewinn-Banner | 4193 | Animationen reduziert |
| 4237 | Lobby-Farben, gemeinsames Layout | 4267 | Glücksrad |
| 4391 | Münzfall | 4441 | Hafenbörse |
| 4625 | Schatzinsel | 4709 | Kanonenkugel |
| 4752 | Schiffsrennen | 4901 | Video-Slots |
| 5229 | Spielräume | 5295 | Lügenwürfel |
| 5519 | Minigolf | 5644 | Billard |
| 5753 | Flugkapitän | 5900 | Chicken Road |
| 6017 | Höher oder tiefer | 6106 | Mast-Kletterei |
| 6240 | Geheime Parole | 6463 | Schatzkarten-Keno |
| 6568 | Baccarat | 6727 | Kniffel |
| 6919 | Mau-Mau | 7163 | Vier gewinnt |
| 7281 | Seeschlacht | 7469 | Darts |
| 7591 | Kanonenduell | 7621 | Tablet / iPad |
| 7756 | Handy | 7940 | Schatzkammer: Münz-Designs, Farbthemen (8062), Kacheln, Glücksrad, Casino-Look (8489) |
| 8609 | Eigene Figur | 8874 | Ränge |
| 8938 | Flotte | 9222 | Bosskämpfe |
| 9358 | Stoppuhr | 9475 | **Feinschliff 1**: Grundgerüst, Zustände, Tippflächen (9758), Fokus (9827), iPad quer (9859), weniger Bewegung (9954) |
| 10000 | **Feinschliff 2**: Meldungen, Einsatzzeilen, Überschriften, Bewegung (10339) | 10375 | **Feinschliff 3**: Lesbarkeit, Kontrast, Zustände, Platz hochkant |

Die Feinschliff-Blöcke stehen bewusst am Ende und überschreiben ältere Regeln gleicher Spezifität.

### Medienabfragen und iPad-Regeln

| Abfrage | Bedeutung |
|---|---|
| `(max-width: 1180px)` | Tablet allgemein |
| `(min-width: 761px) and (max-width: 900px)` | iPad hochkant (810 breit) |
| `(min-width: 901px) and (max-height: 860px)` | iPad quer (1080 × 810): kompakte Kopfzeile |
| `(max-width: 900px)` | in Spiel-Abschnitten: hochkant, Spielfeld über Bedienung |
| `(max-width: 760px)`, `560px`, `400px` | Handy |
| `(pointer: coarse)` | Touch: größere Tippflächen |
| `(hover: hover)` | **einziger** Ort für `:hover`-Regeln |
| `(prefers-reduced-motion: reduce)` | System-Vorgabe „Bewegung reduzieren“ |

- **Tippflächen**: mindestens 44 × 44 px (`.btn`, `.btn-small`, `.amount-btn`, `.bet-input`, Zeile ≈9758). Kästchen werden 28 px gezeichnet,
  die ganze Zeile (`.mp-check`, `.crash-auto`) ist tippbar.
- **Kein Doppeltipp-Zoom**: `button { touch-action: manipulation }` gilt global. Tippbare Elemente, die keine `<button>` sind, brauchen es selbst.
  Flächen zum Ziehen/Zielen/Rubbeln (Hebel, Rubbellos, Minigolf, Billard, Darts, Kanonenduell, Boss) setzen `touch-action: none`.
- **Hover** nur in `@media (hover: hover)`; für Druck-Rückmeldung `:active` mit `transform`/`filter`.
- **Dauer-Animationen** (`infinite`) nur mit `transform` oder `opacity`. Kein `box-shadow`, `left`, `background-position` im Dauerlauf, kein
  `backdrop-filter` (Kopfzeile ist deshalb fast deckend statt unscharf). Vorbild: `@keyframes shine` (Zeile ≈438) – `translateX` statt `left`.
- Kein `background-attachment: fixed` (geht auf dem iPad nicht): Hintergrund liegt als feste Ebene in `body::before`.
- `body` hat `user-select: none`; Eingabefelder schalten es wieder ein. Ränder mit `env(safe-area-inset-*)`.
- `[hidden] { display: none !important }` – Verstecken über das Attribut `hidden` funktioniert auch bei `.btn`.

### Reduzierte Effekte per CSS

`main.js:renderSettings` setzt `body.reduced-effects`, wenn `settings.effects === 'reduced'` (Standard `'reduced'`, wenn das System
`prefers-reduced-motion` meldet, sonst `'full'`). Drei Stellen in `style.css`, jeweils doppelt (Klasse **und** Medienabfrage):

1. Zeile ≈4193: Liste von Dauer-Animationen mit `animation: none !important` (Münze, Lichtreflex, Lobby-Bilder, Strahlen …).
2. Zeile ≈9954: pauschal `animation-iteration-count: 1 !important` für alles → Endlosschleifen laufen genau einmal, kurze Effekte bleiben.
   `main.fx-shake` dauert unter der Medienabfrage nur 1 ms, damit `fx.pulse` die Klasse über `animationend` wieder entfernt.
3. Zeile ≈10339: Status-Hervorhebungen, die sonst pulsieren, bleiben als ruhiges Leuchten sichtbar (`animation: none; opacity: 1`).

Für eine neue Dauer-Animation: Ohne Zutun läuft sie reduziert einmal durch. Wenn der Endzustand dann falsch aussieht (z. B. unsichtbar)
oder die Animation einen Zustand anzeigt, den Selektor in Block 1 bzw. 3 ergänzen – immer in beiden Varianten.

---

## 6. Stolperfallen

- **`GK.setHTML` und direktes `innerHTML` nicht mischen**: `setHTML` vergleicht mit `el._html`. Wer dazwischen `el.innerHTML = …` schreibt,
  bekommt beim nächsten `setHTML` mit altem Wert kein Update. Ein Element immer nur auf eine Art pflegen.
- **`GK.toast` nimmt Text, `GK.notify` nimmt HTML**: HTML in `toast` erscheint als sichtbare Spitzklammern; ungeprüfte Namen in `notify` vorher maskieren.
- **`GK.icon` prüft den Namen nicht**: Ein Tippfehler ergibt ein leeres `<svg>` ohne Fehlermeldung. Namen gegen `GK.icons.names` prüfen.
- **`extra`-Attribute in `p/o/R`** werden roh angehängt – sie müssen mit einem Leerzeichen beginnen (`' stroke="none"'`).
- **Sprite nie mit `display: none` verstecken**: Der Goldverlauf `#gk-gold` wird sonst in manchen Browsern nicht gezeichnet.
- **Emoji-Ersatz ist nicht überall aktiv**: Nur `toast`, `notify` und Stellen, die `iconifyLead`/`iconifyEmoji`/`iconFor` selbst aufrufen.
  Andernorts bleibt ein Emoji ein System-Emoji. `iconifyLead` ersetzt nur das Emoji ganz vorn.
- **Partikel mit `kind: 'emoji'`** zeichnen das System-Emoji auf die Zeichenfläche (kein Sprite-Symbol).
- **`fx.pulse` braucht eine endende Animation**: Die Klasse muss eine CSS-`animation` mit endlicher Dauer haben, sonst bleibt sie für immer
  am Element (kein `animationend`). Keine `infinite`-Animation über `pulse` starten.
- **`fx.banner` und `fx.celebrate`** erwarten gültige Stufen; `banner` mit unbekanntem `level` wirft. Die Banner-Titel
  („GROSSER GEWINN!“, „MEGA-GEWINN!“, „JACKPOT!“) und „Tippen zum Schließen“ stehen in `fx.js` als feste deutsche Texte ohne `GK.t`.
- **`fx.burst/confetti/coinRain` erwarten Fensterkoordinaten** (`clientX/clientY`, `GK.fx.center(el)`), keine Seitenkoordinaten.
- **`GK.fx` und `GK.sound` lesen `GK.state.settings`**: In Tests ohne geladenen Zustand werfen sie. Spielregeln deshalb von Darstellung trennen.
- **`GK.sound.play` kann stumm bleiben**, ohne Fehler: Ton aus, unbekannter Name, Drosselung, Kontext vor der ersten Berührung.
- **Sprachwechsel lädt die Seite neu**: Zustand, der nur im Speicher liegt, geht dabei verloren – laufende Runden sofort speichern (siehe `CLAUDE.md`).
- **Feste Texte werden nur einmal beim Start erfasst**: Nachträglich ins DOM gesetztes statisches HTML wird von `i18n.apply()` nicht übersetzt.
- **Kurze Schlüssel kollidieren**: `EN` ist ein gemeinsames Wörterbuch für alle Dateien und für feste Textknoten. Einzelwörter wie „Karte“
  lieber mit `ctx` anmelden.
- **Reihenfolge in `style.css` zählt**: Die Feinschliff-Blöcke am Ende überschreiben Regeln weiter oben (z. B. `min-height: 44px` für Knöpfe).
  Wirkt eine neue Regel nicht, zuerst dort nachsehen.
- **Zahlen**: `GK.formatDecimal(n, min, max)` statt `toLocaleString` mit Optionen (zwischengespeicherte Formate, immer `de-DE`).
