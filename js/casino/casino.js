// Casino-Grundlage: Lobby, gemeinsame Einsatz-Auswahl, Zufallszahlen, Statistik und Verlauf.
// Jedes Spiel meldet sich mit GK.casino.register() an und bekommt einen eigenen Bereich.
window.GK = window.GK || {};

(function () {
  const HISTORY_LENGTH = 15;
  const games = [];
  const extraNames = {}; // Spiele außerhalb der Casino-Lobby, z. B. der Side-Slot im Klicker

  // ---------- Faire Zufallszahlen (kryptografischer Zufall des Browsers) ----------

  GK.rng = {
    // Ganzzahl von 0 bis max-1
    int(max) {
      const limit = Math.floor(0x100000000 / max) * max; // verhindert Verzerrung
      const buf = new Uint32Array(1);
      do {
        crypto.getRandomValues(buf);
      } while (buf[0] >= limit);
      return buf[0] % max;
    },
    // Zahl von 0 (inklusive) bis 1 (exklusive)
    float() {
      const buf = new Uint32Array(1);
      crypto.getRandomValues(buf);
      return buf[0] / 0x100000000;
    },
    // Eintrag nach Gewicht auswählen: items = [{ weight, ... }]
    weighted(items) {
      const total = items.reduce((sum, item) => sum + item.weight, 0);
      let roll = GK.rng.int(total);
      for (const item of items) {
        if (roll < item.weight) return item;
        roll -= item.weight;
      }
      return items[items.length - 1];
    },
    shuffle(array) {
      for (let i = array.length - 1; i > 0; i--) {
        const j = GK.rng.int(i + 1);
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    },
  };

  // ---------- Geld & Statistik ----------

  function casino() {
    return GK.state.casino;
  }

  // Zustand eines Spiels. Immer über diese Funktion lesen, nie eine Referenz
  // aufheben: beim Import/Zurücksetzen wird GK.state komplett ersetzt.
  function data(gameId, createDefault) {
    const all = casino().games;
    if (!all[gameId]) all[gameId] = createDefault ? createDefault() : {};
    return all[gameId];
  }

  // ---------- VIP-Karten: höhere Einsatz-Limits und bessere Poker-Tische ----------

  const VIP_LEVELS = [
    { name: 'Standard',       icon: '🎫', cost: 0,      maxBet: 1e4,      achievement: '' },
    { name: 'Silber',         icon: '🥈', cost: 2.5e5,  maxBet: 1e6,      achievement: 'vipSilver' },
    { name: 'Gold',           icon: '🥇', cost: 5e7,    maxBet: 1e8,      achievement: 'vipGold' },
    { name: 'Diamant',        icon: '💎', cost: 5e9,    maxBet: 1e10,     achievement: 'vipDiamond' },
    { name: 'Schwarze Perle', icon: '🖤', cost: 5e11,   maxBet: 1e12,     achievement: 'vipPearl' },
    { name: 'Kaiserkrone',    icon: '👑', cost: 5e13,   maxBet: Infinity, achievement: 'vipEmperor' },
  ];

  function vipLevel() {
    return casino().vip || 0;
  }

  // Höchster erlaubter Einsatz pro Runde
  function maxBet() {
    return VIP_LEVELS[vipLevel()].maxBet;
  }

  function buyVip() {
    const next = VIP_LEVELS[vipLevel() + 1];
    if (!next || !GK.spend(next.cost)) return false;
    casino().vip = vipLevel() + 1;
    const top = vipLevel() >= 4;
    GK.sound.play(top ? 'powerup' : 'upgrade');
    GK.fx.confetti(top ? 160 : 80);
    if (top) GK.fx.coinRain(2.5, 50);
    GK.unlockAchievement(next.achievement);
    GK.save();
    renderLobbyInfo();
    GK.toast(`${next.icon} ${next.name}-Karte gekauft! Neues Einsatz-Limit: ${formatLimit(next.maxBet)}`);
    return true;
  }

  function formatLimit(limit) {
    return limit === Infinity ? 'unbegrenzt' : GK.formatNumber(limit) + ' Dublonen';
  }

  // Einsatz abbuchen. Gibt false zurück, wenn das Guthaben nicht reicht.
  function bet(amount) {
    if (!(amount > 0) || !GK.spend(amount)) return false;
    casino().wagered += amount;
    return true;
  }

  // Gewinn auszahlen (Einsatz + Gewinn, also die komplette Rückzahlung)
  function payout(amount) {
    if (!(amount > 0)) return;
    GK.earn(amount, 'casino');
    casino().won += amount;
  }

  // Noch nicht gespielten Einsatz zurückgeben (z. B. Roulette-Chips wieder vom Tisch nehmen)
  function refund(amount) {
    if (!(amount > 0)) return;
    GK.state.money += amount;
    casino().wagered -= amount;
  }

  // Statistik eines Spiels (leer, wenn es noch nie gespielt wurde)
  function gameStats(gameId) {
    return casino().stats[gameId] ||
      { rounds: 0, wagered: 0, won: 0, wins: 0, biggestWin: 0, bestMult: 0, streak: 0, bestStreak: 0, last: 0 };
  }

  function countRound(gameId, betAmount, payoutAmount) {
    const st = casino().stats[gameId] = gameStats(gameId);
    st.rounds++;
    st.wagered += betAmount;
    st.won += payoutAmount;
    st.last = Date.now();
    if (payoutAmount > betAmount) {
      st.wins++;
      st.streak++;
      st.bestStreak = Math.max(st.bestStreak, st.streak);
      st.biggestWin = Math.max(st.biggestWin, payoutAmount - betAmount);
    } else if (payoutAmount < betAmount) {
      st.streak = 0;
    }
    if (betAmount > 0) st.bestMult = Math.max(st.bestMult, payoutAmount / betAmount);
  }

  // Runde im Verlauf festhalten und speichern
  function record(gameId, betAmount, payoutAmount, text) {
    const c = casino();
    c.rounds++;
    countRound(gameId, betAmount, payoutAmount);
    c.biggestWin = Math.max(c.biggestWin, payoutAmount - betAmount);
    c.history.unshift({ game: gameId, bet: betAmount, payout: payoutAmount, text, time: Date.now() });
    c.history.length = Math.min(c.history.length, HISTORY_LENGTH);
    if (GK.state.money < 1 && payoutAmount < betAmount) GK.unlockAchievement('broke');
    GK.save();
    renderLobbyInfo();
    refreshGameStats(gameId);
  }

  // ---------- Statistik je Spiel ----------

  const signed = n => `<span class="${n >= 0 ? 'win' : 'loss'}">${n >= 0 ? '+' : '−'}${GK.formatMoneyHTML(Math.abs(n))}</span>`;
  const formatMult = m => (m >= 100 ? GK.formatNumber(Math.floor(m)) : new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(m));

  // Werte eines Spiels als Liste (im Spiel und im Statistik-Tab)
  function statsHTML(gameId) {
    const st = gameStats(gameId);
    if (!st.rounds) return '<p class="muted small">Noch keine Runde gespielt – viel Glück! 🍀</p>';
    return `<dl class="stats-list compact game-stats-list">
      <dt>Runden</dt><dd>${GK.formatNumber(st.rounds)}</dd>
      <dt>Davon gewonnen</dt><dd>${GK.formatNumber(st.wins)}</dd>
      <dt>Eingesetzt</dt><dd>${GK.formatMoneyHTML(st.wagered)}</dd>
      <dt>Ausgezahlt</dt><dd>${GK.formatMoneyHTML(st.won)}</dd>
      <dt>Bilanz</dt><dd>${signed(st.won - st.wagered)}</dd>
      <dt>Größter Gewinn</dt><dd>${GK.formatMoneyHTML(st.biggestWin)}</dd>
      ${st.bestMult > 1 ? `<dt>Bester Treffer</dt><dd>×${formatMult(st.bestMult)} Einsatz</dd>` : ''}
      ${st.bestStreak > 1 ? `<dt>Längste Glückssträhne</dt><dd>${GK.formatNumber(st.bestStreak)} Gewinne in Folge</dd>` : ''}
      <dt>Zuletzt gespielt</dt><dd>vor ${GK.formatDuration((Date.now() - st.last) / 1000)}</dd>
    </dl>`;
  }

  // Hinweis für ältere Spielstände: die Werte je Spiel zählen erst seit dem Update
  function statsSinceText() {
    const since = casino().statsSince;
    return since ? `Gezählt seit ${new Date(since).toLocaleDateString('de-DE')}.` : '';
  }

  // Aufklappbare Statistik im Spiel neu zeichnen, falls sie offen ist
  function refreshGameStats(gameId) {
    const game = games.find(g => g.id === gameId);
    const panel = game && game.root && game.root.querySelector('.game-stats');
    if (panel && !panel.hidden) {
      panel.innerHTML = `<h3>📊 Deine Statistik</h3>${statsHTML(gameId)}<p class="muted small">${statsSinceText()}</p>`;
    }
  }

  // Alle gespielten Spiele für den Statistik-Tab, meistgespielte zuerst
  let lastAllStats = '';
  function renderAllStats(el) {
    const ids = Object.keys(casino().stats).filter(id => casino().stats[id].rounds > 0)
      .sort((a, b) => casino().stats[b].rounds - casino().stats[a].rounds);
    const html = ids.length
      ? ids.map(id => `<div class="game-stats-card"><h3>${gameName(id)}</h3>${statsHTML(id).replace(/<dt>Zuletzt gespielt.*?<\/dd>/s, '')}</div>`).join('')
      : `<p class="muted">${casino().statsSince ? 'Seit dem Update noch keine Casino-Runde gespielt.' : 'Noch keine Casino-Runden gespielt.'}</p>`;
    const full = html + (statsSinceText() ? `<p class="muted small game-stats-note">${statsSinceText()}</p>` : '');
    if (full !== lastAllStats || !el.innerHTML) {
      lastAllStats = full;
      el.innerHTML = full;
    }
  }

  // ---------- Einsatz-Auswahl (wird von allen Spielen benutzt) ----------

  // options: { min, get(), set(value), label }
  function createBetControl(container, options) {
    const min = options.min || 1;
    const root = document.createElement('div');
    root.className = 'bet-control';
    root.innerHTML = `
      <label class="bet-label">${options.label || 'Einsatz'}</label>
      <div class="bet-row">
        <input class="bet-input" ${GK.AMOUNT_INPUT}>
        <button type="button" class="btn btn-small" data-op="min">Min</button>
        <button type="button" class="btn btn-small" data-op="half">½</button>
        <button type="button" class="btn btn-small" data-op="double">×2</button>
        <button type="button" class="btn btn-small" data-op="max">Max</button>
      </div>
      <div class="bet-display"></div>`;
    container.appendChild(root);

    const input = root.querySelector('.bet-input');
    const display = root.querySelector('.bet-display');

    function clamp(value) {
      value = Math.floor(GK.parseAmount(value) || 0);
      const max = Math.max(min, Math.min(Math.floor(GK.state.money), maxBet()));
      return Math.min(Math.max(value, min), max);
    }

    function apply(value) {
      options.set(clamp(value));
      refresh();
    }

    function refresh() {
      let value = options.get();
      if (value > maxBet()) {
        value = maxBet(); // z. B. aus einem alten Spielstand ohne Limit
        options.set(value);
      }
      if (document.activeElement !== input) input.value = GK.formatAmount(value);
      display.innerHTML = GK.formatMoneyHTML(value) +
        (GK.canAfford(value) ? '' : ' <span class="bet-warning">– nicht genug Dublonen</span>') +
        (maxBet() < Infinity ? ` <span class="bet-limit">(Limit ${GK.formatNumber(maxBet())})</span>` : '');
    }

    // Eingabe wie „5M“ oder „2,5 Mrd.“: beim Tippen gleich übernehmen, Unbekanntes anmerken
    input.addEventListener('input', () => {
      const value = GK.parseAmount(input.value);
      if (isFinite(value)) apply(value);
      else if (input.value.trim()) display.innerHTML = '<span class="bet-warning">Zahl nicht erkannt – z. B. 500k, 2,5M oder 1B</span>';
    });
    input.addEventListener('change', () => {
      if (isFinite(GK.parseAmount(input.value))) apply(input.value);
      input.value = GK.formatAmount(options.get());
      refresh();
    });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); });
    root.querySelectorAll('[data-op]').forEach(btn => {
      btn.addEventListener('click', () => {
        const current = options.get();
        const ops = {
          min: () => min,
          half: () => current / 2,
          double: () => current * 2,
          max: () => Math.min(GK.state.money, maxBet()),
        };
        apply(ops[btn.dataset.op]());
        GK.sound.play('chip');
      });
    });

    refresh();
    return {
      refresh,
      setDisabled(disabled) {
        root.querySelectorAll('input, button').forEach(el => { el.disabled = disabled; });
      },
    };
  }

  // ---------- Lobby & Navigation ----------

  // Bereiche der Lobby, in dieser Reihenfolge
  const CATEGORIES = [
    { id: 'slots',   title: '🎰 Automaten' },
    { id: 'quick',   title: '⚡ Schnelle Spiele' },
    { id: 'table',   title: '🃏 Tischspiele' },
    { id: 'friends', title: '👥 Mit Freunden' },
  ];

  // game: { id, name, emoji, desc, category, init(bodyEl), render(), onShow(), onHide() }
  function register(game) {
    games.push(game);
  }

  function registerName(id, label) {
    extraNames[id] = label;
  }

  function gameName(id) {
    const game = games.find(g => g.id === id);
    return game ? `${game.emoji} ${game.name}` : extraNames[id] || id;
  }

  function openGame(id) {
    if (!games.some(g => g.id === id)) id = null;
    casino().openGame = id;
    document.getElementById('casino-lobby').hidden = !!id;
    games.forEach(g => {
      const wasOpen = !g.root.hidden;
      g.root.hidden = g.id !== id;
      if (wasOpen && g.root.hidden && g.onHide) g.onHide();
      if (g.id === id && g.onShow) g.onShow();
    });
    if (!id) renderLobbyInfo();
    else if (GK.track) GK.track('spiel-' + id, games.find(g => g.id === id).name);
  }

  function buildLobby() {
    const sections = document.getElementById('casino-grid');
    const container = document.getElementById('casino-games');
    const grids = {};
    CATEGORIES.forEach(cat => {
      if (!games.some(g => (g.category || 'quick') === cat.id)) return;
      const section = document.createElement('section');
      section.className = 'casino-section';
      section.innerHTML = `<h3 class="casino-section-title">${cat.title}</h3><div class="casino-grid"></div>`;
      sections.appendChild(section);
      grids[cat.id] = section.querySelector('.casino-grid');
    });
    games.forEach(game => {
      const card = document.createElement('button');
      card.className = 'casino-card';
      card.dataset.game = game.id;
      card.innerHTML = `<div class="casino-emoji">${game.emoji}</div><h3>${game.name}</h3><p>${game.desc}</p>`;
      card.addEventListener('click', () => openGame(game.id));
      grids[game.category || 'quick'].appendChild(card);

      const root = document.createElement('div');
      root.className = 'casino-game';
      root.id = 'game-' + game.id;
      root.hidden = true;
      root.innerHTML = `
        <div class="game-header">
          <button class="btn back-btn">← Lobby</button>
          <h2>${game.emoji} ${game.name}</h2>
          <button class="btn game-stats-btn" aria-expanded="false">📊 Statistik</button>
        </div>
        <div class="game-stats casino-info-box" hidden></div>
        <div class="game-body"></div>`;
      root.querySelector('.back-btn').addEventListener('click', () => openGame(null));
      const statsBtn = root.querySelector('.game-stats-btn');
      statsBtn.addEventListener('click', () => {
        const panel = root.querySelector('.game-stats');
        panel.hidden = !panel.hidden;
        statsBtn.classList.toggle('active', !panel.hidden);
        statsBtn.setAttribute('aria-expanded', String(!panel.hidden));
        refreshGameStats(game.id);
        GK.sound.play('click');
      });
      container.appendChild(root);
      game.root = root;
      game.init(root.querySelector('.game-body'));
    });
  }

  function renderLobbyInfo() {
    const c = casino();
    const net = c.won - c.wagered;
    document.getElementById('casino-stats').innerHTML = `
      <dt>Runden gespielt</dt><dd>${GK.formatNumber(c.rounds)}</dd>
      <dt>Insgesamt gesetzt</dt><dd>${GK.formatMoneyHTML(c.wagered)}</dd>
      <dt>Insgesamt ausgezahlt</dt><dd>${GK.formatMoneyHTML(c.won)}</dd>
      <dt>Bilanz</dt><dd class="${net >= 0 ? 'win' : 'loss'}">${net >= 0 ? '+' : '−'}${GK.formatMoneyHTML(Math.abs(net))}</dd>
      <dt>Größter Gewinn</dt><dd>${GK.formatMoneyHTML(c.biggestWin)}</dd>`;

    const level = VIP_LEVELS[vipLevel()];
    const next = VIP_LEVELS[vipLevel() + 1];
    const nextTable = next && GK.poker.tournament.TIERS.find(t => t.vip === vipLevel() + 1);
    document.getElementById('casino-vip').innerHTML = `
      <div class="vip-card vip-${vipLevel()}">${level.icon} ${level.name}-Karte</div>
      <p>Einsatz-Limit pro Runde: <b>${formatLimit(level.maxBet)}</b></p>
      ${next ? `
        <p class="muted small">Nächste Stufe: ${next.icon} ${next.name} – Limit ${formatLimit(next.maxBet)}${
          nextTable ? `, schaltet den Poker-Tisch „${nextTable.name}“ frei` : ''}.</p>
        <button class="btn btn-primary vip-buy">${next.name}-Karte kaufen (${GK.formatNumber(next.cost)} Dublonen)</button>`
        : '<p class="muted small">Höchste Stufe erreicht – mehr Glanz gibt es nicht! 👑</p>'}`;
    const buy = document.querySelector('.vip-buy');
    if (buy) {
      buy.disabled = !GK.canAfford(next.cost);
      buy.addEventListener('click', buyVip);
    }

    const list = document.getElementById('casino-history');
    if (!c.history.length) {
      list.innerHTML = '<li class="muted">Noch keine Runden gespielt.</li>';
      return;
    }
    list.innerHTML = c.history.map(h => {
      const diff = h.payout - h.bet;
      const cls = diff > 0 ? 'win' : diff < 0 ? 'loss' : '';
      const sign = diff > 0 ? '+' : diff < 0 ? '−' : '±';
      return `<li><span class="history-game">${gameName(h.game)}</span>
        <span class="history-text">${h.text}</span>
        <span class="history-diff ${cls}">${sign}${GK.formatMoneyHTML(Math.abs(diff))}</span></li>`;
    }).join('');
  }

  function init() {
    buildLobby();
    openGame(casino().openGame);
    renderLobbyInfo();
  }

  // Wenn der Casino-Tab geöffnet wird: dem offenen Spiel Bescheid geben (z. B. Poker setzt fort)
  function show() {
    const open = games.find(g => !g.root.hidden);
    if (open && open.onShow) open.onShow();
  }

  // Wird regelmäßig aus der Spielschleife aufgerufen
  function render() {
    const open = games.find(g => !g.root.hidden);
    if (open && open.render) open.render();
    const buy = document.querySelector('.vip-buy');
    const next = VIP_LEVELS[vipLevel() + 1];
    if (buy && next) buy.disabled = !GK.canAfford(next.cost);
  }

  // Nach Import/Zurücksetzen: alle Spiele neu aufbauen
  function refresh() {
    games.forEach(g => g.refresh && g.refresh());
    openGame(casino().openGame);
    renderLobbyInfo();
  }

  GK.casino = {
    register, registerName, data, bet, payout, refund, record, createBetControl, init, render, refresh, openGame, show,
    VIP_LEVELS, vipLevel, maxBet, buyVip, gameStats, statsHTML, renderAllStats,
  };
})();
