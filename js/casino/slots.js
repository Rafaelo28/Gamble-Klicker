// Slot-Maschine: 3 Walzen, eine Gewinnlinie. Auszahlungsquote ca. 96 %.
window.GK = window.GK || {};

(function () {
  const MIN_BET = 10;
  const AUTO_SPINS = 10;

  // Gewicht = wie oft das Symbol auf der Walze vorkommt (gleich für alle 3 Walzen)
  const SYMBOLS = [
    { id: 'cherry',  icon: '🍒', weight: 22, three: 10,  two: 2 },
    { id: 'lemon',   icon: '🍋', weight: 20, three: 15,  two: 0 },
    { id: 'orange',  icon: '🍊', weight: 18, three: 15,  two: 0 },
    { id: 'grape',   icon: '🍇', weight: 15, three: 25,  two: 1 },
    { id: 'bell',    icon: '🔔', weight: 10, three: 50,  two: 2 },
    { id: 'star',    icon: '⭐', weight: 7,  three: 100, two: 3 },
    { id: 'diamond', icon: '💎', weight: 4,  three: 200, two: 5 },
    { id: 'seven',   icon: '<span class="seven">7</span>', weight: 2, three: 777, two: 10 },
  ];
  const byId = Object.fromEntries(SYMBOLS.map(s => [s.id, s]));

  let els = {};
  let betControl;
  let spinning = false;
  let autoLeft = 0;

  function state() {
    return GK.casino.data('slots', () => ({ bet: 100, reels: ['seven', 'seven', 'seven'], pending: null }));
  }

  // Multiplikator für ein Ergebnis (Rückzahlung inklusive Einsatz)
  function evaluate(reels) {
    if (reels[0] === reels[1] && reels[1] === reels[2]) {
      return { mult: byId[reels[0]].three, text: `3× ${byId[reels[0]].icon}` };
    }
    for (const id of new Set(reels)) {
      if (reels.filter(r => r === id).length === 2 && byId[id].two > 0) {
        return { mult: byId[id].two, text: `2× ${byId[id].icon}` };
      }
    }
    return { mult: 0, text: 'Kein Gewinn' };
  }

  function spin() {
    if (spinning) return;
    const s = state();
    if (!GK.casino.bet(s.bet)) {
      autoLeft = 0;
      showMessage('Nicht genug Dublonen für diesen Einsatz.', 'loss');
      return;
    }
    const reels = [0, 1, 2].map(() => GK.rng.weighted(SYMBOLS).id);
    const result = evaluate(reels);
    // Ergebnis sofort speichern: Lädt man während der Animation neu, wird trotzdem ausgezahlt
    s.reels = reels;
    s.pending = { bet: s.bet, payout: s.bet * result.mult, text: result.text };
    GK.save();
    animate(reels, settle);
  }

  // Gewinn auszahlen und Runde abschließen
  function settle() {
    const s = state();
    const p = s.pending;
    if (!p) return;
    s.pending = null;
    GK.casino.payout(p.payout);
    GK.casino.record('slots', p.bet, p.payout, p.text);
    spinning = false;
    showReels(s.reels);
    if (p.payout > p.bet) {
      showMessage(`${p.text} – Gewinn: ${GK.formatMoneyHTML(p.payout)}`, 'win');
      els.machine.classList.add('jackpot');
      setTimeout(() => els.machine.classList.remove('jackpot'), 1200);
    } else if (p.payout === p.bet) {
      showMessage(`${p.text} – Einsatz zurück`, '');
    } else {
      showMessage('Leider kein Gewinn.', 'loss');
    }
    // Automatik stoppt bei großen Gewinnen, damit man sie mitbekommt
    if (p.payout >= p.bet * 50) autoLeft = 0;
    if (autoLeft > 0) {
      autoLeft--;
      setTimeout(spin, 500);
    }
    updateButtons();
  }

  function animate(reels, done) {
    spinning = true;
    updateButtons();
    els.message.innerHTML = '&nbsp;';
    const stopTimes = [700, 1000, 1300];
    const start = performance.now();
    els.reels.forEach(r => r.classList.add('spinning'));

    function frame(now) {
      const elapsed = now - start;
      els.reels.forEach((reelEl, i) => {
        if (elapsed < stopTimes[i]) {
          reelEl.innerHTML = SYMBOLS[GK.rng.int(SYMBOLS.length)].icon;
        } else if (reelEl.classList.contains('spinning')) {
          reelEl.classList.remove('spinning');
          reelEl.innerHTML = byId[reels[i]].icon;
        }
      });
      if (elapsed < stopTimes[2]) {
        setTimeout(() => requestAnimationFrame(frame), 60);
      } else {
        done();
      }
    }
    requestAnimationFrame(frame);
  }

  function showReels(reels) {
    els.reels.forEach((el, i) => { el.innerHTML = byId[reels[i]].icon; });
  }

  function showMessage(html, cls) {
    els.message.className = 'game-message ' + (cls || '');
    els.message.innerHTML = html;
  }

  function updateButtons() {
    els.spin.disabled = spinning;
    els.auto.disabled = spinning;
    els.auto.textContent = autoLeft > 0 ? `Stopp (${autoLeft})` : `Auto ×${AUTO_SPINS}`;
    if (autoLeft > 0) els.auto.disabled = false;
    betControl.setDisabled(spinning || autoLeft > 0);
  }

  function init(body) {
    body.innerHTML = `
      <div class="slots-layout">
        <div class="slot-machine">
          <div class="slot-title">★ DUBLONEN-AUTOMAT ★</div>
          <div class="slot-window">
            <div class="slot-reel"></div>
            <div class="slot-reel"></div>
            <div class="slot-reel"></div>
            <div class="slot-payline"></div>
          </div>
          <div class="game-message">&nbsp;</div>
          <div class="slot-bet"></div>
          <div class="game-actions">
            <button class="btn btn-primary slot-spin">🎰 Drehen</button>
            <button class="btn slot-auto"></button>
          </div>
        </div>
        <div class="paytable">
          <h3>Gewinntabelle</h3>
          <table>
            <thead><tr><th>Symbol</th><th>3 gleiche</th><th>2 gleiche</th></tr></thead>
            <tbody>
              ${SYMBOLS.slice().reverse().map(s => `
                <tr><td class="paytable-icon">${s.icon}</td><td>×${s.three}</td><td>${s.two ? '×' + s.two : '–'}</td></tr>`).join('')}
            </tbody>
          </table>
          <p class="muted small">Gewinne als Vielfaches des Einsatzes (inklusive Einsatz). Auszahlungsquote ca. 96 %.</p>
        </div>
      </div>`;

    els = {
      machine: body.querySelector('.slot-machine'),
      reels: [...body.querySelectorAll('.slot-reel')],
      message: body.querySelector('.game-message'),
      spin: body.querySelector('.slot-spin'),
      auto: body.querySelector('.slot-auto'),
    };
    betControl = GK.casino.createBetControl(body.querySelector('.slot-bet'), {
      min: MIN_BET,
      get: () => state().bet,
      set: v => { state().bet = v; },
    });
    els.spin.addEventListener('click', spin);
    els.auto.addEventListener('click', () => {
      if (autoLeft > 0) {
        autoLeft = 0;
        updateButtons();
        return;
      }
      autoLeft = AUTO_SPINS - 1;
      spin();
    });
    refresh();
  }

  function refresh() {
    spinning = false;
    autoLeft = 0;
    showReels(state().reels);
    // Eine beim Neuladen unterbrochene Runde sofort auszahlen
    if (state().pending) settle();
    updateButtons();
  }

  GK.casino.register({
    id: 'slots',
    name: 'Slot-Maschine',
    emoji: '🎰',
    desc: 'Drei gleiche Symbole gewinnen – bis zu ×777!',
    init,
    refresh,
    render: () => betControl.refresh(),
  });

  // Für Tests: Auszahlungsquote exakt berechnen
  GK.casino.slotsRtp = function () {
    const total = SYMBOLS.reduce((sum, s) => sum + s.weight, 0);
    let rtp = 0;
    for (const a of SYMBOLS) for (const b of SYMBOLS) for (const c of SYMBOLS) {
      const p = (a.weight * b.weight * c.weight) / total ** 3;
      rtp += p * evaluate([a.id, b.id, c.id]).mult;
    }
    return rtp;
  };
})();
