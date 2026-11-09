// Mast-Kletterei: Klettere den Großmast hinauf bis ins Krähennest. Auf jeder Stufe hängen mehrere Seile –
// manche davon sind morsch und reißen. Jede geschaffte Stufe erhöht den Multiplikator, auszahlen geht
// jederzeit nach der ersten Stufe. Wer ins Krähennest kommt, bekommt automatisch den Höchstgewinn.
// Welche Seile morsch sind, wird beim Start ausgelost und mit der Runde sofort gespeichert.
window.GK = window.GK || {};

// Sprache: Ersatz, falls js/i18n.js (noch) nicht geladen ist – gibt den deutschen Text zurück.
GK.t = GK.t || function (s, v) { s = String(s); return v ? s.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m)) : s; };
GK.i18n = GK.i18n || { add() {}, addHtml() {}, apply() {}, set() {}, lang: 'de' };

GK.i18n.add({
  'Mast-Kletterei': 'Mast Climb',
  'Klettere bis ins Krähennest – aber welches Seil hält?': 'Climb to the crow’s nest – but which rope holds?',
  'Nicht genug Dublonen für diesen Einsatz.': 'Not enough Doubloons for this bet.',
  'Leicht': 'Easy',
  'Mittel': 'Medium',
  'Schwer': 'Hard',
  'Extrem': 'Extreme',
  'Welches Seil hält? Tippe auf ein Seil der untersten Stufe.': 'Which rope holds? Tap a rope on the lowest level.',
  '🌊 Abgestürzt auf Stufe {level} ({mode})': '🌊 Fell on level {level} ({mode})',
  '🌊 Das Seil ist gerissen! Ab ins Wasser – der Einsatz ist weg.': '🌊 The rope snapped! Into the water – your bet is gone.',
  'Hält! Stufe {level} geschafft – jetzt ×{mult}. Weiter oder auszahlen?':
    'It holds! Level {level} cleared – now ×{mult}. Continue or cash out?',
  '🔭 Krähennest': '🔭 Crow’s nest',
  '💰 Stufe {level}': '💰 Level {level}',
  '{result} · ×{mult} ({mode})': '{result} · ×{mult} ({mode})',
  '🔭 Im Krähennest! ': '🔭 In the crow’s nest! ',
  'Ausgezahlt: {money} (×{mult})': 'Cashed out: {money} (×{mult})',
  'Ganz oben angekommen': 'Reached the very top',
  'Stufe {level}': 'Level {level}',
  'Krähennest · ×{mult}': 'Crow’s nest · ×{mult}',
  'Stufe {level}, Seil {rope}': 'Level {level}, rope {rope}',
  'Deck': 'Deck',
  'Auszahlen: {money}': 'Cash out: {money}',
  'Erst eine Stufe schaffen': 'Clear a level first',
  '{ropes} Seile je Stufe, {brokenText} · 1. Stufe ×{m1}': '{ropes} ropes per level, {brokenText} · 1st level ×{m1}',
  'eins reißt': 'one snaps',
  '{n} reißen': '{n} snap',
  'Schwierigkeit': 'Difficulty',
  'Losklettern': 'Start climbing',
  'Klettere Stufe für Stufe den Mast hinauf. Auf jeder Stufe wählst du ein Seil – hält es, steigt dein Gewinn, reißt es, fällst du ins Wasser und der Einsatz ist weg. Auszahlen kannst du nach jeder geschafften Stufe. Ganz oben im Krähennest wartet der Höchstgewinn.':
    'Climb the mast level by level. On each level you pick a rope – if it holds, your win rises; if it snaps, you fall into the water and your bet is gone. You can cash out after each cleared level. At the very top in the crow’s nest the top prize awaits.',
  'Deine Kletterpartie läuft noch – welches Seil hält?': 'Your climb is still on – which rope holds?',
  'Wähle Einsatz und Schwierigkeit – dann los!': 'Choose bet and difficulty – then go!',
});

