// Einstiegspunkt: Spielschleife, Tabs, Statistiken und Autosave.
window.GK = window.GK || {};

// Sprache: Ersatz, falls js/i18n.js (noch) nicht geladen ist – gibt den deutschen Text zurück.
GK.t = GK.t || function (s, v) { s = String(s); return v ? s.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m)) : s; };
GK.i18n = GK.i18n || { add() {}, addHtml() {}, apply() {}, set() {}, lang: 'de' };

GK.i18n.add({
  'Gamble Klicker ist in einem anderen Tab offen': 'Gamble Klicker is open in another tab',
  'Damit nichts verloren geht, läuft das Spiel immer nur in einem Tab. Hier ist es pausiert.': 'So that nothing gets lost, the game only runs in one tab at a time. It is paused here.',
  'Hier weiterspielen': 'Continue playing here',
  'Erst die laufende Runde beenden: {text}': 'Finish the running round first: {text}',
  'Spielstand gespeichert ✅': 'Game saved ✅',
  'Speichern nicht möglich ⚠️': 'Saving not possible ⚠️',
  'Ungültiger Spielstand-Code ⚠️': 'Invalid save code ⚠️',
  'Spielstand geladen ✅': 'Game loaded ✅',
  'Willst du wirklich deinen kompletten Spielstand löschen? Das kann nicht rückgängig gemacht werden.':
    'Do you really want to delete your entire save? This cannot be undone.',
  'Spielstand zurückgesetzt': 'Save reset',
  '👤 Dein Name: {name}': '👤 Your name: {name}',
  '{done} von {total}': '{done} of {total}',
  ' <span class="muted">(ausgeschaltet)</span>': ' <span class="muted">(switched off)</span>',
  '{money} Dublonen – Gamble Klicker': '{money} doubloons – Gamble Klicker',
  '⚠️ Speichern nicht möglich – Details unter Statistiken': '⚠️ Saving not possible – see Statistics for details',
  'vor {time}': '{time} ago',
  'nicht möglich': 'not possible',
  'Kopiere diesen Code und bewahre ihn auf. Mit „Importieren“ kannst du ihn später (auch auf einem anderen Gerät) wieder laden.':
    'Copy this code and keep it safe. Use “Import” to load it again later (even on another device).',
  'Füge hier deinen Spielstand-Code ein und klicke auf „Laden“. Dein aktueller Fortschritt wird dabei ersetzt.':
    'Paste your save code here and click “Load”. Your current progress will be replaced.',
});

