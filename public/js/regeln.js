/*
 * Spielregeln, Zeiten, Zufall und das Erzeugen der Werte.
 * Diese Datei lesen Handys, Beamer UND der Cloudflare-Dienst.
 * Die Normwerte selbst stehen in normwerte.js.
 */
import { NORMWERTE } from './normwerte.js';

export const KATEGORIEN = ['niedrig', 'normal', 'hoch'];
export const KAT_TEXT = { niedrig: 'zu niedrig', normal: 'normal', hoch: 'zu hoch' };
export const KAT_ZEICHEN = { niedrig: '▼', normal: '●', hoch: '▲' };
export const GRUPPEN = { vital: 'Vitalzeichen', labor: 'Laborwerte', notfall: 'Notfall & Kinder' };
export const ANZEIGEN = ['ekg', 'atmung', 'spo2', 'rr', 'thermometer', 'bz', 'labor', 'waage', 'urin', 'cpr', 'rekap', 'peakflow', 'perzentile'];

export const STUFEN = ['deutlich', 'knapp'];
export const STUFE_TEXT = {
  deutlich: { name: 'Deutlich', kurz: 'Die Werte liegen klar im Normbereich oder klar daneben.' },
  knapp: { name: 'Knapp', kurz: 'Die Werte liegen nah an der Grenze. Hier muss man den Normbereich genau kennen.' },
};
export const FINAL_GROESSEN = [2, 3, 4, 6, 8];
export const LEBEN_WAHL = [1, 2, 3];   // Leben im Finale (am Beamer einstellbar)
export const LEBEN_QUALI = 3;          // Wer im Qualifying 3 Fehler macht, ist raus
export const QUALI_WERTE = 40;         // So viele Werte gibt es höchstens im Qualifying
export const FINALE_MAX = 60;          // So viele Werte gibt es höchstens im Finale
export const SUDDEN_DEATH_AB = 30;     // Ab diesem Wert im Finale kostet jeder Fehler alle Leben

// Zeit für eine Antwort (ms). Großzügig: Getestet wird Wissen, nicht Tipptempo.
// Qualifying: 10 s, alle 5 Werte 1 s weniger, nie unter 5 s (i = 0, 1, 2 …)
export const zeitQuali = i => Math.max(5000, 10000 - Math.floor(i / 5) * 1000);
// Finale: 10 s, alle 3 Werte 1 s weniger, nie unter 4 s (runde = 1, 2, 3 …)
export const zeitFinale = runde => Math.max(4000, 10000 - Math.floor((runde - 1) / 3) * 1000);

export const VORLAUF_START = 5000;  // Countdown vor dem ersten Wert im Finale
export const VORLAUF_RUNDE = 6000;  // Pause zwischen zwei Werten im Finale (Auflösung am Beamer)
export const GNADE = 1500;          // So lange nach Ablauf der Zeit werden Antworten noch angenommen (Netz)

// ------------------------------------------------------------------ Prüfen der Inhaltsdatei
const zahlOk = v => typeof v === 'number' && Number.isFinite(v);
const paarOk = v => Array.isArray(v) && v.length === 2 && zahlOk(v[0]) && zahlOk(v[1]) && v[0] <= v[1];
const textOk = v => v === undefined || typeof v === 'string';

export function normBereich(p, sex) {
  if (sex === 'm' && p.normalMann) return p.normalMann;
  if (sex === 'w' && p.normalFrau) return p.normalFrau;
  return p.normal || p.normalFrau || p.normalMann;
}
const geschlechter = p => (p.normalFrau || p.normalMann) ? ['w', 'm'] : [null];

