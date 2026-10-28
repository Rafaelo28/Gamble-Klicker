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

- **Physik in Online-Spielen** (Minigolf, Billard, Kanonenduell) nur mit + − × ÷ und `Math.sqrt` rechnen, keine
  Winkelfunktionen in der Simulation – sonst kommen auf verschiedenen Geräten andere Ergebnisse heraus.

- **Besucherzählung** (`js/analytics.js`, GoatCounter): nur Seitenaufrufe und Ereignisse wie
  `GK.track('spiel-…', name)` – niemals Namen, Raum-Codes, Spieler-IDs oder Spielstände mitsenden.

## Testen

- `node tests/poker.test.js` – Handbewertung, Poker-Engine, Preisverteilung.
- `node tests/dice.test.js` – Lügenwürfel: Regeln und komplette Partien zwischen Computer-Gegnern.
- `node tests/minigolf.test.js` – Minigolf: Physik (muss überall gleich rechnen) und komplette Runden.
- `node tests/billiards.test.js` – Billard: Aufbau, Physik, Regeln und komplette Partien.
- `node tests/connect4.test.js` – Vier gewinnt: Gewinnerkennung, Züge und Partien zwischen Computer-Gegnern.
- `node tests/battleship.test.js` – Seeschlacht: Flotte, Regeln, geheime Ansicht, Computer-Gegner.
- `node tests/darts.test.js` – Darts: Wertung, Ablauf mit 2–4 Spielern, Stechen, Aufgeben.
- `node tests/cannon.test.js` – Kanonenduell: Flugbahn (muss überall gleich rechnen), Schaden, Regeln, Partien.
- `node tests/format.test.js` – Beträge mit Abkürzungen eingeben (500k, 2,5M, 1B, 3 Mio.).
- `node tests/cosmetics.test.js` – Schatzkammer: Katalog, Preise, Glücksrad nach der großen Fahrt.
- `node tests/chicken.test.js` – Chicken Road: Multiplikatoren, Verkehr (Zusammenstöße, sichere Zonen), Ablauf einer Runde.
- `node tests/kraken.test.js` – Kraken-Angriff (Treffer, Diebstahl, Pause, Zeitplan) und Freundes-Rangliste (Austausch, Prüfung).
- `node tests/payouts.test.js` – Preise mit Freunden (auch mit Computer-Gegnern, auch Poker) und gegen Computer.
- `node tests/casino.test.js` – Quoten und Zufall der Casino-Spiele (Roulette, Rubbellose, Glücksrad,
  Münzfall, Schatzinsel, Kanonenkugel, Schiffsrennen, Flugkapitän, Höher oder tiefer, Mast-Kletterei,
  Schatzkarten-Keno, Baccarat, Slot-Maschine, Video-Slots).
- Im Browser mit Playwright (Chromium ist vorinstalliert), auch in der iPad-Emulation
  `devices['iPad (gen 7)']` hoch und quer: keine Konsolenfehler, kein seitliches Scrollen,
  Kontostand = Start − Einsätze + Auszahlungen.
- Die Klick-Münze schwebt (Animation): in Tests mit `{ force: true }` anklicken.
