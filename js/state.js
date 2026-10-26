// Zentraler Spielstand: Geld verdienen/ausgeben sowie Speichern und Laden.
// Klicker und (später) alle Casino-Spiele greifen nur über diese Funktionen auf das Geld zu.
window.GK = window.GK || {};

(function () {
  const SAVE_KEY = 'gamble-klicker-save';
  const SAVE_VERSION = 1;

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

  // Geld gutschreiben. source: 'click', 'passive' oder später z. B. 'casino'
  GK.earn = function (amount, source) {
    if (!(amount > 0)) return;
    GK.state.money += amount;
    GK.state.totalEarned += amount;
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
    GK.state = Object.assign(createDefaultState(), data, { version: SAVE_VERSION });
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
