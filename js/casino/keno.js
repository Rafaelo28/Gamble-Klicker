// Schatzkarten-Keno: Auf der Karte liegen 40 Inseln. Markiere 1 bis 10 davon, dann werden 10 Schatzinseln
// gezogen. Je mehr deiner Inseln dabei sind, desto mehr gibt es – wie viel, zeigt die Gewinntabelle für die
// Anzahl deiner Markierungen. Die Ziehung steht beim Start fest und wird gespeichert (Neuladen zahlt aus).
window.GK = window.GK || {};

// Sprache: Ersatz, falls js/i18n.js (noch) nicht geladen ist – gibt den deutschen Text zurück.
GK.t = GK.t || function (s, v) { s = String(s); return v ? s.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m)) : s; };
GK.i18n = GK.i18n || { add() {}, addHtml() {}, apply() {}, set() {}, lang: 'de' };

GK.i18n.add({
  'Höchstens {max} Inseln – nimm erst eine andere weg.': 'At most {max} islands – remove one first.',
  'Markiere zuerst mindestens eine Insel.': 'Mark at least one island first.',
  'Nicht genug Dublonen für diesen Einsatz.': 'Not enough Doubloons for this bet.',
  '🗺️ Die Schätze werden gezogen …': '🗺️ Drawing the treasures …',
  '🏴‍☠️ {hits} Treffer! Gewinn: {amt}': '🏴‍☠️ {hits} hits! Win: {amt}',
  '{hits} von {total} Inseln': '{hits} of {total} islands',
  '{hits} Treffer – diesmal kein Schatz.': '{hits} hits – no treasure this time.',
  'Gewinne bei {count} {word}': 'Wins for {count} {word}',
  'Insel': 'island',
  'Inseln': 'islands',
  '{h} Treffer': '{h} hits',
  'Markiere 1 bis 10 Inseln auf der Karte.': 'Mark 1 to 10 islands on the map.',
  '<b>{count}</b> von {max} Inseln markiert': '<b>{count}</b> of {max} islands marked',
  ' · gezogen: {shown}/{draws}': ' · drawn: {shown}/{draws}',
  'Noch keine Ziehungen.': 'No draws yet.',
  'Zufällig': 'Random',
  'Löschen': 'Clear',
  'Schätze ziehen': 'Draw treasures',
  'Insel {n}': 'Island {n}',
  'Markiere 1 bis 10 Inseln auf der Schatzkarte. Dann werden 10 Schatzinseln gezogen – je mehr deiner Inseln dabei sind, desto mehr gewinnst du. Die Gewinne für deine Anzahl stehen in der Tabelle.': 'Mark 1 to 10 islands on the treasure map. Then 10 treasure islands are drawn – the more of yours are among them, the more you win. The wins for your number are shown in the table.',
  'Markiere deine Inseln und zieh die Schätze!': 'Mark your islands and draw the treasures!',
  // Spiel-Name und -Beschreibung (für die Lobby)
  'Schatzkarten-Keno': 'Treasure Map Keno',
  'Markiere Inseln auf der Schatzkarte – wo liegen die 10 Schätze?': 'Mark islands on the treasure map – where are the 10 treasures?',
});

