// Antworten: drei große Knöpfe (zu niedrig · normal · zu hoch) und Wischen auf dem Gerät
// (nach links = zu niedrig, nach oben = normal, nach rechts = zu hoch). Am Laptop auch mit den Pfeiltasten.
import { KATEGORIEN, KAT_TEXT, KAT_ZEICHEN } from './regeln.js';

const SCHWELLE = 48; // so weit (px) muss man wischen

/**
 * opts: { knoepfe: Element, flaeche: Element (Wischfläche), ziel: Element (bewegt sich beim Wischen), onAntwort(a), tasten: bool }
 */
export function erstelleAntwort(opts) {
  const { knoepfe, flaeche, onAntwort } = opts;
  let enabled = false, start = null, gewaehlt = null;
  knoepfe.innerHTML = KATEGORIEN.map(k =>
    `<button type="button" class="ant ant-${k}" data-a="${k}" disabled><span class="sym" aria-hidden="true">${KAT_ZEICHEN[k]}</span><span class="txt">${KAT_TEXT[k]}</span></button>`).join('');
  const btn = a => knoepfe.querySelector(`[data-a="${a}"]`);
  const waehle = a => {
    if (!enabled || !KATEGORIEN.includes(a)) return;
    gewaehlt = a;
    api.eingabe(false);
    api.markiere(a, 'gewaehlt');
    if (navigator.vibrate) try { navigator.vibrate(25); } catch (e) {}
    onAntwort && onAntwort(a);
  };
  knoepfe.querySelectorAll('.ant').forEach(b => {
    b.addEventListener('pointerdown', e => { if (!enabled) return; e.preventDefault(); waehle(b.dataset.a); });
    b.addEventListener('click', e => { if (e.detail === 0) waehle(b.dataset.a); }); // Tastatur (Enter/Leertaste)
  });

  // ---- Wischen
  const ziel = () => opts.ziel || flaeche.firstElementChild || flaeche;
  const richtung = (dx, dy) => {
    if (Math.abs(dx) >= SCHWELLE && Math.abs(dx) > Math.abs(dy) * 0.8) return dx < 0 ? 'niedrig' : 'hoch';
    if (-dy >= SCHWELLE && -dy > Math.abs(dx)) return 'normal';
    return null;
  };
  const zuruecksetzen = () => {
    ziel().style.transform = '';
    knoepfe.querySelectorAll('.ant').forEach(b => b.classList.remove('vor'));
    flaeche.dataset.wisch = '';
  };
  flaeche.addEventListener('pointerdown', e => {
    if (!enabled || e.button > 0) return;
    start = { x: e.clientX, y: e.clientY, id: e.pointerId };
    try { flaeche.setPointerCapture(e.pointerId); } catch (err) {}
    ziel().style.transition = 'none';
  });
  flaeche.addEventListener('pointermove', e => {
    if (!start || e.pointerId !== start.id) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    ziel().style.transform = `translate(${dx * 0.45}px, ${Math.min(0, dy) * 0.45}px) rotate(${dx * 0.02}deg)`;
    const r = richtung(dx, dy);
    knoepfe.querySelectorAll('.ant').forEach(b => b.classList.toggle('vor', b.dataset.a === r));
    flaeche.dataset.wisch = r || '';
  });
  const ende = e => {
    if (!start || e.pointerId !== start.id) return;
    const r = e.type === 'pointerup' ? richtung(e.clientX - start.x, e.clientY - start.y) : null;
    start = null;
    ziel().style.transition = 'transform .18s ease-out';
    zuruecksetzen();
    if (r) waehle(r);
  };
  flaeche.addEventListener('pointerup', ende);
  flaeche.addEventListener('pointercancel', ende);

  // ---- Tasten (Übungsseite am Laptop)
  if (opts.tasten) {
    document.addEventListener('keydown', e => {
      if (!enabled || e.repeat || (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName))) return;
      const a = { ArrowLeft: 'niedrig', ArrowDown: 'niedrig', ArrowUp: 'normal', ArrowRight: 'hoch', 1: 'niedrig', 2: 'normal', 3: 'hoch' }[e.key];
      if (a) { e.preventDefault(); waehle(a); }
    });
  }

  const api = {
    get gewaehlt() { return gewaehlt; },
    eingabe(on) {
      enabled = !!on;
      if (on) { gewaehlt = null; api.markiere(null); }
      knoepfe.classList.toggle('aktiv', enabled);
      flaeche.classList.toggle('aktiv', enabled);
      knoepfe.querySelectorAll('.ant').forEach(b => { b.disabled = !enabled; });
      if (!on) { start = null; zuruecksetzen(); }
    },
    // Knopf hervorheben: 'gewaehlt', 'richtig' (grün) oder 'falsch' (rot)
    markiere(a, cls) {
      knoepfe.querySelectorAll('.ant').forEach(b => b.classList.remove('gewaehlt', 'richtig', 'falsch', 'vor'));
      if (a && cls) btn(a).classList.add(cls);
    },
    aufloesen(soll, ist) {
      api.markiere(null);
      if (ist && ist !== soll && btn(ist)) btn(ist).classList.add('falsch');
      if (btn(soll)) btn(soll).classList.add('richtig');
    },
  };
  return api;
}
