# Doku für Agenten

Diese Dateien erklären das Projekt für KI-Agenten (und Menschen), die daran weiterarbeiten. Sie ergänzen:

- [`../CLAUDE.md`](../CLAUDE.md) – die **verbindlichen Regeln** (kurz). Bei Widerspruch gilt `CLAUDE.md`.
- [`../PROJEKTPLAN.md`](../PROJEKTPLAN.md) – die **Geschichte**: was wann warum gebaut wurde, mit Zahlen zur Ausgewogenheit.
- [`../README.md`](../README.md) – die Beschreibung für **Spieler**.

Der Code selbst ist die letzte Instanz. Jede Datei beginnt mit einem Kopfkommentar, der sagt, was sie tut –
zuerst den lesen. Stimmt die Doku nicht mehr mit dem Code, die Doku im selben Pull Request berichtigen.

## Wo steht was?

| Ich will … | Lies |
|---|---|
| verstehen, wie das Spiel startet, läuft, speichert, Geld bewegt | [`KERN.md`](KERN.md) |
| ein Feld im Spielstand hinzufügen, ohne alte Spielstände zu brechen | [`KERN.md`](KERN.md) |
| Texte, Übersetzung, Symbole, Effekte, Töne, CSS, iPad-Regeln | [`OBERFLAECHE.md`](OBERFLAECHE.md) |
| ein Casino-Spiel bauen oder ändern | [`CASINO.md`](CASINO.md) |
| ein Spiel mit Freunden bauen oder ändern (Räume, Netz, Physik) | [`MEHRSPIELER.md`](MEHRSPIELER.md) |
| Poker (Engine, Turnier, Computer-Gegner, online) oder die Freundes-Rangliste | [`POKER.md`](POKER.md) |
| Klicker, Boni, große Fahrt, Erfolge, Tagesaufgaben, Ränge, Schatzkammer, Figur, Flotte, Boss, Kraken | [`KLICKER.md`](KLICKER.md) |
| testen (Node und Browser) | [`TESTEN.md`](TESTEN.md) |
| Branch, Versionsnummer, Pull Request, Veröffentlichung | [`ARBEITSWEISE.md`](ARBEITSWEISE.md) |

`EXPLOITS.md` (falls vorhanden) ist ein eigener Prüfbericht zu Schwachstellen und gehört nicht zu dieser Reihe.

## Das Projekt in zehn Sätzen

1. Browser-Spiel aus reinem HTML, CSS und JavaScript – kein Framework, kein Build, keine Abhängigkeiten zum
   Installieren. `index.html` öffnen genügt.
2. Alles hängt an einem globalen Objekt **`window.GK`**. Jede Datei ist ein in sich geschlossener Block
   (`(function () { … })();`), der sich dort einhängt, z. B. `GK.casino`, `GK.clicker`, `GK.fx`.
3. Der gesamte Fortschritt ist **`GK.state`** – ein einfaches Daten-Objekt, das als Ganzes in `localStorage`
   gespeichert und beim Import komplett ersetzt wird. Deshalb nie Verweise darauf aufheben.
4. Dublonen bewegen sich nur über `GK.earn` / `GK.spend`, im Casino über `GK.casino.bet` / `payout` /
   `refund` / `record`.
5. Eine Spielschleife (`js/main.js`) ruft zehnmal pro Sekunde die `render()`-Funktionen auf; Anzeigen im Takt
   schreiben nur bei Änderung (`GK.setHTML` / `GK.setText`).
6. Fünf Tabs: Klicker, Casino, Abenteuer (Bosskampf, Flotte, Schätze, Logbuch), Fortschritt (Tagesaufgaben,
   Rang, große Fahrt, Boni, Schatzkammer, Erfolge) und Statistiken (dazu Freundes-Rangliste, eigene Figur,
   Einstellungen, Spielstand sichern).
