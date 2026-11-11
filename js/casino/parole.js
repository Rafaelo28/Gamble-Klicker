// Geheime Parole: Der Kapitän hat ein Wort mit fünf Buchstaben als Parole ausgegeben. Sechs Versuche gibt es,
// sie zu erraten. Nach jedem Versuch zeigen die Münzen, was stimmt: Gold = Buchstabe sitzt richtig,
// Blau = Buchstabe kommt vor, aber an anderer Stelle, dunkel = kommt nicht vor. Je früher die Parole fällt,
// desto höher der Gewinn. Die Parole wird beim Start ausgelost und mit der Runde sofort gespeichert.
window.GK = window.GK || {};

// Sprache: Ersatz, falls js/i18n.js (noch) nicht geladen ist – gibt den deutschen Text zurück.
GK.t = GK.t || function (s, v) { s = String(s); return v ? s.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m)) : s; };
GK.i18n = GK.i18n || { add() {}, addHtml() {}, apply() {}, set() {}, lang: 'de' };

GK.i18n.add({
  'Geheime Parole': 'Secret Password',
  'Errate die Parole des Kapitäns – je früher, desto mehr Gold.': 'Guess the captain’s password – the sooner, the more gold.',
  'Nicht genug Dublonen für diesen Einsatz.': 'Not enough Doubloons for this bet.',
  'Die Parole hat fünf Buchstaben. Tippe dein erstes Wort.': 'The password has five letters. Type your first word.',
  'Noch {n} Buchstaben fehlen.': '{n} more letters needed.',
  'Noch ein Buchstabe fehlt.': 'One more letter needed.',
  'Dieses Wort hast du schon versucht.': 'You already tried that word.',
  'Noch nicht – {n} Versuche übrig.': 'Not yet – {n} tries left.',
  'Noch nicht – letzter Versuch!': 'Not yet – last try!',
  '🗝️ Geknackt im {n}. Versuch': '🗝️ Cracked on try {n}',
  '🔒 Nicht geknackt ({word})': '🔒 Not cracked ({word})',
  '{result} · ×{mult}': '{result} · ×{mult}',
  '🗝️ Parole geknackt! {money} (×{mult})': '🗝️ Password cracked! {money} (×{mult})',
  '🔒 Nicht geknackt – die Parole war „{word}“.': '🔒 Not cracked – the password was “{word}”.',
  'Im {n}. Versuch': 'On try {n}',
  'Parole raten': 'Guess the password',
  'Prüfen': 'Check',
  'Löschen': 'Delete',
  '{n}. Versuch': 'Try {n}',
  'Versuch {row}, Buchstabe {col}': 'Try {row}, letter {col}',
  'richtige Stelle': 'right spot',
  'andere Stelle': 'other spot',
  'kommt nicht vor': 'not in the word',
  'Gold: richtige Stelle': 'Gold: right spot',
  'Blau: andere Stelle': 'Blue: other spot',
  'Dunkel: kommt nicht vor': 'Dark: not in the word',
  'Der Kapitän hat eine Parole mit fünf Buchstaben ausgegeben. Du hast sechs Versuche. Nach jedem Versuch zeigen die Münzen, was stimmt: Gold sitzt richtig, Blau kommt vor, steht aber woanders, dunkel kommt nicht vor. Je früher du die Parole knackst, desto mehr bekommst du. Umlaute gibt es nicht.':
    'The captain has set a five-letter password. You get six tries. After each try the coins show what is right: gold is in the right spot, blue is in the word but somewhere else, dark is not in the word. The sooner you crack the password, the more you get.',
  'Deine Parole wartet noch – weiter raten!': 'Your password is still waiting – keep guessing!',
  'Wähle deinen Einsatz – dann rate die Parole!': 'Choose your bet – then guess the password!',
});

