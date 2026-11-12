// Klicker-Teil: Gebäude (passives Einkommen), Upgrades und die große Münze.
// Klicks können eine Combo aufbauen (schnell hintereinander) und kritisch treffen.
window.GK = window.GK || {};

// Sprache: Ersatz, falls js/i18n.js (noch) nicht geladen ist – gibt den deutschen Text zurück.
GK.t = GK.t || function (s, v) { s = String(s); return v ? s.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m)) : s; };
GK.i18n = GK.i18n || { add() {}, addHtml() {}, apply() {}, set() {}, lang: 'de' };

GK.i18n.add({
  // Gebäude (Name + Beschreibung)
  'Hilfsfinger': 'Helper Finger',
  'Klickt ab und zu für dich.': 'Clicks for you now and then.',
  'Sparschwein': 'Piggy Bank',
  'Jeder Cent zählt.': 'Every cent counts.',
  'Limonadenstand': 'Lemonade Stand',
  'Sauer macht reich.': 'Sour makes you rich.',
  'Kiosk': 'Kiosk',
  'Rubbellose und Kaugummis.': 'Scratch cards and chewing gum.',
  'Pfandhaus': 'Pawnshop',
  'Kauft alles, was glänzt.': 'Buys anything that glitters.',
  'Bank': 'Bank',
  'Zinsen auf Spielgeld.': 'Interest on play money.',
  'Goldmine': 'Gold Mine',
  'Tief unten glitzert es.': 'Deep down it glitters.',
  'Münzprägerei': 'Mint',
  'Prägt Dublonen am laufenden Band.': 'Stamps out doubloons nonstop.',
  'Handelsschiff': 'Merchant Ship',
  'Bringt Gold aus fernen Häfen.': 'Brings gold from distant ports.',
  'Alchemistenlabor': "Alchemist's Lab",
  'Macht aus Blei pures Gold.': 'Turns lead into pure gold.',
  'Piratenflotte': 'Pirate Fleet',
  'Kapert Schatzschiffe auf allen Meeren.': 'Seizes treasure ships on every sea.',
  'Schatzinsel': 'Treasure Island',
  'X markiert die Stelle – jeden Tag aufs Neue.': 'X marks the spot – every day anew.',
  'Drachenhort': 'Dragon Hoard',
  'Ein Drache brütet auf Bergen von Gold.': 'A dragon broods on mountains of gold.',
  'Zeitmaschine': 'Time Machine',
  'Holt Dublonen aus der Zukunft.': 'Fetches doubloons from the future.',
  'Glücksfabrik': 'Luck Factory',
  'Stellt Glück am Fließband her.': 'Produces luck on an assembly line.',
  'Sternenportal': 'Star Portal',
  'Dublonen aus anderen Welten.': 'Doubloons from other worlds.',
  'Poseidons Tempel': "Poseidon's Temple",
  'Der Meeresgott zahlt Tribut.': 'The sea god pays tribute.',
  'Geisterwerft': 'Ghost Shipyard',
  'Untote Seeleute arbeiten ohne Pause.': 'Undead sailors work without pause.',
  'Atlantis': 'Atlantis',
  'Die versunkene Stadt voller Gold.': 'The sunken city full of gold.',
  'Lava-Schmiede': 'Lava Forge',
  'Gießt Dublonen aus flüssiger Lava.': 'Casts doubloons from molten lava.',
  'Schwarzes Loch': 'Black Hole',
  'Saugt Gold aus dem ganzen Universum.': 'Sucks gold from the entire universe.',
  'Paralleluniversum': 'Parallel Universe',
  'Ein zweites Du verdient mit.': 'A second you earns alongside you.',
  'Galaxienbank': 'Galaxy Bank',
  'Verwaltet die Schätze ganzer Galaxien.': 'Manages the treasures of whole galaxies.',
  'Dublonen-Urknall': 'Doubloon Big Bang',
  'Erschafft ein Universum nur aus Dublonen.': 'Creates a universe made only of doubloons.',
  // Klick-Upgrades (Name + Beschreibung)
  'Starker Finger': 'Strong Finger',
  'Klickkraft ×2': 'Click power ×2',
  'Goldener Finger': 'Golden Finger',
  'Diamantfinger': 'Diamond Finger',
  'Magische Hand': 'Magic Hand',
  'Goldene Faust': 'Golden Fist',
  'Klickkraft ×3 – auch der Anteil vom Einkommen': 'Click power ×3 – including the share from income',
  'Hand des Midas': 'Hand of Midas',
  'Sternenhand': 'Star Hand',
  'Hand der Götter': 'Hand of the Gods',
  'Klickkraft ×4 – auch der Anteil vom Einkommen': 'Click power ×4 – including the share from income',
  'Klick-Investment': 'Click Investment',
  'Jeder Klick bringt zusätzlich 1 % deines Einkommens pro Sekunde': 'Each click also gives 1% of your income per second',
  'Klick-Dividende': 'Click Dividend',
  'Jeder Klick bringt zusätzlich 2 % deines Einkommens pro Sekunde': 'Each click also gives 2% of your income per second',
  'Klick-Imperium': 'Click Empire',
  'Jeder Klick bringt zusätzlich 3 % deines Einkommens pro Sekunde': 'Each click also gives 3% of your income per second',
  'Klick-Konzern': 'Click Corporation',
  'Jeder Klick bringt zusätzlich 4 % deines Einkommens pro Sekunde': 'Each click also gives 4% of your income per second',
  'Klick-Dynastie': 'Click Dynasty',
  'Jeder Klick bringt zusätzlich 5 % deines Einkommens pro Sekunde': 'Each click also gives 5% of your income per second',
  // Kritische Treffer
  'Glückstreffer': 'Lucky Hit',
  '3 % Chance auf einen kritischen Klick (×10)': '3% chance of a critical click (×10)',
  'Adlerauge': 'Eagle Eye',
  '+4 % Chance auf kritische Klicks': '+4% chance of critical clicks',
  'Volltreffer-Hand': 'Bullseye Hand',
  'Kritische Klicks bringen ×25 statt ×10': 'Critical clicks give ×25 instead of ×10',
  'Glückspilz': 'Lucky Devil',
  '+5 % Chance auf kritische Klicks': '+5% chance of critical clicks',
  'Blitzschlag': 'Lightning Strike',
  'Kritische Klicks bringen ×50': 'Critical clicks give ×50',
  // Combo
  'Combo-Meister': 'Combo Master',
  'Combo bis +50 % statt +25 %': 'Combo up to +50% instead of +25%',
  'Feuerhände': 'Fire Hands',
  'Combo bis +100 % (doppelte Klickkraft)': 'Combo up to +100% (double click power)',
  'Vulkanhände': 'Volcano Hands',
  'Combo bis +200 % (dreifache Klickkraft)': 'Combo up to +200% (triple click power)',
  // Upgrades für alle Gebäude
  'Handelsvertrag': 'Trade Agreement',
  'Alle Gebäude: Einkommen +10 %': 'All buildings: income +10%',
  'Goldener Kompass': 'Golden Compass',
  'Alle Gebäude: Einkommen +15 %': 'All buildings: income +15%',
  'Kaiserliche Flotte': 'Imperial Fleet',
  'Alle Gebäude: Einkommen +20 %': 'All buildings: income +20%',
  'Goldenes Zeitalter': 'Golden Age',
  'Alle Gebäude: Einkommen +25 %': 'All buildings: income +25%',
  'Ewiger Reichtum': 'Eternal Wealth',
  'Alle Gebäude: Einkommen +30 %': 'All buildings: income +30%',
  'Herrschaft der Meere': 'Rule of the Seas',
  'Alle Gebäude: Einkommen +35 %': 'All buildings: income +35%',
  'Unendlicher Reichtum': 'Infinite Wealth',
  'Alle Gebäude: Einkommen +40 %': 'All buildings: income +40%',
  // Gebäude-Stufen
  'Bronze': 'Bronze',
  'Silber': 'Silver',
  'Gold': 'Gold',
  'Platin': 'Platinum',
  'Diamant': 'Diamond',
  'Legenden': 'Legendary',
  'Mythos': 'Mythic',
  'Sternen': 'Cosmic',
  'Götter': 'Divine',
  // Zusammengesetzte Vorlagen (Gebäude-Stufen und Synergien)
  '{tier}-{name}': '{tier} {name}',
  '{source} & {name}': '{source} & {name}',
  '{name}: Einkommen ×{value}': '{name}: income ×{value}',
  '{name}: +1 % Einkommen pro {source}': '{name}: +1% income per {source}',
  // Klicken, Combo, Meilensteine
  'KRITISCH! +{amount}': 'CRITICAL! +{amount}',
  '🔥 COMBO ×{mult}!': '🔥 COMBO ×{mult}!',
  '🏗️ {n}× {name}!': '🏗️ {n}× {name}!',
  'Meilenstein: {n}× {name}!': 'Milestone: {n}× {name}!',
  'Neues Upgrade verfügbar: {upg}': 'New upgrade available: {upg}',
  '🤝 Synergie!': '🤝 Synergy!',
  '⚡ ×{value}!': '⚡ ×{value}!',
  'Combo {n}': 'Combo {n}',
  // Passives Einkommen
  '💰 Passives Einkommen läuft wieder.': '💰 Passive income is running again.',
  '⏸️ Passives Einkommen ausgeschaltet – nur noch Klicks und Casino bringen Dublonen.':
    '⏸️ Passive income switched off – only clicks and the casino bring doubloons now.',
  // Gebäude- und Upgrade-Liste
  'Noch unbekannt': 'Still unknown',
  '+{x}/s pro Stück': '+{x}/s each',
  ' · gesamt {x}/s': ' · total {x}/s',
  ' · pausiert': ' · paused',
  'Noch {n} bis zum {tier}-Upgrade (×{value})': 'Still {n} to the {tier} upgrade (×{value})',
  'Alle Stufen freigeschaltet': 'All tiers unlocked',
  'Preis: {cost} Dublonen': 'Price: {cost} doubloons',
  '▲ Weniger anzeigen': '▲ Show less',
  '▼ {n} weitere {word} anzeigen': '▼ Show {n} more {word}',
  'Upgrade': 'upgrade',
  'Upgrades': 'upgrades',
  '+{x} pro Klick': '+{x} per click',
});

