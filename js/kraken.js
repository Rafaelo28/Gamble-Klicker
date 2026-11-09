// Kraken-Angriff im Klicker: Ab und zu taucht ein Kraken auf und greift mit bis zu drei Armen nach Gebäuden.
// Er taucht immer wieder ab – nur Treffer, solange er oben ist, zählen. Jedes Drittel seiner Kraft lässt ein
// Arm sein Gebäude los; ist er ganz geschlagen, flieht er und lässt Beute zurück. Läuft die Zeit ab, zieht
// jeder Arm, der noch ein Gebäude hält, einen Teil dieser Gebäude in die Tiefe.
// Der laufende Angriff wird gespeichert und pausiert, solange man nicht im Klicker ist – Neuladen oder
// Weggehen hilft also nicht. In den Einstellungen lassen sich die Angriffe ausschalten.
window.GK = window.GK || {};

// Sprache: Ersatz, falls js/i18n.js (noch) nicht geladen ist – gibt den deutschen Text zurück.
GK.t = GK.t || function (s, v) { s = String(s); return v ? s.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m)) : s; };
GK.i18n = GK.i18n || { add() {}, addHtml() {}, apply() {}, set() {}, lang: 'de' };

GK.i18n.add({
  '🐙 Kraken-Angriffe sind wieder an – bleib wachsam!': '🐙 Kraken attacks are on again – stay alert!',
  '🐙 Keine Kraken-Angriffe mehr.': '🐙 No more kraken attacks.',
  ' Der laufende Angriff muss aber noch abgewehrt werden!': ' But the ongoing attack still has to be fought off!',
  'Gebäude': 'building',
  'Kraft des Kraken': 'Kraken’s power',
  'Zeit': 'Time',
  'Kraken treffen': 'Hit the kraken',
  'Kraken-Angriff! Triff ihn, wenn er auftaucht!': 'Kraken attack! Hit it when it surfaces!',
  'Kraken-Angriff!': 'Kraken attack!',
  'Triff ihn, solange er aufgetaucht ist – sonst klaut er Gebäude!': 'Hit it while it’s surfaced – or it will steal buildings!',
  'Daneben!': 'Missed!',
  '🌊 Abgetaucht!': '🌊 Submerged!',
  'Gerettet!': 'Saved!',
  'Jetzt! Triff ihn!': 'Now! Hit it!',
  'Abgetaucht – warte …': 'Submerged – wait …',
  'Kraken vertrieben!': 'Kraken driven off!',
  'Alle Gebäude gerettet – und er hat Beute zurückgelassen: +{amount}': 'All buildings saved – and it left loot behind: +{amount}',
  'Der Kraken ist abgetaucht …': 'The kraken has submerged …',
  'und hat {list} in die Tiefe gezogen.': 'and dragged {list} into the depths.',
  'Der Kraken ist abgetaucht.': 'The kraken has submerged.',
  'Zum Glück hat er nichts erwischt.': 'Luckily it caught nothing.',
});