(function () {
  // Eigenes Symbol (in Node-Tests ohne icons.js bleibt es leer)
  const ic = (name, cls) => (GK.icon ? GK.icon(name, cls) : '');
  const MIN_BET = 10;
  const LENGTH = 5;
  const TRIES = 6;
  // Multiplikator, wenn die Parole im 1., 2., … 6. Versuch fällt
  const MULTS = [12, 3, 1.5, 1, 0.5, 0.2];

  // Mögliche Parolen je Sprache: bekannte Wörter mit genau fünf Buchstaben, nur A–Z (keine Umlaute, kein ß)
  const WORDS = {
    de: ('ANKER INSEL SEGEL PIRAT KARTE KISTE HAFEN WELLE STURM DOLCH KETTE KRONE PERLE KAJAK RUDER STEIN SONNE STERN ' +
      'NACHT WOLKE REGEN BLITZ FEUER RAUCH ASCHE BRETT NAGEL HAKEN LEINE FISCH KRAKE PALME KOKOS TIGER ZEBRA ADLER ' +
      'GEIER PFERD KATZE VOGEL BIENE WESPE FUCHS DACHS ZIEGE SCHAF KAMEL PANDA KOALA OTTER BIBER ROBBE APFEL BIRNE ' +
      'MANGO BEERE NUDEL SUPPE SALAT PIZZA TORTE HONIG MILCH SAHNE KAKAO WURST OLIVE GURKE LAUCH KRAUT TASSE GABEL ' +
      'KANNE EIMER BESEN LAMPE KERZE TISCH STUHL REGAL DECKE BODEN WIESE BLUME BLATT TULPE BUSCH TEICH EBENE ZUNGE ' +
      'LIPPE STIRN WANGE BRUST BAUCH FAUST FERSE LUNGE MAGEN JACKE SCHUH SOCKE SCHAL STIFT BRIEF FARBE MUSIK GEIGE ' +
      'HARFE PIANO ORGEL SPIEL PUPPE KUGEL KEGEL FAHRT REISE MOTOR GLEIS WAGEN ANGST TRAUM LIEBE DANKE BITTE HALLO ' +
      'FRAGE PAUSE KRACH KLANG SUMME MENGE PREIS BEUTE PRINZ BAUER MALER PILOT WACHE FEIND KAMPF WAFFE LUNTE MONAT ' +
      'WOCHE ABEND HEUTE IMMER JETZT KLEIN BREIT BRAUN STARK MUTIG FEIGE FRECH LEISE RUHIG STILL KRANK REICH TEUER ' +
      'SAUER ECKIG SPITZ GLATT WEICH FLINK GENAU GEHEN SEHEN SAGEN REDEN RUFEN ESSEN LESEN MALEN BAUEN GEBEN HOLEN ' +
      'LEGEN HABEN LEBEN RATEN JAGEN BADEN HEBEN AMPEL BIRKE EICHE BUCHE TANNE LINDE AHORN NELKE LILIE HAFER STROH ' +
      'ERNTE ACKER PFLUG STALL MARKT LADEN KASSE WAAGE KUNDE HOTEL EISEN STAHL BLECH DRAHT FEDER ZANGE FEILE HACKE ' +
      'HEBEL RAMPE KURVE KREIS PUNKT LINIE KANTE MITTE SEITE GRUND TIEFE WEITE TEMPO KRAFT DRUCK STROM LICHT FUNKE ' +
      'HITZE FROST HAGEL NEBEL DUNST DAMPF BRISE ORKAN DEICH BUCHT WRACK ROUTE LOTSE BANDE MEUTE HORDE TRUPP SCHAR ' +
      'ONKEL TANTE VATER JUNGE ENKEL NEFFE LEUTE GASSE PLATZ MAUER STADT VILLA ALTAR ENGEL GEIST ZWERG RIESE TROLL ' +
      'MAGIE FLUCH SEGEN RADIO HANDY KABEL TASTE VIDEO LASER KOMET VENUS JUWEL RUBIN TOPAS ACHAT KLEID STOFF WOLLE ' +
      'SEIDE LEDER FADEN NADEL KNOPF SPORT PFEIL BOGEN SPEER LANZE KOBRA VIPER ECHSE MOLCH LURCH LACHS HECHT SUPER ' +
      'PRIMA BONUS JOKER POKER WETTE NIETE UNTER NEBEN VORNE LINKS DAVOR DARUM WARUM WOHIN WOHER NICHT KEINE VIELE ' +
      'WENIG ETWAS ALLES JEDER DIESE ERSTE').split(' '),
    en: ('PEARL CROWN CHEST COAST OCEAN STORM WAVES SHORE BEACH CORAL SHARK WHALE SQUID SHELL SPADE SWORD BLADE CHAIN ' +
      'FLAME SMOKE STONE NIGHT CLOUD RAINY LIGHT EARTH WATER RIVER FIELD GRASS PLANT TREES BERRY APPLE MANGO LEMON ' +
      'GRAPE PEACH MELON BREAD TOAST PIZZA PASTA SALAD SUGAR HONEY CREAM JUICE TABLE CHAIR SHELF CLOCK PHONE RADIO ' +
      'PAPER BOOKS STORY MUSIC PIANO DRUMS FLUTE DANCE PARTY GAMES CARDS POKER JOKER BONUS PRIZE MONEY COINS HORSE ' +
      'SHEEP TIGER ZEBRA PANDA KOALA OTTER EAGLE RAVEN GOOSE MOUSE SNAKE HOUSE TOWER TRAIN TRUCK PLANE WHEEL MOTOR ' +
      'ROUTE TRAIL TRACK SPEED POWER FORCE HEART BRAIN MOUTH TOOTH THUMB ELBOW SHIRT SKIRT DRESS SHOES SCARF GLOVE ' +
      'WATCH RINGS JEWEL GLASS STEEL METAL BRICK BOARD NAILS ROPES KNOTS FLAGS SAILS CABIN PILOT GUARD THIEF GIANT ' +
      'DWARF GHOST WITCH MAGIC CURSE ANGEL DEVIL DREAM SLEEP SMILE LAUGH HAPPY ANGRY BRAVE SMART QUICK QUIET SHARP ' +
      'SWEET SALTY SPICY FRESH CLEAN DIRTY EMPTY HEAVY LARGE SMALL SHORT ROUND SOLID ROUGH YOUNG EARLY TODAY NEVER ' +
      'AFTER UNDER ABOVE BELOW RIGHT WRONG FIRST THIRD SEVEN EIGHT THREE WORLD PLACE SPACE COMET VENUS START ENTER ' +
      'LEAVE CLIMB THROW CATCH BUILD BREAK PAINT WRITE SPEAK LEARN TEACH THINK GUESS COUNT TRADE CHASE HURRY CARRY ' +
      'BRING DRINK TASTE SMELL TOUCH WHITE BLACK GREEN BROWN FRUIT ONION OLIVE BACON STEAK CANDY CHIPS FEAST LUNCH ' +
      'KNIFE SPOON PLATE STOVE GRILL ROBIN CAMEL LLAMA HIPPO MOOSE BISON TROUT STEAM FROST SUNNY WINDY MISTY STORE ' +
      'HOTEL MAYOR QUEEN NOBLE ROYAL FLEET CARGO CRATE TORCH LASER ROBOT ALIEN ORBIT PLANK MAPLE CEDAR BIRCH TULIP ' +
      'DAISY LILAC POPPY GRAIN WHEAT FLOUR YEAST SAUCE GRAVY SYRUP CIDER').split(' '),
  };

  let els = {};
  let betControl;
  let busy = false;
  let typed = ''; // angefangenes Wort der laufenden Runde (nur im Speicher)
  let timer = 0;

  function state() {
    return GK.casino.data('parole', () => ({ bet: 100, round: null, last: null }));
  }

  // ---------- Regeln (auch für Tests) ----------

  // Bewertung eines Versuchs: je Buchstabe 2 = richtige Stelle, 1 = kommt vor (andere Stelle), 0 = kommt nicht vor.
  // Doppelte Buchstaben zählen nur so oft, wie sie in der Parole stehen.
  function score(guess, word) {
    const res = new Array(LENGTH).fill(0);
    const left = {};
    for (let i = 0; i < LENGTH; i++) {
      if (guess[i] === word[i]) res[i] = 2;
      else left[word[i]] = (left[word[i]] || 0) + 1;
    }
    for (let i = 0; i < LENGTH; i++) {
      if (res[i] === 0 && left[guess[i]] > 0) {
        res[i] = 1;
        left[guess[i]]--;
      }
    }
    return res;
  }

  // Multiplikator für eine im `tries`-ten Versuch geknackte Parole (0 = nicht geknackt)
  function multiplier(tries) {
    return tries >= 1 && tries <= TRIES ? MULTS[tries - 1] : 0;
  }

  function wordList(lang) {
    return WORDS[lang] || WORDS.de;
  }

  function pickWord(lang) {
    const list = wordList(lang);
    return list[GK.rng.int(list.length)];
  }

  // Bester bekannter Stand je Buchstabe über alle Versuche (für die Tastatur)
  function letterStates(guesses, word) {
    const best = {};
    guesses.forEach(g => score(g, word).forEach((v, i) => {
      if (!(best[g[i]] >= v)) best[g[i]] = v;
    }));
    return best;
  }

  // ---------- Ablauf ----------

  function start() {
    const s = state();
    if (s.round || busy) return;
    if (!GK.casino.bet(s.bet)) {
      GK.sound.play('denied');
      showMessage(GK.t('Nicht genug Dublonen für diesen Einsatz.'), 'loss');
      return;
    }
    const lang = WORDS[GK.i18n.lang] ? GK.i18n.lang : 'de';
    s.round = { bet: s.bet, lang, word: pickWord(lang), guesses: [] };
    s.last = null;
    typed = '';
    GK.save();
    GK.sound.play('chip');
    showMessage(GK.t('Die Parole hat fünf Buchstaben. Tippe dein erstes Wort.'), '');
    render();
  }

  function type(letter) {
    if (!state().round || busy || typed.length >= LENGTH) return;
    typed += letter;
    GK.sound.play('click');
    render();
  }

  function erase() {
    if (!state().round || busy || !typed) return;
    typed = typed.slice(0, -1);
    render();
  }

  function submit() {
    const s = state();
    const r = s.round;
    if (!r || busy) return;
    if (typed.length < LENGTH) {
      const n = LENGTH - typed.length;
      GK.sound.play('denied');
      showMessage(n === 1 ? GK.t('Noch ein Buchstabe fehlt.') : GK.t('Noch {n} Buchstaben fehlen.', { n }), 'loss');
      return;
    }
    if (r.guesses.includes(typed)) {
      GK.sound.play('denied');
      showMessage(GK.t('Dieses Wort hast du schon versucht.'), 'loss');
      return;
    }
    r.guesses.push(typed);
    typed = '';
    const tries = r.guesses.length;
    const solved = r.guesses[tries - 1] === r.word;
    const over = solved || tries >= TRIES;
    let payout = 0;
    let mult = 0;
    // Abrechnung sofort (Neuladen während der Aufdeck-Animation darf nichts kosten oder schenken)
    if (over) {
      mult = solved ? multiplier(tries) : 0;
      payout = Math.floor(r.bet * mult);
      s.round = null;
      s.last = { bet: r.bet, lang: r.lang, word: r.word, guesses: r.guesses, solved, payout };
      GK.casino.payout(payout);
      GK.casino.record('parole', r.bet, payout, GK.t('{result} · ×{mult}', {
        result: solved ? GK.t('🗝️ Geknackt im {n}. Versuch', { n: tries }) : GK.t('🔒 Nicht geknackt ({word})', { word: r.word }),
        mult: fmt(mult),
      }));
    }
    GK.save();
    busy = true;
    render(tries - 1);
    GK.sound.play('dig');
    const reduced = GK.state.settings.effects === 'reduced';
    clearTimeout(timer);
    timer = setTimeout(() => {
      busy = false;
      if (solved) {
        showMessage(GK.t('🗝️ Parole geknackt! {money} (×{mult})', { money: GK.formatMoneyHTML(payout), mult: fmt(mult) }), payout >= r.bet ? 'win' : '');
        if (payout > r.bet) GK.fx.celebrate(payout, r.bet, { el: els.board, subtitle: GK.t('Im {n}. Versuch', { n: tries }) });
        else GK.sound.play('gem');
      } else if (over) {
        GK.fx.shake('small');
        GK.sound.play('lose');
        showMessage(GK.t('🔒 Nicht geknackt – die Parole war „{word}“.', { word: r.word }), 'loss');
      } else {
        const left = TRIES - tries;
        showMessage(left === 1 ? GK.t('Noch nicht – letzter Versuch!') : GK.t('Noch nicht – {n} Versuche übrig.', { n: left }), '');
      }
      render();
    }, reduced ? 150 : 750);
  }

  // Tastatur am Rechner: Buchstaben, Eingabe, Rücktaste
  function onKey(e) {
    if (!state().round || e.ctrlKey || e.metaKey || e.altKey) return;
    if (!els.board || els.board.offsetParent === null) return; // Spiel gerade nicht sichtbar
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      erase();
    } else if (/^[a-zA-Z]$/.test(e.key)) {
      type(e.key.toUpperCase());
    }
  }

  // ---------- Darstellung ----------

  function fmt(m) {
    return GK.formatDecimal(m, 0, 1);
  }

  const STATE_CLASS = ['pa-miss', 'pa-near', 'pa-hit'];
  const STATE_TEXT = ['kommt nicht vor', 'andere Stelle', 'richtige Stelle'];
  const KEY_ROWS = {
    de: ['QWERTZUIOP', 'ASDFGHJKL', 'YXCVBNM'],
    en: ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'],
  };

  // revealRow: Zeile, die gerade aufgedeckt wird (Münzen erscheinen nacheinander)
  function render(revealRow) {
    const s = state();
    const r = s.round;
    const shown = r || s.last;
    const guesses = shown ? shown.guesses : [];
    const lang = shown ? shown.lang : (WORDS[GK.i18n.lang] ? GK.i18n.lang : 'de');

    let html = '';
    for (let row = 0; row < TRIES; row++) {
      const guess = guesses[row];
      const marks = guess ? score(guess, shown.word) : null;
      const current = r && row === guesses.length;
      let cells = '';
      for (let col = 0; col < LENGTH; col++) {
        const letter = guess ? guess[col] : current ? (typed[col] || '') : '';
        let cls = 'pa-coin';
        let label = GK.t('Versuch {row}, Buchstabe {col}', { row: row + 1, col: col + 1 });
        if (marks) {
          cls += ' ' + STATE_CLASS[marks[col]];
          if (row === revealRow) cls += ' pa-reveal';
          label += `: ${letter}, ${GK.t(STATE_TEXT[marks[col]])}`;
        } else if (letter) {
          cls += ' pa-typed';
          label += `: ${letter}`;
        }
        if (current && col === typed.length) cls += ' pa-next';
        cells += `<span class="${cls}" style="--i:${col}" role="img" aria-label="${label}">${letter}</span>`;
      }
      html += `<div class="pa-row ${current ? 'current' : ''}">${cells}</div>`;
    }
    els.board.innerHTML = html;
    els.board.classList.toggle('lost', !!(shown && !r && !shown.solved));

    // Tastatur: Farben erst nach dem Aufdecken der Zeile übernehmen
    const known = shown ? letterStates(revealRow != null ? guesses.slice(0, revealRow) : guesses, shown.word) : {};
    const rows = KEY_ROWS[lang] || KEY_ROWS.de;
    const off = !r || busy;
    const key = ch => `<button type="button" class="pa-key ${known[ch] != null ? STATE_CLASS[known[ch]] : ''}" data-key="${ch}" ${off ? 'disabled' : ''}>${ch}</button>`;
    GK.setHTML(els.keys, rows.map((letters, i) => `<div class="pa-keyrow">${
      i === 2 ? `<button type="button" class="pa-key pa-wide" data-key="back" ${off ? 'disabled' : ''} aria-label="${GK.t('Löschen')}">⌫</button>` : ''}${
      letters.split('').map(key).join('')}${
      i === 2 ? `<button type="button" class="pa-key pa-wide pa-enter" data-key="enter" ${off ? 'disabled' : ''}>${GK.t('Prüfen')}</button>` : ''}</div>`).join(''));

    // Gewinnleiter: aktueller Versuch hervorgehoben
    const at = r ? guesses.length : shown && shown.solved ? guesses.length - 1 : -1;
    GK.setHTML(els.ladder, MULTS.map((m, i) =>
      `<li class="${i === at ? 'current' : ''} ${r && i < at ? 'gone' : ''}"><span>${GK.t('{n}. Versuch', { n: i + 1 })}</span><b>×${fmt(m)}</b></li>`).join(''));

    els.start.hidden = !!r;
    els.start.disabled = busy;
    betControl.setDisabled(!!r || busy);
  }

  function showMessage(html, cls) {
    if (!els.message) return;
    els.message.className = 'game-message ' + (cls || '');
    els.message.innerHTML = html;
    if (GK.iconifyLead) GK.iconifyLead(els.message); // Emoji vorn → eigenes Symbol
  }

  function init(body) {
    body.innerHTML = `
      <div class="mines-layout">
        <div class="pa-area">
          <div class="pa-board"></div>
          <div class="pa-keys"></div>
          <div class="pa-legend">
            <span><i class="pa-dot pa-hit"></i>${GK.t('Gold: richtige Stelle')}</span>
            <span><i class="pa-dot pa-near"></i>${GK.t('Blau: andere Stelle')}</span>
            <span><i class="pa-dot pa-miss"></i>${GK.t('Dunkel: kommt nicht vor')}</span>
          </div>
        </div>
        <div class="mines-controls">
          <ol class="pa-ladder"></ol>
          <div class="game-message">&nbsp;</div>
          <div class="parole-bet"></div>
          <div class="game-actions">
            <button class="btn btn-primary btn-big parole-start">${ic('key')}${GK.t('Parole raten')}</button>
          </div>
          <p class="muted small">${GK.t('Der Kapitän hat eine Parole mit fünf Buchstaben ausgegeben. Du hast sechs Versuche. Nach jedem Versuch zeigen die Münzen, was stimmt: Gold sitzt richtig, Blau kommt vor, steht aber woanders, dunkel kommt nicht vor. Je früher du die Parole knackst, desto mehr bekommst du. Umlaute gibt es nicht.')}</p>
        </div>
      </div>`;
    els = {
      board: body.querySelector('.pa-board'),
      keys: body.querySelector('.pa-keys'),
      ladder: body.querySelector('.pa-ladder'),
      message: body.querySelector('.game-message'),
      start: body.querySelector('.parole-start'),
    };
    betControl = GK.casino.createBetControl(body.querySelector('.parole-bet'), {
      min: MIN_BET,
      get: () => state().bet,
      set: v => { state().bet = v; },
    });
    els.keys.addEventListener('click', e => {
      const btn = e.target.closest('.pa-key');
      if (!btn || btn.disabled) return;
      if (btn.dataset.key === 'enter') submit();
      else if (btn.dataset.key === 'back') erase();
      else type(btn.dataset.key);
    });
    els.start.addEventListener('click', start);
    refresh();
  }

  function refresh() {
    busy = false;
    typed = '';
    clearTimeout(timer);
    showMessage(state().round ? GK.t('Deine Parole wartet noch – weiter raten!') : GK.t('Wähle deinen Einsatz – dann rate die Parole!'), '');
    render();
  }

  GK.casino.register({
    id: 'parole',
    category: 'quick',
    name: 'Geheime Parole',
    emoji: '🗝️',
    desc: 'Errate die Parole des Kapitäns – je früher, desto mehr Gold.',
    init,
    refresh,
    render: () => {
      if (!state().round) betControl.refresh();
    },
    onShow: () => document.addEventListener('keydown', onKey),
    onHide: () => document.removeEventListener('keydown', onKey),
  });

  // Für Tests
  GK.casino.paroleMath = { WORDS, LENGTH, TRIES, MULTS, score, multiplier, pickWord, letterStates };
})();
