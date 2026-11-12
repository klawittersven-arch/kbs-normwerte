// Raum-Logik für eine Klasse: Anmeldung, Qualifying (jede/r allein auf dem Handy) und Finale am Beamer.
// Diese Datei kennt weder Cloudflare noch Node. Der Server-Adapter
// (src/worker.js für Cloudflare, server/local.mjs für den Laptop) reicht Verbindungen und Speicher herein.
import {
  KATEGORIEN, STUFEN, FINAL_GROESSEN, LEBEN_WAHL, LEBEN_QUALI, QUALI_WERTE, FINALE_MAX, SUDDEN_DEATH_AB,
  VORLAUF_START, VORLAUF_RUNDE, GNADE, zeitFinale, aufgaben, alleIds, standardIds, vergleichQuali, zufallsSeed,
  CPU, istCpu, wert, kann,
} from '../public/js/regeln.js';

export const MAX_PLAYERS = 60;
const NAME_RE = /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ' -]{0,15}$/;

export function cleanName(first, initial) {
  first = String(first || '').trim().replace(/\s+/g, ' ');
  initial = String(initial || '').trim();
  if (!NAME_RE.test(first)) return null;
  if (!/^[A-Za-zÀ-ÖØ-öø-ÿ]$/.test(initial)) return null;
  const cap = s => s.charAt(0).toLocaleUpperCase('de-DE') + s.slice(1);
  return cap(first) + ' ' + initial.toLocaleUpperCase('de-DE') + '.';
}
const int = (v, lo, hi, def) => {
  v = Number(v);
  return Number.isInteger(v) && v >= lo && v <= hi ? v : def;
};
const ms = v => { v = Math.round(Number(v)); return Number.isFinite(v) && v >= 0 && v < 3600000 ? v : 0; };

export function cleanCfg(c, old) {
  c = c || {}; old = old || {};
  const pick = (v, list, def) => list.includes(v) ? v : def;
  const all = alleIds();
  const ids = v => Array.isArray(v) ? all.filter(id => v.includes(id)) : [];
  let w = ids(c.ids);
  if (!w.length) w = ids(old.ids);
  if (!w.length) w = standardIds();
  return {
    ids: w,
    stufe: pick(c.stufe, STUFEN, pick(old.stufe, STUFEN, 'deutlich')),
    finalN: pick(Number(c.finalN), FINAL_GROESSEN, pick(Number(old.finalN), FINAL_GROESSEN, 4)),
    leben: pick(Number(c.leben), LEBEN_WAHL, pick(Number(old.leben), LEBEN_WAHL, 3)),
  };
}

export function freshState(code) {
  return {
    v: 1, code, teacherKey: null, created: 0, updated: 0,
    phase: 'lobby', // lobby | quali | final-setup | final | podium
    cfg: cleanCfg({}),
    players: {},
    order: [], // pids in Anmelde-Reihenfolge
    quali: null,
    final: null,
    nr: 0, // zählt Qualifying- und Finalrunden, damit alte Nachrichten nicht zählen
  };
}

// Was antwortet der Computergegner, und nach wie vielen ms? (zufall: Zahl von 0 bis 1)
// Mit der Trefferquote richtig, sonst eine andere Antwort, die es bei diesem Wert gibt.
export function cpuEntscheidung(quote, item, limit, zufall = Math.random) {
  const p = wert(item.id);
  let a = item.kat;
  if (zufall() >= quote) {
    const andere = KATEGORIEN.filter(k => k !== item.kat && (!p || kann(p, k, item.sex)));
    const auswahl = andere.length ? andere : KATEGORIEN.filter(k => k !== item.kat);
    a = auswahl[Math.floor(zufall() * auswahl.length)];
  }
  const max = Math.max(1600, Math.min(limit - 1200, 6500));   // Bedenkzeit wie ein Mensch: 1,2 s bis höchstens 6,5 s
  return { a, ms: Math.round(1200 + zufall() * (max - 1200)) };
}

