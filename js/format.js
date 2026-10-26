// Zahlen- und Zeitformatierung (deutsche Schreibweise).
window.GK = window.GK || {};

(function () {
  // Deutsche Zahlwörter (lange Skala), vom größten zum kleinsten
  const BIG_UNITS = [
    { value: 1e33, name: 'Quintd.' },
    { value: 1e30, name: 'Quint.' },
    { value: 1e27, name: 'Quadrd.' },
    { value: 1e24, name: 'Quadr.' },
    { value: 1e21, name: 'Trd.' },
    { value: 1e18, name: 'Trio.' },
    { value: 1e15, name: 'Brd.' },
    { value: 1e12, name: 'Bio.' },
    { value: 1e9, name: 'Mrd.' },
    { value: 1e6, name: 'Mio.' },
  ];

  const intFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
  const decFormat = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const bigFormat = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Formatiert Geldbeträge: 1.234 / 12,5 / 1,23 Mio.
  GK.formatNumber = function (n, allowDecimals = false) {
    if (!isFinite(n)) return '∞';
    const abs = Math.abs(n);
    for (const unit of BIG_UNITS) {
      if (abs >= unit.value) return bigFormat.format(n / unit.value) + ' ' + unit.name;
    }
    if (allowDecimals && abs < 100 && n % 1 !== 0) return decFormat.format(n);
    return intFormat.format(Math.floor(n));
  };

  // Die Währung: goldene Dublone (wird per CSS gezeichnet)
  GK.COIN = '<i class="dublone" aria-hidden="true"></i>';

  // Betrag mit Dublonen-Symbol als HTML, z. B. für Statistiken
  GK.formatMoneyHTML = function (n, allowDecimals = false) {
    return GK.formatNumber(n, allowDecimals) + ' ' + GK.COIN;
  };

  // Formatiert Sekunden als „1 Std. 5 Min.“
  GK.formatDuration = function (seconds) {
    seconds = Math.floor(seconds);
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const parts = [];
    if (d) parts.push(d + ' T.');
    if (h) parts.push(h + ' Std.');
    if (m) parts.push(m + ' Min.');
    if (!d && !h) parts.push(s + ' Sek.');
    return parts.join(' ');
  };
})();
