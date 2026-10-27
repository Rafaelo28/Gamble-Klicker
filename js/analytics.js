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
  const queue = [];   // Ereignisse, bevor das Zählskript geladen ist

  // Ereignis zählen, z. B. „spiel-poker“ – jedes höchstens einmal pro Besuch
  GK.track = function (path, title) {
    if (local || seen.has(path)) return;
    seen.add(path);
    const vars = { path, title: title || path, event: true };
    const gc = window.goatcounter;
    if (gc && typeof gc.count === 'function') gc.count(vars);
    else queue.push(vars);
  };

  if (local) return;
  const script = document.createElement('script');
  script.async = true;
  script.src = SCRIPT;
  script.integrity = INTEGRITY;
  script.crossOrigin = 'anonymous';
  script.dataset.goatcounter = ENDPOINT;
  script.onload = () => queue.splice(0).forEach(vars => window.goatcounter.count(vars));
  document.head.appendChild(script);
})();
