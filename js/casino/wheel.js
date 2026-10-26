// Glücksrad: Ein großes Rad mit unterschiedlich großen Feldern (größer = öfter getroffen).
// Das ⭐-Feld startet das Bonusrad mit hohen Gewinnen. Einmal am Tag gibt es einen Gratis-Dreh.
// Das Ergebnis steht beim Start fest und wird sofort gespeichert – Neuladen zahlt trotzdem aus.
window.GK = window.GK || {};

(function () {
  const MIN_BET = 10;
  const SPIN_TIME = 5200;
  const BONUS_SPIN_TIME = 4200;
  const FREE_MINUTES = 10;   // Wert des Gratis-Drehs: so viele Minuten Einkommen (mindestens 1.000)
  const FREE_CONSOLATION = 0.2; // Gratis-Dreh auf ☠️: ein kleiner Trostpreis

  // Felder im Uhrzeigersinn, beginnend oben. weight = Größe des Feldes (Summe 100).
  // mult = Rückzahlung inklusive Einsatz, bonus = startet das Bonusrad.
  const SEGMENTS = [
    { mult: 0, weight: 6.5 }, { mult: 1.5, weight: 7 }, { mult: 0, weight: 6.5 }, { mult: 2, weight: 6 },
    { mult: 0, weight: 6.5 }, { mult: 3, weight: 3 }, { mult: 1, weight: 7 }, { mult: 0, weight: 6.5 },
    { bonus: true, weight: 2 }, { mult: 0, weight: 6.5 }, { mult: 1.5, weight: 7 }, { mult: 0, weight: 6.5 },
    { mult: 2, weight: 6 }, { mult: 1, weight: 7 }, { mult: 0, weight: 6.5 }, { mult: 3, weight: 3 },
    { mult: 0, weight: 6.5 },
  ];
  // Bonusrad: 8 gleich große Felder
  const BONUS = [3, 10, 4, 15, 5, 25, 6, 8];

  const COLORS = { 0: '#262b36', 1: '#2f7fd8', 1.5: '#2fa866', 2: '#8e44ad', 3: '#e67e22' };
  const BONUS_COLORS = ['#c0392b', '#f5c542'];

  let els = {};
  let betControl;
  let ctx;
  let rotation = 0;       // aktuelle Drehung des Rades in Grad
  let spinning = false;
  let showingBonus = false;

  function state() {
    return GK.casino.data('wheel', () => ({ bet: 100, pending: null, lastFree: '', results: [] }));
  }

  // ---------- Mathematik (auch für Tests) ----------

  const totalWeight = () => SEGMENTS.reduce((sum, s) => sum + s.weight, 0);
  const bonusAverage = () => BONUS.reduce((a, b) => a + b, 0) / BONUS.length;

  function rtp() {
    return SEGMENTS.reduce((sum, s) => sum + s.weight * (s.bonus ? bonusAverage() : s.mult), 0) / totalWeight();
  }

  function pickSegment() {
    let roll = GK.rng.float() * totalWeight();
    for (let i = 0; i < SEGMENTS.length; i++) {
      if (roll < SEGMENTS[i].weight) return i;
      roll -= SEGMENTS[i].weight;
    }
    return SEGMENTS.length - 1;
  }

  // Start- und Endwinkel (Grad, im Uhrzeigersinn ab oben) eines Feldes
  function segmentRange(list, index) {
    const total = list.reduce((sum, s) => sum + s.weight, 0);
    let start = 0;
    for (let i = 0; i < index; i++) start += list[i].weight;
    return { start: start / total * 360, end: (start + list[index].weight) / total * 360 };
  }

  function label(seg) {
    if (seg.bonus) return '⭐';
    if (seg.mult === 0) return '☠️';
    return `${String(seg.mult).replace('.', ',')}×`;
  }

  // ---------- Gratis-Dreh ----------

  function today() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }

  function freeAvailable() {
    return state().lastFree !== today();
  }

  function freeValue() {
    return Math.max(1000, Math.round(GK.clicker.getCpsPermanent() * 60 * FREE_MINUTES));
  }

  // ---------- Ablauf ----------

  function spin(free) {
    if (spinning || state().pending) return;
    const s = state();
    let bet = s.bet;
    if (free) {
      if (!freeAvailable()) return;
      bet = freeValue();
      s.lastFree = today();
    } else if (!GK.casino.bet(bet)) {
      GK.sound.play('denied');
      showMessage('Nicht genug Dublonen für diesen Einsatz.', 'loss');
      return;
    }
    const index = pickSegment();
    const seg = SEGMENTS[index];
    const bonusIndex = seg.bonus ? GK.rng.int(BONUS.length) : null;
    const mult = seg.bonus ? BONUS[bonusIndex] : seg.mult;
    const payout = free ? Math.floor(bet * (mult || FREE_CONSOLATION)) : Math.floor(bet * mult);
    // Ergebnis sofort speichern; wo genau im Feld der Zeiger landet, ist nur Optik
    s.pending = { bet, free: !!free, index, bonusIndex, mult, payout, landing: 0.15 + GK.rng.float() * 0.7 };
    GK.save();

    spinning = true;
    showMessage(free ? '🎁 Gratis-Dreh – viel Glück!' : 'Das Rad dreht sich …', '');
    updateButtons();
    drawWheel(SEGMENTS);
    const range = segmentRange(SEGMENTS, index);
    const target = range.start + (range.end - range.start) * s.pending.landing;
    GK.sound.play('spinStart');
    animateTo(target, SPIN_TIME, SEGMENTS, () => {
      if (bonusIndex === null) {
        settle(true);
        return;
      }
      // ⭐ getroffen: weiter zum Bonusrad
      GK.sound.play('bonus');
      showMessage('⭐ BONUSRAD! ⭐', 'win');
      GK.fx.pulse(els.wrap, 'wheel-bonus-flash');
      const pos = GK.fx.center(els.canvas);
      GK.fx.burst(pos.x, pos.y, { count: 30, kind: 'sparkle', speed: 600 });
      setTimeout(() => {
        showingBonus = true;
        rotation = 0;
        setRotation(0);
        drawWheel(bonusSegments());
        els.wrap.classList.add('bonus');
        const b = segmentRange(bonusSegments(), bonusIndex);
        setTimeout(() => {
          GK.sound.play('spinStart');
          animateTo(b.start + (b.end - b.start) * s.pending.landing, BONUS_SPIN_TIME, bonusSegments(), () => settle(true));
        }, 500);
      }, 1300);
    });
  }

  function bonusSegments() {
    return BONUS.map(mult => ({ mult, weight: 1 }));
  }

  // Auszahlen. animated = nach einer Drehung (sonst nach dem Neuladen)
  function settle(animated) {
    const s = state();
    const p = s.pending;
    spinning = false;
    if (!p) {
      updateButtons();
      return;
    }
    s.pending = null;
    GK.casino.payout(p.payout);
    const seg = SEGMENTS[p.index];
    const text = seg.bonus ? `⭐ Bonusrad ${p.mult}×` : p.mult ? `${label(seg)}` : '☠️';
    s.results.unshift(seg.bonus ? `⭐${p.mult}` : label(seg));
    s.results.length = Math.min(s.results.length, 12);
    if (seg.bonus) GK.unlockAchievement('wheelBonus');
    if (p.free) GK.unlockAchievement('wheelFree');
    GK.casino.record('wheel', p.free ? 0 : p.bet, p.payout, (p.free ? 'Gratis-Dreh · ' : '') + text);

    if (p.free) {
      showMessage(p.mult ? `🎁 Gratis-Dreh: ${text} – du bekommst ${GK.formatMoneyHTML(p.payout)}!`
        : `🎁 Trostpreis: ${GK.formatMoneyHTML(p.payout)}. Morgen gibt es den nächsten Gratis-Dreh!`, 'win');
    } else if (p.payout > p.bet) {
      showMessage(`${text} – Gewinn: ${GK.formatMoneyHTML(p.payout)}`, 'win');
    } else if (p.payout === p.bet) {
      showMessage(`${text} – Einsatz zurück`, '');
    } else {
      showMessage('☠️ Leider nichts – dreh noch einmal!', 'loss');
    }
    if (animated) {
      if (p.free) GK.fx.celebrate(p.payout, 0, { el: els.canvas, level: p.mult >= 3 ? 'big' : undefined, subtitle: text });
      else if (p.payout > 0) GK.fx.celebrate(p.payout, p.bet, { el: els.canvas, level: seg.bonus && p.mult >= 15 ? 'mega' : undefined, subtitle: text });
      else GK.sound.play('lose');
      // Nach dem Bonus wieder das normale Rad zeigen
      if (showingBonus) {
        setTimeout(() => {
          if (spinning) return;
          showingBonus = false;
          els.wrap.classList.remove('bonus');
          drawWheel(SEGMENTS);
          const r = segmentRange(SEGMENTS, p.index);
          rotation = 360 - (r.start + r.end) / 2;
          setRotation(rotation);
        }, 2600);
      }
    }
    drawResults();
    updateButtons();
  }

  // ---------- Darstellung ----------

  function setRotation(deg) {
    els.canvas.style.transform = `rotate(${deg}deg)`;
  }

  // Welches Feld steht gerade unter dem Zeiger?
  function segmentAtPointer(list, rot) {
    const a = ((360 - (rot % 360)) % 360 + 360) % 360;
    for (let i = 0; i < list.length; i++) {
      const r = segmentRange(list, i);
      if (a >= r.start && a < r.end) return i;
    }
    return list.length - 1;
  }

  // Rad so drehen, dass `target` (Winkel auf dem Rad) am Ende oben unter dem Zeiger steht
  function animateTo(target, duration, list, onDone) {
    const fast = GK.state.settings.effects === 'reduced';
    if (fast) duration = Math.min(duration, 1200);
    const from = rotation;
    const delta = ((360 - target) - (from % 360) + 720) % 360;
    const to = from + (fast ? 360 : 360 * 5) + delta;
    const startTime = performance.now();
    let lastSeg = segmentAtPointer(list, from);
    function frame(now) {
      const t = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 4);
      rotation = from + (to - from) * eased;
      setRotation(rotation);
      const seg = segmentAtPointer(list, rotation);
      if (seg !== lastSeg) {
        lastSeg = seg;
        GK.sound.play('tick');
        GK.fx.pulse(els.pointer, 'wheel-pointer-flick');
      }
      if (t < 1) requestAnimationFrame(frame);
      else onDone();
    }
    requestAnimationFrame(frame);
  }

  function drawWheel(list) {
    const size = els.canvas.width;
    const r = size / 2;
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.translate(r, r);
    list.forEach((seg, i) => {
      const range = segmentRange(list, i);
      const a0 = (range.start - 90) * Math.PI / 180;
      const a1 = (range.end - 90) * Math.PI / 180;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r * 0.96, a0, a1);
      ctx.closePath();
      if (showingBonusList(list)) ctx.fillStyle = BONUS_COLORS[i % 2];
      else if (seg.bonus) {
        const g = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
        g.addColorStop(0, '#fff3b0');
        g.addColorStop(1, '#d4a017');
        ctx.fillStyle = g;
      } else ctx.fillStyle = COLORS[seg.mult];
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 229, 138, 0.55)';
      ctx.lineWidth = size / 220;
      ctx.stroke();
      // Beschriftung: vom Mittelpunkt nach außen lesbar
      const mid = (a0 + a1) / 2;
      ctx.save();
      ctx.rotate(mid);
      ctx.translate(r * 0.68, 0);
      ctx.rotate(Math.PI / 2);
      const span = range.end - range.start;
      ctx.font = `900 ${Math.round(size * (span < 9 ? 0.05 : 0.065))}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = showingBonusList(list) && i % 2 ? '#3a2a00' : '#fff';
      ctx.fillText(showingBonusList(list) ? `${seg.mult}×` : label(seg), 0, 0);
      ctx.restore();
    });
    // Goldener Rand mit Lämpchen
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.96, 0, Math.PI * 2);
    ctx.lineWidth = size / 40;
    ctx.strokeStyle = '#b8860b';
    ctx.stroke();
    for (let i = 0; i < 24; i++) {
      const a = i / 24 * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r * 0.96, Math.sin(a) * r * 0.96, size / 110, 0, Math.PI * 2);
      ctx.fillStyle = i % 2 ? '#fff3b0' : '#ffd95e';
      ctx.fill();
    }
    ctx.restore();
  }

  function showingBonusList(list) {
    return list.length === BONUS.length && list.every((s, i) => s.mult === BONUS[i] && !s.bonus);
  }

  function drawResults() {
    const results = state().results;
    els.results.innerHTML = results.length
      ? results.map(r => `<span class="wheel-result">${r}</span>`).join('')
      : '<span class="muted small">Noch nicht gedreht.</span>';
  }

  function showMessage(html, cls) {
    els.message.className = 'game-message ' + (cls || '');
    els.message.innerHTML = html;
  }

  function updateButtons() {
    const busy = spinning || !!state().pending;
    els.spin.disabled = busy;
    betControl.setDisabled(busy);
    const free = freeAvailable();
    els.free.disabled = busy || !free;
    const html = free ? `🎁 Gratis-Dreh (Wert ${GK.formatMoneyHTML(freeValue())})` : '🎁 Gratis-Dreh: morgen wieder';
    if (els.free._html !== html) {
      els.free._html = html;
      els.free.innerHTML = html;
    }
    els.free.classList.toggle('ready', free && !busy);
  }

  function init(body) {
    body.innerHTML = `
      <div class="wheel-layout">
        <div class="wheel-area">
          <div class="fortune-wrap">
            <div class="fortune-pointer"></div>
            <canvas class="fortune-wheel" width="680" height="680"></canvas>
            <div class="fortune-hub">🍀</div>
          </div>
          <div class="wheel-results"></div>
        </div>
        <div class="wheel-controls">
          <div class="game-message">&nbsp;</div>
          <div class="wheel-bet"></div>
          <div class="game-actions">
            <button class="btn btn-primary btn-big wheel-spin">🍀 Drehen</button>
          </div>
          <div class="game-actions">
            <button class="btn wheel-free"></button>
          </div>
          <div class="paytable wheel-paytable">
            <h3>Felder</h3>
            <p><span class="wheel-chip" style="background:${COLORS[1]}">1×</span> Einsatz zurück
              <span class="wheel-chip" style="background:${COLORS[1.5]}">1,5×</span>
              <span class="wheel-chip" style="background:${COLORS[2]}">2×</span>
              <span class="wheel-chip" style="background:${COLORS[3]}">3×</span></p>
            <p><span class="wheel-chip gold">⭐</span> Bonusrad: ${BONUS.slice().sort((a, b) => a - b).map(m => m + '×').join(' · ')}</p>
            <p class="muted small">☠️ = leider nichts. Größere Felder werden öfter getroffen.
              Einmal am Tag gibt es einen Gratis-Dreh – ohne Einsatz.</p>
          </div>
        </div>
      </div>`;
    els = {
      wrap: body.querySelector('.fortune-wrap'),
      canvas: body.querySelector('.fortune-wheel'),
      pointer: body.querySelector('.fortune-pointer'),
      results: body.querySelector('.wheel-results'),
      message: body.querySelector('.game-message'),
      spin: body.querySelector('.wheel-spin'),
      free: body.querySelector('.wheel-free'),
    };
    ctx = els.canvas.getContext('2d');
    betControl = GK.casino.createBetControl(body.querySelector('.wheel-bet'), {
      min: MIN_BET,
      get: () => state().bet,
      set: v => { state().bet = v; },
    });
    els.spin.addEventListener('click', () => spin(false));
    els.free.addEventListener('click', () => spin(true));
    refresh();
  }

  function refresh() {
    spinning = false;
    showingBonus = false;
    els.wrap.classList.remove('bonus');
    drawWheel(SEGMENTS);
    const p = state().pending;
    // Unterbrochene Drehung (Neuladen): Rad gleich auf das Ergebnis stellen und auszahlen
    const index = p ? p.index : 0;
    const r = segmentRange(SEGMENTS, index);
    rotation = 360 - (r.start + r.end) / 2;
    setRotation(rotation);
    if (p) settle(false);
    else showMessage('Setz deinen Einsatz und dreh das Rad!', '');
    drawResults();
    updateButtons();
  }

  GK.casino.register({
    id: 'wheel',
    category: 'quick',
    name: 'Glücksrad',
    emoji: '🍀',
    desc: 'Dreh das Rad – das ⭐ startet das Bonusrad. Täglich ein Gratis-Dreh!',
    init,
    refresh,
    render: () => {
      betControl.refresh();
      if (!spinning) updateButtons();
    },
  });

  // Für Tests
  GK.casino.wheelMath = { SEGMENTS, BONUS, rtp };
})();
