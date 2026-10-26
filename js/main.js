// Einstiegspunkt: Spielschleife, Tabs, Statistiken und Autosave.
window.GK = window.GK || {};

(function () {
  const AUTOSAVE_INTERVAL = 5000;  // ms
  const RENDER_INTERVAL = 100;     // ms

  let lastTick = performance.now();
  let lastRender = 0;

  function $(id) {
    return document.getElementById(id);
  }

  GK.toast = function (message) {
    const el = $('toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(GK.toast.timer);
    GK.toast.timer = setTimeout(() => el.classList.remove('show'), 2500);
  };

  function setupTabs() {
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === tab));
        document.querySelectorAll('.tab-panel').forEach(panel => {
          panel.classList.toggle('active', panel.id === 'tab-' + tab.dataset.tab);
        });
      });
    });
  }

  function setupStatsActions() {
    $('save-btn').addEventListener('click', () => {
      GK.toast(GK.save() ? 'Spielstand gespeichert ✅' : 'Speichern nicht möglich ⚠️');
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
      if (!GK.importSave($('transfer-text').value)) {
        GK.toast('Ungültiger Spielstand-Code ⚠️');
        return;
      }
      $('transfer-box').hidden = true;
      GK.clicker.refresh();
      render();
      GK.toast('Spielstand geladen ✅');
    });
    $('reset-btn').addEventListener('click', () => {
      if (!confirm('Willst du wirklich deinen kompletten Spielstand löschen? Das kann nicht rückgängig gemacht werden.')) return;
      GK.resetSave();
      GK.clicker.refresh();
      render();
      GK.toast('Spielstand zurückgesetzt');
    });
  }

  function openTransferBox(mode) {
    const isExport = mode === 'export';
    $('transfer-box').hidden = false;
    $('transfer-confirm').hidden = isExport;
    $('transfer-hint').textContent = isExport
      ? 'Kopiere diesen Code und bewahre ihn auf. Mit „Importieren“ kannst du ihn später (auch auf einem anderen Gerät) wieder laden.'
      : 'Füge hier deinen Spielstand-Code ein und klicke auf „Laden“. Dein aktueller Fortschritt wird dabei ersetzt.';
    $('transfer-text').value = isExport ? GK.exportSave() : '';
    $('transfer-text').readOnly = isExport;
    $('transfer-text').focus();
    if (isExport) $('transfer-text').select();
  }

  // Kurz „💾 gespeichert“ in der Kopfzeile aufblinken lassen
  function flashSaveIndicator() {
    const el = $('save-indicator');
    el.classList.add('show');
    clearTimeout(flashSaveIndicator.timer);
    flashSaveIndicator.timer = setTimeout(() => el.classList.remove('show'), 1200);
  }

  function renderStats() {
    const s = GK.state;
    $('stat-money').innerHTML = GK.formatMoneyHTML(s.money);
    $('stat-total').innerHTML = GK.formatMoneyHTML(s.totalEarned);
    $('stat-click-earned').innerHTML = GK.formatMoneyHTML(s.clickEarned);
    $('stat-clicks').textContent = GK.formatNumber(s.totalClicks);
    $('stat-cps').innerHTML = GK.formatMoneyHTML(GK.clicker.getCps(), true);
    $('stat-buildings').textContent = GK.formatNumber(GK.clicker.totalBuildings());
    $('stat-upgrades').textContent = GK.formatNumber(s.upgrades.length);
    $('stat-playtime').textContent = GK.formatDuration(s.playTime);
    $('last-saved').textContent = GK.storageAvailable
      ? 'vor ' + GK.formatDuration((Date.now() - s.lastSaved) / 1000)
      : 'nicht möglich';
  }

  function render() {
    const money = GK.formatNumber(GK.state.money);
    $('money').textContent = money;
    $('cps').textContent = GK.formatNumber(GK.clicker.getCps(), true);
    document.title = `${money} Dublonen – Gamble Klicker`;
    GK.clicker.render();
    renderStats();
  }

  function loop(now) {
    // Begrenzen, damit ein lange inaktiver Tab nicht auf einmal riesige Sprünge macht
    const seconds = Math.min((now - lastTick) / 1000, 1);
    lastTick = now;
    GK.state.playTime += seconds;
    GK.clicker.tick(seconds);

    if (now - lastRender >= RENDER_INTERVAL) {
      lastRender = now;
      render();
    }
    requestAnimationFrame(loop);
  }

  function init() {
    GK.load();
    GK.onSave = flashSaveIndicator;
    if (!GK.storageAvailable) {
      $('storage-warning').hidden = false;
      GK.toast('⚠️ Speichern nicht möglich – Details unter Statistiken');
    }
    setupTabs();
    setupStatsActions();
    GK.clicker.init();
    render();

    // Automatisch speichern: regelmäßig, beim Wechsel in einen anderen Tab/App
    // und beim Schließen bzw. Neuladen (pagehide funktioniert auch auf dem Handy)
    setInterval(GK.save, AUTOSAVE_INTERVAL);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') GK.save();
    });
    window.addEventListener('pagehide', GK.save);
    window.addEventListener('beforeunload', GK.save);
    requestAnimationFrame(loop);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
