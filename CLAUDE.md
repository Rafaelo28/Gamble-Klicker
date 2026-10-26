# Gamble Klicker – Hinweise für die Entwicklung

Browser-Spiel (Cookie Clicker + Casino) von **Rafaelo28**. Reines HTML, CSS und JavaScript
ohne Framework und ohne Build-Schritt – `index.html` im Browser öffnen genügt.
Online über GitHub Pages aus `main`: https://rafaelo28.github.io/Gamble-Klicker/

## Arbeitsweise (mit Rafaelo28 abgesprochen)

- Auf dem Arbeits-Branch entwickeln, einen **Pull Request nach `main`** erstellen und ihn
  **selbst mergen**, sobald alle Tests grün sind. Rafaelo28 muss nichts tun.
- Nach dem Merge prüfen, dass GitHub Pages die neue Version veröffentlicht hat (1–2 Minuten),
  und Rafaelo28 den Link zum Pull Request geben.
- Nach einem Merge den Arbeits-Branch auf den neuen Stand von `main` setzen, bevor es weitergeht.

## Regeln

- **Alles auf Deutsch**: Texte im Spiel, Code-Kommentare, Commits, Pull Requests.
- **Versionsnummer erhöhen**: Bei jeder Änderung an JS- oder CSS-Dateien in `index.html`
  alle `?v=…` auf einen neuen Wert setzen (Format `JJJJMMTTNN`), sonst mischen Browser alte
  und neue Dateien aus dem Zwischenspeicher.
- **Spielstände bleiben kompatibel**: Neue Felder bekommen Standardwerte in `js/state.js`
  (`createDefaultState` / `applyData`), damit alte Spielstände weiter laden.
- **Spiele mit Freunden** (außer Poker) bauen auf `js/mp/room.js` auf: Raum, Eintritt, Verbindung,
  Abrechnung und „gegen Computer“ kommen von dort, das Spiel liefert nur Regeln und Darstellung.
- **Dublonen** nur über `GK.earn` / `GK.spend` bzw. im Casino über `GK.casino.bet`,
  `payout`, `refund` und `record` bewegen. Spielzustände über `GK.casino.data(id)` lesen,
  laufende Runden sofort speichern (Neuladen darf keinen Einsatz kosten).
- **Gestaltung**: Im Spiel keine Hinweise wie „Das Haus gewinnt immer“ und keine
  Auszahlungsquoten oder Gewinnchancen anzeigen. Es ist alles Spielgeld.
- **Zielgerät**: iPad 8. Generation (810 × 1080 hochkant, 1080 × 810 quer, Touch). Große
  Tippflächen, kein Doppeltipp-Zoom, Hover-Effekte nur in `@media (hover: hover)`.

## Testen

- `node tests/poker.test.js` – Handbewertung, Poker-Engine, Preisverteilung.
- `node tests/dice.test.js` – Lügenwürfel: Regeln und komplette Partien zwischen Computer-Gegnern.
- `node tests/casino.test.js` – Quoten und Zufall der Casino-Spiele (Rubbellose, Glücksrad,
  Münzfall, Schatzinsel, Kanonenkugel, Schiffsrennen, Slot-Maschine, Video-Slots).
- Im Browser mit Playwright (Chromium ist vorinstalliert), auch in der iPad-Emulation
  `devices['iPad (gen 7)']` hoch und quer: keine Konsolenfehler, kein seitliches Scrollen,
  Kontostand = Start − Einsätze + Auszahlungen.
- Die Klick-Münze schwebt (Animation): in Tests mit `{ force: true }` anklicken.