// Zeitplan eines Werts im Finale: sichtbar ab startAt, Antworten bis deadline
export const rundenPlan = (startAt, runde) => ({ startAt, deadline: startAt + zeitFinale(runde) });

/*
 * Einen Wert im Finale auswerten. st: Zustand je Finalist ({alive, leben, ok, dt, r, f, ms, ...}).
 * Richtig: +1 richtig. Falsch oder zu spät: ein Leben weniger (ab SUDDEN_DEATH_AB alle Leben).
 * Ohne Leben ist man raus. Scheiden mehrere gleichzeitig aus, steht vorn, wer mehr richtig hatte,
 * bei Gleichstand, wer insgesamt schneller geantwortet hat.
 * Rückgabe: { ok: [Slots], verloren: [Slots], out: [Slots, bester zuerst], done: bool }
 */
export function werteRunde(st, runde) {
  const imSpiel = st.map((x, i) => i).filter(i => st[i].alive);
  const sd = runde >= SUDDEN_DEATH_AB;
  const ok = [], verloren = [];
  for (const i of imSpiel) {
    const x = st[i];
    x.ms += x.dt || 0;
    if (x.ok) { x.r++; ok.push(i); }
    else { x.f++; x.leben = sd ? 0 : Math.max(0, x.leben - 1); verloren.push(i); }
  }
  const out = imSpiel.filter(i => st[i].leben <= 0);
  const rest = imSpiel.filter(i => st[i].leben > 0);
  out.sort((a, b) => (st[b].r - st[a].r) || (st[a].ms - st[b].ms) || (a - b));
  let place = rest.length ? rest.length + 1 : 1;
  for (const i of out) { st[i].alive = false; st[i].place = place++; st[i].out = runde; }
  let done = false;
  if (rest.length === 0) done = true;                                   // alle raus: der Beste dieser Runde gewinnt
  else if (rest.length === 1 && out.length) { st[rest[0]].place = 1; done = true; } // nur noch eine/r übrig
  if (!done && runde >= FINALE_MAX) {
    // Unwahrscheinlich: Nach 60 Werten sind noch mehrere dabei. Dann zählen richtige Antworten und Zeit
    rest.sort((a, b) => (st[b].r - st[a].r) || (st[a].ms - st[b].ms) || (a - b))
      .forEach((i, j) => { st[i].place = j + 1; st[i].alive = false; st[i].out = runde; });
    done = true;
  }
  return { ok, verloren, out, done };
}

export class RoomLogic {
  /**
   * @param {object} io  Adapter:
   *   io.load() -> Promise<state|null>
   *   io.save(state) -> Promise
   *   io.wipe() -> Promise
   *   io.conns() -> Array<{meta, ws, send(obj), sendRaw(str), close(code, reason)}>
   *   io.setMeta(conn, meta)
   *   io.now() -> ms
   */
  constructor(io) { this.io = io; this.s = null; }

  async state(code) {
    if (!this.s) this.s = (await this.io.load()) || freshState(code);
    return this.s;
  }
  async persist() { this.s.updated = this.io.now(); await this.io.save(this.s); }

  // ---------- Verbindungen
  async open(conn, q) {
    const s = await this.state(q.code);
    const role = q.role === 'teacher' ? 'teacher' : 'player';
    if (role === 'teacher') {
      const key = String(q.key || '');
      if (key.length < 12 || key.length > 64) return this.reject(conn, 'bad-key');
      if (!s.teacherKey) { s.teacherKey = key; s.created = this.io.now(); await this.persist(); }
      else if (s.teacherKey !== key) return this.reject(conn, 'code-taken');
      this.io.setMeta(conn, { role: 'teacher' });
      conn.send(this.roomMsg());
    } else {
      const pid = String(q.pid || '');
      if (!/^[a-z0-9]{8,24}$/.test(pid)) return this.reject(conn, 'bad-pid');
      if (!s.teacherKey) return this.reject(conn, 'no-room');
      this.io.setMeta(conn, { role: 'player', pid });
      conn.send(this.youMsg(pid));
      this.pushTeachers();
    }
  }
  reject(conn, why) {
    try { conn.send({ t: 'error', why }); conn.close(4001, why); } catch (e) {}
  }
  async close(conn) {
    const m = conn.meta || {};
    if (m.role !== 'player') return;
    await this.state();
    this.closing = conn.ws;
    try { this.pushTeachers(); } finally { this.closing = null; }
  }