(function () {
  // Eigenes Symbol (in Node-Tests ohne icons.js bleibt es leer)
  const ic = (name, cls) => (GK.icon ? GK.icon(name, cls) : '');
  const MIN_BET = 10;
  const RTP = 0.97;
  const LEVELS = 9;
  // Seile je Stufe und wie viele davon reißen
  const MODES = {
    easy:    { name: 'Leicht',  icon: '🪢', sym: 'shield', ropes: 4, broken: 1 },
    medium:  { name: 'Mittel',  icon: '⛵', sym: 'sailboat', ropes: 3, broken: 1 },
    hard:    { name: 'Schwer',  icon: '🌊', sym: 'wave', ropes: 2, broken: 1 },
    extreme: { name: 'Extrem',  icon: '⚡', sym: 'bolt', ropes: 3, broken: 2 },
  };

  let els = {};
  let betControl;
  let busy = false;

  function state() {
    return GK.casino.data('tower', () => ({ bet: 100, mode: 'medium', round: null, last: null }));
  }

  // ---------- Mathematik (auch für Tests) ----------

  function chance(mode) {
    const m = MODES[mode];
    return (m.ropes - m.broken) / m.ropes;
  }

  // Multiplikator nach `level` geschafften Stufen (auf Hundertstel abgerundet)
  function multiplier(mode, level) {
    if (level <= 0) return 1;
    return Math.floor(RTP / Math.pow(chance(mode), level) * 100 + 1e-9) / 100;
  }

  // Morsche Seile je Stufe auslosen
  function makeMast(mode) {
    const m = MODES[mode];
    return Array.from({ length: LEVELS }, () => GK.rng.shuffle(Array.from({ length: m.ropes }, (_, i) => i)).slice(0, m.broken));
  }

  // ---------- Ablauf ----------

  function start() {
    const s = state();
    if (s.round || busy) return;
    if (!GK.casino.bet(s.bet)) {
      GK.sound.play('denied');
      showMessage(GK.t('Nicht genug Dublonen für diesen Einsatz.'), 'loss');
      return;
    }
    s.round = { bet: s.bet, mode: s.mode, broken: makeMast(s.mode), picks: [], level: 0 };
    s.last = null;
    GK.save();
    GK.sound.play('chip');
    showMessage(GK.t('Welches Seil hält? Tippe auf ein Seil der untersten Stufe.'), '');
    render();
  }

  function pick(level, rope) {
    const s = state();
    const r = s.round;
    if (!r || busy || level !== r.level) return;
    r.picks.push(rope);
    const broke = r.broken[level].includes(rope);
    if (broke) {
      s.round = null;
      s.last = Object.assign({}, r, { fell: level });
      GK.casino.record('tower', r.bet, 0, GK.t('🌊 Abgestürzt auf Stufe {level} ({mode})', { level: level + 1, mode: GK.t(MODES[r.mode].name) }));
    } else {
      r.level++;
    }
    GK.save();
    busy = true;
    render();
    GK.sound.play(broke ? 'boom' : 'dig');
    setTimeout(() => {
      busy = false;
      if (broke) {
        GK.fx.shake('small');
        GK.sound.play('lose');
        showMessage(GK.t('🌊 Das Seil ist gerissen! Ab ins Wasser – der Einsatz ist weg.'), 'loss');
      } else {
        GK.sound.play('gem', 0.9 + r.level * 0.06);
        const cell = els.mast.querySelector(`.tw-rope[data-level="${level}"][data-rope="${rope}"]`);
        if (cell) {
          const c = GK.fx.center(cell);
          GK.fx.burst(c.x, c.y, { count: 8, kind: 'sparkle', speed: 260 });
        }
        if (r.level >= LEVELS) {
          GK.unlockAchievement('towerTop');
          cashOut(true);
          return;
        }
        showMessage(GK.t('Hält! Stufe {level} geschafft – jetzt ×{mult}. Weiter oder auszahlen?', { level: r.level, mult: fmt(multiplier(r.mode, r.level)) }), '');
      }
      render();
    }, GK.state.settings.effects === 'reduced' ? 150 : 420);
  }

  function cashOut(top) {
    const s = state();
    const r = s.round;
    if (!r || r.level < 1) return;
    const mult = multiplier(r.mode, r.level);
    const payout = Math.floor(r.bet * mult);
    s.round = null;
    s.last = Object.assign({}, r, { fell: null, payout });
    GK.casino.payout(payout);
    GK.casino.record('tower', r.bet, payout, GK.t('{result} · ×{mult} ({mode})', { result: top === true ? GK.t('🔭 Krähennest') : GK.t('💰 Stufe {level}', { level: r.level }), mult: fmt(mult), mode: GK.t(MODES[r.mode].name) }));
    GK.save();
    showMessage(`${top === true ? GK.t('🔭 Im Krähennest! ') : ''}${GK.t('Ausgezahlt: {money} (×{mult})', { money: GK.formatMoneyHTML(payout), mult: fmt(mult) })}`, 'win');
    GK.fx.celebrate(payout, r.bet, { el: els.mast, subtitle: top === true ? GK.t('Ganz oben angekommen') : GK.t('Stufe {level}', { level: r.level }) });
    render();
  }

  // ---------- Darstellung ----------

  function fmt(m) {
    return m >= 1000 ? GK.formatNumber(Math.floor(m)) : GK.formatDecimal(m, 2, 2);
  }

  function render() {
    const s = state();
    const r = s.round;
    const shown = r || s.last;
    const mode = shown ? shown.mode : s.mode;
    const m = MODES[mode];
    // Stufen von oben (Krähennest) nach unten
    let html = `<div class="tw-nest ${shown && !r && shown.fell == null && shown.level >= LEVELS ? 'reached' : ''}">${ic('eye')} ${GK.t('Krähennest · ×{mult}', { mult: fmt(multiplier(mode, LEVELS)) })}</div>`;
    for (let lv = LEVELS - 1; lv >= 0; lv--) {
      const current = r && lv === r.level;
      const done = shown && lv < (r ? r.level : shown.level);
      const ropes = Array.from({ length: m.ropes }, (_, i) => {
        let cls = 'tw-rope';
        let icon = '🪢';
        if (shown) {
          const picked = shown.picks[lv] === i;
          const broken = shown.broken[lv].includes(i);
          if (picked && broken) {
            cls += ' snapped';
            icon = '💥';
          } else if (picked) {
            cls += ' held';
            icon = '🧗';
          } else if (!r && broken) {
            cls += ' rotten';
            icon = '🪵';
          } else if (!r || lv < (r ? r.level : 0)) {
            cls += ' faded';
          }
        }
        if (current) cls += ' active';
        return `<button type="button" class="${cls}" data-level="${lv}" data-rope="${i}" ${current && !busy ? '' : 'disabled'} aria-label="${GK.t('Stufe {level}, Seil {rope}', { level: lv + 1, rope: i + 1 })}">${icon}</button>`;
      }).join('');
      html += `<div class="tw-level ${current ? 'current' : ''} ${done ? 'done' : ''}">
        <span class="tw-mult">×${fmt(multiplier(mode, lv + 1))}</span>
        <div class="tw-ropes" style="--ropes:${m.ropes}">${ropes}</div>
      </div>`;
    }
    html += `<div class="tw-deck">${ic('ship')} ${GK.t('Deck')}</div>`;
    els.mast.innerHTML = html;
    els.mast.classList.toggle('fell', !!(shown && !r && shown.fell != null));
    const playing = !!r;
    els.start.hidden = playing;
    els.start.disabled = busy;
    els.cash.hidden = !playing;
    els.cash.disabled = busy || !r || r.level < 1;
    GK.setHTML(els.cash, r && r.level >= 1 ? `${ic('bag')}${GK.t('Auszahlen: {money}', { money: GK.formatMoneyHTML(Math.floor(r.bet * multiplier(r.mode, r.level))) })}` : `${ic('bag')}${GK.t('Erst eine Stufe schaffen')}`);
    els.modes.forEach(b => {
      const active = b.dataset.mode === (r ? r.mode : s.mode);
      b.classList.toggle('active', active);
      b.setAttribute('aria-pressed', active);
      b.disabled = playing || busy;
    });
    betControl.setDisabled(playing || busy);
    els.info.innerHTML = GK.t('{ropes} Seile je Stufe, {brokenText} · 1. Stufe ×{m1}', { ropes: m.ropes, brokenText: m.broken === 1 ? GK.t('eins reißt') : GK.t('{n} reißen', { n: m.broken }), m1: fmt(multiplier(mode, 1)) });
  }

  function showMessage(html, cls) {
    if (!els.message) return;
    els.message.className = 'game-message ' + (cls || '');
    els.message.innerHTML = html;
    if (GK.iconifyLead) GK.iconifyLead(els.message); // Emoji vorn → eigenes Symbol
  }

  function init(body) {
    body.innerHTML = `
      <div class="mines-layout">
        <div class="tw-mast"></div>
        <div class="mines-controls">
          <div class="bet-label">${GK.t('Schwierigkeit')}</div>
          <div class="plinko-risks tower-modes" role="group" aria-label="${GK.t('Schwierigkeit')}">
            ${Object.entries(MODES).map(([id, m]) => `<button type="button" class="btn btn-small tower-mode" data-mode="${id}">${ic(m.sym)}${GK.t(m.name)}</button>`).join('')}
          </div>
          <div class="mines-info tower-info"></div>
          <div class="game-message">&nbsp;</div>
          <div class="tower-bet"></div>
          <div class="game-actions">
            <button class="btn btn-primary btn-big tower-start">${ic('up')}${GK.t('Losklettern')}</button>
            <button class="btn btn-primary btn-big tower-cash" hidden></button>
          </div>
          <p class="muted small">${GK.t('Klettere Stufe für Stufe den Mast hinauf. Auf jeder Stufe wählst du ein Seil – hält es, steigt dein Gewinn, reißt es, fällst du ins Wasser und der Einsatz ist weg. Auszahlen kannst du nach jeder geschafften Stufe. Ganz oben im Krähennest wartet der Höchstgewinn.')}</p>
        </div>
      </div>`;
    els = {
      mast: body.querySelector('.tw-mast'),
      info: body.querySelector('.tower-info'),
      message: body.querySelector('.game-message'),
      start: body.querySelector('.tower-start'),
      cash: body.querySelector('.tower-cash'),
      modes: [...body.querySelectorAll('.tower-mode')],
    };
    betControl = GK.casino.createBetControl(body.querySelector('.tower-bet'), {
      min: MIN_BET,
      get: () => state().bet,
      set: v => { state().bet = v; },
    });
    els.mast.addEventListener('click', e => {
      const rope = e.target.closest('.tw-rope');
      if (rope && !rope.disabled) pick(Number(rope.dataset.level), Number(rope.dataset.rope));
    });
    els.start.addEventListener('click', start);
    els.cash.addEventListener('click', () => cashOut(false));
    els.modes.forEach(btn => btn.addEventListener('click', () => {
      if (state().round || busy) return;
      state().mode = btn.dataset.mode;
      state().last = null;
      GK.sound.play('chip');
      GK.save();
      render();
    }));
    refresh();
  }

  function refresh() {
    busy = false;
    showMessage(state().round ? GK.t('Deine Kletterpartie läuft noch – welches Seil hält?') : GK.t('Wähle Einsatz und Schwierigkeit – dann los!'), '');
    render();
  }

  GK.casino.register({
    id: 'tower',
    category: 'quick',
    name: 'Mast-Kletterei',
    emoji: '🧗',
    desc: 'Klettere bis ins Krähennest – aber welches Seil hält?',
    init,
    refresh,
    render: () => {
      if (!state().round) betControl.refresh();
    },
  });

  // Für Tests
  GK.casino.towerMath = { MODES, LEVELS, RTP, chance, multiplier, makeMast };
})();
