// Chicken Road: Ein Huhn überquert Spur für Spur eine stark befahrene Straße (von oben gesehen).
// Jeder geschaffte Schritt erhöht den Multiplikator, nach jeweils fünf Spuren wartet eine sichere
// Verkehrsinsel mit Schutzwand, danach wird der Verkehr schneller. Auszahlen geht nach jedem geschafften
// Schritt – erwischt ein Auto das Huhn, ist der Einsatz weg. Nach 20 Spuren ist das Huhn im Ziel.
// Vier Schwierigkeitsgrade: schnellerer und dichterer Verkehr, dafür steigt der Multiplikator schneller.
// Ob ein Schritt gelingt, wird beim Tippen ausgelost und sofort gespeichert (Neuladen kostet keinen
// Einsatz und zahlt nichts doppelt). Danach wird der Verkehr so gelenkt, dass die Autos das Ergebnis
// zeigen: bei einem sicheren Schritt halten sie vor dem Huhn an, sonst kommt eines ungebremst angerast.
window.GK = window.GK || {};

(function () {
  const MIN_BET = 10;
  const RTP = 0.97;
  const SECTIONS = 4;
  const LANES_PER_SECTION = 5;
  const LANES = SECTIONS * LANES_PER_SECTION;

  // Schwierigkeitsgrade: Chance, eine Spur zu schaffen (je Abschnitt), Tempo (Pixel/s) und
  // Abstand der Autos (Sekunden). In späteren Abschnitten fahren die Autos zusätzlich schneller.
  const DIFFICULTIES = {
    easy:   { name: 'Leicht',   icon: '🐣', survive: [0.92, 0.90, 0.88, 0.86], speed: [170, 250], gap: [1.2, 2.3] },
    normal: { name: 'Normal',   icon: '🐔', survive: [0.85, 0.82, 0.79, 0.76], speed: [210, 320], gap: [0.95, 1.8] },
    hard:   { name: 'Schwer',   icon: '🔥', survive: [0.75, 0.71, 0.67, 0.63], speed: [270, 410], gap: [0.75, 1.45] },
    insane: { name: 'Wahnsinn', icon: '💀', survive: [0.62, 0.57, 0.52, 0.47], speed: [350, 540], gap: [0.55, 1.15] },
  };

  // ---------- Mathematik (auch für Tests) ----------

  const sectionOf = lane => Math.floor((lane - 1) / LANES_PER_SECTION);

  // Chance, Spur `lane` (1–20) zu schaffen
  function surviveChance(diff, lane) {
    return DIFFICULTIES[diff].survive[sectionOf(lane)];
  }

  // Chance, die ersten `steps` Spuren alle zu schaffen
  function survival(diff, steps) {
    let s = 1;
    for (let lane = 1; lane <= steps; lane++) s *= surviveChance(diff, lane);
    return s;
  }

  // Zentrale Berechnung: Multiplikator nach `steps` geschafften Schritten (auf Hundertstel abgerundet).
  // So fließen im Schnitt 97 % zurück – egal, wann man auszahlt.
  function multiplierAt(diff, steps) {
    if (steps <= 0) return 1;
    return Math.floor(RTP / survival(diff, steps) * 100 + 1e-9) / 100;
  }

  function rtp(diff, steps) {
    return survival(diff, steps) * multiplierAt(diff, steps);
  }

  // Gelingt der nächste Schritt?
  function rollStep(diff, steps) {
    return GK.rng.float() < surviveChance(diff, steps + 1);
  }

  // ---------- Straße: Spalten von links nach rechts ----------

  const START_W = 170;
  const LANE_W = 110;
  const ISLAND_W = 130;
  const GOAL_W = 210;

  function buildLayout() {
    const cols = [];
    let x = 0;
    const add = (kind, w, extra) => {
      cols.push(Object.assign({ kind, x, w, center: x + w / 2 }, extra));
      x += w;
    };
    add('start', START_W);
    for (let lane = 1; lane <= LANES; lane++) {
      add('lane', LANE_W, { lane, dir: lane % 2 ? 1 : -1 });
      if (lane % LANES_PER_SECTION === 0 && lane < LANES) add('island', ISLAND_W, { section: lane / LANES_PER_SECTION });
    }
    add('goal', GOAL_W);
    return { cols, width: x };
  }
  const LAYOUT = buildLayout();
  const COLS = LAYOUT.cols;
  const laneCol = lane => COLS.findIndex(c => c.lane === lane);

  // Wo das Huhn nach `steps` geschafften Schritten steht (nach jedem Abschnitt auf der Insel)
  function restCol(steps) {
    if (steps <= 0) return 0;
    if (steps >= LANES) return COLS.length - 1;
    const col = laneCol(steps);
    return steps % LANES_PER_SECTION === 0 ? col + 1 : col;
  }

  // ---------- Verkehr (reine Logik, auch für Tests) ----------

  const W = 900;               // sichtbarer Ausschnitt
  const H = 520;               // Länge der Spuren
  const MID = H / 2;           // hier steht das Huhn
  const ZONE = 28;             // halbe Größe des Bereichs, der fürs Huhn frei bleiben muss
  const STOP = MID - ZONE - 52; // Haltelinie: so weit dürfen Autos vor einem Huhn heranfahren
  const ACC = 420;             // Beschleunigung (Pixel/s²)
  const DECEL = 1500;          // stärkstes Bremsen
  const MIN_GAP = 16;          // Abstand zum Vordermann
  const MAX_SPEED = 1100;
  const HOP = 0.42;            // Dauer eines Sprungs (s)
  const ENTER = 0.3;           // ab diesem Anteil des Sprungs ist das Huhn in der neuen Spur
  const HIT_DELAY = 0.22;      // so lange nach der Landung kommt das Auto, das das Huhn erwischt
  const CHICKEN_R = 21;        // halbe Größe des Huhns für die Kollision

  const CAR_TYPES = [
    { type: 'car',   len: 70,  w: 40, weight: 44 },
    { type: 'taxi',  len: 72,  w: 40, weight: 12 },
    { type: 'sport', len: 66,  w: 38, weight: 12 },
    { type: 'van',   len: 88,  w: 44, weight: 18 },
    { type: 'truck', len: 136, w: 48, weight: 14 },
  ];
  const CAR_COLORS = ['#e53935', '#1e88e5', '#43a047', '#8e24aa', '#fb8c00', '#00897b', '#546e7a', '#d81b60', '#3949ab'];
  const TRUCK_COLORS = ['#c62828', '#1565c0', '#2e7d32', '#6a1b9a', '#ef6c00'];

  function pickCarType(rand) {
    let roll = rand() * CAR_TYPES.reduce((s, t) => s + t.weight, 0);
    for (const t of CAR_TYPES) {
      if (roll < t.weight) return t;
      roll -= t.weight;
    }
    return CAR_TYPES[0];
  }

  // s = Position der Fahrzeugfront entlang der Fahrtrichtung (0 = Rand, an dem die Autos hereinkommen)
  function makeCar(L, rand, typeName) {
    const t = typeName ? CAR_TYPES.find(x => x.type === typeName) : pickCarType(rand);
    const base = L.speed[0] + rand() * (L.speed[1] - L.speed[0]);
    const v0 = base * (t.type === 'truck' ? 0.85 : t.type === 'sport' ? 1.15 : 1);
    return {
      s: 0, len: t.len, w: t.w, type: t.type, v: v0, v0, braking: false, committed: false, killer: false,
      color: t.type === 'truck' ? TRUCK_COLORS[Math.floor(rand() * TRUCK_COLORS.length)]
        : t.type === 'taxi' ? '#ffcf33' : t.type === 'van' ? '#eceff1' : t.type === 'sport' ? '#ff3d00'
        : CAR_COLORS[Math.floor(rand() * CAR_COLORS.length)],
    };
  }

  function createWorld(diff, stopLane = 0, rand = Math.random) {
    const d = DIFFICULTIES[diff];
    const lanes = COLS.filter(c => c.kind === 'lane').map(c => {
      const boost = 1 + 0.1 * sectionOf(c.lane);
      return {
        lane: c.lane, dir: c.dir, cars: [], timer: rand() * 1.5, stop: c.lane === stopLane, barrierAt: c.lane === stopLane ? -10 : null,
        speed: d.speed.map(v => v * boost), gap: d.gap,
      };
    });
    const world = { diff, lanes, time: 0, rand };
    // Der Verkehr läuft schon eine Weile, bevor das Huhn losgeht
    for (let i = 0; i < 80; i++) updateWorld(world, 0.1);
    world.time = 0;
    return world;
  }

  function updateLane(L, dt, rand) {
    // Neue Autos am Rand
    L.timer -= dt;
    const last = L.cars[L.cars.length - 1];
    if (L.timer <= 0 && (!last || last.s - last.len > MIN_GAP + 10)) {
      const car = makeCar(L, rand);
      if (last) car.v = Math.min(car.v, last.v + 40);
      L.cars.push(car);
      L.timer = L.gap[0] + rand() * (L.gap[1] - L.gap[0]);
    }
    // Fahren: Abstand zum Vordermann halten und (wenn ein Huhn dasteht) vor der Haltelinie bremsen
    L.cars.forEach((c, i) => {
      let limit = Infinity;
      if (!c.killer) {
        const ahead = L.cars[i - 1];
        if (ahead) limit = ahead.s - ahead.len - MIN_GAP - c.s;
        if (L.stop && !c.committed && c.s <= STOP + 0.5) limit = Math.min(limit, STOP - c.s);
      }
      const target = Math.min(c.v0, Math.sqrt(2 * DECEL * Math.max(0, limit)));
      c.braking = target < c.v - 1;
      c.v = target < c.v ? target : Math.min(target, c.v + ACC * dt);
      c.s += Math.min(c.v * dt, Math.max(0, limit));
    });
    L.cars = L.cars.filter(c => c.s - c.len < H + 40);
  }

  function updateWorld(world, dt) {
    world.time += dt;
    world.lanes.forEach(L => updateLane(L, dt, world.rand));
  }

  // Den nächsten Schritt im Verkehr vorbereiten. Gibt zurück, wie lange das Huhn noch wartet, bevor es
  // springt (Autos, die nicht mehr bremsen können, fahren erst durch), und wann es erwischt wird.
  function planStep(world, laneNo, safe) {
    const L = world.lanes[laneNo - 1];
    let wait = 0.08;
    // Ein Auto fährt höchstens so schnell wie die Autos vor ihm (vorsichtig gerechnet)
    let slowest = Infinity;
    const slowestAhead = new Map();
    L.cars.forEach(c => {
      slowest = Math.min(slowest, Math.max(c.v, 1));
      slowestAhead.set(c, slowest);
    });
    const passFirst = c => {
      c.committed = true;
      const clear = (MID + ZONE + c.len - c.s) / slowestAhead.get(c);
      wait = Math.max(wait, clear - HOP * ENTER + 0.06);
    };
    L.cars.forEach(c => {
      c.committed = false;
      c.killer = false;
      if (c.s - c.len >= MID + ZONE) return;            // schon am Huhn vorbei
      if (c.s > STOP - c.v * c.v / (2 * DECEL) - 2) passFirst(c);
    });
    if (safe) {
      L.stop = true;
      return { wait, hitAt: null };
    }
    L.stop = false;
    // Erwischt: das nächste Auto fährt ungebremst durch, kurz nachdem das Huhn gelandet ist
    for (;;) {
      const hitAt = wait + HOP + HIT_DELAY;
      const car = L.cars.find(c => !c.committed && c.s - c.len < MID + ZONE);
      if (!car) {
        // Kein Auto in Sicht: eines kommt angerast (mit Abstand hinter dem letzten Auto)
        const fresh = makeCar(L, world.rand, hitAt < 0.9 ? 'sport' : null);
        const last = L.cars[L.cars.length - 1];
        fresh.s = Math.min(0, last ? last.s - last.len - MIN_GAP : 0);
        const dist = MID - ZONE - fresh.s;
        fresh.v = fresh.v0 = Math.min(MAX_SPEED, dist / hitAt);
        fresh.killer = true;
        L.cars.push(fresh);
        return { wait: dist / fresh.v - HOP - HIT_DELAY, hitAt: dist / fresh.v };
      }
      const dist = MID - ZONE - car.s;
      const need = dist / hitAt;
      if (need < car.v * 0.45) {
        // Zu nah, um erst nach der Landung anzukommen: fährt vorher durch, das nächste Auto ist dran
        passFirst(car);
        continue;
      }
      const speed = Math.min(need, MAX_SPEED, Math.max(car.v0, car.v) * 2.6);
      car.killer = true;
      car.v = car.v0 = speed;
      return { wait: dist / speed - HOP - HIT_DELAY, hitAt: dist / speed };
    }
  }

  // Liegen Huhn (Mittelpunkt x/y in Straßen-Koordinaten) und ein Auto übereinander?
  function carRect(L, c) {
    const col = COLS[laneCol(L.lane)];
    const y0 = L.dir > 0 ? c.s - c.len : H - c.s;
    return { x0: col.center - c.w / 2, x1: col.center + c.w / 2, y0, y1: y0 + c.len };
  }

  function hitCar(world, x, y) {
    for (const L of world.lanes) {
      const col = COLS[laneCol(L.lane)];
      if (x + CHICKEN_R < col.x || x - CHICKEN_R > col.x + col.w) continue;
      for (const c of L.cars) {
        const r = carRect(L, c);
        if (x + CHICKEN_R > r.x0 && x - CHICKEN_R < r.x1 && y + CHICKEN_R > r.y0 && y - CHICKEN_R < r.y1) return { L, c };
      }
    }
    return null;
  }

  // ---------- Spielstand ----------

  let els = {};
  let betControl;
  let ctx;
  let world = null;
  let chicken = null;    // { col, hop, queue, dead, deadAt, happyAt, shown }
  let pendingHit = null; // { lane, deadline }
  let finished = false;  // Runde vorbei, Straße noch nicht zurückgesetzt
  let camX = 0;
  let raf = 0;
  let lastNow = 0;
  let particles = [];
  let floats = [];
  let banner = null;
  let hudText = {};

  function state() {
    return GK.casino.data('chicken', () => ({ bet: 100, diff: 'normal', round: null, last: null, history: [] }));
  }

  const busy = () => !!(chicken && (chicken.hop || chicken.queue.length)) || !!pendingHit;

  // Neue Straße mit frischem Verkehr; das Huhn steht dort, wo die laufende Runde gerade ist
  function resetRoad() {
    const s = state();
    const steps = s.round ? s.round.steps : 0;
    const col = restCol(steps);
    const diff = s.round ? s.round.diff : s.diff;
    world = createWorld(diff, COLS[col].kind === 'lane' ? COLS[col].lane : 0);
    // shown = was gerade zu sehen ist: Ergebnisse erscheinen erst, wenn das Huhn gelandet ist
    const shown = { diff, bet: s.round ? s.round.bet : s.bet, steps, active: !!s.round, lost: false };
    chicken = { col, hop: null, queue: [], dead: false, deadAt: 0, happyAt: 0, shown };
    pendingHit = null;
    finished = false;
    particles = [];
    floats = [];
    banner = null;
    camX = cameraTarget();
  }

  // Einsatz setzen und eine neue Runde beginnen
  function startRound() {
    const s = state();
    if (s.round) return true;
    if (!GK.casino.bet(s.bet)) {
      GK.sound.play('denied');
      showMessage('Nicht genug Dublonen für diesen Einsatz.', 'loss');
      return false;
    }
    s.round = { bet: s.bet, diff: s.diff, steps: 0 };
    s.last = null;
    GK.save();
    return true;
  }

  // Ergebnis des nächsten Schritts auslosen und sofort speichern. Gibt { lane, safe, done, payout } zurück.
  function decideStep() {
    const s = state();
    const r = s.round;
    if (!r || r.steps >= LANES) return null;
    const lane = r.steps + 1;
    const safe = rollStep(r.diff, r.steps);
    let payout = 0;
    if (safe) {
      r.steps = lane;
      if (lane >= LANES) payout = finishRound(true);
    } else {
      s.round = null;
      s.last = { bet: r.bet, diff: r.diff, steps: r.steps, payout: 0, hit: true };
      pushHistory(0);
      GK.casino.record('chicken', r.bet, 0, `💥 Erwischt nach ${r.steps} ${r.steps === 1 ? 'Spur' : 'Spuren'} (${DIFFICULTIES[r.diff].name})`);
    }
    GK.save();
    return { lane, safe, done: !state().round, payout };
  }

  // Auszahlen (auch automatisch im Ziel). Zahlt genau einmal: die Runde ist danach weg.
  function finishRound(goal) {
    const s = state();
    const r = s.round;
    if (!r || r.steps < 1) return 0;
    const mult = multiplierAt(r.diff, r.steps);
    const payout = Math.floor(r.bet * mult);
    s.round = null;
    s.last = { bet: r.bet, diff: r.diff, steps: r.steps, payout, hit: false };
    GK.casino.payout(payout);
    if (goal && GK.unlockAchievement) GK.unlockAchievement('chickenGoal');
    pushHistory(mult);
    GK.casino.record('chicken', r.bet, payout, `${goal ? '🏁 Im Ziel' : '💰 Ausgezahlt'} nach ${r.steps} ${r.steps === 1 ? 'Spur' : 'Spuren'} · ×${fmt(mult)} (${DIFFICULTIES[r.diff].name})`);
    GK.save();
    return payout;
  }

  function pushHistory(mult) {
    const h = state().history;
    h.unshift(Math.round(mult * 100) / 100);
    h.length = Math.min(h.length, 14);
  }

  // ---------- Bedienung ----------

  function step() {
    if (busy()) return;
    const s = state();
    if (!s.round) {
      if (finished || !world) resetRoad();
      if (!startRound()) return;
      // Der Schwierigkeitsgrad kann sich seit dem letzten Aufbau geändert haben
      if (world.diff !== s.round.diff) resetRoad();
      Object.assign(chicken.shown, { diff: s.round.diff, bet: s.round.bet, steps: 0, active: true, lost: false });
    }
    const fromCol = chicken.col;
    const res = decideStep();
    if (!res) return;
    const plan = planStep(world, res.lane, res.safe);
    const toCol = laneCol(res.lane);
    chicken.queue.push({ from: fromCol, to: toCol, start: world.time + plan.wait, safe: res.safe, lane: res.lane });
    if (res.safe && res.lane % LANES_PER_SECTION === 0) {
      // Weiter auf die sichere Insel bzw. ins Ziel
      chicken.queue.push({ from: toCol, to: toCol + 1, start: null, safe: true, lane: 0, goal: res.lane >= LANES, payout: res.payout });
    }
    if (!res.safe) pendingHit = { lane: res.lane, deadline: world.time + plan.wait + HOP + HIT_DELAY + 0.6 };
    banner = null;
    GK.sound.play('flip');
    showMessage('🐔 Hopp …', '');
    updateUI();
    ensureLoop();
  }

  function cashOut() {
    if (busy()) return;
    const s = state();
    if (!s.round || s.round.steps < 1) return;
    const r = s.round;
    const payout = finishRound(false);
    if (!payout) return;
    finished = true;
    chicken.happyAt = world.time;
    chicken.shown.active = false;
    const mult = multiplierAt(r.diff, r.steps);
    banner = { text: `💰 Ausgezahlt: ×${fmt(mult)}`, color: '#2fa866', at: world.time };
    showMessage(`💰 Ausgezahlt: ${GK.formatMoneyHTML(payout)} (×${fmt(mult)})`, 'win');
    GK.fx.celebrate(payout, r.bet, { el: els.canvas, subtitle: `${r.steps} ${r.steps === 1 ? 'Spur' : 'Spuren'} geschafft` });
    updateUI();
  }

  function newRound() {
    if (busy() || state().round) return;
    resetRoad();
    GK.sound.play('chip');
    showMessage('Neue Straße, neues Glück! Tippe auf „Schritt“.', '');
    updateUI();
  }

  // ---------- Ablauf je Bild ----------

  const smooth = k => k * k * (3 - 2 * k);
  const clamp01 = k => Math.max(0, Math.min(1, k));

  // Position des Huhns in Straßen-Koordinaten und Sprunghöhe (0–1)
  function chickenPos() {
    const h = chicken.hop;
    if (!h) return { x: COLS[chicken.col].center, y: MID, lift: 0 };
    const k = clamp01((world.time - h.start) / HOP);
    const x0 = COLS[h.from].center;
    const x1 = COLS[h.to].center;
    return { x: x0 + (x1 - x0) * smooth(k), y: MID, lift: Math.sin(Math.PI * k) };
  }

  function tick(dt) {
    updateWorld(world, dt);
    const t = world.time;
    // Sprünge
    if (!chicken.hop && chicken.queue.length) {
      const next = chicken.queue[0];
      if (next.start == null) next.start = t + 0.2;
      if (t >= next.start) {
        chicken.hop = chicken.queue.shift();
        GK.sound.play('tick');
      }
    }
    if (chicken.hop && t >= chicken.hop.start + HOP) land(chicken.hop);
    // Spur hinter dem Huhn wieder freigeben, sobald es weg ist
    world.lanes.forEach(L => {
      if (L.liftAt != null && t >= L.liftAt) {
        L.stop = false;
        L.barrierAt = null;
        L.liftAt = null;
      }
    });
    // Zusammenstoß?
    if (!chicken.dead) {
      const p = chickenPos();
      const hit = hitCar(world, p.x, p.y);
      if (hit && pendingHit) squash(hit);
      else if (pendingHit && !chicken.hop && !chicken.queue.length && t > pendingHit.deadline) squash(null);
    }
    // Federn, Staub, Funken
    particles.forEach(q => {
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vx *= 1 - 1.8 * dt;
      q.vy *= 1 - 1.8 * dt;
      q.rot += q.vr * dt;
      q.life -= dt;
    });
    particles = particles.filter(q => q.life > 0);
    floats = floats.filter(f => t - f.at < 1.2);
    // Kamera folgt dem Huhn
    camX += (cameraTarget() - camX) * Math.min(1, dt * 5);
  }

  function cameraTarget() {
    const x = chicken ? chickenPos().x : 0;
    return Math.max(0, Math.min(LAYOUT.width - W, x - 300));
  }

  function land(h) {
    chicken.hop = null;
    chicken.col = h.to;
    const t = world.time;
    const col = COLS[h.to];
    // Die Spur, aus der das Huhn kommt, darf wieder fahren
    const prev = COLS[h.from];
    if (prev.kind === 'lane') world.lanes[prev.lane - 1].liftAt = t + 0.25;
    burst(col.center, MID, 'dust', 8);
    if (col.kind === 'lane' && h.safe) {
      const L = world.lanes[col.lane - 1];
      L.barrierAt = t;
      chicken.shown.steps = col.lane;
      const mult = multiplierAt(world.diff, col.lane);
      floats.push({ text: `×${fmt(mult)}`, x: col.center, y: MID - 40, at: t, color: '#ffe58a' });
      burst(col.center, MID, 'sparkle', 6);
      GK.sound.play('gem', 0.9 + Math.min(col.lane, 20) * 0.02);
      if (!chicken.queue.length) {
        showMessage(`Geschafft! Jetzt ×${fmt(mult)} – noch ein Schritt oder auszahlen?`, '');
      }
    } else if (col.kind === 'island') {
      banner = { text: `🛡️ Sichere Zone – Abschnitt ${col.section + 1} von ${SECTIONS} wartet`, color: '#2f7fd8', at: t };
      burst(col.center, MID, 'sparkle', 14);
      GK.sound.play('bonus');
      showMessage(`🛡️ Sicher auf der Insel! Ab jetzt fährt der Verkehr schneller. Jetzt ×${fmt(multiplierAt(world.diff, chicken.shown.steps))}`, 'win');
    } else if (col.kind === 'goal') {
      finished = true;
      chicken.happyAt = t;
      chicken.shown.active = false;
      const last = state().last;
      const mult = multiplierAt(world.diff, LANES);
      banner = { text: `🏁 Im Ziel! ×${fmt(mult)}`, color: '#2fa866', at: t };
      burst(col.center, MID, 'sparkle', 24);
      if (last && last.payout) {
        showMessage(`🏁 Das Huhn hat es geschafft! Gewinn: ${GK.formatMoneyHTML(last.payout)} (×${fmt(mult)})`, 'win');
        GK.fx.celebrate(last.payout, last.bet, { el: els.canvas, subtitle: 'Alle 20 Spuren geschafft' });
      }
    }
    updateUI();
  }

  function squash(hit) {
    chicken.dead = true;
    chicken.deadAt = world.time;
    chicken.shown.active = false;
    chicken.shown.lost = true;
    pendingHit = null;
    finished = true;
    const p = chickenPos();
    chicken.hop = null;
    chicken.queue = [];
    burst(p.x, p.y, 'feather', 22);
    if (hit) hit.c.braking = true;
    banner = { text: '💥 Erwischt!', color: '#c62828', at: world.time };
    GK.sound.play('boom');
    GK.fx.shake('small');
    setTimeout(() => GK.sound.play('lose'), 250);
    const last = state().last;
    showMessage(`💥 Erwischt! Der Einsatz ist weg.${last && last.steps ? ` (${last.steps} ${last.steps === 1 ? 'Spur' : 'Spuren'} geschafft)` : ''}`, 'loss');
    updateUI();
  }

  function burst(x, y, kind, count) {
    if (GK.state.settings.effects === 'reduced') count = Math.ceil(count / 3);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = kind === 'feather' ? 120 + Math.random() * 260 : kind === 'dust' ? 40 + Math.random() * 60 : 80 + Math.random() * 160;
      particles.push({
        kind, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 10,
        life: kind === 'feather' ? 1.4 + Math.random() * 0.8 : 0.5 + Math.random() * 0.4, max: kind === 'feather' ? 2.2 : 0.9,
      });
    }
  }

  function ensureLoop() {
    if (!raf) raf = requestAnimationFrame(loop);
  }

  function loop(now) {
    raf = 0;
    if (!els.canvas || els.canvas.offsetParent === null) {
      lastNow = 0;
      return;
    }
    const dt = lastNow ? Math.min(0.05, (now - lastNow) / 1000) : 0;
    lastNow = now;
    tick(dt);
    draw();
    updateHud();
    raf = requestAnimationFrame(loop);
  }

  // ---------- Zeichnen ----------

  function fmt(m) {
    return GK.formatDecimal(m, 2, 2);
  }

  const SCALE = 1.5;

  function draw() {
    if (!ctx || !world) return;
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(-Math.round(camX), 0);
    const x0 = camX - 20;
    const x1 = camX + W + 20;
    const steps = chicken.shown.steps;
    COLS.forEach((c, i) => {
      if (c.x + c.w < x0 || c.x > x1) return;
      if (c.kind === 'lane') drawLane(c, i, steps);
      else if (c.kind === 'island') drawIsland(c);
      else if (c.kind === 'start') drawStart(c);
      else drawGoal(c);
    });
    // Schranken vor dem Huhn
    world.lanes.forEach(L => {
      const c = COLS[laneCol(L.lane)];
      if (L.barrierAt != null && c.x + c.w > x0 && c.x < x1) drawBarrier(c, L);
    });
    if (chicken.dead) drawChicken();
    world.lanes.forEach(L => {
      const c = COLS[laneCol(L.lane)];
      if (c.x + c.w < x0 || c.x > x1) return;
      L.cars.forEach(car => drawCar(c.center, L, car));
    });
    if (!chicken.dead) drawChicken();
    drawParticles();
    floats.forEach(f => {
      const k = (world.time - f.at) / 1.2;
      ctx.globalAlpha = 1 - k * k;
      ctx.font = '900 30px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.strokeText(f.text, f.x, f.y - k * 50);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y - k * 50);
      ctx.globalAlpha = 1;
    });
    ctx.restore();
    if (banner) drawBanner();
  }

  function rr(x, y, w, h, r) {
    // Abgerundetes Rechteck selbst zeichnen (ctx.roundRect gibt es erst ab Safari 16)
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawLane(c, i, steps) {
    ctx.fillStyle = c.lane % 2 ? '#3b4148' : '#383e45';
    ctx.fillRect(c.x, 0, c.w, H);
    // Markierung: gestrichelt zwischen Spuren, durchgezogen am Rand der Straße
    const left = COLS[i - 1];
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    if (left.kind === 'lane') {
      for (let y = -10; y < H; y += 60) ctx.fillRect(c.x - 2, y, 4, 32);
    } else {
      ctx.fillRect(c.x + 3, 0, 4, H);
    }
    if (COLS[i + 1].kind !== 'lane') ctx.fillRect(c.x + c.w - 7, 0, 4, H);
    // Fahrtrichtung
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    [90, H - 90].forEach(y => {
      ctx.beginPath();
      ctx.moveTo(c.center - 14, y - 12 * c.dir);
      ctx.lineTo(c.center + 14, y - 12 * c.dir);
      ctx.lineTo(c.center, y + 14 * c.dir);
      ctx.fill();
    });
    // Gullydeckel, auf dem das Huhn landet, mit dem Multiplikator dieser Spur
    const passed = c.lane <= steps;
    const next = chicken.shown.active && c.lane === steps + 1;
    ctx.fillStyle = passed ? '#5d6b52' : '#575d63';
    ctx.beginPath();
    ctx.arc(c.center, MID, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = passed ? 'rgba(140, 220, 120, 0.7)' : next ? 'rgba(255, 217, 94, 0.9)' : 'rgba(0, 0, 0, 0.35)';
    ctx.lineWidth = next ? 4 : 3;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.lineWidth = 2;
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath();
      ctx.moveTo(c.center - 18, MID + k * 9);
      ctx.lineTo(c.center + 18, MID + k * 9);
      ctx.stroke();
    }
    const mult = multiplierAt(world.diff, c.lane);
    const text = `×${mult >= 1000 ? GK.formatNumber(Math.floor(mult)) : fmt(mult)}`;
    ctx.font = '800 17px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const w = Math.min(c.w - 8, ctx.measureText(text).width + 16);
    ctx.fillStyle = passed ? 'rgba(47, 168, 102, 0.85)' : next ? 'rgba(245, 197, 66, 0.92)' : 'rgba(0, 0, 0, 0.55)';
    rr(c.center - w / 2, MID + 40, w, 26, 13);
    ctx.fill();
    ctx.fillStyle = next ? '#2a1d00' : '#fff';
    ctx.fillText(text, c.center, MID + 53, c.w - 14);
  }

  function drawIsland(c) {
    // Grüne Verkehrsinsel mit Schutzwänden an beiden Seiten
    ctx.fillStyle = '#4f9a45';
    ctx.fillRect(c.x, 0, c.w, H);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    for (let y = 8; y < H; y += 26) ctx.fillRect(c.x + 22 + ((y / 26) % 2) * 30, y, 22, 4);
    [c.x, c.x + c.w - 16].forEach(x => {
      ctx.fillStyle = '#cfd4d8';
      ctx.fillRect(x, 0, 16, H);
      ctx.fillStyle = '#e53935';
      for (let y = 0; y < H; y += 40) ctx.fillRect(x + 2, y, 12, 20);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.fillRect(x + (x === c.x ? 14 : 0), 0, 2, H);
    });
    ctx.font = '30px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🛡️', c.center, 70);
    ctx.fillText('🌷', c.center - 26, H - 60);
    ctx.fillText('🌼', c.center + 24, H - 110);
    ctx.font = '800 16px system-ui, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText('Sichere Zone', c.center, 108);
    ctx.font = '700 14px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillText(`Abschnitt ${c.section + 1}`, c.center, 128);
  }

  function drawStart(c) {
    ctx.fillStyle = '#5aa64e';
    ctx.fillRect(c.x, 0, c.w, H);
    ctx.fillStyle = '#b9bec3';
    ctx.fillRect(c.x + c.w - 50, 0, 50, H);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
    ctx.lineWidth = 2;
    for (let y = 0; y < H; y += 34) {
      ctx.beginPath();
      ctx.moveTo(c.x + c.w - 50, y);
      ctx.lineTo(c.x + c.w, y);
      ctx.stroke();
    }
    // Hühnerstall
    ctx.fillStyle = '#a0522d';
    ctx.fillRect(c.x + 20, 70, 80, 70);
    ctx.fillStyle = '#7a3b1c';
    ctx.beginPath();
    ctx.moveTo(c.x + 12, 74);
    ctx.lineTo(c.x + 60, 36);
    ctx.lineTo(c.x + 108, 74);
    ctx.fill();
    ctx.fillStyle = '#3b1d0c';
    ctx.fillRect(c.x + 50, 104, 20, 36);
    ctx.font = '26px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🌻', c.x + 34, H - 70);
    ctx.fillText('🥚', c.x + 80, 170);
  }

  function drawGoal(c) {
    ctx.fillStyle = '#6bb35c';
    ctx.fillRect(c.x, 0, c.w, H);
    // Zielflagge als Schachbrett-Streifen
    for (let y = 0; y < H; y += 14) {
      for (let k = 0; k < 2; k++) {
        ctx.fillStyle = (y / 14 + k) % 2 ? '#111' : '#fff';
        ctx.fillRect(c.x + k * 14, y, 14, 14);
      }
    }
    ctx.font = '64px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🏆', c.center + 10, 130);
    ctx.font = '30px system-ui, sans-serif';
    ctx.fillText('🌽', c.center - 40, H - 90);
    ctx.fillText('🌽', c.center + 50, H - 60);
    const mult = multiplierAt(world.diff, LANES);
    const text = `Ziel ×${mult >= 1000 ? GK.formatNumber(Math.floor(mult)) : fmt(mult)}`;
    ctx.font = '900 20px system-ui, sans-serif';
    const w = ctx.measureText(text).width + 24;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    rr(c.center + 10 - w / 2, 180, w, 34, 12);
    ctx.fill();
    ctx.fillStyle = '#ffe58a';
    ctx.fillText(text, c.center + 10, 198);
  }

  // Rot-weiße Schranke quer über die Spur, vor dem Huhn (auf der Seite, von der die Autos kommen)
  function drawBarrier(c, L) {
    const k = clamp01((world.time - L.barrierAt) / 0.25);
    const y = L.dir > 0 ? STOP + 6 : H - STOP - 6;
    const w = (c.w - 16) * smooth(k);
    ctx.save();
    ctx.translate(c.x + 8, y);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(2, 3, w, 10);
    for (let x = 0; x < w; x += 16) {
      ctx.fillStyle = (x / 16) % 2 ? '#fff' : '#e53935';
      ctx.fillRect(x, -5, Math.min(16, w - x), 10);
    }
    ctx.fillStyle = '#ffd95e';
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawCar(cx, L, car) {
    const r = carRect(L, car);
    const cy = (r.y0 + r.y1) / 2;
    if (r.y1 < -10 || r.y0 > H + 10) return;
    ctx.save();
    ctx.translate(cx, cy);
    if (L.dir > 0) ctx.rotate(Math.PI);   // Front zeigt in Fahrtrichtung (gezeichnet wird nach oben)
    const w = car.w;
    const l = car.len;
    // Schatten
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    rr(-w / 2 + 4, -l / 2 + 5, w, l, 10);
    ctx.fill();
    if (car.type === 'truck') {
      // Führerhaus vorne, Container dahinter
      ctx.fillStyle = '#d7dadd';
      rr(-w / 2, -l / 2 + 38, w, l - 38, 4);
      ctx.fill();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
      for (let y = -l / 2 + 46; y < l / 2 - 4; y += 12) ctx.fillRect(-w / 2 + 3, y, w - 6, 2);
      ctx.fillStyle = car.color;
      rr(-w / 2, -l / 2, w, 36, 8);
      ctx.fill();
      ctx.fillStyle = '#20313d';
      ctx.fillRect(-w / 2 + 5, -l / 2 + 6, w - 10, 9);
    } else {
      ctx.fillStyle = car.color;
      rr(-w / 2, -l / 2, w, l, car.type === 'van' ? 7 : 11);
      ctx.fill();
      // Seitenlicht für etwas Tiefe
      ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.fillRect(-w / 2 + 3, -l / 2 + 10, 4, l - 20);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
      ctx.fillRect(w / 2 - 7, -l / 2 + 10, 4, l - 20);
      // Scheiben und Dach
      ctx.fillStyle = '#1d2b36';
      rr(-w / 2 + 5, -l / 2 + 13, w - 10, 13, 4);
      ctx.fill();
      if (car.type !== 'van') {
        rr(-w / 2 + 6, l / 2 - 20, w - 12, 9, 3);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
      rr(-w / 2 + 6, -l / 2 + 28, w - 12, car.type === 'van' ? l - 36 : l - 50, 5);
      ctx.fill();
      if (car.type === 'taxi') {
        ctx.fillStyle = '#222';
        rr(-11, -6, 22, 10, 2);
        ctx.fill();
        ctx.fillStyle = '#ffcf33';
        ctx.font = '800 7px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('TAXI', 0, -1);
      } else if (car.type === 'sport') {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.fillRect(-6, -l / 2 + 1, 4, l - 2);
        ctx.fillRect(2, -l / 2 + 1, 4, l - 2);
      }
    }
    // Scheinwerfer vorne, Rücklichter hinten (leuchten beim Bremsen)
    ctx.fillStyle = '#fff6c0';
    ctx.fillRect(-w / 2 + 4, -l / 2, 8, 4);
    ctx.fillRect(w / 2 - 12, -l / 2, 8, 4);
    ctx.fillStyle = car.braking ? '#ff1744' : '#9c1b1b';
    if (car.braking) {
      ctx.shadowColor = '#ff1744';
      ctx.shadowBlur = 10;
    }
    ctx.fillRect(-w / 2 + 4, l / 2 - 4, 8, 4);
    ctx.fillRect(w / 2 - 12, l / 2 - 4, 8, 4);
    ctx.restore();
  }

  function drawChicken() {
    const p = chickenPos();
    const t = world.time;
    const scale = 1 + p.lift * 0.3;
    ctx.save();
    // Schatten (beim Sprung kleiner und versetzt)
    ctx.fillStyle = `rgba(0, 0, 0, ${0.3 - p.lift * 0.12})`;
    ctx.beginPath();
    ctx.ellipse(p.x + 4 + p.lift * 10, p.y + 6 + p.lift * 14, 22 * (1 - p.lift * 0.2), 16 * (1 - p.lift * 0.2), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.translate(p.x, p.y);
    if (chicken.dead) {
      const k = clamp01((t - chicken.deadAt) / 0.3);
      ctx.rotate(k * 2.4);
      ctx.scale(1.25, 1.25 - 0.5 * k);
    } else {
      // Freudensprünge nach dem Auszahlen, sonst leichtes Wippen
      const happy = chicken.happyAt && t - chicken.happyAt < 2 ? Math.abs(Math.sin((t - chicken.happyAt) * 9)) * 0.15 : 0;
      ctx.scale(scale + happy, scale + happy);
    }
    const flap = chicken.hop ? Math.sin(t * 40) * 6 : 0;
    // Schwanzfedern
    ctx.fillStyle = '#f3e6c8';
    ctx.beginPath();
    ctx.moveTo(-18, 0);
    ctx.lineTo(-30, -8);
    ctx.lineTo(-27, 0);
    ctx.lineTo(-30, 8);
    ctx.closePath();
    ctx.fill();
    // Flügel
    ctx.fillStyle = '#e9e4dc';
    ctx.beginPath();
    ctx.ellipse(-4, -14 - flap, 13, 6 + Math.abs(flap) * 0.5, -0.2, 0, Math.PI * 2);
    ctx.ellipse(-4, 14 + flap, 13, 6 + Math.abs(flap) * 0.5, 0.2, 0, Math.PI * 2);
    ctx.fill();
    // Körper
    const body = ctx.createRadialGradient(-4, -4, 2, 0, 0, 22);
    body.addColorStop(0, '#ffffff');
    body.addColorStop(1, '#e2dccf');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(-2, 0, 20, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    // Kopf mit Kamm, Schnabel und Augen
    const bob = chicken.dead || chicken.hop ? 0 : Math.max(0, Math.sin(t * 3)) * 2;
    ctx.translate(bob, 0);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(15, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e53935';
    [[9, 0, 4], [14, 0, 4.5], [19, 0, 3.5]].forEach(([x, y, r]) => {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = '#ff9800';
    ctx.beginPath();
    ctx.moveTo(23, -4);
    ctx.lineTo(32, 0);
    ctx.lineTo(23, 4);
    ctx.closePath();
    ctx.fill();
    if (chicken.dead) {
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 2;
      [-6, 6].forEach(y => {
        ctx.beginPath();
        ctx.moveTo(16, y - 3);
        ctx.lineTo(22, y + 3);
        ctx.moveTo(22, y - 3);
        ctx.lineTo(16, y + 3);
        ctx.stroke();
      });
    } else {
      ctx.fillStyle = '#222';
      const blink = (t % 3.2) < 0.12;
      [-6, 6].forEach(y => {
        if (blink) ctx.fillRect(17, y - 0.5, 5, 1.5);
        else {
          ctx.beginPath();
          ctx.arc(19, y, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }
    ctx.restore();
    if (chicken.dead) {
      // Sternchen über dem Huhn
      ctx.font = '18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let i = 0; i < 3; i++) {
        const a = t * 3 + i * 2.1;
        ctx.fillText('💫', p.x + Math.cos(a) * 26, p.y - 30 + Math.sin(a) * 8);
      }
    }
  }

  function drawParticles() {
    particles.forEach(q => {
      const k = clamp01(q.life / q.max);
      ctx.save();
      ctx.translate(q.x, q.y);
      ctx.rotate(q.rot);
      ctx.globalAlpha = Math.min(1, k * 1.6);
      if (q.kind === 'feather') {
        ctx.fillStyle = '#f5f1e8';
        ctx.beginPath();
        ctx.ellipse(0, 0, 9, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-9, 0);
        ctx.lineTo(9, 0);
        ctx.stroke();
      } else if (q.kind === 'dust') {
        ctx.fillStyle = 'rgba(200, 200, 200, 0.6)';
        ctx.beginPath();
        ctx.arc(0, 0, 5 + (1 - k) * 8, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#ffe58a';
        ctx.fillRect(-4, -1, 8, 2);
        ctx.fillRect(-1, -4, 2, 8);
      }
      ctx.restore();
    });
  }

  function drawBanner() {
    const k = clamp01((world.time - banner.at) / 0.25);
    const fade = banner.color === '#2f7fd8' ? clamp01((banner.at + 2.6 - world.time) / 0.4) : 1;
    if (fade <= 0) return;
    ctx.save();
    ctx.globalAlpha = k * fade;
    ctx.font = '900 28px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const w = Math.min(W - 40, ctx.measureText(banner.text).width + 48);
    ctx.fillStyle = banner.color;
    rr(W / 2 - w / 2, 22, w, 54, 16);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 6;
    ctx.fillText(banner.text, W / 2, 50, W - 70);
    ctx.restore();
  }

  // ---------- Anzeige und Knöpfe ----------

  function setText(key, html) {
    if (hudText[key] === html) return;
    hudText[key] = html;
    els[key].innerHTML = html;
  }

  function updateHud() {
    if (!els.hudBet || !chicken) return;
    const s = state();
    const v = chicken.shown;
    // Vor einer Runde zeigen Einsatz und Schwierigkeit die aktuelle Auswahl
    const live = !v.active && !finished;
    const diff = live ? s.diff : v.diff;
    const bet = live ? s.bet : v.bet;
    const steps = live ? 0 : v.steps;
    const lost = v.lost;
    const mult = multiplierAt(diff, steps);
    setText('hudBet', GK.formatMoneyHTML(bet));
    setText('hudMult', `×${fmt(mult)}`);
    setText('hudWin', lost ? '<span class="loss">0</span>' : GK.formatMoneyHTML(steps ? Math.floor(bet * mult) : 0));
    setText('hudSteps', `${steps} / ${LANES}`);
    setText('hudDiff', `${DIFFICULTIES[diff].icon} ${DIFFICULTIES[diff].name}`);
    // Fortschritt: Spuren als Kästchen, Inseln als Schild
    const sec = Math.min(SECTIONS - 1, Math.floor(steps / LANES_PER_SECTION));
    const left = steps >= LANES ? 0 : LANES_PER_SECTION - (steps % LANES_PER_SECTION);
    const progress = Array.from({ length: SECTIONS }, (_, si) => {
      const cells = Array.from({ length: LANES_PER_SECTION }, (__, li) => {
        const lane = si * LANES_PER_SECTION + li + 1;
        const cls = lane <= steps ? 'done' : lane === steps + 1 && !lost ? 'next' : lost && lane === steps + 1 ? 'hit' : '';
        return `<i class="cr-cell ${cls}"></i>`;
      }).join('');
      const end = si < SECTIONS - 1 ? `<i class="cr-safe ${steps >= (si + 1) * LANES_PER_SECTION ? 'done' : ''}">🛡️</i>` : `<i class="cr-safe ${steps >= LANES ? 'done' : ''}">🏁</i>`;
      return cells + end;
    }).join('');
    setText('progress', progress);
    setText('progressText', steps >= LANES ? '🏁 Ziel erreicht!'
      : `Abschnitt ${sec + 1} von ${SECTIONS} · noch ${left} ${left === 1 ? 'Spur' : 'Spuren'} bis ${sec === SECTIONS - 1 ? 'zum Ziel' : 'zur sicheren Zone'}`);
  }

  function updateUI() {
    if (!els.step || !chicken) return;
    const s = state();
    const r = s.round;
    const v = chicken.shown;
    const b = busy();
    els.step.disabled = b;
    els.step.innerHTML = v.active || b ? '🐾 Schritt' : `<span>🐾 Los! (${GK.formatMoneyHTML(s.bet)})</span>`;
    els.cash.disabled = b || !r || r.steps < 1;
    els.cash.innerHTML = v.active && v.steps >= 1
      ? `💰 Auszahlen: ${GK.formatMoneyHTML(Math.floor(v.bet * multiplierAt(v.diff, v.steps)))}`
      : '💰 Auszahlen';
    els.again.disabled = b || !!r || !finished;
    els.diffs.forEach(btn => {
      const active = btn.dataset.diff === (r ? r.diff : s.diff);
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active);
      btn.disabled = !!r || b;
    });
    betControl.setDisabled(!!r || b);
    const d = r ? r.diff : s.diff;
    els.info.innerHTML = `1. Spur <b>×${fmt(multiplierAt(d, 1))}</b> · 5. Spur <b>×${fmt(multiplierAt(d, 5))}</b> · Ziel <b>×${GK.formatNumber(Math.floor(multiplierAt(d, LANES)))}</b>`;
    drawHistory();
    updateHud();
  }

  function drawHistory() {
    const h = state().history;
    const html = h.length
      ? h.map(m => (m > 0 ? `<span class="crash-chip high">🐔 ×${fmt(m)}</span>` : '<span class="crash-chip low">💥</span>')).join('')
      : '<span class="muted small">Noch keine Runden.</span>';
    if (els.history.innerHTML !== html) els.history.innerHTML = html;
  }

  function showMessage(html, cls) {
    if (!els.message) return;
    els.message.className = 'game-message ' + (cls || '');
    els.message.innerHTML = html;
  }

  function onKey(e) {
    if (!els.canvas || els.canvas.offsetParent === null || e.repeat) return;
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    // Leertaste und Enter lösen einen Knopf mit Fokus schon selbst aus
    if (tag === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return;
    if (e.key === ' ' || e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      step();
    } else if (e.key === 'Enter' || e.key === 'c' || e.key === 'C') {
      e.preventDefault();
      cashOut();
    } else if (e.key === 'n' || e.key === 'N') {
      newRound();
    }
  }

  function init(body) {
    body.innerHTML = `
      <div class="crash-layout">
        <div class="crash-scene chicken-scene">
          <canvas class="chicken-canvas" width="${W * SCALE}" height="${H * SCALE}" aria-label="Straße mit Huhn"></canvas>
          <div class="chicken-hud">
            <div class="fh-stat"><span class="fh-label">Einsatz</span><b class="cr-bet"></b></div>
            <div class="fh-stat"><span class="fh-label">Multiplikator</span><b class="cr-mult fh-mult"></b></div>
            <div class="fh-stat"><span class="fh-label">Möglicher Gewinn</span><b class="cr-win"></b></div>
            <div class="fh-stat"><span class="fh-label">Schritte</span><b class="cr-steps"></b></div>
            <div class="fh-stat"><span class="fh-label">Schwierigkeit</span><b class="cr-diff small-value"></b></div>
            <div class="cr-progress-wrap">
              <div class="cr-progress" aria-hidden="true"></div>
              <div class="cr-progress-text"></div>
            </div>
          </div>
          <div class="crash-history chicken-history"></div>
        </div>
        <div class="crash-controls">
          <div class="bet-label">Schwierigkeit</div>
          <div class="plinko-risks chicken-diffs" role="group" aria-label="Schwierigkeit">
            ${Object.entries(DIFFICULTIES).map(([id, d]) => `<button type="button" class="btn btn-small chicken-diff" data-diff="${id}">${d.icon} ${d.name}</button>`).join('')}
          </div>
          <div class="mines-info chicken-info"></div>
          <div class="game-message">&nbsp;</div>
          <div class="chicken-bet"></div>
          <div class="game-actions chicken-actions">
            <button class="btn btn-primary btn-big chicken-step"></button>
            <button class="btn btn-primary btn-big chicken-cash"></button>
            <button class="btn chicken-again">🔄 Neue Runde</button>
          </div>
          <p class="muted small">Bring das Huhn Spur für Spur über die Straße. Jeder geschaffte Schritt erhöht den
            Multiplikator – auszahlen kannst du nach jedem Schritt. Erwischt dich ein Auto, ist der Einsatz weg.
            Nach jeweils fünf Spuren wartet eine sichere Insel, danach wird der Verkehr schneller.</p>
          <p class="muted small chicken-keys">Tastatur: Leertaste oder → = Schritt, Enter = Auszahlen, N = neue Runde.</p>
        </div>
      </div>`;
    els = {
      canvas: body.querySelector('.chicken-canvas'),
      history: body.querySelector('.chicken-history'),
      message: body.querySelector('.game-message'),
      info: body.querySelector('.chicken-info'),
      step: body.querySelector('.chicken-step'),
      cash: body.querySelector('.chicken-cash'),
      again: body.querySelector('.chicken-again'),
      diffs: [...body.querySelectorAll('.chicken-diff')],
      hudBet: body.querySelector('.cr-bet'),
      hudMult: body.querySelector('.cr-mult'),
      hudWin: body.querySelector('.cr-win'),
      hudSteps: body.querySelector('.cr-steps'),
      hudDiff: body.querySelector('.cr-diff'),
      progress: body.querySelector('.cr-progress'),
      progressText: body.querySelector('.cr-progress-text'),
    };
    hudText = {};
    ctx = els.canvas.getContext('2d');
    betControl = GK.casino.createBetControl(body.querySelector('.chicken-bet'), {
      min: MIN_BET,
      get: () => state().bet,
      set: v => {
        state().bet = v;
        updateUI();
      },
    });
    els.step.addEventListener('click', step);
    els.cash.addEventListener('click', cashOut);
    els.again.addEventListener('click', newRound);
    // Tippen auf die Straße = Schritt
    els.canvas.addEventListener('click', () => { if (state().round) step(); });
    els.diffs.forEach(btn => btn.addEventListener('click', () => {
      if (state().round || busy()) return;
      state().diff = btn.dataset.diff;
      GK.sound.play('chip');
      GK.save();
      resetRoad();
      updateUI();
    }));
    document.addEventListener('keydown', onKey);
    refresh();
  }

  function refresh() {
    resetRoad();
    showMessage(state().round
      ? `Deine Runde läuft noch: ${state().round.steps} ${state().round.steps === 1 ? 'Spur' : 'Spuren'} geschafft. Weiter oder auszahlen?`
      : 'Wähle Einsatz und Schwierigkeit – und dann los über die Straße!', '');
    updateUI();
    draw();
    ensureLoop();
  }

  GK.casino.register({
    id: 'chicken',
    category: 'quick',
    name: 'Chicken Road',
    emoji: '🐔',
    desc: 'Bring das Huhn über die Straße – Spur für Spur steigt der Gewinn!',
    init,
    refresh,
    onShow: () => {
      lastNow = 0;
      ensureLoop();
    },
    render: () => {
      if (!state().round && !busy()) betControl.refresh();
    },
  });

  // Für Tests
  GK.casino.chickenMath = {
    DIFFICULTIES, LANES, LANES_PER_SECTION, SECTIONS, COLS, MID, ZONE, HOP, ENTER, HIT_DELAY, CHICKEN_R,
    surviveChance, survival, multiplierAt, rtp, rollStep, restCol, laneCol,
    createWorld, updateWorld, planStep, hitCar, carRect,
    startRound, decideStep, finishRound, state,
  };
})();