  // ---------- Nachrichten
  async message(conn, raw) {
    if (typeof raw !== 'string' || raw.length > 4096) return;
    let msg; try { msg = JSON.parse(raw); } catch (e) { return; }
    if (!msg || typeof msg.t !== 'string') return;
    const m = conn.meta || {};
    const s = await this.state();
    if (msg.t === 'sync') { conn.send({ t: 'sync', c: msg.c, s: this.io.now() }); return; }
    if (m.role === 'teacher') return this.teacherMsg(conn, msg, s);
    if (m.role === 'player') return this.playerMsg(conn, msg, s, m.pid);
  }

  async teacherMsg(conn, msg, s) {
    const now = this.io.now();
    switch (msg.t) {
      case 'cfg': {
        s.cfg = cleanCfg(msg.cfg, s.cfg);
        await this.persist(); this.pushTeachers(); return;
      }
      case 'kick': {
        const pid = String(msg.pid || ''); if (!s.players[pid]) return;
        if (s.final && s.final.p.includes(pid) && (s.phase === 'final' || s.phase === 'podium')) return conn.send({ t: 'error', why: 'kick-finalist' });
        delete s.players[pid]; s.order = s.order.filter(p => p !== pid);
        if (s.final && s.phase === 'final-setup') s.final.p = s.final.p.filter(p => p !== pid);
        for (const c of this.io.conns()) if ((c.meta || {}).pid === pid) c.send({ t: 'kicked' });
        await this.persist(); this.pushTeachers(); return;
      }
      case 'quali-start': {
        if (s.phase !== 'lobby') return;
        if (!s.order.length) return conn.send({ t: 'error', why: 'no-players' });
        s.cfg = cleanCfg(msg.cfg, s.cfg);
        s.nr++;
        s.quali = { nr: s.nr, seed: zufallsSeed(), ids: s.cfg.ids, stufe: s.cfg.stufe, startAt: now + VORLAUF_START, open: true };
        for (const pid of s.order) { s.players[pid].q = null; s.players[pid].z = null; }
        s.final = null; s.phase = 'quali';
        await this.persist(); this.pushAll(); return;
      }
      case 'quali-end': {
        if (s.phase !== 'quali' || !s.quali) return;
        s.quali.open = false;
        for (const pid of s.order) {
          const p = s.players[pid];
          if (!p.q) p.q = { n: 0, r: 0, f: 0, ms: 0, done: true, why: 'ende', falsch: [] };
          else if (!p.q.done) { p.q.done = true; p.q.why = 'ende'; }
        }
        s.phase = 'final-setup';
        const p = this.ranking().slice(0, s.cfg.finalN);
        if (p.length < 2) p.push('cpu-mittel'); // allein im Qualifying: gegen den Computer
        s.final = { p, state: 'setup' };
        await this.persist(); this.pushAll(); return;
      }
      case 'final-pick': {
        if (s.phase !== 'final-setup') return;
        const p = this.cleanFinalists(msg.p, s);
        if (!p) return;
        s.final = { p, state: 'setup' };
        await this.persist(); this.pushTeachers(); return;
      }
      case 'final-start': case 'revanche': {
        if (msg.t === 'final-start' && s.phase !== 'final-setup') return;
        if (msg.t === 'revanche' && s.phase !== 'podium') return;
        const p = msg.t === 'revanche' && s.final ? s.final.p.slice() : this.cleanFinalists(msg.p, s);
        if (!p || p.length < 2 || !p.every(pid => s.players[pid] || istCpu(pid))) return conn.send({ t: 'error', why: 'final-players' });
        const on = this.online();
        if (!p.every(pid => istCpu(pid) || on.has(pid))) return conn.send({ t: 'error', why: 'final-offline' });
        if (msg.cfg) s.cfg = cleanCfg(msg.cfg, s.cfg);
        const seed = zufallsSeed();
        const leben = s.cfg.leben;
        s.nr++;
        s.final = {
          nr: s.nr, p, names: p.map(pid => istCpu(pid) ? CPU[pid].name : s.players[pid].name), seed,
          ids: s.cfg.ids, stufe: s.cfg.stufe, leben,
          items: aufgaben(seed, s.cfg.ids, s.cfg.stufe, FINALE_MAX),
          round: 1, state: 'run', last: null, first: true, z: {},
          st: p.map(() => ({ alive: true, leben, r: 0, f: 0, ms: 0, a: null, ok: null, dt: 0, place: 0, out: 0 })),
          ...rundenPlan(now + VORLAUF_START, 1),
          revanche: msg.t === 'revanche' ? ((s.final && s.final.revanche) || 0) + 1 : 0,
        };
        this.planeCpu(s.final);
        for (const pid of s.order) s.players[pid].z = null;
        s.phase = 'final';
        await this.persist(); this.pushAll(); return;
      }
      case 'tick': {
        // Der Beamer meldet: Die Antwortzeit ist abgelaufen (oder: alle Finalisten haben geantwortet, das Publikum hatte 2 Sekunden mehr)
        const f = s.final;
        if (s.phase !== 'final' || !f || f.state !== 'run' || msg.nr !== f.nr || msg.r !== f.round) return;
        if (msg.grund === 'alle') {
          if (f.st.some(x => x.alive && !x.a)) return;
          return this.maybeResolve(s, true);
        }
        if (now < f.deadline + GNADE) return;
        this.cpuNachholen(s);
        f.st.forEach(x => { if (x.alive && !x.a) { x.a = 'zeit'; x.ok = false; x.dt = zeitFinale(f.round); } });
        return this.maybeResolve(s, true);
      }
      case 'cpu': {
        // Der Beamer meldet: Der Computergegner ist mit seiner Antwort dran
        const f = s.final;
        if (s.phase !== 'final' || !f || f.state !== 'run' || msg.nr !== f.nr || msg.r !== f.round) return;
        if (this.cpuNachholen(s)) return this.maybeResolve(s);
        return;
      }
      case 'final-abort': {
        if (s.phase !== 'final' && s.phase !== 'podium') return;
        s.final = { p: s.final ? s.final.p : [], state: 'setup' };
        s.phase = 'final-setup';
        await this.persist(); this.pushAll(); return;
      }
      case 'to-setup': {
        if (s.phase !== 'podium') return;
        s.final = { p: s.final ? s.final.p : [], state: 'setup' };
        s.phase = 'final-setup';
        await this.persist(); this.pushAll(); return;
      }
      case 'to-lobby': {
        s.phase = 'lobby'; s.quali = null; s.final = null;
        for (const pid of s.order) { s.players[pid].q = null; s.players[pid].z = null; }
        await this.persist(); this.pushAll(); return;
      }
      case 'wipe': {
        for (const c of this.io.conns()) { try { c.send({ t: 'ended' }); c.close(4000, 'ended'); } catch (e) {} }
        this.s = null; await this.io.wipe(); return;
      }
    }
  }

