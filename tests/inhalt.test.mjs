// Prüft die Inhaltsdatei normwerte.js und das Erzeugen der Werte:  node --test tests/
// Läuft auch bei Cloudflare vor jedem Veröffentlichen. Schlägt etwas fehl, bleibt die alte Version online.
import test from 'node:test';
import assert from 'node:assert/strict';
import { NORMWERTE } from '../public/js/normwerte.js';
import {
  WERTE, INHALT_FEHLER, KATEGORIEN, aufgaben, erzeuge, kann, kategorie, normBereich, normalText, wertText,
  zahl, rng, zeitQuali, zeitFinale, pruefe, QUALI_WERTE,
} from '../public/js/regeln.js';

test('normwerte.js: Alle Einträge sind vollständig und stimmig', () => {
  const text = INHALT_FEHLER.map(f => `Eintrag ${f.nr} (${f.name}): ${f.probleme.join('; ')}`).join('\n');
  assert.equal(INHALT_FEHLER.length, 0, 'In public/js/normwerte.js stimmt etwas nicht:\n' + text);
  assert.equal(WERTE.length, NORMWERTE.length);
  assert.ok(WERTE.some(p => p.gruppe === 'vital') && WERTE.some(p => p.gruppe === 'labor'));
});

test('Fehlerhafte Einträge werden erkannt (statt das Spiel zu stören)', () => {
  assert.ok(pruefe({ id: 'x', gruppe: 'vital', name: 'X', kurz: 'X', anzeige: 'ekg', einheit: '', normal: [10, 5], bereich: [0, 20], abstand: 1, schritt: 1 }).length);
  assert.ok(pruefe({ id: 'x', gruppe: 'vital', name: 'X', kurz: 'X', anzeige: 'toaster', einheit: '', normal: [5, 10], bereich: [0, 20], abstand: 1, schritt: 1 }).length);
  assert.ok(pruefe({ id: 'x', gruppe: 'vital', name: 'X', kurz: 'X', anzeige: 'ekg', einheit: '', normal: [5, 10], bereich: [5, 10], abstand: 1, schritt: 1 }).length, 'nur „normal“ möglich');
  assert.ok(pruefe({ id: 'x', gruppe: 'vital', name: 'X', kurz: 'X', anzeige: 'ekg', einheit: '', normal: [5, 10], bereich: [0, 20], abstand: 1, schritt: '1' }).length);
  assert.deepEqual(pruefe({ id: 'x', gruppe: 'vital', name: 'X', kurz: 'X', anzeige: 'ekg', einheit: '', normal: [5, 10], bereich: [0, 20], abstand: 1, schritt: 1 }), []);
});

test('Jeder erzeugte Wert passt zu seiner Kategorie (beide Stufen, alle Werte)', () => {
  const r = rng(99);
  for (const p of WERTE) for (const stufe of ['deutlich', 'knapp']) for (const kat of KATEGORIEN) {
    if (!kann(p, kat)) continue;
    for (let i = 0; i < 300; i++) {
      const x = erzeuge(p, kat, stufe, r);
      const info = `${p.name} ${stufe} ${kat}: ${wertText(x, p)}`;
      assert.equal(kategorie(p, x), x.kat, info);
      if (!kann(p, kat, x.sex)) continue;
      assert.equal(x.kat, kat, info);
      const n = normBereich(p, x.sex), e = p.schritt / 2;
      assert.ok(x.w >= p.bereich[0] - e && x.w <= p.bereich[1] + e, 'außerhalb von bereich: ' + info);
      if (stufe === 'deutlich' && kat === 'niedrig' && p.bereich[0] <= n[0] - p.abstand) assert.ok(x.w <= n[0] - p.abstand + e, 'zu nah an der Grenze: ' + info);
      if (stufe === 'deutlich' && kat === 'hoch' && p.bereich[1] >= n[1] + p.abstand) assert.ok(x.w >= n[1] + p.abstand - e, 'zu nah an der Grenze: ' + info);
      if (stufe === 'knapp' && kat === 'niedrig') assert.ok(x.w >= n[0] - p.abstand - e, 'nicht knapp: ' + info);
      if (stufe === 'knapp' && kat === 'hoch') assert.ok(x.w <= n[1] + p.abstand + e, 'nicht knapp: ' + info);
      if (p.anzeige === 'rr') assert.ok(x.w - x.w2 >= 25, 'Blutdruck unrealistisch: ' + info);
    }
  }
});

test('Kategorien, die es bei einem Wert nicht gibt, kommen nie vor (z. B. SpO₂ „zu hoch“)', () => {
  for (const p of WERTE) {
    const it = aufgaben(7, [p.id], 'knapp', 60).concat(aufgaben(8, [p.id], 'deutlich', 60));
    for (const x of it) assert.ok(kann(p, x.kat, x.sex), `${p.name}: „${x.kat}“ gibt es hier nicht`);
  }
});

