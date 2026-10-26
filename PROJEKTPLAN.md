# Projektplan: Gamble Klicker

> Ein Browser-Spiel, das **Cookie Clicker** mit einem **Casino** verbindet.
> Man verdient **Dublonen** (goldene Münzen) durch Klicken und passive Einnahmen
> und setzt sie anschließend im Casino bei Slot-Maschine, Roulette, Blackjack und
> Texas Hold'em ein – auch online mit Freunden. **Es gibt kein echtes Geld – alles ist reines Spielgeld.**
>
> Entwickler: **[Rafaelo28](https://github.com/Rafaelo28)**

## Technik

| Thema | Entscheidung | Warum |
|---|---|---|
| Sprache | HTML, CSS, JavaScript (ohne Framework) | Keine Installation nötig, leicht verständlich und erweiterbar |
| Start | `index.html` im Browser öffnen | Kein Server, kein Build-Schritt |
| Speichern | `localStorage` im Browser + Export/Import als Text | Fortschritt bleibt beim Neuladen und Schließen erhalten |
| Veröffentlichung | GitHub Pages | Kostenlos, direkt aus dem Repo |
| Multiplayer | PeerJS (WebRTC, direkte Verbindung zwischen den Browsern) | Kein eigener Server nötig, läuft mit GitHub Pages |

### Ordnerstruktur

```
index.html          Einstiegsseite mit allen Bereichen (Tabs)
css/style.css       Aussehen (Casino-Design, dunkel mit Gold-Akzenten)
js/format.js        Zahlen schön formatieren (1.234 / 1,23 Mio.), Dublonen-Symbol
js/state.js         Spielstand: Dublonen verdienen/ausgeben, Speichern/Laden, Export/Import
js/clicker.js       Klicker: Gebäude, Upgrades, Einkommen
js/side-slot.js     Side-Slot unter der Klick-Münze
js/sound.js         Soundeffekte (im Browser erzeugt, keine Dateien)
js/fx.js            Effekte: Münzregen, Konfetti, Gewinn-Banner
js/achievements.js  Erfolge
js/progress.js      Boni, große Fahrt (Prestige), goldene Dublone, Offline-Einnahmen
js/main.js          Spielschleife, Tabs, Autosave
js/casino/casino.js Casino-Lobby, Einsatz-Auswahl, VIP-Karten, fairer Zufall, Statistik & Verlauf
js/casino/cards.js  Spielkarten (für Blackjack und Poker)
js/casino/slot-machine.js Gemeinsame Walzen und Gewinntabelle (Slot-Maschine + Side-Slot)
js/casino/slots.js  Slot-Maschine
js/casino/scratch.js Rubbellose
js/casino/roulette.js  Roulette
js/casino/blackjack.js Blackjack
js/poker/evaluator.js  Poker-Handbewertung
js/poker/engine.js  Texas-Hold'em-Spielregeln (ohne Bildschirm – auch für Multiplayer nutzbar)
js/poker/ai.js      Computer-Gegner
js/poker/tournament.js Turnier-Regeln: Tische, Blinds, Preisverteilung
js/poker/table-ui.js   Darstellung des Poker-Tisches
js/poker/multiplayer.js Poker mit Freunden im Online-Raum
js/poker/poker.js   Poker-Lobby und Turnier gegen Computer
tests/poker.test.js Tests für Handbewertung, Engine und Preise (node tests/poker.test.js)
icons/, manifest.webmanifest  App-Symbol und Einstellungen für den Home-Bildschirm
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

### ✅ Phase 6 – Texas Hold'em mit Freunden *(umgesetzt)*
- **Online-Raum mit Code**: Ein Spieler eröffnet einen Raum und bekommt einen 5-stelligen
  Raum-Code (oder einen Einladungs-Link), Freunde geben den Code ein. Die Browser verbinden sich
  direkt (WebRTC über PeerJS), kein eigener Server nötig – läuft auch mit GitHub Pages.
- **Eintritt in Dublonen, gleiche Tisch-Chips für alle**: Jeder zahlt beim Betreten den Eintritt
  des gewählten Tisches und bekommt 1.500 Tisch-Chips.
- **Preisgeld = alle Eintritte**, verteilt je nach Spielerzahl:
  2 Spieler 100 % · 3 Spieler 70/30 % · 4–5 Spieler 65/35 % · 6 Spieler 50/30/20 %
- Warteraum mit Spielerliste; der Gastgeber startet, wenn mindestens 2 Menschen da sind.
  Freie Plätze können Computer-Gegner übernehmen (bis 6 Plätze).
- Der Gastgeber führt die Spiel-Engine aus und schickt jedem Spieler nur die Karten, die er
  sehen darf. Der eigene Platz wird immer unten am Tisch angezeigt.
- **Bedenkzeit 30 Sekunden**, danach wird automatisch gecheckt bzw. gepasst
  (bei getrennter Verbindung schon nach 5 Sekunden)
- **Wiederverbinden**: Gastgeber und Mitspieler können die Seite neu laden, die Verbindung wird
  automatisch wiederhergestellt. Ein Herzschlag alle 2 Sekunden erkennt verschwundene Spieler.
- Verlassen: im Warteraum gibt es den Eintritt zurück; im Spiel zählt es als Ausscheiden auf dem
  aktuellen Platz. Schließt der Gastgeber den Raum oder ist er länger als 30 Sekunden weg,
  bekommen die anderen ihren Eintritt zurück.
- Getestet mit 3 echten Browsern: Beitreten, falscher Code, Kartengeheimnis, Neuladen von
  Mitspieler und Gastgeber, Bedenkzeit, Aufgeben, Raum schließen, Turnier bis zum Ende

### ✅ Phase 7 – Fortschritt & Motivation *(umgesetzt)*
- **36 Erfolge** (Klicker, Casino, Poker, große Fahrt) – jeder gibt dauerhaft +1 % Einkommen,
  eigene Seite „🏆 Fortschritt“
- **Goldene Dublone**: erscheint alle 1–2,5 Minuten irgendwo für 13 Sekunden. Anklicken bringt
  Schatzfund (Dublonen), Goldrausch (Einkommen ×7 für 60 s) oder Klickfieber (Klicks ×25 für 20 s)
- **Offline-Einnahmen**: 50 % des Einkommens für bis zu 8 Stunden, während das Spiel zu ist.
  Zeit in einem Hintergrund-Tab wird voll nachgeholt.
- **Große Fahrt (Prestige)**: Neu anfangen gegen Schatzkarten. Anzahl = Kubikwurzel aus
  (insgesamt verdient ÷ 100 Mio.); jede Schatzkarte gibt +10 % Einkommen und Klickkraft für immer.
  Erfolge, VIP-Karte und Casino-Statistik bleiben erhalten.
- **VIP-Karten** im Casino: Einsatz-Limit pro Runde
  Standard 10.000 · Silber 1 Mio. (kostet 250.000) · Gold 100 Mio. (kostet 50 Mio.) ·
  Diamant unbegrenzt (kostet 5 Mrd.). Silber schaltet den Kapitänstisch frei, Gold den
  Königlichen Salon.

### ✅ Phase 8 – Feinschliff, Sound & iPad *(umgesetzt)*
- **Soundeffekte** für Klicks, Käufe, Walzen, Roulette-Kugel, Karten, Chips, Rubbeln, Erfolge
  und Gewinne – live im Browser erzeugt, Ein/Aus-Knopf oben und Lautstärke in den Einstellungen
- **Gewinn-Feiern** in 4 Stufen: Gewinn (Münzen fliegen), Großer Gewinn (Banner + Konfetti),
  Mega-Gewinn (Münzregen), Jackpot (alles + Wackeln + Fanfare). Einstellung „Animationen reduziert“.
- **Neue Oberfläche**: feste Kopfzeile, Tabs als Leiste, glänzende Münze mit Lichtstrahlen,
  Walzen, die sich wirklich drehen, Roulette-Kugel, Karten fliegen herein und drehen sich um
- **Rubbellose**: 4 Lose (100 bis 100.000 Dublonen), 3×3-Feld mit dem Finger freirubbeln,
  drei gleiche Beträge gewinnen, Hauptgewinn 1.000×, Auszahlungsquote 92 %
- **Side-Slot** direkt unter der Klick-Münze mit Dauer-Automatik – klicken und nebenbei zocken
- **Multiplayer**: Eintritt frei wählbar (ab 100 Dublonen); Mitspieler bestätigen den Eintritt
- **iPad (8. Generation)**: Layouts für 810 × 1080 (hochkant) und 1080 × 810 (quer), große
  Tippflächen, kein Doppeltipp-Zoom, keine versehentliche Textauswahl, schnelles Tippen mit
  mehreren Fingern, Rubbeln ohne Scrollen, Vollbild-App über „Zum Home-Bildschirm“ mit eigenem Symbol

## Entscheidungen

### Multiplayer: Wie spielen die Freunde zusammen? → **Variante A**

| Variante | Wie es funktioniert | Vorteile | Nachteile |
|---|---|---|---|
| **A: Online mit Raum-Code** *(Empfehlung)* | Ein Spieler erstellt einen Tisch und bekommt einen Code, die anderen geben ihn ein. Die Browser verbinden sich direkt miteinander (WebRTC über die Bibliothek PeerJS). | Funktioniert über das Internet, kein eigener Server nötig, läuft mit GitHub Pages | Nutzt einen kostenlosen öffentlichen Vermittlungsdienst; in seltenen Netzwerken (z. B. strenge Schul-WLANs) klappt die Verbindung evtl. nicht |
| B: Eigener Server | Ein kleiner Node.js-Server verwaltet alle Tische. | Am zuverlässigsten, später auch Lobby/Rangliste möglich | Server muss gehostet werden (Kosten/Aufwand), GitHub Pages reicht nicht mehr |
| C: An einem Gerät | Mehrere Spieler wechseln sich am selben Gerät ab, Karten werden verdeckt weitergegeben. | Am einfachsten, kein Internet nötig | Kein echtes Online-Spielen |

**Dublonen am Multiplayer-Tisch →** Man bezahlt Eintritt in Dublonen, und alle bekommen
die gleichen Tisch-Chips (Turnier-Prinzip wie in Phase 5).

Hinweis: Da alles im Browser läuft, könnte jemand mit technischen Tricks schummeln. Für ein
Spiel unter Freunden mit Spielgeld ist das in Ordnung.

## Veröffentlichung (GitHub Pages)

Das Spiel ist online unter **https://rafaelo28.github.io/Gamble-Klicker/**.
Jeder gemergte Pull Request wird nach 1–2 Minuten automatisch veröffentlicht
(**Settings → Pages**: *Deploy from a branch*, Branch **main**, Ordner **/ (root)**).

## Hinweise zum Spielen
- Alles ist Spielgeld ohne jeden echten Wert. Es gibt keine Käufe mit echtem Geld.
- Die Casino-Spiele nutzen faire Zufallszahlen mit realistischen Gewinnchancen –
  das Haus gewinnt auf Dauer, genau wie im echten Casino.
