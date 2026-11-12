# Klicker, Fortschritt und Abenteuer

Entwickler-Doku für alles außerhalb des Casinos. Stand: 11.11.2026.
Alle Angaben sind aus dem Code belegt; Verweise in der Form `datei:funktion`. Unklares ist als **(unklar)** markiert.
Projektregeln (Sprache, Versionsnummer, Spielstand, iPad) stehen in `CLAUDE.md` und gelten zusätzlich.

| Modul | Datei | Namensraum | Tab |
|---|---|---|---|
| Klicker (Gebäude, Upgrades, Münze) | `js/clicker.js` | `GK.clicker` | Klicker |
| Boni, goldene Dublone, große Fahrt, Offline | `js/progress.js` | `GK.progress` | Fortschritt |
| Erfolge | `js/achievements.js` | `GK.achievements`, `GK.unlockAchievement` | Fortschritt |
| Tägliche Aufgaben | `js/daily.js` | `GK.daily` | Fortschritt |
| Ränge | `js/rank.js` | `GK.rank` | Fortschritt |
| Schatzkammer (Cosmetics) | `js/cosmetics.js` | `GK.cosmetics` | Fortschritt |
| Eigene Figur | `js/figure.js` | `GK.figure` | Statistiken |
| Flotte | `js/fleet.js` | `GK.fleet` | Abenteuer |
| Bosskämpfe | `js/boss.js` | `GK.boss` | Abenteuer |
| Kraken-Angriff | `js/kraken.js` | `GK.kraken` | Klicker (über der Münze) |

Geld läuft immer über `state.js:GK.earn(betrag, quelle)` / `GK.spend(betrag)`. Zufall kommt aus `GK.rng`
(`int`, `float`, `weighted`, `shuffle`) – definiert in `js/casino/casino.js`, nicht in einem der Module hier.

---

## 1. Klicker (`js/clicker.js`)

### 1.1 Gebäude

Liste: `BUILDINGS` (24 Einträge, `finger` … `bigbang`), öffentlich als `GK.clicker.BUILDINGS`.

```js
{ id: 'piggy', icon: '🐷', ic: 'piggy', name: 'Sparschwein', baseCost: 100, baseCps: 1, desc: 'Jeder Cent zählt.' }
```

| Feld | Bedeutung |
|---|---|
| `id` | Schlüssel in `GK.state.buildings` (`{ id: anzahl }`) und in Upgrade-IDs – nie umbenennen |
| `icon` / `ic` | Emoji (Fallback, Kraken, Meldungen) / Name des eigenen Symbols aus `js/icons.js` |
| `name`, `desc` | deutscher Quelltext; Anzeige über `GK.t(...)`, Englisch im `GK.i18n.add`-Block oben in der Datei |
| `baseCost`, `baseCps` | Preis des ersten Stücks, Einkommen pro Sekunde und Stück ohne Boni |

**Preisformel** (`clicker.js:buildingCost`, `COST_GROWTH = 1.15`), für `n` Stück bei schon `k` vorhandenen:

```
Preis = ceil( baseCost · 1,15^k · (1,15^n − 1) / 0,15 )
```

`n` ist die Kaufmenge (`buyAmount`, Knöpfe `.amount-btn`, `data-amount`). `buildingsWorth()` summiert
`buildingCost(b, 0, anzahl)` über alle Gebäude (Rangliste „Vermögen mit Gebäuden“ in `js/friends.js`).

Sichtbarkeit (`clicker.js:renderBuildings`): gezeigt werden alle Gebäude bis zum letzten, das man besitzt oder
für das `totalEarned >= baseCost / 2` gilt, plus das nächste als „???“.
Meilensteine `BUILDING_MILESTONES = [10, 25, 50, 100, 150, 200, 250, 300]` lösen nur Effekte/Meldung aus.

### 1.2 Upgrades

Liste: `UPGRADES` – von Hand gepflegte Einträge plus automatisch erzeugte je Gebäude. Gekaufte IDs stehen in
`GK.state.upgrades` (Array). Ein Upgrade ist kaufbar, wenn `unlocked(GK.state)` wahr ist; die Liste zeigt die 8
billigsten (`UPGRADES_SHOWN`), sortiert nach Preis.

```js
{ id, icon, ic, name, cost, type, value, rarity, desc, unlocked: s => …,  // immer
  all: true,            // nur clickMult: wirkt auch auf den Einkommens-Anteil
  building, source }    // nur buildingMult / synergy
```

| `type` | Wirkung (wo ausgewertet) | Einträge |
|---|---|---|
| `clickMult` | Klick-Grundwert × `value`; mit `all: true` auch der Einkommens-Anteil (`getClickPower`) | `click1`–`click4` (×2), `click5`–`click7` (×3, all), `click8` (×4, all) |
| `clickCps` | Klick bringt zusätzlich `value` × Einkommen/s; Werte werden **addiert** | `cpsClick1`–`5` (1 %…5 %, zusammen 15 %) |
| `critChance` | Chance wird **addiert** (`critChance`) | `crit1` 3 %, `crit2` 4 %, `crit4` 5 % (max. 12 %) |
| `critMult` | höchster Wert gewinnt, Grundwert ×10 (`critMult`) | `crit3` ×25, `crit5` ×50 |
| `comboCap` | höchster Wert gewinnt, Grundwert 25 (`comboCap`) | `combo1` 50, `combo2` 100, `combo3` 200 |
| `globalMult` | alle Gebäude × `value`, multipliziert (`globalMultiplier`) | `global1`–`7` (×1,1 … ×1,4), ab 50 … 1600 Gebäuden |
| `buildingMult` | ein Gebäude × `value` (`buildingMultiplier`) | automatisch: `<gebäude>-1` … `<gebäude>-9` |
| `synergy` | Gebäude × (1 + 0,01 × Anzahl des Vorgänger-Gebäudes) | automatisch: `syn-<gebäude>` (nicht für das erste) |

Automatisch erzeugt aus `BUILDING_TIERS` (je Gebäude 9 Stufen):

| Stufe | ab Anzahl | Preis = `baseCost` × | × | `rarity` |
|---|---|---|---|---|
| Bronze | 1 | 10 | 2 | `bronze` |
| Silber | 10 | 50 | 2 | `silver` |
| Gold | 25 | 500 | 2 | `gold` |
| Platin | 50 | 5.000 | 2 | `platinum` |
| Diamant | 100 | 5e5 | 3 | `diamond` |
| Legenden | 150 | 5e7 | 3 | `legend` |
| Mythos | 200 | 5e9 | 4 | `mythic` |
| Sternen | 250 | 5e11 | 4 | `cosmic` |
| Götter | 300 | 5e13 | 5 | `divine` |

Synergie: Preis `baseCost × 200`, frei ab je 15 Stück von Gebäude und Vorgänger. `rarity` steuert die CSS-Klasse
`rarity-…` und (für `diamond`, `legend`, `mythic`, `cosmic`, `divine`, `empire`) den größeren Kauf-Effekt.
Namen/Beschreibungen der automatischen Upgrades werden für die Anzeige aus Vorlagen gebaut
(`clicker.js:upgradeName`, `upgradeDesc`: `'{tier}-{name}'`, `'{source} & {name}'` …).

### 1.3 Einkommen pro Sekunde