(function () {
  const COST_GROWTH = 1.15;
  const COMBO_WINDOW = 700;      // ms: so schnell muss der nächste Klick kommen, damit die Combo weiterläuft
  const BASE_COMBO_CAP = 25;     // ohne Upgrades höchstens +25 % durch die Combo
  const BASE_CRIT_MULT = 10;     // kritischer Klick = ×10
  const COMBO_MILESTONES = [25, 50, 100, 200];
  const BUILDING_MILESTONES = [10, 25, 50, 100, 150, 200, 250, 300];
  const UPGRADES_SHOWN = 8;      // so viele Upgrades sind sichtbar, der Rest ist eingeklappt

  // Eigenes Symbol (js/icons.js); ohne Symbolnamen bleibt das Emoji, in den Tests ohne Browser gibt es keins
  const ic = (name, emoji) => (GK.icon && name ? GK.icon(name) : emoji || '');

  const BUILDINGS = [
    { id: 'finger',    icon: '👆', ic: 'tap', name: 'Hilfsfinger',      baseCost: 15,     baseCps: 0.1,   desc: 'Klickt ab und zu für dich.' },
    { id: 'piggy',     icon: '🐷', ic: 'piggy', name: 'Sparschwein',      baseCost: 100,    baseCps: 1,     desc: 'Jeder Cent zählt.' },
    { id: 'lemonade',  icon: '🍋', ic: 'lemon', name: 'Limonadenstand',   baseCost: 1100,   baseCps: 8,     desc: 'Sauer macht reich.' },
    { id: 'kiosk',     icon: '🏪', ic: 'kiosk', name: 'Kiosk',            baseCost: 12000,  baseCps: 47,    desc: 'Rubbellose und Kaugummis.' },
    { id: 'pawnshop',  icon: '💍', ic: 'ring', name: 'Pfandhaus',        baseCost: 130000, baseCps: 260,   desc: 'Kauft alles, was glänzt.' },
    { id: 'bank',      icon: '🏦', ic: 'bank', name: 'Bank',             baseCost: 1.4e6,  baseCps: 1400,  desc: 'Zinsen auf Spielgeld.' },
    { id: 'goldmine',  icon: '⛏️', ic: 'pickaxe', name: 'Goldmine',         baseCost: 2e7,    baseCps: 7800,  desc: 'Tief unten glitzert es.' },
    { id: 'mint',      icon: '🏛️', ic: 'coins', name: 'Münzprägerei',     baseCost: 3.3e8,  baseCps: 44000, desc: 'Prägt Dublonen am laufenden Band.' },
    { id: 'ship',      icon: '🚢', ic: 'ship', name: 'Handelsschiff',    baseCost: 5.1e9,  baseCps: 2.6e5, desc: 'Bringt Gold aus fernen Häfen.' },
    { id: 'alchemy',   icon: '🧪', ic: 'flask', name: 'Alchemistenlabor', baseCost: 7.5e10, baseCps: 1.6e6, desc: 'Macht aus Blei pures Gold.' },
    { id: 'fleet',     icon: '🏴‍☠️', ic: 'skull', name: 'Piratenflotte',   baseCost: 1e12,   baseCps: 1e7,   desc: 'Kapert Schatzschiffe auf allen Meeren.' },
    { id: 'island',    icon: '🏝️', ic: 'island', name: 'Schatzinsel',      baseCost: 1.4e13, baseCps: 6.5e7, desc: 'X markiert die Stelle – jeden Tag aufs Neue.' },
    { id: 'dragon',    icon: '🐉', ic: 'dragon', name: 'Drachenhort',      baseCost: 1.7e14, baseCps: 4.3e8, desc: 'Ein Drache brütet auf Bergen von Gold.' },
    { id: 'timemachine', icon: '🔮', ic: 'hourglass', name: 'Zeitmaschine',   baseCost: 2.1e15, baseCps: 2.9e9, desc: 'Holt Dublonen aus der Zukunft.' },
    { id: 'luck',      icon: '🍀', ic: 'clover', name: 'Glücksfabrik',     baseCost: 2.6e16, baseCps: 2.1e10, desc: 'Stellt Glück am Fließband her.' },
    { id: 'portal',    icon: '🌌', ic: 'portal', name: 'Sternenportal',    baseCost: 3.1e17, baseCps: 1.5e11, desc: 'Dublonen aus anderen Welten.' },
    // Nach dem Sternenportal: für alle, die das Spiel schon „durchgespielt“ haben
    { id: 'poseidon',  icon: '🔱', ic: 'trident', name: 'Poseidons Tempel', baseCost: 3.7e18, baseCps: 1.05e12, desc: 'Der Meeresgott zahlt Tribut.' },
    { id: 'ghostyard', icon: '👻', ic: 'ghost', name: 'Geisterwerft',     baseCost: 4.4e19, baseCps: 7.4e12, desc: 'Untote Seeleute arbeiten ohne Pause.' },
    { id: 'atlantis',  icon: '🏛️', ic: 'atlantis', name: 'Atlantis',         baseCost: 5.3e20, baseCps: 5.2e13, desc: 'Die versunkene Stadt voller Gold.' },
    { id: 'lavaforge', icon: '🌋', ic: 'volcano', name: 'Lava-Schmiede',    baseCost: 6.4e21, baseCps: 3.6e14, desc: 'Gießt Dublonen aus flüssiger Lava.' },
    { id: 'blackhole', icon: '🕳️', ic: 'blackhole', name: 'Schwarzes Loch',   baseCost: 7.7e22, baseCps: 2.5e15, desc: 'Saugt Gold aus dem ganzen Universum.' },
    { id: 'parallel',  icon: '🪞', ic: 'mirror', name: 'Paralleluniversum', baseCost: 9.2e23, baseCps: 1.8e16, desc: 'Ein zweites Du verdient mit.' },
    { id: 'galaxy',    icon: '💫', ic: 'galaxy', name: 'Galaxienbank',     baseCost: 1.1e25, baseCps: 1.25e17, desc: 'Verwaltet die Schätze ganzer Galaxien.' },
    { id: 'bigbang',   icon: '💥', ic: 'burst', name: 'Dublonen-Urknall', baseCost: 1.3e26, baseCps: 8.8e17, desc: 'Erschafft ein Universum nur aus Dublonen.' },
  ];

  // Upgrades für Klicks. rarity bestimmt Farbe und Effekt der Kachel.
  const UPGRADES = [
    { id: 'click1', icon: '💪', ic: 'fist', name: 'Starker Finger',  cost: 100,  type: 'clickMult', value: 2, rarity: 'click', desc: 'Klickkraft ×2',
      unlocked: s => s.totalClicks >= 10 },
    { id: 'click2', icon: '🥇', ic: 'tap', name: 'Goldener Finger', cost: 1000, type: 'clickMult', value: 2, rarity: 'click', desc: 'Klickkraft ×2',
      unlocked: s => has('click1') && s.totalClicks >= 100 },
    { id: 'click3', icon: '💎', ic: 'gem', name: 'Diamantfinger',   cost: 50000, type: 'clickMult', value: 2, rarity: 'click', desc: 'Klickkraft ×2',
      unlocked: s => has('click2') && s.totalClicks >= 500 },
    { id: 'click4', icon: '✨', ic: 'sparkle', name: 'Magische Hand',   cost: 5e6,  type: 'clickMult', value: 2, rarity: 'click', desc: 'Klickkraft ×2',
      unlocked: s => has('click3') && s.totalClicks >= 1500 },
    { id: 'click5', icon: '👊', ic: 'fist', name: 'Goldene Faust',   cost: 5e8,  type: 'clickMult', value: 3, all: true, rarity: 'click', desc: 'Klickkraft ×3 – auch der Anteil vom Einkommen',
      unlocked: s => has('click4') && s.totalClicks >= 3000 },
    { id: 'click6', icon: '🤴', ic: 'crown', name: 'Hand des Midas',  cost: 5e10, type: 'clickMult', value: 3, all: true, rarity: 'click', desc: 'Klickkraft ×3 – auch der Anteil vom Einkommen',
      unlocked: s => has('click5') && s.totalClicks >= 6000 },
    { id: 'click7', icon: '🌟', ic: 'star', name: 'Sternenhand',     cost: 5e12, type: 'clickMult', value: 3, all: true, rarity: 'click', desc: 'Klickkraft ×3 – auch der Anteil vom Einkommen',
      unlocked: s => has('click6') && s.totalClicks >= 10000 },
    { id: 'click8', icon: '🪐', ic: 'planet', name: 'Hand der Götter', cost: 5e14, type: 'clickMult', value: 4, all: true, rarity: 'click', desc: 'Klickkraft ×4 – auch der Anteil vom Einkommen',
      unlocked: s => has('click7') && s.totalClicks >= 20000 },
    { id: 'cpsClick1', icon: '📈', ic: 'trend', name: 'Klick-Investment', cost: 25000, type: 'clickCps', value: 0.01, rarity: 'click',
      desc: 'Jeder Klick bringt zusätzlich 1 % deines Einkommens pro Sekunde',
      unlocked: () => getCps() >= 20 },
    { id: 'cpsClick2', icon: '📊', ic: 'chart', name: 'Klick-Dividende', cost: 2.5e6, type: 'clickCps', value: 0.02, rarity: 'click',
      desc: 'Jeder Klick bringt zusätzlich 2 % deines Einkommens pro Sekunde',
      unlocked: () => has('cpsClick1') && getCps() >= 1000 },
    { id: 'cpsClick3', icon: '💹', ic: 'trend', name: 'Klick-Imperium', cost: 2.5e8, type: 'clickCps', value: 0.03, rarity: 'click',
      desc: 'Jeder Klick bringt zusätzlich 3 % deines Einkommens pro Sekunde',
      unlocked: () => has('cpsClick2') && getCps() >= 100000 },
    { id: 'cpsClick4', icon: '🏦', ic: 'bank', name: 'Klick-Konzern', cost: 2.5e10, type: 'clickCps', value: 0.04, rarity: 'click',
      desc: 'Jeder Klick bringt zusätzlich 4 % deines Einkommens pro Sekunde',
      unlocked: () => has('cpsClick3') && getCps() >= 1e7 },
    { id: 'cpsClick5', icon: '👑', ic: 'crown', name: 'Klick-Dynastie', cost: 2.5e12, type: 'clickCps', value: 0.05, rarity: 'click',
      desc: 'Jeder Klick bringt zusätzlich 5 % deines Einkommens pro Sekunde',
      unlocked: () => has('cpsClick4') && getCps() >= 1e9 },
    // Kritische Treffer
    { id: 'crit1', icon: '🎯', ic: 'target', name: 'Glückstreffer', cost: 5000, type: 'critChance', value: 0.03, rarity: 'crit',
      desc: '3 % Chance auf einen kritischen Klick (×10)',
      unlocked: s => s.totalClicks >= 250 },
    { id: 'crit2', icon: '🦅', ic: 'eye', name: 'Adlerauge', cost: 5e5, type: 'critChance', value: 0.04, rarity: 'crit',
      desc: '+4 % Chance auf kritische Klicks',
      unlocked: s => has('crit1') && s.totalClicks >= 1000 },
    { id: 'crit3', icon: '💥', ic: 'burst', name: 'Volltreffer-Hand', cost: 5e7, type: 'critMult', value: 25, rarity: 'crit',
      desc: 'Kritische Klicks bringen ×25 statt ×10',
      unlocked: s => has('crit2') && s.totalClicks >= 2500 },
    { id: 'crit4', icon: '🍀', ic: 'clover', name: 'Glückspilz', cost: 5e9, type: 'critChance', value: 0.05, rarity: 'crit',
      desc: '+5 % Chance auf kritische Klicks',
      unlocked: s => has('crit3') && s.totalClicks >= 5000 },
    { id: 'crit5', icon: '⚡', ic: 'bolt', name: 'Blitzschlag', cost: 5e11, type: 'critMult', value: 50, rarity: 'crit',
      desc: 'Kritische Klicks bringen ×50',
      unlocked: s => has('crit4') && s.totalClicks >= 8000 },
    // Combo
    { id: 'combo1', icon: '🔥', ic: 'flame', name: 'Combo-Meister', cost: 2000, type: 'comboCap', value: 50, rarity: 'combo',
      desc: 'Combo bis +50 % statt +25 %',
      unlocked: s => s.totalClicks >= 150 },
    { id: 'combo2', icon: '☄️', ic: 'comet', name: 'Feuerhände', cost: 2e6, type: 'comboCap', value: 100, rarity: 'combo',
      desc: 'Combo bis +100 % (doppelte Klickkraft)',
      unlocked: s => has('combo1') && s.totalClicks >= 1200 },
    { id: 'combo3', icon: '🌋', ic: 'volcano', name: 'Vulkanhände', cost: 2e9, type: 'comboCap', value: 200, rarity: 'combo',
      desc: 'Combo bis +200 % (dreifache Klickkraft)',
      unlocked: s => has('combo2') && s.totalClicks >= 4000 },
    // Für alle Gebäude zusammen, je nachdem, wie viele man insgesamt besitzt
    { id: 'global1', icon: '📜', ic: 'scroll', name: 'Handelsvertrag', cost: 2e5, type: 'globalMult', value: 1.1, rarity: 'empire',
      desc: 'Alle Gebäude: Einkommen +10 %', unlocked: () => totalBuildings() >= 50 },
    { id: 'global2', icon: '🧭', ic: 'compass', name: 'Goldener Kompass', cost: 1e8, type: 'globalMult', value: 1.15, rarity: 'empire',
      desc: 'Alle Gebäude: Einkommen +15 %', unlocked: () => totalBuildings() >= 150 },
    { id: 'global3', icon: '⚓', ic: 'anchor', name: 'Kaiserliche Flotte', cost: 5e10, type: 'globalMult', value: 1.2, rarity: 'empire',
      desc: 'Alle Gebäude: Einkommen +20 %', unlocked: () => totalBuildings() >= 300 },
    { id: 'global4', icon: '🏛️', ic: 'temple', name: 'Goldenes Zeitalter', cost: 5e13, type: 'globalMult', value: 1.25, rarity: 'empire',
      desc: 'Alle Gebäude: Einkommen +25 %', unlocked: () => totalBuildings() >= 500 },
    { id: 'global5', icon: '🌠', ic: 'comet', name: 'Ewiger Reichtum', cost: 5e16, type: 'globalMult', value: 1.3, rarity: 'empire',
      desc: 'Alle Gebäude: Einkommen +30 %', unlocked: () => totalBuildings() >= 800 },
    { id: 'global6', icon: '🔱', ic: 'trident', name: 'Herrschaft der Meere', cost: 5e22, type: 'globalMult', value: 1.35, rarity: 'empire',
      desc: 'Alle Gebäude: Einkommen +35 %', unlocked: () => totalBuildings() >= 1200 },
    { id: 'global7', icon: '💥', ic: 'burst', name: 'Unendlicher Reichtum', cost: 5e27, type: 'globalMult', value: 1.4, rarity: 'empire',
      desc: 'Alle Gebäude: Einkommen +40 %', unlocked: () => totalBuildings() >= 1600 },
  ];

  // Pro Gebäude: immer stärkere Upgrades, sobald man genug davon besitzt
  const BUILDING_TIERS = [
    { owned: 1,   costFactor: 10,    name: 'Bronze',  rarity: 'bronze',   value: 2 },
    { owned: 10,  costFactor: 50,    name: 'Silber',  rarity: 'silver',   value: 2 },
    { owned: 25,  costFactor: 500,   name: 'Gold',    rarity: 'gold',     value: 2 },
    { owned: 50,  costFactor: 5000,  name: 'Platin',  rarity: 'platinum', value: 2 },
    { owned: 100, costFactor: 5e5,   name: 'Diamant', rarity: 'diamond',  value: 3 },
    { owned: 150, costFactor: 5e7,   name: 'Legenden', rarity: 'legend',  value: 3 },
    { owned: 200, costFactor: 5e9,   name: 'Mythos',  rarity: 'mythic',   value: 4 },
    { owned: 250, costFactor: 5e11,  name: 'Sternen', rarity: 'cosmic',   value: 4 },
    { owned: 300, costFactor: 5e13,  name: 'Götter',  rarity: 'divine',   value: 5 },
  ];
  BUILDINGS.forEach(b => {
    BUILDING_TIERS.forEach((tier, i) => {
      UPGRADES.push({
        id: `${b.id}-${i + 1}`,
        icon: b.icon,
        ic: b.ic,
        name: `${tier.name}-${b.name}`,
        cost: b.baseCost * tier.costFactor,
        type: 'buildingMult',
        building: b.id,
        value: tier.value,
        rarity: tier.rarity,
        desc: `${b.name}: Einkommen ×${tier.value}`,
        unlocked: () => owned(b.id) >= tier.owned,
      });
    });
  });

  // Synergien: Jedes Gebäude profitiert vom vorherigen (+1 % Einkommen pro Stück)
  BUILDINGS.forEach((b, i) => {
    if (i === 0) return;
    const source = BUILDINGS[i - 1];
    UPGRADES.push({
      id: `syn-${b.id}`,
      icon: '🤝',
      ic: 'handshake',
      name: `${source.name} & ${b.name}`,
      cost: b.baseCost * 200,
      type: 'synergy',
      building: b.id,
      source: source.id,
      value: 0.01,
      rarity: 'synergy',
      desc: `${b.name}: +1 % Einkommen pro ${source.name}`,
      unlocked: () => owned(b.id) >= 15 && owned(source.id) >= 15,
    });
  });

  const upgradeById = Object.fromEntries(UPGRADES.map(u => [u.id, u]));

  let buyAmount = 1;
  let showAllUpgrades = false;
  let lastUpgradeSignature = '';
  const buildingEls = {};
  const combo = { count: 0, last: 0 };

  // ---------- Berechnungen ----------

  function has(upgradeId) {
    return GK.state.upgrades.includes(upgradeId);
  }

  function owned(buildingId) {
    return GK.state.buildings[buildingId] || 0;
  }

  function totalBuildings() {
    return BUILDINGS.reduce((sum, b) => sum + owned(b.id), 0);
  }

  function ownedUpgrades(type) {
    return GK.state.upgrades.map(id => upgradeById[id]).filter(u => u && u.type === type);
  }

  // Preis für `count` Gebäude, wenn man schon `alreadyOwned` besitzt (geometrische Reihe)
  function buildingCost(building, alreadyOwned, count) {
    const first = building.baseCost * Math.pow(COST_GROWTH, alreadyOwned);
    return Math.ceil(first * (Math.pow(COST_GROWTH, count) - 1) / (COST_GROWTH - 1));
  }

  // Was alle eigenen Gebäude zusammen gekostet haben (für die Rangliste „Vermögen mit Gebäuden“)
  function buildingsWorth() {
    return BUILDINGS.reduce((sum, b) => sum + (owned(b.id) ? buildingCost(b, 0, owned(b.id)) : 0), 0);
  }

  function buildingMultiplier(buildingId) {
    let mult = 1;
    for (const id of GK.state.upgrades) {
      const u = upgradeById[id];
      if (!u || u.building !== buildingId) continue;
      if (u.type === 'buildingMult') mult *= u.value;
      if (u.type === 'synergy') mult *= 1 + u.value * owned(u.source);
    }
    return mult;
  }

  // Einkommen ohne Boni aus Schatzkarten, Erfolgen usw.
  function baseCps() {
    return BUILDINGS.reduce((sum, b) => sum + owned(b.id) * buildingBaseCps(b), 0);
  }

  // Upgrades für alle Gebäude zusammen (Handelsvertrag …)
  function globalMultiplier() {
    return ownedUpgrades('globalMult').reduce((m, u) => m * u.value, 1);
  }

  // Einkommen eines Gebäudes mit allen Gebäude-Upgrades, ohne Schatzkarten, Erfolge usw.
  function buildingBaseCps(building) {
    return building.baseCps * buildingMultiplier(building.id) * globalMultiplier();
  }

  // Alle Boni zusammen (dauerhaft × zeitlich begrenzt, z. B. Goldrausch)
  function incomeMult() {
    return GK.progress.permanentMult() * GK.progress.buffMult('income');
  }

  // Einkommen eines einzelnen Gebäudes inklusive aller Boni
  function buildingCps(building) {
    return buildingBaseCps(building) * incomeMult();
  }

  function getCps() {
    return baseCps() * incomeMult();
  }

  // Einkommen nur mit dauerhaften Boni (für Offline-Einnahmen und Erfolge)
  function getCpsPermanent() {
    return baseCps() * GK.progress.permanentMult();
  }

  // Klickkraft ohne Combo und kritische Treffer: Grundwert plus Anteil vom Einkommen (Klick-Investment …).
  // Die frühen „Klickkraft ×2“ vervielfachen nur den Grundwert. Die späten (Goldene Faust, Hand des Midas,
  // Sternenhand, Hand der Götter – „all“) vervielfachen auch den Anteil vom Einkommen: Wenn man sie kaufen
  // kann, macht der Grundwert kaum noch etwas aus, sonst wäre ihr ×3 nicht zu spüren.
  // permanent: ohne zeitlich begrenzte Buffs (Klickfieber, Goldrausch) – für Belohnungen, die sonst mit einem
  // gerade laufenden Buff viel größer ausfielen (Tagesaufgaben, Kraken-Beute, Schatzfund)
  function getClickPower(permanent = false) {
    let mult = 1;
    let allMult = 1;
    let cpsShare = 0;
    for (const id of GK.state.upgrades) {
      const u = upgradeById[id];
      if (!u) continue;
      if (u.type === 'clickMult') {
        mult *= u.value;
        if (u.all) allMult *= u.value;
      }
      if (u.type === 'clickCps') cpsShare += u.value;
    }
    // Trophäen aus Bosskämpfen (js/boss.js) gelten dauerhaft für alles
    const trophies = GK.boss ? GK.boss.clickMult() : 1;
    const cps = permanent ? getCpsPermanent() : getCps();
    return (mult * GK.progress.permanentMult() + cps * cpsShare * allMult) * (permanent ? 1 : GK.progress.buffMult('click')) * trophies;
  }

  const getClickPowerPermanent = () => getClickPower(true);

  // Wie viel mehr pro Klick brächte ein Klick-Upgrade? (Anzeige auf der Kachel)
  function upgradeClickGain(u) {
    if (u.type !== 'clickMult' && u.type !== 'clickCps') return 0;
    const before = getClickPower();
    GK.state.upgrades.push(u.id);
    const after = getClickPower();
    GK.state.upgrades.pop();
    return after - before;
  }

  function critChance() {
    return ownedUpgrades('critChance').reduce((sum, u) => sum + u.value, 0);
  }

  function critMult() {
    return ownedUpgrades('critMult').reduce((m, u) => Math.max(m, u.value), BASE_CRIT_MULT);
  }

  function comboCap() {
    return ownedUpgrades('comboCap').reduce((m, u) => Math.max(m, u.value), BASE_COMBO_CAP);
  }

  // Combo-Bonus in Prozent: +1 % für jeden schnellen Folgeklick, bis zur Obergrenze
  function comboBonus() {
    return Math.min(Math.max(combo.count - 1, 0), comboCap());
  }

  function comboMult() {
    return 1 + comboBonus() / 100;
  }

  function availableUpgrades() {
    return UPGRADES
      .filter(u => !has(u.id) && u.unlocked(GK.state))
      .sort((a, b) => a.cost - b.cost);
  }

  // Wie viel Einkommen pro Sekunde brächte ein Gebäude-Upgrade zusätzlich?
  function upgradeGain(u) {
    if (u.type === 'globalMult') return getCps() * (u.value - 1);
    const b = BUILDINGS.find(x => x.id === u.building);
    if (!b) return 0;
    const current = buildingCps(b) * owned(b.id);
    if (u.type === 'buildingMult') return current * (u.value - 1);
    if (u.type === 'synergy') return current * u.value * owned(u.source);
    return 0;
  }

  // ---------- Aktionen ----------

  // Mehr als 25 Klicks pro Sekunde zählen nicht (schneller tippt niemand – kein Dauerfeuer per Programm)
  const MAX_CLICKS_PER_SECOND = 25;
  const recentClicks = [];

  function click(event) {
    const now = performance.now();
    while (recentClicks.length && now - recentClicks[0] >= 1000) recentClicks.shift();
    if (recentClicks.length >= MAX_CLICKS_PER_SECOND) return;
    recentClicks.push(now);
    const coin = document.getElementById('big-coin');
    const pos = event && event.clientX ? { x: event.clientX, y: event.clientY } : GK.fx.center(coin);
    // Erst alles messen, dann schreiben – sonst muss der Browser pro Tipp mehrmals das Layout berechnen
    const local = layerPos(pos);
    combo.count = now - combo.last <= COMBO_WINDOW ? combo.count + 1 : 1;
    combo.last = now;
    if (combo.count > GK.state.bestCombo) GK.state.bestCombo = combo.count;

    const crit = GK.rng.float() < critChance();
    const amount = getClickPower() * comboMult() * (crit ? critMult() : 1);
    GK.state.totalClicks++;
    GK.earn(amount, 'click');
    GK.daily.track('click', 1);
    GK.daily.track('combo', combo.count);

    showClickRing(local);
    if (crit) {
      GK.state.crits++;
      GK.sound.play('crit');
      bounceCoin(coin, true);
      showFloatingText(local, GK.t('KRITISCH! +{amount}', { amount: GK.formatNumber(amount, true) }), 'crit');
      GK.cosmetics.clickBurst(pos.x, pos.y, { crit: true });
      GK.fx.burst(pos.x, pos.y, { count: 10, kind: 'sparkle', speed: 400 });
    } else {
      GK.sound.play('click');
      bounceCoin(coin, false);
      showFloatingText(local, '+' + GK.formatNumber(amount, true), combo.count >= 25 ? 'hot' : '');
      // Klick-Effekt aus der Schatzkammer (im Klickfieber und bei hoher Combo mehr)
      const fever = GK.progress.buffMult('click') > 1;
      GK.cosmetics.clickBurst(pos.x, pos.y, { hot: fever || combo.count >= 50 });
    }
    if (COMBO_MILESTONES.includes(combo.count - 1) && combo.count - 1 <= comboCap()) {
      GK.sound.play('combo');
      const c = GK.fx.center(coin);
      GK.fx.floatText(c.x, c.y - 30, GK.t('🔥 COMBO ×{mult}!', { mult: formatFactor(comboMult()) }), 'win big');
      GK.fx.burst(c.x, c.y, { count: 12, kind: 'sparkle', speed: 500 });
    }
    renderCombo();
  }

  // Die Münze federt beim Tippen. Mit Web Animations statt CSS-Klassen: Es bleibt keine Klasse hängen
  // (früher blieb nach einem kritischen Treffer die Münze „stecken“), der Browser muss kein Layout
  // erzwingen, und das Schweben (CSS, eigene translate-Eigenschaft) läuft ungestört weiter.
  const COIN_HIT = [
    { transform: 'scale(1)' },
    { transform: 'scale(0.9) rotate(-3deg)', offset: 0.4 },
    { transform: 'scale(1)' },
  ];
  const COIN_CRIT = [
    { transform: 'scale(1)', filter: 'brightness(1)' },
    { transform: 'scale(0.84) rotate(-8deg)', filter: 'brightness(1.6) saturate(1.4)', offset: 0.3 },
    { transform: 'scale(1.08) rotate(5deg)', filter: 'brightness(1.2) saturate(1.1)', offset: 0.6 },
    { transform: 'scale(1)', filter: 'brightness(1)' },
  ];
  const reducedMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  let coinAnimation = null;

  function bounceCoin(coin, crit) {
    if (!coin.animate || GK.state.settings.effects === 'reduced' || reducedMotion.matches) return;
    // Ein laufendes Federn wird abgelöst, damit sich nichts aufstaut
    if (coinAnimation) coinAnimation.cancel();
    coinAnimation = coin.animate(crit ? COIN_CRIT : COIN_HIT, { duration: crit ? 350 : 180, easing: 'ease-out' });
  }

  function buyBuilding(building) {
    const before = owned(building.id);
    const cost = buildingCost(building, before, buyAmount);
    if (!GK.spend(cost)) return;
    GK.state.buildings[building.id] = before + buyAmount;
    GK.daily.track('building', buyAmount);
    GK.save();
    GK.sound.play('buy');
    const el = buildingEls[building.id].root;
    GK.fx.pulse(el, 'bought');
    GK.fx.pulse(buildingEls[building.id].owned, 'count-pop');
    const pos = GK.fx.center(el.querySelector('.building-icon'));
    GK.fx.burst(pos.x, pos.y, { count: 8, kind: 'sparkle', speed: 260 });

    // Meilenstein erreicht? (z. B. 25 Sparschweine)
    const milestone = BUILDING_MILESTONES.filter(m => before < m && before + buyAmount >= m).pop();
    if (milestone) {
      GK.sound.play('milestone');
      GK.fx.burst(pos.x, pos.y, { count: 24, speed: 650, upward: true, spread: 2.6 });
      GK.fx.floatText(pos.x + 60, pos.y - 10, GK.t('🏗️ {n}× {name}!', { n: milestone, name: GK.t(building.name) }), 'win big');
      const tier = BUILDING_TIERS.find(t => t.owned === milestone);
      GK.notify(`<span class="notify-icon">${ic(building.ic, building.icon)}</span><span><b>${GK.t('Meilenstein: {n}× {name}!', { n: milestone, name: GK.t(building.name) })}</b>` +
        `${tier ? `<br>${GK.t('Neues Upgrade verfügbar: {upg}', { upg: GK.t('{tier}-{name}', { tier: GK.t(tier.name), name: GK.t(building.name) }) })}` : ''}</span>`, 4000);
    }
    render();
  }

  function buyUpgrade(upgrade, el) {
    if (has(upgrade.id) || !GK.spend(upgrade.cost)) return;
    GK.state.upgrades.push(upgrade.id);
    GK.daily.track('upgrade', 1);
    GK.save();
    const rare = ['diamond', 'legend', 'mythic', 'cosmic', 'divine', 'empire'].includes(upgrade.rarity);
    GK.sound.play(rare ? 'powerup' : 'upgrade');
    if (el) {
      const pos = GK.fx.center(el);
      GK.fx.burst(pos.x, pos.y, { count: rare ? 30 : 14, kind: 'sparkle', speed: rare ? 520 : 320 });
      if (rare) GK.fx.burst(pos.x, pos.y, { count: 20, speed: 700, upward: true });
    }
    // Das betroffene Gebäude leuchtet auf
    const target = upgrade.building && buildingEls[upgrade.building];
    if (target) {
      GK.fx.pulse(target.root, 'powered');
      const p = GK.fx.center(target.icon);
      const label = upgrade.type === 'synergy' ? GK.t('🤝 Synergie!') : GK.t('⚡ ×{value}!', { value: upgrade.value });
      GK.fx.floatText(p.x + 40, p.y, label, 'win big');
    } else {
      const c = GK.fx.center(document.getElementById('big-coin'));
      GK.fx.floatText(c.x, c.y - 60, `${upgrade.icon} ${upgradeName(upgrade)}!`, 'win big');
      // Upgrades für alle Gebäude: alle leuchten auf
      if (upgrade.type === 'globalMult') {
        Object.values(buildingEls).forEach(b => { if (!b.root.hidden) GK.fx.pulse(b.root, 'powered'); });
      }
    }
    lastUpgradeSignature = '';
    render();
  }

  // Passives Einkommen läuft (kann unter den Gebäuden ausgeschaltet werden)
  function passiveActive() {
    return !GK.state.passiveOff;
  }

  function setPassive(on) {
    GK.state.passiveOff = !on;
    GK.save();
    GK.sound.play(on ? 'upgrade' : 'click');
    GK.toast(on ? GK.t('💰 Passives Einkommen läuft wieder.') : GK.t('⏸️ Passives Einkommen ausgeschaltet – nur noch Klicks und Casino bringen Dublonen.'));
    render();
  }

  function tick(seconds) {
    if (!passiveActive()) return;
    const income = getCps() * seconds;
    if (income > 0) GK.earn(income, 'passive');
  }

  // ---------- Darstellung ----------

  // Einmal angelegt: toLocaleString mit Optionen baut sonst bei jedem Aufruf ein neues Format (langsam)
  const factorFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });
  function formatFactor(f) {
    return factorFormat.format(f);
  }

  function layerPos(pos) {
    const rect = document.getElementById('float-layer').getBoundingClientRect();
    return { x: pos.x - rect.left, y: pos.y - rect.top };
  }

  // p: Position innerhalb der Ebene über der Münze (siehe layerPos)
  function showFloatingText(p, text, cls) {
    const layer = document.getElementById('float-layer');
    const el = document.createElement('div');
    el.className = 'float-text ' + (cls || '');
    el.textContent = text;
    el.style.left = p.x + 'px';
    el.style.top = p.y + 'px';
    layer.appendChild(el);
    setTimeout(() => el.remove(), cls === 'crit' ? 1300 : 1000);
  }

  // Ring, der sich von der Tipp-Stelle ausbreitet
  function showClickRing(p) {
    if (GK.state.settings.effects === 'reduced') return;
    const layer = document.getElementById('float-layer');
    const el = document.createElement('div');
    el.className = 'click-ring';
    el.style.left = p.x + 'px';
    el.style.top = p.y + 'px';
    layer.appendChild(el);
    setTimeout(() => el.remove(), 500);
  }

  function renderCombo() {
    const el = document.getElementById('combo-meter');
    if (!el) return;
    const active = combo.count >= 3 && performance.now() - combo.last <= COMBO_WINDOW + 300;
    el.classList.toggle('active', active);
    if (!active) {
      if (performance.now() - combo.last > COMBO_WINDOW + 300) combo.count = 0;
      return;
    }
    const cap = comboCap();
    GK.setHTML(el.querySelector('.combo-count'), `${ic('flame')} ${GK.t('Combo {n}', { n: combo.count })}`);
    GK.setText(el.querySelector('.combo-mult'), `×${formatFactor(comboMult())}`);
    const width = (comboBonus() / cap * 100) + '%';
    const fill = el.querySelector('.combo-fill');
    if (fill.style.width !== width) fill.style.width = width;
    el.classList.toggle('maxed', comboBonus() >= cap);
  }

  function buildBuildingList() {
    const list = document.getElementById('building-list');
    list.innerHTML = '';
    BUILDINGS.forEach(b => {
      const el = document.createElement('button');
      el.className = 'building';
      el.innerHTML = `
        <span class="building-icon">${ic(b.ic)}</span>
        <span class="building-info">
          <span class="building-name">${b.name} <span class="building-stars"></span></span>
          <span class="building-desc">${b.desc}</span>
          <span class="building-meta"></span>
          <span class="building-progress"><span class="building-progress-fill"></span></span>
          <span class="building-next"></span>
        </span>
        <span class="building-side">
          <span class="building-cost"></span>
          <span class="building-owned"></span>
        </span>`;
      el.addEventListener('click', () => buyBuilding(b));
      list.appendChild(el);
      buildingEls[b.id] = {
        root: el,
        cost: el.querySelector('.building-cost'),
        owned: el.querySelector('.building-owned'),
        meta: el.querySelector('.building-meta'),
        name: el.querySelector('.building-name'),
        desc: el.querySelector('.building-desc'),
        icon: el.querySelector('.building-icon'),
        stars: el.querySelector('.building-stars'),
        progress: el.querySelector('.building-progress'),
        fill: el.querySelector('.building-progress-fill'),
        next: el.querySelector('.building-next'),
      };
    });
  }

  function renderBuildings() {
    // Sichtbar: alle gekauften bzw. fast bezahlbaren Gebäude, plus eins als „???“-Vorschau
    let lastRevealed = 0;
    BUILDINGS.forEach((b, i) => {
      if (owned(b.id) > 0 || GK.state.totalEarned >= b.baseCost / 2) lastRevealed = i;
    });

    BUILDINGS.forEach((b, i) => {
      const els = buildingEls[b.id];
      const hidden = i > lastRevealed + 1;
      const mystery = i === lastRevealed + 1;
      els.root.hidden = hidden;
      if (hidden) return;

      const count = owned(b.id);
      const cost = buildingCost(b, count, buyAmount);
      els.root.classList.toggle('mystery', mystery);
      els.root.disabled = !GK.canAfford(cost);
      GK.setHTML(els.icon, ic(mystery ? 'question' : b.ic));
      const name = mystery ? '??? ' : GK.t(b.name) + ' ';
      if (els.name.firstChild.data !== name) els.name.firstChild.data = name;
      GK.setText(els.desc, mystery ? GK.t('Noch unbekannt') : GK.t(b.desc));
      GK.setHTML(els.cost, GK.COIN + ' ' + GK.formatNumber(cost));
      GK.setText(els.owned, count || '');
      GK.setText(els.meta, mystery
        ? ''
        : GK.t('+{x}/s pro Stück', { x: GK.formatNumber(buildingCps(b), true) }) +
          (count ? GK.t(' · gesamt {x}/s', { x: GK.formatNumber(buildingCps(b) * count, true) }) : '') +
          (passiveActive() ? '' : GK.t(' · pausiert')));

      // Sterne für gekaufte Gebäude-Upgrades (Farbe je Stufe)
      const stars = BUILDING_TIERS.map((t, k) => (has(`${b.id}-${k + 1}`) ? `<i class="star rarity-${t.rarity}">★</i>` : '')).join('') +
        (has(`syn-${b.id}`) ? `<i class="star rarity-synergy">${ic('handshake')}</i>` : '');
      if (els.stars.innerHTML !== stars) els.stars.innerHTML = stars;

      // Fortschritt bis zum nächsten Upgrade
      const nextTier = BUILDING_TIERS.find(t => t.owned > count);
      const prevOwned = [...BUILDING_TIERS].reverse().find(t => t.owned <= count);
      els.progress.hidden = mystery || !count || !nextTier;
      els.next.hidden = mystery || !count;
      if (!mystery && count) {
        if (nextTier) {
          const from = prevOwned ? prevOwned.owned : 0;
          const width = ((count - from) / (nextTier.owned - from) * 100) + '%';
          if (els.fill.style.width !== width) els.fill.style.width = width;
          const cls = `building-progress-fill rarity-${nextTier.rarity}`;
          if (els.fill.className !== cls) els.fill.className = cls;
          // Wie beim „Alle Stufen“-Text über GK.setHTML – sonst stimmt dessen Zwischenspeicher nicht mehr
          GK.setHTML(els.next, GK.t('Noch {n} bis zum {tier}-Upgrade (×{value})', { n: nextTier.owned - count, tier: GK.t(nextTier.name), value: nextTier.value }));
        } else {
          GK.setHTML(els.next, `${ic('sparkle')} ${GK.t('Alle Stufen freigeschaltet')}`);
        }
      }
    });
  }

  // Angezeigter Name/Beschreibung eines Upgrades. Die Datentabellen bleiben deutsch; hier wird
  // nur für die Anzeige übersetzt. Gebäude-Stufen und Synergien werden aus den Vorlagen zusammengesetzt.
  function upgradeName(u) {
    if (u.type === 'buildingMult') {
      const b = BUILDINGS.find(x => x.id === u.building);
      const tier = BUILDING_TIERS[Number(u.id.slice(u.id.lastIndexOf('-') + 1)) - 1];
      if (b && tier) return GK.t('{tier}-{name}', { tier: GK.t(tier.name), name: GK.t(b.name) });
    }
    if (u.type === 'synergy') {
      const b = BUILDINGS.find(x => x.id === u.building);
      const src = BUILDINGS.find(x => x.id === u.source);
      if (b && src) return GK.t('{source} & {name}', { source: GK.t(src.name), name: GK.t(b.name) });
    }
    return GK.t(u.name);
  }

  function upgradeDesc(u) {
    if (u.type === 'buildingMult') {
      const b = BUILDINGS.find(x => x.id === u.building);
      if (b) return GK.t('{name}: Einkommen ×{value}', { name: GK.t(b.name), value: u.value });
    }
    if (u.type === 'synergy') {
      const b = BUILDINGS.find(x => x.id === u.building);
      const src = BUILDINGS.find(x => x.id === u.source);
      if (b && src) return GK.t('{name}: +1 % Einkommen pro {source}', { name: GK.t(b.name), source: GK.t(src.name) });
    }
    return GK.t(u.desc);
  }

  function renderUpgrades() {
    const available = availableUpgrades();
    const upgrades = showAllUpgrades ? available : available.slice(0, UPGRADES_SHOWN);
    const list = document.getElementById('upgrade-list');
    const signature = upgrades.map(u => u.id).join(',') + '|' + available.length;

    // Liste nur neu aufbauen, wenn sich die verfügbaren Upgrades geändert haben
    if (signature !== lastUpgradeSignature) {
      lastUpgradeSignature = signature;
      list.innerHTML = '';
      upgrades.forEach(u => {
        const el = document.createElement('button');
        el.className = `upgrade rarity-${u.rarity}`;
        el.dataset.id = u.id;
        el.title = `${upgradeName(u)}\n${upgradeDesc(u)}\n${GK.t('Preis: {cost} Dublonen', { cost: GK.formatNumber(u.cost) })}`;
        el.innerHTML = `
          <span class="upgrade-icon">${ic(u.ic, u.icon)}</span>
          <span class="upgrade-name">${upgradeName(u)}</span>
          <span class="upgrade-desc">${upgradeDesc(u)}</span>
          <span class="upgrade-gain"></span>
          <span class="upgrade-cost">${GK.COIN} ${GK.formatNumber(u.cost)}</span>`;
        el.addEventListener('click', () => buyUpgrade(u, el));
        list.appendChild(el);
      });
      document.getElementById('upgrade-empty').hidden = upgrades.length > 0;
      const more = document.getElementById('upgrade-more');
      const hiddenCount = available.length - upgrades.length;
      more.hidden = available.length <= UPGRADES_SHOWN;
      more.textContent = showAllUpgrades ? GK.t('▲ Weniger anzeigen') : GK.t('▼ {n} weitere {word} anzeigen', { n: hiddenCount, word: GK.t(hiddenCount === 1 ? 'Upgrade' : 'Upgrades') });
    }

    list.querySelectorAll('.upgrade').forEach(el => {
      const u = upgradeById[el.dataset.id];
      el.disabled = !GK.canAfford(u.cost);
      const gain = upgradeGain(u);
      const clickGain = gain > 0 ? 0 : upgradeClickGain(u);
      GK.setText(el.querySelector('.upgrade-gain'), gain > 0 ? `+${GK.formatNumber(gain, true)}/s`
        : clickGain > 0 ? GK.t('+{x} pro Klick', { x: GK.formatNumber(clickGain, true) }) : '');
    });
  }

  function render() {
    GK.setText(document.getElementById('click-power'), GK.formatNumber(getClickPower(), true));
    document.getElementById('passive-toggle').checked = passiveActive();
    document.getElementById('building-list').classList.toggle('paused', !passiveActive());
    renderBuildings();
    renderUpgrades();
    renderCombo();
  }

  function init() {
    buildBuildingList();
    // pointerdown statt click: reagiert sofort und erlaubt schnelles Tippen mit mehreren Fingern (iPad)
    const coin = document.getElementById('big-coin');
    coin.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      e.preventDefault();
      click(e);
    });
    coin.addEventListener('click', e => { if (e.detail === 0) click(e); }); // Tastatur (Enter/Leertaste)
    // Gedrückt gehaltene Taste: Wiederholungen zählen nicht (sonst wäre Enter ein Autoklicker)
    coin.addEventListener('keydown', e => { if (e.repeat) e.preventDefault(); });
    document.getElementById('passive-toggle').addEventListener('change', e => setPassive(e.target.checked));
    document.getElementById('upgrade-more').addEventListener('click', () => {
      showAllUpgrades = !showAllUpgrades;
      lastUpgradeSignature = '';
      render();
    });
    document.querySelectorAll('.amount-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        buyAmount = Number(btn.dataset.amount);
        document.querySelectorAll('.amount-btn').forEach(b => b.classList.toggle('active', b === btn));
        render();
      });
    });
  }

  // Wird beim Zurücksetzen aufgerufen, damit die Upgrade-Liste neu aufgebaut wird
  function refresh() {
    lastUpgradeSignature = null;
    combo.count = 0;
    render();
  }

  GK.clicker = {
    BUILDINGS,
    init,
    tick,
    render,
    refresh,
    getCps,
    getCpsPermanent,
    passiveActive,
    getClickPower,
    getClickPowerPermanent,
    totalBuildings,
    buildingsWorth,
    ownsAllBuildings: () => BUILDINGS.every(b => owned(b.id) > 0),
    remainingUpgrades: () => UPGRADES.filter(u => !has(u.id)).length,
    hasUpgradeOfRarity: rarity => GK.state.upgrades.some(id => upgradeById[id] && upgradeById[id].rarity === rarity),
  };
})();