(function () {
  const AUTOSAVE_INTERVAL = 5000;  // ms
  const RENDER_INTERVAL = 100;     // ms
  const CHECK_INTERVAL = 1000;     // ms – Erfolge prüfen
  const MAX_CATCH_UP = 8 * 3600;   // Sekunden, die ein Hintergrund-Tab nachgeholt wird

  let lastTick = performance.now();
  let lastRender = 0;
  let lastCheck = 0;
  let hiddenAt = null;

  function $(id) {
    return document.getElementById(id);
  }

  // Kurze Meldung unten. Emojis im Text werden zu eigenen Symbolen (js/icons.js); icon: Symbol davor
  GK.toast = function (message, icon) {
    const el = $('toast');
    if (GK.iconText) el.innerHTML = (icon ? GK.icon(...[].concat(icon)) + ' ' : '') + GK.iconText(message);
    else el.textContent = message;
    el.classList.add('show');
    clearTimeout(GK.toast.timer);
    GK.toast.timer = setTimeout(() => el.classList.remove('show'), 2500);
  };

  // Größere Meldung unten rechts (Erfolge, goldene Dublone …); mehrere stapeln sich
  GK.notify = function (html, duration = 5000) {
    const el = document.createElement('div');
    el.className = 'notify';
    el.innerHTML = html;
    // Emojis in Meldungen (Erfolge, Aufgaben …) durch eigene Symbole ersetzen
    if (GK.iconifyEmoji) GK.iconifyEmoji(el);
    el.addEventListener('click', () => el.remove());
    const stack = $('notify-stack');
    stack.appendChild(el);
    // Höchstens 3 Meldungen gleichzeitig – die älteste verschwindet zuerst
    while (stack.children.length > 3) stack.firstChild.remove();
    setTimeout(() => el.classList.add('hide'), duration);
    setTimeout(() => el.remove(), duration + 400);
  };

  function showTab(name) {
    if (!document.getElementById('tab-' + name)) name = 'clicker';
    GK.state.ui.tab = name;
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
    document.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === 'tab-' + name);
    });
    if (name === 'casino') GK.casino.show();
    if (name !== 'clicker') GK.sideSlot.stopAuto();
  }

  // Höhe der festen Kopfzeile merken (die Klick-Münze bleibt darunter stehen)
  function updateHeaderHeight() {
    const header = document.querySelector('.app-header');
    document.documentElement.style.setProperty('--header-height', header.offsetHeight + 'px');
  }

  function setupTabs() {
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        if (tab.dataset.tab !== GK.state.ui.tab) GK.sound.play('tick');
        showTab(tab.dataset.tab);
      });
    });
  }

  // Nach Import/Zurücksetzen alles neu aufbauen – im aktuell geöffneten Tab bleiben
  function refreshAll() {
    const currentTab = document.querySelector('.tab.active').dataset.tab;
    // Ein laufender Bosskampf gehört zum alten Spielstand (sein Sieg darf nicht im neuen landen),
    // ebenso eine noch sichtbare Kraken-Anzeige
    GK.boss.stop();
    GK.kraken.reset();
    GK.clicker.refresh();
    GK.cosmetics.refresh();
    GK.casino.refresh();
    GK.sideSlot.refresh();
    GK.poker.mp.resume();
    GK.room.resume();
    renderSettings();
    GK.sound.applyVolume();
    GK.achievements.refresh();
    showTab(currentTab);
    render();
  }

  function setupStatsActions() {
    $('save-btn').addEventListener('click', () => {
      GK.toast(GK.save() ? GK.t('Spielstand gespeichert ✅') : GK.t('Speichern nicht möglich ⚠️'));
    });
    $('export-btn').addEventListener('click', () => {
      openTransferBox('export');
    });
    $('import-btn').addEventListener('click', () => {
      openTransferBox('import');
    });
    $('transfer-close').addEventListener('click', () => {
      $('transfer-box').hidden = true;
    });
    $('transfer-confirm').addEventListener('click', () => {
      // Mit einer laufenden Runde nicht importieren (sie ginge verloren)
      const running = GK.casino.runningRound();
      if (running) {
        GK.toast(GK.t('Erst die laufende Runde beenden: {text}', { text: running.text }));
        return;
      }
      if (!GK.importSave($('transfer-text').value)) {
        GK.toast(GK.t('Ungültiger Spielstand-Code ⚠️'));
        return;
      }
      $('transfer-box').hidden = true;
      refreshAll();
      GK.toast(GK.t('Spielstand geladen ✅'));
    });
    $('reset-btn').addEventListener('click', () => {
      if (!confirm(GK.t('Willst du wirklich deinen kompletten Spielstand löschen? Das kann nicht rückgängig gemacht werden.'))) return;
      GK.resetSave();
      refreshAll();
      GK.toast(GK.t('Spielstand zurückgesetzt'));
    });
  }

  // ---------- Einstellungen ----------

  // Spielweiter Name und Bild (nicht überschreiben, während man tippt)
  function renderPlayer() {
    if (document.activeElement !== $('set-name')) $('set-name').value = GK.player.name();
    GK.setHTML($('set-avatar'), GK.figure.avatarHTML());
    GK.figure.render();
  }

  function renderSettings() {
    renderPlayer();
    const st = GK.state.settings;
    $('set-sound').checked = st.sound;
    $('set-volume').value = st.volume;
    $('set-volume').disabled = !st.sound;
    $('set-effects').value = st.effects;
    $('set-lang').value = st.lang === 'en' ? 'en' : 'de';
    $('set-kraken').checked = st.kraken !== false;
    GK.setHTML($('sound-toggle'), GK.icon(st.sound ? 'sound' : 'mute'));
    $('sound-toggle').classList.toggle('off', !st.sound);
    document.body.classList.toggle('reduced-effects', st.effects === 'reduced');
  }

  function setupSettings() {
    $('set-name').addEventListener('change', e => {
      e.target.value = GK.player.setName(e.target.value);
      GK.sound.play('coin');
      GK.toast(GK.t('👤 Dein Name: {name}', { name: e.target.value }));
    });
    $('set-lang').addEventListener('change', e => {
      // Sprache speichern und neu laden: so werden auch zwischengespeicherte Anzeigen
      // (Render-Caches in einzelnen Modulen) sauber in der neuen Sprache aufgebaut.
      // Laufende Runden sind gespeichert, Neuladen kostet nichts.
      GK.i18n.set(e.target.value);
      location.reload();
    });
    $('set-name').addEventListener('keydown', e => { if (e.key === 'Enter') e.target.blur(); });
    $('set-avatar').addEventListener('click', () => {
      // Mit eigener Figur: zum Baukasten (gleich darunter), sonst nächstes Emoji
      if (GK.figure.mine()) {
        document.getElementById('figure-editor').scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      GK.player.nextAvatar();
      renderPlayer();
      GK.sound.play('chip');
    });
    $('sound-toggle').addEventListener('click', () => {
      GK.sound.setEnabled(!GK.state.settings.sound);
      renderSettings();
      GK.sound.play('coin');
    });
    $('set-sound').addEventListener('change', e => {
      GK.sound.setEnabled(e.target.checked);
      renderSettings();
      GK.sound.play('coin');
    });
    $('set-volume').addEventListener('input', e => GK.sound.setVolume(Number(e.target.value)));
    $('set-volume').addEventListener('change', () => GK.sound.play('coin'));
    $('set-effects').addEventListener('change', e => {
      GK.state.settings.effects = e.target.value;
      GK.save();
      renderSettings();
    });
    $('set-kraken').addEventListener('change', e => {
      GK.kraken.setEnabled(e.target.checked);
      renderSettings();
    });
    renderSettings();
  }

  function openTransferBox(mode) {
    const isExport = mode === 'export';
    $('transfer-box').hidden = false;
    $('transfer-confirm').hidden = isExport;
    $('transfer-hint').textContent = isExport
      ? GK.t('Kopiere diesen Code und bewahre ihn auf. Mit „Importieren“ kannst du ihn später (auch auf einem anderen Gerät) wieder laden.')
      : GK.t('Füge hier deinen Spielstand-Code ein und klicke auf „Laden“. Dein aktueller Fortschritt wird dabei ersetzt.');
    $('transfer-text').value = isExport ? GK.exportSave() : '';
    $('transfer-text').readOnly = isExport;
    $('transfer-text').focus();
    if (isExport) $('transfer-text').select();
  }

  // Kurz „gespeichert“ in der Kopfzeile aufblinken lassen
  function flashSaveIndicator() {
    const el = $('save-indicator');
    el.classList.add('show');
    clearTimeout(flashSaveIndicator.timer);
    flashSaveIndicator.timer = setTimeout(() => el.classList.remove('show'), 1200);
  }

  function renderStats() {
    const s = GK.state;
    if (s.ui.tab === 'casino') GK.friends.render();
    // Alles Weitere steht im Statistik-Tab – nur schreiben, wenn er offen ist
    if (s.ui.tab !== 'stats') return;
    GK.setHTML($('stat-money'), GK.formatMoneyHTML(s.money));
    GK.setHTML($('stat-total'), GK.formatMoneyHTML(s.totalEarned));
    GK.setHTML($('stat-all-time'), GK.formatMoneyHTML(s.allTimeEarned));
    GK.setText($('stat-golden'), GK.formatNumber(s.goldenClicks));
    GK.setText($('stat-achievements'), GK.t('{done} von {total}', { done: s.achievements.length, total: GK.achievements.total }));
    GK.setHTML($('stat-click-earned'), GK.formatMoneyHTML(s.clickEarned));
    GK.setText($('stat-clicks'), GK.formatNumber(s.totalClicks));
    GK.setText($('stat-crits'), GK.formatNumber(s.crits));
    GK.setText($('stat-combo'), GK.formatNumber(s.bestCombo));
    GK.setHTML($('stat-cps'), GK.formatMoneyHTML(GK.clicker.getCps(), true) + (GK.clicker.passiveActive() ? '' : GK.t(' <span class="muted">(ausgeschaltet)</span>')));
    GK.setText($('stat-buildings'), GK.formatNumber(GK.clicker.totalBuildings()));
    GK.setText($('stat-upgrades'), GK.formatNumber(s.upgrades.length));
    GK.setText($('stat-playtime'), GK.formatDuration(s.playTime));
    GK.casino.renderAllStats($('game-stats-all'));
    GK.friends.render();
    renderPlayer();
    GK.setText($('last-saved'), GK.storageAvailable
      ? GK.t('vor {time}', { time: GK.formatDuration(Math.max(0, GK.now() - s.lastSaved) / 1000) })
      : GK.t('nicht möglich'));
  }

  // Ein Fehler in einem Bereich (z. B. durch einen beschädigten Spielstand) darf nicht das ganze Spiel anhalten:
  // Jeder Bereich läuft für sich, ein Fehler wird einmal gemeldet und der Rest läuft weiter.
  const failed = new Set();
  function safe(name, fn) {
    try {
      fn();
    } catch (e) {
      if (!failed.has(name)) {
        failed.add(name);
        console.error(`Bereich „${name}“ fehlgeschlagen:`, e);
      }
    }
  }

  function render() {
    safe('Kopfzeile', () => {
      const money = GK.formatNumber(GK.state.money);
      GK.setText($('money'), money);
      GK.setText($('cps'), GK.formatNumber(GK.clicker.getCps(), true));
      $('cps-on').hidden = !GK.clicker.passiveActive();
      $('cps-off').hidden = GK.clicker.passiveActive();
      const title = GK.t('{money} Dublonen – Gamble Klicker', { money });
      if (document.title !== title) document.title = title;
    });
    safe('Klicker', () => GK.clicker.render());
    safe('Seiten-Slot', () => GK.sideSlot.render());
    safe('Casino', () => GK.casino.render());
    safe('Fortschritt', () => GK.progress.update(GK.state.ui.tab === 'progress'));
    safe('Flotte', () => GK.fleet.update(GK.state.ui.tab === 'adventure'));
    safe('Bosskampf', () => GK.boss.update(GK.state.ui.tab === 'adventure'));
    safe('Tagesaufgaben', () => GK.daily.update(GK.state.ui.tab === 'progress'));
    if (GK.state.ui.tab === 'progress') {
      safe('Erfolge', () => GK.achievements.render());
      safe('Schatzkammer', () => GK.cosmetics.render());
    }
    safe('Statistiken', renderStats);
  }

  function loop(now) {
    // Begrenzen, damit ein lange inaktiver Tab nicht auf einmal riesige Sprünge macht
    const seconds = Math.min((now - lastTick) / 1000, 1);
    lastTick = now;
    GK.state.playTime += seconds;
    safe('Einkommen', () => GK.clicker.tick(seconds));
    safe('Kraken', () => GK.kraken.update(seconds));

    if (now - lastCheck >= CHECK_INTERVAL) {
      lastCheck = now;
      safe('Ränge', () => GK.rank.check());
      safe('Erfolge prüfen', () => GK.achievements.check());
    }
    if (now - lastRender >= RENDER_INTERVAL) {
      lastRender = now;
      render();
    }
    requestAnimationFrame(loop);
  }

  // Im Hintergrund-Tab läuft die Spielschleife nicht – die Zeit wird bei der Rückkehr nachgeholt
  function onVisibilityChange() {
    if (document.visibilityState === 'hidden') {
      hiddenAt = GK.now();
      GK.save();
    } else if (hiddenAt) {
      const seconds = Math.min((GK.now() - hiddenAt) / 1000, MAX_CATCH_UP);
      hiddenAt = null;
      if (seconds > 1) {
        GK.state.playTime += seconds;
        GK.clicker.tick(seconds);
      }
      lastTick = performance.now();
    }
  }

  // ---------- Nur ein Tab spielt ----------
  // Zwei offene Tabs speichern abwechselnd ihren eigenen Stand – das verliert Fortschritt und ließe sich nutzen,
  // um Verluste zurückzuspulen (bei Verlust den einen Tab schließen, der andere schreibt den alten Stand zurück).
  // Darum spielt immer der zuletzt geöffnete Tab; andere Tabs speichern nichts mehr und zeigen eine Pause-Seite.
  const TAB_KEY = 'gamble-klicker-tab';
  const PAUSED = /[?&]pausiert=1(&|$)/.test(location.search);
  const tabId = Math.random().toString(36).slice(2) + Date.now().toString(36);

  // Ein anderer Tab hat übernommen: hier nichts mehr speichern und die Pause-Seite zeigen
  function pauseTab() {
    if (GK.paused) return;
    GK.paused = true; // GK.save schreibt ab jetzt nichts mehr (der andere Tab hat den neueren Stand)
    location.replace(location.pathname + '?pausiert=1');
  }

  // Gehört das Spiel inzwischen einem anderen Tab? (fremde Kennung im Speicher)
  function otherTabOwns(value) {
    let other = null;
    try {
      other = JSON.parse(value);
    } catch (err) {
      return false;
    }
    return !!other && typeof other === 'object' && other.id !== tabId;
  }

  function claimTab() {
    try {
      localStorage.setItem(TAB_KEY, JSON.stringify({ id: tabId, t: Date.now() }));
    } catch (e) {
      // Ohne Speicher gibt es auch nichts zu überschreiben
    }
    window.addEventListener('storage', e => {
      if (e.key === TAB_KEY && e.newValue && otherTabOwns(e.newValue)) pauseTab();
    });
    // Zusätzlich vor jedem Speichern nachsehen (GK.save, js/state.js): Ein eingefrorener Hintergrund-Tab
    // (iPad) bekommt das storage-Ereignis manchmal erst, nachdem sein Speichern schon gelaufen wäre –
    // er würde dann den neueren Stand des anderen Tabs überschreiben.
    GK.tabLost = () => {
      let value = null;
      try {
        value = localStorage.getItem(TAB_KEY);
      } catch (e) {
        return false;
      }
      if (!value || !otherTabOwns(value)) return false;
      pauseTab();
      return true;
    };
  }

  function showPausedPage() {
    const box = document.createElement('div');
    box.className = 'tab-paused';
    box.innerHTML = `<div class="tab-paused-box">
      <div class="tab-paused-icon">${GK.icon ? GK.icon('anchor') : '⚓'}</div>
      <h2>${GK.t('Gamble Klicker ist in einem anderen Tab offen')}</h2>
      <p>${GK.t('Damit nichts verloren geht, läuft das Spiel immer nur in einem Tab. Hier ist es pausiert.')}</p>
      <button type="button" class="btn btn-primary btn-big tab-paused-go">${GK.t('Hier weiterspielen')}</button>
    </div>`;
    document.body.appendChild(box);
    box.querySelector('.tab-paused-go').addEventListener('click', () => location.replace(location.pathname));
  }

  function init() {
    GK.load();
    GK.i18n.init();
    if (PAUSED) {
      // Pause-Seite: nur lesen (für die Sprache), nichts speichern, keine Spielschleife
      GK.paused = true;
      if (history.replaceState) history.replaceState(null, '', location.pathname);
      showPausedPage();
      return;
    }
    claimTab();
    GK.room.readInviteLink();
    GK.poker.mp.readInviteLink();
    GK.onSave = flashSaveIndicator;
    if (!GK.storageAvailable) {
      $('storage-warning').hidden = false;
      GK.toast(GK.t('⚠️ Speichern nicht möglich – Details unter Statistiken'));
    }
    setupTabs();
    setupStatsActions();
    setupSettings();
    GK.fx.init();
    updateHeaderHeight();
    if (window.ResizeObserver) new ResizeObserver(updateHeaderHeight).observe(document.querySelector('.app-header'));
    else window.addEventListener('resize', updateHeaderHeight);
    GK.clicker.init();
    GK.cosmetics.init();
    GK.progress.init();
    GK.progress.applyOfflineEarnings();
    GK.fleet.init();
    GK.casino.init();
    GK.daily.init();
    GK.sideSlot.init();
    GK.poker.mp.resume();
    GK.room.resume();
    showTab(GK.state.ui.tab);
    GK.achievements.check();
    render();

    // Automatisch speichern: regelmäßig, beim Wechsel in einen anderen Tab/App
    // und beim Schließen bzw. Neuladen (pagehide funktioniert auch auf dem Handy)
    setInterval(GK.save, AUTOSAVE_INTERVAL);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', GK.save);
    window.addEventListener('beforeunload', GK.save);
    requestAnimationFrame(loop);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