7. Das Casino besteht aus einer Lobby und Spielen, die sich mit `GK.casino.register({...})` anmelden.
   Spiele mit Freunden laufen ohne eigenen Server direkt zwischen den Browsern (PeerJS/WebRTC), der Gastgeber
   rechnet; alle außer Poker bauen auf `js/mp/room.js` auf.
8. Deutsch ist die Quellsprache. Englisch ist eine Übersetzungstabelle, deren Schlüssel der deutsche Text ist
   (`GK.t('…')`, `GK.i18n.add({...})`).
9. Zielgerät ist ein iPad der 8. Generation mit Touch – große Tippflächen, sparsame Animationen.
10. Getestet wird mit einfachen Node-Skripten ohne Test-Framework (`node tests/<name>.test.js`) und im Browser
    mit Playwright.

## Ordner

```
index.html            Seite mit allen Tabs; lädt alle Skripte in fester Reihenfolge (mit ?v=Versionsnummer)
css/style.css         gesamtes Aussehen (über 10.000 Zeilen, nach Bereichen gegliedert)
css/icons.css         Größen und Farben der eigenen Symbole
js/*.js               Kern (state, main, format, savecode), Oberfläche (i18n, icons, fx, sound) und
                      Spielteile außerhalb des Casinos (clicker, progress, achievements, daily, rank,
                      cosmetics, figure, fleet, boss, kraken, friends, side-slot, analytics)
js/casino/*.js        Casino-Grundlage (casino.js, cards.js, slot-machine.js) und je ein Spiel pro Datei
js/mp/*.js            Spielräume (room.js) und je ein Spiel mit Freunden pro Datei
js/poker/*.js         Texas Hold'em: Bewertung, Engine, Computer-Gegner, Turnier, Darstellung, online
tests/*.test.js       Node-Tests, je Thema eine Datei
icons/, manifest.webmanifest   App-Symbol und Angaben für den Home-Bildschirm
docs/                 diese Doku
```

## Die zwölf Regeln, an denen Änderungen am häufigsten scheitern

Ausführlich in `CLAUDE.md`; hier als Prüfliste vor dem Commit.

- [ ] Kommentare, Commits, Pull Request auf **Deutsch**.
- [ ] Jeder neue sichtbare Text in `GK.t('deutscher Text')`, englische Fassung per `GK.i18n.add` in derselben Datei.
- [ ] **Versionsnummer** in `index.html` überall erhöht (bei JS-/CSS-Änderung).
- [ ] Neue Spielstand-Felder haben **Standardwerte**; ein alter Spielstand lädt weiter.
- [ ] Dublonen nur über die vorgesehenen Funktionen bewegt.
- [ ] Laufende Runde **sofort gespeichert** – Neuladen kostet keinen Einsatz und schenkt keinen Gewinn.
- [ ] Im Spiel **keine** Auszahlungsquoten, Gewinnchancen oder „Das Haus gewinnt“-Hinweise.
- [ ] Tippflächen groß, kein Doppeltipp-Zoom (`touch-action: manipulation`), Hover nur in `@media (hover: hover)`.
- [ ] Dauer-Animationen nur mit `transform` / `opacity`; Anzeigen im Takt über `GK.setHTML` / `GK.setText`.
- [ ] Physik in Online-Spielen nur mit + − × ÷ und `Math.sqrt`.
- [ ] `GK.track` sendet nie Namen, Raum-Codes, Spieler-IDs oder Spielstände.
- [ ] Test geschrieben bzw. erweitert, alle Tests laufen, im Browser (iPad hoch und quer) geprüft.

## Diese Doku pflegen

- Auf Deutsch, knapp, mit Verweisen der Form `datei:funktion` statt Zeilennummern (die veralten).
- Tabellen für Nachschlagbares, Rezepte als nummerierte Schritte, eigener Abschnitt „Stolperfallen“.
- Nur schreiben, was im Code steht. Zahlen (Quoten, Preise) beim Ändern des Codes mit anpassen.
- Neue Datei hier in die Tabelle „Wo steht was?“ eintragen.
