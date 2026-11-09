// Fortschritt & Motivation:
// - Einkommens-Boni (Schatzkarten, Erfolge, Goldrausch …)
// - „Große Fahrt“: neu anfangen gegen dauerhafte Schatzkarten (Prestige)
// - Goldene Bonus-Dublone, die zufällig auftaucht
// - Offline-Einnahmen, während das Spiel geschlossen ist
window.GK = window.GK || {};

// Sprache: Ersatz, falls js/i18n.js (noch) nicht geladen ist – gibt den deutschen Text zurück.
GK.t = GK.t || function (s, v) { s = String(s); return v ? s.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m)) : s; };
GK.i18n = GK.i18n || { add() {}, addHtml() {}, apply() {}, set() {}, lang: 'de' };

GK.i18n.add({
  // Boni
  'Goldrausch': 'Gold Rush',
  'Klickfieber': 'Click Fever',
  'Glückssträhne': 'Lucky Streak',
  'Einkommen ×7': 'Income ×7',
  'Klickkraft ×25': 'Click power ×25',
  'Casino-Gewinne': 'Casino wins',
  // Offene Runden, die eine große Fahrt blockieren
  'Spiele zuerst deine Blackjack-Runde zu Ende.': 'Finish your blackjack round first.',
  'Nimm zuerst deine Roulette-Chips vom Tisch.': 'Take your roulette chips off the table first.',
  'Warte, bis die Walzen stehen.': 'Wait until the reels stop.',
  'Rubble zuerst dein Los auf.': 'Scratch your card first.',
  'Beende zuerst dein Poker-Turnier.': 'Finish your poker tournament first.',
  'Verlasse zuerst deinen Poker-Raum.': 'Leave your poker room first.',
  'Beende zuerst dein Spiel mit Freunden bzw. gegen Computer.': 'Finish your game with friends or vs. the computer first.',
  'Beende zuerst deine Schatzsuche.': 'Finish your treasure hunt first.',
  'Halte zuerst deine Stoppuhr an.': 'Stop your stopwatch first.',
  'Warte, bis die Kanonenkugel gelandet ist.': 'Wait until the cannonball has landed.',
  'Warte, bis deine Runde vorbei ist.': 'Wait until your round is over.',
  'Warte, bis dein Flugzeug gelandet ist.': 'Wait until your plane has landed.',
  'Verkaufe zuerst deine Aktien an der Hafenbörse.': 'Sell your stocks on the harbor exchange first.',
  'Warte, bis alle Münzen gefallen sind.': 'Wait until all coins have dropped.',
  'Spiel zuerst deine Freispiele bzw. die Bonusrunde zu Ende.': 'Finish your free spins or bonus round first.',
  // Große Fahrt
  'Schatzkarte': 'treasure map',
  'Schatzkarten': 'treasure maps',
  'Auf große Fahrt gehen?\n\nDu verlierst deine {money} Dublonen, alle Gebäude und Upgrades.\nDafür bekommst du {n} {maps}: +{pct} % Einkommen für immer.\n\nErfolge, VIP-Karte, Cosmetics, Flotte und Casino-Statistik bleiben erhalten.':
    'Go on a great voyage?\n\nYou lose your {money} doubloons, all buildings and upgrades.\nIn return you get {n} {maps}: +{pct}% income forever.\n\nAchievements, VIP card, cosmetics, fleet and casino stats are kept.',
  '\n\nDanach darfst du am Glücksrad der Schatzkammer drehen!': "\n\nAfterwards you get to spin the treasure vault's wheel of fortune!",
  '<b>Leinen los!</b><br>{n} neue {maps} – dein Einkommen ist jetzt dauerhaft ×{mult}.':
    '<b>Cast off!</b><br>{n} new {maps} – your income is now permanently ×{mult}.',
  // Offline-Einnahmen
  '<b>Willkommen zurück!</b><br>Während du {dur} weg warst, haben deine Gebäude {amount} verdient{max}.':
    '<b>Welcome back!</b><br>While you were away for {dur}, your buildings earned {amount}{max}.',
  ' (höchstens 8 Stunden)': ' (at most 8 hours)',
  // Goldene Dublone
  'Goldene Dublone – schnell klicken!': 'Golden doubloon – click quick!',
  '<b>Schatzfund!</b><br>+{amount}': '<b>Treasure found!</b><br>+{amount}',
  'Casino-Gewinne +{pct} % für {sec} Sekunden': 'Casino wins +{pct}% for {sec} seconds',
  '{desc} für {sec} Sekunden': '{desc} for {sec} seconds',
  // Fortschritt-Tab
  'Bonus durch Schatzkarten': 'Bonus from treasure maps',
  'Große Fahrten': 'Great voyages',
  'Insgesamt verdient': 'Total earned',
  'Nächste Schatzkarte ab': 'Next treasure map at',
  'Auf große Fahrt gehen (+{n} {maps})': 'Go on a great voyage (+{n} {maps})',
  'Auf große Fahrt gehen': 'Go on a great voyage',
  'Verdiene insgesamt mehr Dublonen, um deine erste bzw. nächste Schatzkarte zu bekommen.':
    'Earn more doubloons in total to get your first or next treasure map.',
  'Erfolge ({n})': 'Achievements ({n})',
  'Schätze der Flotte': 'Fleet treasures',
  'Gesamt-Bonus Einkommen': 'Total income bonus',
  'Offline-Einnahmen': 'Offline earnings',
  '{pct} %, max. 8 Std.': '{pct}%, max. 8 hrs',
  'Klicks': 'Clicks',
  'Einkommen': 'Income',
});

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
    goldrush:   { name: 'Goldrausch',    icon: '⚡', ic: 'bolt', type: 'income', mult: 7,  seconds: 60, desc: 'Einkommen ×7' },
    clickfever: { name: 'Klickfieber',   icon: '🔥', ic: 'flame', type: 'click',  mult: 25, seconds: 20, desc: 'Klickkraft ×25' },
    // Glückssträhne: Gewinne im Casino zählen 30–50 % mehr (wird beim Auslösen zufällig festgelegt)
    luck:       { name: 'Glückssträhne', icon: '🍀', ic: 'clover', type: 'luck',   mult: 1.4, seconds: 30, desc: 'Casino-Gewinne' },
  };

  // Eigenes Symbol (js/icons.js); in den Tests ohne Browser gibt es keins
  const ic = name => (GK.icon ? GK.icon(name) : '');

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
  // Schätze der Flotte (js/fleet.js) zählen wie Erfolge und Schatzkarten dauerhaft
  const fleetMult = () => (GK.fleet ? GK.fleet.incomeMult() : 1);

  function permanentMult() {
    return prestigeMult() * achievementMult() * fleetMult();
  }

  function activeBuffs() {
    const now = Date.now();
    return GK.state.buffs.filter(b => b.until > now);
  }

  function buffMult(type) {
    return activeBuffs().filter(b => b.type === type).reduce((m, b) => m * b.mult, 1);
  }

  function addBuff(id, mult) {
    const def = BUFFS[id];
    GK.state.buffs = GK.state.buffs.filter(b => b.id !== id && b.until > Date.now());
    GK.state.buffs.push({ id, type: def.type, mult: mult || def.mult, until: Date.now() + def.seconds * 1000 });
  }

  // Wirkung eines Buffs als Text: „×7“ bzw. bei der Glückssträhne „+40 %“
  function buffEffect(b) {
    return b.type === 'luck' ? `+${Math.round((b.mult - 1) * 100)} %` : `×${b.mult}`;
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
    if (g.blackjack && g.blackjack.round && !g.blackjack.round.finished) return GK.t('Spiele zuerst deine Blackjack-Runde zu Ende.');
    if (g.roulette && (g.roulette.pending || Object.keys(g.roulette.bets || {}).length)) return GK.t('Nimm zuerst deine Roulette-Chips vom Tisch.');
    if ((g.slots && g.slots.pending) || (g.sideSlot && g.sideSlot.pending)) return GK.t('Warte, bis die Walzen stehen.');
    if (g.scratch && g.scratch.current && !g.scratch.current.settled) return GK.t('Rubble zuerst dein Los auf.');
    if (g.poker && g.poker.table) return GK.t('Beende zuerst dein Poker-Turnier.');
    if (g.pokerMp && g.pokerMp.session) return GK.t('Verlasse zuerst deinen Poker-Raum.');
    if (g.room && g.room.session) return GK.t('Beende zuerst dein Spiel mit Freunden bzw. gegen Computer.');
    if (g.mines && g.mines.round) return GK.t('Beende zuerst deine Schatzsuche.');
    if (g.stopwatch && g.stopwatch.round) return GK.t('Halte zuerst deine Stoppuhr an.');
    if (g.crash && g.crash.round && !g.crash.round.cashed) return GK.t('Warte, bis die Kanonenkugel gelandet ist.');
    if ((g.wheel && g.wheel.pending) || (g.race && (g.race.pending || Object.keys(g.race.bets || {}).length))) return GK.t('Warte, bis deine Runde vorbei ist.');
    if (g.flight && g.flight.pending) return GK.t('Warte, bis dein Flugzeug gelandet ist.');
    if (g.stocks && g.stocks.holdings && Object.keys(g.stocks.holdings).length) return GK.t('Verkaufe zuerst deine Aktien an der Hafenbörse.');
    if (g.plinko && ((g.plinko.pending && g.plinko.pending.length) || g.plinko.mass)) return GK.t('Warte, bis alle Münzen gefallen sind.');
    const vs = ['vsPirate', 'vsOcean', 'vsVolcano'].map(id => g[id]).filter(Boolean);
    if (vs.some(x => x.pending || x.free || x.bonus)) return GK.t('Spiel zuerst deine Freispiele bzw. die Bonusrunde zu Ende.');
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
    const text = GK.t('Auf große Fahrt gehen?\n\nDu verlierst deine {money} Dublonen, alle Gebäude und Upgrades.\nDafür bekommst du {n} {maps}: +{pct} % Einkommen für immer.\n\nErfolge, VIP-Karte, Cosmetics, Flotte und Casino-Statistik bleiben erhalten.',
      { money: GK.formatNumber(s.money), n: gain, maps: GK.t(gain === 1 ? 'Schatzkarte' : 'Schatzkarten'), pct: gain * PRESTIGE_BONUS * 100 }) +
      (GK.cosmetics.unownedCount() ? GK.t('\n\nDanach darfst du am Glücksrad der Schatzkammer drehen!') : '');
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
    GK.notify(`<span class="notify-icon">${ic('sailboat')}</span><span>${GK.t('<b>Leinen los!</b><br>{n} neue {maps} – dein Einkommen ist jetzt dauerhaft ×{mult}.', { n: gain, maps: GK.t(gain === 1 ? 'Schatzkarte' : 'Schatzkarten'), mult: formatMult(prestigeMult()) })}</span>`);
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
    GK.notify(`<span class="notify-icon">${ic('moon')}</span><span>${GK.t('<b>Willkommen zurück!</b><br>Während du {dur} weg warst, haben deine Gebäude {amount} verdient{max}.', { dur: GK.formatDuration(seconds), amount: GK.formatMoneyHTML(amount), max: seconds > OFFLINE_MAX ? GK.t(' (höchstens 8 Stunden)') : '' })}</span>`, 8000);
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
    el.setAttribute('aria-label', GK.t('Goldene Dublone – schnell klicken!'));
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
      text = GK.t('<b>Schatzfund!</b><br>+{amount}', { amount: GK.formatMoneyHTML(amount) });
    } else {
      const id = roll < 0.75 ? 'goldrush' : roll < 0.87 ? 'clickfever' : 'luck';
      // Glückssträhne: 30 bis 50 % (in 5er-Schritten)
      const mult = id === 'luck' ? 1.3 + 0.05 * GK.rng.int(5) : 0;
      addBuff(id, mult);
      const b = BUFFS[id];
      if (id === 'goldrush') GK.fx.coinRain(1.5, 25);
      GK.fx.floatText(pos.x, pos.y, `${b.icon} ${GK.t(b.name)}!`, 'win big');
      text = id === 'luck'
        ? `<b>${b.icon} ${GK.t(b.name)}!</b><br>${GK.t('Casino-Gewinne +{pct} % für {sec} Sekunden', { pct: Math.round((mult - 1) * 100), sec: b.seconds })}`
        : `<b>${b.icon} ${GK.t(b.name)}!</b><br>${GK.t('{desc} für {sec} Sekunden', { desc: GK.t(b.desc), sec: b.seconds })}`;
    }
    GK.notify(`<span class="notify-icon">${ic('sparkle')}</span><span>${text}</span>`);
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
      GK.setHTML(bar.children[i], `${ic(def.ic)}${GK.t(def.name)} ${buffEffect(b)} · ${Math.ceil((b.until - now) / 1000)} s`);
    });
  }

  function renderProgressTab() {
    const s = GK.state;
    const gain = pendingPoints();
    const blocker = prestigeBlocker();
    GK.setHTML(document.getElementById('prestige-stats'), `
      <dt>${GK.t('Schatzkarten')}</dt><dd>${ic('map')} ${GK.formatNumber(s.prestige.points)}</dd>
      <dt>${GK.t('Bonus durch Schatzkarten')}</dt><dd>+${GK.formatNumber(s.prestige.points * PRESTIGE_BONUS * 100)} %</dd>
      <dt>${GK.t('Große Fahrten')}</dt><dd>${GK.formatNumber(s.prestige.journeys)}</dd>
      <dt>${GK.t('Insgesamt verdient')}</dt><dd>${GK.formatMoneyHTML(s.allTimeEarned)}</dd>
      <dt>${GK.t('Nächste Schatzkarte ab')}</dt><dd>${GK.formatMoneyHTML(nextPointAt())}</dd>`);
    const btn = document.getElementById('prestige-btn');
    btn.disabled = gain < 1 || !!blocker;
    GK.setHTML(btn, ic('sailboat') + (gain >= 1 ? GK.t('Auf große Fahrt gehen (+{n} {maps})', { n: gain, maps: GK.t(gain === 1 ? 'Schatzkarte' : 'Schatzkarten') }) : GK.t('Auf große Fahrt gehen')));
    GK.setText(document.getElementById('prestige-hint'), gain < 1
      ? GK.t('Verdiene insgesamt mehr Dublonen, um deine erste bzw. nächste Schatzkarte zu bekommen.')
      : blocker);

    const buffs = activeBuffs();
    GK.setHTML(document.getElementById('bonus-stats'), `
      <dt>${ic('map')}${GK.t('Schatzkarten')}</dt><dd>×${formatMult(prestigeMult())}</dd>
      <dt>${ic('trophy')}${GK.t('Erfolge ({n})', { n: s.achievements.length })}</dt><dd>×${formatMult(achievementMult())}</dd>
      ${fleetMult() > 1 ? `<dt>${ic('gem')}${GK.t('Schätze der Flotte')}</dt><dd>×${formatMult(fleetMult())}</dd>` : ''}
      ${buffs.map(b => `<dt>${ic(BUFFS[b.id].ic)}${GK.t(BUFFS[b.id].name)}</dt><dd>${buffEffect(b)} (${{ click: GK.t('Klicks'), income: GK.t('Einkommen'), luck: GK.t('Casino-Gewinne') }[b.type]})</dd>`).join('')}
      <dt>${GK.t('Gesamt-Bonus Einkommen')}</dt><dd>×${formatMult(permanentMult() * buffMult('income'))}</dd>
      <dt>${GK.t('Offline-Einnahmen')}</dt><dd>${GK.t('{pct} %, max. 8 Std.', { pct: OFFLINE_RATE * 100 })}</dd>`);
    if (GK.rank) GK.rank.render();
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
    addBuff,
    applyOfflineEarnings,
    pendingPoints,
    // für Tests
    _spawnGolden: spawnGolden,
  };
})();