```
buildingBaseCps(b) = b.baseCps · buildingMultiplier(b.id) · globalMultiplier()
baseCps()          = Σ Anzahl(b) · buildingBaseCps(b)
getCpsPermanent()  = baseCps() · GK.progress.permanentMult()
getCps()           = baseCps() · GK.progress.permanentMult() · GK.progress.buffMult('income')
```

- `getCps()` – aktuelles Einkommen inklusive Goldrausch. Benutzt von `tick`, Anzeige, `getClickPower`.
- `getCpsPermanent()` – ohne zeitliche Boni. Benutzt von Offline-Einnahmen, Erfolgen (`cps…`), täglichen Aufgaben,
  goldener Dublone, Kraken-Beute, Flotte (`fleet.js:income`), Casino (`biggestLossPct`).
- `tick(sekunden)` schreibt `getCps() · sekunden` mit Quelle `'passive'` gut – nur wenn `passiveActive()`
  (`!GK.state.passiveOff`). **Der Schalter ändert `getCps()` nicht**, nur ob `tick` und Offline-Einnahmen zahlen.

### 1.4 Klickkraft, Combo, kritische Treffer

`clicker.js:getClickPower` (ohne Combo und Krit):

```
Klickkraft = ( M · permanentMult  +  getCps() · A · M_all ) · buffMult('click') · GK.boss.clickMult()
```

`M` = Produkt aller gekauften `clickMult`, `M_all` = Produkt nur derer mit `all: true`, `A` = Summe aller `clickCps`.
Der Grundwert ist 1 (steckt implizit in `M · permanentMult`). Weil `getCps()` den Goldrausch enthält, hebt
Goldrausch auch den Einkommens-Anteil der Klicks.

Ein Klick (`clicker.js:click`):

```
Betrag = getClickPower() · comboMult() · (kritisch ? critMult() : 1)
```

- **Combo**: nächster Klick innerhalb `COMBO_WINDOW = 700` ms erhöht `combo.count`, sonst zurück auf 1.
  `comboBonus() = min(count − 1, comboCap())` Prozent, `comboMult() = 1 + Bonus/100`. Nur im Speicher
  (nicht im Spielstand); `GK.state.bestCombo` hält den Rekord. Meldungen bei `COMBO_MILESTONES = [25, 50, 100, 200]`.
- **Kritisch**: `GK.rng.float() < critChance()`; zählt `GK.state.crits`.
- Nebenwirkungen: `totalClicks++`, `GK.earn(betrag, 'click')`, `GK.daily.track('click', 1)`,
  `GK.daily.track('combo', combo.count)`, `GK.cosmetics.clickBurst(...)`.
- Eingabe über `pointerdown` auf `#big-coin` (mehrere Finger), `click` nur für Tastatur (`e.detail === 0`).

### 1.5 Öffentliche Funktionen von `GK.clicker`

| Funktion | Zweck |
|---|---|
| `BUILDINGS` | Gebäudeliste (auch von `kraken.js`, Tests benutzt) |
| `init()` | Liste aufbauen, Ereignisse binden (einmal aus `main.js:init`) |
| `tick(sekunden)` | passives Einkommen gutschreiben (jeder Frame, `main.js:loop`) |
| `render()` | Anzeige aktualisieren (alle 100 ms) |
| `refresh()` | nach Import/Zurücksetzen/großer Fahrt/Cosmetic-Kauf: Upgrade-Liste neu, Combo auf 0 |
| `getCps()`, `getCpsPermanent()`, `getClickPower()` | siehe oben |
| `passiveActive()` | passives Einkommen eingeschaltet? |
| `totalBuildings()`, `buildingsWorth()`, `ownsAllBuildings()` | Summen über alle Gebäude |
| `remainingUpgrades()` | Zahl noch nicht gekaufter Upgrades (tägliche Aufgabe `upgrades`) |
| `hasUpgradeOfRarity(rarity)` | für Erfolge (`empire`, `synergy`, `diamond`, `mythic`, `cosmic`, `divine`) |

Nicht öffentlich: `buildingCost`, `buyBuilding`, `buyUpgrade`, `UPGRADES`, Combo-Zustand.

### 1.6 Rezept: neues Gebäude

1. Eintrag **ans Ende** von `BUILDINGS` anhängen (die Synergie nimmt immer das Gebäude davor als Quelle; ein
   Einschub in der Mitte ändert die Wirkung bestehender, schon gekaufter `syn-…`-Upgrades).
2. `name` und `desc` im `GK.i18n.add`-Block von `clicker.js` englisch anmelden.
3. `ic`: Symbolname muss in `js/icons.js` existieren (`GK.icon` prüft den Namen nicht; was ein fehlendes Symbol
   zeigt, ist **(unklar)**, vermutlich nichts).
4. Die 9 Stufen-Upgrades und die Synergie entstehen von selbst; `ownsAllBuildings()` (Erfolg `buildAll`) verlangt
   das neue Gebäude automatisch.
5. Kein Eintrag in `state.js` nötig (`buildings` ist ein freies Objekt, fehlend = 0).
6. `tests/rank.test.js` prüft: IDs eindeutig, `baseCost > Vorgänger × 5`, `baseCps > Vorgänger × 4`, nach dem
   Sternenportal Preis-Leistung zum Vorgänger zwischen 0,4 und 1 – und **genau 8 Gebäude nach `portal`**
   (Zahl im Test anpassen). Optional: Besitz-Erfolg wie `bigbangOwner` in `achievements.js`.

### 1.7 Rezept: neues Upgrade

1. Eintrag in `UPGRADES` mit eindeutiger `id`, einem vorhandenen `type` und `unlocked`. Ketten wie bei den
   vorhandenen bauen: `unlocked: s => has('click8') && s.totalClicks >= …`.
2. `name`/`desc` in `GK.i18n.add` anmelden. `rarity` aus den vorhandenen wählen (`click`, `crit`, `combo`,
   `empire` …), sonst fehlt die CSS-Farbe.
3. Ein **neuer `type`** wirkt nur, wenn er in einer Berechnung ausgewertet wird (`getClickPower`,
   `buildingMultiplier`, `ownedUpgrades(type)` …) und ggf. in `upgradeGain`/`upgradeClickGain` für die Anzeige
   „+x/s“ bzw. „+x pro Klick“.
4. `tests/bonus.test.js` sichert zu: `click1` ×2 auf den Grundwert, `click7` ×3 und `click8` ×4 auf die ganze
   Klickkraft, frühe ×2 nur auf den Grundwert.

---

## 2. Boni (`js/progress.js`)

### 2.1 Multiplikatoren

| Bonus | Formel | Quelle | Dauer |
|---|---|---|---|
| Schatzkarten | `1 + 0,1 · prestige.points` | `progress.js:prestigeMult` | dauerhaft |
| Erfolge | `1 + 0,01 · achievements.length` | `progress.js:achievementMult` | dauerhaft |
| Schätze der Flotte | `1 + Σ income% / 100` | `fleet.js:incomeMult` | dauerhaft |
| Goldrausch | Einkommen ×7 | Buff `goldrush`, Typ `income` | 60 s |
| Klickfieber | Klickkraft ×25 | Buff `clickfever`, Typ `click` | 20 s |
| Glückssträhne | Casino-Gewinn +30…50 % | Buff `luck`, Typ `luck` | 30 s |
| Trophäen | Klickkraft `1 + 0,05 · Trophäen` | `boss.js:clickMult` | dauerhaft |

