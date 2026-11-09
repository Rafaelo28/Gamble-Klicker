// Sprachumschaltung Deutsch/Englisch.
// Deutsch ist die Quellsprache: Alle deutschen Texte stehen direkt im Code und in index.html.
// Englische Texte liegen als Übersetzung vor – der deutsche Quelltext ist zugleich der Schlüssel.
// So laden alte Spielstände und die Tests (die einzelne Dateien ohne diese Datei einbinden)
// unverändert weiter: Ohne Englisch gibt GK.t den deutschen Text einfach zurück.
window.GK = window.GK || {};

(function () {
  const EN = {};        // { 'deutscher Quelltext': 'english text' } – für GK.t(...)
  const EN_HTML = {};   // { 'schlüssel': 'english html' } – für [data-i18n] in index.html

  // {name} in einer Vorlage durch die übergebenen Werte ersetzen
  function interpolate(s, vars) {
    s = String(s);
    if (!vars) return s;
    return s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  }

  function currentLang() {
    return (GK.state && GK.state.settings && GK.state.settings.lang === 'en') ? 'en' : 'de';
  }

  // Deutschen Quelltext übersetzen und Werte einsetzen.
  // de: der deutsche Text (mit {platzhaltern}); vars: { platzhalter: wert }
  // ctx: optionaler Kontext, wenn dasselbe deutsche Wort je nach Spiel anders heißt
  //      (z. B. „Karte" = „Hit" im Blackjack, „card" im Mau-Mau). Angemeldet als 'ctx\u0001wort'.
  GK.t = function (de, vars, ctx) {
    de = String(de);
    let s = de;
    if (currentLang() === 'en') {
      if (ctx != null && EN[ctx + '\u0001' + de] != null) s = EN[ctx + '\u0001' + de];
      else if (EN[de] != null) s = EN[de];
    }
    return interpolate(s, vars);
  };

  // ---------- Statische Texte in index.html ----------
  // Beim Start einmal alle festen Textknoten merken; beim Umschalten nur diese ersetzen.
  // So bleibt dynamisch per JS erzeugter Inhalt (der schon über GK.t übersetzt ist) unberührt.
  let staticText = null;   // [{ node, de }]   – einzelne Textknoten
  let staticAttr = null;   // [{ el, attr, de }] – Attribute mit Text (placeholder, title, aria-label)
  let staticHtml = null;   // [{ el, key, de }]  – ganze Elemente über data-i18n

  const SKIP_TAGS = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1 };
  const ATTRS = ['placeholder', 'title', 'aria-label'];

  function snapshot() {
    staticText = [];
    staticAttr = [];
    staticHtml = [];
    document.querySelectorAll('[data-i18n]').forEach(el => {
      staticHtml.push({ el, key: el.getAttribute('data-i18n'), de: el.innerHTML });
    });
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const p = n.parentElement;
      if (!p || SKIP_TAGS[p.tagName]) continue;
      if (p.closest('[data-i18n]')) continue; // wird als ganzes Element übersetzt
      // Einzelzeichen (z. B. das Münz-Zeichen „D" im Logo) nicht übersetzen – sie sind Symbole,
      // keine Wörter, und könnten sonst mit sehr kurzen Wörterbuch-Schlüsseln (Kartenwerte B/D …) kollidieren.
      const core = n.nodeValue && n.nodeValue.trim();
      if (core && core.length >= 2) staticText.push({ node: n, de: n.nodeValue });
    }
    document.querySelectorAll('[placeholder],[title],[aria-label]').forEach(el => {
      ATTRS.forEach(attr => {
        const v = el.getAttribute(attr);
        if (v && v.trim()) staticAttr.push({ el, attr, de: v });
      });
    });
  }

  // Einen Textknoten übersetzen. Führende/abschließende Leerzeichen bleiben erhalten;
  // innere Umbrüche/Mehrfach-Leerzeichen werden für die Suche zu einem Leerzeichen zusammengefasst,
  // damit die Schlüssel unabhängig vom Zeilenumbruch im Quelltext passen.
  function translateFragment(de) {
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(de);
    const core = m[2].replace(/\s+/g, ' ');
    return EN[core] != null ? m[1] + EN[core] + m[3] : de;
  }

  function applyStatic() {
    if (typeof document === 'undefined' || !staticText) return;
    const en = currentLang() === 'en';
    staticHtml.forEach(e => {
      const html = en && EN_HTML[e.key] != null ? EN_HTML[e.key] : e.de;
      if (e.el.innerHTML !== html) e.el.innerHTML = html;
    });
    staticText.forEach(e => {
      e.node.nodeValue = en ? translateFragment(e.de) : e.de;
    });
    staticAttr.forEach(e => {
      const core = e.de.trim().replace(/\s+/g, ' ');
      e.el.setAttribute(e.attr, en && EN[core] != null ? EN[core] : e.de);
    });
    document.documentElement.lang = en ? 'en' : 'de';
  }

  GK.i18n = {
    available: ['de', 'en'],
    // Englische Übersetzungen für GK.t anmelden (jede Datei bringt ihre eigenen mit)
    add(map) { Object.assign(EN, map); },
    // Englische Übersetzungen für ganze index.html-Elemente (data-i18n)
    addHtml(map) { Object.assign(EN_HTML, map); },
    get lang() { return currentLang(); },
    t: GK.t,
    // Beim Start: feste Texte merken und in der aktuellen Sprache anzeigen
    init() { if (typeof document === 'undefined') return; snapshot(); applyStatic(); },
    // Feste Texte in der aktuellen Sprache neu setzen
    apply() { applyStatic(); },
    // Sprache umschalten, speichern und feste Texte neu setzen.
    // Dynamische Anzeigen baut der Aufrufer neu auf (main.js: refreshAll).
    set(lang) {
      GK.state.settings.lang = lang === 'en' ? 'en' : 'de';
      if (GK.save) GK.save();
      applyStatic();
      return GK.state.settings.lang;
    },
  };
})();
