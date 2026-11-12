# Testen

Zwei Ebenen: **Node-Tests** für Regeln und Mathematik (ohne Browser) und **Browser-Tests** mit Playwright für
alles Sichtbare. Die Liste aller Testdateien mit Inhalt steht in [`../CLAUDE.md`](../CLAUDE.md) („Testen“).
Automatische Prüfungen auf GitHub gibt es nicht – „grün“ heißt: lokal ausgeführt.

## Node-Tests

### Ausführen

```bash
node tests/parole.test.js          # ein Test

# alle, mit Dauer und Ergebnis (läuft mehrere Minuten – im Hintergrund starten)
for t in tests/*.test.js; do
  s=$(date +%s%N); out=$(node "$t" 2>&1); rc=$?; e=$(date +%s%N)
  echo "$t $(( (e - s) / 1000000 ))ms rc=$rc FAIL=$(echo "$out" | grep -c FAIL)"
done
```

- Es gibt **kein Test-Framework** und keine `package.json`. Jede Datei ist ein eigenständiges Skript.
- Ein Test ist **bestanden**, wenn der Rückgabewert 0 ist und keine Zeile mit `FAIL` beginnt. Am Ende steht
  meist „…-Tests bestanden“.
- Die Warnung `ExperimentalWarning: localStorage is not available …` von Node ist harmlos.

### Dauer (Richtwerte, gemessen am 11.11.2026 auf einem ausgelasteten Rechner)

| Test | Dauer |
|---|---|
| `poker` | etwa 2 Minuten (viele ausgespielte Turniere) |
| `casino` | 1–2 Minuten (Simulationen über viele Runden) |
| `connect4` | etwa 1 Minute (Computer-Gegner sucht Züge voraus) |
| `billiards` | etwa 15 Sekunden |
| `parole` | etwa 8 Sekunden |
| alle übrigen | unter 4 Sekunden |

Bei einem Zeitlimit von wenigen Minuten für einen Befehl: die langen Tests einzeln oder im Hintergrund starten,
sonst bricht der Aufruf ab, obwohl nichts kaputt ist.

### Aufbau einer Testdatei

Die Spieldateien sind Browser-Skripte, die sich an `window.GK` hängen. Ein Test macht `global` zum Fenster,
stellt die wenigen benötigten Browser-Objekte als Attrappe bereit und lädt dann genau die Dateien, die er braucht –
in derselben Reihenfolge wie `index.html`.

```js
// Tests für … . Ausführen mit: node tests/beispiel.test.js
global.window = global;
// nur wenn die geladenen Dateien es brauchen (state.js, progress.js, daily.js …):
global.document = { addEventListener() {}, querySelector() { return null; }, getElementById() { return null; }, visibilityState: 'visible' };
global.location = { search: '', pathname: '/', origin: '', hash: '' };
global.history = { replaceState() {} };

const R = require('path').join(__dirname, '..', 'js') + '/';
require(R + 'casino/casino.js');          // legt GK.rng und GK.casino an
require(R + 'casino/beispiel.js');

const assert = (cond, msg) => { if (!cond) { console.log('FAIL', msg); process.exitCode = 1; } };
const between = (x, lo, hi, msg) => assert(x >= lo && x <= hi, `${msg}: ${x}`);

const M = GK.casino.beispielMath;         // vom Spiel „für Tests“ herausgegebene Funktionen
assert(M.multiplier(1) === 2, 'Erste Stufe verdoppelt');

if (!process.exitCode) console.log('Beispiel-Tests bestanden');
```

Was das für den Spielcode bedeutet:

- **Jede Datei muss allein ladbar sein.** Deshalb steht am Anfang jeder Datei der Ersatz für `GK.t` und
  `GK.i18n` (falls `js/i18n.js` nicht geladen ist) und Zugriffe auf Fremdes sind abgesichert, z. B.
  `const ic = name => (GK.icon ? GK.icon(name) : '')`.
- **Beim Laden nichts anfassen, was es in Node nicht gibt.** `document`, `GK.state`, `GK.sound`, `GK.fx` erst in
  `init()` oder in Ereignissen benutzen, nicht auf oberster Ebene.
