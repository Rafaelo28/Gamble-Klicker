// Rubbellose: 9 Felder freirubbeln (mit Finger oder Maus). Drei gleiche Beträge = dieser Betrag gewinnt.
// Das Ergebnis steht schon beim Kauf fest und wird gespeichert – Neuladen ändert nichts daran.
// Auszahlungsquote: 92 %, Gewinnchance ca. 31 % (1 von 3,3 Losen).
window.GK = window.GK || {};

(function () {
  const TICKETS = [
    { id: 'clover', icon: '🍀', name: 'Glückskleeblatt', price: 100,    theme: 'green' },
    { id: 'chest',  icon: '🧰', name: 'Goldene Truhe',   price: 1000,   theme: 'gold' },
    { id: 'pirate', icon: '🏴‍☠️', name: 'Piratenschatz',   price: 10000,  theme: 'red' },
    { id: 'crown',  icon: '👑', name: 'Kronjuwelen',     price: 100000, theme: 'purple' },
  ];

  // Gewinne als Vielfaches des Lospreises – Gewicht von 100.000 Losen
  const PRIZES = [
    { mult: 1,    weight: 12000, icon: '🪙' },
    { mult: 2,    weight: 10000, icon: '🪙' },
    { mult: 3,    weight: 4000,  icon: '💰' },
    { mult: 5,    weight: 3000,  icon: '💰' },
    { mult: 10,   weight: 1200,  icon: '💎' },
    { mult: 20,   weight: 400,   icon: '💎' },
    { mult: 50,   weight: 120,   icon: '🏆' },
    { mult: 100,  weight: 40,    icon: '🏆' },
    { mult: 1000, weight: 3,     icon: '👑' },
  ];
  const TOTAL_WEIGHT = 100000;
  const BRUSH = 22;            // Radius des „Fingers“ in Pixeln
  const FIELD_REVEAL = 0.45;   // ab diesem Anteil frei gilt ein Feld als aufgedeckt

  let body;
  let els = {};
  let ctx = null;
  let dpr = 1;
  let scratching = false;
  let lastPoint = null;
  let revealedFields = [];
  let checkTimer = null;

  function state() {
    return GK.casino.data('scratch', () => ({ ticketId: 'clover', current: null, count: 0 }));
  }

  function ticket(id) {
    return TICKETS.find(t => t.id === id);
  }

  function prizeIcon(mult) {
    return PRIZES.find(p => p.mult === mult).icon;
  }

  // ---------- Los erzeugen ----------

  // Gewinn auslosen (0 = Niete)
  function drawPrize() {
    let roll = GK.rng.int(TOTAL_WEIGHT);
    for (const p of PRIZES) {
      if (roll < p.weight) return p.mult;
      roll -= p.weight;
    }
    return 0;
  }

  // 9 Felder: der Gewinn genau 3-mal, jeder andere Betrag höchstens 2-mal
  function makeFields(winMult) {
    const fields = winMult ? [winMult, winMult, winMult] : [];
    const counts = {};
    const others = PRIZES.map(p => p.mult).filter(m => m !== winMult);
    while (fields.length < 9) {
      // Kleine Beträge öfter, aber auch mal ein „Beinahe-Hauptgewinn“
      const m = others[Math.min(GK.rng.int(others.length), GK.rng.int(others.length + 2))];
      if (m === undefined || (counts[m] || 0) >= 2) continue;
      counts[m] = (counts[m] || 0) + 1;
      fields.push(m);
    }
    return GK.rng.shuffle(fields);
  }

  // Exakte Auszahlungsquote (für Tests und Anzeige)
  function rtp() {
    return PRIZES.reduce((sum, p) => sum + p.mult * p.weight, 0) / TOTAL_WEIGHT;
  }

  function buy() {
    const s = state();
    if (s.current && !s.current.settled) return;
    const t = ticket(s.ticketId);
    if (t.price > GK.casino.maxBet()) {
      GK.toast(`Dieses Los braucht eine höhere VIP-Karte.`);
      return;
    }
    if (!GK.casino.bet(t.price)) {
      GK.sound.play('denied');
      GK.toast('Nicht genug Dublonen für dieses Los.');
      return;
    }
    const winMult = drawPrize();
    s.current = { ticketId: t.id, fields: makeFields(winMult), winMult, settled: false };
    s.count++;
    GK.save();
    GK.sound.play('card');
    draw();
  }

  // ---------- Aufdecken & abrechnen ----------

  function settle() {
    const s = state();
    const c = s.current;
    if (!c || c.settled) return;
    const t = ticket(c.ticketId);
    const payout = c.winMult * t.price;
    c.settled = true;
    GK.casino.payout(payout);
    GK.unlockAchievement('scratch1');
    if (c.winMult >= 1000) GK.unlockAchievement('scratchTop');
    GK.casino.record('scratch', t.price, payout,
      c.winMult ? `${t.name}: 3× ${GK.formatNumber(payout)}` : `${t.name}: Niete`);
    clearInterval(checkTimer);
    showResult(true);
  }

  function revealAll(animated) {
    if (els.canvas) {
      els.canvas.classList.add('cleared');
      setTimeout(() => { if (els.canvas) els.canvas.hidden = true; }, animated ? 500 : 0);
    }
    settle();
  }

  function showResult(animated) {
    const c = state().current;
    const t = ticket(c.ticketId);
    const payout = c.winMult * t.price;
    els.fields.forEach((f, i) => f.classList.toggle('win', c.winMult > 0 && c.fields[i] === c.winMult));
    if (payout > t.price) {
      showMessage(`🎉 3× ${GK.formatNumber(payout)} – du gewinnst ${GK.formatMoneyHTML(payout)}!`, 'win');
    } else if (payout === t.price) {
      showMessage('3× Lospreis – du bekommst deinen Einsatz zurück.', '');
    } else {
      showMessage('Leider eine Niete. Nächstes Mal!', 'loss');
    }
    if (animated) GK.fx.celebrate(payout, t.price, { el: els.grid, subtitle: `${t.icon} ${t.name}` });
    updateButtons();
  }

  // ---------- Rubbelschicht ----------

  function setupCanvas() {
    const canvas = els.canvas;
    const rect = els.grid.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintCoating(rect.width, rect.height);
    // Bereits aufgedeckte Felder bleiben frei (z. B. nach dem Drehen des iPads)
    revealedFields.forEach((r, i) => { if (r) clearField(i); });
  }

  function paintCoating(w, h) {
    const theme = ticket(state().current.ticketId).theme;
    const colors = {
      green: ['#c9d6cf', '#8fa59a'], gold: ['#f7e7a1', '#c9a227'],
      red: ['#e6c1c1', '#a35b5b'], purple: ['#ddd0f2', '#8a6bbd'],
    }[theme];
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, colors[0]);
    grad.addColorStop(0.5, '#ffffff');
    grad.addColorStop(1, colors[1]);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    // Muster: kleine Münzen und „RUBBELN“
    ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
    ctx.font = `bold ${Math.round(w / 16)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const cw = w / 3;
    const ch = h / 3;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        ctx.fillText('RUBBELN', c * cw + cw / 2, r * ch + ch / 2);
      }
    }
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.lineWidth = 2;
    for (let i = 1; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(i * cw, 0); ctx.lineTo(i * cw, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * ch); ctx.lineTo(w, i * ch); ctx.stroke();
    }
  }

  function clearField(i) {
    const rect = els.grid.getBoundingClientRect();
    const cw = rect.width / 3;
    const ch = rect.height / 3;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000'; // deckende Farbe = radiert vollständig
    ctx.fillRect((i % 3) * cw, Math.floor(i / 3) * ch, cw, ch);
  }

  function pointFromEvent(e) {
    const rect = els.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function scratchTo(p) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = '#000'; // deckende Farbe = radiert vollständig
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = BRUSH * 2;
    ctx.beginPath();
    ctx.moveTo(lastPoint.x, lastPoint.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastPoint = p;
    GK.sound.play('scratch');
  }

  // Wie viel von jedem Feld ist schon frei?
  function checkProgress() {
    const c = state().current;
    if (!ctx || !c || c.settled) return;
    const w = els.canvas.width;
    const h = els.canvas.height;
    const data = ctx.getImageData(0, 0, w, h).data;
    const step = Math.max(4, Math.floor(w / 60));
    for (let i = 0; i < 9; i++) {
      if (revealedFields[i]) continue;
      const x0 = Math.floor((i % 3) * w / 3);
      const y0 = Math.floor(Math.floor(i / 3) * h / 3);
      let clear = 0;
      let total = 0;
      for (let y = y0 + step / 2; y < y0 + h / 3; y += step) {
        for (let x = x0 + step / 2; x < x0 + w / 3; x += step) {
          total++;
          if (data[(Math.floor(y) * w + Math.floor(x)) * 4 + 3] < 128) clear++;
        }
      }
      if (clear / total >= FIELD_REVEAL) {
        revealedFields[i] = true;
        clearField(i);
        GK.fx.pulse(els.fields[i], 'field-pop');
        GK.sound.play(c.fields[i] === c.winMult ? 'coin' : 'flip');
      }
    }
    if (revealedFields.every(Boolean)) revealAll(true);
  }

  function onPointerDown(e) {
    const c = state().current;
    if (!c || c.settled) return;
    e.preventDefault();
    scratching = true;
    els.canvas.setPointerCapture(e.pointerId);
    lastPoint = pointFromEvent(e);
    scratchTo({ x: lastPoint.x + 0.1, y: lastPoint.y + 0.1 });
    if (!checkTimer) checkTimer = setInterval(checkProgress, 200);
  }

  function onPointerMove(e) {
    if (!scratching) return;
    e.preventDefault();
    scratchTo(pointFromEvent(e));
  }

  function onPointerUp() {
    scratching = false;
    checkProgress();
  }

  // ---------- Darstellung ----------

  function showMessage(html, cls) {
    els.message.className = 'game-message ' + (cls || '');
    els.message.innerHTML = html;
  }

  function updateButtons() {
    const s = state();
    const open = s.current && !s.current.settled;
    const t = ticket(s.ticketId);
    els.buy.hidden = open;
    els.revealBtn.hidden = !open;
    els.buy.disabled = t.price > GK.casino.maxBet() || !GK.canAfford(t.price);
    els.buy.textContent = s.current ? `🎟️ Neues Los kaufen (${GK.formatNumber(t.price)})` : `🎟️ Los kaufen (${GK.formatNumber(t.price)})`;
    els.picker.querySelectorAll('.ticket-choice').forEach(btn => {
      const tt = ticket(btn.dataset.ticket);
      btn.classList.toggle('active', tt.id === s.ticketId);
      btn.disabled = open;
      btn.querySelector('.ticket-lock').textContent = tt.price > GK.casino.maxBet() ? '🔒 VIP' : '';
    });
  }

  function draw() {
    const s = state();
    const c = s.current;
    clearInterval(checkTimer);
    checkTimer = null;
    revealedFields = new Array(9).fill(false);
    const t = ticket(c ? c.ticketId : s.ticketId);
    els.ticket.className = `scratch-ticket theme-${t.theme}`;
    els.ticketName.innerHTML = `${t.icon} ${t.name}`;
    els.ticketPrice.innerHTML = `${GK.formatMoneyHTML(t.price)} · Hauptgewinn ${GK.formatMoneyHTML(t.price * 1000)}`;

    if (!c) {
      els.grid.innerHTML = '<div class="scratch-empty">Wähle ein Los und kaufe es,<br>dann geht’s ans Rubbeln! ✨</div>';
      showMessage('&nbsp;', '');
      updateButtons();
      return;
    }
    els.grid.innerHTML = c.fields.map(m => `
      <div class="scratch-field">
        <span class="scratch-icon">${prizeIcon(m)}</span>
        <span class="scratch-amount">${GK.formatNumber(m * t.price)}</span>
      </div>`).join('') + '<canvas class="scratch-canvas" aria-label="Rubbelfeld"></canvas>';
    els.fields = [...els.grid.querySelectorAll('.scratch-field')];
    els.canvas = els.grid.querySelector('.scratch-canvas');

    if (c.settled) {
      els.canvas.hidden = true;
      showResult(false);
      return;
    }
    showMessage('Rubble die Felder frei – mit dem Finger oder der Maus!', '');
    setupCanvas();
    els.canvas.addEventListener('pointerdown', onPointerDown);
    els.canvas.addEventListener('pointermove', onPointerMove);
    els.canvas.addEventListener('pointerup', onPointerUp);
    els.canvas.addEventListener('pointercancel', onPointerUp);
    updateButtons();
  }

  function init(el) {
    body = el;
    body.innerHTML = `
      <div class="scratch-layout">
        <div class="scratch-picker"></div>
        <div class="scratch-main">
          <div class="scratch-ticket">
            <div class="scratch-head">
              <div class="scratch-name"></div>
              <div class="scratch-price"></div>
            </div>
            <div class="scratch-rules">3 gleiche Beträge = du gewinnst diesen Betrag!</div>
            <div class="scratch-grid"></div>
          </div>
          <div class="game-message">&nbsp;</div>
          <div class="game-actions">
            <button class="btn btn-primary btn-big scratch-buy"></button>
            <button class="btn scratch-reveal">✨ Alles aufdecken</button>
          </div>
          <p class="muted small">Auszahlungsquote 92 % · Gewinnchance ca. 1 zu 3,3 · Hauptgewinn: 1.000× Lospreis</p>
        </div>
      </div>`;
    els = {
      picker: body.querySelector('.scratch-picker'),
      ticket: body.querySelector('.scratch-ticket'),
      ticketName: body.querySelector('.scratch-name'),
      ticketPrice: body.querySelector('.scratch-price'),
      grid: body.querySelector('.scratch-grid'),
      message: body.querySelector('.game-message'),
      buy: body.querySelector('.scratch-buy'),
      revealBtn: body.querySelector('.scratch-reveal'),
      fields: [],
      canvas: null,
    };
    els.picker.innerHTML = TICKETS.map(t => `
      <button class="ticket-choice theme-${t.theme}" data-ticket="${t.id}">
        <span class="ticket-icon">${t.icon}</span>
        <span class="ticket-name">${t.name}</span>
        <span class="ticket-cost">${GK.formatMoneyHTML(t.price)}</span>
        <span class="ticket-lock"></span>
      </button>`).join('');
    els.picker.querySelectorAll('.ticket-choice').forEach(btn => {
      btn.addEventListener('click', () => {
        const s = state();
        if (s.current && !s.current.settled) return;
        s.ticketId = btn.dataset.ticket;
        s.current = null;
        GK.sound.play('chip');
        draw();
      });
    });
    els.buy.addEventListener('click', buy);
    els.revealBtn.addEventListener('click', () => revealAll(true));
    window.addEventListener('resize', () => {
      const c = state().current;
      if (c && !c.settled && els.canvas && !els.canvas.hidden && body.offsetParent) setupCanvas();
    });
    draw();
  }

  GK.casino.register({
    id: 'scratch',
    name: 'Rubbellose',
    emoji: '🎟️',
    desc: 'Rubbeln, drei gleiche Beträge finden – bis zu ×1.000!',
    init,
    refresh: () => draw(),
    // Die Rubbelfläche braucht die echte Größe – erst zeichnen, wenn das Spiel sichtbar ist
    onShow: () => draw(),
    render: () => updateButtons(),
  });

  GK.casino.scratchRtp = rtp;
  GK.casino.scratchMakeFields = makeFields; // für Tests
})();
