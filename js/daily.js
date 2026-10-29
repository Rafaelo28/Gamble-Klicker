// Tägliche Aufgaben: Jeden Tag gibt es drei neue Aufgaben (eine im Klicker, eine im Casino, eine gemischt).
// Jede geschaffte Aufgabe bringt eine Belohnung, die man unter „Fortschritt“ abholt; wer alle drei schafft,
// bekommt einen Bonus, der mit jedem Tag in Folge wächst (Serie). Der Fortschritt wird über kleine Meldungen
// aus dem Spiel gezählt (GK.daily.track). Nicht abgeholte Belohnungen werden um Mitternacht gutgeschrieben.
window.GK = window.GK || {};

(function () {
  const TASKS = 3;
  const STREAK_STEP = 0.25;   // +25 % Bonus je Tag in Folge …
  const STREAK_MAX = 4;       // … höchstens +100 %

  let now = () => new Date();  // für Tests austauschbar
  let lastHtml = '';

  const pick = list => list[GK.rng.int(list.length)];
  const plural = (n, one, many) => (n === 1 ? one : many);

  // Runde Zielwerte: 1.234.567 → 1.250.000
  function nice(x) {
    if (x < 1000) return Math.max(100, Math.round(x / 100) * 100);
    const p = Math.pow(10, Math.floor(Math.log10(x)) - 1);
    return Math.ceil(x / p / 2.5) * 2.5 * p;
  }

  function gameInfo(id) {
    return GK.casino.list().find(g => g.id === id) || null;
  }

  // Spiele, die für „Spiele X Runden …“ in Frage kommen (schnelle Runden, keine langen Turniere)
  function quickGames() {
    return GK.casino.list().filter(g => ['quick', 'slots', 'table'].includes(g.category) && g.id !== 'poker');
  }

  const isFriendsGame = id => id === 'poker' || (gameInfo(id) && gameInfo(id).category === 'friends');

  // ---------- Aufgaben ----------
  // make(): Ziel und Zusatzwerte · on(type, value, task): neuer Fortschritt oder null · text(task)

  const DEFS = {
    clicks: {
      group: 'clicker', icon: '👆',
      make: () => ({ target: pick([300, 400, 500, 600, 800]) }),
      text: t => `Klicke ${GK.formatNumber(t.target)}-mal auf die Dublone`,
      on: (type, v, t) => (type === 'click' ? t.progress + v : null),
    },
    combo: {
      group: 'clicker', icon: '🔥',
      make: () => ({ target: GK.state.bestCombo >= 60 ? 50 : 30 }),
      text: t => `Schaffe eine Klick-Combo von ${t.target}`,
      on: (type, v, t) => (type === 'combo' ? Math.max(t.progress, v) : null),
    },
    buildings: {
      group: 'clicker', icon: '🏗️',
      make: () => ({ target: pick([5, 10, 15]) }),
      text: t => `Kaufe ${t.target} ${plural(t.target, 'Gebäude', 'Gebäude')}`,
      on: (type, v, t) => (type === 'building' ? t.progress + v : null),
    },
    upgrades: {
      group: 'clicker', icon: '⬆️',
      possible: () => GK.clicker.remainingUpgrades() >= 3,
      make: () => ({ target: pick([1, 2]) }),
      text: t => `Kaufe ${t.target} ${plural(t.target, 'Upgrade', 'Upgrades')}`,
      on: (type, v, t) => (type === 'upgrade' ? t.progress + v : null),
    },
    golden: {
      group: 'clicker', icon: '✨',
      make: () => ({ target: pick([1, 2, 3]) }),
      text: t => `Fange ${t.target} goldene ${plural(t.target, 'Dublone', 'Dublonen')}`,
      on: (type, v, t) => (type === 'golden' ? t.progress + v : null),
    },
    earn: {
      group: 'clicker', icon: '💰',
      make: () => ({ target: nice(Math.max(2000, GK.clicker.getCpsPermanent() * 900)) }),
      text: t => `Verdiene ${GK.formatMoneyHTML(t.target)} mit Klicks und Gebäuden`,
      on: (type, v, t) => (type === 'earn' ? t.progress + v : null),
    },
    rounds: {
      group: 'casino', icon: '🎲',
      make: () => ({ target: pick([10, 15, 20, 25]) }),
      text: t => `Spiele ${t.target} ${plural(t.target, 'Runde', 'Runden')} im Casino`,
      on: (type, v, t) => (type === 'round' && v.game !== 'sideSlot' ? t.progress + 1 : null),
    },
    variety: {
      group: 'casino', icon: '🎰',
      make: () => ({ target: pick([3, 4, 5]), games: [] }),
      text: t => `Spiele ${t.target} verschiedene Casino-Spiele`,
      on: (type, v, t) => {
        if (type !== 'round' || v.game === 'sideSlot' || t.games.includes(v.game)) return null;
        t.games.push(v.game);
        return t.games.length;
      },
    },
    game: {
      group: 'casino', icon: '🃏',
      make: () => {
        const g = pick(quickGames());
        return { target: pick([3, 5]), game: g.id };
      },
      text: t => `Spiele ${t.target} ${plural(t.target, 'Runde', 'Runden')} ${GK.casino.gameName(t.game)}`,
      on: (type, v, t) => (type === 'round' && v.game === t.game ? t.progress + 1 : null),
    },
    wins: {
      group: 'casino', icon: '🏆',
      make: () => ({ target: pick([3, 5, 8]) }),
      text: t => `Gewinne ${t.target} ${plural(t.target, 'Runde', 'Runden')} im Casino`,
      on: (type, v, t) => (type === 'round' && v.game !== 'sideSlot' && v.payout > v.bet ? t.progress + 1 : null),
    },
    bigHit: {
      group: 'casino', icon: '🎯',
      make: () => ({ target: 1, mult: pick([5, 10]) }),
      text: t => `Hol im Casino einen Treffer mit mindestens ×${t.mult}`,
      on: (type, v, t) => (type === 'round' && v.bet > 0 && v.payout >= v.bet * t.mult ? 1 : null),
    },
    friends: {
      group: 'mixed', icon: '👥',
      make: () => ({ target: 1 }),
      text: () => 'Spiele eine Partie mit Freunden oder gegen Computer (Spiele mit Freunden oder Poker)',
      on: (type, v, t) => (type === 'round' && isFriendsGame(v.game) ? t.progress + 1 : null),
    },
  };

  // ---------- Tage ----------

  function dayKey(date) {
    const pad = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  const today = () => dayKey(now());

  function yesterday() {
    const d = now();
    d.setDate(d.getDate() - 1);
    return dayKey(d);
  }

  function msUntilTomorrow() {
    const d = now();
    const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    return next - d;
  }

  function data() {
    return GK.state.daily;
  }

  // Drei Aufgaben auslosen: eine im Klicker, eine im Casino, eine beliebige weitere
  function makeTasks() {
    const ids = Object.keys(DEFS).filter(id => !DEFS[id].possible || DEFS[id].possible());
    const from = group => ids.filter(id => DEFS[id].group === group);
    const chosen = [pick(from('clicker')), pick(from('casino'))];
    const rest = ids.filter(id => !chosen.includes(id) && (id !== 'friends' || GK.rng.float() < 0.5));
    chosen.push(pick(rest));
    return chosen.slice(0, TASKS).map(id => Object.assign({ id, progress: 0, done: false, claimed: false }, DEFS[id].make()));
  }

  // Belohnung je Aufgabe: 10 Minuten Einkommen, mindestens 50 Klicks bzw. 500 Dublonen
  function reward() {
    return Math.floor(Math.max(500, GK.clicker.getCpsPermanent() * 600, GK.clicker.getClickPower() * 50));
  }

  // Bonus für alle drei: doppelte Belohnung, +25 % je Tag in Folge (höchstens +100 %)
  function streakNow() {
    const d = data();
    return d.bonusDay === yesterday() || d.bonusDay === today() ? d.streak : 0;
  }

  function bonusMult() {
    const d = data();
    const before = d.bonusDay === today() ? d.streak - 1 : streakNow();
    return 1 + STREAK_STEP * Math.min(STREAK_MAX, Math.max(0, before));
  }

  function bonusAmount() {
    return Math.floor(reward() * 2 * bonusMult());
  }

  // Neuer Tag? Nicht abgeholte Belohnungen gutschreiben und neue Aufgaben auslosen
  function ensureDay() {
    const d = data();
    if (d.day === today() && d.tasks.length) return false;
    if (d.day && d.tasks.length) {
      let paid = 0;
      d.tasks.forEach(t => {
        if (t.done && !t.claimed) {
          t.claimed = true;
          paid += reward();
        }
      });
      if (d.tasks.every(t => t.done) && d.bonusDay !== d.day) {
        // Der Bonus zählt für den alten Tag (die Serie läuft also weiter)
        const before = d.bonusDay === dayBefore(d.day) ? d.streak : 0;
        paid += Math.floor(reward() * 2 * (1 + STREAK_STEP * Math.min(STREAK_MAX, before)));
        d.streak = before + 1;
        d.bonusDay = d.day;
        d.bonuses++;
      }
      if (paid > 0) {
        GK.earn(paid, 'daily');
        if (GK.notify) GK.notify(`<span class="notify-icon">📅</span><span><b>Belohnungen von gestern</b><br>Nicht abgeholt – trotzdem gutgeschrieben: +${GK.formatMoneyHTML(paid)}</span>`, 7000);
      }
    }
    d.day = today();
    d.tasks = makeTasks();
    lastHtml = '';
    return true;
  }

  function dayBefore(key) {
    const [y, m, dd] = key.split('-').map(Number);
    return dayKey(new Date(y, m - 1, dd - 1));
  }

  // ---------- Fortschritt zählen ----------

  function track(type, value = 1) {
    const d = data();
    if (!d || !d.tasks || !d.tasks.length || d.day !== today()) return;
    d.tasks.forEach(t => {
      if (t.done || !DEFS[t.id]) return;
      const next = DEFS[t.id].on(type, value, t);
      if (next == null) return;
      t.progress = Math.min(t.target, next);
      if (t.progress >= t.target) {
        t.done = true;
        d.completed++;
        lastHtml = '';
        if (GK.sound) GK.sound.play('achievement');
        if (GK.notify) GK.notify(`<span class="notify-icon">${DEFS[t.id].icon}</span><span><b>Tägliche Aufgabe geschafft!</b><br>${DEFS[t.id].text(t)} – hol dir die Belohnung unter <b>Fortschritt</b>.</span>`, 6000);
        updateBadge();
      }
    });
  }

  // ---------- Abholen ----------

  function claim(index) {
    const d = data();
    const t = d.tasks[index];
    if (!t || !t.done || t.claimed || d.day !== today()) return 0;
    const amount = reward();
    t.claimed = true;
    GK.earn(amount, 'daily');
    GK.save();
    lastHtml = '';
    updateBadge();
    return amount;
  }

  function claimBonus() {
    const d = data();
    if (d.day !== today() || d.bonusDay === today() || !d.tasks.every(t => t.claimed)) return 0;
    const amount = bonusAmount();
    d.streak = streakNow() + 1;
    d.bonusDay = today();
    d.bonuses++;
    GK.earn(amount, 'daily');
    GK.save();
    lastHtml = '';
    updateBadge();
    return amount;
  }

  // Wie viele Belohnungen warten?
  function claimable() {
    const d = data();
    if (!d || d.day !== today()) return 0;
    const tasks = d.tasks.filter(t => t.done && !t.claimed).length;
    const bonus = d.tasks.length && d.tasks.every(t => t.claimed) && d.bonusDay !== today() ? 1 : 0;
    return tasks + bonus;
  }

  // ---------- Darstellung ----------

  function updateBadge() {
    if (typeof document === 'undefined' || !document.querySelector) return;
    const badge = document.querySelector('.tab[data-tab="progress"] .tab-badge');
    if (!badge) return;
    const n = claimable();
    badge.hidden = !n;
    badge.textContent = n;
  }

  function render() {
    const list = document.getElementById('daily-tasks');
    if (!list) return;
    const d = data();
    const rewardNow = reward();
    const html = d.tasks.map((t, i) => {
      const def = DEFS[t.id];
      const pct = Math.min(100, (t.progress / t.target) * 100);
      const count = `${GK.formatNumber(Math.floor(t.progress))} / ${GK.formatNumber(t.target)}`;
      return `<div class="daily-task ${t.done ? 'done' : ''} ${t.claimed ? 'claimed' : ''}">
        <div class="daily-icon">${def.icon}</div>
        <div class="daily-body">
          <div class="daily-text">${def.text(t)}</div>
          <div class="daily-bar"><span style="width:${pct}%"></span></div>
          <div class="daily-meta"><span>${count}</span><span>🎁 +${GK.formatMoneyHTML(rewardNow)}</span></div>
        </div>
        <button type="button" class="btn ${t.claimed ? '' : 'btn-primary'} daily-claim" data-i="${i}" ${t.done && !t.claimed ? '' : 'disabled'}>${t.claimed ? '✅ Abgeholt' : t.done ? '🎁 Abholen' : '⏳ Offen'}</button>
      </div>`;
    }).join('');
    const allClaimed = d.tasks.every(t => t.claimed);
    const bonusDone = d.bonusDay === today();
    const streak = bonusDone ? d.streak : streakNow();
    const bonus = `<div class="daily-bonus-text">
        <b>🔥 Alle drei geschafft:</b> +${GK.formatMoneyHTML(bonusAmount())}
        <span class="muted small">${streak ? `Serie: ${streak} ${plural(streak, 'Tag', 'Tage')} in Folge` : 'Schaff alle drei an mehreren Tagen hintereinander – der Bonus wächst!'}${bonusMult() > 1 ? ` (Bonus +${Math.round((bonusMult() - 1) * 100)} %)` : ''}</span>
      </div>
      <button type="button" class="btn ${bonusDone ? '' : 'btn-primary'} daily-bonus-btn" ${allClaimed && !bonusDone ? '' : 'disabled'}>${bonusDone ? '✅ Abgeholt' : '🎁 Bonus abholen'}</button>`;
    const reset = `Neue Aufgaben in ${GK.formatDuration(Math.max(60, Math.ceil(msUntilTomorrow() / 60000) * 60))}`;
    const full = html + '|' + bonus + '|' + reset;
    if (full === lastHtml) return;
    lastHtml = full;
    list.innerHTML = html;
    document.getElementById('daily-bonus').innerHTML = bonus;
    document.getElementById('daily-reset').textContent = reset;
  }

  function onClick(e) {
    const btn = e.target.closest('.daily-claim, .daily-bonus-btn');
    if (!btn || btn.disabled) return;
    const amount = btn.classList.contains('daily-bonus-btn') ? claimBonus() : claim(Number(btn.dataset.i));
    if (!amount) return;
    const pos = GK.fx.center(btn);
    GK.sound.play(btn.classList.contains('daily-bonus-btn') ? 'jackpot' : 'collect');
    GK.fx.burst(pos.x, pos.y, { count: 24, speed: 600 });
    GK.fx.floatText(pos.x, pos.y - 20, `+${GK.formatMoneyHTML(amount)}`, 'win big');
    render();
  }

  // Aus der Spielschleife: Tageswechsel prüfen, Abzeichen und (wenn sichtbar) die Liste aktualisieren
  function update(visible) {
    if (ensureDay()) GK.save();
    updateBadge();
    if (visible) render();
  }

  function init() {
    ensureDay();
    const panel = document.getElementById('daily-panel');
    if (panel) panel.addEventListener('click', onClick);
    updateBadge();
  }

  GK.daily = {
    init, update, track, claim, claimBonus, claimable, render,
    // für Tests
    DEFS, makeTasks, ensureDay, reward, bonusAmount, today,
    _setNow: fn => { now = fn; },
  };
})();