  cleanFinalists(list, s) {
    const p = Array.isArray(list) ? list.map(String).filter(pid => s.players[pid] || istCpu(pid)) : [];
    if (new Set(p).size !== p.length || p.length > Math.max(...FINAL_GROESSEN)) return null;
    return p;
  }

  async playerMsg(conn, msg, s, pid) {
    const now = this.io.now();
    switch (msg.t) {
      case 'join': {
        const name = cleanName(msg.first, msg.initial);
        if (!name) return conn.send({ t: 'error', why: 'bad-name' });
        let p = s.players[pid];
        if (!p) {
          if (s.order.length >= MAX_PLAYERS) return conn.send({ t: 'error', why: 'full' });
          let shown = name, n = 2;
          const taken = new Set(Object.values(s.players).map(x => x.name));
          while (taken.has(shown)) shown = name + ' ' + (n++);
          p = s.players[pid] = { name: shown, at: now, q: null, z: null };
          s.order.push(pid);
        }
        await this.persist();
        conn.send(this.youMsg(pid)); this.pushTeachers(); return;
      }
      case 'leave': {
        // „Nicht ich?“: Name freigeben, solange kein Finale mit diesem Namen läuft
        const p = s.players[pid]; if (!p) return;
        if (s.final && s.final.p.includes(pid) && s.phase !== 'lobby') return;
        delete s.players[pid]; s.order = s.order.filter(x => x !== pid);
        await this.persist(); conn.send(this.youMsg(pid)); this.pushTeachers(); return;
      }
      case 'q': {
        // Stand im Qualifying: n Werte beantwortet, davon r richtig und f falsch (x = letzter Fehler: [Nummer, Antwort])
        const p = s.players[pid], Q = s.quali;
        if (!p || !Q || s.phase !== 'quali' || msg.nr !== Q.nr) return;
        const alt = p.q || { n: 0, r: 0, f: 0, ms: 0, done: false, falsch: [] };
        if (alt.done) return conn.send(this.youMsg(pid));
        const n = int(msg.n, 1, QUALI_WERTE, -1), r = int(msg.r, 0, QUALI_WERTE, -1), f = int(msg.f, 0, LEBEN_QUALI, -1);
        if (n < 0 || r < 0 || f < 0 || r + f !== n || n <= alt.n || r < alt.r || f < alt.f) return;
        const falsch = (alt.falsch || []).slice();
        if (f > alt.f && Array.isArray(msg.x) && falsch.length < LEBEN_QUALI) {
          const i = int(msg.x[0], 0, QUALI_WERTE - 1, -1);
          if (i >= 0) falsch.push([i, KATEGORIEN.includes(msg.x[1]) ? msg.x[1] : 'zeit']);
        }
        const done = f >= LEBEN_QUALI || n >= QUALI_WERTE;
        p.q = { n, r, f, ms: ms(msg.ms), done, why: done ? (f >= LEBEN_QUALI ? 'leben' : 'fertig') : '', falsch };
        await this.persist();
        this.pushTeachers();
        if (done) this.pushDonePlayers(); else conn.send({ t: 'q-ok', n });
        return;
      }
      case 'fa': {
        // Antwort im Finale. Finalisten: zählt. Alle anderen raten mit (zählt nicht fürs Finale).
        const f = s.final;
        if (s.phase !== 'final' || !f || f.state !== 'run' || msg.nr !== f.nr || msg.r !== f.round) return;
        if (!KATEGORIEN.includes(msg.a) || !s.players[pid]) return;
        if (now < f.startAt - 500 || now > f.deadline + GNADE) return;
        const slot = f.p.indexOf(pid);
        if (slot >= 0 && f.st[slot].alive) {
          const x = f.st[slot];
          if (x.a) return;
          x.a = msg.a; x.ok = msg.a === f.items[f.round - 1].kat;
          x.dt = Math.min(ms(msg.ms), zeitFinale(f.round));
          const out = JSON.stringify({ t: 'fp', nr: f.nr, r: f.round, slot });
          for (const c of this.io.conns()) if ((c.meta || {}).role === 'teacher') c.sendRaw(out);
          return this.maybeResolve(s);
        }
        if (f.z[pid]) return;
        f.z[pid] = msg.a;
        await this.persist(); // sofort speichern: Cloudflare kann den Raum zwischendurch schlafen legen
        conn.send({ t: 'za-ok', nr: f.nr, r: f.round, a: msg.a });
        const zp = JSON.stringify({ t: 'zp', nr: f.nr, r: f.round, n: Object.keys(f.z).length });
        for (const c of this.io.conns()) if ((c.meta || {}).role === 'teacher') c.sendRaw(zp);
        // Alle haben geantwortet (Finalisten und Publikum): sofort auflösen
        if (!f.st.some(x => x.alive && !x.a) && this.publikumFertig(s)) return this.maybeResolve(s);
        return;
      }
    }
  }