```
permanentMult() = prestigeMult · achievementMult · fleetMult      (alles multipliziert)
buffMult(typ)   = Produkt der mult aller aktiven Buffs dieses Typs (1, wenn keiner)
Einkommen       = baseCps · permanentMult · buffMult('income')
```

- Buffs liegen in `GK.state.buffs` als `{ id, type, mult, until }` (`until` = Zeitstempel in ms, echte Uhrzeit –
  sie laufen also auch bei geschlossenem Spiel ab). `addBuff(id, mult)` ersetzt einen Buff gleicher `id` und
  wirft abgelaufene weg; `mult` ist optional (sonst der Wert aus `BUFFS`).
- `buffMult('luck')` wird nur in `js/casino/casino.js:luckBonus` gelesen (aus `record()`): Bei
  `payout > bet` wird `floor((payout − bet) · ganze Prozent / 100)` zusätzlich ausgezahlt und mit der Runde verbucht.
- Die Trophäen stehen **nicht** in `permanentMult`, sondern nur in `getClickPower`.

### 2.2 Goldene Bonus-Dublone

`progress.js:updateGolden` (aus `update`, alle 100 ms): erscheint 60–150 s nach der letzten (bzw. nach dem Start),
nur bei sichtbarer Seite, bleibt 13 s (`GOLDEN_LIFETIME`). Zeitpunkt steht nur im Speicher (`nextGoldenAt`).
`collectGolden`: `goldenClicks++`, `GK.daily.track('golden', 1)`, dann ein Wurf `GK.rng.float()`:

| Wurf | Ergebnis |
|---|---|
| < 0,50 | Schatzfund: `max( min(money · 0,15, getCpsPermanent · 900), getClickPower · 30 )`, Quelle `'passive'` |
| < 0,75 | Goldrausch |
| < 0,87 | Klickfieber |
| sonst | Glückssträhne, `mult = 1,3 + 0,05 · rng.int(5)` (1,30 … 1,50) |

Für Tests: `GK.progress._spawnGolden()`.

### 2.3 Offline-Einnahmen

`progress.js:applyOfflineEarnings` (einmal in `main.js:init`): ab 60 s seit `lastSaved`, nur wenn passives Einkommen an ist:
`getCpsPermanent · min(Sekunden, 8 h) · 0,5`, Quelle `'passive'`. Davon getrennt: Ein Hintergrund-Tab holt die
Zeit über `main.js:onVisibilityChange` → `clicker.tick` zum vollen Satz nach (höchstens 8 h).

### 2.4 Große Fahrt (Prestige)

```
totalPrestigePoints() = floor( cbrt( allTimeEarned / 1e8 ) )
pendingPoints()       = max(0, totalPrestigePoints() − prestige.points)
nextPointAt()         = (totalPrestigePoints() + 1)³ · 1e8
```

Also 1 Schatzkarte ab 100 Mio., 2 ab 800 Mio., 3 ab 2,7 Mrd. … Jede Karte: +10 % Einkommen (additiv
untereinander, `PRESTIGE_BONUS`).

`progress.js:goOnJourney`: bricht ab, wenn `pendingPoints() < 1`, wenn `prestigeBlocker()` einen Text liefert
(Toast) oder der Spieler `confirm` ablehnt.

| Wird zurückgesetzt | Bleibt |
|---|---|
| `money`, `totalEarned`, `clickEarned` → 0 | `allTimeEarned` (damit Rang und Kartenzahl) |
| `buildings` → `{}` | `prestige` (`points += gain`, `journeys++`) |
| `upgrades` → `[]` | `achievements`, `casino` (Statistik, VIP-Karte, Spielzustände) |
| `buffs` → `[]` | `cosmetics`, `fleet`, `boss`, `kraken`, `daily`, `player`, `friends` |
| | `totalClicks`, `crits`, `bestCombo`, `goldenClicks`, `playTime` |

Danach: `GK.save()`, `GK.clicker.refresh()`, `GK.cosmetics.journeyReward()` (Glücksrad, siehe 6.3).

**`prestigeBlocker()`** gibt `''` oder einen Hinweistext zurück, solange in `GK.state.casino.games` etwas offen
ist: Blackjack-Runde, Roulette-Chips/`pending`, Slots/Side-Slot `pending`, offenes Rubbellos, Poker-Tisch,
Poker-Raum, Raum mit Freunden (`room.session`), Schatzinsel, Stoppuhr, Parole, Kanonenkugel, Glücksrad/
Schiffsrennen, Flug, Aktien an der Hafenbörse, Münzfall, Video-Slots (`pending`/`free`/`bonus`).
**Jedes neue Casino-Spiel mit Zustand über mehrere Schritte braucht hier eine Zeile** – sonst kostet eine große
Fahrt mitten in der Runde den Einsatz (`money = 0`). Der Text gehört in `GK.i18n.add` von `progress.js`.

Öffentlich: `GK.progress = { init, update, permanentMult, buffMult, addBuff, applyOfflineEarnings, pendingPoints, _spawnGolden }`.
`prestigeMult`, `prestigeBlocker`, `goOnJourney` sind nicht öffentlich.

---

## 3. Erfolge (`js/achievements.js`)

```js
{ id: 'click1k', icon: '🖱️', name: 'Klick-Maschine', desc: '1.000-mal geklickt.', check: s => s.totalClicks >= 1000 }
{ id: 'bjNatural', icon: '🃏', name: 'Blackjack!', desc: 'Mit den ersten zwei Karten 21 Punkte.' }   // ohne check
```

- Liste `ACHIEVEMENTS` (öffentlich `GK.achievements.ACHIEVEMENTS`, `total`). Freigeschaltete IDs in
  `GK.state.achievements`. **Jeder Erfolg gibt +1 % Einkommen** (2.1) – dauerhaft, auch über große Fahrten.
- **Automatisch** (mit `check`): `achievements.js:check` läuft einmal pro Sekunde (`main.js:loop`,
  `CHECK_INTERVAL`) und nach Cosmetic-Kauf/Glücksrad. `check(s)` bekommt `GK.state`; Zugriffe auf andere Module
  werden abgesichert (`GK.clicker && …`, `GK.fleet && …`), weil Tests nicht alles laden.
- **Von Hand** (ohne `check`): Das Spiel ruft `GK.unlockAchievement('id')` im passenden Moment
  (z. B. `casino/blackjack.js`, `casino/casino.js:record` für `broke`). Unbekannte oder schon vorhandene IDs
  werden still ignoriert. Die Funktion spielt Ton, zeigt die Meldung und speichert.
- `check` entfernt IDs aus dem Spielstand, die es in der Liste nicht mehr gibt (gelöschte Erfolge zählen nicht mehr mit).
- Anzeige: Bild über `GK.iconFor(a.icon)` (eigenes Symbol zum Emoji), sonst das Emoji.

**Rezept: neuer Erfolg**

