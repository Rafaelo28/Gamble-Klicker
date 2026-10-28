// Gemeinsame Slot-Technik für die große Slot-Maschine im Casino und den Side-Slot im Klicker:
// Symbole, Gewinntabelle und drehende Walzen.
window.GK = window.GK || {};

(function () {
  // Gewicht = wie oft das Symbol auf der Walze vorkommt (gleich für alle 3 Walzen).
  // three/two = Auszahlung als Vielfaches des Einsatzes. Auszahlungsquote: 96,2 %.
  const SYMBOLS = [
    { id: 'cherry',  icon: '🍒', weight: 22, three: 10,  two: 2 },
    { id: 'lemon',   icon: '🍋', weight: 20, three: 15,  two: 0 },
    { id: 'orange',  icon: '🍊', weight: 18, three: 15,  two: 0 },
    { id: 'grape',   icon: '🍇', weight: 15, three: 25,  two: 1 },
    { id: 'bell',    icon: '🔔', weight: 10, three: 50,  two: 2 },
    { id: 'star',    icon: '⭐', weight: 7,  three: 100, two: 3 },
    { id: 'diamond', icon: '💎', weight: 4,  three: 200, two: 5 },
    { id: 'seven',   icon: '<span class="seven">7</span>', weight: 2, three: 777, two: 10 },
  ];
  const byId = Object.fromEntries(SYMBOLS.map(s => [s.id, s]));
  const SPIN_TIMES = [1000, 1350, 1700]; // ms bis zum Halt jeder Walze

  function randomSymbol() {
    return GK.rng.weighted(SYMBOLS).id;
  }

  // Ergebnis einer Drehung: mult = Rückzahlung inklusive Einsatz, win = Walzen, die leuchten
  function evaluate(reels) {
    if (reels[0] === reels[1] && reels[1] === reels[2]) {
      return { mult: byId[reels[0]].three, text: `3× ${byId[reels[0]].icon}`, win: [0, 1, 2], jackpot: reels[0] === 'seven' };
    }
    for (const id of new Set(reels)) {
      if (reels.filter(r => r === id).length === 2 && byId[id].two > 0) {
        return { mult: byId[id].two, text: `2× ${byId[id].icon}`, win: [0, 1, 2].filter(i => reels[i] === id) };
      }
    }
    return { mult: 0, text: 'Kein Gewinn', win: [] };
  }

  // Auszahlungsquote exakt berechnen (für Tests und die Gewinntabelle)
  function rtp() {
    const total = SYMBOLS.reduce((sum, s) => sum + s.weight, 0);
    let sum = 0;
    for (const a of SYMBOLS) for (const b of SYMBOLS) for (const c of SYMBOLS) {
      sum += (a.weight * b.weight * c.weight) / total ** 3 * evaluate([a.id, b.id, c.id]).mult;
    }
    return sum;
  }

  function cell(id) {
    return `<div class="reel-cell">${byId[id].icon}</div>`;
  }

  /**
   * Drei Walzen in `container` anlegen. Jede Walze zeigt 3 Felder, die Gewinnlinie ist die Mitte.
   * options.spinTimes: Laufzeit jeder Walze in ms (Standard: 1000 / 1350 / 1700)
   * Gibt { show(reels), spin(reels, onDone), highlight(indexe) } zurück.
   */
  function createReels(container, options = {}) {
    const spinTimes = options.spinTimes || SPIN_TIMES;
    container.classList.add('reels');
    container.innerHTML = [0, 1, 2].map(() => '<div class="reel"><div class="reel-strip"></div></div>').join('') +
      '<div class="reel-payline"></div>';
    const reels = [...container.querySelectorAll('.reel')];
    const strips = reels.map(r => r.querySelector('.reel-strip'));
    let current = ['seven', 'seven', 'seven'];
    let neighbors = current.map(() => [randomSymbol(), randomSymbol()]);
    let timers = [];
    let ticking = null;

    // Neues Ergebnis ohne Drehen zeigen (z. B. nach dem Neuladen), mit neuen Symbolen ober- und unterhalb
    function show(result) {
      current = result.slice();
      neighbors = current.map(() => [randomSymbol(), randomSymbol()]);
      draw();
    }

    // Stehende Walzen zeichnen: genau die Symbole, die gerade zu sehen sind
    function draw() {
      strips.forEach((strip, i) => {
        strip.style.transition = 'none';
        strip.style.transform = 'translateY(0)';
        strip.innerHTML = cell(neighbors[i][0]) + cell(current[i]) + cell(neighbors[i][1]);
      });
      highlight([]);
    }

    function highlight(indexes) {
      reels.forEach((r, i) => r.classList.toggle('win', indexes.includes(i)));
    }

    // Walzen drehen und nacheinander auf `result` (Mitte) stoppen
    function spin(result, onDone) {
      timers.forEach(clearTimeout);
      timers = [];
      clearInterval(ticking);
      highlight([]);
      const fast = GK.state.settings.effects === 'reduced';
      const cellHeight = reels[0].clientHeight / 3 || 40;
      ticking = setInterval(() => GK.sound.play('tick'), 75);
      GK.sound.play('spinStart');

      strips.forEach((strip, i) => {
        const filler = 14 + i * 6;
        const finalNeighbors = [randomSymbol(), randomSymbol()];
        let html = cell(neighbors[i][0]) + cell(current[i]) + cell(neighbors[i][1]);
        for (let k = 0; k < filler; k++) html += cell(randomSymbol());
        html += cell(finalNeighbors[0]) + cell(result[i]) + cell(finalNeighbors[1]);
        strip.innerHTML = html;
        strip.style.transition = 'none';
        strip.style.transform = 'translateY(0)';
        strip.classList.add('blur');
        void strip.offsetHeight; // Startposition übernehmen, bevor die Animation beginnt
        const duration = fast ? Math.min(300 + i * 150, spinTimes[i]) : spinTimes[i];
        const distance = (filler + 3) * cellHeight;
        strip.style.transition = `transform ${duration}ms cubic-bezier(0.2, 0.75, 0.3, 1.04)`;
        strip.style.transform = `translateY(-${distance}px)`;
        timers.push(setTimeout(() => strip.classList.remove('blur'), duration * 0.8));
        timers.push(setTimeout(() => {
          GK.sound.play('reelStop');
          GK.fx.pulse(reels[i], 'reel-bump');
          neighbors[i] = finalNeighbors;
          current[i] = result[i];
          if (i === 2) {
            clearInterval(ticking);
            ticking = null;
            // Die Symbole ober- und unterhalb der Linie bleiben so, wie die Walzen angehalten haben
            draw();
            onDone();
          }
        }, duration));
      });
    }

    show(current);
    return { show, spin, highlight };
  }

  // ---------- Hebel zum Drehen (für alle Automaten) ----------

  // Herunterziehen startet die Runde (Antippen zieht ihn auch). Gibt das Element zurück,
  // lever.disabled sperrt ihn. options: { onPull(), small, className, label }
  function createLever(options) {
    // Kein echter <button>: gesperrte Buttons bekommen keine Zeiger-Ereignisse mehr, dann bliebe ein
    // Hebel, der während des Ziehens gesperrt wird, unten hängen
    const lever = document.createElement('div');
    lever.setAttribute('role', 'button');
    lever.className = 'lever' + (options.small ? ' lever-small' : '') + (options.className ? ' ' + options.className : '');
    lever.title = 'Am Hebel ziehen';
    lever.setAttribute('aria-label', options.label || 'Am Hebel ziehen – drehen');
    lever.innerHTML = '<span class="lever-arm"></span><span class="lever-mount"></span><span class="lever-knob"></span>';
    const arm = lever.querySelector('.lever-arm');
    const knob = lever.querySelector('.lever-knob');
    const PIVOT = 0.5;      // Drehpunkt (Anteil der Höhe)
    const ARM = 0.39;       // Länge des Arms (Anteil der Höhe)
    const MAX_ANGLE = 0.92 * Math.PI;
    const PULL_AT = 0.8;    // ab hier rastet der Hebel ein und die Walzen laufen
    let drag = null;        // { y0, travel, moved, fired }
    let frame = 0;
    let notch = 0;
    let skipClick = false;

    // pos: 0 = oben, 1 = ganz unten (leicht negativ beim Zurückfedern)
    function setPos(pos) {
      const a = pos * MAX_ANGLE;
      const toward = Math.sin(a); // zeigt der Arm zu uns, wirkt er näher und größer
      arm.style.transform = `scaleX(${1 + 0.35 * Math.max(0, toward)}) scaleY(${Math.cos(a)})`;
      knob.style.top = ((PIVOT - ARM * Math.cos(a)) * 100) + '%';
      knob.style.transform = `translate(-50%, -50%) scale(${1 + 0.3 * toward})`;
      arm.style.zIndex = Math.cos(a) < 0 ? 3 : 1; // nach unten gezogen liegt der Arm vor der Halterung
      lever.dataset.pos = pos.toFixed(2);
    }

    function stopAnimation() {
      cancelAnimationFrame(frame);
      frame = 0;
    }

    // Von „from“ nach „to“ in ms; ease = Verlauf (0..1 → 0..1)
    function animate(from, to, ms, ease, onDone) {
      stopAnimation();
      const start = performance.now();
      const step = now => {
        const t = Math.min(1, (now - start) / ms);
        setPos(from + (to - from) * ease(t));
        if (t < 1) frame = requestAnimationFrame(step);
        else { frame = 0; if (onDone) onDone(); }
      };
      frame = requestAnimationFrame(step);
    }

    const easeIn = t => t * t;
    const springBack = t => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2); // federt etwas über

    function release(from) {
      animate(from, 0, 480, springBack);
    }

    function fire() {
      GK.sound.play('lever');
      if (navigator.vibrate) navigator.vibrate(15);
      options.onPull();
    }

    // Antippen oder Tastatur: der Hebel wird ganz durchgezogen
    function autoPull() {
      if (lever.disabled || frame) return;
      animate(0, 1, 200, easeIn, () => {
        fire();
        release(1);
      });
    }

    lever.addEventListener('pointerdown', e => {
      if (lever.disabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
      stopAnimation();
      drag = { y0: e.clientY, travel: lever.clientHeight * ARM * 2 * 0.95, moved: false, fired: false, pos: 0 };
      notch = 0;
      try { lever.setPointerCapture(e.pointerId); } catch (err) { /* ältere Browser */ }
    });
    lever.addEventListener('pointermove', e => {
      if (!drag) return;
      const dy = e.clientY - drag.y0;
      if (Math.abs(dy) > 6) drag.moved = true;
      if (!drag.moved) return;
      drag.pos = Math.max(0, Math.min(1, dy / drag.travel));
      setPos(drag.pos);
      // Ratschen-Klicks beim Herunterziehen
      const n = Math.floor(drag.pos * 5);
      if (n > notch) GK.sound.play('tick');
      notch = Math.max(notch, n);
      if (!drag.fired && drag.pos >= PULL_AT && !lever.disabled) {
        drag.fired = true;
        fire();
      }
    });
    const end = () => {
      if (!drag) return;
      if (drag.moved) {
        skipClick = true;
        setTimeout(() => { skipClick = false; }, 400);
        release(drag.pos);
      }
      drag = null;
    };
    lever.addEventListener('pointerup', end);
    lever.addEventListener('pointercancel', end);
    lever.addEventListener('lostpointercapture', end);
    lever.addEventListener('click', () => {
      if (skipClick) { skipClick = false; return; }
      autoPull();
    });
    lever.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        autoPull();
      }
    });
    let disabled = false;
    Object.defineProperty(lever, 'disabled', {
      get: () => disabled,
      set: value => {
        disabled = !!value;
        lever.classList.toggle('disabled', disabled);
        lever.setAttribute('aria-disabled', String(disabled));
        lever.tabIndex = disabled ? -1 : 0;
      },
    });
    lever.disabled = false;
    setPos(0);
    return lever;
  }

  GK.slotMachine = { SYMBOLS, byId, randomSymbol, evaluate, rtp, createReels, createLever };
})();
