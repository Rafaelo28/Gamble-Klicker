// Eigene Figur („Skin“): aus Teilen zusammengebaut – Kopf, Hut, Augen, Mund, Kleidung, Farbe und Extra.
// Gespeichert und an die anderen geschickt wird nur ein kurzer Code (z. B. „3.0.0.0.1.4.4“ = John Pork);
// gezeichnet wird sie als kleines SVG überall dort, wo sonst das Emoji-Bild steht (Spiele mit Freunden,
// Poker, Freundes-Rangliste). Empfangene Codes werden geprüft: nur bekannte Teile.
// Ein paar Teile sind Belohnungen und erst freigeschaltet, wenn man im Spiel weit genug ist.
window.GK = window.GK || {};

(function () {
  const LINE = 'rgba(0,0,0,.55)';

  // ---------- Teile ----------
  // Köpfe: Hautfarbe und Art (für Ohren, Schnauze, Augen- und Mundposition)
  const HEADS = [
    { name: 'Hell', skin: '#f2c9a0' },
    { name: 'Mittel', skin: '#c68a5a' },
    { name: 'Dunkel', skin: '#7a4a2a' },
    { name: 'Schwein', skin: '#f5a3b5', kind: 'pig' },
    { name: 'Skelett', skin: '#efeee6', kind: 'skull' },
    { name: 'Frosch', skin: '#6cc24a', kind: 'frog' },
    { name: 'Katze', skin: '#f0a040', kind: 'cat' },
    { name: 'Affe', skin: '#8a5a3a', kind: 'monkey' },
    { name: 'Roboter', skin: '#a7b4c2', kind: 'robot', unlock: s => s.totalClicks >= 100000, hint: 'Ab 100.000 Klicks' },
    { name: 'Alien', skin: '#8be08b', kind: 'alien', unlock: s => s.achievements.length >= 50, hint: 'Ab 50 Erfolgen' },
    { name: 'Zombie', skin: '#9fbf8f', kind: 'zombie' },
    { name: 'Geist', skin: '#e9eef8', kind: 'ghost', rank: 10 },
  ];

  const HATS = [
    { name: 'Ohne' },
    { name: 'Dreispitz' },
    { name: 'Kopftuch' },
    { name: 'Kapitänsmütze' },
    { name: 'Krone', unlock: s => s.casino.vip >= 2, hint: 'Ab der VIP-Karte Gold' },
    { name: 'Zylinder' },
    { name: 'Schirmmütze' },
    { name: 'Wikingerhelm', unlock: s => s.prestige.journeys >= 10, hint: 'Nach 10 großen Fahrten' },
    { name: 'Partyhut' },
    { name: 'Strubbelhaare' },
    { name: 'Lange Haare' },
    { name: 'Admiralshut', rank: 9 },
    { name: 'Heiligenschein', rank: 13 },
    { name: 'Korallenkrone', unlock: () => !!GK.fleet && GK.fleet.setsComplete('reef'), hint: 'Alle Schätze vom Korallenriff (⚓ Abenteuer)' },
  ];

  const EYES = [
    { name: 'Punkte' },
    { name: 'Augenklappe' },
    { name: 'Sonnenbrille' },
    { name: 'Monokel' },
    { name: 'Herzaugen' },
    { name: 'Sternaugen', unlock: s => s.achievements.includes('daily7'), hint: 'Erfolg „Eine Woche dabei“' },
    { name: 'Große Augen' },
    { name: 'Brille' },
    { name: 'Laseraugen', rank: 12 },
  ];

  const MOUTHS = [
    { name: 'Lächeln' },
    { name: 'Grinsen' },
    { name: 'Vollbart' },
    { name: 'Schnurrbart' },
    { name: 'Goldzahn' },
    { name: 'Zunge' },
    { name: 'Staunen' },
  ];

  const OUTFITS = [
    { name: 'Matrosenhemd' },
    { name: 'Anzug' },
    { name: 'Piratenmantel' },
    { name: 'Hoodie' },
    { name: 'T-Shirt' },
    { name: 'Rüstung', unlock: s => s.kraken && s.kraken.defeated >= 10, hint: '10 Kraken-Angriffe abgewehrt' },
    { name: 'Königsmantel', unlock: s => s.prestige.points >= 1000, hint: 'Ab 1.000 Schatzkarten' },
    { name: 'Kapitänsuniform', rank: 7 },
    { name: 'Drachenschuppen', unlock: () => !!GK.fleet && GK.fleet.setsComplete('dragon'), hint: 'Alle Schätze der Drachenküste (⚓ Abenteuer)' },
  ];

  const COLORS = [
    { name: 'Marine', value: '#2c3e75' }, { name: 'Rot', value: '#c0392b' }, { name: 'Grün', value: '#2e8b57' },
    { name: 'Lila', value: '#7b4fc9' }, { name: 'Schwarz', value: '#26292f' }, { name: 'Grau', value: '#6b7280' },
    { name: 'Gold', value: '#d4a017' }, { name: 'Pink', value: '#e86aa0' }, { name: 'Türkis', value: '#20a39e' },
    { name: 'Braun', value: '#7a4e2d' },
  ];

  const EXTRAS = [
    { name: 'Ohne' },
    { name: 'Papagei' },
    { name: 'Goldkette', unlock: s => s.prestige.points >= 1e6, hint: 'Ab 1 Mio. Schatzkarten' },
    { name: 'Säbel' },
    { name: 'Handy' },
    { name: 'Fernrohr' },
    { name: 'Mini-Krake', unlock: s => s.kraken && s.kraken.defeated >= 1, hint: 'Einen Kraken-Angriff abgewehrt' },
    { name: 'Rose' },
    { name: 'Steuerrad', rank: 4 },
    { name: 'Dreizack', rank: 11 },
    { name: 'Schatztruhe', unlock: () => !!GK.fleet && GK.fleet.setsComplete('smuggler'), hint: 'Alle Schätze der Schmugglerinsel (⚓ Abenteuer)' },
    { name: 'Goldener Kompass', unlock: s => !!s.fleet && s.fleet.done >= 100, hint: '100 Fahrten mit der Flotte (⚓ Abenteuer)' },
  ];

  const SLOTS = [
    { id: 'head', name: 'Kopf', parts: HEADS },
    { id: 'hat', name: 'Hut & Haare', parts: HATS },
    { id: 'eyes', name: 'Augen', parts: EYES },
    { id: 'mouth', name: 'Mund', parts: MOUTHS },
    { id: 'outfit', name: 'Kleidung', parts: OUTFITS },
    { id: 'color', name: 'Farbe', parts: COLORS },
    { id: 'extra', name: 'Extra', parts: EXTRAS },
  ];

  const PRESETS = [
    { name: 'John Pork', code: '3.0.0.0.1.4.4' },
    { name: 'Käpt’n', code: '0.1.1.2.2.1.1' },
    { name: 'Skelett-Pirat', code: '4.2.0.1.0.0.3' },
    { name: 'Frosch-Gentleman', code: '5.5.6.0.1.2.7' },
  ];
  const DEFAULT = '0.1.0.0.0.0.0';

  // ---------- Code prüfen ----------

  function parse(code) {
    if (typeof code !== 'string' || !/^\d{1,2}(\.\d{1,2}){6}$/.test(code)) return null;
    const parts = code.split('.').map(Number);
    return parts.every((p, i) => p < SLOTS[i].parts.length) ? parts : null;
  }

  // Gültiger Code oder '' (für alles, was von anderen kommt)
  function valid(code) {
    const p = parse(code);
    return p ? p.join('.') : '';
  }

  // Neue Teile immer hinten anhängen, sonst ändern sich die Codes gespeicherter Figuren.
  // Teile mit rank: … gibt es ab diesem Rang (GK.rank, je 1.000-mal mehr insgesamt verdient).
  SLOTS.forEach(slot => slot.parts.forEach(part => {
    if (part.rank == null) return;
    part.unlock = s => GK.rank.of(s.allTimeEarned) >= part.rank;
    Object.defineProperty(part, 'hint', { get: () => `Ab Rang ${GK.rank.name(part.rank)}` });
  }));

  function unlocked(slot, part, s = GK.state) {
    const def = SLOTS[slot].parts[part];
    return !def.unlock || !!def.unlock(s);
  }

  // Belohnungen der Ränge (für die Anzeige im Fortschritt-Tab), nach Rang sortiert
  function rankParts() {
    const out = [];
    SLOTS.forEach(slot => slot.parts.forEach(part => {
      if (part.rank != null) out.push({ rank: part.rank, name: part.name, slot: slot.name });
    }));
    return out.sort((a, b) => a.rank - b.rank);
  }

  // ---------- Zeichnen (SVG 64 × 64, ohne IDs – darf beliebig oft auf einer Seite stehen) ----------

  const el = (tag, attrs) => `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ')}/>`;
  const circle = (cx, cy, r, fill, extra = {}) => el('circle', Object.assign({ cx, cy, r, fill }, extra));
  const ellipse = (cx, cy, rx, ry, fill, extra = {}) => el('ellipse', Object.assign({ cx, cy, rx, ry, fill }, extra));
  const path = (d, fill, extra = {}) => el('path', Object.assign({ d, fill }, extra));
  const rect = (x, y, width, height, fill, extra = {}) => el('rect', Object.assign({ x, y, width, height, fill }, extra));
  const stroke = (w = 1.2, color = LINE) => ({ stroke: color, 'stroke-width': w, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' });

  // Wo Augen und Mund je nach Kopf sitzen
  function faceOf(kind) {
    if (kind === 'pig') return { ey: 24, my: 39 };
    if (kind === 'frog') return { ey: 19, my: 34, ex: 8 };
    if (kind === 'alien') return { ey: 25, my: 35 };
    return { ey: 26, my: 35 };
  }

  function drawHead(h) {
    const s = h.skin;
    const line = stroke();
    switch (h.kind) {
      case 'pig':
        return path('M18 20 L20 8 L28 15 Z', s, line) + path('M46 20 L44 8 L36 15 Z', s, line) +
          circle(32, 27, 14, s, line) + ellipse(32, 31, 6.5, 4.5, '#ec8aa3', line) +
          ellipse(29.8, 31, 1.1, 1.7, '#a84d66') + ellipse(34.2, 31, 1.1, 1.7, '#a84d66');
      case 'skull':
        return circle(32, 26, 14, s, line) + rect(25, 32, 14, 9, s, Object.assign({ rx: 3 }, line)) +
          path('M30.5 30 L33.5 30 L32 32.5 Z', '#3b3b3b') + path('M28 38 L28 41 M32 38 L32 41 M36 38 L36 41', 'none', stroke(0.9));
      case 'frog':
        return circle(24, 19, 5.5, s, line) + circle(40, 19, 5.5, s, line) + ellipse(32, 29, 16, 12, s, line) +
          circle(24, 19, 4.6, s) + circle(40, 19, 4.6, s);
      case 'cat':
        return path('M19 20 L20 8 L29 15 Z', s, line) + path('M45 20 L44 8 L35 15 Z', s, line) +
          path('M21 17 L21.5 11 L26 15 Z', '#f7c9a8') + path('M43 17 L42.5 11 L38 15 Z', '#f7c9a8') +
          circle(32, 27, 14, s, line) + path('M30.8 30.5 L33.2 30.5 L32 32 Z', '#e86a8a') +
          path('M20 31 L27 32 M20 34 L27 33 M44 31 L37 32 M44 34 L37 33', 'none', stroke(0.7));
      case 'monkey':
        return circle(17, 27, 5, s, line) + circle(47, 27, 5, s, line) + circle(17, 27, 2.6, '#e3b48a') + circle(47, 27, 2.6, '#e3b48a') +
          circle(32, 27, 14, s, line) + ellipse(32, 30, 10, 9, '#e3b48a');
      case 'robot':
        return path('M32 13 L32 7', 'none', stroke(1.6, '#555')) + circle(32, 6, 2.2, '#e53b2c', line) +
          rect(18, 13, 28, 27, s, Object.assign({ rx: 5 }, line)) + circle(20.5, 16, 0.9, '#5b6675') + circle(43.5, 16, 0.9, '#5b6675') +
          circle(20.5, 37, 0.9, '#5b6675') + circle(43.5, 37, 0.9, '#5b6675');
      case 'alien':
        return ellipse(32, 26, 13, 16, s, line);
      case 'zombie':
        return circle(32, 27, 14, s, line) + path('M22 18 L28 16 M23 16 L23.6 19.5 M25.5 15.4 L26 19 M40 33 L44 30', 'none', stroke(0.9, '#4b5d45'));
      case 'ghost':
        return path('M17 43 L17 27 C17 9 47 9 47 27 L47 43 L42 39.5 L37 43 L32 39.5 L27 43 L22 39.5 Z', s, line) +
          ellipse(23.5, 32, 2.6, 1.4, 'rgba(120,150,220,.35)') + ellipse(40.5, 32, 2.6, 1.4, 'rgba(120,150,220,.35)');
      default:
        return circle(17.5, 28, 3, s, line) + circle(46.5, 28, 3, s, line) + circle(32, 27, 14, s, line);
    }
  }

  function drawEyes(i, kind) {
    const f = faceOf(kind);
    const y = f.ey;
    const dx = f.ex || 6;
    const L = 32 - dx;
    const R = 32 + dx;
    const dot = x => circle(x, y, 2, '#1d1d1d') + circle(x + 0.7, y - 0.7, 0.6, '#fff');
    const heart = x => path(`M${x} ${y + 2.5} C${x - 5} ${y - 1} ${x - 2} ${y - 4.5} ${x} ${y - 1.5} C${x + 2} ${y - 4.5} ${x + 5} ${y - 1} ${x} ${y + 2.5} Z`, '#e5304a');
    const star = x => path(`M${x} ${y - 3.4} L${x + 1} ${y - 1} L${x + 3.4} ${y - 1} L${x + 1.5} ${y + 0.6} L${x + 2.2} ${y + 3} L${x} ${y + 1.6} L${x - 2.2} ${y + 3} L${x - 1.5} ${y + 0.6} L${x - 3.4} ${y - 1} L${x - 1} ${y - 1} Z`, '#ffd23f', stroke(0.6, '#9a6b00'));
    switch (i) {
      case 1: return dot(L) + path(`M17 ${y - 8} L47 ${y + 4}`, 'none', stroke(1.2, '#111')) + ellipse(R, y, 4.2, 3.6, '#111');
      case 2: return rect(L - 4.8, y - 3, 9.6, 6, '#15171c', { rx: 2 }) + rect(R - 4.8, y - 3, 9.6, 6, '#15171c', { rx: 2 }) +
        path(`M${L + 4.8} ${y - 1.5} L${R - 4.8} ${y - 1.5}`, 'none', stroke(1.2, '#15171c')) + path(`M${L - 3} ${y - 1.5} L${L - 1} ${y - 1.5}`, 'none', stroke(0.8, 'rgba(255,255,255,.5)'));
      case 3: return dot(L) + dot(R) + circle(R, y, 4.3, 'none', stroke(1, '#d4a017')) + path(`M${R + 3} ${y + 3.2} C${R + 4} ${y + 8} ${R + 2} ${y + 12} ${R + 4} ${y + 16}`, 'none', stroke(0.7, '#d4a017'));
      case 4: return heart(L) + heart(R);
      case 5: return star(L) + star(R);
      case 6: return circle(L, y, 4, '#fff', stroke(0.8)) + circle(R, y, 4, '#fff', stroke(0.8)) + circle(L + 0.6, y + 0.6, 2.1, '#1d1d1d') + circle(R + 0.6, y + 0.6, 2.1, '#1d1d1d');
      case 7: return dot(L) + dot(R) + circle(L, y, 4.3, 'rgba(255,255,255,.15)', stroke(1.1, '#2b2b2b')) + circle(R, y, 4.3, 'rgba(255,255,255,.15)', stroke(1.1, '#2b2b2b')) +
        path(`M${L + 4.3} ${y} L${R - 4.3} ${y}`, 'none', stroke(1.1, '#2b2b2b'));
      case 8: return path(`M${L} ${y} L${L - 13} ${y + 34} M${R} ${y} L${R + 13} ${y + 34}`, 'none', stroke(2.2, 'rgba(255,40,40,.55)')) +
        circle(L, y, 2.6, '#ff2b2b') + circle(R, y, 2.6, '#ff2b2b') + circle(L, y, 1.1, '#fff') + circle(R, y, 1.1, '#fff');
      default: return dot(L) + dot(R);
    }
  }

  function drawMouth(i, kind) {
    const y = faceOf(kind).my;
    const smile = path(`M27.5 ${y} C29.5 ${y + 3} 34.5 ${y + 3} 36.5 ${y}`, 'none', stroke(1.6, '#3a1f1f'));
    switch (i) {
      case 1: return path(`M26.5 ${y - 1} L37.5 ${y - 1} C36.5 ${y + 4.5} 27.5 ${y + 4.5} 26.5 ${y - 1} Z`, '#fff', stroke(1.1, '#3a1f1f'));
      case 2: return path(`M18.5 ${y - 6} C19 ${y + 9} 45 ${y + 9} 45.5 ${y - 6} C42 ${y + 1} 37 ${y} 32 ${y} C27 ${y} 22 ${y + 1} 18.5 ${y - 6} Z`, '#6b4226', stroke(0.8)) +
        path(`M29 ${y + 0.5} C31 ${y + 2} 33 ${y + 2} 35 ${y + 0.5}`, 'none', stroke(1.2, '#2a1508'));
      case 3: return smile + path(`M24 ${y - 1.5} C28 ${y - 5} 31 ${y - 3} 32 ${y - 2} C33 ${y - 3} 36 ${y - 5} 40 ${y - 1.5} C36 ${y} 33 ${y - 0.5} 32 ${y - 1} C31 ${y - 0.5} 28 ${y} 24 ${y - 1.5} Z`, '#5a3a1e');
      case 4: return path(`M26.5 ${y - 1} L37.5 ${y - 1} C36.5 ${y + 4.5} 27.5 ${y + 4.5} 26.5 ${y - 1} Z`, '#fff', stroke(1.1, '#3a1f1f')) + rect(33, y - 1, 2.6, 2.8, '#f5c542', stroke(0.4, '#9a6b00'));
      case 5: return smile + path(`M30.5 ${y + 1.6} C30.5 ${y + 5.5} 33.5 ${y + 5.5} 33.5 ${y + 1.6} Z`, '#ff7d97', stroke(0.7, '#a33'));
      case 6: return ellipse(32, y + 0.5, 2.4, 3, '#3a1f1f');
      default: return smile;
    }
  }

  // Hüte: back = hinter dem Kopf, front = darüber
  function drawHat(i) {
    const line = stroke();
    switch (i) {
      case 1: return { front: path('M11 18 C18 10 46 10 53 18 C47 15 41 4 32 4 C23 4 17 15 11 18 Z', '#1f1f24', line) + circle(32, 10.5, 2.4, '#f2f2f2') + circle(31.1, 10.2, 0.5, '#111') + circle(32.9, 10.2, 0.5, '#111') };
      case 2: return { front: path('M17.5 23 C17 9 47 9 46.5 23 C40 18 24 18 17.5 23 Z', '#d33a2c', line) + path('M45 19 L51 15 L50 22 Z', '#d33a2c', line) +
        circle(26, 15, 1, '#fff') + circle(32, 13, 1, '#fff') + circle(38, 15, 1, '#fff') };
      case 3: return { front: path('M19 16 C19 8 45 8 45 16 L45 18 L19 18 Z', '#f4f4f4', line) + path('M17.5 18 L46.5 18 L44.5 21.5 L19.5 21.5 Z', '#1d1f26', line) + circle(32, 12.5, 2.2, '#f5c542', stroke(0.6, '#9a6b00')) };
      case 4: return { front: path('M19.5 17 L21.5 5 L27 11.5 L32 3 L37 11.5 L42.5 5 L44.5 17 Z', '#f5c542', stroke(1, '#9a6b00')) + circle(32, 12.5, 1.6, '#e5304a') + circle(25, 14, 1.2, '#2e8bff') + circle(39, 14, 1.2, '#2e8bff') };
      case 5: return { front: rect(22, 0.5, 20, 14, '#1b1b20', line) + rect(22, 10, 20, 2.6, '#c0392b') + rect(15.5, 13.5, 33, 3.4, '#1b1b20', Object.assign({ rx: 1.5 }, line)) };
      case 6: return { front: path('M19 18 C19 7 45 7 45 18 Z', '#d33a2c', line) + path('M32 16.5 L53 16.5 C53 20 45 20.5 32 19 Z', '#a8261b', line) + circle(32, 8, 1.4, '#a8261b') };
      case 7: return { front: path('M17.5 19 C17.5 6 46.5 6 46.5 19 Z', '#9aa3ad', line) + rect(17, 17, 30, 3.4, '#6d747c', line) +
        path('M18 13 C12 12 9 6 11 1 C13 6 16 8 20 9 Z', '#f3ead2', line) + path('M46 13 C52 12 55 6 53 1 C51 6 48 8 44 9 Z', '#f3ead2', line) };
      case 8: return { front: path('M24 16 L32 -1 L40 16 Z', '#7b4fc9', line) + path('M26.5 10.5 L37.5 10.5 M29 5 L35 5', 'none', stroke(1.8, '#ffd23f')) + circle(32, -0.5, 2.6, '#ff6b9a') };
      case 9: return { front: path('M17.5 24 C15 13 21 8 26 10 C27 5 34 5 35.5 9 C39 5.5 46 9 45 14 C48 16 48 21 46.5 24 C42 17 23 16 17.5 24 Z', '#5a3a1e', line) };
      case 10: return {
        back: path('M16 26 C14 10 50 10 48 26 L50 46 C44 47 42 40 42 34 L22 34 C22 40 20 47 14 46 Z', '#e8c35a', line),
        front: path('M18 22 C19 11 45 11 46 22 C40 15 30 14 25 20 C23 17 20 19 18 22 Z', '#e8c35a', line),
      };
      case 11: return { front: path('M7 19 C11 11 20 3 32 3 C44 3 53 11 57 19 C48 16 40 15 32 15 C24 15 16 16 7 19 Z', '#1d2747', line) +
        path('M9.5 17.6 C19 14.6 45 14.6 54.5 17.6', 'none', stroke(1.3, '#f5c542')) + path('M32 3 C29 -1 34 -3 38 -1 C35.5 0 34 1.2 32 3 Z', '#f4f4f4', stroke(0.6)) +
        circle(32, 10, 2.4, '#f5c542', stroke(0.6, '#9a6b00')) };
      case 12: return { front: ellipse(32, 5, 11.5, 3.2, 'none', stroke(2.4, '#ffd23f')) + ellipse(32, 5, 11.5, 3.2, 'none', stroke(0.8, '#fff6c2')) };
      case 13: return { front: path('M21 16 L19 6 M19.6 9.5 L16 6.5 M26 15 L26.5 3.5 M26.3 8 L29.5 4.5 M32 14.5 L32 1 M32 6 L35.5 3 M38 15 L37.5 3.5 M37.7 8 L34.5 4.5 M43 16 L45 6 M44.4 9.5 L48 6.5', 'none', stroke(2.4, '#ff6f61')) +
        rect(19, 14.5, 26, 4.5, '#e8576b', Object.assign({ rx: 2 }, stroke(1, '#8f2235'))) + circle(32, 16.7, 1.4, '#fff3f3') + circle(25.5, 16.7, 1, '#fff3f3') + circle(38.5, 16.7, 1, '#fff3f3') };
      default: return {};
    }
  }

  function drawOutfit(i, color) {
    const line = stroke();
    const torso = (fill) => path('M8 64 C8 51 19 46 32 46 C45 46 56 51 56 64 Z', fill, line);
    switch (i) {
      case 1: return torso(color) + path('M27 46 L32 58 L37 46 Z', '#f4f4f4', stroke(0.8)) +
        path('M31 49 L33 49 L34.2 57 L32 60.5 L29.8 57 Z', '#c0392b', stroke(0.6)) + path('M26 46 L30 56 M38 46 L34 56', 'none', stroke(0.9));
      case 2: return torso(color) + path('M28 46 L32 64 L36 46 Z', '#f4f4f4', stroke(0.8)) +
        circle(25.5, 54, 1.3, '#f5c542') + circle(25.5, 59, 1.3, '#f5c542') + circle(38.5, 54, 1.3, '#f5c542') + circle(38.5, 59, 1.3, '#f5c542') +
        path('M10 60 L54 60', 'none', stroke(2.2, '#3b2412'));
      case 3: return torso(color) + path('M20 49 C22 42 42 42 44 49', 'none', stroke(2.4, 'rgba(0,0,0,.25)')) +
        path('M29 49 L29 56 M35 49 L35 56', 'none', stroke(1, '#f4f4f4')) + rect(24, 57, 16, 6, 'rgba(0,0,0,.18)', { rx: 2 });
      case 4: return torso(color) + path('M26 46 C28 50.5 36 50.5 38 46', 'none', stroke(1.4, 'rgba(255,255,255,.55)'));
      case 5: return torso('#b8c0cc') + path('M14 56 L50 56 M12 60.5 L52 60.5 M32 47 L32 64', 'none', stroke(1, '#7d8794')) +
        circle(20, 52, 1, '#7d8794') + circle(44, 52, 1, '#7d8794');
      case 6: return torso(color) + path('M14 51 C20 46 44 46 50 51 L48 55 C42 51 22 51 16 55 Z', '#f6f2e8', stroke(0.8)) +
        circle(22, 51.5, 0.8, '#111') + circle(32, 49.5, 0.8, '#111') + circle(42, 51.5, 0.8, '#111') + circle(32, 58, 1.4, '#f5c542');
      case 8: return torso(color) + [51, 56, 61].map((y, row) => [14, 20, 26, 32, 38, 44, 50].map(x => path(`M${x - 3 + (row % 2) * 3} ${y} Q${x + (row % 2) * 3} ${y + 3.4} ${x + 3 + (row % 2) * 3} ${y}`, 'none', stroke(1, 'rgba(0,0,0,.35)'))).join('')).join('') +
        path('M24 46.5 C28 50 36 50 40 46.5', 'none', stroke(2, '#f5c542'));
      case 7: return torso(color) + path('M27.5 46 L32 55 L36.5 46 Z', '#f4f4f4', stroke(0.8)) +
        ellipse(15.5, 51.5, 6, 2.6, '#f5c542', stroke(0.7, '#9a6b00')) + ellipse(48.5, 51.5, 6, 2.6, '#f5c542', stroke(0.7, '#9a6b00')) +
        path('M11 53.5 L10 57 M14 54 L13.5 57.5 M17.5 54 L17.5 57.5 M53 53.5 L54 57 M50 54 L50.5 57.5 M46.5 54 L46.5 57.5', 'none', stroke(0.9, '#d4a017')) +
        circle(28, 58, 1.2, '#f5c542') + circle(28, 62, 1.2, '#f5c542') + circle(36, 58, 1.2, '#f5c542') + circle(36, 62, 1.2, '#f5c542');
      default: return torso('#f4f4f4') + path('M11 53 L53 53 M9.5 58.5 L54.5 58.5', 'none', stroke(2.6, color)) +
        path('M25 46 L32 54 L39 46', color, stroke(0.8));
    }
  }

  function drawExtra(i) {
    const line = stroke(1);
    switch (i) {
      case 1: return path('M8 54 L5 61 L10 57 Z', '#2b6fd6', line) + ellipse(12, 47, 4.2, 6, '#2eaa4a', line) + circle(12, 40, 3.6, '#e53b2c', line) +
        path('M8.6 40 L5.5 41.5 L8.6 42.4 Z', '#ffd23f', stroke(0.5)) + circle(12.6, 39.3, 0.8, '#111');
      case 2: return path('M23 47 C25 57 39 57 41 47', 'none', stroke(1.8, '#f5c542')) + circle(32, 55.5, 2.8, '#f5c542', stroke(0.6, '#9a6b00'));
      case 3: return path('M47 62 C53 54 57 47 58 40 C56 46 52 52 45 59 Z', '#dfe4ea', line) + rect(43, 58, 6, 2.4, '#d4a017', Object.assign({ rx: 1, transform: 'rotate(-40 46 59)' }, stroke(0.6)));
      case 4: return rect(44, 47, 9, 15, '#1e1e22', Object.assign({ rx: 2 }, line)) + rect(45.3, 49, 6.4, 10.5, '#6fd3ff', { rx: 1 }) +
        path('M46.5 52 L50.5 52 M46.5 54.5 L49.5 54.5', 'none', stroke(0.8, '#fff'));
      case 5: return path('M42 62 L58 44', 'none', stroke(4.2, '#7a4e2d')) + path('M53.5 49 L58 44', 'none', stroke(4.6, '#d4a017'));
      case 6: return path('M44 52 C43 47 52 44 55 49 C57 53 55 56 50 56 C47 56 45 55 44 52 Z', '#9b59d0', line) +
        path('M45 55 C44 59 46 60 45 62 M49 56 C49 60 51 61 50 63 M53 55 C54 59 56 59 57 61', 'none', stroke(1.4, '#9b59d0')) +
        circle(48, 50.5, 1, '#fff') + circle(52, 50.5, 1, '#fff') + circle(48, 50.8, 0.5, '#111') + circle(52, 50.8, 0.5, '#111');
      case 7: return path('M46 63 L46 51', 'none', stroke(1.6, '#2e8b57')) + path('M46 57 C48 55 50 56 50 58 C48 58 47 58 46 57 Z', '#2e8b57') +
        circle(46, 49.5, 3.4, '#d6183a', line) + path('M44.5 49 C45.5 47.5 47 48 47 49.5', 'none', stroke(0.7, '#8a0f24'));
      case 8: return path('M50 44.5 L50 63.5 M40.5 54 L59.5 54 M43.3 47.3 L56.7 60.7 M56.7 47.3 L43.3 60.7', 'none', stroke(1.6, '#7a4e2d')) +
        circle(50, 54, 6.6, 'none', stroke(2.2, '#7a4e2d')) + circle(50, 54, 2, '#d4a017', stroke(0.6, '#9a6b00'));
      case 10: return rect(42, 53, 19, 10, '#8a5a2b', Object.assign({ rx: 1.5 }, stroke(1))) + path('M42 53 C42 46 61 46 61 53 Z', '#9c6a35', stroke(1)) +
        path('M42 53 L61 53 M51.5 47.5 L51.5 63', 'none', stroke(1.4, '#d4a017')) + rect(49.8, 52, 3.4, 3.4, '#f5c542', stroke(0.5, '#9a6b00')) +
        circle(46, 48.8, 1.6, '#f5c542', stroke(0.4, '#9a6b00')) + circle(57, 48.4, 1.6, '#f5c542', stroke(0.4, '#9a6b00'));
      case 11: return circle(50, 54, 7.4, '#f5c542', stroke(1, '#9a6b00')) + circle(50, 54, 5.4, '#fdf6e3', stroke(0.6, '#9a6b00')) +
        path('M50 49.2 L51.6 54 L48.4 54 Z', '#d6183a') + path('M50 58.8 L51.6 54 L48.4 54 Z', '#2c3e75') + circle(50, 54, 0.9, '#9a6b00') + circle(50, 45.8, 1.4, 'none', stroke(0.9, '#9a6b00'));
      case 9: return path('M50 64 L50 41', 'none', stroke(1.9, '#d4a017')) + path('M44 45.5 C44 49 56 49 56 45.5', 'none', stroke(1.6, '#d4a017')) +
        path('M44 46 L44 40 M56 46 L56 40', 'none', stroke(1.6, '#d4a017')) +
        path('M42.5 40.5 L44 35.5 L45.5 40.5 Z M48.5 41.5 L50 35 L51.5 41.5 Z M54.5 40.5 L56 35.5 L57.5 40.5 Z', '#f5c542', stroke(0.5, '#9a6b00'));
      default: return '';
    }
  }

  const cache = new Map();

  // SVG einer Figur (Code muss gültig sein)
  function svg(code) {
    if (cache.has(code)) return cache.get(code);
    const p = parse(code) || parse(DEFAULT);
    const head = HEADS[p[0]];
    const hat = drawHat(p[1]);
    const color = COLORS[p[5]].value;
    const out = `<svg class="fig-svg" viewBox="-2 -2 68 68" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">` +
      (hat.back || '') +
      rect(28, 38, 8, 10, head.skin, stroke()) +
      drawOutfit(p[4], color) +
      drawHead(head) + drawEyes(p[2], head.kind) + drawMouth(p[3], head.kind) +
      (hat.front || '') + drawExtra(p[6]) +
      '</svg>';
    cache.set(code, out);
    return out;
  }

  // ---------- Eigene Figur ----------

  const me = () => GK.state.player;

  // Code, mit dem man zu sehen ist ('' = Emoji-Bild)
  function mine() {
    const p = me();
    return p.figOn ? valid(p.fig) : '';
  }

  // Code im Baukasten (auch wenn gerade das Emoji gezeigt wird)
  function current() {
    return valid(me().fig) || DEFAULT;
  }

  // Gesperrte Teile werden durch das erste Teil des Platzes ersetzt
  function allowed(code) {
    const p = parse(code) || parse(DEFAULT);
    return p.map((part, slot) => (unlocked(slot, part) ? part : 0)).join('.');
  }

  function set(code) {
    me().fig = allowed(code);
    me().figOn = true;
    GK.save();
  }

  function randomCode() {
    return SLOTS.map((slot, i) => {
      const free = slot.parts.map((_, j) => j).filter(j => unlocked(i, j));
      return free[GK.rng.int(free.length)];
    }).join('.');
  }

  // Bild für Knöpfe und Vorschau: Figur oder Emoji
  function avatarHTML() {
    const code = mine();
    return code ? `<span class="fig-mini">${svg(code)}</span>` : GK.player.avatar();
  }

  // ---------- Baukasten (Statistik-Tab) ----------

  let lastSig = '';

  function render(force) {
    const box = document.getElementById('figure-editor');
    if (!box) return;
    const code = current();
    const unlocks = SLOTS.map((slot, i) => slot.parts.map((_, j) => (unlocked(i, j) ? 1 : 0)).join('')).join('|');
    const sig = `${code}|${me().figOn}|${unlocks}|${GK.player.name()}|${GK.rank.mine()}`;
    if (!force && sig === lastSig) return;
    lastSig = sig;
    const parts = parse(code);
    const options = (slot, i) => slot.parts.map((part, j) => {
      const locked = !unlocked(i, j);
      const active = parts[i] === j;
      const title = locked ? `${part.name} – 🔒 ${part.hint}` : part.name;
      if (slot.id === 'color') {
        return `<button type="button" class="fig-color ${active ? 'active' : ''}" data-slot="${i}" data-part="${j}" title="${title}" aria-label="${title}" style="background:${part.value}"></button>`;
      }
      const preview = parts.slice();
      preview[i] = j;
      return `<button type="button" class="fig-opt ${active ? 'active' : ''} ${locked ? 'locked' : ''}" data-slot="${i}" data-part="${j}" title="${title}" aria-label="${title}">
        ${svg(preview.join('.'))}${locked ? '<span class="fig-lock">🔒</span>' : ''}<span class="fig-opt-name">${part.name}</span></button>`;
    }).join('');
    box.innerHTML = `
      <div class="fig-top">
        <div class="fig-big">${svg(code)}</div>
        <div class="fig-side">
          <div class="fig-tag">${GK.cosmetics.nameTag({ name: GK.player.name(), avatar: GK.player.avatar(), fig: code, rank: GK.rank.mine(), badge: GK.cosmetics.myBadge() })}</div>
          <label class="fig-on"><input type="checkbox" class="switch fig-toggle" ${me().figOn ? 'checked' : ''}> Figur statt Emoji zeigen</label>
          <div class="fig-presets">
            ${PRESETS.map((p, k) => `<button type="button" class="btn btn-small fig-preset" data-preset="${k}">${p.name}</button>`).join('')}
            <button type="button" class="btn btn-small fig-random">🎲 Zufall</button>
          </div>
          <p class="muted small">Deine Figur sehen die anderen bei Spielen mit Freunden, beim Poker und in der Rangliste.
            Teile mit 🔒 schaltest du im Spiel frei.</p>
        </div>
      </div>
      ${SLOTS.map((slot, i) => `<div class="fig-slot"><div class="fig-slot-name">${slot.name}</div><div class="fig-options">${options(slot, i)}</div></div>`).join('')}`;
    if (!box._bound) {
      box._bound = true;
      box.addEventListener('click', e => {
        const opt = e.target.closest('[data-slot]');
        const preset = e.target.closest('.fig-preset');
        if (opt) {
          const slot = Number(opt.dataset.slot);
          const part = Number(opt.dataset.part);
          if (!unlocked(slot, part)) {
            GK.sound.play('denied');
            GK.toast(`🔒 ${SLOTS[slot].parts[part].name}: ${SLOTS[slot].parts[part].hint}`);
            return;
          }
          const p = parse(current());
          p[slot] = part;
          set(p.join('.'));
        } else if (preset) {
          set(PRESETS[Number(preset.dataset.preset)].code);
        } else if (e.target.closest('.fig-random')) {
          set(randomCode());
        } else {
          return;
        }
        GK.sound.play('chip');
        render(true);
      });
      box.addEventListener('change', e => {
        if (!e.target.classList.contains('fig-toggle')) return;
        me().fig = current();
        me().figOn = e.target.checked;
        GK.save();
        GK.sound.play('chip');
        render(true);
      });
    }
  }

  GK.figure = { SLOTS, PRESETS, DEFAULT, parse, valid, svg, mine, current, set, unlocked, allowed, randomCode, avatarHTML, render, rankParts };
})();
