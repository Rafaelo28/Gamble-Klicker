// Flotte & Expeditionen (Tab „⚓ Abenteuer“): Schiffe kaufen und ausbauen und auf Fahrt schicken – die Fahrt
// läuft weiter, auch wenn das Spiel geschlossen ist. Zurück bringen die Schiffe Beute und manchmal einen Schatz,
// der dauerhaft Boni gibt. Wie eine Fahrt ausgeht, wird beim Ablegen ausgelost und sofort gespeichert –
// Neuladen ändert nichts daran. Beute und Preise richten sich nach dem besten Einkommen, das man je hatte
// (so bleibt die Flotte auch nach einer großen Fahrt stark, wird dann aber auch nicht billiger).
window.GK = window.GK || {};

(function () {
  // Eigenes Symbol (js/icons.js); in den Tests ohne Browser gibt es keins
  const ic = name => (GK.icon ? GK.icon(name) : '');

  const H = 3600;
  const MAX_LEVEL = 30;
  const LEVEL_GAIN = 1.1;   // Laderaum je Stufe
  const LEVEL_COST = 1.75;  // Preis je Stufe
  const WIND_COST = 0.25;   // Rückenwind: Einkommen eines Viertels der restlichen Zeit
  const LOG_MAX = 12;

  // price: Kaufpreis in Sekunden Einkommen · hold: Laderaum · speed: schneller = kürzere Fahrt, gleiche Beute
  const SHIPS = [
    { id: 'sloop',   name: 'Schaluppe',     price: 300,    hold: 1,   speed: 1,    masts: 1, sail: '#f4efe0', hull: '#8a5a2b' },
    { id: 'brig',    name: 'Brigg',         price: H,      hold: 1.3, speed: 1.1,  masts: 2, sail: '#f4efe0', hull: '#6b3f1d' },
    { id: 'frigate', name: 'Fregatte',      price: 4 * H,  hold: 1.7, speed: 1.25, masts: 3, sail: '#ece4cc', hull: '#3b2a1a', ports: true },
    { id: 'galleon', name: 'Galeone',       price: 12 * H, hold: 2.2, speed: 1.05, masts: 3, sail: '#c0392b', hull: '#5a2d0c', ports: true, gold: true },
    { id: 'ghost',   name: 'Geisterschiff', price: 48 * H, hold: 3,   speed: 1.5,  masts: 3, sail: '#a9bdd2', hull: '#2b3440', ports: true, ghost: true },
  ];

  // time: Dauer in Sekunden (Schaluppe) · loot: Beute je Sekunde Fahrt (Anteil vom Einkommen) · treasure: Schatz-Glück
  const DESTS = [
    { id: 'bay',      icon: '🏝️', name: 'Nahe Bucht',      time: 120,    loot: 0.12, treasure: 0.04, rank: 0 },
    { id: 'reef',     icon: '🐚', name: 'Korallenriff',    time: 900,    loot: 0.14, treasure: 0.1,  rank: 0 },
    { id: 'smuggler', icon: '🏴‍☠️', name: 'Schmugglerinsel', time: H,      loot: 0.15, treasure: 0.2,  rank: 1 },
    { id: 'volcano',  icon: '🌋', name: 'Vulkaninsel',     time: 2 * H,  loot: 0.15, treasure: 0.3,  rank: 2 },
    { id: 'ice',      icon: '🧊', name: 'Eismeer',         time: 4 * H,  loot: 0.15, treasure: 0.42, rank: 3 },
    { id: 'dragon',   icon: '🐉', name: 'Drachenküste',    time: 8 * H,  loot: 0.15, treasure: 0.6,  rank: 4 },
  ];

  // Schätze: je Ziel drei. income = % Einkommen, loot = % Beute, speed = % kürzere Fahrten
  const TREASURES = [
    { id: 'pearl',     dest: 'bay',      icon: '🦪', name: 'Perlmuschel',        income: 2 },
    { id: 'bottle',    dest: 'bay',      icon: '📜', name: 'Flaschenpost',       loot: 5 },
    { id: 'starfish',  dest: 'bay',      icon: '⭐', name: 'Seestern-Amulett',   income: 2 },
    { id: 'coral',     dest: 'reef',     icon: '🌺', name: 'Rote Koralle',       income: 3 },
    { id: 'bigpearl',  dest: 'reef',     icon: '🔮', name: 'Riesenperle',        income: 3 },
    { id: 'comb',      dest: 'reef',     icon: '🧜', name: 'Meerjungfrauen-Kamm', loot: 8 },
    { id: 'spices',    dest: 'smuggler', icon: '🌶️', name: 'Gewürzkiste',        speed: 5 },
    { id: 'map',       dest: 'smuggler', icon: '🗺️', name: 'Schmugglerkarte',    loot: 10 },
    { id: 'amphora',   dest: 'smuggler', icon: '🏺', name: 'Antike Amphore',     income: 4 },
    { id: 'opal',      dest: 'volcano',  icon: '🔥', name: 'Feuer-Opal',         income: 5 },
    { id: 'dagger',    dest: 'volcano',  icon: '🗡️', name: 'Obsidian-Dolch',     income: 4 },
    { id: 'compass',   dest: 'volcano',  icon: '🧭', name: 'Lava-Kompass',       speed: 5 },
    { id: 'icegem',    dest: 'ice',      icon: '💎', name: 'Eis-Diamant',        income: 6 },
    { id: 'tusk',      dest: 'ice',      icon: '🦣', name: 'Mammut-Stoßzahn',    loot: 12 },
    { id: 'lantern',   dest: 'ice',      icon: '🏮', name: 'Nordlicht-Laterne',  speed: 5 },
    { id: 'egg',       dest: 'dragon',   icon: '🥚', name: 'Drachenei',          income: 10 },
    { id: 'scale',     dest: 'dragon',   icon: '🐲', name: 'Drachenschuppe',     income: 8 },
    { id: 'hoard',     dest: 'dragon',   icon: '👑', name: 'Drachengold',        loot: 20 },
  ];

  // Ausgang einer Fahrt (beim Ablegen ausgelost)
  const OUTCOMES = [
    { id: 'storm',  p: 0.12, mult: 0.5, icon: '⛈️', text: 'Sturm! Die halbe Ladung ging über Bord.' },
    { id: 'normal', p: 0.70, mult: 1,   icon: '⚓', text: 'Gute Fahrt.' },
    { id: 'rich',   p: 0.15, mult: 2,   icon: '🐟', text: 'Reicher Fang – doppelte Beute!' },
    { id: 'gold',   p: 0.03, mult: 5,   icon: '🏆', text: 'Goldschatz entdeckt – fünffache Beute!' },
  ];

  const shipById = Object.fromEntries(SHIPS.map(x => [x.id, x]));
  const destById = Object.fromEntries(DESTS.map(x => [x.id, x]));
  const treasureById = Object.fromEntries(TREASURES.map(x => [x.id, x]));
  const outcomeById = Object.fromEntries(OUTCOMES.map(x => [x.id, x]));

  let now = () => Date.now(); // für Tests austauschbar

  const data = () => GK.state.fleet;
  const level = id => data().ships[id] || 0;
  const owns = id => level(id) > 0;
  const shipCount = () => SHIPS.filter(x => owns(x.id)).length;
  const found = id => (data().treasures[id] || 0) > 0;
  const foundCount = () => TREASURES.filter(t => found(t.id)).length;

  // ---------- Werte ----------

  // Bestes Einkommen pro Sekunde (dauerhafte Boni, ohne Goldrausch) – Grundlage für Preise und Beute
  function income() {
    const d = data();
    const cps = GK.clicker ? GK.clicker.getCpsPermanent() : 0;
    if (cps > d.peak) d.peak = cps;
    return Math.max(d.peak, 0.5);
  }

  function bonus(kind) {
    return TREASURES.reduce((sum, t) => sum + (found(t.id) ? t[kind] || 0 : 0), 0);
  }
  // Dauerhafter Einkommens-Bonus aus Schätzen (fließt in GK.progress.permanentMult ein)
  const incomeMult = () => 1 + bonus('income') / 100;
  const lootMult = () => 1 + bonus('loot') / 100;
  const timeMult = () => 1 - bonus('speed') / 100;

  const holdOf = id => shipById[id].hold * Math.pow(LEVEL_GAIN, Math.max(0, level(id) - 1));
  const durationOf = (shipId, destId) => Math.round(destById[destId].time / shipById[shipId].speed * timeMult());

  // Beute einer normalen Fahrt (ohne Glück und Pech)
  function expectedLoot(shipId, destId) {
    const dest = destById[destId];
    return Math.floor(income() * dest.time * dest.loot * holdOf(shipId) * lootMult());
  }

  function buyPrice(id) {
    return Math.ceil(shipById[id].price * income());
  }

  function upgradePrice(id) {
    return Math.ceil(shipById[id].price * income() * Math.pow(LEVEL_COST, level(id)));
  }

  // Nur das nächste Schiff in der Reihe kann gekauft werden
  function canBuy(id) {
    const i = SHIPS.findIndex(x => x.id === id);
    return !owns(id) && (i === 0 || owns(SHIPS[i - 1].id));
  }

  const destOpen = dest => !GK.rank || GK.rank.mine() >= dest.rank;

  function windPrice(id) {
    const v = data().voyages[id];
    if (!v) return 0;
    return Math.ceil(income() * Math.max(0, (v.end - now()) / 1000) * WIND_COST);
  }

  const isBack = id => { const v = data().voyages[id]; return !!v && now() >= v.end; };
  const readyCount = () => SHIPS.filter(x => isBack(x.id)).length;

  // ---------- Aktionen ----------

  function buy(id) {
    if (!shipById[id] || !canBuy(id)) return false;
    if (!GK.spend(buyPrice(id))) {
      GK.sound.play('denied');
      return false;
    }
    data().ships[id] = 1;
    GK.save();
    GK.sound.play('buy');
    GK.toast(`⛵ Die ${shipById[id].name} gehört jetzt dir!`);
    return true;
  }

  function upgrade(id) {
    if (!owns(id) || level(id) >= MAX_LEVEL) return false;
    if (!GK.spend(upgradePrice(id))) {
      GK.sound.play('denied');
      return false;
    }
    data().ships[id]++;
    GK.save();
    GK.sound.play('upgrade');
    return true;
  }

  function pickOutcome() {
    let r = GK.rng.float();
    for (const o of OUTCOMES) {
      if (r < o.p) return o;
      r -= o.p;
    }
    return OUTCOMES[1];
  }

  // Ablegen: Ausgang, Beute und Schatz stehen ab jetzt fest
  function send(shipId, destId) {
    const d = data();
    const dest = destById[destId];
    if (!owns(shipId) || !dest || d.voyages[shipId] || !destOpen(dest)) return false;
    const outcome = pickOutcome();
    const pool = TREASURES.filter(t => t.dest === destId);
    const treasure = GK.rng.float() < dest.treasure ? pool[GK.rng.int(pool.length)].id : '';
    const start = now();
    d.voyages[shipId] = {
      dest: destId, start, end: start + durationOf(shipId, destId) * 1000,
      loot: Math.floor(expectedLoot(shipId, destId) * outcome.mult), outcome: outcome.id, treasure, wind: false,
    };
    d.last[shipId] = destId;
    GK.save();
    if (GK.daily) GK.daily.track('voyage', 1);
    GK.sound.play('horn');
    return true;
  }

  // Alle Schiffe im Hafen zu ihrem letzten Ziel (bzw. in die Bucht) schicken
  function sendAll() {
    let n = 0;
    SHIPS.forEach(x => {
      if (!owns(x.id) || data().voyages[x.id]) return;
      const last = destById[data().last[x.id]];
      if (send(x.id, last && destOpen(last) ? last.id : 'bay')) n++;
    });
    return n;
  }

  // Rückenwind: einmal je Fahrt die restliche Zeit halbieren
  function wind(id) {
    const v = data().voyages[id];
    if (!v || v.wind || now() >= v.end) return false;
    if (!GK.spend(windPrice(id))) {
      GK.sound.play('denied');
      return false;
    }
    v.end = now() + Math.ceil((v.end - now()) / 2);
    v.wind = true;
    GK.save();
    GK.sound.play('powerup');
    return true;
  }

  // Beute abholen. Gibt das Ergebnis zurück (für Anzeige und Tests).
  function collect(id) {
    const d = data();
    const v = d.voyages[id];
    if (!v || now() < v.end) return null;
    delete d.voyages[id];
    const dest = destById[v.dest] || DESTS[0];
    const outcome = outcomeById[v.outcome] || OUTCOMES[1];
    let loot = Math.max(0, Number(v.loot) || 0);
    let treasure = null;
    let duplicate = false;
    if (treasureById[v.treasure]) {
      treasure = treasureById[v.treasure];
      duplicate = found(treasure.id);
      d.treasures[treasure.id] = (d.treasures[treasure.id] || 0) + 1;
      // Doppelt gefunden: wird verkauft
      if (duplicate) loot += Math.floor(income() * 900 * dest.loot * 3);
    }
    GK.earn(loot, 'fleet');
    d.done++;
    d.earned += loot;
    const entry = { ship: id, dest: dest.id, outcome: outcome.id, loot, treasure: treasure ? treasure.id : '', duplicate, t: now() };
    d.log.unshift(entry);
    d.log.length = Math.min(d.log.length, LOG_MAX);
    GK.save();
    return entry;
  }

  function collectAll() {
    return SHIPS.filter(x => isBack(x.id)).map(x => collect(x.id));
  }

  // ---------- Anzeige ----------

  const $ = id => document.getElementById(id);

  // Uhrzeit-Stil für Countdowns: 1:05:09 bzw. 4:07
  function clock(seconds) {
    seconds = Math.max(0, Math.ceil(seconds));
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const two = n => String(n).padStart(2, '0');
    return h ? `${h}:${two(m)}:${two(s)}` : `${m}:${two(s)}`;
  }

  // Dauer kurz: „2 Min.“, „1 Std.“, „1½ Std.“
  function short(seconds) {
    if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))} Min.`;
    const h = seconds / 3600;
    return `${GK.formatDecimal(Math.round(h * 10) / 10, 0, 1)} Std.`;
  }

  // Schiff als SVG (ohne IDs, beliebig oft auf einer Seite)
  const shipSvgCache = {};
  function shipSvg(id) {
    if (shipSvgCache[id]) return shipSvgCache[id];
    const s = shipById[id];
    const xs = s.masts === 1 ? [60] : s.masts === 2 ? [46, 76] : [36, 60, 84];
    const line = 'stroke="#2a1a0c" stroke-width="1.5" stroke-linejoin="round"';
    let out = `<svg class="ship-svg" viewBox="0 0 120 92" aria-hidden="true">`;
    xs.forEach((x, i) => {
      const top = i === Math.floor(xs.length / 2) ? 8 : 16;
      out += `<path d="M${x} 60 L${x} ${top}" stroke="#4a2d14" stroke-width="2.5"/>`;
      const sail = (y, w, h) => {
        const bottom = s.ghost
          ? `L${x + w - 2} ${y + h} L${x + 4} ${y + h - 4} L${x} ${y + h + 1} L${x - 5} ${y + h - 4} L${x - w + 2} ${y + h}`
          : `Q${x} ${y + h + 4} ${x - w + 2} ${y + h}`;
        return `<path d="M${x - w} ${y} Q${x} ${y - 4} ${x + w} ${y} L${x + w - 2} ${y + h} ${bottom} Z" fill="${s.sail}" ${s.ghost ? 'fill-opacity="0.8"' : ''} ${line}/>`;
      };
      out += sail(top + 5, s.masts === 1 ? 18 : 13, s.masts === 3 ? 13 : 18);
      if (s.masts > 1) out += sail(top + (s.masts === 3 ? 22 : 27), s.masts === 3 ? 11 : 12, s.masts === 3 ? 13 : 14);
      if (s.masts === 1) out += `<path d="M${x + 2} ${top + 30} L${x + 28} 54 L${x + 2} 54 Z" fill="${s.sail}" ${line}/>`;
    });
    const main = xs[Math.floor(xs.length / 2)];
    out += `<path d="M${main} 8 L${main + 14} 11 L${main} 14 Z" fill="${s.ghost ? '#cfe0f0' : '#16181d'}"/>`;
    out += `<path d="M8 58 L112 58 L100 80 Q60 86 20 80 Z" fill="${s.hull}" ${line}/>`;
    out += `<path d="M10 62 L110 62" stroke="${s.gold ? '#f5c542' : 'rgba(255,255,255,.25)'}" stroke-width="${s.gold ? 2.4 : 1.2}"/>`;
    if (s.ports) [30, 45, 60, 75, 90].forEach(x => { out += `<circle cx="${x}" cy="70" r="2.6" fill="#1a1008" stroke="${s.gold ? '#f5c542' : '#8a6a4a'}" stroke-width="0.8"/>`; });
    out += `<path d="M104 58 L116 52" stroke="#4a2d14" stroke-width="2.2"/>`;
    out += '</svg>';
    shipSvgCache[id] = out;
    return out;
  }

  function outcomeLine(e) {
    const o = outcomeById[e.outcome] || OUTCOMES[1];
    const t = treasureById[e.treasure];
    return `${o.icon} ${o.text}${t ? ` ${t.icon} ${e.duplicate ? `${t.name} (doppelt, verkauft)` : `Neuer Schatz: <b>${t.name}</b>!`}` : ''}`;
  }

  function treasureEffect(t) {
    if (t.income) return `+${t.income} % Einkommen`;
    if (t.loot) return `+${t.loot} % Beute`;
    return `−${t.speed} % Fahrzeit`;
  }

  // Karte eines Schiffs. Zeit und Balken werden in update() an Ort und Stelle geändert.
  function shipCard(x, i) {
    const d = data();
    const lvl = level(x.id);
    if (!lvl) {
      const open = canBuy(x.id);
      const price = buyPrice(x.id);
      return `<div class="fleet-ship locked" data-ship="${x.id}">
        <div class="fleet-pic">${shipSvg(x.id)}</div>
        <div class="fleet-info"><div class="fleet-name">${x.name}</div>
          <div class="muted small">Laderaum ×${GK.formatDecimal(x.hold, 0, 2)} · Tempo ×${GK.formatDecimal(x.speed, 0, 2)}</div></div>
        ${open
          ? `<button type="button" class="btn btn-primary fleet-btn" data-act="buy" ${GK.canAfford(price) ? '' : 'disabled'}>Kaufen: ${GK.formatMoneyHTML(price)}</button>`
          : `<p class="muted small fleet-hint">${ic('lock')} Erst die ${SHIPS[i - 1].name} kaufen</p>`}
      </div>`;
    }
    const v = d.voyages[x.id];
    let body;
    if (!v) {
      body = `<div class="fleet-dests">${DESTS.map(dest => {
        if (!destOpen(dest)) {
          return `<button type="button" class="fleet-dest locked" data-act="lockedDest" data-dest="${dest.id}" title="Ab Rang ${GK.rank.name(dest.rank)}">
            <span class="fd-icon">${ic('lock')}</span><span class="fd-name">${dest.name}</span><span class="fd-meta">ab ${GK.rank.symbol(dest.rank)} ${GK.rank.name(dest.rank)}</span></button>`;
        }
        return `<button type="button" class="fleet-dest ${d.last[x.id] === dest.id ? 'last' : ''}" data-act="send" data-dest="${dest.id}">
          <span class="fd-icon">${dest.icon}</span><span class="fd-name">${dest.name}</span>
          <span class="fd-meta">${ic('hourglass')} ${short(durationOf(x.id, dest.id))} · ≈ ${GK.formatMoneyHTML(expectedLoot(x.id, dest.id))}</span></button>`;
      }).join('')}</div>`;
    } else if (now() >= v.end) {
      const dest = destById[v.dest] || DESTS[0];
      body = `<div class="fleet-back">${ic('check')} Zurück von: ${dest.icon} ${dest.name}!</div>
        <button type="button" class="btn btn-primary btn-big fleet-btn fleet-collect" data-act="collect">${ic('bag')}Beute abholen</button>`;
    } else {
      const dest = destById[v.dest] || DESTS[0];
      const price = windPrice(x.id);
      body = `<div class="fleet-sea">${ic('compass')} Unterwegs: ${dest.icon} ${dest.name}</div>
        <div class="fleet-bar"><div></div></div>
        <div class="fleet-time muted small"></div>
        ${v.wind ? `<p class="muted small">${ic('wind')} Rückenwind ist gesetzt.</p>`
          : `<button type="button" class="btn btn-small fleet-btn" data-act="wind" ${GK.canAfford(price) ? '' : 'disabled'}>${ic('wind')}Rückenwind (halbe Zeit): ${GK.formatMoneyHTML(price)}</button>`}`;
    }
    const up = lvl < MAX_LEVEL ? upgradePrice(x.id) : 0;
    return `<div class="fleet-ship ${v ? (now() >= v.end ? 'is-back' : 'at-sea') : ''}" data-ship="${x.id}">
      <div class="fleet-pic">${shipSvg(x.id)}</div>
      <div class="fleet-info"><div class="fleet-name">${x.name} <span class="fleet-level">Stufe ${lvl}</span></div>
        <div class="muted small">Laderaum ×${GK.formatDecimal(holdOf(x.id), 0, 2)} · Tempo ×${GK.formatDecimal(x.speed, 0, 2)}</div></div>
      ${body}
      ${lvl < MAX_LEVEL
        ? `<button type="button" class="btn btn-small fleet-btn fleet-up" data-act="upgrade" ${GK.canAfford(up) ? '' : 'disabled'}>${ic('up')}Ausbauen (+10 % Laderaum): ${GK.formatMoneyHTML(up)}</button>`
        : `<p class="muted small">${ic('star')} Voll ausgebaut</p>`}
    </div>`;
  }

  // Signatur: Karten nur neu bauen, wenn sich etwas Sichtbares ändert (nicht 10× pro Sekunde)
  function shipsSig() {
    const d = data();
    return SHIPS.map(x => {
      const v = d.voyages[x.id];
      const parts = [x.id, level(x.id), d.last[x.id] || ''];
      if (!owns(x.id)) parts.push(canBuy(x.id), GK.canAfford(buyPrice(x.id)), GK.formatNumber(buyPrice(x.id)));
      else {
        parts.push(GK.formatNumber(upgradePrice(x.id)), GK.canAfford(upgradePrice(x.id)));
        if (!v) parts.push(DESTS.map(dest => destOpen(dest) + GK.formatNumber(expectedLoot(x.id, dest.id))).join());
        else parts.push(v.dest, v.wind, now() >= v.end, now() >= v.end || v.wind ? '' : `${GK.formatNumber(windPrice(x.id))}${GK.canAfford(windPrice(x.id))}`);
      }
      return parts.join(':');
    }).join('|');
  }

  function bindShips(box) {
    box._bound = true;
    box.addEventListener('click', e => {
      const btn = e.target.closest('[data-act]');
      const card = e.target.closest('.fleet-ship');
      if (!btn || !card || btn.disabled) return;
      const id = card.dataset.ship;
      const act = btn.dataset.act;
      if (act === 'buy') buy(id);
      else if (act === 'upgrade') upgrade(id);
      else if (act === 'send') send(id, btn.dataset.dest);
      else if (act === 'wind') wind(id);
      else if (act === 'lockedDest') {
        const dest = destById[btn.dataset.dest];
        GK.sound.play('denied');
        GK.toast(`🔒 ${dest.name}: ab Rang ${GK.rank.name(dest.rank)}`);
        return;
      } else if (act === 'collect') {
        const r = collect(id);
        if (r) celebrate([r], btn);
      }
      render(true);
    });
  }

  function celebrate(results, el) {
    const total = results.reduce((s, r) => s + r.loot, 0);
    const fresh = results.filter(r => r.treasure && !r.duplicate);
    const best = results.some(r => r.outcome === 'gold') ? 'gold' : results.some(r => r.outcome === 'rich') ? 'rich' : '';
    GK.sound.play(fresh.length || best === 'gold' ? 'jackpot' : best ? 'winBig' : 'collect');
    if (GK.fx && el) {
      const r = el.getBoundingClientRect();
      GK.fx.floatText(r.left + r.width / 2, r.top, '+' + GK.formatMoneyHTML(total), 'win');
      if (fresh.length || best === 'gold') GK.fx.confetti(80);
    }
    if (results.length === 1) GK.notify(`<span class="notify-icon">${shipSvg(results[0].ship)}</span><span><b>${shipById[results[0].ship].name}</b>: ${outcomeLine(results[0])}<br>+${GK.formatMoneyHTML(results[0].loot)}</span>`);
    else GK.notify(`<span class="notify-icon">${ic('anchor')}</span><span><b>${results.length} Schiffe entladen</b>: +${GK.formatMoneyHTML(total)}${fresh.length ? `<br>💎 Neue Schätze: ${fresh.map(r => treasureById[r.treasure].name).join(', ')}` : ''}</span>`);
  }

  let lastShips = '';
  let lastTreasures = '';
  let lastLog = '';

  function render(force) {
    const box = $('fleet-ships');
    if (!box) return;
    if (!box._bound) bindShips(box);
    const sig = shipsSig();
    if (force || sig !== lastShips) {
      lastShips = sig;
      box.innerHTML = SHIPS.map(shipCard).join('');
    }
    // Laufende Fahrten: Zeit und Balken (nur bei Änderung schreiben)
    const d = data();
    box.querySelectorAll('.fleet-ship.at-sea').forEach(card => {
      const v = d.voyages[card.dataset.ship];
      if (!v) return;
      const left = (v.end - now()) / 1000;
      const text = `noch ${clock(left)}`;
      const time = card.querySelector('.fleet-time');
      if (time && time.textContent !== text) {
        GK.setText(time, text);
        const frac = Math.min(1, Math.max(0, (now() - v.start) / (v.end - v.start)));
        card.querySelector('.fleet-bar > div').style.transform = `scaleX(${frac.toFixed(3)})`;
      }
    });
    // Kopf: Übersicht
    const atSea = Object.keys(d.voyages).length;
    const ready = readyCount();
    GK.setHTML($('fleet-summary'), `
      <dt>Schiffe</dt><dd>${shipCount()} von ${SHIPS.length}</dd>
      <dt>Auf See</dt><dd>${atSea - ready}${ready ? ` · ${ready} zurück im Hafen` : ''}</dd>
      <dt>Fahrten</dt><dd>${GK.formatNumber(d.done)}</dd>
      <dt>Beute insgesamt</dt><dd>${GK.formatMoneyHTML(d.earned)}</dd>
      <dt>Schätze</dt><dd>${foundCount()} von ${TREASURES.length}</dd>
      <dt>Bonus aus Schätzen</dt><dd>+${bonus('income')} % Einkommen · +${bonus('loot')} % Beute · −${bonus('speed')} % Fahrzeit</dd>`);
    const collectBtn = $('fleet-collect-all');
    const sendBtn = $('fleet-send-all');
    if (collectBtn) {
      collectBtn.disabled = !ready;
      GK.setHTML(collectBtn, `${ic('bag')}${ready > 1 ? `Alle ${ready} abholen` : 'Alle abholen'}`);
    }
    if (sendBtn) sendBtn.disabled = !SHIPS.some(x => owns(x.id) && !d.voyages[x.id]);
    // Schätze
    const tSig = TREASURES.map(t => d.treasures[t.id] || 0).join();
    if (force || tSig !== lastTreasures) {
      lastTreasures = tSig;
      GK.setText($('fleet-treasure-count'), `(${foundCount()} von ${TREASURES.length})`);
      $('fleet-treasures').innerHTML = DESTS.map(dest => `<div class="fleet-tset">
        <div class="fleet-tset-name">${dest.icon} ${dest.name}</div>
        <div class="fleet-tlist">${TREASURES.filter(t => t.dest === dest.id).map(t => found(t.id)
          ? `<div class="fleet-treasure"><span class="ft-icon">${t.icon}</span><span class="ft-name">${t.name}</span><span class="ft-eff">${treasureEffect(t)}</span></div>`
          : `<div class="fleet-treasure unknown"><span class="ft-icon">${ic('question')}</span><span class="ft-name">???</span><span class="ft-eff">${treasureEffect(t)}</span></div>`).join('')}</div>
      </div>`).join('');
    }
    // Logbuch
    const lSig = d.log.map(e => e.t).join();
    if (force || lSig !== lastLog) {
      lastLog = lSig;
      $('fleet-log').innerHTML = d.log.length
        ? d.log.map(e => `<li><span class="muted small">${shipById[e.ship] ? shipById[e.ship].name : ''} · ${destById[e.dest] ? destById[e.dest].name : ''}</span>
          <span>${outcomeLine(e)}</span><span class="fleet-log-loot">+${GK.formatMoneyHTML(e.loot)}</span></li>`).join('')
        : '<li class="muted">Noch keine Fahrten. Kauf dir eine Schaluppe und stich in See!</li>';
    }
  }

  // ---------- Takt (aus der Spielschleife) ----------

  const announced = new Set();

  // Abenteuer-Tab mit Zahl der Schiffe, die mit Beute warten
  function updateBadge() {
    const badge = document.querySelector('.tab[data-tab="adventure"] .tab-badge');
    if (!badge) return;
    const n = readyCount();
    badge.hidden = !n;
    if (badge.textContent !== String(n)) badge.textContent = n;
  }

  function update(visible) {
    income(); // bestes Einkommen merken
    // Meldung, wenn ein Schiff zurückkommt, während man spielt
    const d = data();
    Object.keys(d.voyages).forEach(id => {
      const v = d.voyages[id];
      const key = `${id}:${v.start}`;
      if (now() >= v.end && !announced.has(key)) {
        announced.add(key);
        if (shipById[id]) GK.toast(`⛵ Die ${shipById[id].name} ist zurück – Beute im ⚓ Abenteuer-Tab abholen!`);
      }
    });
    updateBadge();
    if (visible) render();
  }

  function init() {
    // Schiffe, die schon beim Laden zurück sind, nicht einzeln melden
    const d = data();
    let back = 0;
    Object.keys(d.voyages).forEach(id => {
      if (!shipById[id]) { delete d.voyages[id]; return; }
      if (now() >= d.voyages[id].end) {
        announced.add(`${id}:${d.voyages[id].start}`);
        back++;
      }
    });
    if (back) setTimeout(() => GK.toast(`⚓ ${back === 1 ? 'Ein Schiff wartet' : `${back} Schiffe warten`} mit Beute im Hafen!`), 1500);
    const collectBtn = $('fleet-collect-all');
    const sendBtn = $('fleet-send-all');
    if (collectBtn) collectBtn.addEventListener('click', () => {
      const results = collectAll();
      if (results.length) celebrate(results, collectBtn);
      render(true);
    });
    if (sendBtn) sendBtn.addEventListener('click', () => {
      if (!sendAll()) GK.sound.play('denied');
      render(true);
    });
  }

  GK.fleet = {
    SHIPS, DESTS, TREASURES, OUTCOMES, MAX_LEVEL,
    init, update, render, income, incomeMult, lootMult, timeMult, holdOf, durationOf, expectedLoot,
    buyPrice, upgradePrice, windPrice, canBuy, buy, upgrade, send, sendAll, wind, collect, collectAll,
    level, owns, shipCount, found, foundCount, readyCount, isBack, setsComplete: dest => TREASURES.filter(t => t.dest === dest).every(t => found(t.id)),
    shipSvg, clock,
    _setNow(fn) { now = fn; },
  };
})();
