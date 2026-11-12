// Töne (Web Audio, ohne Dateien).
// Nur der Beamer-Laptop spielt Töne, und nur im Finale. Handy-Seiten setzen Ton.an = false und rufen init() nie auf.
let ctx = null, master = null, pulsT = 0;
export const Ton = {
  an: true,
  // Muss einmal nach einem Tippen/Klicken aufgerufen werden (Browser-Regel)
  init() {
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
      }
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) {}
  },
  bereit() { return !!ctx && ctx.state === 'running'; },
  _osc(freq, start, dur, type, vol, slide) {
    if (!ctx || !this.an) return;
    const t0 = ctx.currentTime + Math.max(0, start);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  },
  // Gerätegeräusche
  monitorPiep() { this._osc(988, 0, 0.07, 'sine', 0.16); },              // Herzschlag am Monitor
  oxiPiep() { this._osc(880, 0, 0.06, 'sine', 0.12); },                  // Pulsoximeter
  fertig() { this._osc(2093, 0, 0.09, 'square', 0.06); this._osc(2093, 0.14, 0.09, 'square', 0.06); }, // Messung fertig
  drucker() { for (let i = 0; i < 6; i++) this._osc(180 + (i % 2) * 40, i * 0.05, 0.04, 'square', 0.03); },
  // Takt für Herzschlag/Puls: alle 60/bpm Sekunden ein Piep, bis stopPuls()
  startPuls(bpm, art) {
    this.stopPuls();
    const ms = Math.max(240, 60000 / Math.max(bpm, 1));
    const piep = () => (art === 'oxi' ? this.oxiPiep() : this.monitorPiep());
    piep();
    pulsT = setInterval(piep, ms);
  },
  stopPuls() { clearInterval(pulsT); pulsT = 0; },
  // Spiel
  tick() { this._osc(1318.5, 0, 0.05, 'triangle', 0.12); },
  piep(hoch) { this._osc(hoch ? 1046.5 : 659.25, 0, hoch ? 0.45 : 0.16, 'square', 0.14); },
  richtig() { [784, 988, 1319].forEach((f, j) => this._osc(f, j * 0.07, 0.22, 'triangle', 0.32)); },
  fehler() { this._osc(150, 0, 0.5, 'sawtooth', 0.24, 90); this._osc(155, 0, 0.5, 'square', 0.1, 92); },
  raus() { [440, 392, 330, 262].forEach((f, j) => this._osc(f, j * 0.14, 0.2, 'triangle', 0.3)); },
  fanfare() { [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5].forEach((f, j) => this._osc(f, j * 0.13, j === 5 ? 0.8 : 0.2, 'triangle', 0.4)); },
};