test('Werte einer Runde: für alle gleich, gut gemischt, nie derselbe Wert direkt hintereinander', () => {
  const ids = WERTE.map(p => p.id);
  const a = aufgaben(4711, ids, 'deutlich', QUALI_WERTE), b = aufgaben(4711, ids, 'deutlich', QUALI_WERTE);
  assert.deepEqual(a, b);
  if (ids.length > 1) for (let i = 1; i < a.length; i++) assert.notEqual(a[i].id, a[i - 1].id);
  for (const k of KATEGORIEN) {
    if (!WERTE.some(p => kann(p, k))) continue;
    const n = a.filter(x => x.kat === k).length;
    assert.ok(n >= 5, 'zu selten: ' + k + ' (' + n + ')');
  }
  if (ids.length <= QUALI_WERTE) for (const id of ids) assert.ok(a.some(x => x.id === id), 'fehlt: ' + id);
  const einer = aufgaben(1, [ids[0]], 'deutlich', 10);
  assert.ok(einer.every(x => x.id === ids[0]));
  assert.ok(aufgaben(1, [], 'deutlich', 5).length === 5, 'leere Auswahl → alle Werte');
});

// Beispieldaten: unabhängig davon, was in normwerte.js steht
const BSP = {
  rr: { id: 'x1', gruppe: 'vital', name: 'Blutdruck', kurz: 'RR', anzeige: 'rr', einheit: 'mmHg', normal: [100, 139], bereich: [70, 210], abstand: 10, schritt: 1, dia: { normal: [60, 89], bereich: [35, 120], abstand: 6 } },
  spo2: { id: 'x2', gruppe: 'vital', name: 'SpO₂', kurz: 'SpO₂', anzeige: 'spo2', einheit: '%', normal: [95, 100], bereich: [75, 100], abstand: 3, schritt: 1 },
  af: { id: 'x3', gruppe: 'vital', name: 'AF', kurz: 'AF', anzeige: 'atmung', einheit: '/min', normal: [12, 20], bereich: [5, 40], abstand: 4, schritt: 1 },
  hb: { id: 'x4', gruppe: 'labor', name: 'Hb', kurz: 'Hb', anzeige: 'labor', einheit: 'g/dl', normalFrau: [12, 16], normalMann: [14, 18], bereich: [6, 21], abstand: 1.5, schritt: 0.1 },
  k: { id: 'x5', gruppe: 'labor', name: 'Kalium', kurz: 'K⁺', anzeige: 'labor', einheit: 'mmol/l', normal: [3.5, 5.0], bereich: [2, 7.5], abstand: 0.4, schritt: 0.1 },
  crp: { id: 'x6', gruppe: 'labor', name: 'CRP', kurz: 'CRP', anzeige: 'labor', einheit: 'mg/l', normal: [0, 4.9], normalText: 'unter 5 mg/l', bereich: [0, 250], abstand: 3, schritt: 0.1 },
};

test('Deutsche Schreibweise', () => {
  for (const p of Object.values(BSP)) assert.deepEqual(pruefe(p), [], p.name);
  assert.equal(zahl(12400, 100), '12.400');
  assert.equal(zahl(245000, 1000), '245.000');
  assert.equal(zahl(3.5, 0.1), '3,5');
  assert.equal(zahl(38, 0.1), '38,0');
  assert.equal(wertText({ w: 85, w2: 50 }, BSP.rr), 'RR 85/50 mmHg');
  assert.equal(wertText({ w: 89 }, BSP.spo2), 'SpO₂ 89 %');
  assert.equal(wertText({ w: 26 }, BSP.af), 'AF 26/min');
  assert.equal(normalText(BSP.rr), '100–139 / 60–89 mmHg');
  assert.equal(normalText(BSP.hb, 'w'), 'Frauen: 12–16 g/dl');
  assert.equal(normalText(BSP.k), '3,5–5,0 mmol/l');
  assert.equal(normalText(BSP.crp), 'unter 5 mg/l');
  assert.ok(!kann(BSP.spo2, 'hoch') && kann(BSP.spo2, 'niedrig') && !kann(BSP.crp, 'niedrig'));
});

test('Zeit pro Wert: großzügig und langsam schneller', () => {
  assert.equal(zeitQuali(0), 10000);
  assert.equal(zeitQuali(5), 9000);
  assert.equal(zeitQuali(39), 5000);
  assert.equal(zeitFinale(1), 10000);
  assert.equal(zeitFinale(4), 9000);
  assert.equal(zeitFinale(40), 4000);
  for (let i = 1; i < 60; i++) assert.ok(zeitQuali(i) <= zeitQuali(i - 1) && zeitFinale(i + 1) <= zeitFinale(i));
});
