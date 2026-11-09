// Englische Übersetzungen für die festen Texte in index.html (Kopfzeile, Tabs,
// Statistiken, Einstellungen, Fußzeile). Deutsch ist die Quelle (steht in index.html);
// hier liegt nur das Englische. Wird nach js/i18n.js geladen.
window.GK = window.GK || {};
GK.i18n = GK.i18n || { add() {}, addHtml() {} };

// Einzelne Textknoten und Attribute (Schlüssel = deutscher Text, innere Umbrüche als ein Leerzeichen)
GK.i18n.add({
  'Dublonen pro Sekunde': 'doubloons per second',
  'Passives Einkommen aus': 'Passive income off',
  'gespeichert': 'saved',
  'Klicker': 'Clicker',
  'Abenteuer': 'Adventure',
  'Fortschritt': 'Progress',
  'Statistiken': 'Statistics',
  'pro Klick': 'per click',
  'Upgrades': 'Upgrades',
  'Noch keine Upgrades verfügbar – sammle weiter!': 'No upgrades available yet – keep collecting!',
  'Gebäude': 'Buildings',
  'Passives Einkommen der Gebäude': 'Passive income from buildings',
  'Ausgeschaltet verdienen die Gebäude nichts – auch nicht, während das Spiel geschlossen ist.':
    'When off, the buildings earn nothing – not even while the game is closed.',
  'Setz deine Dublonen und knack den Jackpot!': 'Bet your doubloons and crack the jackpot!',
  'Rangliste mit Freunden': 'Leaderboard with friends',
  'Casino-Statistik': 'Casino statistics',
  'VIP-Karte': 'VIP card',
  'Letzte Runden': 'Recent rounds',
  'Bosskampf': 'Boss fight',
  'Tippe so schnell du kannst auf den Boss – jeder Tipp trifft mit deiner Klickkraft, die Kanonen deiner Flotte feuern jede Sekunde mit (mehr und größere Schiffe = mehr Kanonen). Du hast 30 Sekunden je Boss; ist er besiegt, kommt sofort der nächste. Jede zehnte Stufe bringt eine Trophäe: +5 % Klickkraft für immer.':
    'Tap the boss as fast as you can – every tap hits with your click power, and your fleet’s cannons fire along every second (more and bigger ships = more cannons). You have 30 seconds per boss; once it is defeated, the next one comes right away. Every tenth level brings a trophy: +5 % click power forever.',
  'Deine Flotte': 'Your fleet',
  'Alle abholen': 'Collect all',
  'Alle Schiffe losschicken': 'Send all ships',
  'Schätze': 'Treasures',
  'Logbuch': 'Logbook',
  'Tägliche Aufgaben': 'Daily tasks',
  'Dein Rang': 'Your rank',
  'Große Fahrt': 'Great Voyage',
  'Auf große Fahrt gehen': 'Set off on the great voyage',
  'Deine Boni': 'Your bonuses',
  'Halte Ausschau nach der': 'Keep an eye out for the',
  'goldenen Dublone': 'golden doubloon',
  ': Sie taucht ab und zu irgendwo auf. Schnell anklicken – sie bringt einen Schatzfund, Goldrausch (Einkommen ×7), Klickfieber (Klicks ×25) oder eine Glückssträhne (Casino-Gewinne +30–50 %)!':
    ': it pops up somewhere now and then. Tap it quickly – it brings a treasure find, gold rush (income ×7), click frenzy (clicks ×25) or a lucky streak (casino wins +30–50 %)!',
  'Schatzkammer': 'Treasure vault',
  'Erfolge': 'Achievements',
  'Jeder Erfolg gibt dir dauerhaft +1 % Einkommen.': 'Each achievement permanently gives you +1 % income.',
  'Aktuelles Guthaben': 'Current balance',
  'Verdient auf dieser Fahrt': 'Earned on this voyage',
  'Insgesamt verdient': 'Earned in total',
  'Durch Klicks verdient': 'Earned from clicks',
  'Anzahl Klicks': 'Number of clicks',
  'Kritische Klicks': 'Critical clicks',
  'Längste Klick-Combo': 'Longest click combo',
  'Einkommen pro Sekunde': 'Income per second',
  'Gebäude insgesamt': 'Buildings in total',
  'Upgrades gekauft': 'Upgrades bought',
  'Goldene Dublonen gefangen': 'Golden doubloons caught',
  'Spielzeit': 'Play time',
  'Casino – jedes Spiel einzeln': 'Casino – each game individually',
  'Freundes-Rangliste': 'Friends leaderboard',
  'Deine Figur': 'Your character',
  'Einstellungen': 'Settings',
  'Dein Name': 'Your name',
  'Für Spiele mit Freunden, Poker und dein Namensschild': 'For games with friends, poker and your name tag',
  'Lautstärke': 'Volume',
  'Kraken-Angriffe im Klicker': 'Kraken attacks in the clicker',
  'Ab und zu greift ein Kraken an und will Gebäude klauen – wehr ihn mit schnellen Klicks ab!':
    'Every now and then a kraken attacks and tries to steal buildings – fend it off with fast clicks!',
  'Animationen': 'Animations',
  'Volle Effekte': 'Full effects',
  'Reduziert (ruhiger)': 'Reduced (calmer)',
  'Spielstand': 'Save data',
  'Dein Browser erlaubt hier kein Speichern (z. B. in einer Vorschau oder im privaten Modus). Dein Fortschritt geht beim Neuladen verloren. Öffne das Spiel direkt im Browser oder sichere ihn mit „Exportieren“.':
    'Your browser does not allow saving here (e.g. in a preview or private mode). Your progress will be lost on reload. Open the game directly in the browser or back it up with “Export”.',
  'Dein Fortschritt wird automatisch alle paar Sekunden, nach jedem Kauf und beim Schließen der Seite in deinem Browser gespeichert. Zuletzt gespeichert:':
    'Your progress is saved automatically in your browser every few seconds, after every purchase and when you close the page. Last saved:',
  'Jetzt speichern': 'Save now',
  'Exportieren': 'Export',
  'Importieren': 'Import',
  'Spielstand zurücksetzen': 'Reset save',
  'Laden': 'Load',
  'Schließen': 'Close',
  'Alles ist reines Spielgeld ohne echten Wert.': 'Everything is purely play money with no real value.',
  'Gamble Klicker · Entwickelt von Rafael (': 'Gamble Klicker · Developed by Rafael (',
  ') mit der Community · Idee von Adrian ·': ') with the community · Idea by Adrian ·',
  'Quellcode auf GitHub': 'Source code on GitHub',
  '· Nur Spielgeld – kein echtes Geld · Anonyme Besucherzählung ohne Cookies (':
    '· Play money only – no real money · Anonymous visitor count without cookies (',
  // Attribute (aria-label / title)
  'Sound an/aus': 'Sound on/off',
  'Dublonen': 'Doubloons',
  'Dublone klicken': 'Click doubloon',
  'Kaufmenge': 'Buy amount',
  'Anderes Bild': 'Different picture',
});

// Ganze Elemente mit Auszeichnung (data-i18n) – Schlüssel = das data-i18n-Attribut
GK.i18n.addHtml({
  'fleet-intro':
    'Send your ships on a voyage – they keep sailing even when the game is closed. They bring back <b>loot</b> and sometimes a <b>treasure</b> that gives you a permanent bonus. The longer the voyage, the more loot and the more likely a treasure. You unlock new destinations with your rank.',
  'prestige-intro':
    'Once you have earned enough doubloons, you can set off on a great voyage: you start over with the clicker, but in return you get <b>treasure maps</b>. Each treasure map permanently gives you <b>+10 % income</b> and click power. Afterwards you spin the <b>treasure vault wheel of fortune</b>. Achievements, VIP card, cosmetics, fleet and casino statistics are kept.',
  'cos-intro':
    'Cosmetics only change the appearance. You win them at the wheel of fortune after each great voyage – or buy them at a steep price: with doubloons <b>and</b> a share of your buildings. Tap a click effect to try it out.',
});
