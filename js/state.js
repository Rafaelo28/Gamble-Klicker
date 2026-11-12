// Zentraler Spielstand: Geld verdienen/ausgeben sowie Speichern und Laden.
// Klicker und alle Casino-Spiele greifen nur über diese Funktionen auf das Geld zu.
window.GK = window.GK || {};

// Sprache: Ersatz, falls js/i18n.js (noch) nicht geladen ist – gibt den deutschen Text zurück.
GK.t = GK.t || function (s, v) { s = String(s); return v ? s.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m)) : s; };
GK.i18n = GK.i18n || { add() {}, addHtml() {}, apply() {}, set() {}, lang: 'de' };

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
      biggestLossPct: 0, // größter Verlust in Prozent des Einkommens pro Sekunde (Rangliste)
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

  // Sprache: Deutsch ist die Quelle. Neue Spieler bekommen die Sprache ihres Browsers –
  // alles außer Deutsch startet auf Englisch. Die gewählte Sprache wird gespeichert.
  function detectLang() {
    const nav = (typeof navigator !== 'undefined' && (navigator.language || (navigator.languages && navigator.languages[0]))) || 'de';
    return String(nav).toLowerCase().startsWith('de') ? 'de' : 'en';
  }

  // Einstellungen: Sprache, Ton und Animationen (bei „Bewegung reduzieren“ im System automatisch ruhiger)
  function createDefaultSettings() {
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return { lang: detectLang(), sound: true, volume: 0.7, effects: reduceMotion ? 'reduced' : 'full', kraken: true };
  }

  // Tägliche Aufgaben
  function createDefaultDaily() {
    return {
      day: '',         // für welchen Tag die Aufgaben gelten (JJJJ-MM-TT, Ortszeit)
      tasks: [],       // [{ id, target, progress, done, claimed, … }]
      streak: 0,       // Tage in Folge mit allen drei Aufgaben
      bonusDay: '',    // an welchem Tag zuletzt der Bonus abgeholt wurde
      bonuses: 0,
      completed: 0,    // insgesamt geschaffte Aufgaben
    };
  }

  // Kraken-Angriffe im Klicker
  function createDefaultKraken() {
    return {
      clock: 0,        // Sekunden aktiver Spielzeit im Klicker seit dem letzten Angriff
      next: 0,         // nach so vielen Sekunden kommt der nächste (0 = noch nicht ausgelost)
      attack: null,    // laufender Angriff (wird gespeichert, Neuladen hilft nicht)
      defeated: 0,
      escaped: 0,
      stolen: 0,       // insgesamt gestohlene Gebäude
    };
  }

  // Flotte: ships = Stufe je Schiff, voyages = laufende Fahrten je Schiff, last = letztes Ziel,
  // treasures = gefundene Schätze (Anzahl), peak = bestes Einkommen pro Sekunde (für Preise und Beute)
  function createDefaultFleet() {
    return { ships: {}, voyages: {}, last: {}, treasures: {}, peak: 0, done: 0, earned: 0, log: [] };
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
      rankSeen: 0,                             // höchster Rang, der schon gemeldet wurde (GK.rank)
      fleet: createDefaultFleet(),             // Flotte & Expeditionen (js/fleet.js)
      boss: { level: 0, kills: 0, fights: 0 }, // Bosskämpfe: höchste besiegte Stufe (js/boss.js)
      prestige: { points: 0, journeys: 0 },    // Schatzkarten und Anzahl großer Fahrten
      achievements: [],                        // freigeschaltete Erfolge
      buffs: [],                               // zeitlich begrenzte Boni (Goldrausch …)
      goldenClicks: 0,
      crits: 0,        // kritische Klicks
      bestCombo: 0,    // längste Klick-Combo
      passiveOff: false, // passives Einkommen der Gebäude ausgeschaltet (Schalter unter den Gebäuden)
      casino: createDefaultCasino(),
      cosmetics: createDefaultCosmetics(),
      player: { name: '', avatar: '', fig: '', figOn: false }, // spielweiter Name, Bild und eigene Figur (fig = Code, figOn = statt Emoji zeigen)
      friendId: '',    // eigene Kennung für die Freundes-Rangliste (wird beim ersten Raum erzeugt)
      friends: {},     // Rekorde der Freunde vom letzten gemeinsamen Spiel: { kennung: { name, avatar, … } }
      friendWins: 0,   // erste Plätze mit Freunden (Räume und Poker)
      kraken: createDefaultKraken(),
      daily: createDefaultDaily(),
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
    // Tägliche Aufgabe „Verdiene …“ (nur Klicks und Gebäude)
    if ((source === 'click' || source === 'passive') && GK.daily) GK.daily.track('earn', amount);
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

  // ---------- Spielzeit-Uhr ----------
  // Die Geräte-Uhr lässt sich leicht verstellen (Buffs für immer, Offline-Einkommen mehrfach, Fahrten sofort
  // fertig …). GK.now() läuft darum nie rückwärts: Zwischen zwei Aufrufen vergeht mindestens die echte Zeit
  // (performance.now), und sie beginnt nie vor dem letzten Speichern (lastSaved). Eine vorgestellte Geräte-Uhr
  // zählt wie Zeit ohne Spiel (lässt sich nicht von echter Abwesenheit unterscheiden); stellt man sie danach
  // zurück, läuft die Spielzeit einfach weiter – die vorgezogene Zeit ist dann verbraucht.
  const perfNow = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
  let clockT = 0;
  let clockP = 0;
  GK.now = function () {
    const p = perfNow();
    const floor = GK.state && Number(GK.state.lastSaved) > 0 ? Number(GK.state.lastSaved) : 0;
    const t = Math.max(clockT ? clockT + Math.max(0, p - clockP) : 0, Date.now(), floor);
    clockT = t;
    clockP = p;
    return t;
  };

  GK.save = function () {
    // GK.paused: Das Spiel läuft in einem anderen Tab weiter (js/main.js) – dieser Tab darf nichts überschreiben
    // GK.tabLost: Ein anderer Tab hat inzwischen übernommen – dann wird dieser hier pausiert, statt zu speichern
    if (!GK.storageAvailable || GK.paused || (GK.tabLost && GK.tabLost())) return false;
    GK.state.lastSaved = GK.now();
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(GK.state));
    } catch (e) {
      console.warn('Speichern fehlgeschlagen:', e);
      return false;
    }
    if (GK.onSave) GK.onSave();
    return true;
  };

  // ---------- Daten von außen entschärfen ----------
  // Ein Spielstand-Code (Import) und Nachrichten anderer Geräte (Spiele mit Freunden, Poker) können beliebigen
  // Inhalt haben. Viele Werte landen später in innerHTML – ein präparierter Wert wie '<img onerror=…>' würde
  // dann fremden Code ausführen. Darum werden in allen Texten und Schlüsseln die Zeichen ersetzt, mit denen
  // man HTML einschleusen kann, durch gleich aussehende harmlose Zeichen (< > " ' `). Das Spiel selbst speichert
  // und verschickt nie HTML, es geht also nichts verloren. Schlüssel wie __proto__ fallen weg.
  const UNSAFE = /[<>"'`]/g;
  const SAFE = { '<': '‹', '>': '›', '"': '”', "'": '’', '`': 'ˋ' };
  const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
  function cleanData(value, depth = 0) {
    if (typeof value === 'string') return value.replace(UNSAFE, c => SAFE[c]);
    if (value === null || typeof value !== 'object') return typeof value === 'function' || typeof value === 'symbol' ? undefined : value;
    if (depth > 60) return null;
    if (Array.isArray(value)) return value.map(v => cleanData(v, depth + 1));
    const out = {};
    Object.keys(value).forEach(k => {
      if (BAD_KEYS.has(k)) return;
      out[cleanData(k)] = cleanData(value[k], depth + 1);
    });
    return out;
  }
  GK.cleanData = cleanData;

  // Übernimmt geladene Daten; fehlende Felder (z. B. aus älteren Versionen) bekommen Standardwerte
  function applyData(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
    data = cleanData(data);
    if (typeof data.money !== 'number' || !isFinite(data.money)) {
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
    // Wer schon spielt (Spielstand ohne gespeicherte Sprache), hat bisher Deutsch gesehen und behält es –
    // nur ganz neue Spieler bekommen die Sprache ihres Browsers
    if (!data.settings || (data.settings.lang !== 'de' && data.settings.lang !== 'en')) GK.state.settings.lang = 'de';
    GK.state.prestige = Object.assign({ points: 0, journeys: 0 }, data.prestige);
    GK.state.cosmetics = Object.assign(createDefaultCosmetics(), data.cosmetics);
    GK.state.kraken = Object.assign(createDefaultKraken(), data.kraken);
    GK.state.daily = Object.assign(createDefaultDaily(), data.daily);
    GK.state.fleet = Object.assign(createDefaultFleet(), data.fleet);
    ['ships', 'voyages', 'last', 'treasures'].forEach(k => {
      if (!GK.state.fleet[k] || typeof GK.state.fleet[k] !== 'object' || Array.isArray(GK.state.fleet[k])) GK.state.fleet[k] = {};
    });
    if (!Array.isArray(GK.state.fleet.log)) GK.state.fleet.log = [];
    GK.state.boss = Object.assign({ level: 0, kills: 0, fights: 0 }, data.boss);
    if (!Number.isInteger(GK.state.boss.level) || GK.state.boss.level < 0) GK.state.boss.level = 0;
    if (!Array.isArray(GK.state.daily.tasks)) GK.state.daily.tasks = [];
    if (!data.friends || typeof data.friends !== 'object') GK.state.friends = {};
    GK.state.cosmetics.equipped = Object.assign(createDefaultCosmetics().equipped, data.cosmetics && data.cosmetics.equipped);
    if (!Array.isArray(GK.state.cosmetics.owned)) GK.state.cosmetics.owned = [];
    // Ältere Spielstände: Name und Bild aus den Spielen mit Freunden bzw. dem Poker übernehmen
    GK.state.player = Object.assign({ name: '', avatar: '', fig: '', figOn: false }, data.player);
    if (!data.player) {
      const games = (data.casino && data.casino.games) || {};
      const old = games.room || games.pokerMp;
      if (old) Object.assign(GK.state.player, { name: old.name || '', avatar: old.avatar || '' });
    }
    // Ältere Spielstände kennen „insgesamt verdient über alle Fahrten“ noch nicht
    if (typeof data.allTimeEarned !== 'number') GK.state.allTimeEarned = GK.state.totalEarned;
    // Falsche Typen aus beschädigten oder bearbeiteten Ständen (sonst bricht später das Zeichnen ab)
    ['buffs', 'upgrades', 'achievements'].forEach(k => { if (!Array.isArray(GK.state[k])) GK.state[k] = []; });
    GK.state.buffs = GK.state.buffs.filter(b => b && typeof b === 'object' && typeof b.id === 'string' &&
      Number.isFinite(b.mult) && Number.isFinite(b.until));
    ['buildings'].forEach(k => { if (!GK.state[k] || typeof GK.state[k] !== 'object' || Array.isArray(GK.state[k])) GK.state[k] = {}; });
    const c = GK.state.casino;
    ['games', 'stats'].forEach(k => { if (!c[k] || typeof c[k] !== 'object' || Array.isArray(c[k])) c[k] = {}; });
    if (!Array.isArray(c.history)) c.history = [];
    if (!Number.isInteger(c.vip) || c.vip < 0) c.vip = 0;
    if (!(Number(GK.state.lastSaved) > 0)) GK.state.lastSaved = Date.now();
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
    let ok = false;
    try {
      ok = applyData(JSON.parse(raw));
    } catch (e) {
      console.warn('Spielstand beschädigt, starte neu:', e);
    }
    // Nicht ladbar: den alten Stand aufheben, bevor das automatische Speichern ihn überschreibt
    if (!ok) {
      try {
        localStorage.setItem(SAVE_KEY + '-defekt', raw);
      } catch (e) {
        // Kein Platz – dann eben nicht
      }
      GK.state = createDefaultState();
    }
    return ok;
  };

  // Spielstand als Text, z. B. zum Sichern oder Übertragen auf ein anderes Gerät.
  // Der Code ist verschlüsselt und fälschungssicher verpackt (siehe js/savecode.js);
  // bearbeitete Codes werden beim Import abgewiesen. Alte reine Base64-Codes lassen
  // sich weiterhin importieren.
  GK.exportSave = function () {
    return GK.saveCode.encode(GK.state);
  };

  GK.importSave = function (text) {
    const data = GK.saveCode.decode(text);
    if (!data || !applyData(data)) return false;
    // Laufende Runden im importierten Stand verfallen (siehe GK.casino.RUNNING)
    if (GK.casino && GK.casino.clearRunning) GK.casino.clearRunning();
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
