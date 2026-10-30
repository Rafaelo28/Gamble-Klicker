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
      // Geschütztes Leerzeichen: „1,23“ und „Mio.“ werden nie auf zwei Zeilen verteilt
      if (abs >= unit.value) return bigFormat.format(n / unit.value) + '\u00a0' + unit.name;
    }
    if (allowDecimals && abs < 100 && n % 1 !== 0) return decFormat.format(n);
    return intFormat.format(Math.floor(n));
  };

  // ---------- Beträge eingeben: 500k, 2,5M, 1B, 3 Mio., 1.000.000 … ----------

  // Abkürzungen → Zehnerpotenz. B steht wie in vielen Spielen für eine Milliarde (englisch „billion“),
  // ausgeschrieben gelten die deutschen Wörter (Billion = 1.000 Milliarden, wie in der Anzeige „Bio.“).
  const SUFFIXES = {
    '': 0, k: 3, t: 3, tsd: 3, tausend: 3,
    m: 6, mio: 6, million: 6, millionen: 6,
    b: 9, mrd: 9, milliarde: 9, milliarden: 9,
    bio: 12, billion: 12, billionen: 12,
    brd: 15, billiarde: 15, billiarden: 15,
    trio: 18, trillion: 18, trillionen: 18,
    trd: 21, trilliarde: 21, trilliarden: 21,
    quadr: 24, quadrd: 27, quint: 30, quintd: 33,
  };

  // Zahl vor der Abkürzung: Komma oder Punkt als Dezimalzeichen, das andere (bzw. mehrere gleiche)
  // trennt Tausender wie in „1.000.000“. Ein Punkt vor genau drei Ziffern ist ein Tausenderpunkt („1.000“).
  function numberPart(text) {
    const count = ch => text.split(ch).length - 1;
    let dec = null;
    if (count('.') && count(',')) dec = text.lastIndexOf(',') > text.lastIndexOf('.') ? ',' : '.';
    else if (count(',') === 1) dec = ',';
    else if (count('.') === 1 && !/^\d{1,3}\.\d{3}$/.test(text)) dec = '.';
    const cut = dec ? text.lastIndexOf(dec) : text.length;
    const whole = text.slice(0, cut);
    const frac = text.slice(cut + 1);
    const sep = dec === ',' || (!dec && count('.')) ? '.' : ',';
    const grouped = new RegExp('^\\d{1,3}(\\' + sep + '\\d{3})+$');
    if (!/^\d*$/.test(frac) || !(whole + frac) || !(/^\d*$/.test(whole) || grouped.test(whole))) return null;
    return whole.split(sep).join('') + (frac ? '.' + frac : '');
  }

  // Liest einen Betrag aus einem Eingabefeld. Unbekannte Eingaben ergeben NaN.
  GK.parseAmount = function (value) {
    if (typeof value === 'number') return value;
    const text = String(value || '').toLowerCase().replace(/[\s\u00a0']/g, '');
    const match = text.match(/^([\d.,]+?)([a-z.]*)$/);
    if (!match) return NaN;
    const num = numberPart(match[1]);
    const exp = SUFFIXES[match[2].replace(/\./g, '')];
    if (num === null || exp === undefined) return NaN;
    const result = Number(num + 'e' + exp); // „2.3e6“ ist genau 2.300.000
    return isFinite(result) ? result : NaN;
  };

  // Kurze, wieder einlesbare Schreibweise für ein Eingabefeld: 5 Mio. / 2,5 Mrd. / 12.345
  GK.formatAmount = function (n) {
    if (!isFinite(n)) return '';
    for (const unit of BIG_UNITS) {
      const q = n / unit.value;
      if (Math.abs(n) >= unit.value && Math.abs(q * 100 - Math.round(q * 100)) < 1e-6) {
        return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(q) + ' ' + unit.name;
      }
    }
    return intFormat.format(Math.floor(n));
  };

  // Eigenschaften für Betrags-Eingabefelder: Tastatur mit Buchstaben, ohne Autokorrektur
  GK.AMOUNT_INPUT = 'type="text" inputmode="text" autocomplete="off" autocapitalize="off" autocorrect="off" ' +
    'spellcheck="false" enterkeyhint="done" placeholder="z. B. 5M"';

  // Zeigt beim Tippen, welcher Betrag gemeint ist (in target)
  GK.amountPreview = function (input, target) {
    const update = () => {
      const raw = input.value.trim();
      const value = GK.parseAmount(raw);
      target.innerHTML = !raw ? '' : isFinite(value)
        ? `= ${GK.formatMoneyHTML(Math.floor(value))}`
        : '<span class="bet-warning">Zahl nicht erkannt – z. B. 500k, 2,5M oder 1B</span>';
    };
    input.addEventListener('input', update);
    update();
    return update;
  };

  // Die Währung: goldene Dublone (wird per CSS gezeichnet)
  GK.COIN = '<i class="dublone" aria-hidden="true"></i>';

  // Dezimalzahl auf Deutsch (z. B. Multiplikatoren „2,45“). Die Formate werden zwischengespeichert –
  // toLocaleString mit Optionen legt sonst bei jedem Aufruf ein neues an, und die Spiele rufen das
  // während einer Runde in jedem Bild auf.
  const decimalFormats = {};
  GK.formatDecimal = function (n, minDigits, maxDigits) {
    const key = minDigits + '|' + maxDigits;
    const f = decimalFormats[key] || (decimalFormats[key] = new Intl.NumberFormat('de-DE', { minimumFractionDigits: minDigits, maximumFractionDigits: maxDigits }));
    return f.format(n);
  };

  // Inhalt nur schreiben, wenn er sich ändert. Die Anzeigen werden 10× pro Sekunde aktualisiert –
  // jedes unnötige Schreiben baut Elemente neu, kostet Layout und Neuzeichnen und startet Animationen neu.
  // Wichtig: Wer ein Element so pflegt, schreibt es immer über GK.setHTML (sonst stimmt der Vergleich nicht).
  GK.setHTML = function (el, html) {
    if (el && el._html !== html) {
      el.innerHTML = html;
      el._html = html;
    }
  };

  GK.setText = function (el, text) {
    text = String(text);
    if (el && el.textContent !== text) el.textContent = text;
  };

  // Betrag mit Dublonen-Symbol als HTML, z. B. für Statistiken
  // Mit geschütztem Leerzeichen, damit die Münze nicht allein in die nächste Zeile rutscht
  GK.formatMoneyHTML = function (n, allowDecimals = false) {
    return GK.formatNumber(n, allowDecimals) + '&nbsp;' + GK.COIN;
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
