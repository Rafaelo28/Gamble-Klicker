// Einstiegspunkt: Spielschleife, Tabs, Statistiken und Autosave.
window.GK = window.GK || {};

(function () {
  const AUTOSAVE_INTERVAL = 10000; // ms
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
    $('reset-btn').addEventListener('click', () => {
      if (!confirm('Willst du wirklich deinen kompletten Spielstand löschen? Das kann nicht rückgängig gemacht werden.')) return;
      GK.resetSave();
      GK.clicker.refresh();
      render();
      GK.toast('Spielstand zurückgesetzt');
    });
  }

  function renderStats() {
    const s = GK.state;
    $('stat-money').textContent = GK.formatNumber(s.money) + ' 🪙';
    $('stat-total').textContent = GK.formatNumber(s.totalEarned) + ' 🪙';
    $('stat-click-earned').textContent = GK.formatNumber(s.clickEarned) + ' 🪙';
    $('stat-clicks').textContent = GK.formatNumber(s.totalClicks);
    $('stat-cps').textContent = GK.formatNumber(GK.clicker.getCps(), true) + ' 🪙';
    $('stat-buildings').textContent = GK.formatNumber(GK.clicker.totalBuildings());
    $('stat-upgrades').textContent = GK.formatNumber(s.upgrades.length);
    $('stat-playtime').textContent = GK.formatDuration(s.playTime);
  }

  function render() {
    const money = GK.formatNumber(GK.state.money);
    $('money').textContent = money;
    $('cps').textContent = GK.formatNumber(GK.clicker.getCps(), true);
    document.title = `${money} Coins – Gamble Klicker`;
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
    setupTabs();
    setupStatsActions();
    GK.clicker.init();
    render();

    setInterval(GK.save, AUTOSAVE_INTERVAL);
    window.addEventListener('beforeunload', GK.save);
    requestAnimationFrame(loop);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