// Liefert eine Liste von Problemen (leer = alles in Ordnung)
export function pruefe(p) {
  const f = [];
  if (!p || typeof p !== 'object') return ['Eintrag ist kein Objekt'];
  if (typeof p.id !== 'string' || !/^[a-z0-9_-]{1,20}$/.test(p.id)) f.push('id fehlt oder enthält Sonderzeichen');
  if (typeof p.name !== 'string' || !p.name.trim()) f.push('name fehlt');
  if (typeof p.kurz !== 'string' || !p.kurz.trim()) f.push('kurz fehlt');
  if (!GRUPPEN[p.gruppe]) f.push('gruppe muss eines davon sein: ' + Object.keys(GRUPPEN).map(g => "'" + g + "'").join(', '));
  if (!ANZEIGEN.includes(p.anzeige)) f.push('anzeige muss eines davon sein: ' + ANZEIGEN.join(', '));
  if (typeof p.einheit !== 'string') f.push('einheit fehlt');
  if (!zahlOk(p.schritt) || p.schritt <= 0) f.push('schritt muss eine Zahl größer als 0 sein');
  if (!zahlOk(p.abstand) || p.abstand <= 0) f.push('abstand muss eine Zahl größer als 0 sein');
  if (!paarOk(p.bereich)) f.push('bereich muss so aussehen: [von, bis]');
  if (p.normalFrau || p.normalMann) {
    if (!paarOk(p.normalFrau) || !paarOk(p.normalMann)) f.push('normalFrau und normalMann müssen beide so aussehen: [von, bis]');
  } else if (!paarOk(p.normal)) f.push('normal muss so aussehen: [von, bis]');
  if (!textOk(p.niedrig) || !textOk(p.hoch) || !textOk(p.normalText)) f.push('niedrig, hoch und normalText müssen Texte sein');
  if (p.standard !== undefined && typeof p.standard !== 'boolean') f.push('standard muss true oder false sein (ohne Hochkommas)');
  if (p.anzeige === 'rr') {
    const d = p.dia;
    if (!d || !paarOk(d.normal) || !paarOk(d.bereich) || !zahlOk(d.abstand) || d.abstand <= 0) f.push('Blutdruck braucht dia: { normal: [von, bis], bereich: [von, bis], abstand: Zahl }');
    else if (d.normal[0] < d.bereich[0] || d.normal[1] > d.bereich[1]) f.push('dia: Der Normbereich muss innerhalb von bereich liegen');
  }
  if (!f.length) {
    for (const s of geschlechter(p)) {
      const n = normBereich(p, s);
      if (n[0] < p.bereich[0] || n[1] > p.bereich[1]) f.push('Der Normbereich muss innerhalb von bereich liegen');
    }
    if (!f.length && KATEGORIEN.filter(k => kann(p, k)).length < 2) f.push('bereich ist zu klein: Es gibt weder „zu niedrig“ noch „zu hoch“');
  }
  return f;
}

function pruefeAlle(liste) {
  const ok = [], fehler = [], ids = new Set();
  (Array.isArray(liste) ? liste : []).forEach((p, i) => {
    const probleme = pruefe(p);
    if (!probleme.length && ids.has(p.id)) probleme.push('Die id „' + p.id + '“ gibt es zweimal');
    if (probleme.length) fehler.push({ nr: i + 1, name: (p && (p.name || p.id)) || '?', probleme });
    else { ok.push(p); ids.add(p.id); }
  });
  return { ok, fehler };
}
const GEPRUEFT = pruefeAlle(NORMWERTE);
export const WERTE = GEPRUEFT.ok;                // nur fehlerfreie Einträge kommen ins Spiel
export const INHALT_FEHLER = GEPRUEFT.fehler;    // wird am Beamer angezeigt
const BY_ID = new Map(WERTE.map(p => [p.id, p]));
export const wert = id => BY_ID.get(id) || null;
export const alleIds = () => WERTE.map(p => p.id);
// Werte, die am Beamer über „Vitalzeichen“, „Laborwerte“ bzw. „Beides“ ausgewählt werden (ohne Zusatzoptionen mit standard: false)
export const gruppenIds = g => WERTE.filter(p => (g === 'alle' || p.gruppe === g) && p.standard !== false).map(p => p.id);
// Voreinstellung am Beamer: nur Vitalzeichen. Laborwerte und Zusatzoptionen (z. B. BMI) lassen sich dazuschalten.
export const standardIds = () => { const v = gruppenIds('vital'); return v.length ? v : alleIds(); };

