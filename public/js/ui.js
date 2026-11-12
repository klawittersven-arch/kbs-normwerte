// Gemeinsame Anzeige-Bausteine für Handy, Übungsseite und Beamer
import { wert, wertText, normalText, fachbegriff, KAT_TEXT, KAT_ZEICHEN, LEBEN_QUALI, QUALI_WERTE, zeitQuali } from './regeln.js';
import { geraet } from './geraete.js';

const $ = s => document.querySelector(s);
export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const werteText = n => n === 1 ? '1 Wert' : n + ' Werte';
export const richtigText = n => n === 1 ? '1 richtig' : n + ' richtig';

// ------------------------------------------------------------------ Spielfeld auf dem Handy
export function spielfeldZeigen(on) {
  document.body.classList.toggle('spielt', !!on);
  $('#spielfeld').hidden = !on;
  $('#panel').hidden = !!on;
}
export function status(runde, text, art) {
  $('#sRunde').innerHTML = runde;
  const t = $('#sText');
  t.textContent = text;
  t.className = 'hinweis ' + (art || '');
}
export function herzenHTML(n, max) {
  let h = '';
  for (let i = 0; i < max; i++) h += `<i class="${i < n ? 'voll' : 'leer'}">${i < n ? '♥' : '♡'}</i>`;
  return h;
}
export function herzen(n, max) {
  const el = $('#sLeben'); if (!el) return;
  if (n == null) { el.innerHTML = ''; el.removeAttribute('aria-label'); return; }
  el.innerHTML = herzenHTML(n, max);
  el.setAttribute('aria-label', `${n} von ${max} Leben`);
}
export function zeitbalken(rest, gesamt, box = $('#sBarBox'), bar = $('#sBar')) {
  if (!box) return;
  if (rest == null) { bar.style.transform = 'scaleX(0)'; box.classList.remove('knapp'); return; }
  bar.style.transform = `scaleX(${Math.max(0, Math.min(1, rest / gesamt))})`;
  box.classList.toggle('knapp', rest < 3000);
}
export function countdown(num, text) {
  const el = $('#countdown');
  if (num == null) { el.hidden = true; return; }
  el.hidden = false;
  const b = $('#cdNum');
  if (b.textContent !== String(num)) { b.textContent = num; b.style.animation = 'none'; void b.offsetWidth; b.style.animation = ''; }
  $('#cdText').textContent = text || '';
}
// Das Gerät mit dem Wert zeigen
export function zeigeWert(item, nameEl = $('#wName'), geraetEl = $('#geraet')) {
  const p = wert(item.id);
  nameEl.textContent = p ? p.name : '';
  geraetEl.innerHTML = geraet(item);
  geraetEl.classList.remove('beamer-hinweis');
}
// Im Finale: Der Wert steht nur am Beamer
export function zeigeHinweis(html) {
  $('#wName').textContent = '';
  const g = $('#geraet');
  g.innerHTML = `<div class="schau">${html}</div>`;
  g.classList.add('beamer-hinweis');
}
export function feedback(html, art) {
  const el = $('#feedback');
  if (!html) { el.hidden = true; el.innerHTML = ''; return; }
  el.className = 'feedback ' + (art || '');
  el.innerHTML = html;
  el.hidden = false;
}

// ------------------------------------------------------------------ Auflösung
// „SpO₂ 89 % ist zu niedrig. Normal: 95–100 % · Hypoxämie“
export function aufloesung(item, antwort, opts = {}) {
  const p = wert(item.id); if (!p) return '';
  const fb = fachbegriff(p, item.kat);
  const du = antwort === undefined ? '' : antwort === item.kat ? '' :
    `<div class="du">${opts.wer ? esc(opts.wer) : 'Deine Antwort'}: <b>${antwort && antwort !== 'zeit' ? KAT_ZEICHEN[antwort] + ' ' + KAT_TEXT[antwort] : 'keine (Zeit um)'}</b></div>`;
  return `<div class="aufl kat-${item.kat}${opts.klein ? ' klein' : ''}">
    <div class="aw"><span class="wt">${esc(wertText(item, p))}</span> <span class="ist">ist</span> <b class="kat">${KAT_ZEICHEN[item.kat]} ${KAT_TEXT[item.kat]}</b></div>
    <div class="nb">${p.normalFrau && item.sex ? `Normal bei ${item.sex === 'w' ? 'Frauen' : 'Männern'}: ${esc(normalText(p, item.sex).replace(/^(Frauen|Männer): /, ''))}` : `Normal: ${esc(normalText(p, item.sex))}`}${fb ? ` · <b>${esc(fb)}</b>` : ''}</div>${du}${opts.extra || ''}
  </div>`;
}
// Liste von Werten mit Auflösung (z. B. die eigenen Fehler)
export function aufloesungsListe(eintraege) {
  return `<div class="aufl-liste">${eintraege.map(([item, a]) => aufloesung(item, a, { klein: true })).join('')}</div>`;
}

// ------------------------------------------------------------------ Allein spielen (Qualifying und Üben)
// Verbindet SoloSpiel mit der Anzeige. Rückgabe: Rückrufe für new SoloSpiel({...})
export function soloAnzeige(antwort, max = QUALI_WERTE, leben = LEBEN_QUALI) {
  return {
    onZeige(i, item, spiel) {
      feedback(null);
      zeigeWert(item);
      status(`Wert ${i + 1}<small>von ${max} · ${zeitQuali(i) / 1000} s</small>`, 'Wie ist der Wert?', 'frage');
      herzen(leben - spiel.f, leben);
    },
    onZeit: (rest, ges) => zeitbalken(rest, ges),
    onErgebnis(i, item, a, ok, stand, weiter) {
      zeitbalken(null);
      herzen(leben - stand.f, leben);
      if (ok) {
        status(`Wert ${i + 1}<small>von ${max}</small>`, 'Richtig! ✓', 'gut');
        feedback(`<div class="fb-kurz"><b>✓</b><span>${KAT_TEXT[item.kat]}</span></div>`, 'ok');
        return 750;
      }
      status(`Wert ${i + 1}<small>von ${max}</small>`, a ? 'Falsch ✗' : 'Zeit um! ⏱', 'schlecht');
      const letzter = stand.f >= leben || stand.n >= max;
      feedback(`<div class="fb-lang"><h3>${a ? '✗ Leider falsch' : '⏱ Zeit abgelaufen'}</h3>${aufloesung(item, a || 'zeit')}
        <button type="button" class="ghost-btn" id="fbWeiter">${letzter ? 'Ergebnis' : 'Weiter'}</button></div>`, 'bad');
      const b = document.getElementById('fbWeiter');
      if (b) b.onclick = weiter;
      return 4200;
    },
  };
}

// ------------------------------------------------------------------ Kleinkram
let toastT = 0;
export function toast(t) {
  const el = $('#toast'); if (!el) return;
  el.textContent = t; el.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 4200);
}

// Bildschirm nicht ausgehen lassen, solange gespielt wird
let lock = null, lockWanted = false;
export async function wachHalten(on) {
  lockWanted = !!on;
  try {
    if (on && !lock && navigator.wakeLock) {
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => { lock = null; });
    } else if (!on && lock) { await lock.release(); lock = null; }
  } catch (e) { lock = null; }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && lockWanted) wachHalten(true); });
