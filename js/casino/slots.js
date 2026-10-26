// Slot-Maschine im Casino: 3 Walzen, eine Gewinnlinie. Auszahlungsquote 96,2 %.
// Symbole, Gewinntabelle und Walzen kommen aus slot-machine.js (gemeinsam mit dem Side-Slot).
window.GK = window.GK || {};

(function () {
  const SM = () => GK.slotMachine;
  const MIN_BET = 10;
  const AUTO_SPINS = 10;

  let els = {};
  let reels;
  let betControl;
  let spinning = false;
  let autoLeft = 0;

  function state() {
    return GK.casino.data('slots', () => ({ bet: 100, reels: ['seven', 'seven', 'seven'], pending: null }));
  }

  function spin() {
    if (spinning) return;
    const s = state();
    if (!GK.casino.bet(s.bet)) {
      autoLeft = 0;
      GK.sound.play('denied');
      showMessage('Nicht genug Dublonen für diesen Einsatz.', 'loss');
      updateButtons();
      return;
    }
    const result = [0, 1, 2].map(() => SM().randomSymbol());
    const ev = SM().evaluate(result);
    // Ergebnis sofort speichern: Lädt man während der Animation neu, wird trotzdem ausgezahlt
    s.reels = result;
    s.pending = { bet: s.bet, payout: s.bet * ev.mult, text: ev.text };
    GK.save();
    spinning = true;
    els.message.innerHTML = '&nbsp;';
    updateButtons();
    reels.spin(result, () => settle(true));
  }

  // Gewinn auszahlen und Runde abschließen. animated = nach einer Drehung (sonst: nach dem Neuladen)
  function settle(animated) {
    const s = state();
    const p = s.pending;
    spinning = false;
    if (!p) {
      updateButtons();
      return;
    }
    s.pending = null;
    const ev = SM().evaluate(s.reels);
    GK.casino.payout(p.payout);
    if (ev.jackpot) GK.unlockAchievement('slots777');
    GK.casino.record('slots', p.bet, p.payout, p.text);
    reels.highlight(p.payout > 0 ? ev.win : []);

    if (p.payout > p.bet) {
      showMessage(`${p.text} – Gewinn: ${GK.formatMoneyHTML(p.payout)}`, 'win');
      if (animated) {
        GK.fx.pulse(els.machine, 'slot-win');
        GK.fx.celebrate(p.payout, p.bet, { el: els.window, level: ev.jackpot ? 'jackpot' : undefined, subtitle: p.text });
      }
    } else if (p.payout === p.bet) {
      showMessage(`${p.text} – Einsatz zurück`, '');
      if (animated) GK.sound.play('coin');
    } else {
      showMessage('Leider kein Gewinn.', 'loss');
    }
    // Automatik stoppt bei großen Gewinnen, damit man sie mitbekommt
    if (p.payout >= p.bet * 50) autoLeft = 0;
    if (autoLeft > 0 && animated) {
      autoLeft--;
      setTimeout(spin, 600);
    }
    updateButtons();
  }

  function showMessage(html, cls) {
    els.message.className = 'game-message ' + (cls || '');
    els.message.innerHTML = html;
  }

  function updateButtons() {
    els.spin.disabled = spinning;
    els.auto.disabled = spinning && autoLeft === 0;
    els.auto.textContent = autoLeft > 0 ? `Stopp (${autoLeft})` : `Auto ×${AUTO_SPINS}`;
    betControl.setDisabled(spinning || autoLeft > 0);
  }

  function init(body) {
    body.innerHTML = `
      <div class="slots-layout">
        <div class="slot-machine">
          <div class="slot-lights"></div>
          <div class="slot-title">★ DUBLONEN-AUTOMAT ★</div>
          <div class="slot-window"></div>
          <div class="game-message">&nbsp;</div>
          <div class="slot-bet"></div>
          <div class="game-actions">
            <button class="btn btn-primary btn-big slot-spin">🎰 Drehen</button>
            <button class="btn slot-auto"></button>
          </div>
        </div>
        <div class="paytable">
          <h3>Gewinntabelle</h3>
          <table>
            <thead><tr><th>Symbol</th><th>3 gleiche</th><th>2 gleiche</th></tr></thead>
            <tbody>
              ${SM().SYMBOLS.slice().reverse().map(s => `
                <tr><td class="paytable-icon">${s.icon}</td><td>×${s.three}</td><td>${s.two ? '×' + s.two : '–'}</td></tr>`).join('')}
            </tbody>
          </table>
          <p class="muted small">Gewinne als Vielfaches des Einsatzes (inklusive Einsatz). Auszahlungsquote ca. 96 %.</p>
        </div>
      </div>`;

    els = {
      machine: body.querySelector('.slot-machine'),
      window: body.querySelector('.slot-window'),
      message: body.querySelector('.game-message'),
      spin: body.querySelector('.slot-spin'),
      auto: body.querySelector('.slot-auto'),
    };
    reels = SM().createReels(els.window);
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
    reels.show(state().reels);
    // Eine beim Neuladen unterbrochene Runde sofort auszahlen
    if (state().pending) settle(false);
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
  GK.casino.slotsRtp = () => SM().rtp();
})();