  // Computergegner: Antwort und Zeitpunkt für den aktuellen Wert festlegen (der Beamer meldet sich dann mit „cpu“)
  planeCpu(f) {
    f.cpu = {};
    const item = f.items[f.round - 1];
    f.p.forEach((pid, i) => {
      if (!istCpu(pid) || !f.st[i].alive) return;
      const e = cpuEntscheidung(CPU[pid].quote, item, zeitFinale(f.round));
      f.cpu[i] = { at: f.startAt + e.ms, a: e.a };
    });
  }
  // Fällige Antworten des Computergegners eintragen. Rückgabe: true, wenn etwas eingetragen wurde
  cpuNachholen(s) {
    const f = s.final, now = this.io.now();
    let neu = false;
    for (const [slot, c] of Object.entries(f.cpu || {})) {
      const x = f.st[slot];
      if (!x || !x.alive || x.a || now < c.at - 500) continue;
      x.a = c.a; x.ok = c.a === f.items[f.round - 1].kat; x.dt = Math.max(0, c.at - f.startAt);
      neu = true;
      const out = JSON.stringify({ t: 'fp', nr: f.nr, r: f.round, slot: Number(slot) });
      for (const k of this.io.conns()) if ((k.meta || {}).role === 'teacher') k.sendRaw(out);
    }
    return neu;
  }