// ------------------------------------------------------------------ Zahlen
export function stellen(s) { const t = String(s); const i = t.indexOf('.'); return i < 0 ? 0 : t.length - i - 1; }
export function runden(v, s) { return Number(v.toFixed(stellen(s))); }
// Deutsche Schreibweise: 3,5 · 12.400 · 245.000
export function zahl(v, s, gruppen = true) {
  const d = stellen(s);
  let [ganz, rest] = Math.abs(v).toFixed(d).split('.');
  if (gruppen && ganz.length > 3) ganz = ganz.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (v < 0 ? '−' : '') + ganz + (rest ? ',' + rest : '');
}
// „128/min“, „89 %“, „95. Perzentile“
const einheitMit = (txt, e) => !e ? txt : (e.startsWith('/') || e.startsWith('.')) ? txt + e : txt + ' ' + e;

// „RR 85/50 mmHg“, „SpO₂ 89 %“, „HF 128/min“
export function wertZahl(item, p) {
  p = p || wert(item.id);
  return zahl(item.w, p.schritt) + (item.w2 != null ? '/' + zahl(item.w2, p.schritt) : '');
}
export function wertText(item, p) {
  p = p || wert(item.id);
  return p.kurz + ' ' + einheitMit(wertZahl(item, p), p.einheit);
}
// „60–100/min“, „Frauen: 12–16 g/dl“, „unter 5 mg/l“
export function normalText(p, sex) {
  if (p.normalText) return p.normalText;
  const n = normBereich(p, sex);
  // So viele Nachkommastellen wie nötig: „12–16“, „3,5–5,0“, „2,2–2,6“
  const bis = nb => { const s = Math.pow(10, -Math.max(...nb.map(v => stellen(v)))); return nb[0] === 0 ? 'bis ' + zahl(nb[1], s) : zahl(nb[0], s) + '–' + zahl(nb[1], s); };
  const b = bis(n);
  if (p.anzeige === 'rr' && p.dia) return b + ' / ' + bis(p.dia.normal) + ' ' + p.einheit;
  const vor = sex === 'w' && p.normalFrau ? 'Frauen: ' : sex === 'm' && p.normalMann ? 'Männer: ' : '';
  return vor + einheitMit(b, p.einheit);
}
export function fachbegriff(p, kat) { return kat === 'niedrig' ? (p.niedrig || '') : kat === 'hoch' ? (p.hoch || '') : ''; }

// ------------------------------------------------------------------ Zufall
// Pseudozufall mit Startwert: Alle Handys bekommen dieselben Werte
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function zufallsSeed() {
  if (globalThis.crypto && crypto.getRandomValues) return crypto.getRandomValues(new Uint32Array(1))[0];
  return Math.floor(Math.random() * 4294967296);
}
function mischen(arr, r) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ------------------------------------------------------------------ Werte erzeugen
// Gibt es diese Kategorie bei diesem Wert? (SpO₂ kann nicht „zu hoch“ sein, CRP nicht „zu niedrig“)
export function kann(p, kat, sex) {
  if (kat === 'normal') return true;
  const s = geschlechter(p).includes(sex) ? [sex] : geschlechter(p);
  return s.every(x => {
    const n = normBereich(p, x);
    return kat === 'niedrig' ? p.bereich[0] <= n[0] - p.schritt / 2 : p.bereich[1] >= n[1] + p.schritt / 2;
  });
}

// Bereich [von, bis], aus dem ein Wert der Kategorie kat gezogen wird
function zone(n, B, m, s, kat, stufe, r) {
  const [a, b] = n, [A, Z] = B;
  const unten = A <= a - s / 2, oben = Z >= b + s / 2;
  if (kat === 'niedrig') return stufe === 'knapp' ? [Math.max(A, a - m), a - s] : (A <= a - m ? [A, a - m] : [A, a - s]);
  if (kat === 'hoch') return stufe === 'knapp' ? [b + s, Math.min(Z, b + m)] : (Z >= b + m ? [b + m, Z] : [b + s, Z]);
  if (stufe === 'knapp') {
    const seiten = [];
    if (unten) seiten.push(0);
    if (oben) seiten.push(1);
    if (!seiten.length) return [a, b];
    return seiten[Math.floor(r() * seiten.length)] === 0 ? [a, Math.min(b, a + m)] : [Math.max(a, b - m), b];
  }
  // „Deutlich“: normale Werte mit etwas Abstand zu den Grenzen (höchstens ein Viertel des Normbereichs)
  const mi = Math.min(m, (b - a) / 4);
  const lo = a + (unten ? mi : 0), hi = b - (oben ? mi : 0);
  return lo <= hi ? [lo, hi] : [a, b];
}
function ziehe([lo, hi], s, r) {
  const k0 = Math.ceil(lo / s - 1e-9), k1 = Math.floor(hi / s + 1e-9);
  const k = k1 >= k0 ? k0 + Math.floor(r() * (k1 - k0 + 1)) : Math.round(lo / s);
  return runden(k * s, s);
}