1. Eintrag in `ACHIEVEMENTS` an thematisch passender Stelle (Reihenfolge = Reihenfolge im Raster), eindeutige `id`.
2. `name` und `desc` im `GK.i18n.add`-Block von `achievements.js` anmelden.
3. Entweder `check: s => …` (aus dem Spielstand ablesbar) **oder** an der Stelle im Spiel `GK.unlockAchievement('id')`.
4. Braucht `check` einen neuen Zähler, diesen in `state.js:createDefaultState` mit Standardwert anlegen.
5. Bedenken: Jeder Erfolg erhöht das Einkommen; Figur-Teil „Alien“ hängt an `achievements.length >= 50`.

---

## 4. Tägliche Aufgaben (`js/daily.js`)

### 4.1 Auslosen und Tageswechsel

- Spielstand `GK.state.daily = { day, tasks, streak, bonusDay, bonuses, completed }`; Tag = `JJJJ-MM-TT` in
  **Ortszeit** (`daily.js:dayKey`).
- `ensureDay()` (aus `init` und alle 100 ms aus `update`): Ist `day` nicht heute oder gibt es keine Aufgaben,
  werden zuerst die alten abgerechnet (4.3), dann `makeTasks()` gerufen.
- `makeTasks()`: 3 Aufgaben – eine aus `group: 'clicker'`, eine aus `group: 'casino'`, eine beliebige weitere
  (die Art `friends` nimmt nur mit 50 % an der Auslosung teil). Arten mit `possible()` = falsch fallen weg.
  Eine Aufgabe ist `{ id, progress: 0, done: false, claimed: false, target, …Zusatzwerte aus make() }`.

### 4.2 `GK.daily.track(art, daten)`

`track` reicht das Ereignis an jede offene Aufgabe von heute: `DEFS[id].on(art, daten, aufgabe)` liefert den
neuen Fortschritt oder `null`. Fortschritt wird auf `target` begrenzt; bei Erreichen `done = true`,
`completed++`, Meldung. `track` speichert nicht selbst.

| Ereignis | `daten` | Aufrufer | Aufgaben, die es zählen |
|---|---|---|---|
| `click` | `1` | `clicker.js:click` | `clicks` (300–800) |
| `combo` | aktuelle Combo-Länge | `clicker.js:click` | `combo` (Ziel 30, bei `bestCombo >= 60` 50; bester Wert zählt) |
| `building` | gekaufte Menge | `clicker.js:buyBuilding` | `buildings` (5/10/15) |
| `upgrade` | `1` | `clicker.js:buyUpgrade` | `upgrades` (1–2; nur wenn ≥ 3 Upgrades übrig) |
| `voyage` | `1` | `fleet.js:send` | `voyages` (2–4; nur mit ≥ 1 Schiff) |
| `golden` | `1` | `progress.js:collectGolden` | `golden` (1–3) |
| `earn` | Betrag | `state.js:GK.earn`, nur Quelle `click`/`passive` | `earn` (Ziel: 15 min Einkommen, mind. 2.000, gerundet) |
| `round` | `{ game, bet, payout }` | `casino/casino.js:record` | `rounds`, `variety`, `game`, `wins`, `bigHit`, `friends` |

Casino-Arten im Detail: `rounds`/`variety`/`wins` ignorieren `game === 'sideSlot'`; `wins` zählt bei
`payout > bet`; `bigHit` bei `bet > 0 && payout >= bet · mult` (5 oder 10); `game` wählt ein Spiel der
Kategorien `quick`/`slots`/`table` (ohne Poker); `friends` zählt Poker und Spiele der Kategorie `friends`.

### 4.3 Belohnung und Serie

```
reward()      = floor( max(500, getCpsPermanent · 600, getClickPower · 50) )   // beim Abholen berechnet
bonusMult()   = 1 + 0,25 · min(4, Serie vor heute)
bonusAmount() = floor( reward() · 2 · bonusMult() )
```

- `claim(index)` zahlt `reward()` (Quelle `'daily'`), `claimBonus()` zahlt den Bonus, sobald alle drei
  **abgeholt** sind; setzt `streak = streakNow() + 1`, `bonusDay = heute`, `bonuses++`.
- Serie gilt nur weiter, wenn `bonusDay` gestern oder heute ist (`streakNow`).
- Tageswechsel: nicht abgeholte, aber geschaffte Belohnungen werden automatisch gutgeschrieben; waren alle drei
  geschafft, auch der Bonus – er zählt für den **alten** Tag, die Serie läuft weiter (`daily.js:ensureDay`).
- `claimable()` → Zahl im Abzeichen des Fortschritt-Tabs.

Öffentlich: `init, update, track, claim, claimBonus, claimable, render` und für Tests
`DEFS, makeTasks, ensureDay, reward, bonusAmount, today, _setNow(fn)` (Uhr austauschen, `fn` liefert ein `Date`).

### 4.4 Rezept: neue Aufgabenart

1. Eintrag in `DEFS`: `group` (`clicker`/`casino`/`mixed`), `icon`, `ic`, `make()` → `{ target, … }`,
   `text(t)` (mit `GK.t`), `on(art, daten, t)` → neuer Fortschritt oder `null`; optional `possible()`.
2. Braucht sie ein neues Ereignis: an der Quelle `if (GK.daily) GK.daily.track('neu', wert)` aufrufen
   (mit Absicherung, weil Tests `daily.js` nicht immer laden).
3. Texte in `GK.i18n.add` von `daily.js` anmelden.
4. Zusatzwerte aus `make()` landen im Spielstand – nur JSON-taugliche Werte. Arten nie umbenennen oder
   löschen, ohne an laufende Aufgaben zu denken (`track` überspringt unbekannte IDs, `render` aber greift auf
   `DEFS[t.id]` zu – eine gelöschte Art wirft dort bis zum nächsten Tag einen Fehler).
5. `tests/daily.test.js` verlangt: erste Aufgabe aus `clicker`, zweite aus `casino`, drei verschiedene.

---

## 5. Ränge (`js/rank.js`)

- Rang = wie oft `allTimeEarned` die nächste Tausenderpotenz erreicht: `threshold(r) = Number('1e' + 3·r)`,
  `of(earned)` = größtes `r` mit `earned >= threshold(r)` (unter 1.000 → 0), Obergrenze `MAX = 999`.
- Weil `allTimeEarned` nie sinkt, sinkt auch der Rang nie (auch nicht nach der großen Fahrt).
- Namen (`NAMED`, Index = Rang): 0 Landratte, 1 Schiffsjunge, 2 Matrose, 3 Bootsmann, 4 Steuermann,
  5 Quartiermeister, 6 Erster Offizier, 7 Kapitän, 8 Kommodore, 9 Admiral, 10 Großadmiral, 11 Piratenkönig,
  12 Herrscher der Meere; ab `LEGEND = 13` „Legende I, II, …“ (römisch, ohne Ende).
- `name(r)` ist der logische deutsche Name, `nameT(r)` (intern) der übersetzte. `symbol(r)` = Abzeichen mit
  Farbstufe `rk-t1…5` (0–3 Bronze, 4–7 Silber, 8–11 Gold, 12 Meer, ab 13 Legende). `tag(r)` = kleines Zeichen
  am Namen (nicht für Rang 0).