- **Regeln und Rechnen von der Darstellung trennen** und als Objekt herausgeben, z. B.
  `GK.casino.towerMath = { MODES, multiplier, … }`. Getestet wird dieses Objekt; die Darstellung prüft der Browser.
- `GK.rng` nutzt `crypto.getRandomValues` – das gibt es in Node als globales `crypto`.

### Was ein guter Test hier prüft

| Art | Beispiel |
|---|---|
| Feste Fälle der Regeln, auch Randfälle | doppelte Buchstaben in `tests/parole.test.js`, Sonderkarten in `tests/maumau.test.js` |
| Auszahlung im Schnitt (exakt gerechnet oder simuliert) mit Grenzen | `between(C.wheelMath.rtp(), 0.94, 0.99, …)` in `tests/casino.test.js` |
| Ganze Partien zwischen Computer-Gegnern bis zum Ende | `tests/dice.test.js`, `tests/kniffel.test.js` |
| Geheimes bleibt geheim (Ansicht je Spieler) | `tests/battleship.test.js`, `tests/maumau.test.js` |
| Gleiche Rechnung auf jedem Gerät (Physik) | `tests/cannon.test.js`, `tests/minigolf.test.js`, `tests/billiards.test.js` |
| Alte Spielstände laden weiter | `tests/figure.test.js`, `tests/fleet.test.js`, `tests/savecode.test.js` |
| Geld: Eintritt, Preise, Rückgabe | `tests/payouts.test.js` |
| Gastgeber und Gäste über ein nachgebautes Netz (eigener Spielstand je Gerät, Verbindungsabbrüche, nachgebaute Uhr) | `tests/room-net.test.js` |

Bei Simulationen mit Zufall die Grenzen so weit wählen, dass der Test nicht gelegentlich zufällig fehlschlägt
(viele Durchläufe, großzügige Schranken), und die gemessene Zahl in die Fehlermeldung schreiben.

Erwartete Werte **von Hand nachrechnen**, nicht aus dem Bauch hinschreiben: Bei der Parole waren drei der ersten
Erwartungen falsch, der Code richtig.

Neuen Test in `CLAUDE.md` unter „Testen“ eintragen.

## Browser-Tests (Playwright)

### Einrichtung

Das Spiel braucht keinen Server zum Spielen, für Tests ist einer aber bequemer (gleiche Herkunft, `localStorage`):

```bash
python3 -m http.server 8765 >/dev/null 2>&1 &      # im Repo-Verzeichnis
SERVER=$!
node pfad/zum/test.js
kill $SERVER
```

Nicht `pkill -f "http.server 8765"` in derselben Befehlszeile verwenden: Das Muster trifft auch die eigene
Shell und bricht den Befehl mit Code 144 ab. Entweder über die PID beenden oder das Muster so schreiben, dass es
sich nicht selbst trifft (`pkill -f "http.server 876[5]"`).

Playwright ist nicht Teil des Repos. Wo es liegt und welcher Browser da ist, hängt vom Rechner ab:

```bash
which playwright chromium                       # installiert?
ls ~/.cache/ms-playwright 2>/dev/null           # von Playwright geladene Browser
```

