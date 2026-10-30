// Höher oder tiefer: Eine Karte liegt offen. Ist die nächste höher (oder gleich) oder tiefer (oder gleich)?
// Jeder richtige Tipp erhöht den Multiplikator – je unwahrscheinlicher der Tipp, desto mehr. Auszahlen geht
// nach jedem richtigen Tipp, ein falscher Tipp kostet den Einsatz. Dreimal pro Runde darf man eine Karte
// überspringen. Gezogen wird aus einem vollen Blatt (jede Karte kann jederzeit kommen).
// Die Runde wird nach jedem Tipp sofort gespeichert – Neuladen kostet nichts und bringt nichts.
window.GK = window.GK || {};

(function () {
  const MIN_BET = 10;
  const RTP = 0.97;
  const SKIPS = 3;
  const MAX_MULT = 10000;   // ab hier wird automatisch ausgezahlt
  const ANIM = 450;

  let els = {};
  let betControl;
  let busy = false;

  function state() {
    return GK.casino.data('hilo', () => ({ bet: 100, round: null, last: null, history: [] }));
  }

  // ---------- Mathematik (auch für Tests) ----------

  const value = card => GK.cards.rankValue(card); // 2 … 14 (Ass)

  // Chance, dass die nächste Karte höher oder gleich (hi) bzw. tiefer oder gleich (lo) ist
  function chance(card, dir) {
    const v = value(card);
    return dir === 'hi' ? (15 - v) / 13 : (v - 1) / 13;
  }

  // Multiplikator nach richtigen Tipps mit der Gesamt-Wahrscheinlichkeit prob (auf Hundertstel abgerundet).
  // So fließen im Schnitt 97 % zurück – egal, wie man tippt und wann man auszahlt.
  function multiplier(prob) {
    return prob >= 1 ? 1 : Math.floor(RTP / prob * 100 + 1e-9) / 100;
  }

  function randomCard() {
    return GK.cards.RANKS[GK.rng.int(13)] + GK.cards.SUITS[GK.rng.int(4)];
  }

  function wins(card, next, dir) {
    return dir === 'hi' ? value(next) >= value(card) : value(next) <= value(card);
  }

  // ---------- Ablauf ----------

  function start() {
    const s = state();
    if (s.round || busy) return;
    if (!GK.casino.bet(s.bet)) {
      GK.sound.play('denied');
      showMessage('Nicht genug Dublonen für diesen Einsatz.', 'loss');
      return;
    }
    const card = randomCard();
    s.round = { bet: s.bet, card, prob: 1, steps: 0, skips: SKIPS, cards: [{ card, how: 'start' }] };
    s.last = null;
    GK.save();
    GK.sound.play('card');
    showMessage('Höher oder tiefer? Gleich zählt immer als richtig.', '');
    render(true);
  }

  function guess(dir) {
    const s = state();
    const r = s.round;
    if (!r || busy) return;
    const p = chance(r.card, dir);
    if (p >= 1) return;
    const next = randomCard();
    const ok = wins(r.card, next, dir);
    if (ok) {
      r.prob *= p;
      r.steps++;
      r.card = next;
      r.cards.push({ card: next, how: dir });
      if (r.cards.length > 40) r.cards.splice(1, r.cards.length - 40);
    } else {
      s.round = null;
      s.last = { bet: r.bet, cards: r.cards.concat({ card: next, how: dir, wrong: true }), steps: r.steps, payout: 0 };
      pushHistory(0);
      GK.casino.record('hilo', r.bet, 0, `❌ Falsch getippt nach ${r.steps} ${r.steps === 1 ? 'Treffer' : 'Treffern'}`);
    }
    GK.save();
    GK.sound.play('flip');
    animate(() => {
      if (ok) {
        GK.sound.play('gem', 0.9 + Math.min(r.steps, 12) * 0.05);
        if (r.steps >= 10) GK.unlockAchievement('hilo10');
        if (multiplier(r.prob) >= MAX_MULT) {
          cashOut();
          return;
        }
        showMessage(`Richtig! Jetzt ×${fmt(multiplier(r.prob))} – weiter oder auszahlen?`, '');
      } else {
        GK.sound.play('lose');
        GK.fx.shake('small');
        showMessage(`❌ Leider falsch – ${GK.cards.label(next)}. Der Einsatz ist weg.`, 'loss');
      }
    });
  }

  function skip() {
    const r = state().round;
    if (!r || busy || r.skips <= 0) return;
    r.skips--;
    r.card = randomCard();
    r.cards.push({ card: r.card, how: 'skip' });
    GK.save();
    GK.sound.play('card');
    animate(() => showMessage(`Neue Karte – noch ${r.skips}× überspringen möglich.`, ''));
  }

  function cashOut() {
    const s = state();
    const r = s.round;
    if (!r || r.steps < 1) return;
    const mult = multiplier(r.prob);
    const payout = Math.floor(r.bet * mult);
    s.round = null;
    s.last = { bet: r.bet, cards: r.cards, steps: r.steps, payout };
    GK.casino.payout(payout);
    pushHistory(mult);
    GK.casino.record('hilo', r.bet, payout, `💰 ${r.steps} Treffer · ×${fmt(mult)}`);
    GK.save();
    showMessage(`💰 Ausgezahlt: ${GK.formatMoneyHTML(payout)} (×${fmt(mult)})`, 'win');
    GK.fx.celebrate(payout, r.bet, { el: els.table, subtitle: `${r.steps} richtige Tipps` });
    render(false);
  }

  function pushHistory(mult) {
    const h = state().history;
    h.unshift(Math.round(mult * 100) / 100);
    h.length = Math.min(h.length, 14);
  }

  // Kurz sperren, bis die neue Karte aufgedeckt ist
  function animate(done) {
    busy = true;
    render(true);
    setTimeout(() => {
      busy = false;
      done();
      render(false);
    }, GK.state.settings.effects === 'reduced' ? 150 : ANIM);
  }

  // ---------- Darstellung ----------

  function fmt(m) {
    return GK.formatDecimal(m, 2, 2);
  }

  function render(animateLast) {
    const s = state();
    const r = s.round;
    const shown = r || s.last;
    const cards = shown ? shown.cards : [];
    const current = cards.length ? cards[cards.length - 1] : null;
    els.card.innerHTML = current ? GK.cards.html(current.card, false, `hilo-big ${animateLast ? 'deal-in' : ''} ${current.wrong ? 'wrong' : ''}`) : GK.cards.html(null, true, 'hilo-big');
    // Bisherige Karten (die letzte liegt groß in der Mitte)
    els.trail.innerHTML = cards.slice(-9, -1).map(c => `<span class="hilo-step ${c.how}">${GK.cards.html(c.card, false, 'small')}
      <i>${c.how === 'hi' ? '⬆' : c.how === 'lo' ? '⬇' : c.how === 'skip' ? '⏭' : ''}</i></span>`).join('');
    const playing = !!r && !busy;
    const p = { hi: r ? chance(r.card, 'hi') : 0, lo: r ? chance(r.card, 'lo') : 0 };
    els.hi.disabled = !playing || p.hi >= 1;
    els.lo.disabled = !playing || p.lo >= 1;
    els.hi.innerHTML = `⬆ Höher oder gleich${r && p.hi < 1 ? `<small>×${fmt(multiplier(r.prob * p.hi))}</small>` : ''}`;
    els.lo.innerHTML = `⬇ Tiefer oder gleich${r && p.lo < 1 ? `<small>×${fmt(multiplier(r.prob * p.lo))}</small>` : ''}`;
    els.skip.hidden = !r;
    els.skip.disabled = !playing || r.skips <= 0;
    els.skip.textContent = `⏭ Überspringen (${r ? r.skips : SKIPS})`;
    els.start.hidden = !!r;
    els.start.disabled = busy;
    els.cash.hidden = !r;
    els.cash.disabled = !playing || r.steps < 1;
    els.cash.innerHTML = r && r.steps >= 1 ? `💰 Auszahlen: ${GK.formatMoneyHTML(Math.floor(r.bet * multiplier(r.prob)))}` : '💰 Erst richtig tippen';
    els.info.innerHTML = r
      ? `Richtige Tipps: <b>${r.steps}</b> · Jetzt: <b>×${fmt(multiplier(r.prob))}</b>`
      : shown ? `Letzte Runde: ${shown.steps} richtige ${shown.steps === 1 ? 'Tipp' : 'Tipps'}` : 'Ass ist die höchste Karte, 2 die niedrigste.';
    betControl.setDisabled(!!r || busy);
    els.history.innerHTML = s.history.length
      ? s.history.map(m => (m > 0 ? `<span class="crash-chip high">×${fmt(m)}</span>` : '<span class="crash-chip low">❌</span>')).join('')
      : '<span class="muted small">Noch keine Runden.</span>';
  }

  function showMessage(html, cls) {
    if (!els.message) return;
    els.message.className = 'game-message ' + (cls || '');
    els.message.innerHTML = html;
  }

  function init(body) {
    body.innerHTML = `
      <div class="crash-layout">
        <div class="crash-scene">
          <div class="hilo-table">
            <div class="hilo-trail"></div>
            <div class="hilo-card"></div>
            <div class="hilo-info"></div>
          </div>
          <div class="crash-history hilo-history"></div>
        </div>
        <div class="crash-controls">
          <div class="game-message">&nbsp;</div>
          <div class="hilo-choices">
            <button class="btn btn-primary hilo-hi"></button>
            <button class="btn btn-primary hilo-lo"></button>
          </div>
          <div class="hilo-bet"></div>
          <div class="game-actions">
            <button class="btn btn-primary btn-big hilo-start">🃏 Erste Karte ziehen</button>
            <button class="btn btn-primary btn-big hilo-cash" hidden></button>
            <button class="btn hilo-skip"></button>
          </div>
          <p class="muted small">Tippe, ob die nächste Karte höher oder tiefer ist – gleich zählt immer als richtig.
            Je unwahrscheinlicher dein Tipp, desto stärker steigt der Gewinn. Auszahlen kannst du nach jedem
            richtigen Tipp, ein falscher kostet den Einsatz. Dreimal pro Runde darfst du eine Karte überspringen.</p>
        </div>
      </div>`;
    els = {
      table: body.querySelector('.hilo-table'),
      trail: body.querySelector('.hilo-trail'),
      card: body.querySelector('.hilo-card'),
      info: body.querySelector('.hilo-info'),
      history: body.querySelector('.hilo-history'),
      message: body.querySelector('.game-message'),
      hi: body.querySelector('.hilo-hi'),
      lo: body.querySelector('.hilo-lo'),
      start: body.querySelector('.hilo-start'),
      cash: body.querySelector('.hilo-cash'),
      skip: body.querySelector('.hilo-skip'),
    };
    betControl = GK.casino.createBetControl(body.querySelector('.hilo-bet'), {
      min: MIN_BET,
      get: () => state().bet,
      set: v => { state().bet = v; },
    });
    els.start.addEventListener('click', start);
    els.cash.addEventListener('click', cashOut);
    els.skip.addEventListener('click', skip);
    els.hi.addEventListener('click', () => guess('hi'));
    els.lo.addEventListener('click', () => guess('lo'));
    refresh();
  }

  function refresh() {
    busy = false;
    showMessage(state().round ? 'Deine Runde läuft noch – höher oder tiefer?' : 'Wähle deinen Einsatz und zieh die erste Karte.', '');
    render(false);
  }

  GK.casino.register({
    id: 'hilo',
    category: 'table',
    name: 'Höher oder tiefer',
    emoji: '🔼',
    desc: 'Höher oder tiefer? Jeder richtige Tipp lässt den Gewinn wachsen.',
    init,
    refresh,
    render: () => {
      if (!state().round) betControl.refresh();
    },
  });

  // Für Tests
  GK.casino.hiloMath = { RTP, chance, multiplier, wins, randomCard };
})();
