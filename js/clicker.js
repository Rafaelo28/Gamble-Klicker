// Klicker-Teil: Gebäude (passives Einkommen), Upgrades und die große Münze.
// Klicks können eine Combo aufbauen (schnell hintereinander) und kritisch treffen.
window.GK = window.GK || {};

(function () {
  const COST_GROWTH = 1.15;
  const COMBO_WINDOW = 700;      // ms: so schnell muss der nächste Klick kommen, damit die Combo weiterläuft
  const BASE_COMBO_CAP = 25;     // ohne Upgrades höchstens +25 % durch die Combo
  const BASE_CRIT_MULT = 10;     // kritischer Klick = ×10
  const COMBO_MILESTONES = [25, 50, 100, 200];
  const BUILDING_MILESTONES = [10, 25, 50, 100, 150, 200, 250, 300];
  const UPGRADES_SHOWN = 8;      // so viele Upgrades sind sichtbar, der Rest ist eingeklappt

  const BUILDINGS = [
    { id: 'finger',    icon: '👆', name: 'Hilfsfinger',      baseCost: 15,     baseCps: 0.1,   desc: 'Klickt ab und zu für dich.' },
    { id: 'piggy',     icon: '🐷', name: 'Sparschwein',      baseCost: 100,    baseCps: 1,     desc: 'Jeder Cent zählt.' },
    { id: 'lemonade',  icon: '🍋', name: 'Limonadenstand',   baseCost: 1100,   baseCps: 8,     desc: 'Sauer macht reich.' },
    { id: 'kiosk',     icon: '🏪', name: 'Kiosk',            baseCost: 12000,  baseCps: 47,    desc: 'Rubbellose und Kaugummis.' },
    { id: 'pawnshop',  icon: '💍', name: 'Pfandhaus',        baseCost: 130000, baseCps: 260,   desc: 'Kauft alles, was glänzt.' },
    { id: 'bank',      icon: '🏦', name: 'Bank',             baseCost: 1.4e6,  baseCps: 1400,  desc: 'Zinsen auf Spielgeld.' },
    { id: 'goldmine',  icon: '⛏️', name: 'Goldmine',         baseCost: 2e7,    baseCps: 7800,  desc: 'Tief unten glitzert es.' },
    { id: 'mint',      icon: '🏛️', name: 'Münzprägerei',     baseCost: 3.3e8,  baseCps: 44000, desc: 'Prägt Dublonen am laufenden Band.' },
    { id: 'ship',      icon: '🚢', name: 'Handelsschiff',    baseCost: 5.1e9,  baseCps: 2.6e5, desc: 'Bringt Gold aus fernen Häfen.' },
    { id: 'alchemy',   icon: '🧪', name: 'Alchemistenlabor', baseCost: 7.5e10, baseCps: 1.6e6, desc: 'Macht aus Blei pures Gold.' },
    { id: 'fleet',     icon: '🏴‍☠️', name: 'Piratenflotte',   baseCost: 1e12,   baseCps: 1e7,   desc: 'Kapert Schatzschiffe auf allen Meeren.' },
    { id: 'island',    icon: '🏝️', name: 'Schatzinsel',      baseCost: 1.4e13, baseCps: 6.5e7, desc: 'X markiert die Stelle – jeden Tag aufs Neue.' },
    { id: 'dragon',    icon: '🐉', name: 'Drachenhort',      baseCost: 1.7e14, baseCps: 4.3e8, desc: 'Ein Drache brütet auf Bergen von Gold.' },
    { id: 'timemachine', icon: '🔮', name: 'Zeitmaschine',   baseCost: 2.1e15, baseCps: 2.9e9, desc: 'Holt Dublonen aus der Zukunft.' },
    { id: 'luck',      icon: '🍀', name: 'Glücksfabrik',     baseCost: 2.6e16, baseCps: 2.1e10, desc: 'Stellt Glück am Fließband her.' },
    { id: 'portal',    icon: '🌌', name: 'Sternenportal',    baseCost: 3.1e17, baseCps: 1.5e11, desc: 'Dublonen aus anderen Welten.' },
  ];

  // Upgrades für Klicks. rarity bestimmt Farbe und Effekt der Kachel.
  const UPGRADES = [
    { id: 'click1', icon: '💪', name: 'Starker Finger',  cost: 100,  type: 'clickMult', value: 2, rarity: 'click', desc: 'Klickkraft ×2',
      unlocked: s => s.totalClicks >= 10 },
    { id: 'click2', icon: '🥇', name: 'Goldener Finger', cost: 1000, type: 'clickMult', value: 2, rarity: 'click', desc: 'Klickkraft ×2',
      unlocked: s => has('click1') && s.totalClicks >= 100 },
    { id: 'click3', icon: '💎', name: 'Diamantfinger',   cost: 50000, type: 'clickMult', value: 2, rarity: 'click', desc: 'Klickkraft ×2',
      unlocked: s => has('click2') && s.totalClicks >= 500 },
    { id: 'click4', icon: '✨', name: 'Magische Hand',   cost: 5e6,  type: 'clickMult', value: 2, rarity: 'click', desc: 'Klickkraft ×2',
      unlocked: s => has('click3') && s.totalClicks >= 1500 },
    { id: 'click5', icon: '👊', name: 'Goldene Faust',   cost: 5e8,  type: 'clickMult', value: 3, rarity: 'click', desc: 'Klickkraft ×3',
      unlocked: s => has('click4') && s.totalClicks >= 3000 },
    { id: 'click6', icon: '🤴', name: 'Hand des Midas',  cost: 5e10, type: 'clickMult', value: 3, rarity: 'click', desc: 'Klickkraft ×3',
      unlocked: s => has('click5') && s.totalClicks >= 6000 },
    { id: 'click7', icon: '🌟', name: 'Sternenhand',     cost: 5e12, type: 'clickMult', value: 3, rarity: 'click', desc: 'Klickkraft ×3',
      unlocked: s => has('click6') && s.totalClicks >= 10000 },
    { id: 'click8', icon: '🪐', name: 'Hand der Götter', cost: 5e14, type: 'clickMult', value: 4, rarity: 'click', desc: 'Klickkraft ×4',
      unlocked: s => has('click7') && s.totalClicks >= 20000 },
    { id: 'cpsClick1', icon: '📈', name: 'Klick-Investment', cost: 25000, type: 'clickCps', value: 0.01, rarity: 'click',
      desc: 'Jeder Klick bringt zusätzlich 1 % deines Einkommens pro Sekunde',
      unlocked: () => getCps() >= 20 },
    { id: 'cpsClick2', icon: '📊', name: 'Klick-Dividende', cost: 2.5e6, type: 'clickCps', value: 0.02, rarity: 'click',
      desc: 'Jeder Klick bringt zusätzlich 2 % deines Einkommens pro Sekunde',
      unlocked: () => has('cpsClick1') && getCps() >= 1000 },
    { id: 'cpsClick3', icon: '💹', name: 'Klick-Imperium', cost: 2.5e8, type: 'clickCps', value: 0.03, rarity: 'click',
      desc: 'Jeder Klick bringt zusätzlich 3 % deines Einkommens pro Sekunde',
      unlocked: () => has('cpsClick2') && getCps() >= 100000 },
    { id: 'cpsClick4', icon: '🏦', name: 'Klick-Konzern', cost: 2.5e10, type: 'clickCps', value: 0.04, rarity: 'click',
      desc: 'Jeder Klick bringt zusätzlich 4 % deines Einkommens pro Sekunde',
      unlocked: () => has('cpsClick3') && getCps() >= 1e7 },
    { id: 'cpsClick5', icon: '👑', name: 'Klick-Dynastie', cost: 2.5e12, type: 'clickCps', value: 0.05, rarity: 'click',
      desc: 'Jeder Klick bringt zusätzlich 5 % deines Einkommens pro Sekunde',
      unlocked: () => has('cpsClick4') && getCps() >= 1e9 },
    // Kritische Treffer
    { id: 'crit1', icon: '🎯', name: 'Glückstreffer', cost: 5000, type: 'critChance', value: 0.03, rarity: 'crit',
      desc: '3 % Chance auf einen kritischen Klick (×10)',
      unlocked: s => s.totalClicks >= 250 },
    { id: 'crit2', icon: '🦅', name: 'Adlerauge', cost: 5e5, type: 'critChance', value: 0.04, rarity: 'crit',
      desc: '+4 % Chance auf kritische Klicks',
      unlocked: s => has('crit1') && s.totalClicks >= 1000 },
    { id: 'crit3', icon: '💥', name: 'Volltreffer-Hand', cost: 5e7, type: 'critMult', value: 25, rarity: 'crit',
      desc: 'Kritische Klicks bringen ×25 statt ×10',
      unlocked: s => has('crit2') && s.totalClicks >= 2500 },
    { id: 'crit4', icon: '🍀', name: 'Glückspilz', cost: 5e9, type: 'critChance', value: 0.05, rarity: 'crit',
      desc: '+5 % Chance auf kritische Klicks',
      unlocked: s => has('crit3') && s.totalClicks >= 5000 },
    { id: 'crit5', icon: '⚡', name: 'Blitzschlag', cost: 5e11, type: 'critMult', value: 50, rarity: 'crit',
      desc: 'Kritische Klicks bringen ×50',
      unlocked: s => has('crit4') && s.totalClicks >= 8000 },
    // Combo
    { id: 'combo1', icon: '🔥', name: 'Combo-Meister', cost: 2000, type: 'comboCap', value: 50, rarity: 'combo',
      desc: 'Combo bis +50 % statt +25 %',
      unlocked: s => s.totalClicks >= 150 },
    { id: 'combo2', icon: '☄️', name: 'Feuerhände', cost: 2e6, type: 'comboCap', value: 100, rarity: 'combo',
      desc: 'Combo bis +100 % (doppelte Klickkraft)',
      unlocked: s => has('combo1') && s.totalClicks >= 1200 },
    { id: 'combo3', icon: '🌋', name: 'Vulkanhände', cost: 2e9, type: 'comboCap', value: 200, rarity: 'combo',
      desc: 'Combo bis +200 % (dreifache Klickkraft)',
      unlocked: s => has('combo2') && s.totalClicks >= 4000 },
    // Für alle Gebäude zusammen, je nachdem, wie viele man insgesamt besitzt
    { id: 'global1', icon: '📜', name: 'Handelsvertrag', cost: 2e5, type: 'globalMult', value: 1.1, rarity: 'empire',
      desc: 'Alle Gebäude: Einkommen +10 %', unlocked: () => totalBuildings() >= 50 },
    { id: 'global2', icon: '🧭', name: 'Goldener Kompass', cost: 1e8, type: 'globalMult', value: 1.15, rarity: 'empire',
      desc: 'Alle Gebäude: Einkommen +15 %', unlocked: () => totalBuildings() >= 150 },
    { id: 'global3', icon: '⚓', name: 'Kaiserliche Flotte', cost: 5e10, type: 'globalMult', value: 1.2, rarity: 'empire',
      desc: 'Alle Gebäude: Einkommen +20 %', unlocked: () => totalBuildings() >= 300 },
    { id: 'global4', icon: '🏛️', name: 'Goldenes Zeitalter', cost: 5e13, type: 'globalMult', value: 1.25, rarity: 'empire',
      desc: 'Alle Gebäude: Einkommen +25 %', unlocked: () => totalBuildings() >= 500 },
    { id: 'global5', icon: '🌠', name: 'Ewiger Reichtum', cost: 5e16, type: 'globalMult', value: 1.3, rarity: 'empire',
      desc: 'Alle Gebäude: Einkommen +30 %', unlocked: () => totalBuildings() >= 800 },
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

  // Klickkraft ohne Combo und kritische Treffer
  function getClickPower() {
    let mult = 1;
    let cpsShare = 0;
    for (const id of GK.state.upgrades) {
      const u = upgradeById[id];
      if (!u) continue;
      if (u.type === 'clickMult') mult *= u.value;
      if (u.type === 'clickCps') cpsShare += u.value;
    }
    return (mult * GK.progress.permanentMult() + getCps() * cpsShare) * GK.progress.buffMult('click');
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

  function click(event) {
    const now = performance.now();
    combo.count = now - combo.last <= COMBO_WINDOW ? combo.count + 1 : 1;
    combo.last = now;
    if (combo.count > GK.state.bestCombo) GK.state.bestCombo = combo.count;

    const crit = GK.rng.float() < critChance();
    const amount = getClickPower() * comboMult() * (crit ? critMult() : 1);
    GK.state.totalClicks++;
    GK.earn(amount, 'click');

    const coin = document.getElementById('big-coin');
    const pos = event && event.clientX ? { x: event.clientX, y: event.clientY } : GK.fx.center(coin);
    showClickRing(pos);
    if (crit) {
      GK.state.crits++;
      GK.sound.play('crit');
      GK.fx.pulse(coin, 'coin-crit');
      showFloatingText(pos, `KRITISCH! +${GK.formatNumber(amount, true)}`, 'crit');
      GK.cosmetics.clickBurst(pos.x, pos.y, { crit: true });
      GK.fx.burst(pos.x, pos.y, { count: 10, kind: 'sparkle', speed: 400 });
    } else {
      GK.sound.play('click');
      GK.fx.pulse(coin, 'coin-hit');
      showFloatingText(pos, '+' + GK.formatNumber(amount, true), combo.count >= 25 ? 'hot' : '');
      // Klick-Effekt aus der Schatzkammer (im Klickfieber und bei hoher Combo mehr)
      const fever = GK.progress.buffMult('click') > 1;
      GK.cosmetics.clickBurst(pos.x, pos.y, { hot: fever || combo.count >= 50 });
    }
    if (COMBO_MILESTONES.includes(combo.count - 1) && combo.count - 1 <= comboCap()) {
      GK.sound.play('combo');
      const c = GK.fx.center(coin);
      GK.fx.floatText(c.x, c.y - 30, `🔥 COMBO ×${formatFactor(comboMult())}!`, 'win big');
      GK.fx.burst(c.x, c.y, { count: 12, kind: 'sparkle', speed: 500 });
    }
    renderCombo();
  }

  function buyBuilding(building) {
    const before = owned(building.id);
    const cost = buildingCost(building, before, buyAmount);
    if (!GK.spend(cost)) return;
    GK.state.buildings[building.id] = before + buyAmount;
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
      GK.fx.floatText(pos.x + 60, pos.y - 10, `🏗️ ${milestone}× ${building.name}!`, 'win big');
      const tier = BUILDING_TIERS.find(t => t.owned === milestone);
      GK.notify(`<span class="notify-icon">${building.icon}</span><span><b>Meilenstein: ${milestone}× ${building.name}!</b>` +
        `${tier ? `<br>Neues Upgrade verfügbar: ${tier.name}-${building.name}` : ''}</span>`, 4000);
    }
    render();
  }

  function buyUpgrade(upgrade, el) {
    if (has(upgrade.id) || !GK.spend(upgrade.cost)) return;
    GK.state.upgrades.push(upgrade.id);
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
      const label = upgrade.type === 'synergy' ? '🤝 Synergie!' : `⚡ ×${upgrade.value}!`;
      GK.fx.floatText(p.x + 40, p.y, label, 'win big');
    } else {
      const c = GK.fx.center(document.getElementById('big-coin'));
      GK.fx.floatText(c.x, c.y - 60, `${upgrade.icon} ${upgrade.name}!`, 'win big');
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
    GK.toast(on ? '💰 Passives Einkommen läuft wieder.' : '⏸️ Passives Einkommen ausgeschaltet – nur noch Klicks und Casino bringen Dublonen.');
    render();
  }

  function tick(seconds) {
    if (!passiveActive()) return;
    const income = getCps() * seconds;
    if (income > 0) GK.earn(income, 'passive');
  }

  // ---------- Darstellung ----------

  function formatFactor(f) {
    return f.toLocaleString('de-DE', { maximumFractionDigits: 2 });
  }

  function layerPos(pos) {
    const rect = document.getElementById('float-layer').getBoundingClientRect();
    return { x: pos.x - rect.left, y: pos.y - rect.top };
  }

  function showFloatingText(pos, text, cls) {
    const layer = document.getElementById('float-layer');
    const p = layerPos(pos);
    const el = document.createElement('div');
    el.className = 'float-text ' + (cls || '');
    el.textContent = text;
    el.style.left = p.x + 'px';
    el.style.top = p.y + 'px';
    layer.appendChild(el);
    setTimeout(() => el.remove(), cls === 'crit' ? 1300 : 1000);
  }

  // Ring, der sich von der Tipp-Stelle ausbreitet
  function showClickRing(pos) {
    if (GK.state.settings.effects === 'reduced') return;
    const layer = document.getElementById('float-layer');
    const p = layerPos(pos);
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
    el.querySelector('.combo-count').textContent = `🔥 Combo ${combo.count}`;
    el.querySelector('.combo-mult').textContent = `×${formatFactor(comboMult())}`;
    el.querySelector('.combo-fill').style.width = (comboBonus() / cap * 100) + '%';
    el.classList.toggle('maxed', comboBonus() >= cap);
  }

  function buildBuildingList() {
    const list = document.getElementById('building-list');
    list.innerHTML = '';
    BUILDINGS.forEach(b => {
      const el = document.createElement('button');
      el.className = 'building';
      el.innerHTML = `
        <span class="building-icon">${b.icon}</span>
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
      els.icon.textContent = mystery ? '❓' : b.icon;
      els.name.firstChild.textContent = mystery ? '??? ' : b.name + ' ';
      els.desc.textContent = mystery ? 'Noch unbekannt' : b.desc;
      els.cost.innerHTML = GK.COIN + ' ' + GK.formatNumber(cost);
      els.owned.textContent = count || '';
      els.meta.textContent = mystery
        ? ''
        : `+${GK.formatNumber(buildingCps(b), true)}/s pro Stück` +
          (count ? ` · gesamt ${GK.formatNumber(buildingCps(b) * count, true)}/s` : '') +
          (passiveActive() ? '' : ' · pausiert');

      // Sterne für gekaufte Gebäude-Upgrades (Farbe je Stufe)
      const stars = BUILDING_TIERS.map((t, k) => (has(`${b.id}-${k + 1}`) ? `<i class="star rarity-${t.rarity}">★</i>` : '')).join('') +
        (has(`syn-${b.id}`) ? '<i class="star rarity-synergy">🤝</i>' : '');
      if (els.stars.innerHTML !== stars) els.stars.innerHTML = stars;

      // Fortschritt bis zum nächsten Upgrade
      const nextTier = BUILDING_TIERS.find(t => t.owned > count);
      const prevOwned = [...BUILDING_TIERS].reverse().find(t => t.owned <= count);
      els.progress.hidden = mystery || !count || !nextTier;
      els.next.hidden = mystery || !count;
      if (!mystery && count) {
        if (nextTier) {
          const from = prevOwned ? prevOwned.owned : 0;
          els.fill.style.width = ((count - from) / (nextTier.owned - from) * 100) + '%';
          els.fill.className = `building-progress-fill rarity-${nextTier.rarity}`;
          els.next.textContent = `Noch ${nextTier.owned - count} bis zum ${nextTier.name}-Upgrade (×${nextTier.value})`;
        } else {
          els.next.textContent = '✨ Alle Stufen freigeschaltet';
        }
      }
    });
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
        el.title = `${u.name}\n${u.desc}\nPreis: ${GK.formatNumber(u.cost)} Dublonen`;
        el.innerHTML = `
          <span class="upgrade-icon">${u.icon}</span>
          <span class="upgrade-name">${u.name}</span>
          <span class="upgrade-desc">${u.desc}</span>
          <span class="upgrade-gain"></span>
          <span class="upgrade-cost">${GK.COIN} ${GK.formatNumber(u.cost)}</span>`;
        el.addEventListener('click', () => buyUpgrade(u, el));
        list.appendChild(el);
      });
      document.getElementById('upgrade-empty').hidden = upgrades.length > 0;
      const more = document.getElementById('upgrade-more');
      const hiddenCount = available.length - upgrades.length;
      more.hidden = available.length <= UPGRADES_SHOWN;
      more.textContent = showAllUpgrades ? '▲ Weniger anzeigen' : `▼ ${hiddenCount} weitere ${hiddenCount === 1 ? 'Upgrade' : 'Upgrades'} anzeigen`;
    }

    list.querySelectorAll('.upgrade').forEach(el => {
      const u = upgradeById[el.dataset.id];
      el.disabled = !GK.canAfford(u.cost);
      const gain = upgradeGain(u);
      el.querySelector('.upgrade-gain').textContent = gain > 0 ? `+${GK.formatNumber(gain, true)}/s` : '';
    });
  }

  function render() {
    document.getElementById('click-power').textContent = GK.formatNumber(getClickPower(), true);
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
    totalBuildings,
    ownsAllBuildings: () => BUILDINGS.every(b => owned(b.id) > 0),
    hasUpgradeOfRarity: rarity => GK.state.upgrades.some(id => upgradeById[id] && upgradeById[id].rarity === rarity),
  };
})();
