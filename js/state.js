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

  GK.state = createDefaultState();

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
    GK.state.lastSaved = Date.now();
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(GK.state));
      return true;
    } catch (e) {
      console.warn('Speichern fehlgeschlagen:', e);
      return false;
    }
  };

  GK.load = function () {
    let raw = null;
    try {
      raw = localStorage.getItem(SAVE_KEY);
    } catch (e) {
      console.warn('Laden fehlgeschlagen:', e);
    }
    if (!raw) return false;
    try {
      const data = JSON.parse(raw);
      // Fehlende Felder (z. B. aus älteren Versionen) mit Standardwerten auffüllen
      GK.state = Object.assign(createDefaultState(), data, { version: SAVE_VERSION });
      return true;
    } catch (e) {
      console.warn('Spielstand beschädigt, starte neu:', e);
      return false;
    }
  };

  GK.resetSave = function () {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (e) {
      // Ignorieren: ohne Speicher gibt es auch nichts zu löschen
    }
    GK.state = createDefaultState();
  };
})();
