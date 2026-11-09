// Eigene Symbole (SVG) für die Oberfläche – ersetzen die Emojis des Betriebssystems, damit alles
// auf jedem Gerät gleich aussieht.
//
// Zwei Sätze in einem unsichtbaren SVG-„Sprite“, das einmal beim Laden in die Seite kommt:
//  • i-NAME: kleine Symbole (Raster 24 × 24) für Tabs, Überschriften, Knöpfe, Gebäude und Upgrades.
//    Stil: runde Linie (2 px) in der Textfarbe, darunter eine blasse Fläche (30 %), kleine Details in
//    Gold (--ica, siehe css/icons.css). So passen sie sich jeder Umgebung an.
//  • g-ID: farbige Bilder (Raster 48 × 48) für die Spielkarten der Casino-Lobby.
//
// Benutzung:  GK.icon('anchor')            → <svg class="ic ic-anchor" …><use href="#i-anchor"/></svg>
//             GK.icon('anchor', 'ic-lg')   → mit zusätzlicher Klasse
//             GK.gameIcon('roulette', '🎡') → Lobby-Bild des Spiels (oder das Emoji, falls es keins gibt)
// In Node (Tests) gibt es kein document: Dann wird nur nichts eingefügt, die Funktionen gehen trotzdem.
window.GK = window.GK || {};

