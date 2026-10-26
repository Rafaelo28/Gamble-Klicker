// Soundeffekte – werden live im Browser erzeugt (Web Audio), es gibt keine Sounddateien.
// iPad/iPhone erlauben Ton erst nach der ersten Berührung: unlock() wird dann automatisch aufgerufen.
window.GK = window.GK || {};

(function () {
  let ctx = null;
  let master = null;
  let noiseBuffer = null;
  let unlocked = false;
  const lastPlayed = {};

  // Mindestabstand (ms) zwischen zwei gleichen Sounds, damit es nicht knattert
  const THROTTLE = { click: 30, scratch: 70, tick: 25, chip: 40, card: 60 };

  function settings() {
    return GK.state.settings;
  }

  function ensureContext() {
    if (ctx) return ctx;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    ctx = new AudioCtx();
    master = ctx.createGain();
    master.connect(ctx.destination);
    applyVolume();
    // 1 Sekunde Rauschen für Kratz-, Wisch- und Klackgeräusche
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return ctx;
  }

  // Muss in einem Klick/Tipp aufgerufen werden (Vorgabe von Safari auf dem iPad)
  function unlock() {
    if (!ensureContext()) return;
    if (ctx.state === 'suspended') ctx.resume();
    if (unlocked) return;
    unlocked = true;
    // Ein stiller Ton schaltet Web Audio auf älteren iPads frei
    const silent = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = silent;
    src.connect(ctx.destination);
    src.start(0);
  }

  function applyVolume() {
    if (master) master.gain.value = settings().sound ? settings().volume * 0.6 : 0;
  }

  // ---------- Bausteine ----------

  function tone(freq, start, duration, opts = {}) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = opts.type || 'sine';
    osc.frequency.setValueAtTime(freq, start);
    if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(opts.slideTo, start + duration);
    const peak = opts.gain || 0.2;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + (opts.attack || 0.005));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain).connect(master);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  function noise(start, duration, opts = {}) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = opts.filter || 'bandpass';
    filter.frequency.setValueAtTime(opts.freq || 2000, start);
    if (opts.sweepTo) filter.frequency.exponentialRampToValueAtTime(opts.sweepTo, start + duration);
    filter.Q.value = opts.q || 1;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(opts.gain || 0.2, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    src.connect(filter).connect(gain).connect(master);
    src.start(start, Math.random() * 0.5);
    src.stop(start + duration + 0.05);
  }

  // Helles Münz-Klingen
  function ping(start, pitch = 1, gain = 0.12) {
    tone(1568 * pitch, start, 0.18, { type: 'triangle', gain });
    tone(2637 * pitch, start + 0.02, 0.25, { type: 'sine', gain: gain * 0.7 });
  }

  // Viele Münzen, die durcheinander klimpern
  function jingle(start, duration, count) {
    for (let i = 0; i < count; i++) {
      ping(start + Math.random() * duration, 0.85 + Math.random() * 0.5, 0.05 + Math.random() * 0.06);
    }
  }

  function arpeggio(start, notes, step, opts) {
    notes.forEach((f, i) => tone(f, start + i * step, opts.duration || 0.25, opts));
  }

  // ---------- Die Sounds ----------

  const SOUNDS = {
    click(t) {
      const p = 0.95 + Math.random() * 0.1;
      tone(900 * p, t, 0.06, { type: 'triangle', gain: 0.12, slideTo: 1400 * p });
      tone(2400 * p, t + 0.01, 0.08, { type: 'sine', gain: 0.05 });
    },
    coin(t) {
      ping(t, 1, 0.12);
    },
    buy(t) {
      noise(t, 0.06, { freq: 3500, q: 2, gain: 0.25 });
      tone(1318, t + 0.04, 0.35, { type: 'triangle', gain: 0.12 });
      tone(1760, t + 0.07, 0.45, { type: 'triangle', gain: 0.12 });
      ping(t + 0.1, 1.2, 0.08);
    },
    upgrade(t) {
      arpeggio(t, [1047, 1319, 1568, 2093], 0.06, { type: 'triangle', gain: 0.1, duration: 0.3 });
    },
    denied(t) {
      tone(180, t, 0.12, { type: 'square', gain: 0.06 });
      tone(140, t + 0.1, 0.15, { type: 'square', gain: 0.06 });
    },
    tick(t) {
      noise(t, 0.025, { filter: 'highpass', freq: 3000, gain: 0.12 });
    },
    reelStop(t) {
      tone(160, t, 0.12, { type: 'sine', gain: 0.25, slideTo: 60 });
      noise(t, 0.05, { freq: 800, gain: 0.15 });
    },
    spinStart(t) {
      tone(200, t, 0.3, { type: 'sawtooth', gain: 0.04, slideTo: 600 });
    },
    winSmall(t) {
      arpeggio(t, [784, 988, 1175, 1568], 0.07, { type: 'square', gain: 0.05, duration: 0.2 });
      ping(t + 0.3, 1, 0.08);
    },
    winBig(t) {
      arpeggio(t, [523, 659, 784, 1047], 0.09, { type: 'square', gain: 0.07, duration: 0.3 });
      [523, 659, 784, 1047].forEach(f => tone(f, t + 0.45, 0.9, { type: 'triangle', gain: 0.07 }));
      jingle(t + 0.3, 1.4, 22);
    },
    winMega(t) {
      arpeggio(t, [392, 523, 659, 784, 1047, 1319], 0.08, { type: 'square', gain: 0.07, duration: 0.3 });
      [523, 659, 784, 1047, 1319].forEach(f => tone(f, t + 0.55, 1.4, { type: 'triangle', gain: 0.06 }));
      tone(65, t + 0.55, 0.8, { type: 'sine', gain: 0.3 });
      jingle(t + 0.4, 2.2, 45);
    },
    jackpot(t) {
      for (let r = 0; r < 3; r++) {
        arpeggio(t + r * 0.5, [523, 659, 784, 1047], 0.08, { type: 'square', gain: 0.07, duration: 0.25 });
      }
      [523, 659, 784, 1047, 1568].forEach(f => tone(f, t + 1.5, 1.8, { type: 'triangle', gain: 0.07 }));
      tone(55, t + 1.5, 1.2, { type: 'sine', gain: 0.35 });
      jingle(t + 0.2, 3.2, 80);
    },
    lose(t) {
      tone(330, t, 0.25, { type: 'sawtooth', gain: 0.05, slideTo: 220 });
      tone(220, t + 0.22, 0.4, { type: 'sawtooth', gain: 0.05, slideTo: 130 });
    },
    card(t) {
      noise(t, 0.09, { freq: 1500, sweepTo: 5000, q: 0.8, gain: 0.2 });
    },
    flip(t) {
      noise(t, 0.05, { freq: 2500, q: 1, gain: 0.15 });
      tone(500, t + 0.02, 0.05, { type: 'triangle', gain: 0.05 });
    },
    chip(t) {
      noise(t, 0.03, { filter: 'highpass', freq: 2500, gain: 0.25 });
      noise(t + 0.045, 0.03, { filter: 'highpass', freq: 3000, gain: 0.18 });
    },
    scratch(t) {
      noise(t, 0.07, { freq: 2500 + Math.random() * 2000, q: 0.6, gain: 0.12 });
    },
    // Roulette-Kugel: Klicken, das immer langsamer wird (Dauer in Sekunden)
    rouletteSpin(t, duration = 4) {
      let time = 0;
      let gap = 0.05;
      while (time < duration - 0.2) {
        noise(t + time, 0.02, { filter: 'highpass', freq: 3500, gain: 0.1 });
        time += gap;
        gap *= 1.045;
      }
      tone(140, t + duration - 0.15, 0.15, { type: 'sine', gain: 0.2, slideTo: 70 });
    },
    achievement(t) {
      arpeggio(t, [880, 1109, 1319, 1760], 0.08, { type: 'sine', gain: 0.1, duration: 0.6 });
      jingle(t + 0.3, 0.5, 6);
    },
    golden(t) {
      for (let i = 0; i < 6; i++) tone(2000 + Math.random() * 1500, t + i * 0.04, 0.15, { type: 'sine', gain: 0.05 });
    },
    collect(t) {
      arpeggio(t, [1319, 1568, 2093, 2637], 0.05, { type: 'triangle', gain: 0.09, duration: 0.25 });
      jingle(t + 0.1, 0.5, 8);
    },
    deal(t) {
      noise(t, 0.12, { freq: 800, sweepTo: 3000, q: 0.7, gain: 0.15 });
    },
  };

  function play(name, ...args) {
    if (!settings().sound || !SOUNDS[name]) return;
    if (!ensureContext() || ctx.state !== 'running') return;
    const now = performance.now();
    if (THROTTLE[name] && now - (lastPlayed[name] || 0) < THROTTLE[name]) return;
    lastPlayed[name] = now;
    try {
      SOUNDS[name](ctx.currentTime + 0.01, ...args);
    } catch (e) {
      console.warn('Sound fehlgeschlagen:', e);
    }
  }

  function setEnabled(on) {
    settings().sound = on;
    if (on) unlock();
    applyVolume();
    GK.save();
  }

  function setVolume(volume) {
    settings().volume = Math.min(1, Math.max(0, volume));
    applyVolume();
    GK.save();
  }

  // Bei der ersten Berührung / dem ersten Klick den Ton freischalten
  ['pointerdown', 'touchend', 'keydown'].forEach(type => {
    document.addEventListener(type, unlock, { capture: true, passive: true });
  });

  GK.sound = { play, unlock, setEnabled, setVolume, applyVolume };
})();
