// Tests für Chicken Road: Multiplikatoren, Verkehr (Kollisionen, sichere Zonen) und der Ablauf einer Runde
// (Start, Schritte, Auszahlen, Ziel, Neustart, keine doppelte Auszahlung).
// Ausführen mit: node tests/chicken.test.js
global.window = global;
global.document = { addEventListener() {}, querySelector() { return null; } };
global.location = { search: '', pathname: '/', origin: '', hash: '' };
global.history = { replaceState() {} };
const R = require('path').join(__dirname, '..', 'js') + '/';
require(R + 'format.js');
require(R + 'state.js');
require(R + 'casino/casino.js');
require(R + 'casino/chicken.js');
const assert = (cond, msg) => { if (!cond) { console.log('FAIL', msg); process.exitCode = 1; } };
const M = GK.casino.chickenMath;
const DIFFS = Object.keys(M.DIFFICULTIES);

// Ein kleiner Zufallsgenerator mit festem Startwert, damit Fehler sich wiederholen lassen
function seeded(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

// ---------- Multiplikatoren ----------
{
  assert(M.LANES === 20 && M.SECTIONS * M.LANES_PER_SECTION === M.LANES, '20 Spuren in 4 Abschnitten');
  DIFFS.forEach((d, di) => {
    assert(M.multiplierAt(d, 0) === 1, `${d}: ohne Schritt ×1`);
    for (let k = 1; k <= M.LANES; k++) {
      assert(M.multiplierAt(d, k) > M.multiplierAt(d, k - 1), `${d}: Multiplikator steigt bei Schritt ${k}`);
      const r = M.rtp(d, k);
      assert(r <= 0.97 + 1e-9 && r >= 0.955, `${d}: Auszahlen nach ${k} Schritten zahlt im Schnitt ${r}`);
      if (di > 0) assert(M.multiplierAt(d, k) > M.multiplierAt(DIFFS[di - 1], k), `${d}: wächst schneller als ${DIFFS[di - 1]} (Schritt ${k})`);
    }
    // In späteren Abschnitten wird jede Spur gefährlicher
    for (let k = 2; k <= M.LANES; k++) assert(M.surviveChance(d, k) <= M.surviveChance(d, k - 1), `${d}: Spur ${k} nicht leichter`);
    // Gelingt ein Schritt so oft wie vorgesehen?
    const n = 100000;
    let ok = 0;
    for (let i = 0; i < n; i++) if (M.rollStep(d, 0)) ok++;
    assert(Math.abs(ok / n - M.surviveChance(d, 1)) < 0.006, `${d}: erste Spur gelingt in ${(ok / n * 100).toFixed(1)} %`);
  });
  // Wo das Huhn steht: nach je fünf Spuren auf der Insel, nach 20 im Ziel
  assert(M.restCol(0) === 0 && M.COLS[0].kind === 'start', 'Start am Gehweg');
  assert(M.COLS[M.restCol(5)].kind === 'island' && M.COLS[M.restCol(10)].kind === 'island' && M.COLS[M.restCol(15)].kind === 'island', 'Inseln nach 5, 10, 15 Spuren');
  assert(M.COLS[M.restCol(20)].kind === 'goal', 'Ziel nach 20 Spuren');
  assert(M.COLS[M.restCol(7)].lane === 7, 'nach 7 Schritten auf Spur 7');
  assert(M.COLS.filter(c => c.kind === 'island').length === 3, 'drei sichere Inseln');
}

// ---------- Verkehr: Kollisionen und sichere Zonen ----------
// Das Huhn springt wie im Spiel: Start nach `wait`, Dauer HOP, weiche Bewegung von Spalte zu Spalte.
{
  const DT = 1 / 60;
  const smooth = k => k * k * (3 - 2 * k);
  let safeSteps = 0;
  let hits = 0;
  let maxWait = 0;
  let overlaps = 0;

  function noOverlap(world, label) {
    world.lanes.forEach(L => {
      for (let i = 1; i < L.cars.length; i++) {
        const a = L.cars[i - 1];
        const b = L.cars[i];
        if (b.s > a.s - a.len + 0.5) {
          overlaps++;
          if (overlaps < 5) console.log('FAIL', `${label}: Autos überlappen auf Spur ${L.lane}`);
          process.exitCode = 1;
        }
      }
    });
  }

  // Huhn springt von Spalte `from` nach `to`; prüft jedes Bild auf Zusammenstöße
  function hop(world, from, to, wait, until, onFrame) {
    const x0 = M.COLS[from].center;
    const x1 = M.COLS[to].center;
    let firstHit = null;
    for (let t = 0; t <= until; t += DT) {
      M.updateWorld(world, DT);
      const k = Math.max(0, Math.min(1, (t - wait) / M.HOP));
      const x = x0 + (x1 - x0) * smooth(k);
      if (onFrame) onFrame(t);
      if (firstHit == null && M.hitCar(world, x, M.MID)) firstHit = t;
    }
    return firstHit;
  }

  DIFFS.forEach((d, di) => {
    for (let trial = 0; trial < 60; trial++) {
      const rand = seeded(1000 + di * 100 + trial);
      const world = M.createWorld(d, 0, rand);
      let col = 0;
      for (let lane = 1; lane <= M.LANES; lane++) {
        // Etwa jeder sechste Schritt geht schief (unabhängig von der echten Chance, um beides oft zu testen)
        const safe = rand() > 0.16;
        const plan = M.planStep(world, lane, safe);
        maxWait = Math.max(maxWait, plan.wait);
        assert(plan.wait >= 0, `${d}: Wartezeit nicht negativ`);
        const to = M.laneCol(lane);
        const prev = M.COLS[col];
        const land = plan.wait + M.HOP;
        // Die Spur, aus der das Huhn kommt, fährt kurz nach der Landung wieder
        const lift = t => { if (prev.kind === 'lane' && t >= land + 0.25) world.lanes[prev.lane - 1].stop = false; };
        if (!safe) {
          const hitAt = hop(world, col, to, plan.wait, land + M.HIT_DELAY + 0.4, lift);
          assert(hitAt != null, `${d}: Spur ${lane} – das Auto erwischt das Huhn`);
          assert(hitAt == null || (hitAt >= land - 0.02 && hitAt <= land + M.HIT_DELAY + 0.15), `${d}: Spur ${lane} – Zusammenstoß nach der Landung (${hitAt && (hitAt - land).toFixed(3)} s)`);
          hits++;
          break;
        }
        // Sicherer Schritt: kein Zusammenstoß beim Sprung und während das Huhn danach (geschützt) wartet
        const idle = 0.5 + rand() * 2.5;
        const hitAt = hop(world, col, to, plan.wait, land + idle, lift);
        assert(hitAt == null, `${d}: Spur ${lane} – sicherer Schritt ohne Zusammenstoß (${hitAt})`);
        safeSteps++;
        col = to;
        noOverlap(world, d);
        // Nach jedem Abschnitt auf die sichere Insel: dort fährt nichts
        if (lane % M.LANES_PER_SECTION === 0 && lane < M.LANES) {
          const island = col + 1;
          assert(M.COLS[island].kind === 'island', `${d}: Insel nach Spur ${lane}`);
          const L = world.lanes[lane - 1];
          const onIsland = hop(world, col, island, 0.2, 0.2 + M.HOP + 2, t => { if (t >= 0.2 + M.HOP + 0.25) L.stop = false; });
          assert(onIsland == null, `${d}: auf der Insel nach Spur ${lane} sicher`);
          col = island;
        }
      }
    }
  });
  assert(overlaps === 0, `Autos überlappen nie (${overlaps})`);
  assert(maxWait < 2, `Huhn wartet nie lange (${maxWait.toFixed(2)} s)`);
  console.log(`Verkehr: ${safeSteps} sichere Schritte, ${hits} Zusammenstöße geprüft, längste Wartezeit ${maxWait.toFixed(2)} s`);
}

// ---------- Ablauf einer Runde ----------
{
  const records = [];
  GK.casino.record = (game, bet, payout, text) => records.push({ game, bet, payout, text });
  GK.sound = { play() {} };
  const realFloat = GK.rng.float;
  const force = ok => { GK.rng.float = () => (ok ? 0 : 0.999999); };
  const s = M.state();
  GK.state.money = 10000;
  s.bet = 100;
  s.diff = 'normal';

  // Start: Einsatz wird abgebucht
  assert(M.startRound() && GK.state.money === 9900 && s.round && s.round.steps === 0, 'Start bucht den Einsatz ab');
  assert(M.finishRound(false) === 0 && GK.state.money === 9900 && s.round, 'ohne Schritt kein Auszahlen');
  // Drei sichere Schritte, dann auszahlen
  force(true);
  for (let i = 1; i <= 3; i++) {
    const r = M.decideStep();
    assert(r.safe && r.lane === i && s.round.steps === i, `Schritt ${i} geschafft`);
  }
  const pay = M.finishRound(false);
  assert(pay === Math.floor(100 * M.multiplierAt('normal', 3)), `Auszahlen nach 3 Schritten: ${pay}`);
  assert(GK.state.money === 9900 + pay && !s.round && s.last && s.last.payout === pay, 'Gewinn gutgeschrieben, Runde beendet');
  assert(M.finishRound(false) === 0 && GK.state.money === 9900 + pay, 'keine doppelte Auszahlung');
  assert(M.decideStep() === null, 'nach dem Auszahlen kein weiterer Schritt');
  assert(records.length === 1 && records[0].payout === pay, 'Runde im Verlauf');

  // Neue Runde, zweiter Schritt geht schief
  let money = GK.state.money;
  assert(M.startRound() && GK.state.money === money - 100, 'Neustart bucht wieder ab');
  force(true);
  M.decideStep();
  force(false);
  const lost = M.decideStep();
  assert(!lost.safe && lost.done && !s.round && s.last.hit && s.last.steps === 1, 'Zusammenstoß beendet die Runde');
  assert(GK.state.money === money - 100, 'verlorener Einsatz bleibt weg');
  assert(M.finishRound(false) === 0 && M.decideStep() === null, 'nach dem Zusammenstoß nichts mehr auszahlen');
  assert(records.length === 2 && records[1].payout === 0, 'Verlust im Verlauf');

  // Bis ins Ziel: automatische Auszahlung genau einmal
  ['easy', 'insane'].forEach(d => {
    s.diff = d;
    money = GK.state.money;
    M.startRound();
    force(true);
    let res;
    for (let i = 0; i < M.LANES; i++) res = M.decideStep();
    const expected = Math.floor(100 * M.multiplierAt(d, M.LANES));
    assert(res.done && res.payout === expected && !s.round, `${d}: Ziel zahlt automatisch ${expected}`);
    assert(GK.state.money === money - 100 + expected, `${d}: Kontostand nach dem Ziel`);
    assert(M.decideStep() === null && M.finishRound(true) === 0, `${d}: im Ziel keine doppelte Auszahlung`);
  });

  // Zu wenig Geld: keine Runde
  GK.state.money = 50;
  s.bet = 100;
  const ui = GK.casino.chickenMath;
  let started = true;
  try { started = ui.startRound(); } catch (e) { started = 'Fehler'; }
  assert(started === false && !s.round && GK.state.money === 50, 'ohne genug Geld startet keine Runde');
  GK.rng.float = realFloat;

  // Alte Spielstände ohne Chicken-Daten bekommen Standardwerte
  delete GK.state.casino.games.chicken;
  const fresh = M.state();
  assert(fresh.bet === 100 && fresh.diff === 'normal' && fresh.round === null && Array.isArray(fresh.history), 'Standardwerte für alte Spielstände');
}

console.log(process.exitCode ? 'Chicken-Road-Tests FEHLGESCHLAGEN' : 'Chicken-Road-Tests bestanden.');
