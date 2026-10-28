// Side-Slot: kleine Slot-Maschine direkt unter der Klick-Münze – klicken und nebenbei zocken.
// Gleiche Symbole und Gewinntabelle wie die große Slot-Maschine (Auszahlungsquote 96,2 %).
window.GK = window.GK || {};

(function () {
  const SM = () => GK.slotMachine;
  // Einsatz-Stufen für die − / + Knöpfe
  const STEPS = [10, 50, 100, 500, 1e3, 5e3, 1e4, 5e4, 1e5, 5e5, 1e6, 5e6, 1e7, 5e7, 1e8, 1e9, 1e10, 1e11, 1e12];

  let root;
  let els = {};
  let reels;
  let spinning = false;
  let auto = false;

  function state() {
    return GK.casino.data('sideSlot', () => ({ bet: 10, reels: ['cherry', 'bell', 'star'], pending: null }));
  }

  function allowedSteps() {
    return STEPS.filter(v => v <= GK.casino.maxBet());
  }

  function changeBet(direction) {
    const steps = allowedSteps();
    const index = steps.findIndex(v => v >= state().bet);
    const next = steps[Math.min(Math.max((index === -1 ? steps.length - 1 : index) + direction, 0), steps.length - 1)];
    state().bet = next;
    GK.sound.play('chip');
    render();
  }

  function spin() {
    if (spinning) return;
    const s = state();
    if (s.bet > GK.casino.maxBet()) s.bet = allowedSteps().pop();
    if (!GK.casino.bet(s.bet)) {
      stopAuto();
      GK.sound.play('denied');
      showMessage('Zu wenig Dublonen', 'loss');
      return;
    }
    const result = [0, 1, 2].map(() => SM().randomSymbol());
    const ev = SM().evaluate(result);
    s.reels = result;
    s.pending = { bet: s.bet, payout: s.bet * ev.mult, text: ev.text };
    GK.save();
    spinning = true;
    showMessage('&nbsp;', '');
    render();
    reels.spin(result, () => settle(true));
  }

  function settle(animated) {
    const s = state();
    const p = s.pending;
    spinning = false;
    if (!p) {
      render();
      return;
    }
    s.pending = null;
    const ev = SM().evaluate(s.reels);
    GK.casino.payout(p.payout);
    if (ev.jackpot) GK.unlockAchievement('slots777');
    GK.casino.record('sideSlot', p.bet, p.payout, p.text);
    reels.highlight(p.payout > 0 ? ev.win : []);

    if (p.payout > p.bet) {
      showMessage(`+${GK.formatMoneyHTML(p.payout - p.bet)}`, 'win');
      if (animated) {
        const level = GK.fx.celebrate(p.payout, p.bet, { el: els.window, level: ev.jackpot ? 'jackpot' : undefined, subtitle: p.text, quiet: true });
        if (level !== 'small') stopAuto(); // große Gewinne nicht im Automatik-Trubel untergehen lassen
      }
    } else if (p.payout === p.bet) {
      showMessage('Einsatz zurück', '');
      if (animated) GK.sound.play('coin');
    } else {
      showMessage(`−${GK.formatMoneyHTML(p.bet)}`, 'loss');
    }
    if (auto && animated) setTimeout(() => { if (auto) spin(); }, 350);
    render();
  }

  function stopAuto() {
    auto = false;
    render();
  }

  function toggleAuto() {
    auto = !auto;
    if (auto && !spinning) spin();
    render();
  }

  function showMessage(html, cls) {
    els.message.className = 'side-slot-msg ' + (cls || '');
    els.message.innerHTML = html;
  }

  function render() {
    if (!root) return;
    const s = state();
    if (s.bet > GK.casino.maxBet()) s.bet = allowedSteps().pop();
    els.bet.innerHTML = GK.formatMoneyHTML(s.bet);
    els.spin.disabled = spinning || auto;
    els.minus.disabled = auto || spinning;
    els.plus.disabled = auto || spinning;
    els.auto.textContent = auto ? '⏹ Stopp' : '🔁 Auto';
    els.auto.classList.toggle('active', auto);
    els.spin.classList.toggle('cant-afford', !GK.canAfford(s.bet));
  }

  function init() {
    root = document.getElementById('side-slot');
    root.innerHTML = `
      <div class="side-slot-head">
        <span class="side-slot-title">🎰 Side-Slot</span>
        <span class="side-slot-msg">&nbsp;</span>
      </div>
      <div class="side-slot-front">
        <div class="side-slot-window"></div>
      </div>
      <div class="side-slot-controls">
        <button class="btn btn-small side-minus" aria-label="Einsatz verringern">−</button>
        <span class="side-bet"></span>
        <button class="btn btn-small side-plus" aria-label="Einsatz erhöhen">+</button>
        <button class="btn side-auto"></button>
      </div>`;
    els = {
      window: root.querySelector('.side-slot-window'),
      message: root.querySelector('.side-slot-msg'),
      bet: root.querySelector('.side-bet'),
      minus: root.querySelector('.side-minus'),
      plus: root.querySelector('.side-plus'),
      spin: SM().createLever({ onPull: spin, small: true, className: 'side-spin' }),
      auto: root.querySelector('.side-auto'),
    };
    root.querySelector('.side-slot-front').appendChild(els.spin);
    reels = SM().createReels(els.window, { spinTimes: [550, 750, 950] }); // schneller als die große Maschine
    els.minus.addEventListener('click', () => changeBet(-1));
    els.plus.addEventListener('click', () => changeBet(1));
    els.auto.addEventListener('click', toggleAuto);
    GK.casino.registerName('sideSlot', '🎰 Side-Slot');
    refresh();
  }

  function refresh() {
    spinning = false;
    auto = false;
    reels.show(state().reels);
    if (state().pending) settle(false);
    render();
  }

  GK.sideSlot = {
    init,
    refresh,
    render,
    stopAuto,
    busy: () => spinning || !!state().pending,
  };
})();
