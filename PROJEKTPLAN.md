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

### Erweiterung: Spannender klicken, größer zocken ✅
- **Klick-Combo**: Schnelle Klicks hintereinander geben bis zu +25 % (mit Upgrades +50 % bzw. +100 %),
  Anzeige mit Feuerbalken über der Münze
- **Kritische Klicks**: Upgrades Glückstreffer und Adlerauge (Chance), Volltreffer-Hand (×25 statt ×10),
  großer roter Text, Schlag-Sound und Münzexplosion
- **Mehr Klick-Upgrades**: Goldene Faust, Hand des Midas, Klick-Imperium
- **Gebäude-Upgrades in 7 Stufen**: Bronze, Silber, Gold, Platin, Diamant (100 Stück, ×3),
  Legenden (150, ×3), Mythos (200, ×4) – Kacheln in der Farbe ihrer Stufe, seltene mit Glanz
- **Synergien**: Jedes Gebäude bekommt +1 % Einkommen pro Stück des vorherigen Gebäudes
- **Fortschrittsbalken** bis zum nächsten Upgrade, Sterne für gekaufte Stufen, Meilenstein-Feier
  (10/25/50/100/150/200 Stück), Vorschau, wie viel ein Upgrade pro Sekunde bringt; lange
  Upgrade-Listen werden eingeklappt
- **VIP-Karten**: neu *Schwarze Perle* (Limit 1 Bio.) und *Kaiserkrone* (unbegrenzt);
  die Diamant-Karte hat jetzt ein Limit von 10 Mrd.
- **Poker-Tische**: Diamanten-Saal (1 Mrd.), Perlen-Lounge (100 Mrd.), Thron des Kaisers (10 Bio.)
- **Rubbellose**: Diamanten-Los (10 Mio.) und Kaiserschatz (1 Mrd.)
- **Blackjack**: Nach dem Teilen darf jede Hand beliebig viele Karten ziehen (auch geteilte Asse)
- **Poker-Modi**: *Klassisch* (1.500 Chips, Blinds alle 8 Hände) und *Turbo* (1.000 Chips,
  Blinds alle 3 Hände, flotte Gegner, 15 s Bedenkzeit) – gegen Computer und mit Freunden
- **Hand vorspulen**: Wer gepasst hat oder All-in ist, lässt die Computer-Gegner die Hand sofort beenden
- **Anteilig aussteigen**: Gegen Computer bekommt man beim Verlassen ausgezahlt, was die eigenen
  Chips wert sind (Berechnung nach ICM, wie bei echten Turnier-Deals); der Betrag steht auf dem Knopf
- 11 neue Erfolge

### Erweiterung: Poker-Blitz ✅
- **Blitz-Modus** (gegen Computer und mit Freunden): Es werden nur **3, 5 oder 10 Hände** gespielt,
  die Blinds steigen jede Hand (letzte Hand 300/600, bei 10 Händen 500/1.000)
- Danach entscheiden die Chips: Die **besten 4** (bei 6 Spielern) teilen das ganze Preisgeld im
  Verhältnis ihrer Chips – auch wenn Platz 5 und 6 noch Chips haben. Bei weniger Spielern werden
  weniger Plätze bezahlt (5 → 3, 4 → 2, 2–3 → 1). Gleichstand an der Grenze zählt mit.
- Wer vorher ausscheidet, geht leer aus. Aussteigen gegen Computer = Auszahlung, als wäre jetzt Schluss.
- Rangliste mit Auszahlungen am Tischende, Erfolg „Blitzgescheit“

### Erweiterung: Mehr Casino ✅ (Paket 1)
- **Rubbellose** mit besseren Chancen: fast jedes zweite Los gewinnt (vorher jedes dritte)
- **Lobby nach Bereichen**: Automaten, Schnelle Spiele, Tischspiele, Mit Freunden
- **🍀 Glücksrad**: unterschiedlich große Felder, ⭐ startet das Bonusrad (3× bis 25×),
  einmal am Tag ein Gratis-Dreh im Wert von 10 Minuten Einkommen
- **🪙 Münzfall**: 12 Nagelreihen, drei Risikostufen, mehrere Münzen gleichzeitig, Automatik
- **🏝️ Schatzinsel**: 5×5 Felder, 1–20 Totenköpfe, Multiplikator steigt mit jedem Fund
- **💣 Kanonenkugel**: steigender Multiplikator bis zur Explosion, Auto-Abkassieren; wer das Spiel
  verlässt oder neu lädt, kassiert automatisch ab
- **⛵ Schiffsrennen**: fünf Schiffe mit neuen Quoten vor jedem Rennen, Führungswechsel-Kommentare

