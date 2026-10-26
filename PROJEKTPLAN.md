# Projektplan: Gamble Klicker

> Ein Browser-Spiel, das **Cookie Clicker** mit einem **Casino** verbindet.
> Man verdient **Dublonen** (goldene Münzen) durch Klicken und passive Einnahmen
> und setzt sie anschließend im Casino bei Slot-Maschine, Roulette, Blackjack und
> Texas Hold'em ein. **Es gibt kein echtes Geld – alles ist reines Spielgeld.**

## Technik

| Thema | Entscheidung | Warum |
|---|---|---|
| Sprache | HTML, CSS, JavaScript (ohne Framework) | Keine Installation nötig, leicht verständlich und erweiterbar |
| Start | `index.html` im Browser öffnen | Kein Server, kein Build-Schritt |
| Speichern | `localStorage` im Browser + Export/Import als Text | Fortschritt bleibt beim Neuladen und Schließen erhalten |
| Veröffentlichung | GitHub Pages | Kostenlos, direkt aus dem Repo |

### Ordnerstruktur

```
index.html          Einstiegsseite mit allen Bereichen (Tabs)
css/style.css       Aussehen (Casino-Design, dunkel mit Gold-Akzenten)
js/format.js        Zahlen schön formatieren (1.234 / 1,23 Mio.), Dublonen-Symbol
js/state.js         Spielstand: Dublonen verdienen/ausgeben, Speichern/Laden, Export/Import
js/clicker.js       Klicker: Gebäude, Upgrades, Einkommen
js/main.js          Spielschleife, Tabs, Autosave
js/casino/casino.js Casino-Lobby, Einsatz-Auswahl, fairer Zufall, Statistik & Verlauf
js/casino/cards.js  Spielkarten (für Blackjack und Poker)
js/casino/slots.js  Slot-Maschine
js/casino/roulette.js  Roulette
js/casino/blackjack.js Blackjack
js/poker/evaluator.js  Poker-Handbewertung
js/poker/engine.js  Texas-Hold'em-Spielregeln (ohne Bildschirm – auch für Multiplayer nutzbar)
js/poker/ai.js      Computer-Gegner
js/poker/poker.js   Poker-Tisch und Turniere
```

Der zentrale Spielstand bietet eine kleine Schnittstelle (`GK.earn()`,
`GK.spend()`, `GK.canAfford()`), über die **alle Casino-Spiele** Dublonen
abbuchen und auszahlen. So bleibt die Verbindung zwischen Klicker und Casino
an einer Stelle.

### Fortschritt speichern

Der Spielstand wird im Browser (`localStorage`) gespeichert, und zwar:
- alle 5 Sekunden automatisch,
- sofort nach jedem Kauf,
- wenn man den Tab wechselt, die App verlässt, die Seite neu lädt oder schließt.

Zusätzlich gibt es **Exportieren/Importieren** (Spielstand als Text-Code), um den
Fortschritt zu sichern oder auf ein anderes Gerät mitzunehmen. Falls der Browser
das Speichern blockiert (z. B. privater Modus oder Vorschau-Fenster), zeigt das
Spiel eine Warnung.

**Regel für alle Casino-Spiele:** Auch eine laufende Runde (z. B. eine angefangene
Blackjack-Hand oder Poker-Hand) wird mitgespeichert, damit beim Neuladen kein
Einsatz verloren geht.

## Phasen

### ✅ Phase 1 – Grundgerüst & Klicker *(umgesetzt)*
- Seitenlayout mit Tabs: **Klicker**, **Casino**, **Statistiken**
- Große Dublone zum Klicken, „+X“-Animation beim Klick
- 8 Gebäude für passives Einkommen (Preis steigt pro Kauf um 15 %)
- Kaufmenge umschaltbar: ×1, ×10, ×100
- Einmalige Upgrades (Klickkraft ×2, Gebäude ×2, Klick bekommt % vom Einkommen)
- Statistiken und „Spielstand zurücksetzen“
- Casino-Tab als Vorschau (Spiele noch gesperrt)

### ✅ Phase 1b – Dublonen & sicheres Speichern *(umgesetzt)*
- Währung heißt jetzt **Dublonen**, mit eigener goldener Münze als Symbol
- Häufigeres Speichern (5 s, nach Käufen, beim Tab-Wechsel/Schließen – auch auf dem Handy)
- Anzeige „💾 gespeichert“ und „Zuletzt gespeichert vor …“
- Spielstand exportieren/importieren
- Warnung, wenn der Browser kein Speichern erlaubt
- Vorbereitung für GitHub Pages

### ✅ Phase 2 – Casino-Grundlage & Slot-Maschine *(umgesetzt)*
- Casino-Lobby mit Statistik (gesetzt / ausgezahlt / Bilanz / größter Gewinn) und den letzten Runden
- Fairer Zufall über den kryptografischen Zufallsgenerator des Browsers
- Gemeinsame Einsatz-Auswahl (Betrag eingeben, ½, ×2, Max)
- Gewinn-/Verlust-Anzeige und Verlauf der letzten Runden
- **Slot-Maschine**: 3 Walzen, Symbole mit unterschiedlicher Häufigkeit,
  Gewinntabelle, Dreh-Animation, Auto-Spin (10 Drehungen), Auszahlungsquote 96,2 %

### ✅ Phase 3 – Roulette *(umgesetzt)*
- Europäisches Roulette (0–36)
- Wetten: Zahl, Rot/Schwarz, Gerade/Ungerade, 1–18/19–36, Dutzende, Kolonnen
- Wett-Tisch zum Anklicken, mehrere Wetten pro Runde, Wetten wiederholen/entfernen
- Drehender Kessel in echter europäischer Zahlen-Reihenfolge, letzte Zahlen

