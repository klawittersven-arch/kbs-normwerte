/*
 * DIE NORMWERTE IM SPIEL  ← Diese Datei kannst du auf GitHub selbst ändern.
 *
 * Handys, Beamer und der Cloudflare-Dienst lesen alle diese Datei. Nach dem Hochladen gilt sie überall.
 * Cloudflare prüft die Datei vor dem Veröffentlichen. Ist etwas falsch, bleibt die alte Version online.
 *
 * So ist ein Eintrag aufgebaut:
 *   id        kurze Kennung (bitte nicht ändern)
 *   gruppe    'vital' (Vitalzeichen), 'labor' (Laborwerte) oder 'notfall' (Notfall & Kinder)
 *   name      Name des Werts, z. B. 'Herzfrequenz'
 *   kurz      Abkürzung, z. B. 'HF'
 *   anzeige   welches Gerät im Spiel erscheint:
 *             'ekg' (Monitor mit EKG), 'atmung' (Monitor mit Atemkurve), 'spo2' (Pulsoximeter),
 *             'rr' (Blutdruckmessgerät), 'thermometer' (Ohrthermometer), 'bz' (Blutzuckermessgerät),
 *             'labor' (Laborbefund), 'waage' (Personenwaage mit BMI-Anzeige),
 *             'urin' (24-h-Urinsammelbehälter), 'cpr' (Reanimations-Feedback), 'rekap' (Fingerkuppe mit Stoppuhr),
 *             'peakflow' (Peak-Flow-Meter), 'perzentile' (Perzentilenkurve)
 *   einheit   z. B. '/min', 'mmHg', '%'
 *   normal    Normbereich [von, bis]. Beide Grenzen zählen noch als „normal“.
 *   bereich   [kleinster, größter] Wert, der im Spiel vorkommen kann.
 *             Ist der kleinste Wert gleich dem Anfang des Normbereichs, gibt es kein „zu niedrig“ (z. B. CRP).
 *             Ist der größte Wert gleich dem Ende des Normbereichs, gibt es kein „zu hoch“ (z. B. SpO₂).
 *   abstand   Stufe „Deutlich“: So weit liegen zu niedrige und zu hohe Werte mindestens von der Grenze weg.
 *             Stufe „Knapp“: So nah liegen die Werte an der Grenze.
 *   schritt   Genauigkeit: 1 (ganze Zahlen), 0.1 (eine Stelle nach dem Komma), 100, 1000 …
 *   niedrig   Fachbegriff oder Erklärung für „zu niedrig“ (steht in der Auflösung)
 *   hoch      Fachbegriff oder Erklärung für „zu hoch“
 *
 *   Nur bei Bedarf:
 *   normalFrau, normalMann   statt „normal“: getrennte Normbereiche. Der Befund zeigt dann „Patientin“ oder „Patient“.
 *   normalText               so steht der Normbereich in der Auflösung, z. B. 'unter 5 mg/l'
 *   standard: false          am Beamer zunächst abgewählt: Der Wert kommt nur vor, wenn du ihn dort dazuschaltest
 *   dia                      nur beim Blutdruck: Normbereich, Bereich und Abstand für den unteren (diastolischen) Wert
 *
 * Wichtig:
 *   - Zahlen mit Punkt schreiben (3.5, nicht 3,5). Im Spiel steht dann automatisch ein Komma.
 *   - Texte stehen zwischen Hochkommas: 'Tachykardie'. Hinter jeder Zeile steht ein Komma.
 *   - Neue Werte: einen Eintrag kopieren, eine neue id vergeben und alles anpassen.
 *   - Welche Werte im Spiel vorkommen, stellst du am Beamer ein. Dafür musst du hier nichts löschen.
 */