- `valid(r)` prüft empfangene Ränge (ganze Zahl 0…999, sonst 0) – immer benutzen bei Daten von anderen.
- `check()` (1× pro Sekunde): meldet einen neuen Rang einmal, merkt ihn in `GK.state.rankSeen`.
- `progress(earned)` → `{ rank, next, from, to, missing, frac }` (Balken logarithmisch).

| Was der Rang freischaltet | Rang | Wo |
|---|---|---|
| Ziele der Flotte: Schmugglerinsel / Vulkaninsel / Eismeer / Drachenküste | 1 / 2 / 3 / 4 | `fleet.js:DESTS[].rank`, `destOpen` |
| Figur: Steuerrad, Kapitänsuniform, Admiralshut, Geist, Dreizack, Laseraugen, Heiligenschein | 4, 7, 9, 10, 11, 12, 13 | `figure.js` (`rank: n`) |
| Erfolge `rankCaptain`, `rankAdmiral`, `rankLegend` | 7, 9, 13 | `achievements.js` |
| Anzeige neben dem Namen und in der Freundes-Rangliste | – | `cosmetics.js:nameTag`, `js/friends.js`, `js/mp/room.js` |

---

## 6. Schatzkammer und eigene Figur

### 6.1 Katalog (`js/cosmetics.js`)

`CATEGORIES`: 5 Kategorien mit je 6 Einträgen (erster = Standard, `rarity: 'common'`), zusammen 25 zum Sammeln
(`GK.cosmetics.total`).

| Kategorie `id` | Inhalt | Zusatzfelder | Wirkung in `apply()` / sonst |
|---|---|---|---|
| `coin` | Münz-Designs | `letter`, `coins` (4 Farben) | Klasse `coin-skin-<id>` an `.coin-stage`, Buchstabe in `.big-coin-inner` |
| `effect` | Klick-Effekte | – | `EFFECTS[id](x, y, { crit, hot })` über `clickBurst` |
| `theme` | Farbthemen | – | `document.documentElement.dataset.theme` |
| `profile` | Namensschild | `title` | `nameTag(p)` → Klasse `nt-<id>`; wird an Mitspieler geschickt (`myBadge`) |
| `table` | Casino-Look | – | `document.documentElement.dataset.table` |

Spielstand: `GK.state.cosmetics = { owned: [ids], equipped: { coin, effect, theme, profile, table }, wheel }`.
`equipped(kategorie)` fällt auf den Standard zurück, wenn die ID unbekannt oder nicht im Besitz ist.
Item-IDs sind **über alle Kategorien eindeutig** (`byId`).

### 6.2 Preise (`RARITIES`)

| Seltenheit | Dublonen | Gebäude-Anteil, der abgegeben wird | Mindestzahl Gebäude | Gewicht am Glücksrad |
|---|---|---|---|---|
| `rare` | 1e9 | ¼ | 100 | 6 |
| `epic` | 1e11 | ½ | 250 | 3 |
| `legendary` | 1e13 | ¾ | 500 | 1 |

`cosmetics.js:buy`: Bezahlt wird mit Dublonen **und** Gebäuden – je Sorte `floor(anzahl · share)` weg
(`buildingLoss`). Upgrades, Schatzkarten, Erfolge bleiben. Danach wird das Teil sofort angelegt, `GK.clicker.refresh()`,
`GK.achievements.check()`.

### 6.3 Glücksrad nach der großen Fahrt

- `journeyReward()` (aus `progress.js:goOnJourney`): gibt es noch fehlende Cosmetics, wird `createWheel()` in
  `state.cosmetics.wheel` **gespeichert** und nach 1,4 s geöffnet.
- `createWheel()`: 8 Felder; die Felder 1, 4, 6 (`FLAUTE_SLOTS`) sind immer „Flaute“ (`null`), auf die übrigen 5
  kommen bis zu 5 fehlende Cosmetics, nach Gewicht gezogen (`GK.rng.weighted`), Rest Flaute.
- `spinWheel()`: Feld per `GK.rng.int(8)`; Gewinn wird **sofort** in `owned` geschrieben, `wheel = null`, gespeichert –
  die Drehung ist nur Anzeige. Ein noch nicht gedrehtes Rad öffnet sich nach dem Neuladen wieder (`refresh`).

Öffentlich: `init, refresh, render, apply, equip, buy, clickBurst, journeyReward, completeCategories, nameTag,
myBadge, validBadge, unownedCount, total, CATEGORIES, RARITIES` und für Tests `_spin, _createWheel, _ITEMS`.
`validBadge(id)` lässt nur bekannte, nicht-Standard-Profil-IDs durch; `nameTag` maskiert Namen (`escapeHtml`).

### 6.4 Rezept: neues Cosmetic

1. Eintrag in die passende Kategorie in `CATEGORIES` (`id` global eindeutig, `rarity`, `name`, `desc`, `icon`).
2. Darstellung ergänzen: `coin` → CSS `coin-skin-<id>` + `letter`/`coins`; `effect` → Funktion in `EFFECTS`
   (sonst wirft `clickBurst`); `theme`/`table` → CSS für `[data-theme="<id>"]` bzw. `[data-table="<id>"]`
   sowie Vorschau (`theme-swatch`, `table-look-<id>`); `profile` → CSS `nt-<id>` und `title`.
   Die genauen CSS-Selektoren stehen in den Stylesheets – hier nicht geprüft **(unklar)**.
3. Texte (`name`, `desc`, `title`) in `GK.i18n.add` anmelden.
4. `tests/cosmetics.test.js` verlangt derzeit **genau** 5 Kategorien × (1 Standard + 2 selten + 2 episch +
   1 legendär) und `total === 25` – beim Erweitern Test mit anpassen.
5. Erfolge `cosmeticSet`/`cosmeticAll` rechnen automatisch mit.

### 6.5 Eigene Figur (`js/figure.js`)

**Code-Format**: sieben Zahlen mit Punkt getrennt, in der Reihenfolge von `SLOTS`:

```
Kopf.Hut.Augen.Mund.Kleidung.Farbe.Extra      z. B. "3.0.0.0.1.4.4" = John Pork (Schwein, ohne Hut, …, Anzug, Schwarz, Handy)
```

| Platz | `SLOTS[i].id` | Liste | Anzahl |
|---|---|---|---|
| 0 | `head` | `HEADS` (`skin`, `kind`) | 13 |
| 1 | `hat` | `HATS` | 15 |
| 2 | `eyes` | `EYES` | 9 |
| 3 | `mouth` | `MOUTHS` | 7 |
| 4 | `outfit` | `OUTFITS` | 10 |
| 5 | `color` | `COLORS` (`value`) | 10 |
| 6 | `extra` | `EXTRAS` | 13 |

- **Prüfung**: `parse(code)` verlangt `^\d{1,2}(\.\d{1,2}){6}$` und jeden Index `<` Listenlänge, sonst `null`.
  `valid(code)` gibt den bereinigten Code (führende Nullen weg) oder `''` zurück – für **alles, was von anderen
  kommt** (`mp/room.js`, `poker/multiplayer.js`, `friends.js`, `cosmetics.js:nameTag`). `valid` prüft **nicht**,
  ob die Teile beim Absender freigeschaltet sind.
