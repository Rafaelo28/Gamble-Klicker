// Casino-Grundlage: Lobby, gemeinsame Einsatz-Auswahl, Zufallszahlen, Statistik und Verlauf.
// Jedes Spiel meldet sich mit GK.casino.register() an und bekommt einen eigenen Bereich.
window.GK = window.GK || {};

(function () {
  const HISTORY_LENGTH = 15;
  const games = [];

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

  // Runde im Verlauf festhalten und speichern
  function record(gameId, betAmount, payoutAmount, text) {
    const c = casino();
    c.rounds++;
    c.biggestWin = Math.max(c.biggestWin, payoutAmount - betAmount);
    c.history.unshift({ game: gameId, bet: betAmount, payout: payoutAmount, text, time: Date.now() });
    c.history.length = Math.min(c.history.length, HISTORY_LENGTH);
    GK.save();
    renderLobbyInfo();
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
        <input type="number" class="bet-input" min="${min}" step="1" inputmode="numeric">
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
      value = Math.floor(Number(value) || 0);
      const max = Math.max(min, Math.floor(GK.state.money));
      return Math.min(Math.max(value, min), max);
    }

    function apply(value) {
      options.set(clamp(value));
      refresh();
    }

    function refresh() {
      const value = options.get();
      if (document.activeElement !== input) input.value = value;
      display.innerHTML = GK.formatMoneyHTML(value) +
        (GK.canAfford(value) ? '' : ' <span class="bet-warning">– nicht genug Dublonen</span>');
    }

    input.addEventListener('change', () => apply(input.value));
    root.querySelectorAll('[data-op]').forEach(btn => {
      btn.addEventListener('click', () => {
        const current = options.get();
        const ops = {
          min: () => min,
          half: () => current / 2,
          double: () => current * 2,
          max: () => GK.state.money,
        };
        apply(ops[btn.dataset.op]());
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

  // game: { id, name, emoji, desc, init(bodyEl), render(), onShow() }
  function register(game) {
    games.push(game);
  }

  function gameName(id) {
    const game = games.find(g => g.id === id);
    return game ? `${game.emoji} ${game.name}` : id;
  }

  function openGame(id) {
    if (!games.some(g => g.id === id)) id = null;
    casino().openGame = id;
    document.getElementById('casino-lobby').hidden = !!id;
    games.forEach(g => {
      g.root.hidden = g.id !== id;
      if (g.id === id && g.onShow) g.onShow();
    });
    if (!id) renderLobbyInfo();
  }

  function buildLobby() {
    const grid = document.getElementById('casino-grid');
    const container = document.getElementById('casino-games');
    games.forEach(game => {
      const card = document.createElement('button');
      card.className = 'casino-card';
      card.innerHTML = `<div class="casino-emoji">${game.emoji}</div><h3>${game.name}</h3><p>${game.desc}</p>`;
      card.addEventListener('click', () => openGame(game.id));
      grid.appendChild(card);

      const root = document.createElement('div');
      root.className = 'casino-game';
      root.id = 'game-' + game.id;
      root.hidden = true;
      root.innerHTML = `
        <div class="game-header">
          <button class="btn back-btn">← Lobby</button>
          <h2>${game.emoji} ${game.name}</h2>
        </div>
        <div class="game-body"></div>`;
      root.querySelector('.back-btn').addEventListener('click', () => openGame(null));
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
  }

  // Nach Import/Zurücksetzen: alle Spiele neu aufbauen
  function refresh() {
    games.forEach(g => g.refresh && g.refresh());
    openGame(casino().openGame);
    renderLobbyInfo();
  }

  GK.casino = { register, data, bet, payout, refund, record, createBetControl, init, render, refresh, openGame, show };
})();
