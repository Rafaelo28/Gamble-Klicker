// Bosskämpfe (Tab „⚓ Abenteuer“): Stufe für Stufe stärkere Seeungeheuer – ohne Ende. Man hat je Boss 30 Sekunden:
// jeder Tipp trifft mit der Klickkraft, die Kanonen der eigenen Flotte feuern jede Sekunde mit. Ist ein Boss besiegt,
// kommt sofort der nächste. Jede neue Stufe bringt Dublonen, jede zehnte eine Trophäe (+5 % Klickkraft für immer).
// Der Kampf selbst wird nicht gespeichert: Neuladen beendet ihn ohne Verlust (es gibt keinen Einsatz).
window.GK = window.GK || {};

// Sprache: Ersatz, falls js/i18n.js (noch) nicht geladen ist – gibt den deutschen Text zurück.
GK.t = GK.t || function (s, v) { s = String(s); return v ? s.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m)) : s; };
GK.i18n = GK.i18n || { add() {}, addHtml() {}, apply() {}, set() {}, lang: 'de' };

GK.i18n.add({
  'Riesenkrabbe': 'Giant Crab',
  'Hai-Kapitän': 'Shark Captain',
  'Geisterpirat': 'Ghost Pirate',
  'Seeschlange': 'Sea Serpent',
  'Riesenkalmar': 'Giant Squid',
  'Skelett-Admiral': 'Skeleton Admiral',
  'Weißer Wal': 'White Whale',
  'Sturmgeist': 'Storm Spirit',
  'Meerhexe': 'Sea Witch',
  'Kraken-König': 'Kraken King',
  'Seedrache': 'Sea Dragon',
  '{name} besiegt!': '{name} defeated!',
  '🏆 Trophäe: Klickkraft jetzt dauerhaft ×{mult} · +{money}': '🏆 Trophy: click power now permanently ×{mult} · +{money}',
  '⚔️ {n} {ding} besiegt! Der nächste ist entkommen.': '⚔️ {n} {ding} defeated! The next one got away.',
  'Boss': 'boss',
  'Bosse': 'bosses',
  '💨 Der {name} ist entkommen – stärker werden und nochmal versuchen!': '💨 The {name} got away – get stronger and try again!',
  'Stufe {n}: {name}': 'Level {n}: {name}',
  'Großer Boss': 'Big Boss',
  'Lebenspunkte: {hp} · dein Tipp: {tap} · Kanonen: {cannon} pro Sek.': 'Health: {hp} · your tap: {tap} · cannons: {cannon} per sec.',
  'Belohnung: {amount}': 'Reward: {amount}',
  'Trophäe (+5 % Klickkraft für immer)': 'Trophy (+5 % click power forever)',
  'Kampf beginnen': 'Start fight',
  'Höchste Stufe': 'Highest level',
  'Trophäen': 'Trophies',
  'Klickkraft ×{mult}': 'click power ×{mult}',
  'Stufe {level}': 'Level {level}',
  'Kampf beenden': 'End fight',
  '{hp} von {max}': '{hp} of {max}',
  'Besiegt: {won} · Beute: {loot} · Kanonen: {cannon} pro Sek.': 'Defeated: {won} · Loot: {loot} · Cannons: {cannon} per sec.',
  '⚔️ Kampf beendet: {n} {ding} besiegt.': '⚔️ Fight ended: {n} {ding} defeated.',
  'Kampf beendet.': 'Fight ended.',
  'Boss angreifen': 'Attack boss',
});

