// Effekte: fliegende Münzen, Konfetti, Münzregen, Gewinn-Banner, Wackeln.
// Alles läuft auf einer durchsichtigen Zeichenfläche über dem Spiel.
// In den Einstellungen kann man „Animationen: reduziert“ wählen – dann gibt es nur Banner und Text.
window.GK = window.GK || {};

(function () {
  const MAX_PARTICLES = 450;
  const GRAVITY = 1400; // Pixel pro Sekunde²
  const CONFETTI_COLORS = ['#f5c542', '#ff5e7e', '#4fd1c5', '#7c83ff', '#6fdc8c', '#ffffff', '#ff9f43'];
  const FIREWORK_COLORS = ['#ff5e7e', '#4fd1c5', '#ffd95e', '#7c83ff', '#6fdc8c', '#ff9f43', '#e48bff'];
  // Münzfarben: Glanz, Mitte, Schatten, Rand (Gold; Cosmetics können andere Farben mitgeben)
  const GOLD = ['#fff6c2', '#f5c542', '#a8740a', '#8a6508'];
  const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

  let canvas;
  let g;
  let particles = [];
  let running = false;
  let lastTime = 0;
  let dpr = 1;
  let rainUntil = 0;
  let rainDensity = 0;
  let looping = false;  // während der Schleife entstehen neue Partikel erst danach (z. B. Feuerwerk)
  let queued = [];
  // Fenstergröße zwischengespeichert: innerWidth/innerHeight in jedem Frame zu lesen kann Layout erzwingen
  let viewW = 0;
  let viewH = 0;
  // Vorgezeichnete Bilder (Münzen je Farbe, Flammen, Emojis): Farbverläufe und Emoji-Schrift
  // in jedem Frame neu zu berechnen ist auf dem iPad teuer
  const sprites = new Map();
  const SPRITE_R = 48;

  function reduced() {
    return GK.state.settings.effects === 'reduced';
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    viewW = window.innerWidth;
    viewH = window.innerHeight;
    canvas.width = viewW * dpr;
    canvas.height = viewH * dpr;
  }

  // Bild einmal auf eine kleine Zeichenfläche malen und danach nur noch skaliert kopieren
  function sprite(key, paint) {
    let c = sprites.get(key);
    if (!c) {
      c = document.createElement('canvas');
      c.width = c.height = SPRITE_R * 2;
      const sg = c.getContext('2d');
      sg.translate(SPRITE_R, SPRITE_R);
      paint(sg, SPRITE_R);
      sprites.set(key, c);
    }
    return c;
  }

  function init() {
    canvas = document.createElement('canvas');
    canvas.className = 'fx-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);
    g = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
  }

  // ---------- Partikel ----------

  function add(p) {
    if (looping) {
      queued.push(p);
      return;
    }
    if (particles.length >= MAX_PARTICLES) particles.shift();
    particles.push(p);
    if (!running) {
      running = true;
      lastTime = performance.now();
      requestAnimationFrame(loop);
    }
  }

  function coinParticle(x, y, vx, vy, size, colors) {
    return { kind: 'coin', x, y, vx, vy, size, colors: colors || GOLD, spin: Math.random() * Math.PI * 2, spinSpeed: 6 + Math.random() * 10, life: 0, maxLife: 2.6 };
  }

  function confettiParticle(x, y, vx, vy) {
    return {
      kind: 'confetti', x, y, vx, vy,
      w: 6 + Math.random() * 6, h: 10 + Math.random() * 8,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      rot: Math.random() * Math.PI, rotSpeed: (Math.random() - 0.5) * 12,
      sway: Math.random() * Math.PI * 2, life: 0, maxLife: 4,
    };
  }

  function sparkleParticle(x, y, vx, vy) {
    return { kind: 'sparkle', x, y, vx, vy, size: 3 + Math.random() * 5, life: 0, maxLife: 0.6 + Math.random() * 0.5 };
  }

  // Blasen steigen schaukelnd auf
  function bubbleParticle(x, y, vx) {
    return { kind: 'bubble', x, y, vx: vx * 0.25, vy: -70 - Math.random() * 140, size: 4 + Math.random() * 9, sway: Math.random() * 6.3, life: 0, maxLife: 1.1 + Math.random() * 0.9 };
  }

  // Ein Zeichen wie 🍀, das sich dreht und herunterfällt
  function emojiParticle(x, y, vx, vy, char) {
    return { kind: 'emoji', x, y, vx, vy, char, size: 18 + Math.random() * 14, rot: Math.random() * 6.3, rotSpeed: (Math.random() - 0.5) * 9, life: 0, maxLife: 1.7 };
  }

  // Flämmchen: steigt auf, wird kleiner und von Gelb über Orange zu Rot
  function flameParticle(x, y, vx, vy) {
    return { kind: 'flame', x: x + (Math.random() - 0.5) * 24, y, vx: vx * 0.35, vy: vy * 0.4 - 60, size: 10 + Math.random() * 14, life: 0, maxLife: 0.45 + Math.random() * 0.45 };
  }

  // Rakete: fliegt hoch und zerplatzt in bunte Funken
  function rocketParticle(x, y) {
    const color = FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)];
    return { kind: 'rocket', x, y, vx: (Math.random() - 0.5) * 160, vy: -640 - Math.random() * 220, color, life: 0, maxLife: 0.32 + Math.random() * 0.18 };
  }

  function sparkParticle(x, y, vx, vy, color, maxLife) {
    return { kind: 'spark', x, y, vx, vy, color, size: 1.8 + Math.random() * 1.8, life: 0, maxLife: maxLife || 0.8 + Math.random() * 0.6 };
  }

  function explode(p) {
    const n = 28;
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2 + Math.random() * 0.1;
      const v = 200 + Math.random() * 140;
      add(sparkParticle(p.x, p.y, Math.cos(angle) * v, Math.sin(angle) * v, i % 4 === 0 ? '#ffffff' : p.color));
    }
  }

  // Münzen (oder Funken/Konfetti) fliegen von einem Punkt aus in alle Richtungen
  function burst(x, y, opts = {}) {
    if (reduced()) return;
    const count = opts.count || 20;
    const speed = opts.speed || 600;
    const kind = opts.kind || 'coin';
    for (let i = 0; i < count; i++) {
      const angle = opts.upward
        ? -Math.PI / 2 + (Math.random() - 0.5) * (opts.spread || 1.6)
        : Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.8);
      const vx = Math.cos(angle) * v;
      const vy = Math.sin(angle) * v;
      if (kind === 'coin') add(coinParticle(x, y, vx, vy, opts.size || 10 + Math.random() * 8, opts.colors));
      else if (kind === 'confetti') add(confettiParticle(x, y, vx, vy));
      else if (kind === 'bubble') add(bubbleParticle(x, y, vx));
      else if (kind === 'emoji') add(emojiParticle(x, y, vx, vy, opts.char || '✨'));
      else if (kind === 'flame') add(flameParticle(x, y, vx, vy));
      else if (kind === 'firework') add(rocketParticle(x, y));
      else add(sparkleParticle(x, y, vx * 0.5, vy * 0.5));
    }
  }

  // Konfetti-Kanonen von beiden Seiten
  function confetti(count = 120) {
    if (reduced()) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    for (let i = 0; i < count; i++) {
      const left = i % 2 === 0;
      const angle = left ? -Math.PI / 3 - Math.random() * 0.5 : -Math.PI * 2 / 3 + Math.random() * 0.5;
      const v = 700 + Math.random() * 700;
      add(confettiParticle(left ? -10 : w + 10, h * 0.75, Math.cos(angle) * v, Math.sin(angle) * v));
    }
  }

  // Goldmünzen regnen von oben
  function coinRain(seconds = 2, density = 40) {
    if (reduced()) return;
    rainUntil = Math.max(rainUntil, performance.now() + seconds * 1000);
    rainDensity = Math.max(rainDensity, density);
    if (!running) add(coinParticle(-100, -100, 0, 0, 1)); // Schleife starten
  }

  function loop(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    const w = viewW;
    const h = viewH;

    if (now < rainUntil) {
      const n = rainDensity * dt * 3;
      for (let i = 0; i < n; i++) {
        add(coinParticle(Math.random() * w, -30, (Math.random() - 0.5) * 120, 100 + Math.random() * 250, 12 + Math.random() * 12));
      }
    } else {
      rainDensity = 0;
    }

    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    looping = true;
    particles = particles.filter(p => {
      p.life += dt;
      if (p.kind === 'rocket' && p.life > p.maxLife) {
        explode(p);
        return false;
      }
      if (p.life > p.maxLife || p.y > h + 60 || p.y < -80) return false;
      if (p.kind === 'confetti') {
        p.vx *= 1 - 1.5 * dt;
        p.vy = Math.min(p.vy + GRAVITY * 0.35 * dt, 260);
        p.sway += dt * 5;
        p.x += (p.vx + Math.sin(p.sway) * 40) * dt;
        p.y += p.vy * dt;
        p.rot += p.rotSpeed * dt;
        drawConfetti(p);
      } else if (p.kind === 'coin') {
        p.vy += GRAVITY * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.spin += p.spinSpeed * dt;
        drawCoin(p);
      } else if (p.kind === 'bubble') {
        p.sway += dt * 4;
        p.vy *= 1 - 0.4 * dt;
        p.x += (p.vx + Math.sin(p.sway) * 34) * dt;
        p.y += p.vy * dt;
        drawBubble(p);
      } else if (p.kind === 'emoji') {
        p.vx *= 1 - 1.2 * dt;
        p.vy += GRAVITY * 0.45 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.rotSpeed * dt;
        drawEmoji(p);
      } else if (p.kind === 'flame') {
        p.vy -= 320 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        drawFlame(p);
      } else if (p.kind === 'rocket') {
        p.vy += GRAVITY * 0.3 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        add(sparkParticle(p.x, p.y, (Math.random() - 0.5) * 40, 40 + Math.random() * 40, '#ffd27a', 0.25));
        drawSpark({ x: p.x, y: p.y, size: 3, color: '#fff3c2', life: 0, maxLife: 1 });
      } else if (p.kind === 'spark') {
        p.vx *= 1 - 1.4 * dt;
        p.vy = p.vy * (1 - 1.4 * dt) + GRAVITY * 0.3 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        drawSpark(p);
      } else {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        drawSparkle(p);
      }
      return true;
    });
    looping = false;
    if (queued.length) {
      particles = particles.concat(queued).slice(-MAX_PARTICLES);
      queued = [];
    }

    if (particles.length || now < rainUntil) {
      requestAnimationFrame(loop);
    } else {
      running = false;
      g.clearRect(0, 0, w, h);
    }
  }

  function fade(p) {
    return Math.max(0, Math.min(1, (p.maxLife - p.life) / 0.5));
  }

  function coinSprite(colors) {
    return sprite('coin|' + colors.join(), (sg, r) => {
      const size = r / 1.08; // Platz für den Rand
      const grad = sg.createRadialGradient(-size * 0.3, -size * 0.3, 1, 0, 0, size);
      grad.addColorStop(0, colors[0]);
      grad.addColorStop(0.45, colors[1]);
      grad.addColorStop(1, colors[2]);
      sg.fillStyle = grad;
      sg.beginPath();
      sg.arc(0, 0, size, 0, Math.PI * 2);
      sg.fill();
      sg.lineWidth = size * 0.15;
      sg.strokeStyle = colors[3];
      sg.stroke();
    });
  }

  function drawCoin(p) {
    const squash = Math.abs(Math.cos(p.spin)); // dreht sich um die eigene Achse
    const r = p.size * 1.08;
    g.save();
    g.globalAlpha = fade(p);
    g.translate(p.x, p.y);
    g.scale(Math.max(squash, 0.12), 1);
    g.drawImage(coinSprite(p.colors), -r, -r, r * 2, r * 2);
    g.restore();
  }

  function drawConfetti(p) {
    g.save();
    g.globalAlpha = fade(p);
    g.translate(p.x, p.y);
    g.rotate(p.rot);
    g.scale(1, Math.abs(Math.sin(p.rot * 1.3)) * 0.8 + 0.2);
    g.fillStyle = p.color;
    g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    g.restore();
  }

  function drawSparkle(p) {
    const a = Math.max(0, 1 - p.life / p.maxLife);
    const s = p.size * (0.5 + a);
    g.save();
    g.globalAlpha = a;
    g.translate(p.x, p.y);
    g.fillStyle = '#fff6c2';
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const r = i % 2 === 0 ? s : s * 0.3;
      const ang = (i / 8) * Math.PI * 2;
      g.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
    }
    g.closePath();
    g.fill();
    g.restore();
  }

  function drawBubble(p) {
    const a = Math.min(1, (p.maxLife - p.life) / 0.4) * Math.min(1, p.life / 0.1);
    g.save();
    g.globalAlpha = Math.max(0, a);
    g.translate(p.x, p.y);
    g.fillStyle = 'rgba(150, 225, 255, 0.15)';
    g.strokeStyle = 'rgba(210, 245, 255, 0.9)';
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(0, 0, p.size, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = 'rgba(255, 255, 255, 0.85)';
    g.beginPath();
    g.arc(-p.size * 0.35, -p.size * 0.35, p.size * 0.22, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  function drawEmoji(p) {
    const img = sprite('emoji|' + p.char, (sg, r) => {
      sg.font = `${r * 1.5}px ${EMOJI_FONT}`;
      sg.textAlign = 'center';
      sg.textBaseline = 'middle';
      sg.fillText(p.char, 0, 0);
    });
    const r = p.size / 1.5; // Schriftgröße p.size entspricht 1,5 × Radius des Bildes
    g.save();
    g.globalAlpha = fade(p);
    g.translate(p.x, p.y);
    g.rotate(p.rot);
    g.drawImage(img, -r, -r, r * 2, r * 2);
    g.restore();
  }

  function drawFlame(p) {
    const t = p.life / p.maxLife;
    const s = p.size * (1 - t * 0.7);
    const inner = t < 0.35 ? '255, 245, 190' : t < 0.65 ? '255, 170, 60' : '235, 80, 30';
    const outer = t < 0.5 ? '255, 120, 20' : '190, 40, 20';
    const img = sprite(`flame|${inner}|${outer}`, (sg, r) => {
      const grad = sg.createRadialGradient(0, 0, 0, 0, 0, r);
      grad.addColorStop(0, `rgba(${inner}, 0.95)`);
      grad.addColorStop(0.5, `rgba(${outer}, 0.55)`);
      grad.addColorStop(1, `rgba(${outer}, 0)`);
      sg.fillStyle = grad;
      sg.beginPath();
      sg.arc(0, 0, r, 0, Math.PI * 2);
      sg.fill();
    });
    if (s <= 0) return;
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = Math.max(0, 1 - t);
    g.drawImage(img, p.x - s, p.y - s, s * 2, s * 2);
    g.restore();
  }

  function drawSpark(p) {
    const a = Math.max(0, 1 - p.life / p.maxLife);
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = p.color;
    // Schein drumherum (ohne shadowBlur – das wäre auf dem iPad zu langsam)
    g.globalAlpha = a * 0.25;
    g.beginPath();
    g.arc(p.x, p.y, p.size * 2.6, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = a;
    g.beginPath();
    g.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  // ---------- Kleine Effekte auf Elementen ----------

  function center(el) {
    if (!el) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  // Element kurz hüpfen/leuchten lassen (CSS-Klasse wird neu gestartet)
  // Kurze CSS-Animation über eine Klasse abspielen. Die Klasse wird danach wieder entfernt – sonst
  // sammeln sich Klassen an und blockieren sich gegenseitig (z. B. „gekauft“ nach „verstärkt“).
  // Ein Layout wird nur erzwungen, wenn dieselbe Animation gerade noch läuft und neu starten soll.
  function pulse(el, cls = 'fx-pulse') {
    if (!el) return;
    if (el.classList.contains(cls)) {
      el.classList.remove(cls);
      void el.offsetWidth;
    }
    el.classList.add(cls);
    const done = el._pulseDone || (el._pulseDone = {});
    if (done[cls]) return;
    done[cls] = e => {
      if (e.target !== el) return;
      el.classList.remove(cls);
      el.removeEventListener('animationend', done[cls]);
      el.removeEventListener('animationcancel', done[cls]);
      delete done[cls];
    };
    el.addEventListener('animationend', done[cls]);
    el.addEventListener('animationcancel', done[cls]);
  }

  function shake(strength = 'small') {
    if (reduced()) return;
    pulse(document.querySelector('main'), strength === 'big' ? 'fx-shake-big' : 'fx-shake');
  }

  function flash() {
    if (reduced()) return;
    const el = document.createElement('div');
    el.className = 'fx-flash';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 700);
  }

  // Aufsteigender Text, z. B. „+1.000“
  function floatText(x, y, html, cls = '') {
    const el = document.createElement('div');
    el.className = 'fx-float ' + cls;
    el.innerHTML = html;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1600);
  }

  // ---------- Gewinn-Banner ----------

  const LEVELS = {
    big:     { title: 'GROSSER GEWINN!', cls: 'big',     seconds: 2.6 },
    mega:    { title: 'MEGA-GEWINN!',    cls: 'mega',    seconds: 3.4 },
    jackpot: { title: 'JACKPOT!',        cls: 'jackpot', seconds: 4.4 },
  };

  let bannerEl = null;

  function banner(level, amount, subtitle) {
    const def = LEVELS[level];
    if (bannerEl) bannerEl.remove();
    const el = document.createElement('div');
    el.className = `win-banner ${def.cls}`;
    el.innerHTML = `
      <div class="win-rays"></div>
      <div class="win-content">
        <div class="win-title">${def.title}</div>
        <div class="win-amount"><span class="win-number">0</span> ${GK.COIN}</div>
        ${subtitle ? `<div class="win-sub">${subtitle}</div>` : ''}
        <div class="win-hint">Tippen zum Schließen</div>
      </div>`;
    document.body.appendChild(el);
    bannerEl = el;
    const close = () => {
      el.classList.add('hide');
      setTimeout(() => el.remove(), 400);
      if (bannerEl === el) bannerEl = null;
    };
    el.addEventListener('click', close);

    // Betrag hochzählen
    const number = el.querySelector('.win-number');
    const countTime = def.seconds * 450;
    const start = performance.now();
    const step = now => {
      const k = Math.min(1, (now - start) / countTime);
      const eased = 1 - Math.pow(1 - k, 3);
      number.textContent = GK.formatNumber(amount * eased);
      if (k < 1 && el.isConnected) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    setTimeout(close, def.seconds * 1000);
  }

  // ---------- Gewinne feiern ----------

  /**
   * Passend zur Gewinnhöhe feiern.
   * payout = Auszahlung (inkl. Einsatz), bet = Einsatz.
   * opts: { el: Element, von dem die Münzen fliegen; level: Stufe erzwingen; subtitle; quiet: kein Verlust-Ton }
   */
  function celebrate(payout, bet, opts = {}) {
    const ratio = bet > 0 ? payout / bet : 0;
    const net = payout - bet;
    const pos = center(opts.el);

    if (payout <= 0) {
      if (!opts.quiet) GK.sound.play('lose');
      return 'lose';
    }
    if (payout <= bet) {
      GK.sound.play('coin');
      return 'push';
    }

    let level = opts.level;
    if (!level) {
      if (ratio >= 100) level = 'jackpot';
      else if (ratio >= 20) level = 'mega';
      else if (ratio >= 5) level = 'big';
      else level = 'small';
    }
    pulse(document.querySelector('.wallet'), 'fx-wallet');

    if (level === 'small') {
      GK.sound.play('winSmall');
      burst(pos.x, pos.y, { count: 18, speed: 650, upward: true, spread: 2 });
      burst(pos.x, pos.y, { count: 10, kind: 'sparkle', speed: 300 });
      floatText(pos.x, pos.y - 20, '+' + GK.formatMoneyHTML(net), 'win');
      return level;
    }

    banner(level, net, opts.subtitle);
    if (level === 'big') {
      GK.sound.play('winBig');
      burst(pos.x, pos.y, { count: 45, speed: 900, upward: true, spread: 2.2 });
      confetti(90);
      flash();
    } else if (level === 'mega') {
      GK.sound.play('winMega');
      burst(pos.x, pos.y, { count: 60, speed: 1000, upward: true, spread: 2.4 });
      confetti(160);
      coinRain(2.5, 45);
      flash();
      shake('small');
    } else {
      GK.sound.play('jackpot');
      burst(pos.x, pos.y, { count: 80, speed: 1200 });
      confetti(220);
      coinRain(4, 70);
      flash();
      shake('big');
      setTimeout(() => confetti(160), 1200);
    }
    return level;
  }

  GK.fx = { init, burst, confetti, coinRain, pulse, shake, flash, floatText, banner, celebrate, center };
})();