Fehlt der mitgelieferte Browser („Executable doesn't exist … npx playwright install“), den Chromium des Systems
benutzen, statt etwas herunterzuladen:

```js
const { chromium, devices } = require('/pfad/zu/node_modules/playwright');
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium' });
```

Testskripte, Bildschirmfotos und andere Zwischendateien gehören **nicht ins Repo** (eigenes Arbeitsverzeichnis).

### Gerüst

```js
const ipad = devices['iPad (gen 7)'];                      // 810 × 1080, Touch
const faelle = [
  ['hoch', { ...ipad, locale: 'de-DE' }],
  ['quer', { ...ipad, locale: 'de-DE', viewport: { width: 1080, height: 810 } }],
  ['en',   { ...ipad, locale: 'en-US' }],
];
for (const [name, opts] of faelle) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));

  await page.goto('http://localhost:8765/index.html');
  await page.waitForTimeout(800);
  await page.evaluate(() => { GK.state.money = 100000; });   // Startgeld für den Test

  await page.click('[data-tab="casino"]');
  await page.click('.casino-card[data-game="parole"]');
  const start = await page.evaluate(() => GK.state.money);
  // … spielen …
  const seitlich = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await page.screenshot({ path: `${name}.png` });
  console.log(name, 'seitliches Scrollen:', seitlich, 'Fehler:', errors);
  await ctx.close();
}
```

### Was geprüft werden muss

- **Keine Konsolenfehler** (`console`-Fehler und `pageerror`).
- **Kein seitliches Scrollen**: `scrollWidth − clientWidth` ist 0, hochkant und quer.
- **Kontostand = Start − Einsätze + Auszahlungen**, nach einer verlorenen und einer gewonnenen Runde.
- **Neuladen mitten in der Runde** (`page.reload()`): Runde ist noch da, kein Einsatz weg, kein Gewinn doppelt.
- **Beide Sprachen**: einmal mit `locale: 'de-DE'`, einmal `'en-US'`.
- **Bildschirmfotos ansehen** – nicht nur Zahlen prüfen. Passt das Spielfeld samt Bedienung quer (810 hoch) ins
  Bild? Sind Tippflächen groß genug (Richtwert: etwa 44 px und mehr)?

### Kniffe

| Thema | So geht es |
|---|---|
| Sprache | Ein Browser ohne deutsche Sprache startet auf **Englisch** (`js/state.js:createDefaultSettings`). Der emulierte Browser meldet `en-US` – für deutsche Texte `locale: 'de-DE'` setzen. |
| Klick-Münze | Sie schwebt (Animation): mit `{ force: true }` anklicken. |
| Startgeld | `page.evaluate(() => { GK.state.money = 1e6; })`. Für höhere Einsätze zusätzlich die VIP-Stufe: `GK.state.casino.vip = 5`. |
| Zustand lesen | `page.evaluate(() => GK.state.casino.games.<id>)` – so kennt der Test z. B. die ausgeloste Parole und kann gezielt gewinnen oder verlieren. |
| Zufall | Ergebnisse stehen meist schon beim Start der Runde im Zustand (vorab ausgelost) – daraus lesen, statt den Zufall zu ersetzen. |
| Animationen abwarten | Nach einer Aktion `waitForTimeout` (Aufdecken, Banner) oder auf ein Element warten. Mit `GK.state.settings.effects = 'reduced'` laufen Effekte kürzer. |
| Tastatur | `page.keyboard.type('wort')`, `press('Enter')` – nur wenn das Spiel sichtbar ist und kein Eingabefeld den Fokus hat. |
| Erfolgs-Toast | Der erste Einsatz schaltet einen Erfolg frei; die Meldung liegt kurz über dem Bild und ist kein Fehler. |
| Frischer Stand | Jeder neue `browser.newContext()` hat leeren `localStorage` – also einen neuen Spieler. |
| Online-Spiele | Brauchen PeerJS (aus dem Netz geladen) und einen Vermittlungsserver. Für Tests lässt sich ein eigener über `window.GK_PEER_OPTIONS` eintragen (`js/mp/room.js`, `js/poker/multiplayer.js`). „Gegen Computer“ läuft ohne Netz. |

### Zielgerät

iPad 8. Generation: **810 × 1080** hochkant, **1080 × 810** quer, Touch. `devices['iPad (gen 7)']` hat dieselbe
Größe. Quer ist die Höhe knapp: Kopfzeile und Spielkopf brauchen etwa 130 px, es bleiben rund 680 px für Spielfeld
und Bedienung.

## Vor dem Pull Request

1. Neuer oder erweiterter Node-Test für die Änderung.
2. Alle Node-Tests grün (die langen im Hintergrund).
3. Browser: hochkant, quer, Deutsch, Englisch – ohne Fehler, ohne seitliches Scrollen, Geld stimmt, Neuladen schadet nicht.
4. Nach einem Merge von `main` in den Branch: betroffene Tests noch einmal.
