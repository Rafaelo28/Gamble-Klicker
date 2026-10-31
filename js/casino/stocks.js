// Hafenbörse: Anteile an Hafen-Firmen kaufen und (hoffentlich teurer) wieder verkaufen.
// Die Kurse bewegen sich jede Sekunde, Nachrichten lassen sie springen. Solange man an einer Firma keine
// Anteile hat, schwankt ihr Kurs um einen langsam wandernden Mittelwert – mal geht es hoch, mal runter,
// Nachrichten sind eher gut. Sobald man Anteile hat, geht es im Schnitt bergab und Nachrichten sind eher
// schlecht; nach dem Verkauf erholt sich der Kurs wieder. Dazu liegen Kauf- und Verkaufskurs auseinander:
// Wer kauft, liegt fast immer im Minus. Fällt ein Kurs zu tief, geht die Firma pleite (Anteile wertlos)
// und eine neue kommt an die Börse.
// Die Kurse laufen weiter, auch wenn das Spiel geschlossen ist (beim Öffnen wird nachgerechnet, bis 8 Std.).
// Gekauft wird über GK.casino.bet, verkauft über payout + record (eine Runde = ein Verkauf).
window.GK = window.GK || {};

(function () {
  const MIN_BET = 10;
  const BUY = 1.02;          // Kaufkurs = Kurs × 1,02
  const SELL = 0.99;         // Verkaufskurs = Kurs × 0,99
  const BANKRUPT = 0.06;     // unter 6 % des Ausgabekurses: pleite
  const HISTORY = 144;       // Kurspunkte im Verlauf (alle 5 Sekunden → 12 Minuten)
  const HISTORY_EVERY = 5;   // Sekunden
  const MAX_CATCH_UP = 8 * 3600;
  const LISTED = 6;          // so viele Firmen gleichzeitig an der Börse

  // Kursverhalten je Sekunde.
  // Ohne eigene Anteile: Der Kurs schwankt (sigma) um einen Mittelwert und findet zu ihm zurück (theta).
  // Mit eigenen Anteilen: Abwärtstrend (drift) mit etwas Schwankung (heldSigma) – nur in der ersten Minute
  // nach dem Kauf noch ohne Trend (honey), damit es auch mal nach Gewinn aussieht.
  // jump: Chance auf eine Nachricht (Kurssprung) pro Sekunde.
  const PROFILES = {
    calm: { name: 'ruhig',  theta: 1 / 1500, sigma: 0.0030, heldSigma: 0.0025, drift: -0.00030, honey: 0, jump: 0.0010 },
    mid:  { name: 'mittel', theta: 1 / 1500, sigma: 0.0045, heldSigma: 0.0032, drift: -0.00045, honey: 0, jump: 0.0012 },
    wild: { name: 'wild',   theta: 1 / 1500, sigma: 0.0065, heldSigma: 0.0040, drift: -0.00090, honey: 0, jump: 0.0015 },
  };
  const HONEYMOON = 60; // Sekunden nach dem ersten Kauf
  // Der Mittelwert wandert langsam (je √Sekunde), bleibt aber zwischen 50 % und 250 % des Ausgabekurses
  const ANCHOR_SIGMA = 0.0006;
  const ANCHOR_MIN = 0.5;
  const ANCHOR_MAX = 2.5;
  // Nachrichten: Anteil der guten und Größe der Sprünge – ohne und mit eigenen Anteilen
  const NEWS_FREE = { up: 0.6, upSize: [0.05, 0.15], downSize: [0.05, 0.13] };
  const NEWS_HELD = { up: 0.3, upSize: [0.03, 0.08], downSize: [0.08, 0.22] };

  const COMPANIES = [
    { id: 'rum',      emoji: '🥃', name: 'Rum-Brennerei Tortuga', profile: 'calm' },
    { id: 'parrot',   emoji: '🦜', name: 'Papageien-Post',        profile: 'mid' },
    { id: 'spice',    emoji: '🌶️', name: 'Gewürzhandel Ostindien', profile: 'calm' },
    { id: 'cannon',   emoji: '💣', name: 'Kanonengießerei',       profile: 'mid' },
    { id: 'map',      emoji: '🗺️', name: 'Schatzkarten AG',       profile: 'wild' },
    { id: 'kraken',   emoji: '🐙', name: 'Kraken-Versicherung',   profile: 'wild' },
    { id: 'anchor',   emoji: '⚓', name: 'Ankerwerft',            profile: 'calm' },
    { id: 'compass',  emoji: '🧭', name: 'Kompass & Co.',         profile: 'mid' },
    { id: 'banana',   emoji: '🍌', name: 'Bananen-Import',        profile: 'mid' },
    { id: 'shark',    emoji: '🦈', name: 'Haifisch-Reederei',     profile: 'wild' },
    { id: 'island',   emoji: '🏝️', name: 'Insel-Immobilien',      profile: 'wild' },
    { id: 'shell',    emoji: '🐚', name: 'Muschelbank',           profile: 'calm' },
    { id: 'tavern',   emoji: '🍺', name: 'Hafenschänke',          profile: 'mid' },
    { id: 'mermaid',  emoji: '🧜', name: 'Meerjungfrauen-Reisen', profile: 'wild' },
  ];

  const NEWS_UP = [
    'Gerücht: Schatzflotte gesichtet!', 'Neuer Handelsvertrag mit Port Royal', 'Rekordgewinn im letzten Quartal',
    'Der Gouverneur kauft groß ein', 'Neue Route nach Tortuga eröffnet', 'Konkurrenz von Piraten versenkt',
  ];
  const NEWS_DOWN = [
    'Sturm versenkt drei Schiffe', 'Kraken greift das Lagerhaus an', 'Steuerprüfung durch die Krone',
    'Meuterei an Bord', 'Ladung von Ratten gefressen', 'Kapitän mit der Kasse verschwunden',
    'Hafen wegen Nebel gesperrt', 'Skandal: Die Schatzkarte war gefälscht',
  ];

  let els = {};
  let betControl;
  let timer = null;
  let lastDraw = 0;

  function state() {
    return GK.casino.data('stocks', () => ({ bet: 100, selected: '', lastTick: 0, stocks: [], holdings: {}, news: [] }));
  }

  // ---------- Kursmodell (auch für Tests) ----------

  function gauss() {
    const u = 1 - GK.rng.float();
    const v = GK.rng.float();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  // Anzahl der Nachrichten in n Sekunden (Poisson-verteilt)
  function poisson(lambda) {
    const limit = Math.exp(-lambda);
    let k = 0;
    let p = GK.rng.float();
    while (p > limit) {
      k++;
      p *= GK.rng.float();
    }
    return k;
  }

  // Wie weit der Kurs ohne Anteile typischerweise vom Mittelwert abweicht (als Logarithmus)
  const spread = pr => pr.sigma / Math.sqrt(2 * pr.theta);

  // Kurs um n Sekunden weiterrechnen. mode: 'free' (keine Anteile), 'new' (gerade gekauft) oder 'held'.
  // Gibt die letzte Nachricht zurück (oder null)
  function step(stock, n, mode) {
    const pr = PROFILES[stock.profile];
    if (!stock.anchor) stock.anchor = stock.ipo; // ältere Spielstände
    let x = Math.log(stock.price / stock.anchor);
    const held = mode === 'held';
    if (mode === 'new' || held) {
      x += (held ? pr.drift : pr.honey) * n + pr.heldSigma * Math.sqrt(n) * gauss();
    } else {
      // Der Mittelwert wandert ein wenig, der Kurs findet zu ihm zurück (genau gerechnet für n Sekunden)
      const a = Math.min(stock.ipo * ANCHOR_MAX, Math.max(stock.ipo * ANCHOR_MIN, stock.anchor * Math.exp(ANCHOR_SIGMA * Math.sqrt(n) * gauss())));
      x += Math.log(stock.anchor / a);
      stock.anchor = a;
      const k = Math.exp(-pr.theta * n);
      x = x * k + pr.sigma * Math.sqrt((1 - k * k) / (2 * pr.theta)) * gauss();
    }
    const kind = held ? NEWS_HELD : NEWS_FREE;
    const jumps = n === 1 ? (GK.rng.float() < pr.jump ? 1 : 0) : poisson(pr.jump * n);
    let news = null;
    for (let j = 0; j < jumps; j++) {
      const up = GK.rng.float() < kind.up;
      const [lo, hi] = up ? kind.upSize : kind.downSize;
      const size = (up ? 1 : -1) * (lo + (hi - lo) * GK.rng.float());
      x += Math.log(1 + size);
      news = { up, size };
    }
    stock.price = stock.anchor * Math.exp(x);
    return news;
  }

  const bankrupt = stock => stock.price < stock.ipo * BANKRUPT;

  function newCompany(listedIds, now) {
    const free = COMPANIES.filter(c => !listedIds.includes(c.id));
    const c = free[GK.rng.int(free.length)];
    const ipo = 40 + GK.rng.int(461);
    return { uid: `${c.id}-${now.toString(36)}-${GK.rng.int(1296).toString(36)}`, id: c.id, emoji: c.emoji, name: c.name, profile: c.profile, price: ipo, ipo, anchor: ipo, hist: [ipo] };
  }

  // Ein Kauf, eine Zeit lang halten, verkaufen – für Tests: Rendite (−1 = alles verloren).
  // takeProfit: verkaufen, sobald so viel Gewinn erreicht ist; stopLoss: verkaufen, sobald so viel Verlust erreicht ist
  function simulateTrade(profile, seconds, takeProfit, stopLoss) {
    const stock = { profile, ipo: 100, anchor: 100, price: 100 * Math.exp(spread(PROFILES[profile]) * gauss()) };
    const cost = stock.price * BUY;
    for (let t = 0; t < seconds; t++) {
      step(stock, 1, t < HONEYMOON ? 'new' : 'held');
      if (bankrupt(stock)) return -1;
      const r = stock.price * SELL / cost - 1;
      if ((takeProfit && r >= takeProfit) || (stopLoss && r <= -stopLoss)) break;
    }
    return stock.price * SELL / cost - 1;
  }

  // ---------- Börse am Laufen halten ----------

  function addNews(s, stock, news, now) {
    const pct = Math.round(news.size * 100);
    const list = news.up ? NEWS_UP : NEWS_DOWN;
    s.news.unshift({ t: now, text: `${stock.emoji} ${stock.name}: ${list[GK.rng.int(list.length)]}`, pct });
    s.news.length = Math.min(s.news.length, 6);
  }

  function listCompany(s, now) {
    const c = newCompany(s.stocks.map(x => x.id), now);
    s.stocks.push(c);
    return c;
  }

  // Firma pleite: Anteile sind wertlos (als verlorene Runde verbucht), eine neue Firma kommt an die Börse
  function goBankrupt(s, stock, now) {
    const h = s.holdings[stock.uid];
    if (h) {
      delete s.holdings[stock.uid];
      GK.casino.record('stocks', h.cost, 0, `${stock.emoji} ${stock.name}: pleite`);
      GK.unlockAchievement('stockCrash');
      if (GK.notify) GK.notify(`<span class="notify-icon">💥</span><span><b>${stock.name} ist pleite!</b><br>Deine Anteile sind nichts mehr wert.</span>`);
      GK.sound.play('boom');
    }
    s.news.unshift({ t: now, text: `💥 ${stock.emoji} ${stock.name} ist pleite!`, pct: -100 });
    const index = s.stocks.indexOf(stock);
    s.stocks.splice(index, 1);
    const c = newCompany(s.stocks.map(x => x.id).concat(stock.id), now);
    s.stocks.splice(index, 0, c);
    s.news.unshift({ t: now, text: `🔔 Neu an der Börse: ${c.emoji} ${c.name}`, pct: 0 });
    s.news.length = Math.min(s.news.length, 6);
    if (s.selected === stock.uid) s.selected = c.uid;
  }

  // Erster Start: Firmen mit etwas Vorgeschichte, damit die Kurven nicht leer sind
  function setup(s, now) {
    s.stocks = [];
    s.holdings = s.holdings || {};
    s.news = s.news || [];
    for (let i = 0; i < LISTED; i++) {
      // Die ersten sechs Firmen der Liste, mit 12 Minuten Vorgeschichte
      const c = newCompany(s.stocks.map(x => x.id).concat(COMPANIES.slice(LISTED).map(x => x.id)), now);
      c.price = c.anchor * Math.exp(spread(PROFILES[c.profile]) * gauss());
      c.hist = [c.price];
      for (let k = 1; k < HISTORY; k++) {
        step(c, HISTORY_EVERY, 'free');
        c.hist.push(c.price);
      }
      if (bankrupt(c)) {
        i--;
        continue;
      }
      s.stocks.push(c);
    }
    s.selected = s.stocks[0].uid;
    s.lastTick = now;
  }

  // Kurse bis jetzt weiterrechnen (jede Sekunde; nach einer Pause in Minuten-Schritten)
  function tick(now = Date.now()) {
    const s = state();
    if (!s.stocks.length || !s.lastTick) setup(s, now);
    let seconds = Math.floor((now - s.lastTick) / 1000);
    if (seconds <= 0) return false;
    if (seconds > MAX_CATCH_UP) {
      s.lastTick = now - MAX_CATCH_UP * 1000;
      seconds = MAX_CATCH_UP;
    }
    const chunk = seconds > 60 ? 60 : 1;
    while (seconds >= chunk) {
      s.lastTick += chunk * 1000;
      seconds -= chunk;
      const second = Math.floor(s.lastTick / 1000);
      s.stocks.slice().forEach(stock => {
        const h = s.holdings[stock.uid];
        const news = step(stock, chunk, !h ? 'free' : s.lastTick - (h.since || 0) < HONEYMOON * 1000 ? 'new' : 'held');
        if (news && chunk === 1) addNews(s, stock, news, s.lastTick);
        if (bankrupt(stock)) {
          goBankrupt(s, stock, s.lastTick);
          return;
        }
        if (chunk > 1 || second % HISTORY_EVERY === 0) {
          stock.hist.push(stock.price);
          if (stock.hist.length > HISTORY) stock.hist.splice(0, stock.hist.length - HISTORY);
        }
      });
    }
    return true;
  }

  // ---------- Kaufen und verkaufen ----------

  const selected = s => s.stocks.find(x => x.uid === s.selected) || s.stocks[0];

  function buy() {
    tick();
    const s = state();
    const stock = selected(s);
    const amount = s.bet;
    if (!GK.casino.bet(amount)) {
      GK.sound.play('denied');
      showMessage('Nicht genug Dublonen für diesen Betrag.', 'loss');
      return;
    }
    // since: erster Kauf (weitere Käufe verlängern die Anfangsphase nicht)
    const h = s.holdings[stock.uid] || (s.holdings[stock.uid] = { shares: 0, cost: 0, since: s.lastTick });
    h.shares += amount / (stock.price * BUY);
    h.cost += amount;
    GK.save();
    GK.sound.play('chip');
    showMessage(`${stock.emoji} Für ${GK.formatMoneyHTML(amount)} gekauft.`, '');
    render(true);
  }

  function sell(fraction) {
    tick();
    const s = state();
    const stock = selected(s);
    const h = s.holdings[stock.uid];
    if (!h) return;
    const shares = h.shares * fraction;
    const cost = h.cost * fraction;
    const proceeds = Math.floor(shares * stock.price * SELL);
    if (fraction >= 1) delete s.holdings[stock.uid];
    else {
      h.shares -= shares;
      h.cost -= cost;
    }
    GK.casino.payout(proceeds);
    const diff = proceeds - cost;
    GK.casino.record('stocks', cost, proceeds, `${stock.emoji} ${stock.name}: verkauft (${percent(proceeds / cost - 1)})`);
    if (diff > 0) {
      GK.unlockAchievement('stockWin');
      GK.sound.play('winSmall');
      showMessage(`Verkauft für ${GK.formatMoneyHTML(proceeds)} – Gewinn ${GK.formatMoneyHTML(diff)}!`, 'win');
    } else {
      GK.sound.play('lose');
      showMessage(`Verkauft für ${GK.formatMoneyHTML(proceeds)} – Verlust ${GK.formatMoneyHTML(-diff)}.`, 'loss');
    }
    render(true);
  }

  // ---------- Darstellung ----------

  const percent = x => `${x >= 0 ? '+' : '−'}${GK.formatDecimal(Math.abs(x * 100), 1, 1)} %`;
  const price = p => (p >= 1000 ? GK.formatNumber(p) : GK.formatDecimal(p, 2, 2));
  const shares = n => (n >= 1000 ? GK.formatNumber(n) : GK.formatDecimal(n, 0, 2));
  const change = stock => stock.price / stock.hist[0] - 1;

  function showMessage(html, cls) {
    if (!els.message) return;
    els.message.className = 'game-message ' + (cls || '');
    GK.setHTML(els.message, html);
  }

  // Kurve mit Fläche; Linie für den eigenen Durchschnitts-Kaufkurs
  function drawChart(canvas, stock, buyPrice) {
    const g = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const pts = stock.hist.concat(stock.price);
    let lo = Math.min(...pts);
    let hi = Math.max(...pts);
    if (buyPrice) {
      lo = Math.min(lo, buyPrice);
      hi = Math.max(hi, buyPrice);
    }
    const pad = (hi - lo) * 0.12 || hi * 0.05 || 1;
    lo -= pad;
    hi += pad;
    const x = i => (i / Math.max(1, pts.length - 1)) * w;
    const y = v => h - ((v - lo) / (hi - lo)) * h;
    const up = stock.price >= pts[0];
    const color = up ? '#6fdc8c' : '#ff6b5e';
    g.clearRect(0, 0, w, h);
    g.beginPath();
    pts.forEach((v, i) => (i ? g.lineTo(x(i), y(v)) : g.moveTo(x(i), y(v))));
    g.lineWidth = Math.max(1.5, w / 260);
    g.strokeStyle = color;
    g.stroke();
    g.lineTo(w, h);
    g.lineTo(0, h);
    g.closePath();
    g.fillStyle = up ? 'rgba(111, 220, 140, 0.15)' : 'rgba(255, 107, 94, 0.15)';
    g.fill();
    if (buyPrice) {
      g.setLineDash([w / 80, w / 120]);
      g.beginPath();
      g.moveTo(0, y(buyPrice));
      g.lineTo(w, y(buyPrice));
      g.strokeStyle = 'rgba(255, 229, 138, 0.8)';
      g.lineWidth = Math.max(1, w / 400);
      g.stroke();
      g.setLineDash([]);
    }
  }

  function holdingValue(s, stock) {
    const h = s.holdings[stock.uid];
    return h ? h.shares * stock.price * SELL : 0;
  }

  function buildList() {
    const s = state();
    const sig = s.stocks.map(x => x.uid).join();
    if (els.list._sig === sig) return;
    els.list._sig = sig;
    els.list.innerHTML = s.stocks.map(stock => `
      <button type="button" class="stock-card" data-uid="${stock.uid}">
        <span class="stock-emoji">${stock.emoji}</span>
        <span class="stock-name">${stock.name}<small class="stock-own"></small></span>
        <span class="stock-price"></span>
        <span class="stock-change"></span>
        <canvas class="stock-spark" width="240" height="60"></canvas>
      </button>`).join('');
  }

  function render(force) {
    if (!els.list || !els.root.offsetParent) return;
    const now = Date.now();
    const changed = tick(now);
    if (!changed && !force && now - lastDraw < 1000) return;
    lastDraw = now;
    const s = state();
    buildList();
    const sel = selected(s);
    let total = 0;
    let totalCost = 0;
    s.stocks.forEach((stock, i) => {
      const card = els.list.children[i];
      const ch = change(stock);
      const h = s.holdings[stock.uid];
      card.classList.toggle('active', stock.uid === sel.uid);
      card.classList.toggle('owned', !!h);
      GK.setText(card.querySelector('.stock-price'), price(stock.price));
      const chEl = card.querySelector('.stock-change');
      GK.setText(chEl, percent(ch));
      chEl.className = 'stock-change ' + (ch >= 0 ? 'up' : 'down');
      GK.setText(card.querySelector('.stock-own'), h ? `💼 ${shares(h.shares)} Anteile` : '');
      drawChart(card.querySelector('.stock-spark'), stock, 0);
      if (h) {
        total += holdingValue(s, stock);
        totalCost += h.cost;
      }
    });

    // Ausgewählte Firma
    const h = s.holdings[sel.uid];
    GK.setHTML(els.title, `${sel.emoji} ${sel.name} <span class="muted small">(${PROFILES[sel.profile].name})</span>`);
    GK.setText(els.price, price(sel.price));
    const ch = change(sel);
    GK.setText(els.change, `${percent(ch)} in 12 Min.`);
    els.change.className = 'stock-big-change ' + (ch >= 0 ? 'up' : 'down');
    GK.setHTML(els.quotes, `Kaufkurs <b>${price(sel.price * BUY)}</b> · Verkaufskurs <b>${price(sel.price * SELL)}</b>`);
    drawChart(els.chart, sel, h ? h.cost / h.shares / SELL : 0);
    if (h) {
      const value = holdingValue(s, sel);
      const diff = value - h.cost;
      GK.setHTML(els.holding, `Dein Anteil: <b>${shares(h.shares)}</b> Anteile · Wert <b>${GK.formatMoneyHTML(value)}</b> ·
        <span class="${diff >= 0 ? 'win' : 'loss'}">${diff >= 0 ? '+' : '−'}${GK.formatMoneyHTML(Math.abs(diff))} (${percent(value / h.cost - 1)})</span>`);
    } else {
      GK.setHTML(els.holding, '<span class="muted">Du hast noch keine Anteile an dieser Firma.</span>');
    }
    els.sellAll.disabled = !h;
    els.sellHalf.disabled = !h;

    // Depot und Nachrichten
    const diff = total - totalCost;
    GK.setHTML(els.depot, totalCost
      ? `Depotwert <b>${GK.formatMoneyHTML(total)}</b> · eingesetzt ${GK.formatMoneyHTML(totalCost)} ·
        <span class="${diff >= 0 ? 'win' : 'loss'}">${diff >= 0 ? '+' : '−'}${GK.formatMoneyHTML(Math.abs(diff))}</span>`
      : '<span class="muted">Dein Depot ist leer.</span>');
    GK.setHTML(els.news, s.news.length
      ? s.news.map(n => `<li class="${n.pct > 0 ? 'up' : n.pct < 0 ? 'down' : ''}"><span>${n.text}</span>${n.pct ? `<b>${n.pct > 0 ? '+' : '−'}${Math.abs(n.pct)} %</b>` : ''}</li>`).join('')
      : '<li class="muted">Noch keine Nachrichten.</li>');
  }

  function init(body) {
    els.root = body;
    body.innerHTML = `
      <div class="stocks-layout">
        <div class="stocks-list"></div>
        <div class="stocks-detail">
          <div class="stock-head">
            <h3 class="stock-title"></h3>
            <div><span class="stock-big-price"></span> <span class="stock-big-change"></span></div>
          </div>
          <canvas class="stock-chart" width="1000" height="360"></canvas>
          <div class="stock-quotes muted small"></div>
          <div class="stock-holding"></div>
          <div class="game-message">&nbsp;</div>
          <div class="stock-bet"></div>
          <div class="game-actions">
            <button class="btn btn-primary btn-big stock-buy">📈 Kaufen</button>
            <button class="btn stock-sell-half">Hälfte verkaufen</button>
            <button class="btn stock-sell-all">💰 Alles verkaufen</button>
          </div>
          <div class="stock-depot"></div>
          <h4 class="stock-news-title">🗞️ Hafen-Nachrichten</h4>
          <ul class="stock-news"></ul>
          <p class="muted small">Kauf Anteile an Hafen-Firmen und verkauf sie wieder. Die Kurse ändern sich jede Sekunde und
            laufen weiter, auch wenn du nicht hinschaust. Geht eine Firma pleite, sind ihre Anteile nichts mehr wert.</p>
        </div>
      </div>`;
    els = Object.assign(els, {
      list: body.querySelector('.stocks-list'),
      title: body.querySelector('.stock-title'),
      price: body.querySelector('.stock-big-price'),
      change: body.querySelector('.stock-big-change'),
      chart: body.querySelector('.stock-chart'),
      quotes: body.querySelector('.stock-quotes'),
      holding: body.querySelector('.stock-holding'),
      message: body.querySelector('.game-message'),
      buy: body.querySelector('.stock-buy'),
      sellHalf: body.querySelector('.stock-sell-half'),
      sellAll: body.querySelector('.stock-sell-all'),
      depot: body.querySelector('.stock-depot'),
      news: body.querySelector('.stock-news'),
    });
    betControl = GK.casino.createBetControl(body.querySelector('.stock-bet'), {
      min: MIN_BET,
      label: 'Betrag',
      get: () => state().bet,
      set: v => { state().bet = v; },
    });
    els.list.addEventListener('click', e => {
      const card = e.target.closest('.stock-card');
      if (!card) return;
      state().selected = card.dataset.uid;
      GK.sound.play('tick');
      showMessage('&nbsp;', '');
      render(true);
    });
    els.buy.addEventListener('click', buy);
    els.sellHalf.addEventListener('click', () => sell(0.5));
    els.sellAll.addEventListener('click', () => sell(1));
    refresh();
  }

  function refresh() {
    tick();
    if (els.list) els.list._sig = '';
    showMessage('Kauf billig, verkauf teuer – so der Plan.', '');
    render(true);
  }

  GK.casino.register({
    id: 'stocks',
    category: 'market',
    name: 'Hafenbörse',
    emoji: '📈',
    desc: 'Kauf Anteile an Hafen-Firmen – Kurse in Echtzeit, Nachrichten und Pleiten.',
    init,
    refresh,
    render: () => {
      betControl.refresh();
      render(false);
    },
    onShow: () => render(true),
  });

  // Die Kurse laufen auch, wenn das Spiel nicht offen ist (Pleiten mit eigenen Anteilen werden gemeldet)
  function startTimer() {
    if (timer || typeof setInterval !== 'function' || typeof document === 'undefined' || !document.getElementById) return;
    timer = setInterval(() => {
      if (GK.state && GK.state.casino) tick();
    }, 1000);
  }
  if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('DOMContentLoaded', startTimer);

  // Für Tests
  GK.casino.stockMath = { PROFILES, COMPANIES, BUY, SELL, BANKRUPT, step, simulateTrade, tick, buy, sell, state };
})();
