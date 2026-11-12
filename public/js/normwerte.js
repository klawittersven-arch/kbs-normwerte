/*
 * DIE NORMWERTE IM SPIEL  ← Diese Datei kannst du auf GitHub selbst ändern.
 *
 * Handys, Beamer und der Cloudflare-Dienst lesen alle diese Datei. Nach dem Hochladen gilt sie überall.
 * Cloudflare prüft die Datei vor dem Veröffentlichen. Ist etwas falsch, bleibt die alte Version online.
 *
 * So ist ein Eintrag aufgebaut:
 *   id        kurze Kennung (bitte nicht ändern)
 *   gruppe    'vital' (Vitalzeichen) oder 'labor' (Laborwerte)
 *   name      Name des Werts, z. B. 'Herzfrequenz'
 *   kurz      Abkürzung, z. B. 'HF'
 *   anzeige   welches Gerät im Spiel erscheint:
 *             'ekg' (Monitor mit EKG), 'atmung' (Monitor mit Atemkurve), 'spo2' (Pulsoximeter),
 *             'rr' (Blutdruckmessgerät), 'thermometer' (Ohrthermometer), 'bz' (Blutzuckermessgerät),
 *             'labor' (Laborbefund), 'waage' (Personenwaage mit BMI-Anzeige)
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
];