(function () {
  // Eigenes Symbol (in Node-Tests ohne icons.js bleibt es leer)
  const ic = (name, cls) => (GK.icon ? GK.icon(name, cls) : '');
  const MIN_BET = 10;
  const ISLANDS = 40;
  const DRAWS = 10;
  const MAX_PICKS = 10;
  // Gewinntabellen: markierte Inseln → { Treffer: Vielfaches des Einsatzes }
  const PAYTABLE = {
    1: { 1: 3.8 },
    2: { 1: 1, 2: 10 },
    3: { 2: 3, 3: 45 },
    4: { 2: 2, 3: 7, 4: 105 },
    5: { 2: 1, 3: 4, 4: 22, 5: 380 },
    6: { 3: 3, 4: 12, 5: 100, 6: 1500 },
    7: { 3: 1.5, 4: 7, 5: 36, 6: 360, 7: 4200 },
    8: { 3: 1.5, 4: 3.5, 5: 16, 6: 85, 7: 850, 8: 8500 },
    9: { 4: 4, 5: 11, 6: 55, 7: 320, 8: 3200, 9: 20000 },
    10: { 0: 4, 4: 2, 5: 6, 6: 25, 7: 125, 8: 800, 9: 6000, 10: 40000 },
  };
  const STEP = 230;

  let els = {};
  let betControl;
  let drawing = null; // laufende Ziehung (Animation)

  function state() {
    return GK.casino.data('keno', () => ({ bet: 100, picks: [], pending: null, last: null, history: [] }));
  }

  // ---------- Mathematik (auch für Tests) ----------

  function binom(n, k) {
    if (k < 0 || k > n) return 0;
    let r = 1;
    for (let i = 1; i <= k; i++) r = r * (n - k + i) / i;
    return r;
  }

  // Wahrscheinlichkeit für `hits` Treffer bei `picks` markierten Inseln
  function hitChance(picks, hits) {
    return binom(picks, hits) * binom(ISLANDS - picks, DRAWS - hits) / binom(ISLANDS, DRAWS);
  }

  function rtp(picks) {
    const table = PAYTABLE[picks];
    return Object.keys(table).reduce((sum, h) => sum + hitChance(picks, Number(h)) * table[h], 0);
  }

  function payoutMult(picks, hits) {
    return (PAYTABLE[picks] && PAYTABLE[picks][hits]) || 0;
  }

  // 10 verschiedene Inseln (1–40) ziehen
  function draw() {
    return GK.rng.shuffle(Array.from({ length: ISLANDS }, (_, i) => i + 1)).slice(0, DRAWS);
  }

  // ---------- Ablauf ----------

  function toggle(n) {
    const s = state();
    if (s.pending || drawing) return;
    const i = s.picks.indexOf(n);
    if (i >= 0) s.picks.splice(i, 1);
    else if (s.picks.length < MAX_PICKS) s.picks.push(n);
    else {
      GK.sound.play('denied');
      showMessage(GK.t('Höchstens {max} Inseln – nimm erst eine andere weg.', { max: MAX_PICKS }), 'loss');
      return;
    }
    s.last = null;
    GK.sound.play('chip');
    GK.save();
    render();
  }

  function quickPick() {
    const s = state();
    if (s.pending || drawing) return;
    const count = s.picks.length || 5;
    s.picks = GK.rng.shuffle(Array.from({ length: ISLANDS }, (_, i) => i + 1)).slice(0, count);
    s.last = null;
    GK.sound.play('flip');
    GK.save();
    render();
  }

  function clearPicks() {
    const s = state();
    if (s.pending || drawing) return;
    s.picks = [];
    s.last = null;
    GK.save();
    render();
  }

  function start() {
    const s = state();
    if (s.pending || drawing) return;
    if (!s.picks.length) {
      GK.sound.play('denied');
      showMessage(GK.t('Markiere zuerst mindestens eine Insel.'), 'loss');
      return;
    }
    if (!GK.casino.bet(s.bet, 'keno')) {
      GK.sound.play('denied');
      showMessage(GK.t('Nicht genug Dublonen für diesen Einsatz.'), 'loss');
      return;
    }
    const drawn = draw();
    const picks = s.picks.slice();
    const hits = picks.filter(n => drawn.includes(n)).length;
    const payout = Math.floor(s.bet * payoutMult(picks.length, hits));
    const p = { bet: s.bet, picks, drawn, hits, payout };
    s.pending = p;
    s.last = null;
    GK.save();
    GK.sound.play('spinStart');
    showMessage(GK.t('🗺️ Die Schätze werden gezogen …'), '');
    drawing = { shown: 0 };
    render();
    const fast = GK.state.settings.effects === 'reduced';
    const next = () => {
      if (!drawing || s.pending !== p) return;
      drawing.shown++;
      const n = p.drawn[drawing.shown - 1];
      GK.sound.play(picks.includes(n) ? 'gem' : 'plink', picks.includes(n) ? 1 + drawing.shown * 0.03 : 0.8);
      render();
      if (drawing.shown < DRAWS) setTimeout(next, fast ? 60 : STEP);
      else setTimeout(() => settle(true), fast ? 150 : 500);
    };
    setTimeout(next, fast ? 60 : 300);
  }

  // animated = nach der Ziehung (sonst nach dem Neuladen)
  function settle(animated) {
    const s = state();
    const p = s.pending;
    drawing = null;
    if (!p) return;
    s.pending = null;
    s.last = p;
    GK.casino.payout(p.payout);
    const h = s.history;
    h.unshift(`${p.hits}/${p.picks.length}`);
    h.length = Math.min(h.length, 14);
    GK.casino.record('keno', p.bet, p.payout, `🗺️ ${p.hits} von ${p.picks.length} Inseln getroffen`);
    if (p.hits >= 6) GK.unlockAchievement('keno6');
    if (p.payout > 0) {
      showMessage(GK.t('🏴‍☠️ {hits} Treffer! Gewinn: {amt}', { hits: p.hits, amt: GK.formatMoneyHTML(p.payout) }), p.payout > p.bet ? 'win' : '');
      if (animated && p.payout > p.bet) GK.fx.celebrate(p.payout, p.bet, { el: els.map, subtitle: GK.t('{hits} von {total} Inseln', { hits: p.hits, total: p.picks.length }) });
    } else {
      showMessage(GK.t('{hits} Treffer – diesmal kein Schatz.', { hits: p.hits }), 'loss');
      if (animated) GK.sound.play('lose');
    }
    GK.save();
    render();
  }

  // ---------- Darstellung ----------

  const fmtMult = m => (m >= 1000 ? GK.formatNumber(m) : GK.formatDecimal(m, 0, 1));

  function render() {
    const s = state();
    const view = s.pending || s.last;
    const picks = view ? view.picks : s.picks;
    const drawn = view ? (drawing ? view.drawn.slice(0, drawing.shown) : view.drawn) : [];
    [...els.map.children].forEach((cell, i) => {
      const n = i + 1;
      const picked = picks.includes(n);
      const isDrawn = drawn.includes(n);
      let cls = 'kn-cell';
      if (picked) cls += ' picked';
      if (isDrawn) cls += picked ? ' hit' : ' drawn';
      if (drawing && view.drawn[drawing.shown - 1] === n) cls += ' fresh';
      if (cell.className !== cls) cell.className = cls;
      const mark = isDrawn && picked ? '💎' : isDrawn ? '💰' : picked ? '❌' : '';
      const html = `<span class="kn-num">${n}</span>${mark ? `<span class="kn-mark">${mark}</span>` : ''}`;
      if (cell.innerHTML !== html) cell.innerHTML = html;
      cell.disabled = !!(s.pending || drawing);
    });
    // Gewinntabelle für die aktuelle Anzahl Markierungen
    const count = picks.length;
    const table = PAYTABLE[count];
    const hitsNow = view && !drawing ? view.hits : null;
    els.paytable.innerHTML = table
      ? `<div class="kn-pay-title">${GK.t('Gewinne bei {count} {word}', { count, word: GK.t(count === 1 ? 'Insel' : 'Inseln') })}</div>` +
        Object.keys(table).map(Number).sort((a, b) => b - a).map(h => `<div class="kn-pay-row ${h === hitsNow ? 'hit' : ''}">
          <span>${GK.t('{h} Treffer', { h })}</span><b>×${fmtMult(table[h])}</b></div>`).join('')
      : `<div class="kn-pay-title">${GK.t('Markiere 1 bis 10 Inseln auf der Karte.')}</div>`;
    const busy = !!(s.pending || drawing);
    els.count.innerHTML = GK.t('<b>{count}</b> von {max} Inseln markiert', { count, max: MAX_PICKS }) + (drawing ? GK.t(' · gezogen: {shown}/{draws}', { shown: drawing.shown, draws: DRAWS }) : '');
    els.start.disabled = busy || !count;
    els.quick.disabled = busy;
    els.clear.disabled = busy || !count;
    betControl.setDisabled(busy);
    els.history.innerHTML = s.history.length
      ? s.history.map(t => `<span class="crash-chip ${Number(t.split('/')[0]) > 0 ? 'high' : 'low'}">${t}</span>`).join('')
      : `<span class="muted small">${GK.t('Noch keine Ziehungen.')}</span>`;
  }

  function showMessage(html, cls) {
    if (!els.message) return;
    els.message.className = 'game-message ' + (cls || '');
    els.message.innerHTML = html;
    if (GK.iconifyLead) GK.iconifyLead(els.message); // Emoji vorn → eigenes Symbol
  }

  function init(body) {
    body.innerHTML = `
      <div class="crash-layout">
        <div class="crash-scene">
          <div class="kn-board">
            <div class="kn-map">${Array.from({ length: ISLANDS }, (_, i) => `<button type="button" class="kn-cell" data-n="${i + 1}" aria-label="${GK.t('Insel {n}', { n: i + 1 })}"></button>`).join('')}</div>
          </div>
          <div class="crash-history keno-history"></div>
        </div>
        <div class="crash-controls">
          <div class="keno-count mines-info"></div>
          <div class="keno-picks-actions game-actions">
            <button type="button" class="btn keno-quick">${ic('shuffle')}${GK.t('Zufällig')}</button>
            <button type="button" class="btn keno-clear">${ic('trash')}${GK.t('Löschen')}</button>
          </div>
          <div class="kn-paytable"></div>
          <div class="game-message">&nbsp;</div>
          <div class="keno-bet"></div>
          <div class="game-actions">
            <button class="btn btn-primary btn-big keno-start">${ic('map')}${GK.t('Schätze ziehen')}</button>
          </div>
          <p class="muted small">${GK.t('Markiere 1 bis 10 Inseln auf der Schatzkarte. Dann werden 10 Schatzinseln gezogen – je mehr deiner Inseln dabei sind, desto mehr gewinnst du. Die Gewinne für deine Anzahl stehen in der Tabelle.')}</p>
        </div>
      </div>`;
    els = {
      map: body.querySelector('.kn-map'),
      paytable: body.querySelector('.kn-paytable'),
      count: body.querySelector('.keno-count'),
      history: body.querySelector('.keno-history'),
      message: body.querySelector('.game-message'),
      start: body.querySelector('.keno-start'),
      quick: body.querySelector('.keno-quick'),
      clear: body.querySelector('.keno-clear'),
    };
    betControl = GK.casino.createBetControl(body.querySelector('.keno-bet'), {
      min: MIN_BET,
      get: () => state().bet,
      set: v => { state().bet = v; },
    });
    els.map.addEventListener('click', e => {
      const cell = e.target.closest('.kn-cell');
      if (cell && !cell.disabled) toggle(Number(cell.dataset.n));
    });
    els.start.addEventListener('click', start);
    els.quick.addEventListener('click', quickPick);
    els.clear.addEventListener('click', clearPicks);
    refresh();
  }

  function refresh() {
    drawing = null;
    // Ziehung aus der letzten Sitzung: sofort abrechnen
    if (state().pending) settle(false);
    else showMessage(GK.t('Markiere deine Inseln und zieh die Schätze!'), '');
    render();
  }

  GK.casino.register({
    id: 'keno',
    category: 'quick',
    name: 'Schatzkarten-Keno',
    emoji: '🗺️',
    desc: 'Markiere Inseln auf der Schatzkarte – wo liegen die 10 Schätze?',
    init,
    refresh,
    render: () => {
      if (!state().pending && !drawing) betControl.refresh();
    },
  });

  // Für Tests
  GK.casino.kenoMath = { PAYTABLE, ISLANDS, DRAWS, hitChance, rtp, payoutMult, draw };
})();