export const NORMWERTE = [
  // ------------------------------------------------------------------ Vitalzeichen (CE 02)
  {
    id: 'hf', gruppe: 'vital', name: 'Herzfrequenz', kurz: 'HF', anzeige: 'ekg', einheit: '/min',
    normal: [60, 100], bereich: [30, 180], abstand: 10, schritt: 1,
    niedrig: 'Bradykardie', hoch: 'Tachykardie',
  },
  {
    id: 'rr', gruppe: 'vital', name: 'Blutdruck', kurz: 'RR', anzeige: 'rr', einheit: 'mmHg',
    normal: [100, 139], bereich: [70, 210], abstand: 10, schritt: 1,
    dia: { normal: [60, 89], bereich: [35, 120], abstand: 6 },
    niedrig: 'Hypotonie', hoch: 'Hypertonie',
  },
  {
    id: 'spo2', gruppe: 'vital', name: 'Sauerstoffsättigung', kurz: 'SpO₂', anzeige: 'spo2', einheit: '%',
    normal: [95, 100], bereich: [75, 100], abstand: 3, schritt: 1,
    niedrig: 'Hypoxämie (zu wenig Sauerstoff im Blut)', hoch: '',
  },
  {
    id: 'af', gruppe: 'vital', name: 'Atemfrequenz', kurz: 'AF', anzeige: 'atmung', einheit: '/min',
    normal: [12, 20], bereich: [5, 40], abstand: 4, schritt: 1,
    niedrig: 'Bradypnoe', hoch: 'Tachypnoe',
  },
  {
    id: 'temp', gruppe: 'vital', name: 'Körpertemperatur', kurz: 'Temp.', anzeige: 'thermometer', einheit: '°C',
    normal: [36.3, 37.4], bereich: [34.0, 41.0], abstand: 0.6, schritt: 0.1,
    niedrig: 'Hypothermie (Untertemperatur)', hoch: 'erhöhte Temperatur (subfebril) oder Fieber',
  },
  {
    id: 'bz', gruppe: 'vital', name: 'Blutzucker nüchtern', kurz: 'BZ', anzeige: 'bz', einheit: 'mg/dl',
    normal: [70, 100], bereich: [30, 350], abstand: 15, schritt: 1,
    niedrig: 'Hypoglykämie (Unterzucker)', hoch: 'Hyperglykämie (Überzucker)',
  },
  {
    // Body-Mass-Index nach WHO (Erwachsene). Zusatzoption: am Beamer zunächst abgewählt.
    id: 'bmi', gruppe: 'vital', name: 'Body-Mass-Index', kurz: 'BMI', anzeige: 'waage', einheit: 'kg/m²',
    normal: [18.5, 24.9], bereich: [13.0, 45.0], abstand: 2, schritt: 0.1, standard: false,
    niedrig: 'Untergewicht', hoch: 'Übergewicht (ab 30: Adipositas)',
  },
  {
    // Zielbereich bei COPD unter Sauerstoffgabe (Gefahr der CO₂-Anreicherung). Zusatzoption.
    id: 'spo2copd', gruppe: 'vital', name: 'SpO₂ bei COPD (unter Sauerstoffgabe)', kurz: 'SpO₂ (COPD)', anzeige: 'spo2', einheit: '%',
    normal: [88, 92], normalText: '88–92 % (Zielbereich bei COPD)', bereich: [75, 100], abstand: 2, schritt: 1, standard: false,
    niedrig: 'zu wenig Sauerstoff: Sauerstoffgabe nach Anordnung erhöhen',
    hoch: 'zu viel Sauerstoff: Gefahr der CO₂-Anreicherung (Hyperkapnie), Sauerstoffgabe nach Anordnung reduzieren',
  },
  {
    // Ausscheidung und Bilanzierung. Zusatzoption.
    id: 'urin', gruppe: 'vital', name: 'Urinmenge in 24 Stunden', kurz: 'Urin/24 h', anzeige: 'urin', einheit: 'ml',
    normal: [1000, 2000], bereich: [100, 4000], abstand: 400, schritt: 50, standard: false,
    niedrig: 'zu wenig Urin (unter 500 ml: Oligurie, unter 100 ml: Anurie)', hoch: 'zu viel Urin (über 3.000 ml: Polyurie)',
  },

  // ------------------------------------------------------------------ Laborwerte (CE 05)
  {
    id: 'kalium', gruppe: 'labor', name: 'Kalium', kurz: 'K⁺', anzeige: 'labor', einheit: 'mmol/l',
    normal: [3.5, 5.0], bereich: [2.0, 7.5], abstand: 0.4, schritt: 0.1,
    niedrig: 'Hypokaliämie', hoch: 'Hyperkaliämie',
  },
  {
    id: 'natrium', gruppe: 'labor', name: 'Natrium', kurz: 'Na⁺', anzeige: 'labor', einheit: 'mmol/l',
    normal: [135, 145], bereich: [115, 165], abstand: 4, schritt: 1,
    niedrig: 'Hyponatriämie', hoch: 'Hypernatriämie',
  },
  {
    id: 'hb', gruppe: 'labor', name: 'Hämoglobin', kurz: 'Hb', anzeige: 'labor', einheit: 'g/dl',
    normalFrau: [12, 16], normalMann: [14, 18], bereich: [6, 21], abstand: 1.5, schritt: 0.1,
    niedrig: 'Anämie (Blutarmut)', hoch: 'Polyglobulie',
  },
  {
    id: 'leuko', gruppe: 'labor', name: 'Leukozyten', kurz: 'Leukos', anzeige: 'labor', einheit: '/µl',
    normal: [4000, 10000], bereich: [1000, 30000], abstand: 1500, schritt: 100,
    niedrig: 'Leukopenie (Infektionsgefahr)', hoch: 'Leukozytose (z. B. bei Entzündung)',
  },
  {
    id: 'thrombo', gruppe: 'labor', name: 'Thrombozyten', kurz: 'Thrombos', anzeige: 'labor', einheit: '/µl',
    normal: [150000, 400000], bereich: [20000, 900000], abstand: 40000, schritt: 1000,
    niedrig: 'Thrombozytopenie (Blutungsgefahr)', hoch: 'Thrombozytose (Thrombosegefahr)',
  },
  {
    id: 'crp', gruppe: 'labor', name: 'C-reaktives Protein', kurz: 'CRP', anzeige: 'labor', einheit: 'mg/l',
    normal: [0, 4.9], normalText: 'unter 5 mg/l', bereich: [0, 250], abstand: 3, schritt: 0.1,
    niedrig: '', hoch: 'Entzündungszeichen erhöht',
  },
  {
    id: 'krea', gruppe: 'labor', name: 'Kreatinin', kurz: 'Krea', anzeige: 'labor', einheit: 'mg/dl',
    normal: [0.5, 1.2], bereich: [0.5, 8.0], abstand: 0.3, schritt: 0.1,
    niedrig: '', hoch: 'Hinweis auf eine eingeschränkte Nierenfunktion',
  },
  {
    id: 'quick', gruppe: 'labor', name: 'Quick-Wert', kurz: 'Quick', anzeige: 'labor', einheit: '%',
    normal: [70, 130], bereich: [10, 130], abstand: 15, schritt: 1,
    niedrig: 'Blutgerinnung verlangsamt (Blutungsgefahr, z. B. unter Marcumar)', hoch: '',
  },
  // Weitere Laborwerte (Zusatzoptionen: am Beamer zunächst abgewählt)
  {
    id: 'hba1c', gruppe: 'labor', name: 'HbA1c (Langzeit-Blutzucker)', kurz: 'HbA1c', anzeige: 'labor', einheit: '%',
    normal: [4.0, 5.6], normalText: 'unter 5,7 %', bereich: [4.0, 12.0], abstand: 0.5, schritt: 0.1, standard: false,
    niedrig: '', hoch: 'erhöht: 5,7–6,4 % Vorstufe (Prädiabetes), ab 6,5 % Diabetes mellitus',
  },
  {
    id: 'tsh', gruppe: 'labor', name: 'TSH (Schilddrüse)', kurz: 'TSH', anzeige: 'labor', einheit: 'mU/l',
    normal: [0.4, 4.0], bereich: [0.01, 30], abstand: 0.3, schritt: 0.01, standard: false,
    niedrig: 'Hinweis auf eine Schilddrüsen-Überfunktion (Hyperthyreose)', hoch: 'Hinweis auf eine Schilddrüsen-Unterfunktion (Hypothyreose)',
  },
  {
    id: 'ery', gruppe: 'labor', name: 'Erythrozyten', kurz: 'Erys', anzeige: 'labor', einheit: 'Mio/µl',
    normalFrau: [4.0, 5.2], normalMann: [4.5, 5.9], bereich: [2.0, 7.5], abstand: 0.4, schritt: 0.01, standard: false,
    niedrig: 'Anämie (Blutarmut)', hoch: 'Polyglobulie',
  },
  {
    id: 'hkt', gruppe: 'labor', name: 'Hämatokrit', kurz: 'Hkt', anzeige: 'labor', einheit: '%',
    normalFrau: [37, 47], normalMann: [40, 52], bereich: [20, 65], abstand: 4, schritt: 1, standard: false,
    niedrig: 'z. B. bei Anämie oder Überwässerung', hoch: 'z. B. bei Flüssigkeitsmangel (Dehydratation)',
  },
  {
    id: 'harnstoff', gruppe: 'labor', name: 'Harnstoff', kurz: 'Harnstoff', anzeige: 'labor', einheit: 'mg/dl',
    normal: [10, 50], bereich: [10, 250], abstand: 10, schritt: 1, standard: false,
    niedrig: '', hoch: 'Hinweis auf eine eingeschränkte Nierenfunktion',
  },
  {
    id: 'bili', gruppe: 'labor', name: 'Bilirubin', kurz: 'Bili', anzeige: 'labor', einheit: 'mg/dl',
    normal: [0.1, 1.2], normalText: 'bis 1,2 mg/dl', bereich: [0.1, 20], abstand: 0.5, schritt: 0.1, standard: false,
    niedrig: '', hoch: 'Hyperbilirubinämie (Gelbsucht, Ikterus)',
  },
  {
    id: 'got', gruppe: 'labor', name: 'GOT (AST)', kurz: 'GOT', anzeige: 'labor', einheit: 'U/l',
    normalFrau: [0, 35], normalMann: [0, 50], bereich: [0, 800], abstand: 10, schritt: 1, standard: false,
    niedrig: '', hoch: 'Hinweis auf einen Leber- oder Muskelschaden',
  },
  {
    id: 'gpt', gruppe: 'labor', name: 'GPT (ALT)', kurz: 'GPT', anzeige: 'labor', einheit: 'U/l',
    normalFrau: [0, 35], normalMann: [0, 50], bereich: [0, 800], abstand: 10, schritt: 1, standard: false,
    niedrig: '', hoch: 'Hinweis auf einen Leberschaden (z. B. Hepatitis, Fettleber)',
  },
  {
    id: 'ggt', gruppe: 'labor', name: 'γ-GT', kurz: 'γ-GT', anzeige: 'labor', einheit: 'U/l',
    normalFrau: [0, 40], normalMann: [0, 60], bereich: [0, 600], abstand: 15, schritt: 1, standard: false,
    niedrig: '', hoch: 'Hinweis auf eine Leber- oder Gallenwegserkrankung (z. B. durch Alkohol)',
  },
  {
    id: 'lipase', gruppe: 'labor', name: 'Lipase', kurz: 'Lipase', anzeige: 'labor', einheit: 'U/l',
    normal: [13, 60], bereich: [13, 2000], abstand: 20, schritt: 1, standard: false,
    niedrig: '', hoch: 'Hinweis auf eine Bauchspeicheldrüsenentzündung (Pankreatitis)',
  },
  {
    id: 'harnsaeure', gruppe: 'labor', name: 'Harnsäure', kurz: 'Harnsäure', anzeige: 'labor', einheit: 'mg/dl',
    normalFrau: [2.4, 5.7], normalMann: [3.4, 7.0], bereich: [1.0, 13.0], abstand: 0.8, schritt: 0.1, standard: false,
    niedrig: 'erniedrigt (selten, z. B. durch Medikamente)', hoch: 'Hyperurikämie (Gichtgefahr)',
  },
  {
    id: 'inr', gruppe: 'labor', name: 'INR', kurz: 'INR', anzeige: 'labor', einheit: '',
    normal: [0.9, 1.2], bereich: [0.9, 6.0], abstand: 0.4, schritt: 0.1, standard: false,
    niedrig: '', hoch: 'Blutgerinnung verlangsamt (Blutungsgefahr). Unter Marcumar ist meist 2–3 gewollt.',
  },

  // ------------------------------------------------------------------ Notfall & Kinder (alles Zusatzoptionen)
  {
    id: 'cpr-frequenz', gruppe: 'notfall', name: 'Herzdruckmassage: Drückfrequenz (Erwachsene)', kurz: 'Drückfrequenz', anzeige: 'cpr', einheit: '/min',
    normal: [100, 120], bereich: [60, 170], abstand: 10, schritt: 1, standard: false,
    niedrig: 'zu langsam gedrückt', hoch: 'zu schnell gedrückt (das Herz füllt sich nicht genug)',
  },
  {
    id: 'cpr-tiefe', gruppe: 'notfall', name: 'Herzdruckmassage: Drucktiefe (Erwachsene)', kurz: 'Drucktiefe', anzeige: 'cpr', einheit: 'cm',
    normal: [5, 6], bereich: [2.5, 8.0], abstand: 0.7, schritt: 0.1, standard: false,
    niedrig: 'zu flach gedrückt', hoch: 'zu tief gedrückt (Verletzungsgefahr)',
  },
  {
    id: 'rekap', gruppe: 'notfall', name: 'Rekapillarisierungszeit', kurz: 'Rekap-Zeit', anzeige: 'rekap', einheit: 's',
    normal: [0.5, 2.0], normalText: 'bis 2 Sekunden', bereich: [0.5, 7.0], abstand: 0.8, schritt: 0.1, standard: false,
    niedrig: '', hoch: 'verlängert: Hinweis auf eine Kreislaufstörung oder einen Schock (Zentralisation)',
  },
  {
    id: 'peakflow', gruppe: 'notfall', name: 'Peak-Flow (in % vom persönlichen Bestwert)', kurz: 'Peak-Flow', anzeige: 'peakflow', einheit: '%',
    normal: [80, 100], bereich: [20, 100], abstand: 10, schritt: 1, standard: false,
    niedrig: 'Atemwege verengt (50–80 %: gelber Bereich, unter 50 %: roter Bereich, Notfallplan)', hoch: '',
  },
  {
    id: 'bmi-perz', gruppe: 'notfall', name: 'BMI-Perzentile (Kind)', kurz: 'BMI-Perzentile', anzeige: 'perzentile', einheit: '. Perzentile',
    normal: [10, 90], normalText: '10. bis 90. Perzentile', bereich: [1, 99], abstand: 5, schritt: 1, standard: false,
    niedrig: 'Untergewicht (unter der 3. Perzentile: starkes Untergewicht)', hoch: 'Übergewicht (über der 97. Perzentile: Adipositas)',
  },
];
