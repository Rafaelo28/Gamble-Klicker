// Zentraler Spielstand: Geld verdienen/ausgeben sowie Speichern und Laden.
// Klicker und alle Casino-Spiele greifen nur über diese Funktionen auf das Geld zu.
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
      biggestLoss: 0,  // größter Verlust in einer Runde
      vip: 0,          // VIP-Karte: 0 Standard, 1 Silber, 2 Gold, 3 Diamant, 4 Schwarze Perle, 5 Kaiserkrone
      history: [],     // letzte Runden: { game, bet, payout, text, time }
      openGame: null,  // zuletzt geöffnetes Spiel
      games: {},       // { spielId: Zustand des Spiels }
      stats: {},       // Statistik je Spiel: { spielId: { rounds, wagered, won, wins, biggestWin, biggestLoss, bestMult, streak, bestStreak, last } }
      statsSince: 0,   // ab wann die Statistik je Spiel zählt (0 = von Anfang an)
    };
  }

  // Schatzkammer: gekaufte bzw. gewonnene Cosmetics, was angelegt ist, und ein noch nicht gedrehtes Glücksrad
  function createDefaultCosmetics() {
    return { owned: [], equipped: { coin: 'gold', effect: 'coins', theme: 'tavern', profile: 'sailor', table: 'felt' }, wheel: null };
  }

  // Einstellungen: Ton und Animationen (bei „Bewegung reduzieren“ im System automatisch ruhiger)
  function createDefaultSettings() {
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return { sound: true, volume: 0.7, effects: reduceMotion ? 'reduced' : 'full' };
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
      allTimeEarned: 0,                        // verdient über alle großen Fahrten hinweg
      prestige: { points: 0, journeys: 0 },    // Schatzkarten und Anzahl großer Fahrten
      achievements: [],                        // freigeschaltete Erfolge
      buffs: [],                               // zeitlich begrenzte Boni (Goldrausch …)
      goldenClicks: 0,
      crits: 0,        // kritische Klicks
      bestCombo: 0,    // längste Klick-Combo
      passiveOff: false, // passives Einkommen der Gebäude ausgeschaltet (Schalter unter den Gebäuden)
      casino: createDefaultCasino(),
      cosmetics: createDefaultCosmetics(),
      player: { name: '', avatar: '' }, // spielweiter Name und Bild (leer = noch nicht festgelegt)
      ui: { tab: 'clicker' },
      settings: createDefaultSettings(),
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
    if (source !== 'casino') {
      GK.state.totalEarned += amount;
      GK.state.allTimeEarned += amount;
    }
    if (source === 'click') GK.state.clickEarned += amount;
  };

  // ---------- Spielweiter Name und Bild (Spiele mit Freunden, Poker, Schatzkammer) ----------

  const MAX_NAME = 16;
  const AVATARS = ['😎', '🤠', '🧐', '😺', '🐸', '🦊', '🐼', '🐯', '🦄', '🐙', '🦈', '🐵'];

  function cleanName(name) {
    return String(name || '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME) || 'Gast';
  }

  // Wer noch keinen Namen festgelegt hat, bekommt einen zufälligen
  function player() {
    const p = GK.state.player;
    if (!p.name) p.name = 'Spieler ' + (100 + Math.floor(Math.random() * 900));
    if (!AVATARS.includes(p.avatar)) p.avatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];
    return p;
  }

  GK.player = {
    MAX_NAME,
    AVATARS,
    cleanName,
    name: () => player().name,
    avatar: () => player().avatar,
    setName(name) {
      player().name = cleanName(name);
      GK.save();
      return GK.state.player.name;
    },
    // Nächstes Bild aus der Liste
    nextAvatar() {
      const p = player();
      p.avatar = AVATARS[(AVATARS.indexOf(p.avatar) + 1) % AVATARS.length];
      GK.save();
      return p.avatar;
    },
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
    // Ältere Spielstände haben noch keine Statistik je Spiel: sie zählt ab jetzt
    if (data.casino && !data.casino.stats && data.casino.rounds > 0) GK.state.casino.statsSince = Date.now();
    GK.state.ui = Object.assign({ tab: 'clicker' }, data.ui);
    GK.state.settings = Object.assign(createDefaultSettings(), data.settings);
    GK.state.prestige = Object.assign({ points: 0, journeys: 0 }, data.prestige);
    GK.state.cosmetics = Object.assign(createDefaultCosmetics(), data.cosmetics);
    GK.state.cosmetics.equipped = Object.assign(createDefaultCosmetics().equipped, data.cosmetics && data.cosmetics.equipped);
    if (!Array.isArray(GK.state.cosmetics.owned)) GK.state.cosmetics.owned = [];
    // Ältere Spielstände: Name und Bild aus den Spielen mit Freunden bzw. dem Poker übernehmen
    GK.state.player = Object.assign({ name: '', avatar: '' }, data.player);
    if (!data.player) {
      const games = (data.casino && data.casino.games) || {};
      const old = games.room || games.pokerMp;
      if (old) Object.assign(GK.state.player, { name: old.name || '', avatar: old.avatar || '' });
    }
    // Ältere Spielstände kennen „insgesamt verdient über alle Fahrten“ noch nicht
    if (typeof data.allTimeEarned !== 'number') GK.state.allTimeEarned = GK.state.totalEarned;
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
    const bytes = new TextEncoder().encode(JSON.stringify(GK.state));
    // In Stücken umwandeln: Safari erlaubt nur begrenzt viele Argumente pro Funktionsaufruf
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(binary);
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