- **Spielstand**: `GK.state.player.fig` (Code) und `figOn` (Figur statt Emoji zeigen). `mine()` = Code, mit dem
  man zu sehen ist (`''` = Emoji); `current()` = Code im Baukasten (Standard `DEFAULT = '0.1.0.0.0.0.0'`).
- **Gesperrte Teile**: ein Teil mit `unlock: s => …` + `hint`, oder Kurzformen `rank: n` (ab Rang) bzw.
  `boss: n` (Boss-Stufe besiegt) – daraus werden `unlock` und `hint` erzeugt. `unlocked(platz, teil, s)`;
  `allowed(code)` ersetzt gesperrte Teile durch Teil 0; `set(code)` speichert nur `allowed(code)`.
  Vorhandene Bedingungen: Klicks, Zahl der Erfolge, VIP-Karte, große Fahrten, Schatzkarten, Erfolg `daily7`,
  Kraken abgewehrt, Schatz-Sets der Flotte (`GK.fleet.setsComplete(ziel)`), 100 Fahrten.
- **Zeichnen**: `svg(code)` → 64×64-SVG ohne IDs, mit Cache je Code. Köpfe nach `kind` (`drawHead`, `faceOf`
  für Augen-/Mundhöhe), alle anderen Plätze per `switch` über den **Index** (`drawHat`, `drawEyes`, `drawMouth`,
  `drawOutfit`, `drawExtra`). Die `case`-Reihenfolge im Code ist nicht sortiert – der Index zählt.
- `rankParts()` / `bossParts()` liefern die Belohnungslisten für Fortschritt-Tab bzw. Boss-Anzeige.
- `PRESETS` (John Pork, Käpt’n, …) dürfen laut Test keine gesperrten Teile enthalten.

**Rezept: neues Figur-Teil**

1. Teil **hinten** an die Liste des Platzes anhängen (ein Einschub verschiebt die Indizes aller gespeicherten und
   verschickten Codes).
2. In der passenden `draw…`-Funktion einen `case <neuer Index>` ergänzen (Köpfe: neues `kind` in `drawHead`,
   ggf. `faceOf`). Ohne `case` greift `default` – bei Hut/Extra heißt das: nichts zu sehen.
   SVG ohne `id=`-Attribute (Test), nur Koordinaten im Feld 64×64.
3. Sperre optional über `rank`, `boss` oder `unlock` + `hint` (deutscher Text, wird über `GK.t` gezeigt).
4. `name`/`hint` in `GK.i18n.add` von `figure.js` anmelden.
5. Listen sind auf 100 Einträge je Platz begrenzt (zwei Ziffern im Code).
6. Ältere Versionen bei Mitspielern lehnen einen Code mit dem neuen Index als ungültig ab und zeigen das Emoji.

---

## 7. Abenteuer

### 7.1 Flotte (`js/fleet.js`)

Grundgröße für alle Preise und Beute: `income()` = **bestes je erreichtes** `getCpsPermanent()` (`state.fleet.peak`,
mind. 0,5). Bleibt nach großer Fahrt hoch; `income()` schreibt beim Lesen `peak` fort.

**Schiffe** (`SHIPS`; `price` in Sekunden Einkommen). Kaufbar nur in Reihenfolge (`canBuy`).

| `id` | Name | Preis (s) | Laderaum | Tempo |
|---|---|---|---|---|
| `sloop` | Schaluppe | 300 | 1 | 1 |
| `brig` | Brigg | 3.600 | 1,3 | 1,1 |
| `frigate` | Fregatte | 14.400 | 1,7 | 1,25 |
| `galleon` | Galeone | 43.200 | 2,2 | 1,05 |
| `ghost` | Geisterschiff | 172.800 | 3 | 1,5 |

```
buyPrice(id)     = ceil( price · income() )
upgradePrice(id) = ceil( price · income() · 1,75^Stufe )          Stufe 1 … MAX_LEVEL = 30
holdOf(id)       = hold · 1,1^(Stufe − 1)
durationOf(s, z) = round( ziel.time / schiff.speed · timeMult() )   Sekunden
expectedLoot(s,z)= floor( income() · ziel.time · ziel.loot · holdOf(s) · lootMult() )
```

Die Beute hängt an `ziel.time`, nicht an der tatsächlichen Dauer: schnellere Schiffe bringen dieselbe Beute früher.

**Ziele** (`DESTS`):

| `id` | Name | Dauer (Schaluppe) | Beute-Anteil | Schatz-Chance | ab Rang |
|---|---|---|---|---|---|
| `bay` | Nahe Bucht | 2 min | 0,12 | 4 % | 0 |
| `reef` | Korallenriff | 15 min | 0,14 | 10 % | 0 |
| `smuggler` | Schmugglerinsel | 1 h | 0,15 | 20 % | 1 |
| `volcano` | Vulkaninsel | 2 h | 0,15 | 30 % | 2 |
| `ice` | Eismeer | 4 h | 0,15 | 42 % | 3 |
| `dragon` | Drachenküste | 8 h | 0,15 | 60 % | 4 |

**Ausgänge** (`OUTCOMES`, `pickOutcome`): Sturm 12 % ×0,5 · normal 70 % ×1 · reicher Fang 15 % ×2 ·
Goldschatz 3 % ×5 (im Schnitt ×1,21, vom Test geprüft).

**Schätze** (`TREASURES`, 18 Stück, je Ziel 3): jeder hat genau eines von `income` / `loot` / `speed` (Prozent).
Summen bei vollständiger Sammlung: +47 % Einkommen, +55 % Beute, −15 % Fahrzeit.
`incomeMult() = 1 + Σincome/100` (geht in `progress.permanentMult`), `lootMult() = 1 + Σloot/100`,
`timeMult() = 1 − Σspeed/100`. Ein doppelter Fund gibt keinen zweiten Bonus, sondern wird verkauft:
`+ floor(income() · 900 · ziel.loot · 3)`. `setsComplete(zielId)` schaltet Figur-Teile frei.

**Ablauf und Neuladen**

- `send(schiff, ziel)`: lost Ausgang und Schatz **beim Ablegen** aus und speichert die Fahrt sofort in
  `state.fleet.voyages[schiff] = { dest, start, end, loot, outcome, treasure, wind }`. `loot` ist dort schon der
  fertige Betrag. Neuladen ändert nichts; Fahrten laufen nach echter Uhrzeit (`Date.now()`), auch bei geschlossenem Spiel.
- `wind(schiff)`: einmal je Fahrt, kostet `ceil(income() · Restsekunden · 0,25)`, halbiert die Restzeit.
- `collect(schiff)`: erst ab `end`; löscht die Fahrt, bucht `GK.earn(loot, 'fleet')`, zählt `done`, `earned`,
  Schatz, Logbuch (`log`, höchstens 12). Gibt den Logbuch-Eintrag zurück, sonst `null`.
- `sendAll()` schickt jedes freie Schiff zum letzten Ziel (`last`), ersatzweise in die Bucht; `collectAll()`.
- `init()` entfernt Fahrten unbekannter Schiffe und meldet wartende Schiffe gesammelt; `update(sichtbar)` meldet
  Rückkehrer einmal und pflegt das Abzeichen am Abenteuer-Tab (`readyCount()`).
- Für Tests: `GK.fleet._setNow(fn)` (`fn` liefert Millisekunden).

### 7.2 Bosskämpfe (`js/boss.js`)

