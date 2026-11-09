// Slot-Maschine im Casino: 3 Walzen, eine Gewinnlinie. Auszahlungsquote 96,2 %.
// Symbole, Gewinntabelle und Walzen kommen aus slot-machine.js (gemeinsam mit dem Side-Slot).
window.GK = window.GK || {};

// Sprache: Ersatz, falls js/i18n.js (noch) nicht geladen ist – gibt den deutschen Text zurück.
GK.t = GK.t || function (s, v) { s = String(s); return v ? s.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m)) : s; };
GK.i18n = GK.i18n || { add() {}, addHtml() {}, apply() {}, set() {}, lang: 'de' };

GK.i18n.add({
  'Nicht genug Dublonen für diesen Einsatz.': 'Not enough Doubloons for this bet.',
  '{text} – Gewinn: {amt}': '{text} – win: {amt}',
  '{text} – Einsatz zurück': '{text} – bet back',
  'Leider kein Gewinn.': 'No win this time.',
  'Stopp ({n})': 'Stop ({n})',
  'Auto ×{n}': 'Auto ×{n}',
  '★ DUBLONEN-AUTOMAT ★': '★ DOUBLOON SLOT ★',
  'Zieh am Hebel!': 'Pull the lever!',
  'Gewinntabelle': 'Paytable',
  'Symbol': 'Symbol',
  '3 gleiche': '3 of a kind',
  '2 gleiche': '2 of a kind',
  'Gewinne als Vielfaches des Einsatzes (inklusive Einsatz).': 'Wins as a multiple of your bet (bet included).',
  // Spiel-Name und -Beschreibung (für die Lobby)
  'Slot-Maschine': 'Slot Machine',
  'Drei gleiche Symbole gewinnen – bis zu ×777!': 'Three matching symbols win – up to ×777!',
});

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
      showMessage(GK.t('Nicht genug Dublonen für diesen Einsatz.'), 'loss');
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
    if (s.reels.filter(id => id === 'seven').length >= 2) GK.unlockAchievement('slots777');
    GK.casino.record('slots', p.bet, p.payout, p.text);
    reels.highlight(p.payout > 0 ? ev.win : []);

    if (p.payout > p.bet) {
      showMessage(GK.t('{text} – Gewinn: {amt}', { text: p.text, amt: GK.formatMoneyHTML(p.payout) }), 'win');
      if (animated) {
        GK.fx.pulse(els.machine, 'slot-win');
        GK.fx.celebrate(p.payout, p.bet, { el: els.window, level: ev.jackpot ? 'jackpot' : undefined, subtitle: p.text });
      }
    } else if (p.payout === p.bet) {
      showMessage(GK.t('{text} – Einsatz zurück', { text: p.text }), '');
      if (animated) GK.sound.play('coin');
    } else {
      showMessage(GK.t('Leider kein Gewinn.'), 'loss');
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
    els.auto.textContent = autoLeft > 0 ? GK.t('Stopp ({n})', { n: autoLeft }) : GK.t('Auto ×{n}', { n: AUTO_SPINS });
    betControl.setDisabled(spinning || autoLeft > 0);
  }

  function init(body) {
    body.innerHTML = `
      <div class="slots-layout">
        <div class="slot-machine">
          <div class="slot-lights"></div>
          <div class="slot-title">${GK.t('★ DUBLONEN-AUTOMAT ★')}</div>
          <div class="slot-front">
            <div class="slot-window"></div>
          </div>
          <div class="game-message">${GK.t('Zieh am Hebel!')}</div>
          <div class="slot-bet"></div>
          <div class="game-actions">
            <button class="btn slot-auto"></button>
          </div>
        </div>
        <div class="paytable">
          <h3>${GK.t('Gewinntabelle')}</h3>
          <table>
            <thead><tr><th>${GK.t('Symbol')}</th><th>${GK.t('3 gleiche')}</th><th>${GK.t('2 gleiche')}</th></tr></thead>
            <tbody>
              ${SM().SYMBOLS.slice().reverse().map(s => `
                <tr><td class="paytable-icon">${s.icon}</td><td>×${s.three}</td><td>${s.two ? '×' + s.two : '–'}</td></tr>`).join('')}
            </tbody>
          </table>
          <p class="muted small">${GK.t('Gewinne als Vielfaches des Einsatzes (inklusive Einsatz).')}</p>
        </div>
      </div>`;

    els = {
      machine: body.querySelector('.slot-machine'),
      window: body.querySelector('.slot-window'),
      message: body.querySelector('.game-message'),
      spin: SM().createLever({ onPull: spin, className: 'slot-spin' }),
      auto: body.querySelector('.slot-auto'),
    };
    body.querySelector('.slot-front').appendChild(els.spin);
    reels = SM().createReels(els.window);
    betControl = GK.casino.createBetControl(body.querySelector('.slot-bet'), {
      min: MIN_BET,
      get: () => state().bet,
      set: v => { state().bet = v; },
    });
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
    category: 'slots',
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