(function () {
  // Eigenes Symbol (in Node-Tests ohne icons.js bleibt es leer)
  const ic = (name, cls) => (GK.icon ? GK.icon(name, cls) : '');
  const MIN_DELAY = 12 * 60;   // Sekunden aktiver Zeit im Klicker bis zum nächsten Angriff
  const MAX_DELAY = 22 * 60;
  const MIN_BUILDINGS = 15;    // erst ab so vielen Gebäuden lohnt sich ein Angriff
  const DURATION = 15;         // Sekunden für die Abwehr
  const HP = 30;               // so viele Treffer braucht es
  const ARMS = 3;
  const STEAL_SHARE = 0.1;     // jeder Arm nimmt 10 % der Gebäude seiner Sorte (mindestens eins)
  const UP = [1.5, 2.3];       // so lange bleibt er aufgetaucht (Sekunden)
  const DOWN = [0.55, 0.95];   // so lange ist er abgetaucht
  const LOOT_SECONDS = 300;    // Beute: so viele Sekunden Einkommen
  const LOOT_CLICKS = 100;     // … mindestens so viele Klicks

  let els = null;

  const k = () => GK.state.kraken;
  const between = ([lo, hi]) => lo + GK.rng.float() * (hi - lo);

  function enabled() {
    return GK.state.settings.kraken !== false;
  }

  // ---------- Logik (auch für Tests) ----------

  // Bis zu drei verschiedene Gebäudesorten, die der Kraken packt – häufige Sorten eher
  function pickArms() {
    const pool = GK.clicker.BUILDINGS.map(b => ({ id: b.id, n: GK.state.buildings[b.id] || 0 })).filter(b => b.n > 0);
    const arms = [];
    while (arms.length < ARMS && pool.length) {
      const total = pool.reduce((s, b) => s + Math.sqrt(b.n), 0);
      let roll = GK.rng.float() * total;
      let i = 0;
      while (i < pool.length - 1 && roll >= Math.sqrt(pool[i].n)) roll -= Math.sqrt(pool[i++].n);
      arms.push({ id: pool[i].id, held: true });
      pool.splice(i, 1);
    }
    return arms;
  }

  // Wie viele Arme bei dieser Restkraft schon losgelassen haben
  function releasedCount(hp, max, arms) {
    return Math.min(arms, Math.floor((max - hp) / (max / arms) + 1e-9));
  }

  function stealAmount(owned) {
    return owned > 0 ? Math.min(owned, Math.max(1, Math.ceil(owned * STEAL_SHARE))) : 0;
  }

  function scheduleNext() {
    k().clock = 0;
    k().next = Math.round(MIN_DELAY + GK.rng.float() * (MAX_DELAY - MIN_DELAY));
  }

  function begin() {
    const arms = pickArms();
    if (!arms.length) return false;
    k().attack = { hp: HP, max: HP, left: DURATION, arms, up: false, phase: 0.9, x: 0 };
    GK.save();
    return true;
  }

  // Ein Treffer (nur zählt, wenn er aufgetaucht ist). Gibt zurück, was passiert ist.
  function hit() {
    const a = k().attack;
    if (!a || a.left <= 0) return null;
    if (!a.up) return { missed: true };
    a.hp = Math.max(0, a.hp - 1);
    const before = a.arms.filter(arm => !arm.held).length;
    const count = releasedCount(a.hp, a.max, a.arms.length);
    a.arms.forEach((arm, i) => { if (i < count) arm.held = false; });
    const freed = a.arms.slice(before, count).map(arm => arm.id);
    if (a.hp <= 0) return Object.assign({ freed }, defeat());
    return { freed };
  }

  // Zeit läuft (nur, wenn man im Klicker ist): Auftauchen, Abtauchen, Ablauf
  function advance(dt) {
    const a = k().attack;
    if (!a) return null;
    a.left -= dt;
    a.phase -= dt;
    let changed = false;
    if (a.phase <= 0) {
      a.up = !a.up;
      a.phase = between(a.up ? UP : DOWN);
      if (a.up) a.x = Math.round((GK.rng.float() * 2 - 1) * 100) / 100;
      changed = true;
    }
    if (a.left <= 0) return escape();
    return changed ? { moved: true } : null;
  }

  function defeat() {
    const loot = Math.floor(Math.max(GK.clicker.getCpsPermanent() * LOOT_SECONDS, GK.clicker.getClickPower() * LOOT_CLICKS));
    GK.earn(loot, 'passive');
    k().attack = null;
    k().defeated++;
    scheduleNext();
    GK.save();
    return { defeated: true, loot };
  }

  function escape() {
    const a = k().attack;
    const stolen = a.arms.filter(arm => arm.held).map(arm => {
      const n = stealAmount(GK.state.buildings[arm.id] || 0);
      GK.state.buildings[arm.id] = (GK.state.buildings[arm.id] || 0) - n;
      return { id: arm.id, n };
    }).filter(x => x.n > 0);
    const total = stolen.reduce((s, x) => s + x.n, 0);
    k().attack = null;
    k().escaped++;
    k().stolen += total;
    scheduleNext();
    GK.save();
    return { escaped: true, stolen, total };
  }

  // Aus der Spielschleife: aktive Zeit im Klicker zählen, Angriff starten und weiterlaufen lassen
  function update(dt) {
    const inClicker = GK.state.ui.tab === 'clicker' && document.visibilityState === 'visible';
    if (!k().attack) {
      if (!enabled() || !inClicker || GK.clicker.totalBuildings() < MIN_BUILDINGS) return;
      if (!k().next) scheduleNext();
      k().clock += dt;
      if (k().clock >= k().next && begin()) show(true);
      return;
    }
    if (!inClicker) return;   // Pause, bis man zurück ist
    if (!els) show(false);
    const res = advance(Math.min(dt, 0.25));
    if (res && res.escaped) onEscape(res);
    else render();
  }

  function setEnabled(on) {
    GK.state.settings.kraken = on;
    if (on) scheduleNext();
    GK.save();
    GK.toast(on ? GK.t('🐙 Kraken-Angriffe sind wieder an – bleib wachsam!')
      : GK.t('🐙 Keine Kraken-Angriffe mehr.') + (k().attack ? GK.t(' Der laufende Angriff muss aber noch abgewehrt werden!') : ''));
  }

  // ---------- Darstellung ----------

  const building = id => GK.clicker.BUILDINGS.find(b => b.id === id) || { icon: '🏠', name: 'Gebäude' };
  const buildingName = id => GK.t(building(id).name);

  function show(fresh) {
    const stage = document.querySelector('.coin-stage');
    if (!stage || !k().attack) return;
    if (els) els.root.remove();
    const a = k().attack;
    const root = document.createElement('div');
    root.className = 'kraken-attack';
    root.innerHTML = `
      <div class="kr-bars">
        <div class="kr-bar kr-hp" aria-label="${GK.t('Kraft des Kraken')}"><span></span><b></b></div>
        <div class="kr-bar kr-time" aria-label="${GK.t('Zeit')}"><span></span><b></b></div>
      </div>
      <div class="kr-msg">${ic('kraken')} ${GK.t('Kraken-Angriff! Triff ihn, wenn er auftaucht!')}</div>
      ${a.arms.map((arm, i) => `<div class="kr-arm arm-${i}${arm.held ? '' : ' free'}"><span class="kr-loot">${building(arm.id).icon}</span></div>`).join('')}
      <button type="button" class="kr-body" aria-label="${GK.t('Kraken treffen')}"><span>🐙</span></button>
      <div class="kr-sea"></div>`;
    stage.appendChild(root);
    els = {
      root,
      body: root.querySelector('.kr-body'),
      hp: root.querySelector('.kr-hp span'),
      hpText: root.querySelector('.kr-hp b'),
      time: root.querySelector('.kr-time span'),
      timeText: root.querySelector('.kr-time b'),
      msg: root.querySelector('.kr-msg'),
      arms: [...root.querySelectorAll('.kr-arm')],
    };
    // Treffer per Fingertipp (sofort, auch mit mehreren Fingern) – überall auf dem Wasser zählt nur der Kraken
    root.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      e.preventDefault();
      onTap(e, !!e.target.closest('.kr-body'));
    });
    if (fresh) {
      GK.sound.play('horn');
      GK.fx.shake('small');
      GK.notify(`<span class="notify-icon">${ic('kraken')}</span><span><b>${GK.t('Kraken-Angriff!')}</b><br>${GK.t('Triff ihn, solange er aufgetaucht ist – sonst klaut er Gebäude!')}</span>`);
    }
    render();
  }

  function onTap(e, onBody) {
    const a = k().attack;
    if (!a) return;
    const pos = { x: e.clientX, y: e.clientY };
    if (!onBody || !a.up) {
      GK.fx.floatText(pos.x, pos.y, a.up ? GK.t('Daneben!') : GK.t('🌊 Abgetaucht!'), '');
      return;
    }
    const res = hit();
    if (!res) return;
    GK.sound.play('plink', 0.8 + Math.random() * 0.4);
    GK.fx.burst(pos.x, pos.y, { count: 6, kind: 'sparkle', speed: 260 });
    els.body.classList.remove('hit');
    void els.body.offsetWidth; // Animation neu starten
    els.body.classList.add('hit');
    res.freed.forEach(id => {
      GK.sound.play('collect');
      const arm = els.arms[a.arms.findIndex(x => x.id === id)];
      if (arm) {
        const c = GK.fx.center(arm.querySelector('.kr-loot'));
        GK.fx.floatText(c.x, c.y, `${building(id).icon} ${GK.t('Gerettet!')}`, 'win');
      }
    });
    if (res.defeated) onDefeat(res, pos);
    else render();
  }

  function render() {
    const a = k().attack;
    if (!els || !a) return;
    els.hp.style.width = `${(a.hp / a.max) * 100}%`;
    GK.setHTML(els.hpText, `${ic('kraken')} ${a.hp}`);
    els.time.style.width = `${Math.max(0, a.left / DURATION) * 100}%`;
    GK.setHTML(els.timeText, `${ic('hourglass')} ${Math.max(0, Math.ceil(a.left))} s`);
    els.body.classList.toggle('down', !a.up);
    els.body.style.setProperty('--kr-x', `${a.x * 60}px`);
    els.arms.forEach((el, i) => el.classList.toggle('free', !a.arms[i].held));
    GK.setHTML(els.msg, a.up ? `${ic('target')} ${GK.t('Jetzt! Triff ihn!')}` : `${ic('wave')} ${GK.t('Abgetaucht – warte …')}`);
    els.root.classList.toggle('urgent', a.left <= 5);
  }

  function close(cls, delay) {
    if (!els) return;
    const root = els.root;
    els = null;
    root.classList.add(cls);
    setTimeout(() => root.remove(), delay);
  }

  function onDefeat(res, pos) {
    els.hp.style.width = '0%';
    close('fled', 1200);
    GK.sound.play('jackpot');
    GK.fx.burst(pos.x, pos.y, { count: 30, speed: 700 });
    GK.fx.floatText(pos.x, pos.y - 30, `+${GK.formatNumber(res.loot)}`, 'win big');
    GK.notify(`<span class="notify-icon">${ic('kraken')}</span><span><b>${GK.t('Kraken vertrieben!')}</b><br>${GK.t('Alle Gebäude gerettet – und er hat Beute zurückgelassen: +{amount}', { amount: GK.formatMoneyHTML(res.loot) })}</span>`, 7000);
  }

  function onEscape(res) {
    close('escaped', 1400);
    GK.sound.play('lose');
    GK.fx.shake('small');
    if (res.total) {
      const list = res.stolen.map(x => `${x.n}× ${building(x.id).icon} ${buildingName(x.id)}`).join(', ');
      GK.notify(`<span class="notify-icon">${ic('kraken')}</span><span><b>${GK.t('Der Kraken ist abgetaucht …')}</b><br>${GK.t('und hat {list} in die Tiefe gezogen.', { list })}</span>`, 8000);
    } else {
      GK.notify(`<span class="notify-icon">${ic('kraken')}</span><span><b>${GK.t('Der Kraken ist abgetaucht.')}</b><br>${GK.t('Zum Glück hat er nichts erwischt.')}</span>`);
    }
    GK.clicker.render();
  }

  GK.kraken = {
    update, setEnabled,
    // für Tests
    DURATION, HP, pickArms, releasedCount, stealAmount, begin, hit, advance,
    _start: () => begin() && show(true),
  };
})();
