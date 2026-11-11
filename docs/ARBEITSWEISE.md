# Arbeitsweise: Branch, Pull Request, Veröffentlichung

Für Agenten, die in diesem Repo etwas ändern. Die verbindlichen Regeln stehen in [`CLAUDE.md`](../CLAUDE.md);
hier steht, **wie** man sie praktisch umsetzt und woran es schon gescheitert ist.

## Ablauf einer Änderung

1. **Stand holen.** `main` bewegt sich, auch während du arbeitest (andere Agenten, Rafaelo28).
   ```bash
   git fetch origin && git checkout main && git pull origin main
   git checkout -b claude/<kurzer-name>      # Branch-Namen auf Deutsch, z. B. claude/geheime-parole
   ```
2. **Ändern.** Kommentare, Commits und PR-Texte auf Deutsch. Bei jeder Änderung an JS oder CSS die
   Versionsnummer erhöhen (siehe unten).
3. **Testen.** Alle `node tests/*.test.js` und – bei sichtbaren Änderungen – im Browser
   (siehe [`TESTEN.md`](TESTEN.md)).
4. **Committen.** Dateien **einzeln** hinzufügen (`git add pfad …`), nicht `git add -A` –
   siehe „Fremde Dateien“.
5. **Pull Request nach `main`** erstellen und, wenn alles grün ist, **selbst mergen**.
6. **Nach dem Merge:** `main` holen, Arbeits-Branch auf den neuen Stand setzen, prüfen, ob die Seite
   veröffentlicht wurde, und den Link zum Pull Request nennen.

## Versionsnummer (`?v=…`)

- Alle Skripte und Stylesheets in `index.html` tragen dieselbe Nummer im Format `JJJJMMTTNN`
  (Datum + laufende Nummer des Tages, z. B. `2026111101`).
- Bei jeder Änderung an einer JS- oder CSS-Datei **alle** Vorkommen auf einen neuen, höheren Wert setzen –
  sonst mischt der Browser alte und neue Dateien aus dem Zwischenspeicher.
- Ein neues Skript bekommt eine eigene Zeile in `index.html` (Reihenfolge beachten, siehe
  [`KERN.md`](KERN.md)) mit derselben Nummer.

```bash
# alle auf einmal ersetzen
sed -i 's/?v=[0-9]\{10\}/?v=2026111102/g' index.html
grep -o '?v=[0-9]*' index.html | sort | uniq -c      # es darf nur ein Wert übrig bleiben
```

Reine Doku-Änderungen (`*.md`) brauchen keine neue Nummer.

## Konflikt in `index.html`

Weil jede Änderung alle `?v=…` anfasst, kollidieren zwei gleichzeitige Pull Requests fast immer in
`index.html` – und nur dort. So löst man das sauber:

```bash
git merge main                      # meldet: CONFLICT in index.html
git checkout --theirs index.html    # Fassung von main nehmen
# eigene Zeilen wieder einfügen (z. B. das neue <script>), dann alle ?v= auf einen Wert
# setzen, der höher ist als beide Seiten
git add index.html && git commit
```

Danach Tests noch einmal laufen lassen – `main` kann auch Code geändert haben.

## Fremde Dateien im Arbeitsverzeichnis

Im Arbeitsverzeichnis können Dateien auftauchen, die nicht von dir sind (z. B. lag während der Arbeit an der
„Geheimen Parole“ plötzlich `docs/EXPLOITS.md` unversioniert da). `git add -A` nimmt sie mit in den Commit.

- Vor dem Commit `git status --short` ansehen und nur eigene Pfade hinzufügen.
- Eine fremde Datei weder löschen noch committen; im Abschlussbericht erwähnen.
- Ist sie schon im (noch nicht gepushten) Commit: `git reset --soft HEAD~1`,
  `git restore --staged <datei>`, neu committen.

## Welches Repo? (Fork und Original)

- Das Original ist **`Rafaelo28/Gamble-Klicker`**; von dessen `main` wird die öffentliche Seite gebaut:
  <https://rafaelo28.github.io/Gamble-Klicker/> (GitHub Pages, *Deploy from a branch*, 1–2 Minuten nach dem Merge).
- Ein Arbeitsverzeichnis kann aber ein **Fork** sein. Prüfen:
  ```bash
  git remote -v
  gh repo view --json nameWithOwner,parent -q '.nameWithOwner + " ← " + (.parent.owner.login // "kein Fork")'
  ```
- In einem Fork legt `gh pr create` den Pull Request standardmäßig im **Original** an. Soll er im Fork
  bleiben, `--repo <besitzer>/Gamble-Klicker` angeben (auch bei `gh pr merge`, `gh pr view`, `gh pr checks`).
- Ein Fork hat meist **kein** GitHub Pages (`gh api repos/<besitzer>/Gamble-Klicker/pages` → 404). Dann ist ein
  Merge in den Fork **nicht** online; das im Abschlussbericht klar sagen. Ein Pull Request ins Original ist ein
  Schritt nach außen – nur auf ausdrücklichen Wunsch.
- Im Repo gibt es keine automatischen Prüfungen (`.github/` fehlt): „alle Tests grün“ heißt, sie lokal
  ausgeführt zu haben.

## Pull Request

- Titel und Text auf Deutsch: was ist neu, was wurde geprüft.
- Mergen mit `gh pr merge <nr> --merge`. Meldet GitHub „not mergeable“, ist `main` weitergelaufen:
  `main` in den Branch mergen (siehe Konflikt oben), pushen, erneut mergen.
- Danach:
  ```bash
  git checkout main && git pull origin main
  git branch -f claude/<name> main        # erst NACH dem Merge – vorher wirft das den Branch-Stand weg
  ```

## Doku mitpflegen

Bei jeder Erweiterung gehören dazu:

| Datei | Was |
|---|---|
| `README.md` | Spielerseitige Beschreibung (Liste der Spiele oben, Übersicht weiter unten) |
| `PROJEKTPLAN.md` | Abschnitt „Erweiterung: …“ bzw. „Pflege: …“ **vor** „## Entscheidungen“, mit Zahlen zur Ausgewogenheit |
| `CLAUDE.md` | Neue Regel oder neuer Test in der Liste „Testen“ |
| `docs/*.md` | Tabellen und Rezepte, wenn sich eine Schnittstelle ändert (siehe [`README.md`](README.md)) |

Quoten und Gewinnchancen stehen nur in der Doku, nie im Spiel.