(function () {
  // Eigenes Symbol (js/icons.js); in den Tests ohne Browser gibt es keins
  const ic = name => (GK.icon ? GK.icon(name) : '');

  const FIGHT_SECONDS = 30;
  const HP_BASE = 20;
  const HP_GROWTH = 1.55;
  const BIG_EVERY = 10;      // jede zehnte Stufe: großer Boss mit Trophäe
  const BIG_HP = 3;
  const TROPHY_CLICK = 0.05; // +5 % Klickkraft je Trophäe
  const REWARD_SECONDS = 60; // Belohnung je neuer Stufe: so viele Sekunden Einkommen …
  const BIG_REWARD_SECONDS = 600; // … beim großen Boss
  const CANNON_PER_HOLD = 0.5;    // Kanonen: je Laderaum-Einheit ein halber Tipp pro Sekunde
  const MAX_TAPS_PER_SECOND = 20;

  const MONSTERS = [
    { icon: '🦀', name: 'Riesenkrabbe' },
    { icon: '🦈', name: 'Hai-Kapitän' },
    { icon: '👻', name: 'Geisterpirat' },
    { icon: '🐍', name: 'Seeschlange' },
    { icon: '🦑', name: 'Riesenkalmar' },
    { icon: '💀', name: 'Skelett-Admiral' },
    { icon: '🐋', name: 'Weißer Wal' },
    { icon: '🌪️', name: 'Sturmgeist' },
    { icon: '🧜', name: 'Meerhexe' },
  ];
  const BIG = [
    { icon: '🐙', name: 'Kraken-König' },
    { icon: '🐉', name: 'Seedrache' },
  ];

  let now = () => Date.now(); // für Tests austauschbar
  let fight = null;           // laufender Kampf (nur im Speicher)

  const data = () => GK.state.boss;
  const best = () => data().level;              // höchste besiegte Stufe
  const isBig = level => level % BIG_EVERY === 0;
  const trophies = () => Math.floor(best() / BIG_EVERY);

  function monster(level) {
    if (isBig(level)) return BIG[(level / BIG_EVERY - 1) % BIG.length];
    return MONSTERS[(level - 1 - Math.floor(level / BIG_EVERY)) % MONSTERS.length];
  }

  // Lebenspunkte einer Stufe (Riesenzahlen bleiben endlich, bis 10^308)
  function hp(level) {
    return Math.ceil(HP_BASE * Math.pow(HP_GROWTH, level - 1) * (isBig(level) ? BIG_HP : 1));
  }

  // Dauerhafter Klickkraft-Bonus aus Trophäen (fließt in GK.clicker.getClickPower ein)
  const clickMult = () => 1 + trophies() * TROPHY_CLICK;

  const tapDamage = () => (GK.clicker ? GK.clicker.getClickPower() : 1);

  // Kanonen der Flotte: Schaden pro Sekunde (Laderaum aller Schiffe × halber Tipp)
  function cannonDps() {
    if (!GK.fleet) return 0;
    const hold = GK.fleet.SHIPS.reduce((sum, x) => sum + (GK.fleet.owns(x.id) ? GK.fleet.holdOf(x.id) : 0), 0);
    return tapDamage() * hold * CANNON_PER_HOLD;
  }

  function reward(level) {
    const income = GK.fleet ? GK.fleet.income() : Math.max(1, GK.clicker.getCpsPermanent());
    return Math.floor(income * (isBig(level) ? BIG_REWARD_SECONDS : REWARD_SECONDS));
  }

  // ---------- Kampf ----------

  function newBoss() {
    const level = best() + 1;
    fight.level = level;
    fight.max = hp(level);
    fight.hp = fight.max;
    fight.end = now() + FIGHT_SECONDS * 1000;
    fight.cannonAt = now() + 1000;
  }

  function start() {
    if (fight) return false;
    fight = { won: 0, earned: 0, taps: 0, tapSecond: 0, tapCount: 0, dps: cannonDps(), damage: tapDamage() };
    newBoss();
    data().fights++;
    GK.save();
    GK.sound.play('horn');
    return true;
  }

  // Treffer (Tipp oder Kanone). Gibt den Schaden zurück.
  function hit(amount) {
    if (!fight || !(amount > 0)) return 0;
    fight.hp -= amount;
    if (fight.hp <= 0) defeat();
    return amount;
  }

  function tap() {
    if (!fight) return 0;
    // Mehr als 20 Tipps pro Sekunde zählen nicht (kein Dauerfeuer per Programm)
    const second = Math.floor(now() / 1000);
    if (second !== fight.tapSecond) {
      fight.tapSecond = second;
      fight.tapCount = 0;
    }
    if (++fight.tapCount > MAX_TAPS_PER_SECOND) return 0;
    fight.taps++;
    // Klickkraft wird jedes Mal neu bestimmt: Klickfieber hilft auch mitten im Kampf
    return hit(tapDamage());
  }

  function defeat() {
    const d = data();
    const level = fight.level;
    const money = reward(level);
    d.level = level;
    d.kills++;
    GK.earn(money, 'boss');
    fight.won++;
    fight.earned += money;
    fight.lastWin = { level, money, big: isBig(level) };
    GK.save();
    if (isBig(level)) {
      GK.sound.play('jackpot');
      if (GK.fx) GK.fx.confetti(120);
      GK.notify(`<span class="notify-icon">${GK.icon ? ic('swords') : monster(level).icon}</span><span><b>${GK.t('{name} besiegt!', { name: GK.t(monster(level).name) })}</b><br>${GK.t('🏆 Trophäe: Klickkraft jetzt dauerhaft ×{mult} · +{money}', { mult: GK.formatDecimal(clickMult(), 0, 2), money: GK.formatMoneyHTML(money) })}</span>`);
    } else {
      GK.sound.play('winBig');
    }
    newBoss();
  }

  // Kampf beenden (Zeit um oder aufgegeben)
  function stop() {
    if (!fight) return null;
    const result = { won: fight.won, earned: fight.earned, level: fight.level };
    fight = null;
    return result;
  }

  // Im Takt: Kanonen feuern, Zeit abgelaufen?
  function step() {
    if (!fight) return null;
    while (fight && now() >= fight.cannonAt && now() < fight.end) {
      fight.cannonAt += 1000;
      if (fight.dps > 0) {
        hit(fight.dps);
        fight.cannonShot = (fight.cannonShot || 0) + 1;
      }
    }
    if (fight && now() >= fight.end) {
      const r = stop();
      GK.sound.play(r.won ? 'collect' : 'lose');
      GK.toast(r.won
        ? GK.t('⚔️ {n} {ding} besiegt! Der nächste ist entkommen.', { n: r.won, ding: GK.t(r.won === 1 ? 'Boss' : 'Bosse') })
        : GK.t('💨 Der {name} ist entkommen – stärker werden und nochmal versuchen!', { name: GK.t(monster(r.level).name) }));
      return r;
    }
    return null;
  }

  // ---------- Anzeige ----------

  const $ = id => document.getElementById(id);
  let lastIdle = '';
  let lastFloat = 0;
  let lastShot = 0;

  function idleHtml() {
    const level = best() + 1;
    const m = monster(level);
    return `<div class="boss-idle">
      <div class="boss-preview">${m.icon}</div>
      <div>
        <div class="boss-title">${GK.t('Stufe {n}: {name}', { n: GK.formatNumber(level), name: GK.t(m.name) })}${isBig(level) ? ` <span class="boss-big">${GK.t('Großer Boss')}</span>` : ''}</div>
        <div class="muted small">${GK.t('Lebenspunkte: {hp} · dein Tipp: {tap} · Kanonen: {cannon} pro Sek.', { hp: GK.formatNumber(hp(level)), tap: GK.formatNumber(tapDamage()), cannon: GK.formatNumber(cannonDps()) })}</div>
        <div class="muted small">${GK.t('Belohnung: {amount}', { amount: GK.formatMoneyHTML(reward(level)) })}${isBig(level) ? ` + ${ic('trophy')} ${GK.t('Trophäe (+5 % Klickkraft für immer)')}` : ''}</div>
      </div>
      <button type="button" class="btn btn-primary btn-big boss-start">${ic('swords')}${GK.t('Kampf beginnen')}</button>
    </div>
    <dl class="stats-list compact boss-stats">
      <dt>${GK.t('Höchste Stufe')}</dt><dd>${GK.formatNumber(best())}</dd>
      <dt>${ic('trophy')}${GK.t('Trophäen')}</dt><dd>${GK.formatNumber(trophies())} · ${GK.t('Klickkraft ×{mult}', { mult: GK.formatDecimal(clickMult(), 0, 2) })}</dd>
    </dl>
    ${GK.figure ? `<div class="rank-rewards">${GK.figure.bossParts().map(x => `<span class="rank-reward ${best() >= x.level ? 'done' : ''}" title="${x.slot}">
      ${best() >= x.level ? ic('check') : ic('lock')} ${GK.t(x.name)} <span class="muted">· ${GK.t('Stufe {level}', { level: x.level })}</span></span>`).join('')}</div>` : ''}`;
  }

  function fightHtml() {
    return `<div class="boss-fight">
      <div class="boss-head"><span class="boss-name"></span><span class="boss-timer"></span></div>
      <div class="boss-hpbar"><div></div></div>
      <div class="boss-hptext muted small"></div>
      <button type="button" class="boss-target" aria-label="${GK.t('Boss angreifen')}"><span class="boss-icon"></span></button>
      <div class="boss-timebar"><div></div></div>
      <div class="boss-info muted small"></div>
      <button type="button" class="btn btn-small boss-stop">${ic('flag')}${GK.t('Kampf beenden')}</button>
    </div>`;
  }

  function bind(box) {
    box._bound = true;
    // Tipp auf den Boss: pointerdown für schnelle Reaktion (auch mehrere Finger)
    box.addEventListener('pointerdown', e => {
      const target = e.target.closest('.boss-target');
      if (!target || !fight) return;
      e.preventDefault();
      const dmg = tap();
      if (!dmg) return;
      GK.fx.pulse(target.querySelector('.boss-icon'), 'boss-hit');
      if (now() - lastFloat > 90) {
        lastFloat = now();
        GK.fx.floatText(e.clientX, e.clientY - 10, `−${GK.formatNumber(dmg)}`, 'boss-dmg');
      }
      if (GK.sound) GK.sound.play('click');
      render();
    });
    box.addEventListener('click', e => {
      if (e.target.closest('.boss-start')) {
        if (start()) render(true);
      } else if (e.target.closest('.boss-stop') && fight) {
        const r = stop();
        GK.toast(r.won ? GK.t('⚔️ Kampf beendet: {n} {ding} besiegt.', { n: r.won, ding: GK.t(r.won === 1 ? 'Boss' : 'Bosse') }) : GK.t('Kampf beendet.'));
        render(true);
      }
    });
  }

  function render(force) {
    const box = $('boss-arena');
    if (!box) return;
    if (!box._bound) bind(box);
    if (!fight) {
      const html = idleHtml();
      if (force || html !== lastIdle || !box.querySelector('.boss-idle')) {
        lastIdle = html;
        box.innerHTML = html;
      }
      return;
    }
    if (!box.querySelector('.boss-fight')) {
      box.innerHTML = fightHtml();
      lastIdle = '';
    }
    const m = monster(fight.level);
    GK.setHTML(box.querySelector('.boss-name'), `${GK.t('Stufe {n}: {name}', { n: GK.formatNumber(fight.level), name: GK.t(m.name) })}${isBig(fight.level) ? ` <span class="boss-big">${GK.t('Großer Boss')}</span>` : ''}`);
    GK.setText(box.querySelector('.boss-icon'), m.icon);
    const left = Math.max(0, (fight.end - now()) / 1000);
    GK.setHTML(box.querySelector('.boss-timer'), `${ic('hourglass')} ${Math.ceil(left)} s`);
    box.querySelector('.boss-hpbar > div').style.transform = `scaleX(${Math.max(0, fight.hp / fight.max).toFixed(4)})`;
    box.querySelector('.boss-timebar > div').style.transform = `scaleX(${(left / FIGHT_SECONDS).toFixed(3)})`;
    GK.setHTML(box.querySelector('.boss-hptext'), `${ic('heart')} ${GK.t('{hp} von {max}', { hp: GK.formatNumber(Math.max(0, Math.ceil(fight.hp))), max: GK.formatNumber(fight.max) })}`);
    GK.setHTML(box.querySelector('.boss-info'), GK.t('Besiegt: {won} · Beute: {loot} · Kanonen: {cannon} pro Sek.', { won: fight.won, loot: GK.formatMoneyHTML(fight.earned), cannon: GK.formatNumber(fight.dps) }));
    // Kanonenschuss sichtbar machen
    if (fight.cannonShot && fight.cannonShot !== lastShot) {
      lastShot = fight.cannonShot;
      const t = box.querySelector('.boss-target');
      if (t && GK.fx) {
        const r = t.getBoundingClientRect();
        GK.fx.floatText(r.left + r.width * 0.2, r.top + r.height * 0.6, `💥 −${GK.formatNumber(fight.dps)}`, 'boss-dmg cannon');
      }
    }
  }

  function update(visible) {
    if (fight) step();
    if (visible) render();
  }

  GK.boss = {
    FIGHT_SECONDS, MONSTERS, BIG, MAX_TAPS_PER_SECOND,
    hp, monster, isBig, reward, clickMult, trophies, best, cannonDps, tapDamage,
    start, tap, step, stop, update, render,
    current: () => fight,
    _setNow(fn) { now = fn; },
  };
})();
