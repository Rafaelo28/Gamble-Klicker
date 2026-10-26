// Zentraler Spielstand: Geld verdienen/ausgeben sowie Speichern und Laden.
// Klicker und (später) alle Casino-Spiele greifen nur über diese Funktionen auf das Geld zu.
window.GK = window.GK || {};

(function () {
  const SAVE_KEY = 'gamble-klicker-save';
  const SAVE_VERSION = 1;

  // Casino-Daten: Statistiken, Verlauf und der Zustand jedes Spiels (auch mitten in einer Runde)
  function createDefaultCasino() {
    return {
      wagered: 0,      // insgesamt eingesetzt
      won: 0,          // insgesamt ausgezahlt
      rounds: 0,
      biggestWin: 0,
      history: [],     // letzte Runden: { game, bet, payout, text, time }
      openGame: null,  // zuletzt geöffnetes Spiel
      games: {},       // { spielId: Zustand des Spiels }
    };
  }

  function createDefaultState() {
    const now = Date.now();
    return {
      version: SAVE_VERSION,
      money: 0,
      totalEarned: 0,
      clickEarned: 0,
      totalClicks: 0,
      buildings: {},   // { buildingId: anzahl }
      upgrades: [],    // gekaufte Upgrade-IDs
      playTime: 0,     // Sekunden
      casino: createDefaultCasino(),
      ui: { tab: 'clicker' },
      startedAt: now,
      lastSaved: now,
    };
  }

  // Prüft, ob der Browser dauerhaftes Speichern erlaubt (in Vorschau-Fenstern
  // oder bei blockierten Cookies wirft localStorage einen Fehler).
  function detectStorage() {
    try {
      const testKey = SAVE_KEY + '-test';
      localStorage.setItem(testKey, '1');
      localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  }

  GK.state = createDefaultState();
  GK.storageAvailable = detectStorage();
  GK.onSave = null; // optionaler Callback, z. B. für die Speicher-Anzeige

  // Geld gutschreiben. source: 'click', 'passive' oder 'casino'
  // Casino-Gewinne zählen nicht als „verdient“ (eigene Statistik im Casino).
  GK.earn = function (amount, source) {
    if (!(amount > 0)) return;
    GK.state.money += amount;
    if (source !== 'casino') GK.state.totalEarned += amount;
    if (source === 'click') GK.state.clickEarned += amount;
  };

  GK.canAfford = function (amount) {
    return GK.state.money >= amount;
  };

  // Geld abbuchen. Gibt false zurück, wenn das Guthaben nicht reicht.
  GK.spend = function (amount) {
    if (!(amount >= 0) || !GK.canAfford(amount)) return false;
    GK.state.money -= amount;
    return true;
  };

  GK.save = function () {
    if (!GK.storageAvailable) return false;
    GK.state.lastSaved = Date.now();
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(GK.state));
    } catch (e) {
      console.warn('Speichern fehlgeschlagen:', e);
      return false;
    }
    if (GK.onSave) GK.onSave();
    return true;
  };

  // Übernimmt geladene Daten; fehlende Felder (z. B. aus älteren Versionen) bekommen Standardwerte
  function applyData(data) {
    if (!data || typeof data !== 'object' || typeof data.money !== 'number' || !isFinite(data.money)) {
      return false;
    }
    const defaults = createDefaultState();
    GK.state = Object.assign(defaults, data, { version: SAVE_VERSION });
    // Verschachtelte Bereiche ebenfalls mit Standardwerten auffüllen
    GK.state.casino = Object.assign(createDefaultCasino(), data.casino);
    GK.state.ui = Object.assign({ tab: 'clicker' }, data.ui);
    return true;
  }

  GK.load = function () {
    if (!GK.storageAvailable) return false;
    let raw = null;
    try {
      raw = localStorage.getItem(SAVE_KEY);
    } catch (e) {
      console.warn('Laden fehlgeschlagen:', e);
    }
    if (!raw) return false;
    try {
      return applyData(JSON.parse(raw));
    } catch (e) {
      console.warn('Spielstand beschädigt, starte neu:', e);
      return false;
    }
  };

  // Spielstand als Text (Base64), z. B. zum Sichern oder Übertragen auf ein anderes Gerät
  GK.exportSave = function () {
    const json = JSON.stringify(GK.state);
    return btoa(String.fromCharCode(...new TextEncoder().encode(json)));
  };

  GK.importSave = function (text) {
    try {
      const bytes = Uint8Array.from(atob(text.trim()), c => c.charCodeAt(0));
      if (!applyData(JSON.parse(new TextDecoder().decode(bytes)))) return false;
    } catch (e) {
      return false;
    }
    GK.save();
    return true;
  };

  GK.resetSave = function () {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (e) {
      // Ignorieren: ohne Speicher gibt es auch nichts zu löschen
    }
    GK.state = createDefaultState();
  };

  // Den Browser bitten, unsere Daten nicht automatisch zu löschen (z. B. bei wenig Speicherplatz)
  if (GK.storageAvailable && navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }
})();
