// Fortschritt & Motivation:
// - Einkommens-Boni (Schatzkarten, Erfolge, Goldrausch …)
// - „Große Fahrt“: neu anfangen gegen dauerhafte Schatzkarten (Prestige)
// - Goldene Bonus-Dublone, die zufällig auftaucht
// - Offline-Einnahmen, während das Spiel geschlossen ist
window.GK = window.GK || {};

(function () {
  const PRESTIGE_DIVISOR = 1e8;     // 1 Schatzkarte ab 100 Mio., 2 ab 800 Mio., 3 ab 2,7 Mrd. … (Kubikwurzel)
  const PRESTIGE_BONUS = 0.1;       // +10 % Einkommen pro Schatzkarte
  const ACHIEVEMENT_BONUS = 0.01;   // +1 % Einkommen pro Erfolg
  const OFFLINE_RATE = 0.5;         // Anteil des Einkommens, solange das Spiel geschlossen ist
  const OFFLINE_MAX = 8 * 3600;     // höchstens 8 Stunden
  const GOLDEN_MIN_DELAY = 60;      // Sekunden bis zur nächsten goldenen Dublone
  const GOLDEN_MAX_DELAY = 150;
  const GOLDEN_LIFETIME = 13;       // so lange bleibt sie sichtbar

  const BUFFS = {
    goldrush:   { name: 'Goldrausch',  icon: '⚡', type: 'income', mult: 7,  seconds: 60, desc: 'Einkommen ×7' },
    clickfever: { name: 'Klickfieber', icon: '🔥', type: 'click',  mult: 25, seconds: 20, desc: 'Klickkraft ×25' },
  };

  let golden = null;        // { el, expires }
  let nextGoldenAt = Infinity; // wird in init() gesetzt

  function randomDelay() {
    return GOLDEN_MIN_DELAY + GK.rng.int(GOLDEN_MAX_DELAY - GOLDEN_MIN_DELAY + 1);
  }

  // ---------- Boni ----------

  function prestigeMult() {
    return 1 + PRESTIGE_BONUS * GK.state.prestige.points;
  }

  function achievementMult() {
    return 1 + ACHIEVEMENT_BONUS * GK.state.achievements.length;
  }

  // Dauerhafte Boni (ohne zeitlich begrenzte)
  function permanentMult() {
    return prestigeMult() * achievementMult();
  }

  function activeBuffs() {
    const now = Date.now();
    return GK.state.buffs.filter(b => b.until > now);
  }

  function buffMult(type) {
    return activeBuffs().filter(b => b.type === type).reduce((m, b) => m * b.mult, 1);
  }

  function addBuff(id) {
    const def = BUFFS[id];
    GK.state.buffs = GK.state.buffs.filter(b => b.id !== id && b.until > Date.now());
    GK.state.buffs.push({ id, type: def.type, mult: def.mult, until: Date.now() + def.seconds * 1000 });
  }

  // ---------- Große Fahrt (Prestige) ----------

  function totalPrestigePoints() {
    return Math.floor(Math.cbrt(GK.state.allTimeEarned / PRESTIGE_DIVISOR));
  }

  function pendingPoints() {
    return Math.max(0, totalPrestigePoints() - GK.state.prestige.points);
  }

  // Ab wie viel insgesamt verdienten Dublonen gibt es die nächste Schatzkarte?
  function nextPointAt() {
    return Math.pow(totalPrestigePoints() + 1, 3) * PRESTIGE_DIVISOR;
  }

  // Laufende Casino-Runden würden beim Neustart verloren gehen
  function prestigeBlocker() {
    const g = GK.state.casino.games;
    if (g.blackjack && g.blackjack.round && !g.blackjack.round.finished) return 'Spiele zuerst deine Blackjack-Runde zu Ende.';
    if (g.roulette && (g.roulette.pending || Object.keys(g.roulette.bets || {}).length)) return 'Nimm zuerst deine Roulette-Chips vom Tisch.';
    if ((g.slots && g.slots.pending) || (g.sideSlot && g.sideSlot.pending)) return 'Warte, bis die Walzen stehen.';
    if (g.scratch && g.scratch.current && !g.scratch.current.settled) return 'Rubble zuerst dein Los auf.';
    if (g.poker && g.poker.table) return 'Beende zuerst dein Poker-Turnier.';
    if (g.pokerMp && g.pokerMp.session) return 'Verlasse zuerst deinen Poker-Raum.';
    if (g.room && g.room.session) return 'Beende zuerst dein Spiel mit Freunden bzw. gegen Computer.';
    if (g.mines && g.mines.round) return 'Beende zuerst deine Schatzsuche.';
    if (g.crash && g.crash.round && !g.crash.round.cashed) return 'Warte, bis die Kanonenkugel gelandet ist.';
    if ((g.wheel && g.wheel.pending) || (g.race && (g.race.pending || Object.keys(g.race.bets || {}).length))) return 'Warte, bis deine Runde vorbei ist.';
    if (g.flight && g.flight.pending) return 'Warte, bis dein Flugzeug gelandet ist.';
    if (g.stocks && g.stocks.holdings && Object.keys(g.stocks.holdings).length) return 'Verkaufe zuerst deine Aktien an der Hafenbörse.';
    if (g.plinko && ((g.plinko.pending && g.plinko.pending.length) || g.plinko.mass)) return 'Warte, bis alle Münzen gefallen sind.';
    const vs = ['vsPirate', 'vsOcean', 'vsVolcano'].map(id => g[id]).filter(Boolean);
    if (vs.some(x => x.pending || x.free || x.bonus)) return 'Spiel zuerst deine Freispiele bzw. die Bonusrunde zu Ende.';
    return '';
  }

  function goOnJourney() {
    const gain = pendingPoints();
    const blocker = prestigeBlocker();
    if (gain < 1) return;
    if (blocker) {
      GK.toast(blocker);
      return;
    }
    const s = GK.state;
    const text = `Auf große Fahrt gehen?\n\nDu verlierst deine ${GK.formatNumber(s.money)} Dublonen, alle Gebäude und Upgrades.\n` +
      `Dafür bekommst du ${gain} Schatzkarte${gain === 1 ? '' : 'n'}: +${gain * PRESTIGE_BONUS * 100} % Einkommen für immer.\n\n` +
      'Erfolge, VIP-Karte, Cosmetics und Casino-Statistik bleiben erhalten.' +
      (GK.cosmetics.unownedCount() ? '\n\nDanach darfst du am Glücksrad der Schatzkammer drehen!' : '');
    if (!confirm(text)) return;
    s.prestige.points += gain;
    s.prestige.journeys++;
    s.money = 0;
    s.totalEarned = 0;
    s.clickEarned = 0;
    s.buildings = {};
    s.upgrades = [];
    s.buffs = [];
    GK.save();
    GK.clicker.refresh();
    GK.sound.play('jackpot');
    GK.fx.confetti(200);
    GK.fx.coinRain(2, 40);
    GK.notify(`<span class="notify-icon">⛵</span><span><b>Leinen los!</b><br>${gain} neue Schatzkarte${gain === 1 ? '' : 'n'} – dein Einkommen ist jetzt dauerhaft ×${formatMult(prestigeMult())}.</span>`);
    GK.cosmetics.journeyReward();
  }

  function formatMult(m) {
    return GK.formatDecimal(m, 0, 2);
  }

  // ---------- Offline-Einnahmen ----------

  // Beim Laden: Einnahmen seit dem letzten Speichern gutschreiben
  function applyOfflineEarnings() {
    const seconds = (Date.now() - GK.state.lastSaved) / 1000;
    if (seconds < 60 || !GK.clicker.passiveActive()) return;
    const counted = Math.min(seconds, OFFLINE_MAX);
    const amount = GK.clicker.getCpsPermanent() * counted * OFFLINE_RATE;
    if (amount < 1) return;
    GK.earn(amount, 'passive');
    GK.notify(`<span class="notify-icon">🌙</span><span><b>Willkommen zurück!</b><br>Während du ${GK.formatDuration(seconds)} weg warst, ` +
      `haben deine Gebäude ${GK.formatMoneyHTML(amount)} verdient` +
      `${seconds > OFFLINE_MAX ? ' (höchstens 8 Stunden)' : ''}.</span>`, 8000);
  }

  // ---------- Goldene Dublone ----------

  function updateGolden() {
    const now = Date.now();
    if (golden && now > golden.expires) {
      golden.el.remove();
      golden = null;
      nextGoldenAt = now + randomDelay() * 1000;
    }
    if (!golden && now >= nextGoldenAt && document.visibilityState === 'visible') spawnGolden();
  }

  function spawnGolden() {
    const el = document.createElement('button');
    el.className = 'golden-coin';
    el.setAttribute('aria-label', 'Goldene Dublone – schnell klicken!');
    el.innerHTML = '<span>D</span>';
    const margin = 80;
    el.style.left = margin / 2 + GK.rng.int(Math.max(1, window.innerWidth - margin * 1.5)) + 'px';
    el.style.top = margin + GK.rng.int(Math.max(1, window.innerHeight - margin * 2)) + 'px';
    el.addEventListener('click', collectGolden);
    document.body.appendChild(el);
    golden = { el, expires: Date.now() + GOLDEN_LIFETIME * 1000 };
    GK.sound.play('golden');
  }

  function collectGolden() {
    if (!golden) return;
    const pos = GK.fx.center(golden.el);
    GK.sound.play('collect');
    GK.fx.burst(pos.x, pos.y, { count: 24, speed: 700 });
    GK.fx.burst(pos.x, pos.y, { count: 16, kind: 'sparkle', speed: 350 });
    golden.el.remove();
    golden = null;
    nextGoldenAt = Date.now() + randomDelay() * 1000;
    GK.state.goldenClicks++;
    GK.daily.track('golden', 1);

    const roll = GK.rng.float();
    let text;
    if (roll < 0.5) {
      // Schatzfund: 15 % des Guthabens, höchstens 15 Minuten Einkommen – mindestens 30 Klicks
      const amount = Math.max(
        Math.min(GK.state.money * 0.15, GK.clicker.getCpsPermanent() * 900),
        GK.clicker.getClickPower() * 30);
      GK.earn(amount, 'passive');
      GK.fx.floatText(pos.x, pos.y, '+' + GK.formatMoneyHTML(amount), 'win big');
      text = `<b>Schatzfund!</b><br>+${GK.formatMoneyHTML(amount)}`;
    } else {
      const id = roll < 0.85 ? 'goldrush' : 'clickfever';
      addBuff(id);
      const b = BUFFS[id];
      if (id === 'goldrush') GK.fx.coinRain(1.5, 25);
      GK.fx.floatText(pos.x, pos.y, `${b.icon} ${b.name}!`, 'win big');
      text = `<b>${b.icon} ${b.name}!</b><br>${b.desc} für ${b.seconds} Sekunden`;
    }
    GK.notify(`<span class="notify-icon">✨</span><span>${text}</span>`);
    GK.save();
  }

  // ---------- Darstellung ----------

  // Die Buff-Anzeigen bleiben bestehen, nur die Restzeit ändert sich – sonst begänne ihr Leuchten
  // 10× pro Sekunde von vorn
  function renderBuffBar() {
    const bar = document.getElementById('buff-bar');
    const now = Date.now();
    const buffs = activeBuffs();
    const ids = buffs.map(b => b.id).join();
    if (bar._ids !== ids) {
      bar._ids = ids;
      bar.innerHTML = buffs.map(() => '<span class="buff"></span>').join('');
    }
    buffs.forEach((b, i) => {
      const def = BUFFS[b.id];
      GK.setText(bar.children[i], `${def.icon} ${def.name} ×${def.mult} · ${Math.ceil((b.until - now) / 1000)} s`);
    });
  }

  function renderProgressTab() {
    const s = GK.state;
    const gain = pendingPoints();
    const blocker = prestigeBlocker();
    GK.setHTML(document.getElementById('prestige-stats'), `
      <dt>Schatzkarten</dt><dd>🗺️ ${GK.formatNumber(s.prestige.points)}</dd>
      <dt>Bonus durch Schatzkarten</dt><dd>+${GK.formatNumber(s.prestige.points * PRESTIGE_BONUS * 100)} %</dd>
      <dt>Große Fahrten</dt><dd>${GK.formatNumber(s.prestige.journeys)}</dd>
      <dt>Insgesamt verdient</dt><dd>${GK.formatMoneyHTML(s.allTimeEarned)}</dd>
      <dt>Nächste Schatzkarte ab</dt><dd>${GK.formatMoneyHTML(nextPointAt())}</dd>`);
    const btn = document.getElementById('prestige-btn');
    btn.disabled = gain < 1 || !!blocker;
    GK.setText(btn, gain >= 1 ? `⛵ Auf große Fahrt gehen (+${gain} Schatzkarte${gain === 1 ? '' : 'n'})` : '⛵ Auf große Fahrt gehen');
    GK.setText(document.getElementById('prestige-hint'), gain < 1
      ? 'Verdiene insgesamt mehr Dublonen, um deine erste bzw. nächste Schatzkarte zu bekommen.'
      : blocker);

    const buffs = activeBuffs();
    GK.setHTML(document.getElementById('bonus-stats'), `
      <dt>🗺️ Schatzkarten</dt><dd>×${formatMult(prestigeMult())}</dd>
      <dt>🏆 Erfolge (${s.achievements.length})</dt><dd>×${formatMult(achievementMult())}</dd>
      ${buffs.map(b => `<dt>${BUFFS[b.id].icon} ${BUFFS[b.id].name}</dt><dd>×${b.mult} (${BUFFS[b.id].type === 'click' ? 'Klicks' : 'Einkommen'})</dd>`).join('')}
      <dt>Gesamt-Bonus Einkommen</dt><dd>×${formatMult(permanentMult() * buffMult('income'))}</dd>
      <dt>Offline-Einnahmen</dt><dd>${OFFLINE_RATE * 100} %, max. 8 Std.</dd>`);
  }

  function init() {
    nextGoldenAt = Date.now() + randomDelay() * 1000;
    document.getElementById('prestige-btn').addEventListener('click', goOnJourney);
  }

  // Wird regelmäßig aus der Spielschleife aufgerufen
  function update(progressTabVisible) {
    updateGolden();
    renderBuffBar();
    if (progressTabVisible) renderProgressTab();
  }

  GK.progress = {
    init,
    update,
    permanentMult,
    buffMult,
    applyOfflineEarnings,
    pendingPoints,
    // für Tests
    _spawnGolden: spawnGolden,
  };
})();
