// Ränge: Je 1.000-mal mehr insgesamt verdient, ein Rang höher – ohne Ende (nach dem „Herrscher der Meere“
// kommen „Legende I, II, III …“). Der Rang steht neben dem Namen, in der Freundes-Rangliste und schaltet
// Teile für die eigene Figur frei. Er sinkt nie, auch nicht nach einer großen Fahrt.
window.GK = window.GK || {};

(function () {
  // Eigenes Symbol (in Node-Tests ohne icons.js bleibt es leer)
  const ic = (name, cls) => (GK.icon ? GK.icon(name, cls) : '');
  const NAMED = [
    { icon: '🐀', sym: 'boot', name: 'Landratte' },
    { icon: '🧹', sym: 'mop', name: 'Schiffsjunge' },
    { icon: '⚓', sym: 'anchor', name: 'Matrose' },
    { icon: '🪢', sym: 'rope', name: 'Bootsmann' },
    { icon: '🧭', sym: 'helm', name: 'Steuermann' },
    { icon: '🗝️', sym: 'key', name: 'Quartiermeister' },
    { icon: '🎖️', sym: 'spyglass', name: 'Erster Offizier' },
    { icon: '🏴‍☠️', sym: 'hat', name: 'Kapitän' },
    { icon: '⭐', sym: 'star', name: 'Kommodore' },
    { icon: '🌟', sym: 'laurel', name: 'Admiral' },
    { icon: '💫', sym: 'stars', name: 'Großadmiral' },
    { icon: '👑', sym: 'crown', name: 'Piratenkönig' },
    { icon: '🔱', sym: 'trident', name: 'Herrscher der Meere' },
  ];
  const LEGEND = NAMED.length; // ab hier „Legende I, II, …“
  const MAX = 999;             // größter Rang, der von anderen angenommen wird

  // Ab wie viel insgesamt verdient gilt Rang r (1.000 hoch r) – über die Schreibweise „1e…“,
  // damit überall exakt dieselbe Zahl herauskommt
  const threshold = r => Number(`1e${3 * r}`);

  // Rang zu einer Summe (insgesamt verdient)
  function of(earned) {
    if (!(earned >= 1000)) return 0;
    let r = 0;
    while (r < MAX && earned >= threshold(r + 1)) r++;
    return r;
  }

  function roman(n) {
    const table = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    let out = '';
    table.forEach(([v, s]) => { while (n >= v) { out += s; n -= v; } });
    return out;
  }

  const name = r => (r < LEGEND ? NAMED[r].name : `Legende ${roman(r - LEGEND + 1)}`);
  const icon = r => (r < LEGEND ? NAMED[r].icon : '🐉');

  // Rang-Abzeichen als eigenes Symbol (js/icons.js). Die Akzentfarbe zeigt die Stufe:
  // Bronze (Rang 0–3), Silber (4–7), Gold (8–11), Meer (Herrscher der Meere), Legende (Purpur).
  const sym = r => (r < LEGEND ? NAMED[r].sym : 'dragon');
  const tier = r => (r >= LEGEND ? 5 : r >= 12 ? 4 : r >= 8 ? 3 : r >= 4 ? 2 : 1);
  function symbol(r, cls) {
    r = valid(r);
    return GK.icon ? GK.icon(sym(r), `rk rk-t${tier(r)}${cls ? ' ' + cls : ''}`) : icon(r);
  }

  // Von anderen empfangenen Rang prüfen (ganze Zahl 0 … 999, sonst 0 = nicht anzeigen)
  function valid(r) {
    return Number.isInteger(r) && r >= 0 && r <= MAX ? r : 0;
  }

  const mine = () => of(GK.state.allTimeEarned);

  // Kleines Rang-Zeichen am Namen (Landratten bekommen keins)
  function tag(r) {
    r = valid(r);
    return r >= 1 ? `<span class="rank-ico" title="${name(r)}">${symbol(r)}</span>` : '';
  }

  // Fortschritt zum nächsten Rang (0 … 1, logarithmisch – sonst stünde der Balken fast immer bei 0 %)
  function progress(earned = GK.state.allTimeEarned) {
    const r = of(earned);
    const from = threshold(r);
    const to = threshold(r + 1);
    const frac = r === 0 ? Math.max(0, earned) / to : Math.log(Math.max(earned, from) / from) / Math.log(to / from);
    return { rank: r, next: r + 1, from, to, missing: Math.max(0, to - earned) || 0, frac: Number.isFinite(frac) ? Math.min(1, Math.max(0, frac)) : 0 };
  }

  // Neuer Rang erreicht? (wird im Takt geprüft; meldet nur den höchsten)
  function check() {
    const s = GK.state;
    const r = mine();
    if (r <= (s.rankSeen || 0)) return false;
    s.rankSeen = r;
    if (GK.icon) GK.toast(`Neuer Rang: ${name(r)}!`, [sym(r), `rk rk-t${tier(r)}`]);
    else GK.toast(`${icon(r)} Neuer Rang: ${name(r)}!`);
    if (GK.sound) GK.sound.play('achievement');
    GK.save();
    return true;
  }

  // Anzeige im Fortschritt-Tab
  let lastSig = '';
  function render() {
    const box = document.getElementById('rank-panel');
    if (!box) return;
    const p = progress();
    const pct = Math.floor(p.frac * 100);
    const sig = `${p.rank}|${pct}|${GK.formatNumber(p.missing)}`;
    if (sig === lastSig) return;
    lastSig = sig;
    const rewards = GK.figure ? GK.figure.rankParts() : [];
    box.innerHTML = `
      <div class="rank-now"><span class="rank-big">${symbol(p.rank)}</span>
        <div><div class="rank-name">${name(p.rank)}</div><div class="muted small">Rang ${p.rank}</div></div></div>
      <div class="rank-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><div style="transform:scaleX(${p.frac.toFixed(3)})"></div></div>
      <p class="small">Nächster Rang: <b>${symbol(p.next)} ${name(p.next)}</b> ab ${GK.formatMoneyHTML(p.to)} insgesamt verdient
        (noch ${GK.formatMoneyHTML(p.missing)}).</p>
      <p class="muted small">Je 1.000-mal mehr insgesamt verdient, ein Rang höher – ohne Ende. Der Rang bleibt auch nach einer großen Fahrt
        und steht bei Spielen mit Freunden neben deinem Namen.</p>
      ${rewards.length ? `<div class="rank-rewards">${rewards.map(x => `<span class="rank-reward ${x.rank <= p.rank ? 'done' : ''}" title="${x.slot}">
        ${x.rank <= p.rank ? ic('check') : ic('lock')} ${x.name} <span class="muted">· ${name(x.rank)}</span></span>`).join('')}</div>` : ''}`;
  }

  GK.rank = { NAMED, LEGEND, MAX, threshold, of, name, icon, symbol, valid, mine, tag, progress, check, render };
})();