// Kategorie eines Werts nach dem Normbereich (zum Prüfen)
export function kategorie(p, item) {
  const n = normBereich(p, item.sex), e = p.schritt / 2;
  const k = (v, nb) => v < nb[0] - e ? 'niedrig' : v > nb[1] + e ? 'hoch' : 'normal';
  const k1 = k(item.w, n);
  if (p.anzeige !== 'rr' || item.w2 == null) return k1;
  const k2 = k(item.w2, p.dia.normal);
  if (k1 === 'hoch' || k2 === 'hoch') return 'hoch';
  if (k1 === 'niedrig' || k2 === 'niedrig') return 'niedrig';
  return 'normal';
}

// Einen Wert erzeugen: { id, kat, w, w2 (nur Blutdruck), sex (nur bei getrennten Normbereichen), puls, deko }
export function erzeuge(p, kat, stufe, r) {
  const sex = p.normalFrau ? (r() < 0.5 ? 'w' : 'm') : null;
  if (!kann(p, kat, sex)) kat = 'normal';
  const n = normBereich(p, sex);
  const sys = () => ziehe(zone(n, p.bereich, p.abstand, p.schritt, kat, stufe, r), p.schritt, r);
  const item = { id: p.id, kat, w: sys() };
  if (sex) item.sex = sex;
  if (p.anzeige === 'rr') {
    const d = p.dia;
    const dia = () => ziehe(zone(d.normal, d.bereich, d.abstand, p.schritt, kat, stufe, r), p.schritt, r);
    let w2 = dia();
    for (let t = 0; t < 40 && item.w - w2 < 25; t++) { item.w = sys(); w2 = dia(); }
    if (item.w - w2 < 25) w2 = runden(item.w - 25, p.schritt);
    item.w2 = w2;
  }
  if (p.anzeige === 'rr' || p.anzeige === 'spo2') item.puls = 62 + Math.floor(r() * 27); // Puls nebenbei, immer normal
  item.deko = Math.floor(r() * 10000); // für Kleinigkeiten in der Anzeige (Uhrzeit, Bett …)
  return item;
}

// Die Werte einer Runde: für alle Handys gleich. Jeder Wert kommt etwa gleich oft dran, nie zweimal direkt hintereinander.
export function aufgaben(seed, ids, stufe, anzahl) {
  const r = rng((seed ^ 0x5bd1e995) >>> 0);
  let liste = WERTE.filter(p => Array.isArray(ids) && ids.includes(p.id));
  if (!liste.length) liste = WERTE;
  const out = [];
  let beutel = [], katBeutel = [], zuletzt = null;
  while (out.length < anzahl) {
    if (!beutel.length) {
      beutel = mischen(liste.map(p => p.id), r);
      if (beutel.length > 1 && beutel[0] === zuletzt) [beutel[0], beutel[1]] = [beutel[1], beutel[0]];
    }
    const p = wert(beutel.shift());
    const moeglich = KATEGORIEN.filter(k => kann(p, k));
    if (!katBeutel.length) katBeutel = mischen(KATEGORIEN.concat(KATEGORIEN), r);
    const j = katBeutel.findIndex(k => moeglich.includes(k));
    const kat = j >= 0 ? katBeutel.splice(j, 1)[0] : moeglich[Math.floor(r() * moeglich.length)];
    out.push(erzeuge(p, kat, stufe === 'knapp' ? 'knapp' : 'deutlich', r));
    zuletzt = p.id;
  }
  return out;
}

// Rangfolge im Qualifying: mehr richtige vorn, dann weniger Fehler, dann schnellere Antworten
export function vergleichQuali(a, b) {
  return (b.r - a.r) || (a.f - b.f) || (a.ms - b.ms);
}