```
hp(stufe)      = ceil( 20 · 1,55^(stufe − 1) · (großer Boss ? 3 : 1) )     großer Boss: jede 10. Stufe
tapDamage()    = GK.clicker.getClickPower()            (ohne Combo, ohne kritische Treffer)
cannonDps()    = tapDamage() · Σ holdOf(eigene Schiffe) · 0,5              pro Sekunde
reward(stufe)  = floor( GK.fleet.income() · (großer Boss ? 600 : 60) )
trophies()     = floor( höchste besiegte Stufe / 10 )
clickMult()    = 1 + 0,05 · trophies()                 → fließt in getClickPower
```

- `start()` beginnt bei Stufe `best() + 1`; je Boss 30 s (`FIGHT_SECONDS`). Ist einer besiegt (`defeat`),
  wird sofort belohnt (`GK.earn(…, 'boss')`), `state.boss.level` erhöht, gespeichert und der nächste Boss
  mit neuer Zeit gestellt (`newBoss`).
- `tap()`: höchstens 20 Tipps pro Sekunde zählen (`MAX_TAPS_PER_SECOND`); Klickkraft wird je Tipp neu
  gelesen (Klickfieber wirkt). Kanonen feuern jede Sekunde mit dem **beim Start** festgelegten `fight.dps`.
- `step()` (aus `update`, alle 100 ms): Kanonen, und bei Zeitablauf `stop()` + Toast.
- Der laufende Kampf liegt **nur im Speicher** (`fight`); Neuladen beendet ihn ohne Verlust (kein Einsatz).
  Gespeichert wird nur `GK.state.boss = { level, kills, fights }`.
- Ungeheuer: 9 normale im Wechsel (`MONSTERS`), große Bosse abwechselnd Kraken-König / Seedrache (`BIG`).
- Freischaltungen: Figur-Teile bei Stufe 10 (Kanone), 25 (Krakenhut), 50 (Goldrüstung), 100 (Krake);
  Erfolge `boss1`, `boss10`, `boss50`, `boss100`; Boss-Stufe in der Freundes-Rangliste (`friends.js`).
- Für Tests: `current()` (laufender Kampf), `_setNow(fn)`.

### 7.3 Kraken-Angriff (`js/kraken.js`)

**Zeitplan** (`kraken.js:update`, jeder Frame): `state.kraken.clock` zählt nur, wenn der Klicker-Tab offen und
die Seite sichtbar ist, Angriffe eingeschaltet sind (`settings.kraken !== false`) und man mindestens 15 Gebäude
hat. Nächster Angriff nach `next` = 12–22 Minuten dieser aktiven Zeit (`scheduleNext`).

**Angriff** (`begin`): `state.kraken.attack = { hp: 30, max: 30, left: 15, arms, up, phase, x }`.

- `pickArms()`: bis zu 3 verschiedene Gebäudesorten, gewichtet mit `√Anzahl`.
- `advance(dt)`: `left` läuft ab (15 s, `dt` höchstens 0,25 je Schritt); der Kraken wechselt zwischen
  aufgetaucht (1,5–2,3 s) und abgetaucht (0,55–0,95 s); beginnt abgetaucht mit 0,9 s.
- `hit()`: zählt nur, wenn aufgetaucht (`{ missed: true }` sonst); −1 Kraft. Je Drittel der Kraft lässt ein Arm
  los (`releasedCount`). Bei 0 → `defeat()`.
- `defeat()`: Beute `floor(max(getCpsPermanent · 300, getClickPower · 100))`, Quelle `'passive'`; `defeated++`.
- `escape()` (Zeit um): jeder Arm, der noch hält, nimmt `stealAmount(n) = min(n, max(1, ceil(n · 0,1)))`
  Gebäude seiner Sorte; `escaped++`, `stolen += …`.
- Der Angriff steht im Spielstand und **pausiert**, solange man nicht im Klicker ist – Neuladen oder Tabwechsel
  hilft nicht. `setEnabled(false)` verhindert nur neue Angriffe, der laufende bleibt.

Öffentlich: `update, setEnabled` und für Tests `DURATION, HP, pickArms, releasedCount, stealAmount, begin, hit, advance, _start`.

---

## 8. Zusammenhänge

### 8.1 Wer liest wessen Boni

```
Erfolge (Anzahl) ─┐
Schatzkarten ─────┼─► progress.permanentMult ─► clicker.getCpsPermanent ─┬─► Offline, tägl. Belohnung, goldene Dublone,
Flotten-Schätze ──┘                                                      │   Kraken-Beute, Erfolge cps…, Casino-Rangliste
                                                                         └─► fleet.income (Höchstwert) ─► Schiffspreise,
Buff income (Goldrausch) ─► clicker.getCps ─► tick, Anzeige                   Beute, Rückenwind, boss.reward
Buff click (Klickfieber) ─┐
Boss-Trophäen ────────────┼─► clicker.getClickPower ─► Klick, boss.tapDamage/cannonDps (× Laderaum der Flotte),
getCps × clickCps-Anteil ─┘                            tägl. Belohnung, goldene Dublone, Kraken-Beute
Buff luck (Glückssträhne) ─► casino.js:luckBonus
allTimeEarned ─► rank.of ─► Flotten-Ziele, Figur-Teile, Erfolge;  ─► progress.totalPrestigePoints
```

Kreisbezug, der gewollt ist: Boss-Trophäen → Klickkraft → Boss-Schaden; Flotten-Schätze → Einkommen → Flotten-Beute.

### 8.2 Takt (`js/main.js`)

| Wie oft | Aufrufe |
|---|---|
| jeder Frame (`loop`) | `clicker.tick`, `kraken.update` |
| 1× pro Sekunde | `rank.check`, `achievements.check` |
| alle 100 ms (`render`) | `clicker.render`, `progress.update`, `fleet.update`, `boss.update`, `daily.update`; im Fortschritt-Tab `achievements.render`, `cosmetics.render` |
| alle 5 s | `GK.save` (zusätzlich bei `visibilitychange`, `pagehide`, `beforeunload`) |
| einmal (`init`) | `clicker.init`, `cosmetics.init`, `progress.init`, `progress.applyOfflineEarnings`, `fleet.init`, `daily.init` |

Ladereihenfolge in `index.html`: `achievements`, `daily`, `progress`, `clicker`, `rank`, `fleet`, `boss`, `figure`,
`cosmetics`, `kraken`. Die Module greifen erst zur Laufzeit aufeinander zu; optionale Abhängigkeiten sind mit
`GK.x ? … : Standard` abgesichert (`GK.fleet`, `GK.boss`, `GK.rank`, `GK.figure`, `GK.daily`, `GK.icon`).

### 8.3 Felder im Spielstand (`js/state.js:createDefaultState`)

