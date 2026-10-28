// Gemeinsame Turnier-Regeln für Texas Hold'em (gegen Computer und mit Freunden):
// Tische mit Eintritt, Spielmodi, Blind-Stufen, Preisverteilung und anteilige Auszahlung.
// Im Blitz-Modus wird nur eine feste Zahl Hände gespielt; danach teilen die Besten das
// Preisgeld im Verhältnis ihrer Chips.
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

  // Spielmodi: Turbo hat weniger Chips, schneller steigende Blinds und flinkere Gegner.
  // Zeiten in Millisekunden (bot = Computer-Gegner denkt nach, next = Pause nach einer Hand).
  const MODES = {
    classic: {
      id: 'classic', icon: '🃏', name: 'Klassisch', startChips: START_CHIPS, handsPerLevel: HANDS_PER_LEVEL,
      botDelay: 900, botDelayWatching: 350, nextDelay: 2500, nextDelayShowdown: 4500, turnTime: 30000,
      desc: `${START_CHIPS.toLocaleString('de-DE')} Chips, Blinds steigen alle ${HANDS_PER_LEVEL} Hände`,
    },
    turbo: {
      id: 'turbo', icon: '⚡', name: 'Turbo', startChips: 1000, handsPerLevel: 3,
      botDelay: 380, botDelayWatching: 120, nextDelay: 1200, nextDelayShowdown: 2200, turnTime: 15000,
      desc: '1.000 Chips, Blinds steigen alle 3 Hände, flotte Gegner',
    },
    blitz: {
      id: 'blitz', icon: '⏱️', name: 'Blitz', startChips: 1000, handsPerLevel: 1,
      botDelay: 380, botDelayWatching: 120, nextDelay: 1200, nextDelayShowdown: 2200, turnTime: 15000,
      desc: 'Nur 3, 5 oder 10 Hände – danach zählen die Chips',
    },
  };
  const BLITZ_HANDS = [3, 5, 10];

  function mode(id) {
    return MODES[id] || MODES.classic;
  }

  function blitzHands(n) {
    return BLITZ_HANDS.includes(n) ? n : 5;
  }

  // Name des Modus für Anzeigen, z. B. „⏱️ Blitz · 5 Hände“
  function modeLabel(modeId, hands) {
    const m = mode(modeId);
    return m.id === 'blitz' ? `${m.icon} ${m.name} · ${blitzHands(hands)} Hände` : `${m.icon} ${m.name}`;
  }

  // Einstellungen für einen neuen Tisch. Blitz: Die Blinds steigen jede Hand und erreichen
  // in der letzten Hand immer 300/600 (bei 10 Händen zuletzt 500/1.000).
  function tableSettings(modeId, hands) {
    const m = mode(modeId);
    if (m.id !== 'blitz') {
      return { startChips: m.startChips, handsPerLevel: m.handsPerLevel, blindLevels: BLIND_LEVELS, maxHands: null };
    }
    const n = blitzHands(hands);
    return { startChips: m.startChips, handsPerLevel: 1, blindLevels: BLIND_LEVELS.slice(Math.max(0, 9 - n)), maxHands: n };
  }

  // vip = nötige VIP-Stufe im Casino, um an diesem Tisch zu spielen bzw. einen Raum zu eröffnen
  const TIERS = [
    { id: 'harbor',  icon: '🍺', name: 'Hafenkneipe',        entry: 1000,  vip: 0 },
    { id: 'captain', icon: '⚓', name: 'Kapitänstisch',      entry: 1e5,   vip: 1 },
    { id: 'royal',   icon: '👑', name: 'Königlicher Salon',  entry: 1e7,   vip: 2 },
    { id: 'diamond', icon: '💎', name: 'Diamanten-Saal',     entry: 1e9,   vip: 3 },
    { id: 'pearl',   icon: '🖤', name: 'Perlen-Lounge',      entry: 1e11,  vip: 4 },
    { id: 'throne',  icon: '🏰', name: 'Thron des Kaisers',  entry: 1e13,  vip: 5 },
  ];

  // Anteil am Preisgeld (alle Eintritte zusammen) je Platz, abhängig von der Spielerzahl
  function prizeShares(players) {
    if (players >= 6) return [0.5, 0.3, 0.2];
    if (players >= 4) return [0.65, 0.35];
    if (players === 3) return [0.7, 0.3];
    return [1];
  }

  // Preis in Dublonen für einen Platz. Bei 6 Spielern: 3× / 1,8× / 1,2× Eintritt.
  // paying: wie viele echten Eintritt bezahlt haben (mit Freunden zahlen Computer-Gegner nichts)
  function prize(place, entry, players, paying = players) {
    const shares = prizeShares(players);
    return place >= 1 && place <= shares.length ? Math.floor(entry * paying * shares[place - 1]) : 0;
  }

  function tier(id) {
    return TIERS.find(t => t.id === id);
  }

  // seats: [{ id, name, avatar, isBot, personality }]
  function createTable(seats, modeId, hands) {
    const cfg = tableSettings(modeId, hands);
    const table = GK.poker.engine.createTable({
      seats, startChips: cfg.startChips, blindLevels: cfg.blindLevels, handsPerLevel: cfg.handsPerLevel,
    });
    table.mode = mode(modeId).id;
    if (cfg.maxHands) table.maxHands = cfg.maxHands;
    table.players.forEach((p, i) => {
      p.avatar = seats[i].avatar || '';
      if (seats[i].badge) p.badge = seats[i].badge; // Namensschild aus der Schatzkammer
    });
    return table;
  }

  // ---------- Blitz: begrenzte Zahl Hände ----------

  function isBlitz(t) {
    return !!t.maxHands;
  }

  // Wie viele werden am Ende ausgezahlt? Bei 6 Spielern die besten 4.
  function blitzPaidPlaces(players) {
    return Math.min(4, Math.max(1, players - 2));
  }

  // Die Besten teilen das ganze Preisgeld im Verhältnis ihrer Chips.
  // stacks: Chips je Platz am Tisch (0 = ausgeschieden). Wer an der Grenze gleich viele Chips hat, zählt mit.
  function blitzPayouts(stacks, entry, players, paying = players) {
    const pool = entry * paying;
    const sorted = stacks.filter(c => c > 0).sort((a, b) => b - a);
    if (!sorted.length) return stacks.map(() => 0);
    const threshold = sorted[Math.min(blitzPaidPlaces(players), sorted.length) - 1];
    const paid = c => c > 0 && c >= threshold;
    const total = stacks.reduce((sum, c) => sum + (paid(c) ? c : 0), 0);
    return stacks.map(c => (paid(c) ? Math.floor(pool * c / total) : 0));
  }

  // Ist nach dieser Hand Schluss?
  function handLimitReached(t) {
    return isBlitz(t) && t.phase === 'handOver' && t.handNo >= t.maxHands;
  }

  // Blitz beenden: Wer noch dabei ist, bekommt seinen Platz nach der Zahl seiner Chips
  function finishByChips(t) {
    const alive = t.players.map((p, i) => i).filter(i => !t.players[i].out);
    alive.sort((a, b) => t.players[b].chips - t.players[a].chips || a - b);
    alive.forEach((seat, k) => { t.players[seat].place = k + 1; });
    t.log.unshift(`⏱️ Die letzte Hand ist gespielt – die Chips entscheiden!`);
    t.phase = 'finished';
    t.toAct = -1;
  }

  // Auszahlung in Dublonen für einen Platz am Tisch, wenn das Turnier für ihn vorbei ist
  function payout(t, seat, entry, paying = t.players.length) {
    const p = t.players[seat];
    if (!isBlitz(t)) return prize(p.place, entry, t.players.length, paying);
    if (p.out || t.phase !== 'finished') return 0;
    return blitzPayouts(t.players.map(q => (q.out ? 0 : q.chips)), entry, t.players.length, paying)[seat];
  }

  // ---------- Anteilige Auszahlung beim Aussteigen (ICM) ----------

  // Wahrscheinlichkeit, dass ein Spieler einen bestimmten Platz belegt, nach seinem Chip-Anteil
  // (Malmuth-Harville): Platz 1 gewinnt man mit „meine Chips / alle Chips“, für die weiteren
  // Plätze wird so gerechnet, als wären die Besseren schon weg. Ergebnis: erwarteter Preis je Spieler.
  function icm(stacks, prizes) {
    const equity = stacks.map(() => 0);
    function step(remaining, depth, probability) {
      const total = remaining.reduce((sum, i) => sum + stacks[i], 0);
      if (!(total > 0) || depth >= prizes.length) return;
      remaining.forEach(i => {
        if (!(stacks[i] > 0)) return;
        const p = probability * stacks[i] / total;
        equity[i] += p * prizes[depth];
        if (remaining.length > 1) step(remaining.filter(j => j !== i), depth + 1, p);
      });
    }
    step(stacks.map((_, i) => i), 0, 1);
    return equity;
  }

  // Was ist der Platz am Tisch gerade wert? Die noch Verbliebenen spielen um die Plätze 1 bis n.
  // Chips, die man in der laufenden Hand schon gesetzt hat, sind verloren und gehen an die anderen.
  function cashOutValue(t, seat, entry) {
    const players = t.players.length;
    const alive = t.players.map((p, i) => i).filter(i => !t.players[i].out);
    if (t.players[seat].out || !alive.includes(seat)) return 0;
    // Während einer Hand liegen Chips im Pot; nach der Hand sind sie schon verteilt
    const inPot = p => (t.phase === 'betting' ? p.total : 0);
    const stacks = t.players.map(p => (p.out ? 0 : p.chips + inPot(p)));
    const lost = inPot(t.players[seat]);
    if (lost > 0) {
      stacks[seat] -= lost;
      const others = alive.filter(i => i !== seat && !t.players[i].folded);
      const share = others.length ? others : alive.filter(i => i !== seat);
      share.forEach(i => { stacks[i] += lost / share.length; });
    }
    // Blitz: so, als wäre jetzt Schluss (die Besten teilen nach Chips)
    if (isBlitz(t)) return blitzPayouts(stacks, entry, players)[seat];
    const prizes = alive.map((_, k) => prize(k + 1, entry, players));
    return Math.floor(icm(stacks, prizes)[seat]);
  }

  // Zufällige Computer-Gegner für freie Plätze
  function botSeats(count) {
    return GK.rng.shuffle(GK.poker.ai.BOTS.slice()).slice(0, count).map((b, i) => ({
      id: 'bot' + i, name: b.name, avatar: b.avatar, isBot: true, personality: b.personality,
    }));
  }

  GK.poker.tournament = {
    START_CHIPS, HANDS_PER_LEVEL, MAX_SEATS, BLIND_LEVELS, TIERS, MODES, BLITZ_HANDS,
    prizeShares, prize, tier, mode, modeLabel, blitzHands, createTable, botSeats, icm, cashOutValue,
    isBlitz, blitzPaidPlaces, blitzPayouts, handLimitReached, finishByChips, payout,
  };
})();