  // Hat jede/r im Publikum (mit verbundenem Handy) schon mitgeraten?
  publikumFertig(s) {
    const f = s.final;
    for (const pid of this.online()) {
      if (!s.players[pid]) continue;
      const slot = f.p.indexOf(pid);
      if (slot >= 0 && f.st[slot].alive) continue;
      if (!f.z[pid]) return false;
    }
    return true;
  }

  // Wert auswerten, sobald alle Finalisten geantwortet haben und das Publikum fertig ist
  // (force: Zeit um bzw. das Publikum hatte nach den Finalisten noch 2 Sekunden)
  async maybeResolve(s, force) {
    const f = s.final;
    if (f.st.some(x => x.alive && !x.a) || (!force && !this.publikumFertig(s))) {
      await this.persist(); this.pushAll(); return;
    }
    const item = f.items[f.round - 1];
    const vorher = f.st.map(x => x.alive);
    const r = werteRunde(f.st, f.round);
    // Mitraten im Publikum
    let zn = 0, zr = 0;
    for (const [pid, a] of Object.entries(f.z || {})) {
      const p = s.players[pid]; if (!p) continue;
      const ok = a === item.kat;
      p.z = p.z || { n: 0, r: 0 };
      p.z.n++; zn++;
      if (ok) { p.z.r++; zr++; }
    }
    f.last = {
      round: f.round, item, out: r.out, pub: { n: zn, r: zr }, z: f.z || {},
      ant: f.st.map((x, i) => vorher[i] ? { a: x.a, ok: !!x.ok } : null),
    };
    f.z = {};
    if (r.done) {
      f.state = 'done'; f.endAt = this.io.now();
      s.phase = 'podium';
    } else {
      f.round++;
      Object.assign(f, rundenPlan(this.io.now() + VORLAUF_RUNDE, f.round));
      f.first = false;
      for (const x of f.st) if (x.alive) { x.a = null; x.ok = null; x.dt = 0; }
      this.planeCpu(f);
    }
    await this.persist(); this.pushAll();
  }