| Feld | Modul | Inhalt |
|---|---|---|
| `money`, `totalEarned`, `clickEarned`, `allTimeEarned` | state | `totalEarned`: seit der letzten großen Fahrt; `allTimeEarned`: über alle |
| `totalClicks`, `crits`, `bestCombo`, `passiveOff` | clicker | Zähler, Schalter |
| `buildings`, `upgrades` | clicker | `{ id: anzahl }`, `[ids]` |
| `prestige { points, journeys }`, `buffs`, `goldenClicks` | progress | |
| `achievements` | achievements | `[ids]` |
| `daily { day, tasks, streak, bonusDay, bonuses, completed }` | daily | |
| `rankSeen` | rank | höchster gemeldeter Rang |
| `cosmetics { owned, equipped, wheel }` | cosmetics | |
| `player { name, avatar, fig, figOn }` | state / figure | |
| `fleet { ships, voyages, last, treasures, peak, done, earned, log }` | fleet | `ships`: Stufe je Schiff; `treasures`: Fundzahl je Schatz |
| `boss { level, kills, fights }` | boss | |
| `kraken { clock, next, attack, defeated, escaped, stolen }` | kraken | |
| `settings.kraken`, `ui.tab` | kraken / main | |

Neue Felder: Standardwert in `createDefaultState` **und** – bei verschachtelten Objekten – ein
`Object.assign(createDefaultX(), data.x)` in `state.js:applyData` (so wie für `fleet`, `kraken`, `daily`, `boss`),
sonst fehlen neue Unterfelder in alten Spielständen.

### 8.4 Quellen für `GK.earn`

| Quelle | zählt zu `totalEarned`/`allTimeEarned` | zählt für Aufgabe „Verdiene …“ | benutzt von |
|---|---|---|---|
| `click` | ja (+ `clickEarned`) | ja | Klick |
| `passive` | ja | ja | `tick`, Offline, goldene Dublone, Kraken-Beute |
| `fleet`, `boss`, `daily` | ja | nein | Beute, Boss-Belohnung, tägliche Belohnung |
| `casino` | nein | nein | Casino |

### 8.5 Tests ohne Browser

Alle Tests laufen mit `node tests/<name>.test.js` und laden die Dateien direkt:

```js
global.window = global;
global.document = { addEventListener() {}, querySelector() { return null; }, getElementById() { return null; }, visibilityState: 'visible' };
const R = require('path').join(__dirname, '..', 'js') + '/';
require(R + 'format.js'); require(R + 'state.js'); require(R + 'casino/casino.js'); // GK.rng kommt aus casino.js
require(R + 'progress.js'); require(R + 'clicker.js'); …
GK.toast = () => {}; GK.sound = { play() {} }; GK.save = () => true; GK.notify = () => {};
```

Darum gilt für Logik-Funktionen: kein DOM-Zugriff außerhalb von `render`/`init`/Anzeige, Symbole über
`GK.icon ? … : ''`, Uhr über `_setNow`. Ein Fehlschlag gibt `FAIL …` aus und setzt `process.exitCode = 1`.

| Test | sichert u. a. zu |
|---|---|
| `bonus` | Klick-Upgrades (früh nur Grundwert, spät alles), Glückssträhne +30–50 % im Casino |
| `daily` | Auslosung (Klicker/Casino/dritte), alle Ereignisarten, Abholen, Bonus, Serie, Mitternacht, alte Spielstände |
| `rank` | Grenzen genau `1000^r`, Namen ohne Ende, einmalige Meldung, Rang-Teile, Gebäude-Ausgewogenheit |
| `cosmetics` | Katalogform (5×6, 25), steigende Preise, Rad: 8 Felder, höchstens 5 fehlende Cosmetics, Gewichte |
| `figure` | Code-Prüfung, jedes Teil zeichnet gültiges SVG ohne `id`, Vorlagen ohne Sperre, gesperrte Teile |
| `fleet` | Preise, Fahrt übersteht Neuladen, Ausgänge (Quoten, Schnitt ×1,21), Schätze/Boni, Rückenwind, Ziele nach Rang |
| `boss` | Lebenspunkte (+55 %, groß ×3), 20 Tipps/s, Kanonen, Trophäen, zehnfache Belohnung beim großen Boss |
| `kraken` | `stealAmount`, `releasedCount`, Arme, Abwehr/Flucht, Pause, Zeitplan; dazu Freundes-Rangliste |

### 8.6 Stolperfallen

- **IDs sind Spielstand**: Gebäude-, Upgrade-, Erfolgs-, Cosmetic-, Schatz-, Schiffs- und Aufgaben-IDs nie
  umbenennen. Listen mit Index-Bedeutung (`BUILDINGS` wegen Synergien, alle Figur-Listen, `rank.js:NAMED`) nur hinten erweitern.
- **`getCps` vs. `getCpsPermanent`**: Für Belohnungen, Preise und alles, was sich nicht durch einen Goldrausch
  aufblasen lassen soll, `getCpsPermanent()` nehmen (bzw. `GK.fleet.income()` für Abenteuer-Preise).
- **`getClickPower()` enthält Buffs**: tägliche Belohnung, Kraken-Beute und Schatzfund nutzen es als Untergrenze –
  im Klickfieber sind sie höher. Das ist der Ist-Zustand, kein Versehen der Doku.
- **`passiveOff`** schaltet nur die Auszahlung ab; alle Formeln mit `getCps…` rechnen weiter mit vollem Einkommen.
- **Große Fahrt und neue Zustände**: Alles, was an `buildings`/`upgrades`/`money` hängt, ist danach leer.
  Neue Casino-Zustände in `prestigeBlocker` eintragen. Ein laufender Kraken-Angriff wird von `goOnJourney`
  nicht beendet (er findet dann nichts mehr zu stehlen, `stealAmount(0) = 0`) – aus dem Code abgeleitet, nicht getestet **(unklar, ob beabsichtigt)**.
- **Erfolge wirken aufs Einkommen**: Jeder neue Erfolg ist +1 %; viele leichte Erfolge verschieben die Balance.
- **Ergebnis sofort speichern**: Flotte (beim Ablegen), Glücksrad (vor der Animation) und Kraken (Angriff im
  Spielstand) folgen der Regel „Neuladen darf nichts ändern“. Neue Mechaniken genauso bauen.
- **`fleet.income()` hat eine Nebenwirkung** (`peak` wird fortgeschrieben) – in Tests vor dem Vergleichen bedenken.
- **Zeitbasis**: Flotte, Buffs, Boss und Offline rechnen mit echter Uhrzeit (`Date.now()`); Kraken mit aktiver
  Spielzeit im Klicker; tägliche Aufgaben mit dem Kalendertag in Ortszeit.
- **Anzeige im Takt**: `render`-Funktionen laufen 10× pro Sekunde. Listen nur bei geänderter Signatur neu bauen
  (Muster: `lastSignature`, `shipsSig`, `lastHtml`), sonst `GK.setHTML`/`GK.setText`. Ein Neuaufbau unter dem
  Finger verschluckt Tipps (Kommentar in `daily.js:render`).
- **Texte**: Datentabellen bleiben deutsch; übersetzt wird erst bei der Anzeige mit `GK.t(eintrag.name)`. Logische
  Namen (`rank.name`, Aufgaben-IDs, Netzwerkfelder `fig`/`rank`/`badge`) nie übersetzen.
- **Daten von Mitspielern** immer durch `GK.figure.valid`, `GK.rank.valid`, `GK.cosmetics.validBadge` schicken;
  Namen laufen in `nameTag` durch `escapeHtml`.
- **Versionsnummer**: Nach jeder Änderung an diesen JS-Dateien alle `?v=…` in `index.html` erhöhen (`CLAUDE.md`).
