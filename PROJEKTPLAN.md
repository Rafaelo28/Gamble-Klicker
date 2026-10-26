# Projektplan: Gamble Klicker

> Ein Browser-Spiel, das **Cookie Clicker** mit einem **Casino** verbindet.
> Man verdient Spielgeld (🪙 Coins) durch Klicken und passive Einnahmen und kann
> es anschließend im Casino bei Roulette, Blackjack, Poker und Slot-Maschinen
> einsetzen. **Es gibt kein echtes Geld – alles ist reines Spielgeld.**

## Technik

| Thema | Entscheidung | Warum |
|---|---|---|
| Sprache | HTML, CSS, JavaScript (ohne Framework) | Keine Installation nötig, leicht verständlich und erweiterbar |
| Start | `index.html` im Browser öffnen | Kein Server, kein Build-Schritt |
| Speichern | `localStorage` im Browser | Spielstand bleibt nach dem Schließen erhalten |
| Veröffentlichung | GitHub Pages | Kostenlos, direkt aus dem Repo |

### Ordnerstruktur

```
index.html          Einstiegsseite mit allen Bereichen (Tabs)
css/style.css       Aussehen (Casino-Design, dunkel mit Gold-Akzenten)
js/format.js        Zahlen schön formatieren (1.234 / 1,23 Mio.)
js/state.js         Spielstand: Geld verdienen/ausgeben, Speichern/Laden
js/clicker.js       Klicker: Gebäude, Upgrades, Einkommen
js/main.js          Spielschleife, Tabs, Autosave
js/casino/…         (ab Phase 2) Ein Modul pro Casino-Spiel
```

Der zentrale Spielstand bietet eine kleine Schnittstelle (`GK.earn()`,
`GK.spend()`, `GK.canAfford()`), über die später **alle Casino-Spiele** Geld
abbuchen und auszahlen. So bleibt die Verbindung zwischen Klicker und Casino
an einer Stelle.

## Phasen

### ✅ Phase 1 – Grundgerüst & Klicker *(umgesetzt)*
- Seitenlayout mit Tabs: **Klicker**, **Casino**, **Statistiken**
- Große Münze zum Klicken, „+X“-Animation beim Klick
- 8 Gebäude für passives Einkommen (Preis steigt pro Kauf um 15 %)
- Kaufmenge umschaltbar: ×1, ×10, ×100
- Einmalige Upgrades (Klickkraft ×2, Gebäude ×2, Klick bekommt % vom Einkommen)
- Automatisches Speichern alle 10 Sekunden + beim Schließen
- Statistiken und „Spielstand zurücksetzen“
- Casino-Tab als Vorschau (Spiele noch gesperrt)

### Phase 2 – Casino-Grundlage & Slot-Maschine
- Gemeinsame Einsatz-Auswahl (Betrag eingeben, ½, ×2, Max)
- Gewinn-/Verlust-Anzeige und Verlauf der letzten Runden
- **Slot-Maschine**: 3 Walzen, Symbole mit unterschiedlicher Häufigkeit,
  Gewinntabelle, Dreh-Animation
- Statistik: gesamt gesetzt / gewonnen / verloren

### Phase 3 – Roulette
- Europäisches Roulette (0–36)
- Wetten: Zahl, Rot/Schwarz, Gerade/Ungerade, 1–18/19–36, Dutzende, Kolonnen
- Wett-Tisch zum Anklicken, mehrere Wetten pro Runde
- Animierter Kessel bzw. Kugel

### Phase 4 – Blackjack
- Gegen den Dealer, 6 Kartendecks
- Hit, Stand, Double Down, Split
- Blackjack zahlt 3:2, Dealer steht auf 17
- Karten-Animationen

### Phase 5 – Poker
- **Video Poker** („Jacks or Better“): 5 Karten, Karten halten, einmal tauschen,
  Auszahlung nach Gewinntabelle
- *Optional später:* Texas Hold'em gegen Computer-Gegner (deutlich aufwendiger)

### Phase 6 – Fortschritt & Motivation
- Erfolge (Achievements), z. B. „Erste Million“, „Jackpot geknackt“
- Offline-Einnahmen (ein Teil des Einkommens läuft weiter, wenn das Spiel zu ist)
- Goldene Bonus-Münze, die zufällig erscheint (Klick-Bonus)
- Prestige-System: neu starten gegen dauerhaften Bonus
- Casino-Bereiche, die man mit Geld freischalten muss (VIP-Tische mit höheren Einsätzen)

### Phase 7 – Feinschliff & Veröffentlichung
- Soundeffekte (abschaltbar)
- Optimierung für Handy/Tablet
- Spielstand exportieren/importieren (als Text)
- Veröffentlichung über GitHub Pages

## Hinweise zum Spielen
- Alles ist Spielgeld ohne jeden echten Wert. Es gibt keine Käufe mit echtem Geld.
- Die Casino-Spiele nutzen faire Zufallszahlen mit realistischen Gewinnchancen –
  das Haus gewinnt auf Dauer, genau wie im echten Casino.