  // ---------- Sicht auf den Raum
  online() {
    const set = new Set();
    for (const c of this.io.conns()) { const m = c.meta || {}; if (m.role === 'player' && c.ws !== this.closing) set.add(m.pid); }
    return set;
  }
  ranking() {
    const s = this.s;
    const list = s.order.filter(p => s.players[p] && s.players[p].q);
    list.sort((a, b) => vergleichQuali(s.players[a].q, s.players[b].q) || s.players[a].at - s.players[b].at);
    return list;
  }
  // Finale für den Beamer (alles) bzw. für Handys (der aktuelle Wert bleibt geheim, bis er aufgelöst ist)
  finalView(f, beamer) {
    if (!f) return null;
    if (f.state === 'setup') return { state: 'setup', p: f.p };
    const v = {
      nr: f.nr, state: f.state, p: f.p, names: f.names, leben: f.leben, stufe: f.stufe,
      round: f.round, startAt: f.startAt, deadline: f.deadline, first: f.first, revanche: f.revanche,
      st: f.st.map(x => ({ alive: x.alive, leben: x.leben, r: x.r, f: x.f, place: x.place, out: x.out, dran: !!x.a })),
      last: f.last ? { round: f.last.round, item: f.last.item, out: f.last.out, pub: f.last.pub, ant: f.last.ant } : null,
    };
    if (f.state === 'done') v.verlauf = f.items.slice(0, f.round);
    if (beamer) {
      v.item = f.state === 'run' ? f.items[f.round - 1] : null;
      v.cpu = f.state === 'run' ? Object.values(f.cpu || {}).map(c => c.at) : [];
      v.st = f.st;
      v.zCount = Object.keys(f.z || {}).length;
    }
    return v;
  }
  roomMsg() {
    const s = this.s, on = this.online(), rank = this.ranking();
    const players = s.order.filter(p => s.players[p]).map(pid => {
      const p = s.players[pid];
      return { pid, name: p.name, q: p.q, z: p.z, online: on.has(pid), rank: rank.indexOf(pid) + 1 };
    });
    const f = this.finalView(s.final, true);
    if (f) f.online = f.p.map(pid => istCpu(pid) || on.has(pid));
    return { t: 'room', code: s.code, phase: s.phase, cfg: s.cfg, quali: s.quali, players, now: this.io.now(), final: f };
  }
  youMsg(pid) {
    const s = this.s, p = s.players[pid] || null, f = s.final;
    const rank = this.ranking(), r = rank.indexOf(pid);
    let final = null;
    if (f && f.state !== 'setup' && (s.phase === 'final' || s.phase === 'podium')) {
      const slot = f.p.indexOf(pid);
      final = this.finalView(f, false);
      final.slot = slot;
      final.me = slot >= 0 ? final.st[slot] : null;
      // Eigene Antwort auf den aktuellen Wert (Finalist oder Mitraten)
      final.tipp = slot >= 0 && f.st[slot].alive ? (f.st[slot].a || null) : (f.z && f.z[pid]) || null;
      // Eigenes Ergebnis beim letzten Wert
      const L = f.last;
      if (L) {
        const a = slot >= 0 && L.ant[slot] ? L.ant[slot].a : L.z[pid];
        final.meinLetzter = a ? { a, ok: a === L.item.kat } : null;
      }
    } else if (f && s.phase === 'final-setup') {
      final = { state: 'setup', chosen: f.p.includes(pid) };
    }
    const Q = s.quali;
    return {
      t: 'you', phase: s.phase, now: this.io.now(),
      me: p ? { name: p.name, q: p.q, z: p.z, rank: r + 1, of: rank.length } : null,
      quali: Q ? { nr: Q.nr, seed: Q.seed, ids: Q.ids, stufe: Q.stufe, startAt: Q.startAt, open: Q.open } : null,
      final,
    };
  }
  pushTeachers() {
    if (!this.s) return;
    let msg = null;
    for (const c of this.io.conns()) if ((c.meta || {}).role === 'teacher') { msg = msg || JSON.stringify(this.roomMsg()); c.sendRaw(msg); }
  }
  pushPlayers() {
    if (!this.s) return;
    for (const c of this.io.conns()) { const m = c.meta || {}; if (m.role === 'player') c.send(this.youMsg(m.pid)); }
  }
  // Nur an Handys, die im Qualifying schon fertig sind (sie sehen ihren Platz live)
  pushDonePlayers() {
    if (!this.s) return;
    for (const c of this.io.conns()) {
      const m = c.meta || {};
      if (m.role !== 'player') continue;
      const p = this.s.players[m.pid];
      if (p && p.q && p.q.done) c.send(this.youMsg(m.pid));
    }
  }
  pushAll() { this.pushTeachers(); this.pushPlayers(); }
}
