// Anonyme Besucherzählung mit GoatCounter (Auswertung: https://gamble-klicker.goatcounter.com).
// Gezählt werden Seitenaufrufe und, welche Spiele geöffnet bzw. online gespielt werden – ohne Cookies und
// ohne persönliche Daten. Lokal geöffnet (file://, eigener Rechner) wird nichts geladen und nichts gezählt.
// Eigene Besuche nicht mitzählen: einmal https://rafaelo28.github.io/Gamble-Klicker/#toggle-goatcounter öffnen.
window.GK = window.GK || {};

(function () {
  const ENDPOINT = 'https://gamble-klicker.goatcounter.com/count';
  // Feste Version mit Prüfsumme: der Browser führt das Skript nur aus, wenn es genau diese Datei ist
  const SCRIPT = 'https://gc.zgo.at/count.v5.js';
  const INTEGRITY = 'sha384-atnOLvQb9t+jTSipvd75X2yginT4PjVbqDdlJAmxMm+wYElFmeR6EmLP5bYeoRVQ';
  const local = location.protocol === 'file:' || /^(localhost|127\.|10\.|192\.168\.|\[::1\])/.test(location.hostname);
  const seen = new Set();
  const queue = [];   // Zählungen, bevor das Zählskript geladen ist
  let loaded = false;

  // Zählen ohne Adresszusätze (?raum=CODE … aus Einladungs-Links): GoatCounter schickt die Adresszeile
  // sonst immer mit. Sie wird dafür kurz entfernt und gleich wieder eingesetzt.
  function send(vars) {
    const search = location.search;
    if (search) history.replaceState(history.state, '', location.pathname + location.hash);
    try {
      window.goatcounter.count(Object.assign({ referrer: r => String(r || '').split('?')[0] }, vars));
    } finally {
      if (search) history.replaceState(history.state, '', location.pathname + search + location.hash);
    }
  }

  function count(vars) {
    if (loaded) send(vars);
    else queue.push(vars);
  }

  // Ereignis zählen, z. B. „spiel-poker“ – jedes höchstens einmal pro Besuch
  GK.track = function (path, title) {
    if (local || seen.has(path)) return;
    seen.add(path);
    count({ path, title: title || path, event: true });
  };

  if (local) return;
  // Seitenaufruf erst zählen, wenn das Spiel gestartet ist (es wertet Einladungs-Links aus und entfernt sie)
  // und die Seite sichtbar ist (nicht nur im Hintergrund vorgeladen)
  const countPage = () => {
    if (document.visibilityState === 'hidden') {
      document.addEventListener('visibilitychange', countPage, { once: true });
      return;
    }
    // Fester Titel: der Seitentitel zeigt sonst den Kontostand
    count({ path: location.pathname, title: 'Gamble Klicker' });
  };
  document.addEventListener('DOMContentLoaded', () => setTimeout(countPage, 0));

  window.goatcounter = { no_onload: true };
  const script = document.createElement('script');
  script.async = true;
  script.src = SCRIPT;
  script.integrity = INTEGRITY;
  script.crossOrigin = 'anonymous';
  script.dataset.goatcounter = ENDPOINT;
  script.onload = () => {
    loaded = true;
    queue.splice(0).forEach(send);
  };
  document.head.appendChild(script);
})();