### ✅ Phase 4 – Blackjack *(umgesetzt)*
- Gegen den Dealer, 6 Kartendecks
- Karte, Bleiben, Verdoppeln (auch nach dem Teilen), Teilen bis zu 4 Hände
- Blackjack zahlt 3:2, Dealer steht auf 17, geteilte Asse bekommen nur eine Karte

### ✅ Phase 5 – Texas Hold'em gegen Computer *(umgesetzt)*
- **Sit-&-Go-Turnier**: Eintritt in Dublonen bezahlen, alle 6 Spieler bekommen 1.500 Tisch-Chips
- Drei Tische: Hafenkneipe (1.000), Kapitänstisch (100.000), Königlicher Salon (10 Mio. Dublonen)
- Preise in Dublonen: 1. Platz 3×, 2. Platz 1,8×, 3. Platz 1,2× Eintritt
- Blinds steigen alle 8 Hände (10/20 bis 2.000/4.000)
- Ablauf: Blinds → 2 eigene Karten → Flop → Turn → River → Showdown
- Aktionen: Passen, Checken, Mitgehen, Setzen/Erhöhen (Schieberegler, ½ Pot, Pot, All-in)
- Handbewertung (Höchste Karte bis Royal Flush), Haupt- und Nebentöpfe bei All-in
- 6 Piraten-Gegner mit Persönlichkeiten (vorsichtig, Mitgeher, aggressiv, Bluffer). Sie schätzen
  ihre Gewinnchance, indem sie die unbekannten Karten 300-mal zufällig durchspielen
- Turnier verlassen jederzeit möglich (zählt als Ausscheiden auf dem aktuellen Platz)
- Pausiert automatisch, wenn man den Tisch verlässt; übersteht das Neuladen
- Getestet mit 30 kompletten Bot-Turnieren: keine verlorenen Chips, Plätze immer 1–6

### Phase 6 – Texas Hold'em Multiplayer *(entschieden, noch nicht umgesetzt)*
- **Online-Raum mit Code**: Ein Spieler erstellt einen Tisch und bekommt einen Raum-Code,
  Freunde geben den Code ein. Die Browser verbinden sich direkt (WebRTC über PeerJS),
  kein eigener Server nötig – läuft auch mit GitHub Pages.
- **Eintritt in Dublonen, gleiche Tisch-Chips für alle**: Wie beim Turnier gegen Computer zahlt
  jeder den Eintritt des gewählten Tisches und bekommt dieselbe Anzahl Tisch-Chips. Die Preise
  für Platz 1–3 werden in Dublonen ausgezahlt.
- Freie Plätze können mit Computer-Gegnern aufgefüllt werden
- Der Gastgeber führt die Spiel-Engine aus Phase 5 aus und schickt jedem Spieler nur die
  Karten, die er sehen darf
- Spielerliste im Warteraum, Start durch den Gastgeber, Wiederverbinden nach dem Neuladen

### Phase 7 – Fortschritt & Motivation
- Erfolge (Achievements), z. B. „Erste Million“, „Jackpot geknackt“, „Royal Flush“
- Offline-Einnahmen (ein Teil des Einkommens läuft weiter, wenn das Spiel zu ist)
- Goldene Bonus-Dublone, die zufällig erscheint (Klick-Bonus)
- Prestige-System: neu starten gegen dauerhaften Bonus
- Casino-Bereiche, die man mit Dublonen freischalten muss (VIP-Tische mit höheren Einsätzen)

### Phase 8 – Feinschliff
- Soundeffekte (abschaltbar)
- Weitere Optimierung für Handy/Tablet

## Entscheidungen

### Multiplayer: Wie spielen die Freunde zusammen? → **Variante A**

| Variante | Wie es funktioniert | Vorteile | Nachteile |
|---|---|---|---|
| **A: Online mit Raum-Code** *(Empfehlung)* | Ein Spieler erstellt einen Tisch und bekommt einen Code, die anderen geben ihn ein. Die Browser verbinden sich direkt miteinander (WebRTC über die Bibliothek PeerJS). | Funktioniert über das Internet, kein eigener Server nötig, läuft mit GitHub Pages | Nutzt einen kostenlosen öffentlichen Vermittlungsdienst; in seltenen Netzwerken (z. B. strenge Schul-WLANs) klappt die Verbindung evtl. nicht |
| B: Eigener Server | Ein kleiner Node.js-Server verwaltet alle Tische. | Am zuverlässigsten, später auch Lobby/Rangliste möglich | Server muss gehostet werden (Kosten/Aufwand), GitHub Pages reicht nicht mehr |
| C: An einem Gerät | Mehrere Spieler wechseln sich am selben Gerät ab, Karten werden verdeckt weitergegeben. | Am einfachsten, kein Internet nötig | Kein echtes Online-Spielen |

**Dublonen am Multiplayer-Tisch →** Man bezahlt Eintritt in Dublonen, und alle bekommen
die gleichen Tisch-Chips (Turnier-Prinzip wie in Phase 5).

## Veröffentlichung (GitHub Pages)

1. Pull Request in den Branch `main` übernehmen (mergen).
2. Im Repo auf GitHub: **Settings → Pages** → bei „Source“ **Deploy from a branch** wählen,
   Branch **main** und Ordner **/ (root)** → **Save**.
3. Nach 1–2 Minuten ist das Spiel unter
   **https://rafaelo28.github.io/Gamble-Klicker/** erreichbar.

## Hinweise zum Spielen
- Alles ist Spielgeld ohne jeden echten Wert. Es gibt keine Käufe mit echtem Geld.
- Die Casino-Spiele nutzen faire Zufallszahlen mit realistischen Gewinnchancen –
  das Haus gewinnt auf Dauer, genau wie im echten Casino.
