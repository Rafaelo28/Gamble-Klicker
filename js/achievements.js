// Erfolge: werden automatisch freigeschaltet und geben je +1 % Einkommen.
// Manche prüft das Spiel regelmäßig (check), andere melden die Spiele selbst
// über GK.unlockAchievement('id'), z. B. beim Jackpot.
window.GK = window.GK || {};

(function () {
  const totalBuildings = s => Object.values(s.buildings).reduce((sum, n) => sum + n, 0);
  const cps = () => (GK.clicker ? GK.clicker.getCpsPermanent() : 0);

  const ACHIEVEMENTS = [
    // Klicker
    { id: 'click1',      icon: '👆', name: 'Der erste Klick',       desc: 'Klicke auf die Dublone.',                 check: s => s.totalClicks >= 1 },
    { id: 'click1k',     icon: '🖱️', name: 'Klick-Maschine',        desc: '1.000-mal geklickt.',                      check: s => s.totalClicks >= 1000 },
    { id: 'click10k',    icon: '🦾', name: 'Sehnenscheiden-Alarm',  desc: '10.000-mal geklickt.',                     check: s => s.totalClicks >= 10000 },
    { id: 'earn1k',      icon: '🪙', name: 'Taschengeld',           desc: '1.000 Dublonen verdient.',                 check: s => s.allTimeEarned >= 1e3 },
    { id: 'earn1m',      icon: '💰', name: 'Millionär',             desc: '1 Million Dublonen verdient.',             check: s => s.allTimeEarned >= 1e6 },
    { id: 'earn1b',      icon: '🏆', name: 'Milliardär',            desc: '1 Milliarde Dublonen verdient.',           check: s => s.allTimeEarned >= 1e9 },
    { id: 'earn1t',      icon: '👑', name: 'Billionär',             desc: '1 Billion Dublonen verdient.',             check: s => s.allTimeEarned >= 1e12 },
    { id: 'cps10',       icon: '📈', name: 'Passives Einkommen',    desc: '10 Dublonen pro Sekunde.',                 check: () => cps() >= 10 },
    { id: 'cps1k',       icon: '🏭', name: 'Geldmaschine',          desc: '1.000 Dublonen pro Sekunde.',              check: () => cps() >= 1000 },
    { id: 'cps100k',     icon: '🏰', name: 'Dublonen-Imperium',     desc: '100.000 Dublonen pro Sekunde.',            check: () => cps() >= 100000 },
    { id: 'build10',     icon: '🧱', name: 'Bauherr',               desc: '10 Gebäude besitzen.',                     check: s => totalBuildings(s) >= 10 },
    { id: 'build100',    icon: '🏙️', name: 'Großgrundbesitzer',     desc: '100 Gebäude besitzen.',                    check: s => totalBuildings(s) >= 100 },
    { id: 'buildAll',    icon: '🗂️', name: 'Von allem etwas',       desc: 'Jedes Gebäude mindestens einmal besitzen.', check: () => GK.clicker && GK.clicker.ownsAllBuildings() },
    { id: 'upgrades10',  icon: '⬆️', name: 'Aufgerüstet',           desc: '10 Upgrades gekauft.',                     check: s => s.upgrades.length >= 10 },
    { id: 'crit1',       icon: '🎯', name: 'Volltreffer!',          desc: 'Einen kritischen Klick gelandet.',         check: s => s.crits >= 1 },
    { id: 'crit100',     icon: '💥', name: 'Kritische Masse',       desc: '100 kritische Klicks gelandet.',           check: s => s.crits >= 100 },
    { id: 'combo50',     icon: '🔥', name: 'In Flammen',            desc: 'Eine Klick-Combo von 50 geschafft.',       check: s => s.bestCombo >= 50 },
    { id: 'combo100',    icon: '☄️', name: 'Nicht zu bremsen',      desc: 'Eine Klick-Combo von 100 geschafft.',      check: s => s.bestCombo >= 100 },
    { id: 'synergy',     icon: '🤝', name: 'Teamwork',              desc: 'Ein Synergie-Upgrade gekauft.',            check: () => GK.clicker && GK.clicker.hasUpgradeOfRarity('synergy') },
    { id: 'diamondUp',   icon: '💠', name: 'Diamantstufe',          desc: 'Ein Diamant-Upgrade für ein Gebäude gekauft.', check: () => GK.clicker && GK.clicker.hasUpgradeOfRarity('diamond') },
    { id: 'mythicUp',    icon: '🦄', name: 'Mythos',                desc: 'Ein Mythos-Upgrade für ein Gebäude gekauft.',  check: () => GK.clicker && GK.clicker.hasUpgradeOfRarity('mythic') },
    { id: 'golden1',     icon: '✨', name: 'Goldfund',              desc: 'Eine goldene Dublone gefangen.',           check: s => s.goldenClicks >= 1 },
    { id: 'golden25',    icon: '🌟', name: 'Goldgräber',            desc: '25 goldene Dublonen gefangen.',            check: s => s.goldenClicks >= 25 },
    // Casino
    { id: 'casino1',     icon: '🎲', name: 'Erste Wette',           desc: 'Eine Runde im Casino gespielt.',           check: s => s.casino.rounds >= 1 },
    { id: 'casino100',   icon: '🎟️', name: 'Stammgast',             desc: '100 Runden im Casino gespielt.',           check: s => s.casino.rounds >= 100 },
    { id: 'slots777',    icon: '7️⃣', name: 'Jackpot!',              desc: 'Drei Siebenen an der Slot-Maschine.' },
    { id: 'rouletteNumber', icon: '🎯', name: 'Volltreffer',        desc: 'Beim Roulette eine einzelne Zahl getroffen.' },
    { id: 'rouletteZero', icon: '🟢', name: 'Alles auf Null',       desc: 'Beim Roulette auf die 0 gesetzt – und gewonnen.' },
    { id: 'bjNatural',   icon: '🃏', name: 'Blackjack!',            desc: 'Mit den ersten zwei Karten 21 Punkte.' },
    { id: 'bjSplitWin',  icon: '✌️', name: 'Doppelt hält besser',   desc: 'Nach dem Teilen alle Hände gewonnen.' },
    { id: 'scratch1',    icon: '🎟️', name: 'Rubbelfieber',          desc: 'Dein erstes Rubbellos aufgedeckt.' },
    { id: 'scratchTop',  icon: '🤑', name: 'Hauptgewinn!',          desc: 'Beim Rubbellos den 1.000-fachen Gewinn geholt.' },
    { id: 'wheelBonus',  icon: '⭐', name: 'Sternstunde',           desc: 'Am Glücksrad das Bonusrad erreicht.' },
    { id: 'wheelFree',   icon: '🎁', name: 'Geschenkt!',            desc: 'Den täglichen Gratis-Dreh am Glücksrad genutzt.' },
    { id: 'plinkoEdge',  icon: '🪙', name: 'Randlage',              desc: 'Beim Münzfall ein Fach mit mindestens ×24 getroffen.' },
    { id: 'minesAll',    icon: '🏝️', name: 'Schatzkönig',           desc: 'Auf der Schatzinsel alle Schätze gefunden (mit mind. 3 Totenköpfen).' },
    { id: 'crash10',     icon: '💣', name: 'Kanonier',              desc: 'Bei der Kanonenkugel ab ×10 abkassiert.' },
    { id: 'raceOutsider', icon: '⛵', name: 'Außenseiter-Glück',    desc: 'Beim Schiffsrennen auf einen Außenseiter (ab ×6) gesetzt und gewonnen.' },
    { id: 'vsFree',      icon: '🎉', name: 'Freispiel-Fieber',      desc: 'An einem Video-Slot Freispiele ausgelöst.' },
    { id: 'vsBonus',     icon: '🧰', name: 'Kistenknacker',         desc: 'An einem Video-Slot die Bonusrunde erreicht.' },
    { id: 'vsBigWin',    icon: '🎰', name: 'Walzenkönig',           desc: 'An einem Video-Slot mit einer Drehung das 100-fache gewonnen.' },
    { id: 'highRoller',  icon: '💸', name: 'High Roller',           desc: '1 Million Dublonen Gewinn in einer Runde.', check: s => s.casino.biggestWin >= 1e6 },
    { id: 'broke',       icon: '🫙', name: 'Pleite',                desc: 'Im Casino alles verspielt. Passiert den Besten.' },
    { id: 'vipSilver',   icon: '🥈', name: 'Silber-Mitglied',       desc: 'Die Silber-Karte gekauft.' },
    { id: 'vipGold',     icon: '🥇', name: 'Gold-Mitglied',         desc: 'Die Gold-Karte gekauft.' },
    { id: 'vipDiamond',  icon: '💎', name: 'Diamant-Mitglied',      desc: 'Die Diamant-Karte gekauft.' },
    { id: 'vipPearl',    icon: '🖤', name: 'Schwarze Perle',        desc: 'Die Karte der Schwarzen Perle gekauft.' },
    { id: 'vipEmperor',  icon: '👑', name: 'Kaiserlich',            desc: 'Die Kaiserkrone gekauft – höher geht es nicht.' },
    // Poker
    { id: 'pokerWin',    icon: '♠️', name: 'Pokerkönig',            desc: 'Ein Turnier gegen die Computer-Gegner gewonnen.' },
    { id: 'pokerTurbo',  icon: '⚡', name: 'Turbo-Hai',             desc: 'Ein Turbo-Turnier gegen die Computer-Gegner gewonnen.' },
    { id: 'pokerBlitz',  icon: '⏱️', name: 'Blitzgescheit',         desc: 'Ein Blitz-Turnier gegen die Computer-Gegner gewonnen.' },
    { id: 'pokerThrone', icon: '🏰', name: 'Herrscher des Throns',  desc: 'Ein Turnier am Thron des Kaisers gewonnen.' },
    { id: 'pokerRoyal',  icon: '🤴', name: 'Royal Flush',           desc: 'Beim Showdown einen Royal Flush gezeigt.' },
    { id: 'pokerMpPlay', icon: '👥', name: 'Unter Freunden',        desc: 'Ein Poker-Turnier mit Freunden gespielt.' },
    { id: 'pokerMpWin',  icon: '🏅', name: 'Champion der Runde',    desc: 'Ein Poker-Turnier mit Freunden gewonnen.' },
    // Große Fahrt
    { id: 'prestige1',   icon: '⛵', name: 'Auf große Fahrt',       desc: 'Zum ersten Mal auf große Fahrt gegangen.', check: s => s.prestige.journeys >= 1 },
    { id: 'prestige10',  icon: '🗺️', name: 'Seebär',                desc: '10 Schatzkarten gesammelt.',               check: s => s.prestige.points >= 10 },
  ];
  const byId = Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a]));

  let renderedCount = -1;

  function has(id) {
    return GK.state.achievements.includes(id);
  }

  GK.unlockAchievement = function (id) {
    const a = byId[id];
    if (!a || has(id)) return;
    GK.state.achievements.push(id);
    GK.sound.play('achievement');
    GK.notify(`<span class="notify-icon">${a.icon}</span><span><b>Erfolg freigeschaltet: ${a.name}</b><br>${a.desc} · +1 % Einkommen</span>`);
    GK.save();
  };

  // Regelmäßig aufgerufen: Bedingungen prüfen
  function check() {
    ACHIEVEMENTS.forEach(a => {
      if (a.check && !has(a.id) && a.check(GK.state)) GK.unlockAchievement(a.id);
    });
  }

  function render() {
    const count = GK.state.achievements.length;
    if (count === renderedCount) return;
    renderedCount = count;
    document.getElementById('achievement-count').textContent = `(${count}/${ACHIEVEMENTS.length})`;
    document.getElementById('achievement-grid').innerHTML = ACHIEVEMENTS.map(a => {
      const unlocked = has(a.id);
      return `<div class="achievement ${unlocked ? 'unlocked' : 'locked'}" title="${a.desc}">
        <div class="achievement-icon">${unlocked ? a.icon : '🔒'}</div>
        <div class="achievement-name">${a.name}</div>
        <div class="achievement-desc">${a.desc}</div>
      </div>`;
    }).join('');
  }

  // Nach Import/Zurücksetzen neu zeichnen
  function refresh() {
    renderedCount = -1;
    render();
  }

  GK.achievements = { ACHIEVEMENTS, check, render, refresh, total: ACHIEVEMENTS.length };
})();
