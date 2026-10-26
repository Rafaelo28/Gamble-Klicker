# 🎰 Gamble Klicker

Ein Browser-Spiel, das **Cookie Clicker** mit einem **Casino** verbindet:
Klicke auf die goldene Dublone, kaufe Gebäude für passives Einkommen und setze
deine **Dublonen** später bei Slots, Roulette, Blackjack und Texas Hold'em ein.

> Alles ist **reines Spielgeld** ohne echten Wert. Es gibt keine Käufe mit echtem Geld.

## Spielen

- **Online:** https://rafaelo28.github.io/Gamble-Klicker/ (sobald GitHub Pages eingerichtet ist)
- **Lokal:** `index.html` im Browser öffnen – keine Installation nötig.

Der Fortschritt wird automatisch im Browser gespeichert und bleibt beim Neuladen
erhalten. Unter *Statistiken* kann man den Spielstand zusätzlich als Code
exportieren und wieder importieren.

## Projektplan

Den Fahrplan mit allen Phasen findest du in [PROJEKTPLAN.md](PROJEKTPLAN.md).

**Aktueller Stand:** Phasen 1–5 fertig:
- 👆 Klicker mit Gebäuden, Upgrades, Statistiken und sicherem Speichern
- 🎰 Slot-Maschine · 🎡 Roulette · 🃏 Blackjack
- ♠️ Texas Hold'em als Turnier gegen 5 Computer-Gegner

Als Nächstes: Texas Hold'em Multiplayer im Online-Raum (Phase 6).

## Tests

```
node tests/poker.test.js
```
Prüft die Poker-Handbewertung und spielt 30 komplette Turniere zwischen Computer-Gegnern durch.
