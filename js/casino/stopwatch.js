// Stoppuhr: Eine zufällige Zielzeit bis 10 Sekunden wird vorgegeben, die Uhr läuft los – und man muss sie
// möglichst genau bei der Zielzeit stoppen. Gewertet wird die angezeigte Zeit in Hundertstelsekunden.
// Die Runde wird beim Start gespeichert. Wird neu geladen, solange man noch gewinnen konnte, gibt es den
// Einsatz zurück; war die Zielzeit schon klar vorbei, zählt die Runde als verloren (Neuladen kostet also nichts).
window.GK = window.GK || {};

// Sprache: Ersatz, falls js/i18n.js (noch) nicht geladen ist – gibt den deutschen Text zurück.
GK.t = GK.t || function (s, v) { s = String(s); return v ? s.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m)) : s; };
GK.i18n = GK.i18n || { add() {}, addHtml() {}, apply() {}, set() {}, lang: 'de' };

GK.i18n.add({
  'Stoppuhr': 'Stopwatch',
  'Stoppe die Uhr genau bei der Zielzeit – auf die Hundertstel!': 'Stop the clock exactly at the target time – to the hundredth!',
  'Nicht genug Dublonen für diesen Einsatz.': 'Not enough Doubloons for this bet.',
  'Volltreffer – auf die Hundertstel genau!': 'Bullseye – spot on to the hundredth!',
  'Nur eine Hundertstel daneben!': 'Just one hundredth off!',
  'Ganz knapp daneben.': 'Just barely off.',
  'Fast getroffen.': 'Almost got it.',
  'Daneben.': 'Missed.',
  'Ziel: <b>{time} s</b> – gleich geht’s los …': 'Target: <b>{time} s</b> – here we go …',
  'Ziel {time} s · nicht gestoppt': 'Target {time} s · not stopped',
  'Ziel {time} s · gestoppt {shown} s ({sign}{off})': 'Target {time} s · stopped {shown} s ({sign}{off})',
  '⏰ Zu spät – die Uhr ist abgelaufen.': '⏰ Too late – the clock ran out.',
  '{msg} {money} (×{mult})': '{msg} {money} (×{mult})',
  '{msg} Zurück: {money}': '{msg} Back: {money}',
  'Volltreffer!': 'Bullseye!',
  'Super gestoppt!': 'Great stop!',
  'Los! Stoppe bei <b>{time} s</b>': 'Go! Stop at <b>{time} s</b>',
  'Achtung … {n}': 'Ready … {n}',
  'Stopp drücken!': 'Press stop!',
  'Die Seite wurde neu geladen, als die Zielzeit schon vorbei war – die Runde zählt als verloren.':
    'The page was reloaded after the target time had already passed – the round counts as lost.',
  'Die Seite wurde während der Runde neu geladen – du hast deinen Einsatz zurück.':
    'The page was reloaded during the round – you get your bet back.',
  'Ziel: <b>{time} s</b>': 'Target: <b>{time} s</b>',
  'Nicht gestoppt': 'Not stopped',
  'Gestoppt': 'Stopped',
  'Ziel: <b>?,?? s</b>': 'Target: <b>?,?? s</b>',
  'Bereit': 'Ready',
  'Dein bester Stopp: <b>{best}</b>': 'Your best stop: <b>{best}</b>',
  'genau getroffen': 'exactly right',
  '{off} s daneben': '{off} s off',
  '{n}× Volltreffer': '{n}× bullseye',
  'Stoppuhr anhalten': 'Stop the stopwatch',
  'Genau getroffen': 'Exactly right',
  'bis {max} Hundertstel daneben': 'up to {max} hundredths off',
  '▶️ Start': '▶️ Start',
  'STOPP': 'STOP',
  'Nach dem Start siehst du die Zielzeit (2 bis 10 Sekunden), dann läuft die Uhr los. Tippe auf die Uhr oder auf STOPP, wenn sie genau die Zielzeit zeigt – je genauer, desto mehr gibt es.':
    'After the start you see the target time (2 to 10 seconds), then the clock starts. Tap the clock or STOP when it shows exactly the target time – the more precise, the more you get.',
  'Setze deinen Einsatz und drücke Start.': 'Place your bet and press start.',
});

