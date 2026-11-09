// Stoppuhr: Eine zufällige Zielzeit bis 10 Sekunden wird vorgegeben, die Uhr läuft los – und man muss sie
// möglichst genau bei der Zielzeit stoppen. Gewertet wird die angezeigte Zeit in Hundertstelsekunden.
// Die Runde wird beim Start gespeichert. Wird neu geladen, solange man noch gewinnen konnte, gibt es den
// Einsatz zurück; war die Zielzeit schon klar vorbei, zählt die Runde als verloren (Neuladen kostet also nichts).
window.GK = window.GK || {};

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
      showMessage('Nicht genug Dublonen für diesen Einsatz.', 'loss');
      return;
    }
    const target = MIN_TARGET + GK.rng.int(MAX_TARGET - MIN_TARGET + 1);
    // Wann die Uhr losläuft: Wanduhr (übersteht Neuladen) und genaue Uhr (zum Messen)
    s.round = { bet: s.bet, target, at: Date.now() + READY_MS };
    s.last = null;
    startPerf = performance.now() + READY_MS;
    GK.save();
    GK.sound.play('chip');
    showMessage(`Ziel: <b>${fmt(target)} s</b> – gleich geht’s los …`, '');
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
      ? `Ziel ${fmt(r.target)} s · nicht gestoppt`
      : `Ziel ${fmt(r.target)} s · gestoppt ${fmt(shown)} s (${diff >= 0 ? '+' : '−'}${fmt(Math.abs(diff))})`);
    render();
    const msg = late ? '⏰ Zu spät – die Uhr ist abgelaufen.' : `${t.icon} ${t.text}`;
    if (payout > r.bet) {
      showMessage(`${msg} ${GK.formatMoneyHTML(payout)} (×${GK.formatDecimal(t.mult, 0, 2)})`, 'win');
      GK.fx.celebrate(payout, r.bet, { el: els.face, subtitle: t.max === 0 ? 'Volltreffer!' : 'Super gestoppt!' });
      if (t.max === 0) GK.fx.pulse(els.face, 'sw-exact');
    } else if (payout > 0) {
      showMessage(`${msg} Zurück: ${GK.formatMoneyHTML(payout)}`, '');
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
        showMessage(`Los! Stoppe bei <b>${fmt(r.target)} s</b>`, '');
        GK.sound.play('tick');
      }
      if (ms > r.target * 10 + LATE_MS) {
        finish(centis(ms), true);
        return;
      }
      GK.setText(els.time, ms < 0 ? '0,00' : fmt(centis(ms)));
      GK.setText(els.status, ms < 0 ? `Achtung … ${Math.ceil(-ms / 1000)}` : 'Stopp drücken!');
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
      showMessage('Die Seite wurde neu geladen, als die Zielzeit schon vorbei war – die Runde zählt als verloren.', 'loss');
    } else {
      s.round = null;
      GK.casino.refund(r.bet);
      GK.save();
      showMessage('Die Seite wurde während der Runde neu geladen – du hast deinen Einsatz zurück.', '');
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
      GK.setHTML(els.target, `Ziel: <b>${fmt(r.target)} s</b>`);
      GK.setText(els.diff, '');
    } else if (last) {
      GK.setHTML(els.target, `Ziel: <b>${fmt(last.target)} s</b>`);
      GK.setText(els.time, fmt(Math.max(0, last.shown)));
      GK.setText(els.status, last.late ? 'Nicht gestoppt' : 'Gestoppt');
      GK.setText(els.diff, last.late ? '' : last.diff === 0 ? '±0,00 s' : `${last.diff > 0 ? '+' : '−'}${fmt(Math.abs(last.diff))} s`);
    } else {
      GK.setHTML(els.target, 'Ziel: <b>?,?? s</b>');
      GK.setText(els.time, '0,00');
      GK.setText(els.status, 'Bereit');
      GK.setText(els.diff, '');
    }
    els.face.classList.toggle('exact', !!last && !r && !last.late && last.diff === 0);
    GK.setHTML(els.best, s.best == null ? '' : `Dein bester Stopp: <b>${s.best === 0 ? 'genau getroffen' : `${fmt(s.best)} s daneben`}</b>${s.exact ? ` · ${ic('target')} ${s.exact}× Volltreffer` : ''}`);
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
        <div class="sw-face" role="button" aria-label="Stoppuhr anhalten">
          <div class="sw-crown"></div>
          <div class="sw-target"></div>
          <div class="sw-time">0,00</div>
          <div class="sw-status muted">Bereit</div>
          <div class="sw-diff"></div>
        </div>
        <div class="sw-controls">
          <div class="sw-table">
            ${TABLE.map(t => `<div class="sw-row"><span>${t.icon} ${t.max === 0 ? 'Genau getroffen' : `bis ${t.max} Hundertstel daneben`}</span><b>×${GK.formatDecimal(t.mult, 0, 2)}</b></div>`).join('')}
          </div>
          <div class="sw-best muted small"></div>
          <div class="game-message">&nbsp;</div>
          <div class="sw-bet"></div>
          <div class="game-actions">
            <button class="btn btn-primary btn-big sw-start">▶️ Start</button>
            <button class="btn btn-danger btn-big sw-stop" hidden>${ic('stop')}STOPP</button>
          </div>
          <p class="muted small">Nach dem Start siehst du die Zielzeit (2 bis 10 Sekunden), dann läuft die Uhr los.
            Tippe auf die Uhr oder auf STOPP, wenn sie genau die Zielzeit zeigt – je genauer, desto mehr gibt es.</p>
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
    else if (!s.round && !s.last) showMessage('Setze deinen Einsatz und drücke Start.', '');
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
