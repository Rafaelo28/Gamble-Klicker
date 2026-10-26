// Gemeinsame Turnier-Regeln für Texas Hold'em (gegen Computer und mit Freunden):
// Tische mit Eintritt, Blind-Stufen und Preisverteilung.
window.GK = window.GK || {};
GK.poker = GK.poker || {};

(function () {
  const START_CHIPS = 1500;
  const HANDS_PER_LEVEL = 8;
  const MAX_SEATS = 6;
  const BLIND_LEVELS = [
    [10, 20], [15, 30], [25, 50], [50, 100], [75, 150], [100, 200], [150, 300],
    [200, 400], [300, 600], [500, 1000], [800, 1600], [1000, 2000], [1500, 3000], [2000, 4000],
  ].map(([sb, bb]) => ({ sb, bb }));

  // vip = nötige VIP-Stufe im Casino, um an diesem Tisch zu spielen bzw. einen Raum zu eröffnen
  const TIERS = [
    { id: 'harbor',  icon: '🍺', name: 'Hafenkneipe',       entry: 1000,     vip: 0 },
    { id: 'captain', icon: '⚓', name: 'Kapitänstisch',     entry: 100000,   vip: 1 },
    { id: 'royal',   icon: '👑', name: 'Königlicher Salon', entry: 10000000, vip: 2 },
  ];

  // Anteil am Preisgeld (alle Eintritte zusammen) je Platz, abhängig von der Spielerzahl
  function prizeShares(players) {
    if (players >= 6) return [0.5, 0.3, 0.2];
    if (players >= 4) return [0.65, 0.35];
    if (players === 3) return [0.7, 0.3];
    return [1];
  }

  // Preis in Dublonen für einen Platz. Bei 6 Spielern: 3× / 1,8× / 1,2× Eintritt.
  function prize(place, entry, players) {
    const shares = prizeShares(players);
    return place >= 1 && place <= shares.length ? Math.floor(entry * players * shares[place - 1]) : 0;
  }

  function tier(id) {
    return TIERS.find(t => t.id === id);
  }

  // seats: [{ id, name, avatar, isBot, personality }]
  function createTable(seats) {
    const table = GK.poker.engine.createTable({
      seats, startChips: START_CHIPS, blindLevels: BLIND_LEVELS, handsPerLevel: HANDS_PER_LEVEL,
    });
    table.players.forEach((p, i) => { p.avatar = seats[i].avatar || ''; });
    return table;
  }

  // Zufällige Computer-Gegner für freie Plätze
  function botSeats(count) {
    return GK.rng.shuffle(GK.poker.ai.BOTS.slice()).slice(0, count).map((b, i) => ({
      id: 'bot' + i, name: b.name, avatar: b.avatar, isBot: true, personality: b.personality,
    }));
  }

  GK.poker.tournament = {
    START_CHIPS, HANDS_PER_LEVEL, MAX_SEATS, BLIND_LEVELS, TIERS,
    prizeShares, prize, tier, createTable, botSeats,
  };
})();