### Erweiterung: Video-Slots ✅ (Paket 2)
- Drei Automaten mit eigenem Thema: **🏴‍☠️ Schatz der Karibik**, **🐙 Tiefsee-Perlen**, **🌋 Vulkan-Gold**
- 5 Walzen × 3 Reihen, 20 Gewinnlinien (werden beim Gewinn eingezeichnet), WILD-Symbol
- 3+ Freispiel-Symbole irgendwo: Freispiele mit Multiplikator (Karibik 10 × ×3, Tiefsee 15 × ×2,
  Vulkan 6 × ×5), können neu ausgelöst werden; Spannung, wenn schon zwei Symbole liegen
- Bonus-Symbol auf Walze 1, 3 und 5: Bonusrunde – 3 von 12 Kisten/Muscheln/Götzen öffnen
- Gewinntabelle zeigt die Beträge passend zum eigenen Einsatz; Freispiele und Bonusrunde
  überstehen das Neuladen; Automatik stoppt bei Features und großen Gewinnen

### Erweiterung: Lügenwürfel und Spielräume ✅ (Paket 3)
- **Allgemeine Spielräume** (`js/mp/room.js`) für neue Spiele mit Freunden: Raum-Code und
  Einladungs-Link, Eintritt bestätigen, Computer-Gegner für freie Plätze, Bedenkzeit, Herzschlag,
  Wiederverbinden nach dem Neuladen, Erstattung, wenn der Gastgeber verschwindet, Preisgeld nach Platz.
  „Gegen Computer“ nutzt denselben Ablauf ohne Netzwerk.
- **🎲 Lügenwürfel**: 2–6 Spieler, 3 oder 5 Würfel, Einsen sind Joker, bieten oder „Lüge!“ rufen,
  Computer-Gegner rechnen Wahrscheinlichkeiten und bluffen je nach Typ

### Erweiterung: Minigolf ✅ (Paket 4)
- **⛳ Minigolf in der Piratenbucht**: 6 Bahnen (oder 3 als kurze Runde), 2–4 Spieler, gegen Computer
  oder online. Zielen wie mit einer Schleuder (tippen und zurückziehen), Kraftanzeige.
- Hindernisse: Kanonenkugel-Bumper, Sand (bremst), Haifischbecken (Wasser = Strafschlag),
  Hügel mit Gefälle, Zickzack-Wände. Höchstens 7 Schläge pro Bahn.
- Physik nur mit Grundrechenarten und Wurzel: Jedes Gerät rechnet einen Schlag exakt gleich.
  Der Gastgeber entscheidet, alle anderen spielen den Schlag zur Anzeige nach.
- Computer-Gegner probieren viele Schläge durch und wählen den besten, je nach Können mit Fehlern.

### Erweiterung: Billard ✅ (Paket 5)
- **🎱 Billard (8-Ball)** zu zweit, gegen Computer oder online. Volle 1–7 / Halbe 9–15, zuletzt die 8.
- Fouls (Weiße versenkt, nichts oder zuerst eine fremde Kugel getroffen) geben „Ball in der Hand“:
  Die Weiße wird frei hingelegt (beim Anstoß links der Kopflinie). Die 8 zu früh = verloren,
  fällt sie beim Anstoß, kommt sie zurück auf den Tisch.
- Zielen per Ziehen mit Queue, gestrichelter Linie, Geisterball und Laufrichtung der getroffenen Kugel.
- Physik wie beim Minigolf auf jedem Gerät gleich; Computer-Gegner zielen über den „Geisterball“
  auf passende Löcher und rechnen mehrere Stöße durch.

### Erweiterung: Flugkapitän und Vier gewinnt ✅ (Teil 1)
- **✈️ Flugkapitän** (schnelles Spiel): Das Flugzeug startet vom Flaggschiff und fliegt übers Meer.
  Unterwegs sammelt es Beträge (+) und Multiplikatoren (×), Raketen halbieren den Gewinn. Am Ende
  muss es auf dem Flaggschiff landen, sonst stürzt es ins Meer. Vier Geschwindigkeiten: je schneller,
  desto länger der Flug und desto höher, aber unsicherer der Gewinn. Der Flug steht beim Start fest
  und wird gespeichert – Neuladen zahlt trotzdem aus.
- **🔴 Vier gewinnt** zu zweit, gegen Computer oder online. Ist das Brett voll, wird es geleert und
  weitergespielt. Computer-Gegner rechnen je nach Können 3 bis 6 Züge voraus.

