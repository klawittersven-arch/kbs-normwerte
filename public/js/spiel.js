// Ein Spiel allein auf dem Handy (Qualifying und Üben):
// Wert zeigen → zu niedrig / normal / zu hoch → nächster Wert … bis 3 Fehler oder bis alle Werte geschafft sind.
import { zeitQuali, QUALI_WERTE, LEBEN_QUALI } from './regeln.js';

export class SoloSpiel {
  /**
   * o: { items, antwort (aus erstelleAntwort), stand: {n, r, f, ms} (zum Weiterspielen nach dem Neuladen),
   *      onZeige(i, item, spiel), onZeit(rest, gesamt),
   *      onErgebnis(i, item, antwort, ok, stand, weiter) → Wartezeit in ms bis zum nächsten Wert,
   *      onStand(stand, fehler)   nach jeder Antwort (fehler = [Nummer, Antwort] oder null),
   *      onEnde({n, r, f, ms, why, fehler}) }
   */
  constructor(o) {
    this.o = o;
    this.max = o.max || QUALI_WERTE;
    this.leben = o.leben || LEBEN_QUALI;
    const s = o.stand || {};
    this.n = s.n || 0; this.r = s.r || 0; this.f = s.f || 0; this.ms = s.ms || 0;
    this.fehler = [];
    this.timers = [];
    this.raf = 0;
    this.aktiv = false;
    this.offen = false;
    this.wartet = false;
  }
  later(fn, ms) { const t = setTimeout(fn, ms); this.timers.push(t); return t; }
  vorbei() { return this.f >= this.leben || this.n >= this.max; }
  start(warte = 0) {
    this.aktiv = true;
    this.later(() => (this.vorbei() ? this.ende() : this.zeige()), warte);
  }
  stop() {
    this.aktiv = false; this.offen = false; this.wartet = false;
    this.timers.forEach(clearTimeout); this.timers = [];
    cancelAnimationFrame(this.raf);
    this.o.antwort.eingabe(false);
    this.o.onZeit && this.o.onZeit(null);
  }
  zeige() {
    if (!this.aktiv) return;
    this.wartet = false;
    const i = this.n, item = this.o.items[i];
    this.o.onZeige && this.o.onZeige(i, item, this);
    this.limit = zeitQuali(i);
    this.t0 = performance.now();
    this.offen = true;
    this.o.antwort.eingabe(true);
    if (window.__nwTest) window.__nwTest.solo = { i, kat: item.kat }; // nur für automatische Tests
    const tick = () => {
      if (!this.aktiv || !this.offen) return;
      const rest = Math.max(0, this.t0 + this.limit - performance.now());
      this.o.onZeit && this.o.onZeit(rest, this.limit);
      if (rest > 0) this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
    this.zeitT = this.later(() => this.antwort(null), this.limit);
  }
  // a: 'niedrig' | 'normal' | 'hoch', null = Zeit abgelaufen
  antwort(a) {
    if (!this.aktiv || !this.offen) return;
    this.offen = false;
    clearTimeout(this.zeitT);
    cancelAnimationFrame(this.raf);
    this.o.antwort.eingabe(false);
    const i = this.n, item = this.o.items[i];
    const dt = Math.min(Math.round(performance.now() - this.t0), this.limit);
    const ok = a === item.kat;
    this.n++; this.ms += dt;
    let x = null;
    if (ok) this.r++;
    else { this.f++; x = [i, a || 'zeit']; this.fehler.push(x); }
    this.o.antwort.aufloesen(item.kat, a);
    const stand = { n: this.n, r: this.r, f: this.f, ms: this.ms };
    this.o.onStand && this.o.onStand(stand, x);
    this.wartet = true;
    const warte = this.o.onErgebnis ? this.o.onErgebnis(i, item, a, ok, stand, () => this.weiter()) : 800;
    this.weiterT = this.later(() => this.weiter(), warte);
  }
  weiter() {
    if (!this.aktiv || !this.wartet) return;
    this.wartet = false;
    clearTimeout(this.weiterT);
    if (this.vorbei()) this.ende(); else this.zeige();
  }
  ende() {
    if (!this.aktiv) return;
    this.aktiv = false;
    this.o.onZeit && this.o.onZeit(null);
    this.o.onEnde && this.o.onEnde({ n: this.n, r: this.r, f: this.f, ms: this.ms, why: this.f >= this.leben ? 'leben' : 'fertig', fehler: this.fehler });
  }
}
