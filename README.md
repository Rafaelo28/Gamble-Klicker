# 🎰 Gamble Klicker

Werde vom armen Schlucker zum Dublonen-Millionär! Klicke auf die goldene Dublone und kaufe
Sparschweine, Limonadenstände, Banken und Goldminen, die für dich weiterverdienen. Und wenn die
Schatztruhe voll ist, wartet das Casino:

- 🎰 **Slot-Maschine** – drei gleiche Symbole, bis zu ×777
- 🎟️ **Rubbellose** – mit dem Finger freirubbeln, drei gleiche Beträge gewinnen
- 🍀 **Glücksrad** – mit Bonusrad und täglichem Gratis-Dreh
- 🪙 **Münzfall** – die Münze hüpft durch die Nägel, außen warten bis zu ×170
- 🏝️ **Schatzinsel** – nach Schätzen graben, Totenköpfen ausweichen, rechtzeitig abkassieren
- 💣 **Kanonenkugel** – der Multiplikator steigt, bis die Kugel explodiert
- ⛵ **Schiffsrennen** – fünf Piratenschiffe, neue Quoten vor jedem Rennen
- 🎡 **Roulette** – Rot oder Schwarz? Oder alles auf die 17?
- 🃏 **Blackjack** – schlag den Dealer, ohne über 21 zu kommen; nach dem Teilen so viele Karten, wie du willst
- ♠️ **Texas Hold'em** – Turnier gegen Käpt'n Blaubart, Long John und andere Piraten, jeder mit eigener
  Spielweise, *klassisch*, als schnelles *Turbo*-Turnier oder als *Blitz* mit nur 3, 5 oder 10 Händen
  (danach teilen die besten 4 das Preisgeld nach Chips). Steigst du früher aus, bekommst du anteilig
  ausgezahlt, was deine Chips wert sind
- 👥 **Poker mit Freunden** – eröffne einen Online-Raum, leg Eintritt und Modus fest und spiel um den Pott

Schnelle Klicks bauen eine **Combo** auf, mit etwas Glück landest du einen **kritischen Treffer**.
Gebäude-Upgrades gibt es in sieben Stufen bis *Mythos*, dazu Synergien zwischen den Gebäuden.
Direkt unter der Klick-Münze wartet der **Side-Slot**: klicken und nebenbei zocken.
Große Gewinne werden mit Münzregen, Konfetti und Jackpot-Fanfare gefeiert. 🎉

Sammle Erfolge, fang die goldene Bonus-Dublone, kauf dir VIP-Karten bis zur Kaiserkrone für höhere
Einsätze und die größten Poker-Tische und
geh auf **große Fahrt**, um mit dauerhaften Schatzkarten-Boni neu anzufangen.

Dein Fortschritt wird automatisch gespeichert. Das Spiel läuft direkt im Browser – optimiert
für das iPad, funktioniert aber auch auf Handy und Computer, ohne Download.

> *Alles nur Spielgeld – es gibt keine Käufe und kein echtes Geld.*

### 👉 Jetzt spielen: https://rafaelo28.github.io/Gamble-Klicker/

## Entwickler

**[Rafaelo28](https://github.com/Rafaelo28)**: Idee, Spieldesign und Entwicklung

## Spielen

- **Online:** https://rafaelo28.github.io/Gamble-Klicker/
- **Lokal:** `index.html` im Browser öffnen – keine Installation nötig.
  (Für Poker mit Freunden braucht man eine Internetverbindung.)

Der Fortschritt wird automatisch im Browser gespeichert und bleibt beim Neuladen
erhalten. Unter *Statistiken* kann man den Spielstand zusätzlich als Code
exportieren und wieder importieren und Sound sowie Animationen einstellen.

### Auf dem iPad wie eine App

1. Die Spiel-Adresse in **Safari** öffnen.
2. Auf **Teilen** (Quadrat mit Pfeil) tippen → **Zum Home-Bildschirm**.
3. Das Spiel startet dann im Vollbild mit eigenem Symbol – und der Spielstand bleibt
   dauerhaft erhalten.

Optimiert für das iPad der 8. Generation (810 × 1080 hochkant, 1080 × 810 quer), empfohlen
ab iPadOS 15. Ton gibt es nach dem ersten Antippen (Vorgabe von Safari).

### Poker mit Freunden

1. Casino → Texas Hold'em → **Mit Freunden spielen**: Namen eintragen, Modus (Klassisch/Turbo/Blitz) wählen,
   **Eintritt festlegen**, **Eröffnen**.
2. Den **Raum-Code** (oder den Einladungs-Link) an deine Freunde schicken.
3. Freunde geben den Code bei **Raum beitreten** ein, sehen den Eintritt und bestätigen ihn.
   Alle bekommen die gleichen Tisch-Chips, das Preisgeld sind alle Eintritte zusammen.
4. Der Gastgeber startet das Spiel. Freie Plätze können Computer-Gegner übernehmen.

Die Browser verbinden sich direkt miteinander (WebRTC über [PeerJS](https://peerjs.com/)).
Der Gastgeber leitet den Tisch – er sollte das Spiel geöffnet lassen, bis das Turnier vorbei ist.
Wer die Seite neu lädt, wird automatisch wieder verbunden.

## Projektplan

Den Fahrplan mit allen Phasen findest du in [PROJEKTPLAN.md](PROJEKTPLAN.md).

**Aktueller Stand:** Alle 8 Phasen fertig:
- 👆 Klicker mit Gebäuden, Upgrades, Side-Slot, Statistiken und sicherem Speichern
- 🎰 Slot-Maschine · 🎟️ Rubbellose · 🎡 Roulette · 🃏 Blackjack
- 🍀 Glücksrad · 🪙 Münzfall · 🏝️ Schatzinsel · 💣 Kanonenkugel · ⛵ Schiffsrennen
- ♠️ Texas Hold'em als Turnier gegen Computer-Gegner und online mit Freunden
- 🏆 Erfolge, goldene Dublone, Offline-Einnahmen, große Fahrt (Prestige) und VIP-Karten
- 🔊 Soundeffekte, ✨ Gewinn-Animationen, 📱 iPad-Optimierung
- 🔥 Klick-Combos, kritische Klicks, Gebäude-Stufen bis Mythos, Synergien, Poker-Modi Turbo und Blitz

## Tests

```
node tests/poker.test.js
node tests/casino.test.js
```
Prüft die Poker-Handbewertung, spielt komplette Turniere zwischen Computer-Gegnern durch
(auch mit Spielern, die mittendrin aufgeben, im Turbo- und im Blitz-Modus) und kontrolliert die
Preisverteilung sowie die anteilige Auszahlung beim Aussteigen. Die Casino-Tests rechnen
die Gewinnquoten aller anderen Spiele nach.