(function () {
  // Eigenes Symbol (in Node-Tests ohne icons.js bleibt es leer)
  const ic = (name, cls) => (GK.icon ? GK.icon(name, cls) : '');
  const MIN_BET = 10;
  const MIN_TARGET = 200;   // Zielzeit in Hundertstel: 2,00 …
  const MAX_TARGET = 1000;  // … bis 10,00 Sekunden
  const READY_MS = 1500;    // „Achtung …“: Zielzeit ansehen, dann läuft die Uhr
  const LATE_MS = 2500;     // so lange nach der Zielzeit hält die Uhr von selbst an

  // Abstand zur Zielzeit in Hundertstel → Rückzahlung (inklusive Einsatz)
  const TABLE = [
    { max: 0, mult: 2.2, icon: '🎯', text: 'Volltreffer – auf die Hundertstel genau!' },
    { max: 1, mult: 1.1, icon: '🔥', text: 'Nur eine Hundertstel daneben!' },
    { max: 3, mult: 0.6, icon: '👍', text: 'Ganz knapp daneben.' },
    { max: 6, mult: 0.2, icon: '🙂', text: 'Fast getroffen.' },
  ];
  const MISS = { max: Infinity, mult: 0, icon: '💨', text: 'Daneben.' };
  const ACHIEVEMENT_MAX = 3; // Erfolg „Gutes Timing“: höchstens so viele Hundertstel daneben

  let els = {};
  let betControl;
  let frame = 0;
  let startPerf = 0; // performance.now() beim Loslaufen der Uhr (nur im Speicher)
  let stoppedAt = -1e9; // wann zuletzt gestoppt wurde
  // Nach dem Stoppen erscheint „Start“ genau unter dem Finger: Der Klick, der zum Stopp-Tipp gehört,
  // darf nicht gleich die nächste Runde starten
  const START_LOCK_MS = 700;

  function state() {
    return GK.casino.data('stopwatch', () => ({ bet: 100, round: null, last: null, best: null, exact: 0 }));
  }

  // ---------- Mathematik (auch für Tests) ----------

  const tier = diff => TABLE.find(t => Math.abs(diff) <= t.max) || MISS;

  // Angezeigte Zeit in Hundertstel (wie bei einer echten Stoppuhr abgeschnitten)
  const centis = ms => Math.floor(ms / 10);

  // „6,82“
  const fmt = c => `${Math.floor(c / 100)},${String(Math.abs(c) % 100).padStart(2, '0')}`;

  // Erwartete Rückzahlung, wenn man im Schnitt richtig liegt, aber um sigma Sekunden streut (für Tests)
  function expected(sigma, samples = 200000, rand = Math.random) {
    let sum = 0;
    for (let i = 0; i < samples; i++) {
      // Normalverteilung (Box-Muller), echte Zeit um die Mitte der Ziel-Hundertstel
      const z = Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
      const target = 500;
      const ms = target * 10 + 5 + z * sigma * 1000;
      sum += tier(centis(ms) - target).mult;
    }
    return sum / samples;
  }

  // ---------- Ablauf ----------

  function start() {
    const s = state();
    if (s.round || performance.now() - stoppedAt < START_LOCK_MS) return;
    if (!GK.casino.bet(s.bet)) {
      GK.sound.play('denied');
      showMessage(GK.t('Nicht genug Dublonen für diesen Einsatz.'), 'loss');
      return;
    }
    const target = MIN_TARGET + GK.rng.int(MAX_TARGET - MIN_TARGET + 1);
    // Wann die Uhr losläuft: Wanduhr (übersteht Neuladen) und genaue Uhr (zum Messen)
    s.round = { bet: s.bet, target, at: Date.now() + READY_MS };
    s.last = null;
    startPerf = performance.now() + READY_MS;
    GK.save();
    GK.sound.play('chip');
    showMessage(GK.t('Ziel: <b>{time} s</b> – gleich geht’s los …', { time: fmt(target) }), '');
    render();
    loop();
  }

  // Stoppen (Tipp auf die Uhr oder den Knopf). t = Zeitpunkt des Tipps (performance.now()-Zeitbasis)
  function stop(t) {
    const s = state();
    const r = s.round;
    if (!r || !startPerf) return;
    const ms = t - startPerf;
    if (ms < 0) return; // vor dem Loslaufen zählt nicht
    finish(centis(ms));
  }

  function finish(shown, late) {
    const s = state();
    const r = s.round;
    const diff = shown - r.target;
    const t = late ? MISS : tier(diff);
    const payout = Math.floor(r.bet * t.mult);
    s.round = null;
    startPerf = 0;
    stoppedAt = performance.now();
    cancelAnimationFrame(frame);
    s.last = { target: r.target, shown, diff, bet: r.bet, payout, late: !!late };
    if (!late && (s.best == null || Math.abs(diff) < s.best)) s.best = Math.abs(diff);
    if (t.max === 0) s.exact++;
    if (!late && Math.abs(diff) <= ACHIEVEMENT_MAX) GK.unlockAchievement('stopwatchExact');
    GK.casino.payout(payout);
    GK.casino.record('stopwatch', r.bet, payout, late
      ? GK.t('Ziel {time} s · nicht gestoppt', { time: fmt(r.target) })
      : GK.t('Ziel {time} s · gestoppt {shown} s ({sign}{off})', { time: fmt(r.target), shown: fmt(shown), sign: diff >= 0 ? '+' : '−', off: fmt(Math.abs(diff)) }));
    render();
    const msg = late ? GK.t('⏰ Zu spät – die Uhr ist abgelaufen.') : `${t.icon} ${GK.t(t.text)}`;
    if (payout > r.bet) {
      showMessage(GK.t('{msg} {money} (×{mult})', { msg, money: GK.formatMoneyHTML(payout), mult: GK.formatDecimal(t.mult, 0, 2) }), 'win');
      GK.fx.celebrate(payout, r.bet, { el: els.face, subtitle: t.max === 0 ? GK.t('Volltreffer!') : GK.t('Super gestoppt!') });
      if (t.max === 0) GK.fx.pulse(els.face, 'sw-exact');
    } else if (payout > 0) {
      showMessage(GK.t('{msg} Zurück: {money}', { msg, money: GK.formatMoneyHTML(payout) }), '');
      GK.sound.play('coin');
    } else {
      showMessage(msg, 'loss');
      GK.sound.play('lose');
    }
  }

  // Anzeige der laufenden Uhr (jedes Bild, nur während einer Runde)
  function loop() {
    cancelAnimationFrame(frame);
    let going = false;
    const tick = () => {
      const r = state().round;
      if (!r || !startPerf) return;
      const ms = performance.now() - startPerf;
      if (ms >= 0 && !going) {
        going = true;
        showMessage(GK.t('Los! Stoppe bei <b>{time} s</b>', { time: fmt(r.target) }), '');
        GK.sound.play('tick');
      }
      if (ms > r.target * 10 + LATE_MS) {
        finish(centis(ms), true);
        return;
      }
      GK.setText(els.time, ms < 0 ? '0,00' : fmt(centis(ms)));
      GK.setText(els.status, ms < 0 ? GK.t('Achtung … {n}', { n: Math.ceil(-ms / 1000) }) : GK.t('Stopp drücken!'));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  }

  // Nach dem Neuladen: Runde fair abschließen
  function resume() {
    const s = state();
    const r = s.round;
    if (!r || startPerf) return;
    const ms = Date.now() - r.at;
    if (ms > r.target * 10 + TABLE[TABLE.length - 1].max * 10 + 10) {
      // Die Zielzeit war schon vorbei – die Runde war nicht mehr zu gewinnen
      finish(centis(ms), true);
      showMessage(GK.t('Die Seite wurde neu geladen, als die Zielzeit schon vorbei war – die Runde zählt als verloren.'), 'loss');
    } else {
      s.round = null;
      GK.casino.refund(r.bet);
      GK.save();
      showMessage(GK.t('Die Seite wurde während der Runde neu geladen – du hast deinen Einsatz zurück.'), '');
      render();
    }
  }

  // ---------- Darstellung ----------

  function render() {
    const s = state();
    const r = s.round;
    const last = s.last;
    els.start.hidden = !!r;
    els.stop.hidden = !r;
    betControl.setDisabled(!!r);
    els.face.classList.toggle('running', !!r);
    if (r) {
      GK.setHTML(els.target, GK.t('Ziel: <b>{time} s</b>', { time: fmt(r.target) }));
      GK.setText(els.diff, '');
    } else if (last) {
      GK.setHTML(els.target, GK.t('Ziel: <b>{time} s</b>', { time: fmt(last.target) }));
      GK.setText(els.time, fmt(Math.max(0, last.shown)));
      GK.setText(els.status, last.late ? GK.t('Nicht gestoppt') : GK.t('Gestoppt'));
      GK.setText(els.diff, last.late ? '' : last.diff === 0 ? '±0,00 s' : `${last.diff > 0 ? '+' : '−'}${fmt(Math.abs(last.diff))} s`);
    } else {
      GK.setHTML(els.target, GK.t('Ziel: <b>?,?? s</b>'));
      GK.setText(els.time, '0,00');
      GK.setText(els.status, GK.t('Bereit'));
      GK.setText(els.diff, '');
    }
    els.face.classList.toggle('exact', !!last && !r && !last.late && last.diff === 0);
    GK.setHTML(els.best, s.best == null ? '' : GK.t('Dein bester Stopp: <b>{best}</b>', { best: s.best === 0 ? GK.t('genau getroffen') : GK.t('{off} s daneben', { off: fmt(s.best) }) }) + (s.exact ? ` · ${ic('target')} ${GK.t('{n}× Volltreffer', { n: s.exact })}` : ''));
  }

  function showMessage(html, cls) {
    els.message.className = 'game-message ' + (cls || '');
    els.message.innerHTML = html;
  }

  // Tipp so früh wie möglich messen: Zeitpunkt des Ereignisses, falls der Browser ihn genau liefert
  function eventTime(e) {
    const now = performance.now();
    return e && e.timeStamp > 0 && now - e.timeStamp >= 0 && now - e.timeStamp < 200 ? e.timeStamp : now;
  }

  function onKey(e) {
    if ((e.key === ' ' || e.key === 'Enter') && state().round && !e.repeat) {
      e.preventDefault();
      stop(eventTime(e));
    }
  }

  function init(body) {
    body.innerHTML = `
      <div class="sw-layout">
        <div class="sw-face" role="button" aria-label="${GK.t('Stoppuhr anhalten')}">
          <div class="sw-crown"></div>
          <div class="sw-target"></div>
          <div class="sw-time">0,00</div>
          <div class="sw-status muted">${GK.t('Bereit')}</div>
          <div class="sw-diff"></div>
        </div>
        <div class="sw-controls">
          <div class="sw-table">
            ${TABLE.map(t => `<div class="sw-row"><span>${t.icon} ${t.max === 0 ? GK.t('Genau getroffen') : GK.t('bis {max} Hundertstel daneben', { max: t.max })}</span><b>×${GK.formatDecimal(t.mult, 0, 2)}</b></div>`).join('')}
          </div>
          <div class="sw-best muted small"></div>
          <div class="game-message">&nbsp;</div>
          <div class="sw-bet"></div>
          <div class="game-actions">
            <button class="btn btn-primary btn-big sw-start">${GK.t('▶️ Start')}</button>
            <button class="btn btn-danger btn-big sw-stop" hidden>${ic('stop')}${GK.t('STOPP')}</button>
          </div>
          <p class="muted small">${GK.t('Nach dem Start siehst du die Zielzeit (2 bis 10 Sekunden), dann läuft die Uhr los. Tippe auf die Uhr oder auf STOPP, wenn sie genau die Zielzeit zeigt – je genauer, desto mehr gibt es.')}</p>
        </div>
      </div>`;
    els = {
      face: body.querySelector('.sw-face'),
      target: body.querySelector('.sw-target'),
      time: body.querySelector('.sw-time'),
      status: body.querySelector('.sw-status'),
      diff: body.querySelector('.sw-diff'),
      best: body.querySelector('.sw-best'),
      message: body.querySelector('.game-message'),
      start: body.querySelector('.sw-start'),
      stop: body.querySelector('.sw-stop'),
    };
    betControl = GK.casino.createBetControl(body.querySelector('.sw-bet'), {
      min: MIN_BET,
      get: () => state().bet,
      set: v => { state().bet = v; },
    });
    els.start.addEventListener('click', start);
    // pointerdown statt click: zählt sofort beim Berühren
    [els.face, els.stop].forEach(el => el.addEventListener('pointerdown', e => {
      if (!state().round) return;
      e.preventDefault();
      stop(eventTime(e));
    }));
    resume();
    refresh();
  }

  function refresh() {
    const s = state();
    if (s.round && startPerf) loop();
    else if (!s.round && !s.last) showMessage(GK.t('Setze deinen Einsatz und drücke Start.'), '');
    render();
  }

  GK.casino.register({
    id: 'stopwatch',
    category: 'quick',
    name: 'Stoppuhr',
    emoji: '⏱️',
    desc: 'Stoppe die Uhr genau bei der Zielzeit – auf die Hundertstel!',
    init,
    refresh,
    render: () => {
      if (!state().round) betControl.refresh();
    },
    onShow: () => document.addEventListener('keydown', onKey),
    onHide: () => document.removeEventListener('keydown', onKey),
  });

  // Für Tests
  GK.casino.stopwatchMath = { TABLE, MIN_TARGET, MAX_TARGET, ACHIEVEMENT_MAX, tier, centis, fmt, expected };
})();
