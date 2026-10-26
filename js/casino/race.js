// Schiffsrennen: Fünf Piratenschiffe segeln um die Wette. Vor jedem Rennen gibt es neue Quoten
// (Favoriten zahlen wenig, Außenseiter viel). Man setzt Chips auf ein oder mehrere Schiffe.
// Das Ergebnis steht beim Start fest und wird gespeichert – Neuladen zahlt trotzdem aus.
window.GK = window.GK || {};

(function () {
  const MIN_CHIP = 10;
  const RACE_TIME = 8000;   // so lange braucht der Sieger (ms)
  const EDGE = 0.95;
  const SHIPS = [
    { name: 'Schwarze Möwe', color: '#34495e' },
    { name: 'Rote Perle',    color: '#c0392b' },
    { name: 'Goldener Hai',  color: '#d4a017' },
    { name: 'Sturmvogel',    color: '#2980b9' },
    { name: 'Grüne Witwe',   color: '#27ae60' },
  ];

  let els = {};
  let chipControl;
  let racing = false;

  function state() {
    return GK.casino.data('race', () => ({ chip: 100, bets: {}, next: null, pending: null, last: null }));
  }

  // ---------- Mathematik (auch für Tests) ----------

  // Neue Stärken: Wahrscheinlichkeiten zum Sieg und daraus die Gewinn-Multiplikatoren
  function makeOdds(rand = () => GK.rng.float()) {
    const weights = SHIPS.map(() => 0.6 + 2.4 * Math.pow(rand(), 1.5));
    const total = weights.reduce((a, b) => a + b, 0);
    const probs = weights.map(w => w / total);
    const mults = probs.map(p => Math.max(1.2, Math.floor(EDGE / p * 10) / 10));
    return { probs, mults };
  }

  // Zieleinlauf: nacheinander nach Stärke ziehen (der Erste ist der Sieger)
  function drawOrder(probs, rand = () => GK.rng.float()) {
    const left = probs.map((p, i) => i);
    const order = [];
    while (left.length) {
      const total = left.reduce((sum, i) => sum + probs[i], 0);
      let roll = rand() * total;
      let pick = left[left.length - 1];
      for (const i of left) {
        if (roll < probs[i]) {
          pick = i;
          break;
        }
        roll -= probs[i];
      }
      order.push(pick);
      left.splice(left.indexOf(pick), 1);
    }
    return order;
  }

  function odds() {
    const s = state();
    if (!s.next) {
      s.next = makeOdds();
      GK.save();
    }
    return s.next;
  }

  const totalBets = bets => Object.values(bets).reduce((a, b) => a + b, 0);

  // ---------- Aktionen ----------

  function placeBet(ship) {
    const s = state();
    if (racing || s.pending) return;
    if (totalBets(s.bets) + s.chip > GK.casino.maxBet()) {
      showMessage(`Dein Limit sind ${GK.formatNumber(GK.casino.maxBet())} Dublonen pro Rennen – eine bessere VIP-Karte erhöht es.`, 'loss');
      return;
    }
    if (!GK.casino.bet(s.chip)) {
      GK.sound.play('denied');
      showMessage('Nicht genug Dublonen für diesen Chip.', 'loss');
      return;
    }
    s.bets[ship] = (s.bets[ship] || 0) + s.chip;
    GK.save();
    GK.sound.play('chip');
    renderLanes();
    GK.fx.pulse(els.lanes.children[ship].querySelector('.race-stake'), 'chip-drop');
  }

  function clearBets() {
    const s = state();
    if (racing || s.pending) return;
    GK.casino.refund(totalBets(s.bets));
    s.bets = {};
    GK.save();
    renderLanes();
  }

  function start() {
    const s = state();
    if (racing || s.pending) return;
    const total = totalBets(s.bets);
    if (!total) {
      showMessage('Setz zuerst Chips auf ein Schiff.', '');
      return;
    }
    const { probs, mults } = odds();
    const order = drawOrder(probs);
    const winner = order[0];
    const payout = Math.floor((s.bets[winner] || 0) * mults[winner]);
    // Ablauf des Rennens (nur Optik): Zielzeiten und Schwankungen jedes Schiffs
    const finish = [];
    order.forEach((ship, place) => { finish[ship] = RACE_TIME + place * (250 + GK.rng.int(450)); });
    const wobble = SHIPS.map(() => ({ a: 0.05 + GK.rng.float() * 0.07, f: 1 + GK.rng.int(3) * 0.5, phase: GK.rng.float() * Math.PI * 2 }));
    s.pending = { bets: s.bets, total, mults, order, payout, finish, wobble };
    s.bets = {};
    s.next = null;
    GK.save();
    racing = true;
    updateButtons();
    showMessage('📯 Leinen los!', '');
    GK.sound.play('horn');
    animate(s.pending, () => settle(true));
  }

  // animated = nach dem Rennen (sonst nach dem Neuladen)
  function settle(animated) {
    const s = state();
    const p = s.pending;
    racing = false;
    if (!p) {
      updateButtons();
      return;
    }
    s.pending = null;
    const winner = p.order[0];
    s.last = { order: p.order, mults: p.mults, bets: p.bets, payout: p.payout };
    GK.casino.payout(p.payout);
    if (p.payout > 0 && p.mults[winner] >= 6) GK.unlockAchievement('raceOutsider');
    GK.casino.record('race', p.total, p.payout, `🏁 ${SHIPS[winner].name} (×${fmt(p.mults[winner])})`);
    if (p.payout > 0) {
      showMessage(`🏆 ${SHIPS[winner].name} gewinnt! Du bekommst ${GK.formatMoneyHTML(p.payout)}`, 'win');
      if (animated) GK.fx.celebrate(p.payout, p.total, { el: els.lanes.children[winner], subtitle: SHIPS[winner].name });
    } else {
      showMessage(`🏁 ${SHIPS[winner].name} gewinnt – diesmal nicht dein Schiff.`, 'loss');
      if (animated) GK.sound.play('lose');
    }
    renderLanes();
    updateButtons();
  }

  // ---------- Darstellung ----------

  function fmt(m) {
    return m.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
  }

  // Fortschritt (0 bis 1) eines Schiffs nach `t` ms – mit Schwankungen, damit es spannend wird
  function progress(p, ship, t) {
    const T = p.finish[ship];
    if (t >= T) return 1;
    const w = p.wobble[ship];
    const k = t / T;
    return Math.min(1, Math.max(0, k + w.a * Math.sin(Math.PI * k) * Math.sin(2 * Math.PI * w.f * k + w.phase)));
  }

  function animate(p, onDone) {
    const fast = GK.state.settings.effects === 'reduced';
    const speed = fast ? 4 : 1;
    const startTime = performance.now();
    const end = Math.max(...p.finish) + 600;
    const reached = SHIPS.map(() => 0);
    let leader = -1;
    let lastComment = 0;
    let finished = 0;
    function frame(now) {
      const t = (now - startTime) * speed;
      SHIPS.forEach((ship, i) => {
        reached[i] = Math.max(reached[i], progress(p, i, t)); // Schiffe fahren nie rückwärts
        const lane = els.lanes.children[i];
        const track = lane.querySelector('.race-track');
        const boat = lane.querySelector('.race-ship');
        const maxX = track.clientWidth - boat.offsetWidth;
        boat.style.transform = `translateX(${reached[i] * maxX}px)`;
      });
      // Kommentar bei Führungswechsel
      const now_leader = reached.indexOf(Math.max(...reached));
      if (now_leader !== leader && t > 1200 && now - lastComment > 900 && finished === 0) {
        leader = now_leader;
        lastComment = now;
        els.comment.textContent = `🚩 ${SHIPS[leader].name} übernimmt die Führung!`;
      }
      const done = p.order.filter(i => t >= p.finish[i]).length;
      if (done > finished) {
        if (finished === 0) {
          els.comment.textContent = `🏁 ${SHIPS[p.order[0]].name} ist im Ziel!`;
          GK.sound.play('cannon');
        }
        finished = done;
      }
      if (t < end) requestAnimationFrame(frame);
      else onDone();
    }
    requestAnimationFrame(frame);
  }

  function renderLanes() {
    const s = state();
    const show = s.pending || null;
    const { mults } = show || odds();
    const bets = show ? show.bets : s.bets;
    const last = !racing && !s.pending && s.last;
    [...els.lanes.children].forEach((lane, i) => {
      lane.querySelector('.race-mult').textContent = `×${fmt(mults[i])}`;
      const stake = bets[i] ? GK.formatMoneyHTML(bets[i]) : '';
      const stakeEl = lane.querySelector('.race-stake');
      if (stakeEl.innerHTML !== stake) stakeEl.innerHTML = stake;
      const place = last ? last.order.indexOf(i) + 1 : 0;
      lane.querySelector('.race-place').textContent = place ? ['🥇', '🥈', '🥉', '4.', '5.'][place - 1] : '';
      lane.classList.toggle('winner', place === 1);
      if (!racing) {
        const boat = lane.querySelector('.race-ship');
        const track = lane.querySelector('.race-track');
        boat.style.transform = last ? `translateX(${track.clientWidth - boat.offsetWidth}px)` : 'translateX(0)';
      }
    });
    els.total.innerHTML = 'Gesetzt: ' + GK.formatMoneyHTML(totalBets(bets));
  }

  function showMessage(html, cls) {
    els.message.className = 'game-message ' + (cls || '');
    els.message.innerHTML = html;
  }

  function updateButtons() {
    const busy = racing || !!state().pending;
    els.start.disabled = busy;
    els.clear.disabled = busy || !totalBets(state().bets);
    els.lanes.querySelectorAll('.race-bet').forEach(btn => { btn.disabled = busy; });
    chipControl.setDisabled(busy);
  }

  function init(body) {
    body.innerHTML = `
      <div class="race-layout">
        <div class="race-comment">⚓ Die Schiffe liegen bereit.</div>
        <div class="race-lanes">
          ${SHIPS.map((ship, i) => `
            <div class="race-lane" style="--ship: ${ship.color}">
              <div class="race-info">
                <span class="race-name">${ship.name}</span>
                <span class="race-mult"></span>
                <span class="race-stake"></span>
              </div>
              <button class="btn btn-small race-bet" data-ship="${i}">+ Chip</button>
              <div class="race-track">
                <div class="race-ship"><span class="race-flag"></span>⛵</div>
                <span class="race-place"></span>
              </div>
            </div>`).join('')}
        </div>
        <div class="race-total"></div>
        <div class="game-message">&nbsp;</div>
        <div class="race-chip"></div>
        <div class="game-actions">
          <button class="btn btn-primary btn-big race-start">📯 Rennen starten</button>
          <button class="btn race-clear">✖ Wetten entfernen</button>
        </div>
        <p class="muted small">Setze Chips auf ein oder mehrere Schiffe. Gewinnt dein Schiff, bekommst du
          deinen Einsatz mal der angezeigten Zahl. Vor jedem Rennen gibt es neue Zahlen.</p>
      </div>`;
    els = {
      lanes: body.querySelector('.race-lanes'),
      comment: body.querySelector('.race-comment'),
      total: body.querySelector('.race-total'),
      message: body.querySelector('.game-message'),
      start: body.querySelector('.race-start'),
      clear: body.querySelector('.race-clear'),
    };
    chipControl = GK.casino.createBetControl(body.querySelector('.race-chip'), {
      label: 'Chip-Wert',
      min: MIN_CHIP,
      get: () => state().chip,
      set: v => { state().chip = v; },
    });
    els.lanes.addEventListener('click', e => {
      const btn = e.target.closest('.race-bet');
      if (btn) placeBet(Number(btn.dataset.ship));
    });
    els.start.addEventListener('click', start);
    els.clear.addEventListener('click', clearBets);
    refresh();
  }

  function refresh() {
    racing = false;
    if (state().pending) settle(false);
    else showMessage('Auf welches Schiff setzt du?', '');
    renderLanes();
    updateButtons();
  }

  GK.casino.register({
    id: 'race',
    category: 'quick',
    name: 'Schiffsrennen',
    emoji: '⛵',
    desc: 'Fünf Piratenschiffe, ein Sieger – setz auf deinen Favoriten!',
    init,
    refresh,
    onShow: () => { if (!racing) renderLanes(); },
    render: () => chipControl.refresh(),
  });

  // Für Tests
  GK.casino.raceMath = { SHIPS, makeOdds, drawOrder, EDGE };
})();