(function () {
  // ---------- Bausteine ----------

  // Füllungen: T = blasse Fläche, F = volle Textfarbe, A = Gold-Akzent, AS = Gold-Linie
  const T = ' fill="currentColor" stroke="none" opacity=".3"';
  const F = ' fill="currentColor" stroke="none"';
  const A = ' fill="currentColor" stroke="none" style="fill:var(--ica,currentColor)"';
  const AS = ' style="stroke:var(--ica,currentColor)"';

  const n = v => +v.toFixed(2);

  // Kreis als Teilpfad (für Löcher mit evenodd)
  function c(x, y, r) {
    return `M${n(x - r)} ${n(y)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
  }

  // Rechteck mit runden Ecken als Pfad
  function rr(x, y, w, h, r) {
    return `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}` +
      `h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}Z`;
  }

  // Stern mit k Zacken (Außenradius R, Innenradius r)
  function star(cx, cy, R, r, k, rot) {
    const pts = [];
    const start = rot === undefined ? -Math.PI / 2 : rot;
    for (let i = 0; i < k * 2; i++) {
      const a = start + i * Math.PI / k;
      const rad = i % 2 ? r : R;
      pts.push(`${n(cx + rad * Math.cos(a))} ${n(cy + rad * Math.sin(a))}`);
    }
    return 'M' + pts.join('L') + 'Z';
  }

  // Zahnrad mit k Zähnen
  function gear(cx, cy, R, r, k) {
    const pts = [];
    for (let i = 0; i < k; i++) {
      const a = i * 2 * Math.PI / k;
      const w = Math.PI / k * 0.5;
      [[r, a - w * 1.25], [R, a - w * 0.6], [R, a + w * 0.6], [r, a + w * 1.25]].forEach(([rad, b]) =>
        pts.push(`${n(cx + rad * Math.cos(b))} ${n(cy + rad * Math.sin(b))}`));
    }
    return 'M' + pts.join('L') + 'Z';
  }

  // Fläche + Umriss desselben Pfads
  const duo = (d, tone) => `<path d="${d}"${tone || T}/><path d="${d}"/>`;
  const circ = (x, y, r, attrs) => `<circle cx="${x}" cy="${y}" r="${r}"${attrs || ''}/>`;
  const duoC = (x, y, r, tone) => circ(x, y, r, tone || T) + circ(x, y, r);

  // Lautsprecher (für Ton an/aus/leise)
  const SPEAKER = duo('M4 9.5h3l5-4.5v14l-5-4.5H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1Z');
  const TEMPLE_ROOF = 'M3 9 12 3.5 21 9Z';

  // ---------- Kleine Symbole (24 × 24) ----------
  const ICONS = {
    // Tabs & Kopfzeile
    tap: duo('M8.5 4.5a1.5 1.5 0 0 1 3 0v6.1a1.5 1.5 0 0 1 3 .3 1.5 1.5 0 0 1 3 .7 1.3 1.3 0 0 1 2.5 1V16a6 6 0 0 1-6 6h-1.2a5.5 5.5 0 0 1-4.4-2.2l-3.8-5a1.5 1.5 0 0 1 2.3-1.9l1.6 1.7Z') +
      '<path d="M11.5 10.6V14M14.5 10.9V14M17.5 11.6V14.5"/>' +
      `<path d="M5.8 5.8 4.3 4.8M5.6 8.8H3.8M14.2 4.6l1.3-1.1"${AS}/>`,
    dice: duo(rr(3.5, 3.5, 17, 17, 4)) +
      [[8.4, 8.4], [15.6, 8.4], [12, 12], [8.4, 15.6], [15.6, 15.6]].map(([x, y]) => circ(x, y, 1.5, F)).join(''),
    anchor: circ(12, 5, 2.2, A) + circ(12, 5, 2.2) +
      '<path d="M12 7.2V21M8.5 10.5h7M4.5 13.5c.6 4.4 3.6 7.5 7.5 7.5s6.9-3.1 7.5-7.5M2.9 15 4.5 12.9 6.4 14.5M17.6 14.5l1.9-1.6 1.6 2.1"/>',
    trophy: duo('M7 3.5h10V9a5 5 0 0 1-10 0Z', A) +
      '<path d="M7 5.5H4.5V7A3 3 0 0 0 7.5 10M17 5.5h2.5V7a3 3 0 0 1-3 3M12 14v3.5"/>' +
      duo(rr(8, 17.5, 8, 3.5, 1)),
    chart: duo(rr(4, 12, 4, 8, 1)) + duo(rr(10, 7.5, 4, 12.5, 1)) + duo(rr(16, 3.5, 4, 16.5, 1), A) +
      '<path d="M2.5 21h19"/>',
    sound: SPEAKER + '<path d="M15.5 9a4 4 0 0 1 0 6M18.3 6.3a8 8 0 0 1 0 11.4"/>',
    volume: SPEAKER + '<path d="M15.5 9a4 4 0 0 1 0 6"/>',
    mute: SPEAKER + '<path d="m15.5 9.5 5 5M20.5 9.5l-5 5"/>',
    save: duo('M5.5 3.5h10l5 5v10a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z') +
      '<path d="M7.5 3.5v4.5h7V3.5"/>' + duo(rr(7, 13, 10, 7.5, 1), A),
    pause: duo(rr(6, 4.5, 4, 15, 1.2)) + duo(rr(14, 4.5, 4, 15, 1.2)),
    bag: duo('M9 7.5C5.6 10 4 13 4 15.6 4 19 6.5 21 12 21s8-2 8-5.4c0-2.6-1.6-5.6-5-8.1Z') +
      '<path d="M9 7.5h6M9.3 7.3 8 3.5h8l-1.3 3.8"/>' + circ(12, 15, 2.6, A),
    coins: duoC(9, 9.5, 5.5) + duoC(15, 14.5, 5.5, A) + circ(15, 14.5, 2.4),
    clover: [[12, 7.6], [16.4, 12], [12, 16.4], [7.6, 12]].map(([x, y]) => duoC(x, y, 3.4)).join('') +
      circ(12, 12, 1.4, A) + '<path d="M14.8 14.8c1.8 1.8 2.8 3.8 3.4 6.4"/>',
    swords: duo('M3.5 3.5h3L16 13l-3 3-9.5-9.5Z') + duo('M20.5 3.5h-3L8 13l3 3 9.5-9.5Z') +
      '<path d="m12 19 7-7M16.5 16.5 20 20M12 19l-7-7M7.5 16.5 4 20"/>' + circ(20.5, 20.5, 1.4, A) + circ(3.5, 20.5, 1.4, A),
    gem: duo('M7 4h10l4 5.5-9 11-9-11Z') + '<path d="M3 9.5h18M9.5 4 8 9.5l4 11 4-11L14.5 4"/>',
    scroll: `<path d="M7 7h10v11.5H7Z"${T}/>` + duo(rr(4.5, 3, 15, 4, 2)) + duo(rr(4.5, 17.5, 15, 4, 2)) +
      '<path d="M7 7v10.5M17 7v10.5M10 10.5h4M10 13.5h4"/>',
    calendar: duo(rr(3.5, 5, 17, 15.5, 2.5)) + '<path d="M3.5 9.5h17M8 3v4M16 3v4"/>' + `<path d="${rr(13, 13, 4, 4, 1)}"${A}/>`,
    map: duo('M3.5 6 9 4l6 2 5.5-2v14L15 20l-6-2-5.5 2Z') + '<path d="M9 4v14M15 6v14"/>' +
      `<path d="m10.6 9.6 2.8 2.8M13.4 9.6l-2.8 2.8"${AS}/>`,
    bolt: duo('M13.5 2.5 5 13.5h6l-1 8 8.5-11h-6Z', A),
    sparkle: duo('M11 3c.7 4.6 2.4 6.3 7 7-4.6.7-6.3 2.4-7 7-.7-4.6-2.4-6.3-7-7 4.6-.7 6.3-2.4 7-7Z', A) +
      `<path d="M18.5 15c.3 1.9 1.1 2.7 3 3-1.9.3-2.7 1.1-3 3-.3-1.9-1.1-2.7-3-3 1.9-.3 2.7-1.1 3-3Z"${F}/>`,
    chest: duo('M4 10V8a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2Z') + duo(rr(3.5, 10, 17, 10, 2)) +
      '<path d="M3.5 13.5h17"/>' + `<path d="${rr(10.3, 11.3, 3.4, 4.4, 0.8)}"${A}/>`,
    users: duoC(16.5, 7.5, 2.7) + '<path d="M16.5 13c2.6 0 4.5 2 4.5 5"/>' +
      duoC(9, 8, 3.3) + duo('M2.5 20.5c0-3.8 2.9-6.5 6.5-6.5s6.5 2.7 6.5 6.5Z'),
    user: duoC(12, 8, 4) + duo('M4.5 20.5c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5Z'),
    gear: duo(gear(12, 12, 9.5, 7, 8)) + circ(12, 12, 3, A) + circ(12, 12, 3),
    palette: duo('M12 3.5a8.5 8.5 0 1 0 0 17c1.4 0 2-1 2-2 0-.7-.4-1.1-.4-1.8 0-1 .8-1.7 1.8-1.7H18a2.5 2.5 0 0 0 2.5-2.5C20.5 7.3 16.7 3.5 12 3.5Z') +
      circ(7.8, 11.5, 1.4, F) + circ(9.8, 7.4, 1.4, F) + circ(14.4, 7.2, 1.4, A),
    kraken: duo('M5.5 13.5V10a6.5 6.5 0 0 1 13 0v3.5Z') + circ(9.5, 10.3, 1.1, F) + circ(14.5, 10.3, 1.1, F) +
      '<path d="M6 13.5c0 3.2-1.8 4.8-3 5.5M9.5 13.5v3.5c0 1.6-1 2.8-2.3 3.5M12 13.5V21M14.5 13.5v3.5c0 1.6 1 2.8 2.3 3.5M18 13.5c0 3.2 1.8 4.8 3 5.5"/>',
    upload: '<path d="M4 15v3.5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V15M12 15V4M7.5 8.5 12 4l4.5 4.5"/>',
    download: '<path d="M4 15v3.5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V15M12 4v11M7.5 10.5 12 15l4.5-4.5"/>',
    trash: duo('M6 6.5h12l-1 13a1.5 1.5 0 0 1-1.5 1.4h-7A1.5 1.5 0 0 1 7 19.5Z') +
      '<path d="M3.5 6.5h17M9.5 6.5v-2h5v2M10 10.5v6M14 10.5v6"/>',
    warning: duo('M12 3.5 21.5 20h-19Z') + '<path d="M12 9.5V14"/>' + circ(12, 17, 1.1, F),
    sailboat: duo('M3 16h18l-2.5 4h-13Z') + '<path d="M12 3v13"/>' + duo('M12 4.5 19 14h-7Z') + duo('M10 6.5 5 14h5Z') +
      `<path d="m12 3 3.2 1.3L12 5.6Z"${A}/>`,
    slot: duo(rr(3, 6, 15, 14.5, 2.5)) + `<path d="${rr(5.5, 9, 10, 6, 1)}" fill="none"/>` +
      '<path d="M8.8 9v6M12.2 9v6M7.5 18h6M20.5 8.5v6.5h-2.5"/>' + circ(20.5, 7, 1.6, A) + circ(20.5, 7, 1.6),
    cards: `<g transform="rotate(-14 9.75 12)">${duo(rr(4.5, 4.5, 10.5, 15, 2))}</g>` + duo(rr(9.5, 5, 10.5, 15, 2)) +
      `<path d="M14.75 9.4c-1.9 2-3.2 3-3.2 4.4a1.6 1.6 0 0 0 2.9.9l-.5 2h1.6l-.5-2a1.6 1.6 0 0 0 2.9-.9c0-1.4-1.3-2.4-3.2-4.4Z"${A}/>`,
    trend: `<path d="m7 15 4-4 3 3 5.5-6.5V20H7Z"${T}/>` + '<path d="M4 4v16h16"/>' +
      `<path d="m7 15 4-4 3 3 5.5-6.5M15.5 7.5h4v4"${AS}/>`,
    star: duo(star(12, 12.6, 9.5, 4.3, 5), A),
    crown: duo('M3.5 8 8 12l4-6.5 4 6.5 4.5-4-1.5 10.5h-14Z', A) + '<path d="M6 21h12"/>' +
      circ(3.5, 7.5, 1.3, F) + circ(12, 4.7, 1.3, F) + circ(20.5, 7.5, 1.3, F),
    ticket: duo('M5.5 6h13a2 2 0 0 1 2 2v2.2a1.8 1.8 0 0 0 0 3.6V16a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-2.2a1.8 1.8 0 0 0 0-3.6V8a2 2 0 0 1 2-2Z') +
      '<path d="M15 8.5v1.2M15 11.4v1.2M15 14.3v1.2"/>',
    medal: '<path d="M8 3l3.4 6.4M16 3l-3.4 6.4"/>' + duoC(12, 15, 5.8, A) + circ(12, 15, 3, ' opacity=".6"'),
    pearl: duoC(12, 12.5, 7.5) + '<path d="M8.4 11a4 4 0 0 1 3-3.1"/>' + circ(9.3, 9.3, 0.9, A),
    lock: '<path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>' + duo(rr(5, 10.5, 14, 10, 2.5)) + circ(12, 14.6, 1.3, F) + '<path d="M12 15v2.5"/>',
    unlock: '<path d="M8 10.5V8a4 4 0 0 1 7.7-1.5"/>' + duo(rr(5, 10.5, 14, 10, 2.5)) + circ(12, 14.6, 1.3, F) + '<path d="M12 15v2.5"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    close: '<path d="m6.5 6.5 11 11M17.5 6.5l-11 11"/>',
    gift: duo(rr(4, 11, 16, 9.5, 1.5)) + duo(rr(3, 7.5, 18, 3.5, 1.2)) + '<path d="M12 7.5v13"/>' +
      `<path d="M12 7.5C11 4.6 7.3 3.6 6.8 5.4c-.4 1.6 2.6 2.1 5.2 2.1 2.6 0 5.6-.5 5.2-2.1-.5-1.8-4.2-.8-5.2 2.1Z"${AS}/>`,
    hourglass: '<path d="M6.5 3.5h11M6.5 20.5h11M7.5 3.5c0 4 4.5 5.5 4.5 8.5s-4.5 4.5-4.5 8.5M16.5 3.5c0 4-4.5 5.5-4.5 8.5s4.5 4.5 4.5 8.5"/>' +
      `<path d="M9 19.5c.5-2 2-3 3-3.5 1 .5 2.5 1.5 3 3.5ZM9.3 7h5.4c-.6 1.3-1.6 2.2-2.7 3-1.1-.8-2.1-1.7-2.7-3Z"${A}/>`,
    flame: duo('M12 21.5c-4 0-7-2.8-7-6.6 0-3.6 2.6-5.6 3.8-8.4.4 1.7 1.3 2.9 2.4 3.4C11 6.8 12.5 4.3 15 2.5c-.3 3.3 4 6.4 4 12.2 0 4-3 6.8-7 6.8Z') +
      `<path d="M12 21.5c-1.8 0-3-1.3-3-3 0-2 1.6-2.7 2.3-4.8 1.6 1.2 3.7 2.5 3.7 4.8 0 1.7-1.2 3-3 3Z"${A}/>`,
    target: duoC(12, 12, 9) + circ(12, 12, 5) + circ(12, 12, 1.8, A) + circ(12, 12, 1.8),
    wind: '<path d="M3 9h10.5A2.5 2.5 0 1 0 11 6.5M3 13h15a2.5 2.5 0 1 1-2.5 2.5M3 17h7"/>',
    flag: '<path d="M5 21V3.5"/>' + duo('M5 4.5c3-1.5 5 1 8 0s4-1 6-.5v8.5c-2-.5-3 .5-6 .5s-5-1.5-8 0Z'),
    robot: duo(rr(5, 7.5, 14, 11, 3)) + '<path d="M12 7.5V5M9.5 15.5h5M3 11.5v3M21 11.5v3"/>' +
      circ(12, 3.8, 1.3, A) + circ(9.3, 12, 1.4, F) + circ(14.7, 12, 1.4, F),
    copy: duo(rr(8.5, 8.5, 12, 12, 2)) + '<path d="M15.5 8.5v-3a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    wheel: duoC(12, 12, 9) + '<path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4"/>' + circ(12, 12, 2.2, A) + circ(12, 12, 2.2),
    question: duoC(12, 12, 9) + '<path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6"/>' + circ(12, 17, 1.1, F),
    back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    compass: duoC(12, 12, 9) + duo('M15.6 8.4 13.3 13.3 8.4 15.6 10.7 10.7Z', A) + circ(12, 12, 0.9, F),
    skull: duo('M12 3.5c-4.4 0-7.5 3-7.5 7 0 2.3 1 3.8 2.5 4.8V18a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-2.7c1.5-1 2.5-2.5 2.5-4.8 0-4-3.1-7-7.5-7Z') +
      circ(9.2, 11, 1.8, F) + circ(14.8, 11, 1.8, F) + '<path d="M10.5 16.5V19M13.5 16.5V19M5 20.5l14-1.5M5 19l14 1.5"/>',
    cannon: `<g transform="rotate(-24 11 10)">${duo(rr(3, 7.5, 16, 6, 3))}</g>` + duoC(10, 16, 4) + circ(10, 16, 1.2, F) +
      '<path d="M3 20.5h14"/>' + circ(20.3, 4.4, 1.7, A),
    ship: duo('M2.5 15h19l-3 5h-13Z') + '<path d="M9 15V3.5M15.5 15V6"/>' +
      duo('M9 4.5c3 1 4.5 2.6 4.5 4.6S12 12.6 9 13.5Z') + duo('M15.5 7c2.4.8 3.7 2 3.7 3.5s-1.3 2.7-3.7 3.5Z') +
      `<path d="M9 3.5 5.8 4.6 9 5.7Z"${A}/>`,
    eye: duo('M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z') + circ(12, 12, 3, A) + circ(12, 12, 3),
    burst: duo(star(12, 12, 10, 5.2, 8, -Math.PI / 2), A) + circ(12, 12, 2.2, F),
    comet: duoC(15.5, 8.5, 4, A) + '<path d="M12.5 11.5 4 20M10.6 9.4 5.5 14.5M14.6 13.4l-5.1 5.1"/>',
    volcano: duo('M2.5 20.5 8.5 9h7l6 11.5Z') + `<path d="M10.2 9.2c.4 2.4 1.1 3.8 1.8 5.3.7-1.5 1.4-2.9 1.8-5.3Z"${A}/>` +
      circ(9, 5.2, 1.3, A) + circ(12, 3.4, 1.3, A) + circ(15, 5.2, 1.3, A),
    temple: duo(TEMPLE_ROOF) + duo(rr(3, 18, 18, 3, 0.8)) + '<path d="M6.5 11.5V16M10 11.5V16M14 11.5V16M17.5 11.5V16"/>',
    bank: duo(TEMPLE_ROOF) + duo(rr(3, 18, 18, 3, 0.8)) + '<path d="M6.5 11.5V16M10 11.5V16M14 11.5V16M17.5 11.5V16"/>' +
      circ(12, 7, 1.3, A),
    atlantis: duo('M3 8 12 3 21 8Z') + '<path d="M6.5 10.5V16M10 10.5V16M14 10.5V16M17.5 10.5V16M4 16.5h16"/>' +
      `<path d="M2.5 20.5c1.5-1 3-1 4.5 0s3 1 4.5 0 3-1 4.5 0 3 1 4.5 0"${AS}/>`,
    piggy: duo('M5 12.5c0-3.6 3.4-6 7.5-6 2 0 3.8.5 5.1 1.4l2-1.4v3.2c.8.8 1.4 1.8 1.6 2.8h1.3v3h-1.6c-.5 1.3-1.4 2.4-2.6 3.2V20h-3v-1.6a13 13 0 0 1-5.6 0V20h-3v-2.8C5.8 16 5 14.3 5 12.5Z') +
      '<path d="M11 8.8h3M5 11.5c-1.2 0-2-.8-2-1.8"/>' + circ(16.6, 11, 0.9, F) + circ(12.5, 3.6, 1.8, A),
    lemon: `<g transform="rotate(-35 12 12)">${duo('M3.5 12a8.5 6 0 1 0 17 0a8.5 6 0 1 0-17 0Z', A)}</g>` +
      circ(19.6, 6.6, 1.2, F) + circ(4.4, 17.4, 1.2, F) + '<path d="M9 13.5c.5-2 2-3.6 4-4.3"/>',
    kiosk: duo('M5 4h14l1.5 5.5a2.1 2.1 0 0 1-4.2 0 2.1 2.1 0 0 1-4.3 0 2.1 2.1 0 0 1-4.3 0 2.1 2.1 0 0 1-4.2 0Z', A) +
      `<path d="M5 12h14v8.5H5Z"${T}/>` + '<path d="M5 12v8.5h14V12M10 20.5V16h4v4.5M3 20.5h18"/>',
    ring: circ(12, 15, 6, ' fill="none" stroke-width="2.4"') + duo('M8.8 6.5 10.4 4h3.2l1.6 2.5-3.2 3.3Z') +
      `<path d="M18.5 3.5v2.5M17.25 4.75h2.5"${AS}/>`,
    pickaxe: `<g transform="rotate(-35 12 12)">${duo('M3.5 9C6 5.5 9 4 12 4s6 1.5 8.5 5c-2.5-1.5-5.2-2.2-8.5-2.2S6 7.5 3.5 9Z')}<path d="M12 7v14.5"/></g>` +
      circ(19, 19.5, 1.9, A),
    flask: duo('M10.5 3.5V9L5 18.5a1.8 1.8 0 0 0 1.6 2.5h10.8a1.8 1.8 0 0 0 1.6-2.5L13.5 9V3.5Z') +
      `<path d="M7.6 14.5h8.8l2.6 4a1.8 1.8 0 0 1-1.6 2.5H6.6A1.8 1.8 0 0 1 5 18.5Z"${A}/>` +
      '<path d="M9 3.5h6"/>' + circ(12.5, 11.7, 0.9, F),
    island: duo('M3 21c2.5-3 6-4 9-4s6.5 1 9 4Z', A) + '<path d="M12 18.5c.6-3.6.4-6.4-1-9"/>' +
      '<path d="M11 9.5C9 6.5 6 6 3.5 8M11 9.5c1-3 4-4.5 7-3.5M11 9.5c-2.5 0-5 1.5-5.5 4.5M11 9.5c3 0 5.5 1.5 6.5 4"/>',
    dragon: duo('M4 20.5c0-6 2.5-10.5 7-12.5L9.5 3.5l4.5 3.3c1.5-.3 3-.3 4.5.2L21 9.5l-2 1.2c.5 1 .5 2-.3 2.8l-4.2.2c-1 1.8-2.5 3.5-2.5 6.8Z') +
      circ(15.2, 9.5, 1.1, A) + '<path d="M7.5 15.5c1.5.3 2.8 1.2 3.5 2.5"/>',
    portal: duo('M5 21V11a7 7 0 0 1 14 0v10Z') + '<path d="M3 21h18"/>' +
      `<path d="${star(12, 13, 4, 1.6, 4, -Math.PI / 2)}"${A}/>` + circ(9, 9, 0.8, F) + circ(15.5, 17.5, 0.8, F),
    trident: '<path d="M12 8v13.5M6 4v4a6 6 0 0 0 12 0V4M12 3v5"/>' +
      `<path d="M4.8 5.5 6 3.5l1.2 2M10.8 4.5 12 2.5l1.2 2M16.8 5.5l1.2-2 1.2 2"${AS}/>`,
    ghost: duo('M5.5 20.5V11a6.5 6.5 0 0 1 13 0v9.5l-2.2-1.6-2.1 1.6-2.2-1.6-2.1 1.6-2.2-1.6Z') +
      circ(9.8, 11, 1.2, F) + circ(14.2, 11, 1.2, F),
    blackhole: circ(12, 12, 7, T) + circ(12, 12, 4, F) +
      `<ellipse cx="12" cy="12" rx="10" ry="3.6" transform="rotate(-20 12 12)"${AS}/>`,
    mirror: `<ellipse cx="12" cy="9.5" rx="5.5" ry="6.5"${T}/><ellipse cx="12" cy="9.5" rx="5.5" ry="6.5"/>` +
      `<path d="M9.5 8l2-2M9.6 11l4-4"${AS}/>` + '<path d="M12 16v4.5M8.5 21h7"/>',
    galaxy: circ(12, 12, 1.7, A) +
      '<path d="M12 12c0-3 2.6-5.5 5.5-4.5M12 12c0 3-2.6 5.5-5.5 4.5M12 12c3 0 5.5 2.6 4.5 5.5M12 12c-3 0-5.5-2.6-4.5-5.5"/>' +
      circ(12, 12, 8.5, T) + circ(19.5, 4.5, 1, F) + circ(4.5, 19.5, 1, F),
    hand: duo('M7 11V6.5a1.5 1.5 0 0 1 3 0V10V4.5a1.5 1.5 0 0 1 3 0V10V5.5a1.5 1.5 0 0 1 3 0V11V8.5a1.5 1.5 0 0 1 3 0V15a7 7 0 0 1-7 7h-.5a6.5 6.5 0 0 1-5.2-2.6L3.6 15.3a1.5 1.5 0 0 1 2.3-2L7 14.5Z'),
    fist: duo(rr(5, 6.5, 14, 10.5, 3.5)) + '<path d="M9 6.8v3.7M12.5 6.6v3.9M16 6.8v3.7M5.3 12.5h5.2a1.8 1.8 0 0 1 0 3.5H8"/>' +
      duo(rr(7.5, 17, 9, 4.5, 1), A),
    planet: duoC(12, 12, 6, A) + `<ellipse cx="12" cy="12" rx="10.5" ry="3.4" transform="rotate(-22 12 12)"/>`,
    handshake: '<path d="M2.5 8.5 6 7l3.5 1.5L12 7l3 1.2L18 7l3.5 1.5"/>' +
      duo('M5 9.5 3 14l3 2.5 4.5 3.5a1.4 1.4 0 0 0 2-.2l.4-.5 1 .7a1.4 1.4 0 0 0 2-.4l.3-.5.6.3a1.4 1.4 0 0 0 1.8-.6L21 14l-2-4.5-4-1.5-4.5 3a1.6 1.6 0 0 1-2-2.5L11 7Z'),

    // Knöpfe in Spielen (Starten, Drehen, Feuer, Schritt …)
    play: duo('M8 5.2v13.6a1 1 0 0 0 1.5.86l10.6-6.8a1 1 0 0 0 0-1.72L9.5 4.34A1 1 0 0 0 8 5.2Z'),
    stop: duo(rr(5.5, 5.5, 13, 13, 2.5)),
    // Roulette-Kessel: Ring mit Fächern, Kugel in Gold
    roulette: duoC(12, 12, 9) + circ(12, 12, 4.4) +
      '<path d="M12 3v4.6M12 16.4V21M3 12h4.6M16.4 12H21M5.6 5.6l3.3 3.3M15.1 15.1l3.3 3.3M18.4 5.6l-3.3 3.3M8.9 15.1l-3.3 3.3"/>' +
      circ(17.4, 7.6, 1.7, A) + circ(12, 12, 1.4, F),
    repeat: '<path d="M4.5 11.5v-2a3 3 0 0 1 3-3h12M16 3l3.5 3.5L16 10M19.5 12.5v2a3 3 0 0 1-3 3h-12M8 21l-3.5-3.5L8 14"/>',
    shuffle: '<path d="M3.5 7H7c4.6 0 5.4 10 10 10h3.5M3.5 17H7c1.5 0 2.6-1.1 3.4-2.6M13.6 9.6C14.4 8.1 15.5 7 17 7h3.5M17.5 4l3 3-3 3M17.5 14l3 3-3 3"/>',
    // Kanonenkugel mit brennender Lunte
    bomb: duoC(10.5, 14, 6.5) + '<path d="M15.1 9.4 17.3 7.2M7.6 12.6a3.3 3.3 0 0 1 2.2-2.2"/>' +
      `<path d="${star(19.2, 4.8, 3.2, 1.2, 4)}"${A}/>`,
    // Pfotenabdruck (ein Schritt)
    step: duo('M12 11.5c-3.2 0-6 3.3-6 6 0 1.8 1.3 3 3 3 1.2 0 2-.6 3-.6s1.8.6 3 .6c1.7 0 3-1.2 3-3 0-2.7-2.8-6-6-6Z', A) +
      duoC(5.2, 9.6, 1.9) + duoC(9.4, 5.2, 2) + duoC(14.6, 5.2, 2) + duoC(18.8, 9.6, 1.9),
    up: '<path d="M12 20V4.5M6 10.5l6-6 6 6"/>',
    down: '<path d="M12 4v15.5M6 13.5l6 6 6-6"/>',
    forward: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    plane: duo('M20.6 3.4c-.8-.8-2.1-.7-2.9.1L14 7.2 5.4 5 3.6 6.8l7 4.2-3.3 3.3-2.8-.4-1.3 1.3 3.5 1.8 1.8 3.5 1.3-1.3-.4-2.8 3.3-3.3 4.2 7 1.8-1.8L19 9.9l3.7-3.7c.8-.8.9-2.1.1-2.8Z'),
    news: duo(rr(3.5, 4.5, 14, 15.5, 2)) + '<path d="M17.5 8.5h2a1 1 0 0 1 1 1V18a2 2 0 0 1-4 0M11.5 9h3M11.5 12h3M6.5 15.5h8"/>' +
      `<path d="${rr(6.5, 8, 3.2, 4.2, 0.6)}"${A}/>`,
    door: duo('M6 20.5V4.5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v16') + '<path d="M3.5 20.5h17"/>' + circ(14.6, 12.5, 1.3, A),
    pen: duo('M15.5 4.5a2.1 2.1 0 0 1 3 0l1 1a2.1 2.1 0 0 1 0 3L9 19l-5 1 1-5Z') + '<path d="M13.5 6.5l4 4"/>' +
      `<path d="M4 20l1-5 4 4Z"${A}/>`,
    // Sprechblase mit Ausrufezeichen („Lüge!“)
    shout: duo('M5 4.5h14a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-7.5L7 20.5V17H5a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2Z') +
      '<path d="M12 7.8v4.2"/>' + circ(12, 14.3, 1.1, F),
    heart: duo('M12 20.5S3.5 15.6 3.5 9.6A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8.5 2.6c0 6-8.5 10.9-8.5 10.9Z', A),
    wave: '<path d="M2.5 9.5c1.6-1.4 3.2-1.4 4.8 0s3.1 1.4 4.7 0 3.2-1.4 4.8 0 3.1 1.4 4.7 0M2.5 15.5c1.6-1.4 3.2-1.4 4.8 0s3.1 1.4 4.7 0 3.2-1.4 4.8 0 3.1 1.4 4.7 0"/>',
    briefcase: duo(rr(3.5, 7.5, 17, 12.5, 2)) + '<path d="M9 7.5v-2a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3.5 12.5h17"/>' +
      `<path d="${rr(10.5, 11, 3, 3, 0.6)}"${A}/>`,
    shield: duo('M12 3 19.5 6v5.5c0 4.6-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.9-7.5-9.5V6Z') +
      `<path d="M12 7.5 15.5 9v3c0 2.4-1.5 4.3-3.5 5.1-2-.8-3.5-2.7-3.5-5.1V9Z"${A}/>`,
    moon: duo('M19.5 14.6A8 8 0 0 1 9.4 4.5 8 8 0 1 0 19.5 14.6Z') +
      `<path d="M16.5 3.5v3M15 5h3"${AS}/>`,
    // Punkt für Verbindungs-Anzeigen (Farbe kommt aus dem Text)
    dot: circ(12, 12, 5, ' fill="currentColor"'), // Rand erbt die Linie (siehe .bac-choice .ic-dot)

    // Erfolge und Aufgaben
    castle: duo('M3.5 20.5V8h3v2H9V8h6v2h2.5V8h3v12.5Z') + '<path d="M10 20.5v-4a2 2 0 0 1 4 0v4"/>' +
      `<path d="M12 8V3.5l3 1.2-3 1.2"${AS}/>`,
    globe: duoC(12, 12, 9) + '<path d="M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9M12 3C9.4 5.6 8.2 8.6 8.2 12s1.2 6.4 3.8 9"/>' +
      `<path d="M3 12h18"${AS}/>`,
    bricks: duo(rr(3, 5, 18, 14, 1.5)) + `<path d="${rr(12.6, 10.3, 4.8, 3.4, 0.4)}"${A}/>` +
      '<path d="M3 9.7h18M3 14.3h18M9 5v4.7M15 5v4.7M6 9.7v4.6M12 9.7v4.6M18 9.7v4.6M9 14.3V19M15 14.3V19"/>',
    city: duo('M3 21V10h5v11Z') + duo('M8 21V4h8v17Z') + duo('M16 21V8.5h5V21Z') +
      '<path d="M11 7.5h2M11 11h2M11 14.5h2M5.5 13v.01M18.5 12v.01M18.5 15.5v.01M2 21h20"/>' + `<path d="M10.7 21v-3h2.6v3Z"${A}/>`,
    key: duoC(7.5, 12, 4) + circ(7.5, 12, 1.4, A) + '<path d="M11.5 12H21M17.5 12v3.5M20.5 12v2.5"/>',
    stopwatch: duoC(12, 13.5, 7.5) + '<path d="M10 2.5h4M12 2.5V6M18.2 6.8l1.4-1.4"/>' +
      `<path d="M12 13.5V9.5"${AS}/>` + circ(12, 13.5, 1.2, F),
    ball: duoC(12, 12, 9) + circ(13.5, 10.5, 3.6, A) + circ(13.5, 10.5, 3.6),
    spyglass: `<g transform="rotate(-30 12 12)">${duo(rr(1.5, 10, 7, 4, 1))}${duo(rr(8.5, 9, 6.5, 6, 1.2))}${duo(rr(15, 7.5, 7.5, 9, 1.5), A)}</g>` +
      '<path d="M9 18.5 6.5 21.5M9 18.5l2.5 3"/>',

    // Rang-Abzeichen (js/rank.js) – die Akzentfarbe zeigt die Stufe (Bronze, Silber, Gold …, siehe .rk-t*)
    boot: duo('M7.5 3.5h6v10l5 2a2.5 2.5 0 0 1 1.5 2.3v2.7H5.5V15c0-1.5 2-2.5 2-4.5Z') + '<path d="M5.5 18h14.5"/>' +
      `<path d="${rr(7.5, 6, 6, 2.4, 0.5)}"${A}/>`,
    mop: '<path d="M18.5 3 11 13"/>' + duo('M9.6 11.8 13 14.4 10.4 20.7H4Z') + '<path d="M6.3 20.7 9.6 14.6M8.5 20.7l2.7-5.2"/>' +
      `<path d="m9.2 11.2 4.2 3.1 1-1.4-4.2-3.1Z"${A}/>`,
    rope: circ(12.75, 12, 8.4, T) + '<path d="M12 12a1.5 1.5 0 0 1 3 0 3 3 0 0 1-6 0 4.5 4.5 0 0 1 9 0 6 6 0 0 1-12 0 7.5 7.5 0 0 1 15 0"/>' +
      circ(21, 12, 1.5, A),
    helm: duoC(12, 12, 6.5) + '<path d="M12 2.5v7M12 14.5v7M2.5 12h7M14.5 12h7M5.3 5.3l5 5M13.7 13.7l5 5M18.7 5.3l-5 5M10.3 13.7l-5 5"/>' +
      circ(12, 12, 2.2, A) + circ(12, 12, 2.2),
    // Dreispitz (Kapitän): hochgeschlagene Krempe, vorn ein Totenkopf-Knopf in der Akzentfarbe
    hat: duo('M6.8 9.8C6.8 6.6 9 4 12 4s5.2 2.6 5.2 5.8Z') +
      duo('M2.5 6.5c3 2.6 6 3.8 9.5 3.8s6.5-1.2 9.5-3.8c-1 6.3-5 10.8-9.5 12.5-4.5-1.7-8.5-6.2-9.5-12.5Z') +
      circ(12, 14, 1.9, A),
    laurel: duo(star(12, 10.5, 5.5, 2.4, 5), A) +
      '<path d="M5 8c-1 4 0 8 4.5 11.5M19 8c1 4 0 8-4.5 11.5M4.6 11.5l-2-.8M5.6 15l-1.8.2M7.3 18l-1.4.9M19.4 11.5l2-.8M18.4 15l1.8.2M16.7 18l1.4.9"/>',
    stars: duo(star(12, 7.5, 5, 2.2, 5), A) + duo(star(6.5, 16, 4.5, 2, 5), A) + duo(star(17.5, 16, 4.5, 2, 5), A),
  };

  // ---------- Emoji → eigenes Symbol ----------
  // Für Meldungen, Erfolge und Toasts: Emojis, die als Schmuck vor oder in Texten stehen, werden durch
  // Symbole aus dem Sprite ersetzt. Wert: Name oder [Name, Zusatzklasse]. Emojis ohne Eintrag bleiben stehen.
  const EMOJI = {
    '👆': 'tap', '🖱️': 'tap', '🦾': 'fist', '✊': 'fist', '🪙': 'coins', '💰': 'bag', '💸': 'coins', '🤑': 'coins',
    '🏆': 'trophy', '👑': 'crown', '📈': 'trend', '📊': 'chart', '🏭': 'gear', '🏰': 'castle', '🌍': 'globe',
    '🌠': 'comet', '☄️': 'comet', '🧱': 'bricks', '🏙️': 'city', '🌆': 'city', '🏗️': 'bricks', '🗂️': 'chest',
    '🏴‍☠️': 'skull', '☠️': 'skull', '💀': 'skull', '🐉': 'dragon', '🌌': 'galaxy', '🔱': 'trident', '💥': 'burst',
    '⭐': 'star', '🌟': 'star', '💫': 'sparkle', '✨': 'sparkle', '🎉': 'sparkle', '🦄': 'sparkle',
    '⛵': 'sailboat', '🧭': 'compass', '🚢': 'ship', '💎': 'gem', '💠': 'gem', '⚔️': 'swords', '🐙': 'kraken',
    '📜': 'scroll', '⬆️': 'up', '⬇️': 'down', '🎯': 'target', '🔥': 'flame', '🌋': 'volcano', '🤝': 'handshake',
    '🪐': 'planet', '⚜️': 'temple', '🎨': 'palette', '🧥': 'palette', '🗝️': 'key', '🔑': 'key',
    '📅': 'calendar', '🗓️': 'calendar', '⚓': 'anchor', '🎲': 'dice', '🎟️': 'ticket', '🎫': 'ticket',
    '7️⃣': 'slot', '🎰': 'slot', '🟢': 'roulette', '🎡': 'wheel', '🃏': 'cards', '♠️': 'cards', '✌️': 'cards',
    '4️⃣': 'cards', '🎁': 'gift', '🏝️': 'island', '⏱️': 'stopwatch', '⏳': 'hourglass', '⌛': 'hourglass',
    '💣': 'bomb', '🐔': 'step', '🔮': 'eye', '🔭': 'spyglass', '🗺️': 'map', '🧰': 'chest', '🫙': 'piggy',
    '🐷': 'piggy', '🥇': ['medal', 'ic-gold'], '🥈': ['medal', 'ic-silver'], '🥉': ['medal', 'ic-bronze'],
    '🏅': 'medal', '🎖️': 'medal', '🖤': 'pearl', '⚡': 'bolt', '📝': 'pen', '✏️': 'pen', '⛳': 'flag',
    '🚩': 'flag', '🏁': 'flag', '🕳️': 'target', '🎱': 'ball', '🔴': 'target', '💯': 'target', '👥': 'users',
    '👤': 'user', '🔒': 'lock', '🔓': 'unlock', '✅': 'check', '✔️': 'check', '❌': 'close', '⚠️': 'warning',
    '⏸️': 'pause', '▶️': 'play', '🔁': 'repeat', '🔄': 'repeat', '🛡️': 'shield', '❤️': 'heart', '💾': 'save',
    '🌙': 'moon', '🍀': 'clover', '🤖': 'robot', '⚙️': 'gear', '🧪': 'flask', '🔔': 'sparkle', '📰': 'news',
    '🌊': 'wave', '💼': 'briefcase', '🐀': 'boot', '🧹': 'mop', '🪢': 'rope', '☸️': 'helm', '💨': 'wind', '✈️': 'plane', '🛬': 'plane', '🛫': 'plane', '📯': 'flag',
  };
  // Mit und ohne Variantenzeichen (U+FE0F) erkennen; längere Folgen zuerst (🏴‍☠️ vor ☠️)
  const EMOJI_ALL = {};
  Object.keys(EMOJI).forEach(k => {
    EMOJI_ALL[k] = EMOJI[k];
    EMOJI_ALL[k.replace(/️/g, '')] = EMOJI[k];
  });
  const EMOJI_RE = new RegExp(Object.keys(EMOJI_ALL).filter(Boolean).sort((a, b) => b.length - a.length)
    .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\uFE0F?').join('|'), 'gu');
  const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

  // ---------- Bilder der Spielkarten (48 × 48, farbig) ----------
  // Farben der Bilder (fest, weil die Karten immer auf dunklem Filz liegen)
  const INK = '#22160a';
  const GOLD = 'url(#gk-gold)';
  const GOLD_D = '#b07d0c';
  const CREAM = '#f6ecd2';
  const RED = '#d0453d';
  const RED_D = '#8e2620';
  const TEAL = '#2bb3a0';
  const SEA = '#2f86c9';
  const SEA_D = '#1b4f7a';
  const WOOD = '#9a6332';
  const WOOD_D = '#5e3a1a';
  const GREEN = '#3fa35c';
  const BLACK = '#26262c';

  const p = (d, fill, extra) => `<path d="${d}" fill="${fill}"${extra || ''}/>`;
  const o = (x, y, r, fill, extra) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"${extra || ''}/>`;
  const R = (x, y, w, h, r, fill, extra) => p(rr(x, y, w, h, r), fill, extra);
  const glint = (x, y, s) => p(star(x, y, s, s * 0.28, 4), '#fff', ' stroke="none" opacity=".9"');
  const txt = (x, y, size, fill, s, extra) =>
    `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" stroke="none" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-weight="900"${extra || ''}>${s}</text>`;
  const spade = (x, y, s, fill) =>
    p(`M${x} ${y - 5 * s}c${-3 * s} ${3.2 * s} ${-5 * s} ${4.6 * s} ${-5 * s} ${6.8 * s}a${2.5 * s} ${2.5 * s} 0 0 0 ${4.5 * s} ${1.4 * s}l${-0.8 * s} ${3 * s}h${2.6 * s}l${-0.8 * s} ${-3 * s}a${2.5 * s} ${2.5 * s} 0 0 0 ${4.5 * s} ${-1.4 * s}c0 ${-2.2 * s} ${-2 * s} ${-3.6 * s} ${-5 * s} ${-6.8 * s}Z`, fill, ' stroke="none"');
  const heart = (x, y, s, fill) =>
    p(`M${x} ${y + 5 * s}c${-3 * s} ${-2.6 * s} ${-5.5 * s} ${-4.6 * s} ${-5.5 * s} ${-7.2 * s}a${2.8 * s} ${2.8 * s} 0 0 1 ${5.5 * s} ${-1}a${2.8 * s} ${2.8 * s} 0 0 1 ${5.5 * s} ${1}c0 ${2.6 * s} ${-2.5 * s} ${4.6 * s} ${-5.5 * s} ${7.2 * s}Z`, fill, ' stroke="none"');
  const diamond = (x, y, s, fill) => p(`M${x} ${y - 5.5 * s}l${4 * s} ${5.5 * s}-${4 * s} ${5.5 * s}-${4 * s}-${5.5 * s}Z`, fill, ' stroke="none"');
  const club = (x, y, s, fill) =>
    o(x, y - 2.6 * s, 2.5 * s, fill, ' stroke="none"') + o(x - 2.7 * s, y + 1 * s, 2.5 * s, fill, ' stroke="none"') +
    o(x + 2.7 * s, y + 1 * s, 2.5 * s, fill, ' stroke="none"') + p(`M${x - 1 * s} ${y}h${2 * s}l${0.8 * s} ${5 * s}h${-3.6 * s}Z`, fill, ' stroke="none"');
  const card = (x, y, w, h, rot, inner) =>
    `<g transform="rotate(${rot} ${x + w / 2} ${y + h / 2})">${R(x, y, w, h, 3, '#fffdf6')}${inner || ''}</g>`;
  const coin = (x, y, r) => o(x, y, r, GOLD) + o(x, y, r * 0.62, 'none', ` stroke="${GOLD_D}" stroke-width="1.2"`);
  const waves = y => p(`M4 ${y}c3-2 5-2 8 0s5 2 8 0 5-2 8 0 5 2 8 0 5-2 8 0 5 2 8 0`, 'none', ` stroke="${SEA}" stroke-width="2.4"`);
  const die = (x, y, s, rot, pips, fill, pip) =>
    `<g transform="rotate(${rot} ${x + s / 2} ${y + s / 2})">${R(x, y, s, s, s * 0.22, fill || '#fffdf6')}` +
    pips.map(([px, py]) => o(x + px * s, y + py * s, s * 0.09, pip || INK, ' stroke="none"')).join('') + '</g>';
  const PIPS = {
    1: [[0.5, 0.5]], 2: [[0.28, 0.28], [0.72, 0.72]], 3: [[0.26, 0.26], [0.5, 0.5], [0.74, 0.74]],
    4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
    5: [[0.26, 0.26], [0.74, 0.26], [0.5, 0.5], [0.26, 0.74], [0.74, 0.74]],
    6: [[0.28, 0.24], [0.72, 0.24], [0.28, 0.5], [0.72, 0.5], [0.28, 0.76], [0.72, 0.76]],
  };
  // Glücksrad / Roulette: Kreissegmente
  function wedges(cx, cy, r, colors) {
    const k = colors.length;
    return colors.map((col, i) => {
      const a0 = -Math.PI / 2 + i * 2 * Math.PI / k;
      const a1 = a0 + 2 * Math.PI / k;
      return p(`M${cx} ${cy}L${n(cx + r * Math.cos(a0))} ${n(cy + r * Math.sin(a0))}A${r} ${r} 0 0 1 ${n(cx + r * Math.cos(a1))} ${n(cy + r * Math.sin(a1))}Z`, col, ' stroke-width="1"');
    }).join('');
  }

  const GAMES = {
    // Automaten
    slots: R(9, 10, 26, 32, 5, RED) + p('M9 18a13 9 0 0 1 26 0Z', GOLD) + R(12.5, 19, 19, 12, 2.5, CREAM) +
      p('M18.8 19v12M25.2 19v12', 'none', ` stroke="${RED_D}" stroke-width="1.2"`) +
      [15.6, 22, 28.4].map(x => txt(x, 28.6, 9, RED, '7')).join('') +
      R(14, 34.5, 16, 3.5, 1.7, RED_D) + p('M35 30h4.5V18', 'none', ' stroke-width="2.6"') + p('M35 30h4.5V18', 'none', ` stroke="#c9ccd2" stroke-width="1.2"`) +
      o(39.5, 15.5, 3.2, RED) + glint(17, 13.5, 2.2) + o(22, 12.6, 1.4, CREAM),
    vsPirate: p('M10 6v38', 'none', ' stroke-width="2.8"') + p('M10 6v38', 'none', ` stroke="${WOOD}" stroke-width="1.3"`) +
      p('M11 8c6-3 10 2 16 0s9-3 14-1v20c-5-2-8-1-14 1s-10-3-16 0Z', BLACK) +
      p('M26 12c-4 0-6.5 2.6-6.5 6 0 2 1 3.4 2.3 4.2v2.3h8.4v-2.3c1.3-.8 2.3-2.2 2.3-4.2 0-3.4-2.5-6-6.5-6Z', CREAM, ' stroke="none"') +
      o(23.4, 18.2, 1.6, BLACK, ' stroke="none"') + o(28.6, 18.2, 1.6, BLACK, ' stroke="none"') +
      p('M18 26.5l16-3M18 23.5l16 3', 'none', ` stroke="${CREAM}" stroke-width="2.2"`) +
      o(10, 5, 2.4, GOLD) + coin(34, 38, 6),
    vsOcean: p('M6 28c0-9 8-16 18-16s18 7 18 16Z', '#f3a7a0') +
      p('M10 28c0-6 6-12 14-12M24 16v12M15 18l4 10M33 18l-4 10M38 28c0-6-6-12-14-12', 'none', ` stroke="${RED_D}" stroke-width="1.1" opacity=".55"`) +
      p('M6 28h36c0 7-8 12-18 12S6 35 6 28Z', '#f7c3b6') + o(24, 30, 6.2, '#fffaf0') + glint(21.8, 27.6, 2.2) +
      o(37, 10, 2.2, 'none', ` stroke="${TEAL}" stroke-width="1.4"`) + o(41, 16, 1.4, 'none', ` stroke="${TEAL}" stroke-width="1.2"`),
    vsVolcano: p('M4 42 17 18h14l13 24Z', WOOD) + p('M17 18c2 3 5 3.5 7 2.5s5-.5 7-2.5l3 5.5c-3 1.5-5-1-7 .5s-4 3-7 1-4.5-.5-6 0Z', '#f07a2e') +
      p('M22 20c1 5 2 9 1 14 2-3 3-7 3-14Z', '#ffb43a', ' stroke="none"') +
      coin(13, 9, 4.2) + coin(24, 6.5, 4.6) + coin(35, 10, 4) + o(19, 14, 1.4, '#ffb43a') + o(30, 14.5, 1.2, '#ffb43a'),
    // Schnelle Spiele
    scratch: card(6, 10, 36, 26, -6, R(11, 15, 26, 16, 3, GOLD) +
      p('M13 26c3-3 5 1 8-2s4 0 7-3 4 1 7-1', 'none', ` stroke="#fffdf6" stroke-width="3.2"`) + txt(17, 22, 7, RED_D, '$', ' stroke="none"')) + coin(37, 36, 6.5) + glint(12, 12, 2.6),
    wheel: p('M24 41v4M17 45h14', 'none', ' stroke-width="3"') +
      o(24, 22, 18, WOOD_D) + wedges(24, 22, 15, [RED, CREAM, TEAL, GOLD_D, RED, CREAM, TEAL, GOLD_D]) +
      o(24, 22, 4, GOLD) + [0, 1, 2, 3, 4, 5, 6, 7].map(i => o(n(24 + 16.6 * Math.cos(i * Math.PI / 4 + 0.39)), n(22 + 16.6 * Math.sin(i * Math.PI / 4 + 0.39)), 1, '#ffe58a', ' stroke="none"')).join('') +
      p('M24 9.5 20.5 2.5h7Z', RED),
    plinko: [[24, 14], [18, 21], [30, 21], [12, 28], [24, 28], [36, 28], [6, 35], [18, 35], [30, 35], [42, 35]]
      .map(([x, y]) => o(x, y, 1.9, '#c9ccd2')).join('') +
      p('M30 4c1 3-1 5-4.5 6.5', 'none', ' stroke="#ffe58a" stroke-width="1.6" stroke-dasharray="1.5 2.5" opacity=".8"') +
      coin(22, 12, 5) + R(4, 40, 40, 5, 1.5, WOOD) + p('M12 40v5M20 40v5M28 40v5M36 40v5', 'none', ' stroke-width="1.2"') +
      R(20, 40.2, 8, 4.6, 0, GOLD, ' stroke="none" opacity=".9"'),
    mines: waves(41) + p('M6 38c4-6 11-9 18-9s14 3 18 9Z', '#e8c27a') +
      p('M24 30c1-7 .5-12-2.5-17', 'none', ` stroke="${WOOD_D}" stroke-width="4"`) + p('M24 30c1-7 .5-12-2.5-17', 'none', ` stroke="${WOOD}" stroke-width="2"`) +
      p('M21.5 13c-4-5-10-5-14-1 5 0 9 1 14 1ZM21.5 13c2-5 8-7 14-5-5 1-9 3-14 5ZM21.5 13c-5 0-9 3-10 8 4-3 7-5 10-8ZM21.5 13c5 0 10 3 11.5 7.5-4-2.5-8-5-11.5-7.5Z', GREEN) +
      p('M30 32l5 5M35 32l-5 5', 'none', ` stroke="${RED}" stroke-width="2.6"`),
    crash: p('M8 42C12 30 20 20 33 13', 'none', ' stroke="#ffe58a" stroke-width="2" stroke-dasharray="2 3" opacity=".75"') +
      o(31, 18, 9, BLACK) + glint(27.5, 14.5, 2.4) + R(35, 6.5, 5, 5, 1.2, '#5b5b66', ' transform="rotate(40 37.5 9)"') +
      p('M39 7.5c2-2 4-1.5 4.5-4', 'none', ` stroke="${WOOD}" stroke-width="1.6"`) +
      p(star(44, 3.5, 3.6, 1.3, 6), '#ffb43a') + o(44, 3.5, 1, '#fff', ' stroke="none"'),
    race: waves(40) +
      p('M5 32h17l-3 5H8Z', WOOD) + p('M13 32V12', 'none', ' stroke-width="1.8"') + p('M13 13c5 3 7 9 6 16H13Z', CREAM) + p('M13 12l-4 1.5 4 1.5Z', RED) +
      p('M24 34h18l-3 5H27Z', WOOD_D) + p('M33 34V16', 'none', ' stroke-width="1.8"') + p('M33 17c5 3 6 8 5 14h-5Z', '#d8e7f3') + p('M33 17c-4 3-6 8-6 14h6Z', '#c3d6e6') + p('M33 16l4 1.5-4 1.5Z', TEAL),
    flight: p('M4 40c8-2 14-6 18-12', 'none', ' stroke="#d8e7f3" stroke-width="2" stroke-dasharray="2 3" opacity=".8"') +
      `<g transform="rotate(-24 27 21)">` +
      R(10, 18, 30, 7, 3.5, RED) + p('M22 18l4-10h4l-2 10ZM22 25l4 10h4l-2-10Z', CREAM) + p('M12 18l-2-6h3.5l3.5 6Z', CREAM) +
      o(39.5, 21.5, 1.6, GOLD) + p('M41 15v13', 'none', ' stroke-width="2"') + R(31, 19.5, 4, 3, 1, '#9bd3f0', ' stroke-width="1"') + '</g>',
    chicken: p('M18 40l-1 5M26 40l1 5', 'none', ' stroke="#f0a020" stroke-width="2.4"') +
      p('M12 26c0-8 5-15 12-15 6 0 10 4 10 9 4 1 6 4 6 8 0 7-7 12-15 12-8 0-13-6-13-14Z', '#fffdf6') +
      p('M22 11c-1-3 1-6 3-5 1-3 4-2 4 0 2-1 4 1 3 3', RED) + p('M34 18l6 2-6 2Z', '#f0a020') +
      p('M33 23c1 2 1 4-1 5', RED) + o(30, 17.5, 1.6, INK, ' stroke="none"') +
      p('M16 27c3 2 7 2 10 0', 'none', ' stroke-width="1.4"'),
    tower: p('M24 44V8', 'none', ` stroke-width="4.4"`) + p('M24 44V8', 'none', ` stroke="${WOOD}" stroke-width="2.6"`) +
      p('M15 13h18l-2 6H17Z', WOOD) + p('M17 13v-2.5h14V13', 'none', ' stroke-width="1.6"') +
      p('M24 8V3l8 2.5-8 2.5', RED) + p('M14 44 22.5 19M34 44 25.5 19', 'none', ` stroke="#d6b98a" stroke-width="1.4"`) +
      p('M17 37h14M18.5 32h11M20 27h8', 'none', ` stroke="#d6b98a" stroke-width="1.2"`) + p('M9 30h10M8.5 26 19 22', 'none', ` stroke="#d6b98a" stroke-width="1"`) +
      glint(36, 10, 2.4),
    keno: p('M6 10c3-2 6-2 9 0s6 2 9 0 6-2 9 0 6 2 9 0v28c-3 2-6 2-9 0s-6-2-9 0-6 2-9 0-6-2-9 0Z', '#ecd6a4') +
      p('M10 33c4-2 6-8 11-9s6 4 10 2', 'none', ` stroke="${RED_D}" stroke-width="1.6" stroke-dasharray="2 2.4"`) +
      p('M32 22l5 5M37 22l-5 5', 'none', ` stroke="${RED}" stroke-width="2.6"`) +
      o(13, 18, 3.6, GOLD) + o(23, 15, 3.6, TEAL) + o(14, 33, 3, CREAM),
    stopwatch: R(21, 3, 6, 4.5, 1.2, GOLD) + p('M34.5 11.5l3-3', 'none', ' stroke-width="3"') +
      o(24, 26, 17, GOLD) + o(24, 26, 13, CREAM) +
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => {
        const a = i * Math.PI / 6;
        const r1 = i % 3 ? 11.2 : 9.8;
        return `<path d="M${n(24 + r1 * Math.sin(a))} ${n(26 - r1 * Math.cos(a))}L${n(24 + 12 * Math.sin(a))} ${n(26 - 12 * Math.cos(a))}" fill="none" stroke-width="1.1"/>`;
      }).join('') +
      p('M24 26 31 19.5', 'none', ` stroke="${RED}" stroke-width="2"`) + p('M24 26v-9', 'none', ' stroke-width="2"') + o(24, 26, 1.8, RED_D),
    // Börse
    stocks: R(5, 6, 38, 36, 4, '#123a2b') +
      p('M11 30v8M17 24v10M23 26v8M29 16v12M35 10v10', 'none', ` stroke="${CREAM}" stroke-width="1.2"`) +
      R(9, 31, 4, 5, 0.8, RED) + R(15, 25, 4, 7, 0.8, GREEN) + R(21, 27, 4, 5, 0.8, RED) + R(27, 18, 4, 8, 0.8, GREEN) + R(33, 12, 4, 6, 0.8, GREEN) +
      p('M9 36 19 24l6 4 13-16', 'none', ' stroke="#ffe58a" stroke-width="2.4" stroke-linecap="round"') + p('M33 12h6v6', 'none', ' stroke="#ffe58a" stroke-width="2.4"'),
    // Tischspiele
    roulette: o(24, 24, 19, WOOD_D) + wedges(24, 24, 16, Array.from({ length: 18 }, (_, i) => i === 0 ? GREEN : i % 2 ? RED : BLACK)) +
      o(24, 24, 10, WOOD) + o(24, 24, 7, '#7a4a22') +
      p('M24 17v14M17 24h14', 'none', ` stroke="${GOLD_D}" stroke-width="2"`) + o(24, 24, 3, GOLD) +
      o(33.5, 13.5, 2.3, '#fff') + glint(14, 10, 2.4),
    blackjack: card(6, 9, 21, 30, -12, txt(11.5, 18, 7, INK, 'A') + spade(16.5, 26, 1, INK)) +
      card(20, 9, 21, 30, 10, txt(25.5, 18, 7, RED, 'K') + heart(30.5, 25, 1, RED)) + glint(40, 8, 2.6),
    baccarat: card(5, 10, 20, 29, -8, txt(15, 31, 16, INK, '8')) + card(23, 10, 20, 29, 8, txt(33, 31, 16, RED, '9')) +
      o(24, 41, 5.5, GOLD) + o(24, 41, 3, 'none', ` stroke="${GOLD_D}" stroke-width="1.2"`) + p('M19 7l2-3h6l2 3Z', GOLD),
    hilo: card(13, 9, 22, 31, 0, txt(24, 30, 15, INK, '?')) +
      p('M41 21V11M37 15l4-4.5 4 4.5', 'none', ` stroke="${GREEN}" stroke-width="3"`) +
      p('M7 27v10M3 33l4 4.5 4-4.5', 'none', ` stroke="${RED}" stroke-width="3"`),
    poker: o(24, 24, 19, RED) + wedges(24, 24, 19, Array.from({ length: 16 }, (_, i) => i % 2 ? RED : '#fffdf6')) +
      o(24, 24, 15, RED) + o(24, 24, 12, CREAM) + spade(24, 23, 1.35, INK) +
      o(24, 24, 12, 'none', ` stroke="${GOLD_D}" stroke-width="1.2" stroke-dasharray="1.5 2"`),
    // Mit Freunden
    dice: `<g transform="rotate(-28 15 33)">${p('M5 24h20l-2.5 18h-15Z', WOOD_D)}${R(3.5, 22, 23, 4.5, 1.5, WOOD)}${p('M8 31h14M8.6 36h12.8', 'none', ` stroke="${WOOD}" stroke-width="1.2"`)}</g>` +
      die(24, 14, 13, 18, PIPS[5]) + die(30, 30, 12, -10, PIPS[3], RED, '#fffdf6'),
    kniffel: R(6, 6, 22, 34, 3, '#fffdf6') + p('M10 13h14M10 18h14M10 23h14M10 28h14M10 33h9', 'none', ` stroke="#9fb8c8" stroke-width="1.2"`) +
      p('M17 9v28', 'none', ` stroke="${RED}" stroke-width="1"`) +
      die(22, 21, 13, -14, PIPS[6]) + die(30, 31, 12, 12, PIPS[6], GOLD) + die(32, 10, 10, 8, PIPS[6], RED, '#fffdf6'),
    maumau: card(3, 12, 18, 26, -22, club(9, 19, 0.75, INK)) + card(15, 7, 18, 26, 0, diamond(20, 13.5, 0.75, RED) + diamond(24, 21, 1.2, RED)) +
      card(27, 12, 18, 26, 22, heart(32, 19, 0.75, RED) + heart(36, 27, 1.15, RED)),
    golf: p('M4 38c6-5 14-7 20-7s14 2 20 7c-6 4-14 6-20 6S10 42 4 38Z', GREEN) +
      `<ellipse cx="29" cy="37" rx="4.2" ry="1.8" fill="${INK}"/>` + p('M29 37V6', 'none', ' stroke-width="1.8"') +
      p('M29 7l12 4.5L29 16Z', RED) + o(14, 36, 3, '#fffdf6') + glint(13, 35, 1.2),
    pool: R(4, 27, 40, 5, 2.5, WOOD, ' transform="rotate(-30 24 29.5)"') + o(19, 22, 13, BLACK) + o(19, 22, 6, '#fffdf6') +
      txt(19, 25.2, 8.5, INK, '8') + glint(13, 16, 2.6) + o(38, 37, 6, RED) + glint(36, 35, 1.5),
    connect4: R(6, 10, 36, 30, 4, SEA) + p('M9 40v4M39 40v4', 'none', ' stroke-width="3"') +
      [[0, 0, ''], [1, 0, ''], [2, 0, ''], [3, 0, ''], [0, 1, ''], [1, 1, 'r'], [2, 1, ''], [3, 1, ''],
        [0, 2, 'g'], [1, 2, 'r'], [2, 2, 'g'], [3, 2, ''], [0, 3, 'r'], [1, 3, 'g'], [2, 3, 'r'], [3, 3, 'g']]
        .map(([x, y, col]) => o(12.75 + x * 7.5, 15.5 + y * 6.6, 2.7, col === 'r' ? RED : col === 'g' ? '#f5c542' : SEA_D)).join('') +
      o(35.25, 4.5, 2.9, RED),
    battleship: R(4, 6, 40, 36, 4, SEA_D) +
      p('M4 15h40M4 24h40M4 33h40M13 6v36M22 6v36M31 6v36', 'none', ` stroke="${SEA}" stroke-width="1"`) +
      p('M8 28h24l-3 6H12Z', '#9aa3ad') + R(14, 23, 9, 5, 1, '#c3cad1') + p('M17 23v-4h3v4', '#7d8792') + p('M23 25.5h6', 'none', ' stroke-width="1.8"') +
      o(36, 14, 5, 'none', ` stroke="${RED}" stroke-width="2"`) + p('M36 7v4M36 17v4M29 14h4M39 14h4', 'none', ` stroke="${RED}" stroke-width="2"`) +
      o(36, 14, 1.4, RED, ' stroke="none"'),
    darts: o(22, 26, 18, BLACK) + wedges(22, 26, 16, Array.from({ length: 16 }, (_, i) => i % 2 ? CREAM : BLACK)) +
      o(22, 26, 11, 'none', ` stroke="${RED}" stroke-width="2.6"`) + o(22, 26, 16, 'none', ` stroke="${GREEN}" stroke-width="2.4"`) +
      o(22, 26, 3.6, GREEN) + o(22, 26, 1.6, RED, ' stroke="none"') +
      p('M23 25 39 9', 'none', ' stroke-width="2.4"') + p('M23 25 39 9', 'none', ' stroke="#c9ccd2" stroke-width="1"') +
      p('M38 10l1.5-6 2.5 3.5ZM38 10l6-1.5L40.5 6Z', RED),
    duel: o(30, 33, 8.5, WOOD) + o(30, 33, 2.4, WOOD_D) + p('M30 24.5v17M21.5 33h17', 'none', ` stroke="${WOOD_D}" stroke-width="1.4"`) +
      `<g transform="rotate(-20 24 26)">` + R(10, 21, 28, 10, 5, '#3c3f48') + R(34, 20, 4, 12, 1.6, '#5b5f6b') + R(13.5, 20.5, 2.5, 11, 1, GOLD) + '</g>' +
      p('M8 26c-2-1-4-3-3.5-5.5 1-1 2.5-1 3.5-.5 0-2 2-3.5 4-3 1.5-1.5 4-1 4.5.5', '#e8eef2') +
      p('M3 43h42', 'none', ` stroke="${WOOD_D}" stroke-width="2"`),
  };

  // ---------- Sprite zusammenbauen ----------
  function symbols() {
    const small = Object.keys(ICONS).map(k => `<symbol id="i-${k}" viewBox="0 0 24 24">${ICONS[k]}</symbol>`).join('');
    const big = Object.keys(GAMES).map(k =>
      `<symbol id="g-${k}" viewBox="0 0 48 48"><g stroke="${INK}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">${GAMES[k]}</g></symbol>`).join('');
    return small + big;
  }

  function spriteHTML() {
    // Nicht display:none – sonst zeichnen manche Browser die Verläufe (gk-gold) nicht
    return '<svg xmlns="http://www.w3.org/2000/svg" id="gk-sprite" aria-hidden="true" focusable="false" ' +
      'style="position:absolute;width:0;height:0;overflow:hidden">' +
      '<defs><linearGradient id="gk-gold" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#ffe58a"/><stop offset=".5" stop-color="#f5c542"/><stop offset="1" stop-color="#c38d12"/>' +
      '</linearGradient></defs>' + symbols() + '</svg>';
  }

  function inject() {
    if (document.getElementById('gk-sprite')) return;
    document.body.insertAdjacentHTML('afterbegin', spriteHTML());
  }

  if (typeof document !== 'undefined' && document.body) inject();

  // Ein kleines Symbol als HTML-Text
  GK.icon = function (name, extraClass) {
    return `<svg class="ic ic-${name}${extraClass ? ' ' + extraClass : ''}" aria-hidden="true" focusable="false"><use href="#i-${name}"/></svg>`;
  };

  // Bild für die Spielkarte in der Lobby; ohne eigenes Bild bleibt das Emoji
  GK.gameIcon = function (id, fallback) {
    if (!GAMES[id]) return fallback || '';
    return `<svg class="ic ic-game" aria-hidden="true" focusable="false"><use href="#g-${id}"/></svg>`;
  };

  // Symbol zu einem Emoji (oder '' ohne Eintrag): GK.iconFor('⚓') → Anker
  GK.iconFor = function (emoji, extraClass) {
    const hit = EMOJI_ALL[String(emoji || '').trim()] || EMOJI_ALL[String(emoji || '').trim().replace(/️/g, '')];
    if (!hit) return '';
    const [name, cls] = Array.isArray(hit) ? hit : [hit, ''];
    return GK.icon(name, [cls, extraClass].filter(Boolean).join(' '));
  };

  // Reiner Text → sicheres HTML, bekannte Emojis werden zu Symbolen (für Toasts)
  GK.iconText = function (text) {
    return esc(text).replace(EMOJI_RE, m => GK.iconFor(m) || m);
  };

  // Bekannte Emojis in den Textstellen eines Elements ersetzen (Meldungen); .emoji-keep bleibt, wie es ist
  GK.iconifyEmoji = function (root) {
    if (!root || typeof document === 'undefined') return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const hits = [];
    for (let t = walker.nextNode(); t; t = walker.nextNode()) {
      EMOJI_RE.lastIndex = 0;
      if (EMOJI_RE.test(t.nodeValue) && !(t.parentElement && t.parentElement.closest('.emoji-keep, svg'))) hits.push(t);
    }
    hits.forEach(t => {
      const span = document.createElement('span');
      span.innerHTML = GK.iconText(t.nodeValue);
      t.replaceWith(...span.childNodes);
    });
  };

  // Nur ein Emoji ganz vorn ersetzen (Meldungszeilen der Spiele) – Symbole im Text (Walzen, Karten) bleiben
  GK.iconifyLead = function (root) {
    if (!root || typeof document === 'undefined') return;
    let t = root.firstChild;
    while (t && t.nodeType === 1 && !t.matches('svg, .emoji-keep')) t = t.firstChild;
    if (!t || t.nodeType !== 3) return;
    const m = /^(\s*)(\S+?)(?=\s|$)/u.exec(t.nodeValue);
    const svg = m && GK.iconFor(m[2]);
    if (!svg) return;
    const span = document.createElement('span');
    span.innerHTML = m[1] + svg;
    t.nodeValue = t.nodeValue.slice(m[0].length);
    t.before(...span.childNodes);
  };

  GK.icons = { names: Object.keys(ICONS), games: Object.keys(GAMES), emoji: EMOJI, spriteHTML };
})();
