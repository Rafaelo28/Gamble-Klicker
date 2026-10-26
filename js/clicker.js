// Klicker-Teil: Gebäude (passives Einkommen), Upgrades und die große Münze.
window.GK = window.GK || {};

(function () {
  const COST_GROWTH = 1.15;

  const BUILDINGS = [
    { id: 'finger',    icon: '👆', name: 'Hilfsfinger',      baseCost: 15,     baseCps: 0.1,   desc: 'Klickt ab und zu für dich.' },
    { id: 'piggy',     icon: '🐷', name: 'Sparschwein',      baseCost: 100,    baseCps: 1,     desc: 'Jeder Cent zählt.' },
    { id: 'lemonade',  icon: '🍋', name: 'Limonadenstand',   baseCost: 1100,   baseCps: 8,     desc: 'Sauer macht reich.' },
    { id: 'kiosk',     icon: '🏪', name: 'Kiosk',            baseCost: 12000,  baseCps: 47,    desc: 'Rubbellose und Kaugummis.' },
    { id: 'pawnshop',  icon: '💍', name: 'Pfandhaus',        baseCost: 130000, baseCps: 260,   desc: 'Kauft alles, was glänzt.' },
    { id: 'bank',      icon: '🏦', name: 'Bank',             baseCost: 1.4e6,  baseCps: 1400,  desc: 'Zinsen auf Spielgeld.' },
    { id: 'goldmine',  icon: '⛏️', name: 'Goldmine',         baseCost: 2e7,    baseCps: 7800,  desc: 'Tief unten glitzert es.' },
    { id: 'mint',      icon: '🏛️', name: 'Münzprägerei',     baseCost: 3.3e8,  baseCps: 44000, desc: 'Prägt Dublonen am laufenden Band.' },
  ];

  // Upgrades: Klickkraft, Klick-Anteil am Einkommen und Verdopplung je Gebäude
  const UPGRADES = [
    { id: 'click1', icon: '💪', name: 'Starker Finger',  cost: 100,    type: 'clickMult', value: 2, desc: 'Klickkraft ×2',
      unlocked: s => s.totalClicks >= 10 },
    { id: 'click2', icon: '🥇', name: 'Goldener Finger', cost: 1000,   type: 'clickMult', value: 2, desc: 'Klickkraft ×2',
      unlocked: s => has('click1') && s.totalClicks >= 100 },
    { id: 'click3', icon: '💎', name: 'Diamantfinger',   cost: 50000,  type: 'clickMult', value: 2, desc: 'Klickkraft ×2',
      unlocked: s => has('click2') && s.totalClicks >= 500 },
    { id: 'click4', icon: '✨', name: 'Magische Hand',   cost: 5e6,    type: 'clickMult', value: 2, desc: 'Klickkraft ×2',
      unlocked: s => has('click3') && s.totalClicks >= 1500 },
    { id: 'cpsClick1', icon: '📈', name: 'Klick-Investment', cost: 25000, type: 'clickCps', value: 0.01,
      desc: 'Jeder Klick bringt zusätzlich 1 % deines Einkommens pro Sekunde',
      unlocked: () => getCps() >= 20 },
    { id: 'cpsClick2', icon: '📊', name: 'Klick-Dividende', cost: 2.5e6, type: 'clickCps', value: 0.02,
      desc: 'Jeder Klick bringt zusätzlich 2 % deines Einkommens pro Sekunde',
      unlocked: () => has('cpsClick1') && getCps() >= 1000 },
  ];

  // Pro Gebäude: Verdopplung bei 1, 10, 25 und 50 Stück
  const BUILDING_TIERS = [
    { owned: 1,  costFactor: 10,   name: 'Bronze' },
    { owned: 10, costFactor: 50,   name: 'Silber' },
    { owned: 25, costFactor: 500,  name: 'Gold' },
    { owned: 50, costFactor: 5000, name: 'Platin' },
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
        value: 2,
        desc: `${b.name}: Einkommen ×2`,
        unlocked: () => owned(b.id) >= tier.owned,
      });
    });
  });

  const upgradeById = Object.fromEntries(UPGRADES.map(u => [u.id, u]));

  let buyAmount = 1;
  let lastUpgradeSignature = '';
  const buildingEls = {};

  // ---------- Berechnungen ----------

  function has(upgradeId) {
    return GK.state.upgrades.includes(upgradeId);
  }

  function owned(buildingId) {
    return GK.state.buildings[buildingId] || 0;
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
      if (u && u.type === 'buildingMult' && u.building === buildingId) mult *= u.value;
    }
    return mult;
  }

  // Einkommen ohne Boni aus Schatzkarten, Erfolgen usw.
  function baseCps() {
    return BUILDINGS.reduce((sum, b) => sum + owned(b.id) * b.baseCps * buildingMultiplier(b.id), 0);
  }

  // Alle Boni zusammen (dauerhaft × zeitlich begrenzt, z. B. Goldrausch)
  function incomeMult() {
    return GK.progress.permanentMult() * GK.progress.buffMult('income');
  }

  // Einkommen eines einzelnen Gebäudes inklusive aller Boni
  function buildingCps(building) {
    return building.baseCps * buildingMultiplier(building.id) * incomeMult();
  }

  function getCps() {
    return baseCps() * incomeMult();
  }

  // Einkommen nur mit dauerhaften Boni (für Offline-Einnahmen und Erfolge)
  function getCpsPermanent() {
    return baseCps() * GK.progress.permanentMult();
  }

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

  function availableUpgrades() {
    return UPGRADES
      .filter(u => !has(u.id) && u.unlocked(GK.state))
      .sort((a, b) => a.cost - b.cost);
  }

  // ---------- Aktionen ----------

  function click(event) {
    const amount = getClickPower();
    GK.state.totalClicks++;
    GK.earn(amount, 'click');
    showFloatingText(event, '+' + GK.formatNumber(amount, true));
  }

  function buyBuilding(building) {
    const cost = buildingCost(building, owned(building.id), buyAmount);
    if (!GK.spend(cost)) return;
    GK.state.buildings[building.id] = owned(building.id) + buyAmount;
    GK.save();
    render();
  }

  function buyUpgrade(upgrade) {
    if (has(upgrade.id) || !GK.spend(upgrade.cost)) return;
    GK.state.upgrades.push(upgrade.id);
    GK.save();
    lastUpgradeSignature = '';
    render();
  }

  function tick(seconds) {
    const income = getCps() * seconds;
    if (income > 0) GK.earn(income, 'passive');
  }

  // ---------- Darstellung ----------

  function showFloatingText(event, text) {
    const layer = document.getElementById('float-layer');
    const rect = layer.getBoundingClientRect();
    const el = document.createElement('div');
    el.className = 'float-text';
    el.textContent = text;
    // Bei Tastatur-Klicks (keine Mauskoordinaten) in der Mitte anzeigen
    const x = event && event.clientX ? event.clientX - rect.left : rect.width / 2;
    const y = event && event.clientY ? event.clientY - rect.top : rect.height / 2;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    layer.appendChild(el);
    setTimeout(() => el.remove(), 1000);
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
          <span class="building-name">${b.name}</span>
          <span class="building-desc">${b.desc}</span>
          <span class="building-meta"></span>
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

      const cost = buildingCost(b, owned(b.id), buyAmount);
      els.root.classList.toggle('mystery', mystery);
      els.root.disabled = !GK.canAfford(cost);
      els.icon.textContent = mystery ? '❓' : b.icon;
      els.name.textContent = mystery ? '???' : b.name;
      els.desc.textContent = mystery ? 'Noch unbekannt' : b.desc;
      els.cost.innerHTML = GK.COIN + ' ' + GK.formatNumber(cost);
      els.owned.textContent = owned(b.id) || '';
      els.meta.textContent = mystery
        ? ''
        : `+${GK.formatNumber(buildingCps(b), true)}/s pro Stück` +
          (owned(b.id) ? ` · gesamt ${GK.formatNumber(buildingCps(b) * owned(b.id), true)}/s` : '');
    });
  }

  function renderUpgrades() {
    const upgrades = availableUpgrades();
    const list = document.getElementById('upgrade-list');
    const signature = upgrades.map(u => u.id).join(',');

    // Liste nur neu aufbauen, wenn sich die verfügbaren Upgrades geändert haben
    if (signature !== lastUpgradeSignature) {
      lastUpgradeSignature = signature;
      list.innerHTML = '';
      upgrades.forEach(u => {
        const el = document.createElement('button');
        el.className = 'upgrade';
        el.dataset.id = u.id;
        el.title = `${u.name}\n${u.desc}\nPreis: ${GK.formatNumber(u.cost)} Dublonen`;
        el.innerHTML = `
          <span class="upgrade-icon">${u.icon}</span>
          <span class="upgrade-name">${u.name}</span>
          <span class="upgrade-desc">${u.desc}</span>
          <span class="upgrade-cost">${GK.COIN} ${GK.formatNumber(u.cost)}</span>`;
        el.addEventListener('click', () => buyUpgrade(u));
        list.appendChild(el);
      });
      document.getElementById('upgrade-empty').hidden = upgrades.length > 0;
    }

    list.querySelectorAll('.upgrade').forEach(el => {
      el.disabled = !GK.canAfford(upgradeById[el.dataset.id].cost);
    });
  }

  function render() {
    document.getElementById('click-power').textContent = GK.formatNumber(getClickPower(), true);
    renderBuildings();
    renderUpgrades();
  }

  function init() {
    buildBuildingList();
    document.getElementById('big-coin').addEventListener('click', click);
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
    render();
  }

  GK.clicker = {
    init,
    tick,
    render,
    refresh,
    getCps,
    getCpsPermanent,
    getClickPower,
    totalBuildings: () => BUILDINGS.reduce((sum, b) => sum + owned(b.id), 0),
    ownsAllBuildings: () => BUILDINGS.every(b => owned(b.id) > 0),
  };
})();
