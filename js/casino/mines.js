// Schatzinsel: Auf einer Insel mit 25 Feldern sind Totenköpfe vergraben. Jeder gefundene Schatz
// erhöht den Gewinn – ein Totenkopf beendet die Runde. Abkassieren kann man jederzeit.
// Die Runde (auch die Lage der Totenköpfe) wird sofort gespeichert und übersteht das Neuladen.
window.GK = window.GK || {};

(function () {
  const MIN_BET = 10;
  const FIELDS = 25;
  const SKULL_OPTIONS = [1, 3, 5, 10, 20];
  const EDGE = 0.97; // Faktor auf den fairen Multiplikator
  const TREASURES = ['🪙', '💰', '💎', '👑', '🏺', '💍'];

  let els = {};
  let betControl;

  function state() {
    return GK.casino.data('mines', () => ({ bet: 100, skulls: 3, round: null, last: null }));
  }

  // ---------- Mathematik (auch für Tests) ----------

  // Rückzahlung (inklusive Einsatz) nach `found` gefundenen Schätzen bei `skulls` Totenköpfen
  function multiplier(skulls, found) {
    if (found <= 0) return 1;
    let m = EDGE;
    for (let i = 0; i < found; i++) m *= (FIELDS - i) / (FIELDS - skulls - i);
    return Math.floor(m * 100) / 100;
  }

  // Erwartete Rückzahlung, wenn man immer nach `found` Schätzen abkassiert
  function rtp(skulls, found) {
    let survive = 1;
    for (let i = 0; i < found; i++) survive *= (FIELDS - skulls - i) / (FIELDS - i);
    return survive * multiplier(skulls, found);
  }

  // ---------- Ablauf ----------

  function start() {
    const s = state();
    if (s.round) return;
    if (!GK.casino.bet(s.bet)) {
      GK.sound.play('denied');
      showMessage('Nicht genug Dublonen für diesen Einsatz.', 'loss');
      return;
    }
    const spots = GK.rng.shuffle(Array.from({ length: FIELDS }, (_, i) => i));
    s.round = { bet: s.bet, skulls: s.skulls, mines: spots.slice(0, s.skulls), found: [], icons: {} };
    s.last = null;
    GK.save();
    GK.sound.play('chip');
    showMessage('Wo liegt der Schatz? Tippe auf ein Feld!', '');
    render();
  }

  function dig(index) {
    const s = state();
    const r = s.round;
    if (!r || r.found.includes(index)) return;
    const cell = els.grid.children[index];
    if (r.mines.includes(index)) {
      // Totenkopf!
      s.round = null;
      s.last = { mines: r.mines, found: r.found, icons: r.icons, hit: index, bet: r.bet, payout: 0 };
      GK.casino.record('mines', r.bet, 0, `☠️ nach ${r.found.length} ${r.found.length === 1 ? 'Schatz' : 'Schätzen'}`);
      render();
      GK.sound.play('boom');
      GK.fx.shake('small');
      const pos = GK.fx.center(els.grid.children[index]);
      GK.fx.burst(pos.x, pos.y, { count: 18, kind: 'sparkle', speed: 500 });
      GK.fx.pulse(els.grid.children[index], 'mine-boom');
      showMessage('☠️ Ein Totenkopf! Der Schatz ist verloren.', 'loss');
      return;
    }
    r.found.push(index);
    r.icons[index] = TREASURES[Math.min(TREASURES.length - 1, Math.floor(r.found.length / 3))];
    GK.save();
    GK.sound.play('dig');
    setTimeout(() => GK.sound.play('gem', 0.9 + r.found.length * 0.05), 90);
    render();
    const pos = GK.fx.center(cell);
    GK.fx.burst(pos.x, pos.y, { count: 8, kind: 'sparkle', speed: 260 });
    // Alle Schätze gefunden: automatisch abkassieren
    if (r.found.length === FIELDS - r.skulls) cashOut();
  }

  function cashOut() {
    const s = state();
    const r = s.round;
    if (!r || !r.found.length) return;
    const mult = multiplier(r.skulls, r.found.length);
    const payout = Math.floor(r.bet * mult);
    s.round = null;
    s.last = { mines: r.mines, found: r.found, icons: r.icons, hit: null, bet: r.bet, payout };
    GK.casino.payout(payout);
    const all = r.found.length === FIELDS - r.skulls;
    if (all) GK.unlockAchievement('minesAll');
    GK.casino.record('mines', r.bet, payout, `${r.found.length} ${r.found.length === 1 ? 'Schatz' : 'Schätze'} · ×${formatMult(mult)}`);
    render();
    showMessage(`${all ? '🏝️ Alle Schätze gefunden! ' : ''}Abkassiert: ${GK.formatMoneyHTML(payout)} (×${formatMult(mult)})`, 'win');
    GK.fx.celebrate(payout, r.bet, { el: els.grid, subtitle: `${r.found.length} Schätze` });
  }

  // ---------- Darstellung ----------

  function formatMult(m) {
    return m.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function render() {
    const s = state();
    const r = s.round;
    const shown = r || s.last;
    [...els.grid.children].forEach((cell, i) => {
      let cls = 'mine-cell';
      let html = '';
      if (shown) {
        if (shown.found.includes(i)) {
          cls += ' found';
          html = shown.icons[i] || '💰';
        } else if (!r && shown.mines.includes(i)) {
          cls += i === shown.hit ? ' skull hit' : ' skull faded';
          html = '☠️';
        } else if (!r) {
          cls += ' faded';
          html = '💰';
        }
      }
      if (cell.className !== cls) cell.className = cls;
      if (cell.innerHTML !== html) cell.innerHTML = html;
      cell.disabled = !r || shown.found.includes(i);
    });

    const playing = !!r;
    els.start.hidden = playing;
    els.cash.hidden = !playing;
    els.skulls.forEach(btn => {
      btn.classList.toggle('active', Number(btn.dataset.skulls) === s.skulls);
      btn.disabled = playing;
    });
    betControl.setDisabled(playing);
    if (playing) {
      const now = multiplier(r.skulls, r.found.length);
      const next = multiplier(r.skulls, r.found.length + 1);
      els.cash.disabled = !r.found.length;
      els.cash.innerHTML = r.found.length
        ? `💰 Abkassieren: ${GK.formatMoneyHTML(Math.floor(r.bet * now))}`
        : '💰 Erst einen Schatz finden';
      els.info.innerHTML = `Gefunden: <b>${r.found.length}</b> · Jetzt: <b>×${formatMult(now)}</b> · Nächster Schatz: <b>×${formatMult(next)}</b>`;
    } else {
      els.info.innerHTML = `Mit ${s.skulls} ${s.skulls === 1 ? 'Totenkopf' : 'Totenköpfen'}: 1. Schatz ×${formatMult(multiplier(s.skulls, 1))}` +
        ` · 3. Schatz ×${formatMult(multiplier(s.skulls, Math.min(3, FIELDS - s.skulls)))}`;
    }
  }

  function showMessage(html, cls) {
    els.message.className = 'game-message ' + (cls || '');
    els.message.innerHTML = html;
  }

  function init(body) {
    body.innerHTML = `
      <div class="mines-layout">
        <div class="mines-island">
          <div class="mines-grid">${Array.from({ length: FIELDS }, (_, i) => `<button class="mine-cell" data-i="${i}" aria-label="Feld ${i + 1}"></button>`).join('')}</div>
        </div>
        <div class="mines-controls">
          <div class="bet-label">Totenköpfe auf der Insel</div>
          <div class="mines-skulls" role="group" aria-label="Totenköpfe">
            ${SKULL_OPTIONS.map(n => `<button type="button" class="btn btn-small mines-skull" data-skulls="${n}">☠️ ${n}</button>`).join('')}
          </div>
          <div class="mines-info"></div>
          <div class="game-message">&nbsp;</div>
          <div class="mines-bet"></div>
          <div class="game-actions">
            <button class="btn btn-primary btn-big mines-start">🏝️ Schatzsuche starten</button>
            <button class="btn btn-primary btn-big mines-cash" hidden></button>
          </div>
          <p class="muted small">Grabe Feld für Feld nach Schätzen. Jeder Fund erhöht deinen Gewinn –
            aber triffst du einen Totenkopf, ist alles weg. Mehr Totenköpfe = höhere Gewinne.</p>
        </div>
      </div>`;
    els = {
      grid: body.querySelector('.mines-grid'),
      info: body.querySelector('.mines-info'),
      message: body.querySelector('.game-message'),
      start: body.querySelector('.mines-start'),
      cash: body.querySelector('.mines-cash'),
      skulls: [...body.querySelectorAll('.mines-skull')],
    };
    betControl = GK.casino.createBetControl(body.querySelector('.mines-bet'), {
      min: MIN_BET,
      get: () => state().bet,
      set: v => { state().bet = v; },
    });
    els.grid.addEventListener('click', e => {
      const cell = e.target.closest('.mine-cell');
      if (cell) dig(Number(cell.dataset.i));
    });
    els.start.addEventListener('click', start);
    els.cash.addEventListener('click', cashOut);
    els.skulls.forEach(btn => btn.addEventListener('click', () => {
      if (state().round) return;
      state().skulls = Number(btn.dataset.skulls);
      state().last = null;
      GK.sound.play('chip');
      GK.save();
      render();
    }));
    refresh();
  }

  function refresh() {
    showMessage(state().round ? 'Deine Schatzsuche läuft noch – grab weiter!' : 'Wähle Einsatz und Totenköpfe.', '');
    render();
  }

  GK.casino.register({
    id: 'mines',
    category: 'quick',
    name: 'Schatzinsel',
    emoji: '🏝️',
    desc: 'Grab nach Schätzen, aber hüte dich vor den Totenköpfen!',
    init,
    refresh,
    render: () => {
      if (!state().round) betControl.refresh();
    },
  });

  // Für Tests
  GK.casino.minesMath = { FIELDS, SKULL_OPTIONS, multiplier, rtp };
})();
