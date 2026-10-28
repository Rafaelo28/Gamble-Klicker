// Schatzkammer: Cosmetics für die Münze, die Klick-Effekte und die Farben des Spiels.
// Sie ändern nur das Aussehen. Man bekommt sie am Glücksrad nach jeder großen Fahrt oder kauft sie teuer:
// mit Dublonen UND einem Teil der Gebäude – damit es lange etwas zu sammeln gibt.
window.GK = window.GK || {};

(function () {
  // Seltenheit: Preis in Dublonen, Anteil der Gebäude, der abgegeben wird, Mindestzahl an Gebäuden,
  // Gewicht für das Glücksrad (seltene Sachen landen öfter auf dem Rad)
  const RARITIES = {
    common:    { name: 'Standard' },
    rare:      { name: 'Selten',   price: 1e9,  share: 0.25, shareText: '¼', minBuildings: 100, weight: 6 },
    epic:      { name: 'Episch',   price: 1e11, share: 0.5,  shareText: '½', minBuildings: 250, weight: 3 },
    legendary: { name: 'Legendär', price: 1e13, share: 0.75, shareText: '¾', minBuildings: 500, weight: 1 },
  };

  // Je Kategorie: Standard (immer da) + 5 Cosmetics. coins = Farben der Münzen, die beim Klicken wegfliegen.
  const CATEGORIES = [
    {
      id: 'coin', name: 'Münz-Designs', icon: '🪙', items: [
        { id: 'gold',    name: 'Golddublone',   icon: '🪙', rarity: 'common',    letter: 'D', desc: 'Die klassische Dublone.',
          coins: ['#fff6c2', '#f5c542', '#a8740a', '#8a6508'] },
        { id: 'silver',  name: 'Silbertaler',   icon: '🥈', rarity: 'rare',      letter: 'D', desc: 'Kühler Glanz aus der Silbermine.',
          coins: ['#ffffff', '#c9d1d8', '#7d8892', '#5b6670'] },
        { id: 'ruby',    name: 'Rubin-Dublone', icon: '♦️', rarity: 'rare',      letter: 'D', desc: 'Ein geschliffener Rubin, in Gold gefasst.',
          coins: ['#ffd6dc', '#e0283f', '#7a0a1c', '#c9a227'] },
        { id: 'pirate',  name: 'Piratenmünze',  icon: '☠️', rarity: 'epic',      letter: '☠︎', desc: 'Verwittert und verflucht – vom Meeresgrund.',
          coins: ['#e6cfa0', '#a8783a', '#5a3d17', '#2b1b09'] },
        { id: 'crystal', name: 'Kristallmünze', icon: '💎', rarity: 'epic',      letter: 'D', desc: 'Klar wie Eis, funkelt bei jedem Klick.',
          coins: ['#ffffff', '#9fe6ff', '#4fb6dc', '#7fd3ee'] },
        { id: 'cosmic',  name: 'Sternenmünze',  icon: '🌌', rarity: 'legendary', letter: '✦', desc: 'Ein Stück Nachthimmel mit eigenem Sternbild.',
          coins: ['#f1e6ff', '#8c6bff', '#2a1260', '#c9a8ff'] },
      ],
    },
    {
      id: 'effect', name: 'Klick-Effekte', icon: '✨', items: [
        { id: 'coins',     name: 'Dublonen',     icon: '🪙', rarity: 'common',    desc: 'Münzen springen davon.' },
        { id: 'sparks',    name: 'Funkenregen',  icon: '✨', rarity: 'rare',      desc: 'Goldene Funken sprühen in alle Richtungen.' },
        { id: 'bubbles',   name: 'Meeresblasen', icon: '🫧', rarity: 'rare',      desc: 'Blasen steigen auf wie unter Wasser.' },
        { id: 'clover',    name: 'Glücksklee',   icon: '🍀', rarity: 'epic',      desc: 'Vierblättriger Klee wirbelt durch die Luft.' },
        { id: 'flames',    name: 'Feuerschweif', icon: '🔥', rarity: 'epic',      desc: 'Jeder Klick lodert auf.' },
        { id: 'fireworks', name: 'Feuerwerk',    icon: '🎆', rarity: 'legendary', desc: 'Raketen steigen auf und zerplatzen bunt.' },
      ],
    },
    {
      id: 'theme', name: 'Farbthemen', icon: '🎨', items: [
        { id: 'tavern',  name: 'Taverne',      icon: '🍺', rarity: 'common',    desc: 'Dunkles Grün wie ein Spieltisch.' },
        { id: 'ocean',   name: 'Tiefsee',      icon: '🌊', rarity: 'rare',      desc: 'Tiefes Blau, weit unter den Wellen.' },
        { id: 'volcano', name: 'Vulkan',       icon: '🌋', rarity: 'rare',      desc: 'Glühende Lava unter schwarzem Fels.' },
        { id: 'night',   name: 'Mitternacht',  icon: '🌙', rarity: 'epic',      desc: 'Violetter Himmel mit funkelnden Sternen.' },
        { id: 'ice',     name: 'Eispalast',    icon: '❄️', rarity: 'epic',      desc: 'Frostiges Blau, leise rieselt der Schnee.' },
        { id: 'royal',   name: 'Kaiserpalast', icon: '👑', rarity: 'legendary', desc: 'Schwarz und Gold – mit wanderndem Goldglanz.' },
      ],
    },
    {
      // Namensschild mit Titel – sehen auch die anderen in Spielen mit Freunden
      id: 'profile', name: 'Profil für Spiele mit Freunden', icon: '🎖️', items: [
        { id: 'sailor',   name: 'Matrose',        icon: '⛵', rarity: 'common',    title: '',               desc: 'Name und Bild – ganz schlicht.' },
        { id: 'helmsman', name: 'Steuermann',     icon: '🧭', rarity: 'rare',      title: 'Steuermann',     desc: 'Silbernes Namensschild mit Titel.' },
        { id: 'hunter',   name: 'Schatzjäger',    icon: '🗺️', rarity: 'rare',      title: 'Schatzjäger',    desc: 'Grünes Schild mit gestricheltem Kartenrand.' },
        { id: 'captain',  name: 'Kapitän',        icon: '⚓', rarity: 'epic',      title: 'Kapitän',        desc: 'Leuchtet in Tiefblau und Violett.' },
        { id: 'kraken',   name: 'Krakenbändiger', icon: '🦑', rarity: 'epic',      title: 'Krakenbändiger', desc: 'Dunkles Meeresgrün, das in Wellen glüht.' },
        { id: 'admiral',  name: 'Großadmiral',    icon: '🎖️', rarity: 'legendary', title: 'Großadmiral',    desc: 'Goldenes Schild mit wanderndem Glanz – alle am Tisch sehen es.' },
      ],
    },
    {
      // Filz der Spieltische (Blackjack, Poker, Roulette, Lügenwürfel) und die Kartenrücken
      id: 'table', name: 'Casino-Look', icon: '🃏', items: [
        { id: 'felt',     name: 'Grüner Filz',  icon: '🟩', rarity: 'common',    desc: 'Der klassische Spieltisch.' },
        { id: 'velvet',   name: 'Blauer Samt',  icon: '🟦', rarity: 'rare',      desc: 'Tiefblauer Samt und blaue Kartenrücken.' },
        { id: 'bordeaux', name: 'Bordeaux',     icon: '🍷', rarity: 'rare',      desc: 'Weinroter Filz, Karten mit goldenem Rand.' },
        { id: 'ebony',    name: 'Ebenholz',     icon: '🖤', rarity: 'epic',      desc: 'Schwarzer Filz, silberne Rauten auf den Karten.' },
        { id: 'map',      name: 'Schatzkarte',  icon: '📜', rarity: 'epic',      desc: 'Ein Tisch aus altem Kartenleder – ☠ auf jeder Karte.' },
        { id: 'emperor',  name: 'Kaisertisch',  icon: '🏰', rarity: 'legendary', desc: 'Schwarz und Gold, goldene Bande und Kronen auf den Karten.' },
      ],
    },
  ];

  const ITEMS = [];
  CATEGORIES.forEach(cat => cat.items.forEach(item => ITEMS.push(Object.assign({ category: cat.id }, item))));
  const byId = Object.fromEntries(ITEMS.map(item => [item.id, item]));
  const DEFAULTS = Object.fromEntries(CATEGORIES.map(cat => [cat.id, cat.items[0].id]));
  const COLLECTIBLE = ITEMS.filter(item => item.rarity !== 'common');

  const WHEEL_SEGMENTS = 8;
  const WHEEL_ITEMS = 5;        // so viele Cosmetics stehen höchstens auf dem Rad, der Rest ist „Flaute“
  const FLAUTE_SLOTS = [1, 4, 6];
  const WHEEL_SPIN_TIME = 4600; // ms
  const FLAUTE_ICON = '💤';     // Flaute: kein Wind, die Segel hängen – diesmal kein Fang

  // Klick-Effekte: o = { crit, hot }
  const EFFECTS = {
    coins: (x, y, o) => GK.fx.burst(x, y, {
      count: o.crit ? 14 : o.hot ? 5 : 2, speed: o.crit ? 700 : 420, upward: true, spread: o.crit ? 2.8 : 2.4,
      size: o.crit ? undefined : 7, colors: byId[equipped('coin')].coins,
    }),
    sparks: (x, y, o) => GK.fx.burst(x, y, { kind: 'sparkle', count: o.crit ? 32 : o.hot ? 12 : 7, speed: o.crit ? 900 : 620, upward: true, spread: 2.8 }),
    bubbles: (x, y, o) => GK.fx.burst(x, y, { kind: 'bubble', count: o.crit ? 24 : o.hot ? 9 : 5 }),
    clover: (x, y, o) => GK.fx.burst(x, y, { kind: 'emoji', char: '🍀', count: o.crit ? 12 : o.hot ? 4 : 2, speed: o.crit ? 650 : 430, upward: true, spread: 2.4 }),
    flames: (x, y, o) => GK.fx.burst(x, y, { kind: 'flame', count: o.crit ? 42 : o.hot ? 16 : 10, speed: o.crit ? 280 : 170 }),
    fireworks: (x, y, o) => GK.fx.burst(x, y, { kind: 'firework', count: o.crit ? 3 : o.hot ? 2 : 1 }),
  };

  let overlay = null;
  let lastSignature = '';

  function store() {
    return GK.state.cosmetics;
  }

  function owns(id) {
    return byId[id] && (byId[id].rarity === 'common' || store().owned.includes(id));
  }

  // Angelegtes Cosmetic einer Kategorie (nur, wenn man es auch besitzt)
  function equipped(category) {
    const id = store().equipped[category];
    return byId[id] && byId[id].category === category && owns(id) ? id : DEFAULTS[category];
  }

  function unowned() {
    return COLLECTIBLE.filter(item => !owns(item.id));
  }

  function completeCategories() {
    return CATEGORIES.filter(cat => cat.items.every(item => owns(item.id))).length;
  }

  // ---------- Aussehen anwenden ----------

  function apply() {
    const coin = byId[equipped('coin')];
    const stage = document.querySelector('.coin-stage');
    if (stage) {
      ITEMS.filter(i => i.category === 'coin').forEach(i => stage.classList.toggle('coin-skin-' + i.id, i.id === coin.id));
      const inner = stage.querySelector('.big-coin-inner');
      if (inner) inner.textContent = coin.letter;
    }
    const theme = equipped('theme');
    if (theme === DEFAULTS.theme) delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
    const table = equipped('table');
    if (table === DEFAULTS.table) delete document.documentElement.dataset.table;
    else document.documentElement.dataset.table = table;
  }

  // ---------- Profil in Spielen mit Freunden ----------

  const escapeHtml = text => String(text == null ? '' : text).replace(/[&<>"']/g, ch =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  // Eigenes Namensschild, das an die anderen geschickt wird ('' = schlicht)
  function myBadge() {
    const id = equipped('profile');
    return id === DEFAULTS.profile ? '' : id;
  }

  // Von anderen empfangenes Namensschild prüfen (nur bekannte Profil-Cosmetics)
  function validBadge(id) {
    return byId[id] && byId[id].category === 'profile' && byId[id].rarity !== 'common' ? id : '';
  }

  // Bild + Name eines Spielers, mit Namensschild und Titel, wenn er eins trägt (p: { name, avatar, badge })
  function nameTag(p) {
    const base = `${p.avatar || ''} ${escapeHtml(p.name)}`.trim();
    const item = byId[validBadge(p.badge)];
    if (!item) return base;
    return `<span class="nametag nt-${item.id}"><span class="nt-name">${base}</span><span class="nt-title">${item.title}</span></span>`;
  }

  // Spielweiter Name und Bild (für die Vorschau)
  function myProfile() {
    return { name: GK.player.name(), avatar: GK.player.avatar() };
  }

  function equip(id) {
    if (!owns(id)) return;
    store().equipped[byId[id].category] = id;
    GK.save();
    apply();
    GK.sound.play('chip');
    lastSignature = '';
    render();
  }

  // Wird bei jedem Klick auf die große Münze aufgerufen
  function clickBurst(x, y, opts = {}) {
    EFFECTS[equipped('effect')](x, y, opts);
  }

  // ---------- Kaufen: Dublonen + ein Teil der Gebäude ----------

  function totalBuildings() {
    return Object.values(GK.state.buildings).reduce((sum, n) => sum + n, 0);
  }

  // Wie viele Gebäude gehen weg, und wie hoch ist das Einkommen danach?
  function buildingLoss(share) {
    const before = Object.assign({}, GK.state.buildings);
    const after = {};
    let lost = 0;
    Object.entries(before).forEach(([id, n]) => {
      const gone = Math.floor(n * share);
      after[id] = n - gone;
      lost += gone;
    });
    const cpsBefore = GK.clicker.getCps();
    GK.state.buildings = after;
    const cpsAfter = GK.clicker.getCps();
    GK.state.buildings = before;
    return { lost, after, cpsBefore, cpsAfter };
  }

  // Warum man (noch) nicht kaufen kann – leer, wenn es geht
  function buyBlocker(item) {
    const r = RARITIES[item.rarity];
    if (totalBuildings() < r.minBuildings) return `Ab ${GK.formatNumber(r.minBuildings)} Gebäuden`;
    if (!GK.canAfford(r.price)) return 'Zu wenig Dublonen';
    return '';
  }

  function buy(id) {
    const item = byId[id];
    if (!item || owns(id) || buyBlocker(item)) return;
    const r = RARITIES[item.rarity];
    const loss = buildingLoss(r.share);
    const text = `${item.icon} ${item.name} kaufen?\n\n` +
      `Du zahlst ${GK.formatNumber(r.price)} Dublonen und gibst ${r.shareText} deiner Gebäude ab ` +
      `(${GK.formatNumber(loss.lost)} von ${GK.formatNumber(totalBuildings())}).\n` +
      `Dein Einkommen sinkt von ${GK.formatNumber(loss.cpsBefore, true)} auf ${GK.formatNumber(loss.cpsAfter, true)} pro Sekunde.\n\n` +
      'Upgrades, Schatzkarten und Erfolge bleiben.';
    if (!confirm(text)) return;
    if (!GK.spend(r.price)) return;
    GK.state.buildings = loss.after;
    store().owned.push(id);
    store().equipped[item.category] = id;
    GK.save();
    GK.clicker.refresh();
    apply();
    celebrate(item);
    GK.achievements.check();
    lastSignature = '';
    render();
  }

  function celebrate(item) {
    const top = item.rarity === 'legendary';
    GK.sound.play(top ? 'jackpot' : 'powerup');
    GK.fx.confetti(top ? 200 : 110);
    if (top) GK.fx.coinRain(2, 40);
    GK.notify(`<span class="notify-icon">${item.icon}</span><span><b>${item.name}</b> gehört jetzt dir!<br>` +
      `${RARITIES[item.rarity].name} · ${item.desc}</span>`, 5000);
  }

  // ---------- Glücksrad nach der großen Fahrt ----------

  // Zufällig (nach Gewicht) bis zu 5 Cosmetics, die man noch nicht hat, dazu mindestens 3× „Flaute“
  function createWheel() {
    const pool = unowned();
    const picks = [];
    while (picks.length < WHEEL_ITEMS && pool.length) {
      const item = GK.rng.weighted(pool.map(i => ({ id: i.id, weight: RARITIES[i.rarity].weight })));
      picks.push(item.id);
      pool.splice(pool.findIndex(i => i.id === item.id), 1);
    }
    GK.rng.shuffle(picks);
    const segments = [];
    for (let i = 0; i < WHEEL_SEGMENTS; i++) segments.push(FLAUTE_SLOTS.includes(i) ? null : picks.shift() || null);
    return { segments };
  }

  // Nach der großen Fahrt: Rad anlegen (gespeichert, damit Neuladen nichts ändert) und zeigen
  function journeyReward() {
    if (!unowned().length) return false;
    store().wheel = createWheel();
    GK.save();
    setTimeout(openWheel, 1400);
    return true;
  }

  const SEGMENT_COLORS = { rare: '#1d5d8c', epic: '#5b2a8c', legendary: '#a67c0c', none: '#24302b' };

  function openWheel() {
    const wheel = store().wheel;
    if (!wheel || overlay) return;
    const size = 360 / WHEEL_SEGMENTS;
    const stops = wheel.segments.map((id, i) => {
      const color = SEGMENT_COLORS[id ? byId[id].rarity : 'none'];
      return `${color} ${i * size}deg ${(i + 1) * size}deg`;
    }).join(', ');
    overlay = document.createElement('div');
    overlay.className = 'cos-overlay';
    overlay.innerHTML = `
      <div class="cos-dialog" role="dialog" aria-modal="true" aria-label="Glücksrad der großen Fahrt">
        <h2>🎡 Glücksrad der großen Fahrt</h2>
        <p class="muted">Auf deiner Fahrt hast du ein paar Schätze entdeckt – dreh am Rad und hol dir einen davon!</p>
        <div class="cos-wheel-wrap">
          <div class="cos-pointer">▼</div>
          <div class="cos-wheel" style="background: conic-gradient(${stops})">
            ${wheel.segments.map((id, i) => `
              <span class="cos-seg" style="transform: rotate(${i * size + size / 2}deg)">
                <span class="cos-seg-icon">${id ? byId[id].icon : FLAUTE_ICON}</span>
              </span>`).join('')}
            <div class="cos-hub">⚓</div>
          </div>
        </div>
        <ul class="cos-legend">
          ${[...new Set(wheel.segments.filter(Boolean))].map(id => `
            <li class="cos-${byId[id].rarity}"><span>${byId[id].icon}</span> ${byId[id].name} <small>${RARITIES[byId[id].rarity].name}</small></li>`).join('')}
          <li class="cos-none"><span>${FLAUTE_ICON}</span> Flaute <small>diesmal kein Fang</small></li>
        </ul>
        <div class="cos-result" aria-live="polite"></div>
        <div class="game-actions cos-actions">
          <button class="btn btn-primary btn-big cos-spin">🎡 Drehen!</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('.cos-spin').addEventListener('click', spinWheel);
  }

  function spinWheel() {
    const wheel = store().wheel;
    if (!wheel || !overlay) return;
    const index = GK.rng.int(WHEEL_SEGMENTS);
    const id = wheel.segments[index];
    // Ergebnis sofort speichern – Neuladen während der Drehung kostet nichts
    if (id && !owns(id)) store().owned.push(id);
    store().wheel = null;
    GK.save();

    const button = overlay.querySelector('.cos-spin');
    button.disabled = true;
    const size = 360 / WHEEL_SEGMENTS;
    const jitter = (GK.rng.float() - 0.5) * size * 0.6;
    const angle = 360 * 6 + 360 - (index * size + size / 2) + jitter;
    const disc = overlay.querySelector('.cos-wheel');
    const fast = GK.state.settings.effects === 'reduced';
    const time = fast ? 900 : WHEEL_SPIN_TIME;
    disc.style.transition = `transform ${time}ms cubic-bezier(0.12, 0.7, 0.18, 1)`;
    disc.style.transform = `rotate(${angle}deg)`;
    GK.sound.play('spinStart');
    // Klicken wie bei einem echten Rad: erst schnell, dann immer langsamer
    for (let t = 0, step = 60; t < time - 200; t += step, step *= 1.09) setTimeout(() => GK.sound.play('tick'), t);
    setTimeout(() => showResult(id), time + 150);
    GK.achievements.check();
  }

  function showResult(id) {
    if (!overlay) return;
    const result = overlay.querySelector('.cos-result');
    const actions = overlay.querySelector('.cos-actions');
    if (!id) {
      GK.sound.play('lose');
      result.innerHTML = `<div class="cos-won cos-none"><span class="cos-won-icon">${FLAUTE_ICON}</span><b>Flaute</b> – diesmal kein Fang.<br>` +
        '<span class="muted">Viel Glück bei der nächsten großen Fahrt!</span></div>';
      actions.innerHTML = '<button class="btn btn-primary cos-close">Weiter</button>';
    } else {
      const item = byId[id];
      celebrate(item);
      result.innerHTML = `<div class="cos-won cos-${item.rarity}"><span class="cos-won-icon">${item.icon}</span>` +
        `<b>${item.name}</b> <small>${RARITIES[item.rarity].name}</small><br><span class="muted">${item.desc}</span></div>`;
      actions.innerHTML = '<button class="btn btn-primary cos-equip">Gleich anlegen</button><button class="btn cos-close">Später</button>';
      actions.querySelector('.cos-equip').addEventListener('click', () => {
        equip(id);
        closeWheel();
      });
    }
    actions.querySelector('.cos-close').addEventListener('click', closeWheel);
  }

  function closeWheel() {
    if (overlay) overlay.remove();
    overlay = null;
    lastSignature = '';
    render();
  }

  // ---------- Schatzkammer im Tab „Fortschritt“ ----------

  function preview(item) {
    if (item.category === 'coin') return `<span class="mini-coin coin-skin-${item.id}"><span>${item.letter}</span></span>`;
    if (item.category === 'theme') return `<span class="theme-swatch" data-swatch="${item.id}"><i></i><i></i><i></i></span>`;
    if (item.category === 'profile') return `<span class="profile-preview">${nameTag(Object.assign(myProfile(), { badge: item.id }))}</span>`;
    if (item.category === 'table') return `<span class="table-swatch table-look-${item.id}"><i class="ts-card"></i><i class="ts-card"></i></span>`;
    return `<span class="effect-icon">${item.icon}</span>`;
  }

  function tile(item) {
    const own = owns(item.id);
    const on = equipped(item.category) === item.id;
    const r = RARITIES[item.rarity];
    let action;
    if (on) action = '<button class="btn btn-small cos-action" disabled>✓ Angelegt</button>';
    else if (own) action = `<button class="btn btn-small cos-action" data-equip="${item.id}">Anlegen</button>`;
    else {
      const blocker = buyBlocker(item);
      action = `<button class="btn btn-small btn-primary cos-action" data-buy="${item.id}" ${blocker ? 'disabled' : ''}>${blocker || '🔓 Kaufen'}</button>
        <span class="cos-price">${GK.formatMoneyHTML(r.price)} + ${r.shareText} deiner Gebäude</span>`;
    }
    return `
      <div class="cos-tile cos-${item.rarity}${own ? ' owned' : ''}${on ? ' equipped' : ''}" data-id="${item.id}">
        <button class="cos-preview" data-preview="${item.id}" aria-label="Vorschau ${item.name}">${preview(item)}</button>
        <span class="cos-name">${item.name}${own ? '' : ' 🔒'}</span>
        <span class="cos-rarity">${r.name}</span>
        <span class="cos-desc">${item.desc}</span>
        ${action}
      </div>`;
  }

  function render() {
    const el = document.getElementById('cosmetics');
    if (!el) return;
    const signature = JSON.stringify([store().owned, CATEGORIES.map(c => equipped(c.id)),
      COLLECTIBLE.map(item => buyBlocker(item))]);
    if (signature === lastSignature) return;
    lastSignature = signature;
    document.getElementById('cosmetic-count').textContent = `(${store().owned.length}/${COLLECTIBLE.length})`;
    el.innerHTML = CATEGORIES.map(cat => `
      <section class="cos-category">
        <h3>${cat.icon} ${cat.name}</h3>
        <div class="cos-grid">${cat.items.map(item => tile(byId[item.id])).join('')}</div>
      </section>`).join('');
  }

  function onClick(e) {
    const equipBtn = e.target.closest('[data-equip]');
    const buyBtn = e.target.closest('[data-buy]');
    const previewBtn = e.target.closest('[data-preview]');
    if (equipBtn) equip(equipBtn.dataset.equip);
    else if (buyBtn) buy(buyBtn.dataset.buy);
    else if (previewBtn) {
      const item = byId[previewBtn.dataset.preview];
      if (item.category !== 'effect') return;
      const c = GK.fx.center(previewBtn);
      EFFECTS[item.id](c.x, c.y, { hot: true });
    }
  }

  function init() {
    document.getElementById('cosmetics').addEventListener('click', onClick);
    refresh();
  }

  // Nach dem Laden, Importieren oder Zurücksetzen
  function refresh() {
    if (overlay) closeWheel();
    lastSignature = '';
    apply();
    render();
    // Ein Rad, das vor dem Neuladen noch nicht gedreht wurde, wartet weiter
    if (store().wheel) openWheel();
  }

  GK.cosmetics = {
    init, refresh, render, apply, equip, buy, clickBurst, journeyReward, completeCategories,
    nameTag, myBadge, validBadge,
    unownedCount: () => unowned().length,
    total: COLLECTIBLE.length,
    CATEGORIES, RARITIES,
    _spin: spinWheel, // für Tests
    _createWheel: createWheel,
    _ITEMS: ITEMS,
  };
})();