### Erweiterung: Seeschlacht und Darts ✅ (Teil 2)
- **⚓ Seeschlacht** zu zweit, gegen Computer oder online: 10 × 10 Felder, fünf Schiffe (5, 4, 3, 3, 2),
  die sich nicht berühren. Beide stellen gleichzeitig auf (zufällig verteilt, Schiffe antippen,
  drehen und verschieben; online höchstens 60 Sekunden), dann wird abwechselnd geschossen – wer trifft,
  darf nochmal. Jeder sieht nur die eigenen und die schon versenkten gegnerischen Schiffe.
  Computer-Gegner rechnen für jedes Feld aus, wie viele Schiffslagen noch hineinpassen.
- **🎯 Darts in der Taverne**: 2–4 Spieler, 3, 5 oder 8 Runden mit je 3 Pfeilen. Zielen per Tippen,
  die Hand zittert – im richtigen Moment „Werfen!“. Bei Gleichstand an der Spitze gibt es ein Stechen.
- `js/mp/room.js` kann jetzt auch Phasen, in denen alle gleichzeitig handeln (`canAct`), mit
  gemeinsamer Zeitgrenze (`phaseDeadline`).

### Erweiterung: Kanonenduell ✅ (Teil 3)
- **💥 Kanonenduell** zu zweit, gegen Computer oder online: zwei Piratenschiffe, dazwischen eine Insel
  (jedes Mal etwas anders geformt). Zielen wie mit einer Schleuder – ziehen und loslassen, Kraft und
  Winkel werden angezeigt. Der Wind ändert sich jede Runde. Direkter Treffer 40 Schaden, Einschläge in der
  Nähe weniger, auch das eigene Schiff kann getroffen werden. 100 Lebenspunkte.
- Flugbahn nur mit Grundrechenarten und Wurzel: Jedes Gerät rechnet einen Schuss exakt gleich.
  Computer-Gegner rechnen über tausend Schüsse durch und zielen je nach Können ungenauer.

### Pflege: Flugkapitän und Mehrspieler ✅
- **Flugkapitän**: Landeanflug neu – bei einer Landung bremst das Schiff unter dem Flugzeug, bei einem
  Absturz ist es sichtbar zu weit weg, das Flugzeug qualmt und stürzt davor ins Meer. Banner
  „Gelandet“ bzw. „Abgestürzt“, das Endbild bleibt bis zum nächsten Flug stehen.
- **Mehrspieler** (Spiele mit Freunden und Poker): Fehler einer einzelnen Verbindung und kurze Ausfälle
  des Vermittlungsservers trennen den Raum nicht mehr; immer nur ein Verbindungsversuch zum Gastgeber.
  Wer länger als 90 Sekunden weg ist, scheidet aus (nicht, wenn der Gastgeber selbst offline ist).
  Aktionen ohne Verbindung werden gemeldet statt still verloren.
- Spielstand-Export funktioniert auch mit großen Spielständen (Safari-Grenze für Funktionsargumente).

### Pflege: Fairness gegen Computer ✅
- **Darts** war gegen Computer zu leicht: Mit etwas Geduld (Zielen auf die Mitte oder die Dreifach-20)
  traf man fast immer und gewann 99 % der Partien. Jetzt streut jeder Pfeil etwas (auch bei perfektem
  Timing), alle Computer-Gegner zielen auf die Dreifach-20 und halten mit geschickten Spielern mit.
- **Preise gegen Computer** (alle Spiele mit Freunden außer Poker): Bisher zählten die Eintritte der
  Computer-Gegner mit, sodass z. B. Platz 2 bei 4 Spielern das 1,4-fache bekam. Jetzt macht nur der Sieger
  Gewinn, Platz 2 bekommt ab 3 Spielern den halben Einsatz zurück; bei gleich starken Gegnern 95 % Rückfluss.
- **Mit Freunden und Computer-Gegnern** (auch Poker): Die Eintritte der Computer-Gegner zählten zum
  Preisgeld – zwei Freunde mit zwei Computern bekamen z. B. bei Darts 2,6× und 1,4×. Jetzt spielen
  Computer-Gegner nur mit: Das Preisgeld sind eure Eintritte, verteilt nach eurer Reihenfolge.

### Pflege: Neues Rubbellos, „Poker“ ✅
- **⚓ Schatzflotte**: Rubbellos für 100 Mio (zwischen Diamanten-Los und Kaiserschatz, ab der Gold-Karte),
  gleiche Gewinntabelle wie alle Lose.
- „Texas Hold'em“ heißt im Spiel jetzt einfach **Poker** – darunter können sich mehr Leute etwas vorstellen.

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
- Die Casino-Spiele nutzen faire Zufallszahlen (kryptografischer Zufall des Browsers).
- Im Spiel werden bewusst keine Auszahlungsquoten angezeigt; die Werte oben sind nur zur
  Entwicklung dokumentiert.
