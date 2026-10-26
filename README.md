# 🎰 Gamble Klicker

Werde vom armen Schlucker zum Dublonen-Millionär! Klicke auf die goldene Dublone und kaufe
Sparschweine, Limonadenstände, Banken und Goldminen, die für dich weiterverdienen. Und wenn die
Schatztruhe voll ist, wartet das Casino:

- 🎰 **Slot-Maschine** – drei gleiche Symbole, bis zu ×777
- 🎡 **Roulette** – Rot oder Schwarz? Oder alles auf die 17?
- 🃏 **Blackjack** – schlag den Dealer, ohne über 21 zu kommen
- ♠️ **Texas Hold'em** – Turnier gegen Käpt'n Blaubart, Long John und andere Piraten, jeder mit eigener Spielweise
- 👥 **Poker mit Freunden** – eröffne einen Online-Raum und spiele mit deinen Freunden um den Pott

Sammle Erfolge, fang die goldene Bonus-Dublone, kauf dir eine VIP-Karte für höhere Einsätze und
geh auf **große Fahrt**, um mit dauerhaften Schatzkarten-Boni neu anzufangen.

Dein Fortschritt wird automatisch gespeichert. Das Spiel läuft direkt im Browser, auch auf dem
Handy, ohne Download.

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
exportieren und wieder importieren.

### Poker mit Freunden

1. Casino → Texas Hold'em → **Mit Freunden spielen**: Namen eintragen, Tisch wählen, **Eröffnen**.
2. Den **Raum-Code** (oder den Einladungs-Link) an deine Freunde schicken.
3. Freunde geben den Code bei **Raum beitreten** ein. Jeder zahlt den Eintritt in Dublonen
   und bekommt die gleichen Tisch-Chips.
4. Der Gastgeber startet das Spiel. Freie Plätze können Computer-Gegner übernehmen.

Die Browser verbinden sich direkt miteinander (WebRTC über [PeerJS](https://peerjs.com/)).
Der Gastgeber leitet den Tisch – er sollte das Spiel geöffnet lassen, bis das Turnier vorbei ist.
Wer die Seite neu lädt, wird automatisch wieder verbunden.

## Projektplan

Den Fahrplan mit allen Phasen findest du in [PROJEKTPLAN.md](PROJEKTPLAN.md).

**Aktueller Stand:** Phasen 1–7 fertig:
- 👆 Klicker mit Gebäuden, Upgrades, Statistiken und sicherem Speichern
- 🎰 Slot-Maschine · 🎡 Roulette · 🃏 Blackjack
- ♠️ Texas Hold'em als Turnier gegen Computer-Gegner und online mit Freunden
- 🏆 Erfolge, goldene Dublone, Offline-Einnahmen, große Fahrt (Prestige) und VIP-Karten

## Tests

```
node tests/poker.test.js
```
Prüft die Poker-Handbewertung, spielt komplette Turniere zwischen Computer-Gegnern durch
(auch mit Spielern, die mittendrin aufgeben) und kontrolliert die Preisverteilung.
