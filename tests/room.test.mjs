// Tests der Raum-Logik ohne Server:  node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomLogic, werteRunde, cleanName, cleanCfg, cpuEntscheidung } from '../src/room.js';
import { zeitFinale, GNADE, SUDDEN_DEATH_AB, KATEGORIEN, alleIds, standardIds, wert, rng, aufgaben, kann, CPU, FINALE_MAX } from '../public/js/regeln.js';

function makeRoom() {
  let t = 1_000_000, saved = null;
  const conns = [];
  const logic = new RoomLogic({
    load: async () => saved, save: async s => { saved = structuredClone(s); }, wipe: async () => { saved = null; },
    conns: () => conns, setMeta: (c, m) => { c.meta = m; }, now: () => t,
  });
  const conn = () => { const c = { meta: {}, ws: {}, inbox: [], send(o) { this.inbox.push(o); }, sendRaw(s) { this.inbox.push(JSON.parse(s)); }, close() {} }; conns.push(c); return c; };
  const last = (c, type) => [...c.inbox].reverse().find(m => m.t === type);
  return { logic, conn, last, tick: ms => { t += ms; }, now: () => t, msg: (c, o) => logic.message(c, JSON.stringify(o)) };
}
async function klasse(R, namen) {
  const T = R.conn();
  await R.logic.open(T, { code: 'ABCDE', role: 'teacher', key: 'k'.repeat(20) });
  const P = namen.map((n, i) => { const c = R.conn(); c.pid = 'pid' + 'abcdefgh'[i] + 'xxxxx'; c.name = n; return c; });
  for (const c of P) {
    await R.logic.open(c, { code: 'ABCDE', role: 'player', pid: c.pid });
    await R.msg(c, { t: 'join', first: c.name, initial: 'k' });
  }
  return { T, P };
}
const falscheAntwort = kat => KATEGORIEN.find(k => k !== kat);

test('Namen werden geprüft und vereinheitlicht', () => {
  assert.equal(cleanName('lena', 'k'), 'Lena K.');
  assert.equal(cleanName('', 'k'), null);
  assert.equal(cleanName('Lena', ''), null);
  assert.equal(cleanName('<b>', 'k'), null);
});

// Die Tests hängen nicht davon ab, welche Werte in normwerte.js stehen
const ALLE = alleIds(), ZWEI = ALLE.slice(0, 2);

test('Einstellungen: nur bekannte Werte, nie eine leere Auswahl', () => {
  assert.deepEqual(cleanCfg({ ids: [ZWEI[0], 'quatsch'] }).ids, [ZWEI[0]]);
  assert.deepEqual(cleanCfg({ ids: [] }).ids, standardIds());
  assert.ok(cleanCfg({}).ids.every(id => wert(id).gruppe === 'vital'), 'Voreinstellung: nur Vitalzeichen');
  assert.deepEqual(cleanCfg({ ids: [] }, { ids: [ALLE[ALLE.length - 1]] }).ids, [ALLE[ALLE.length - 1]]);
  assert.equal(cleanCfg({ stufe: 'knapp', finalN: 8, leben: 1 }).finalN, 8);
  assert.equal(cleanCfg({ finalN: 5, leben: 7 }).leben, 3);
});

test('Finale auswerten: Leben, Ausscheiden, Platzierung', () => {
  const neu = (r, ok, leben = 2) => ({ alive: true, leben, r, f: 0, ms: 1000, ok, dt: 500, place: 0, out: 0 });
  const st = [neu(5, true), neu(4, false, 1), neu(6, false, 1), neu(5, false, 2)];
  const r = werteRunde(st, 7);
  assert.deepEqual(r.ok, [0]);
  assert.deepEqual(r.out, [2, 1]); // mehr Richtige → besserer Platz
  assert.equal(st[2].place, 3); assert.equal(st[1].place, 4);
  assert.equal(st[3].leben, 1); assert.equal(st[3].alive, true);
  assert.equal(r.done, false);
  // Sudden Death: ein Fehler reicht
  const sd = [neu(30, true, 3), neu(30, false, 3)];
  const r2 = werteRunde(sd, SUDDEN_DEATH_AB);
  assert.equal(r2.done, true);
  assert.equal(sd[0].place, 1); assert.equal(sd[1].place, 2);
});

test('Finale auswerten: alle gleichzeitig raus → wer mehr richtig hatte, gewinnt', () => {
  const st = [
    { alive: true, leben: 1, r: 3, f: 2, ms: 9000, ok: false, dt: 1000 },
    { alive: true, leben: 1, r: 4, f: 2, ms: 9500, ok: false, dt: 1000 },
    { alive: false, leben: 0, r: 1, f: 3, place: 3 },
  ];
  const r = werteRunde(st, 5);
  assert.equal(r.done, true);
  assert.equal(st[1].place, 1); assert.equal(st[0].place, 2);
});

test('Ganzer Ablauf: Anmeldung, Qualifying, Finale mit Mitraten, Siegerehrung', async () => {
  const R = makeRoom();
  const { T, P } = await klasse(R, ['Mia', 'Mia', 'Tom', 'Ali']);
  let room = R.last(T, 'room');
  assert.deepEqual(room.players.map(p => p.name), ['Mia K.', 'Mia K. 2', 'Tom K.', 'Ali K.']);

  await R.msg(T, { t: 'quali-start', cfg: { ids: ZWEI, stufe: 'knapp', finalN: 2, leben: 2 } });
  const you = R.last(P[0], 'you');
  assert.equal(you.phase, 'quali');
  assert.deepEqual(you.quali.ids, ZWEI);
  assert.equal(you.quali.stufe, 'knapp');
  const nr = you.quali.nr;
  // Mia: 5 richtig, dann 3 Fehler → raus
  for (let n = 1; n <= 5; n++) await R.msg(P[0], { t: 'q', nr, n, r: n, f: 0, ms: n * 2000 });
  await R.msg(P[0], { t: 'q', nr, n: 6, r: 5, f: 1, ms: 12000, x: [5, 'hoch'] });
  await R.msg(P[0], { t: 'q', nr, n: 7, r: 5, f: 2, ms: 14000, x: [6, 'zeit'] });
  await R.msg(P[0], { t: 'q', nr, n: 8, r: 5, f: 3, ms: 16000, x: [7, 'normal'] });
  // Mia 2: gleich viele richtig, aber schneller
  await R.msg(P[1], { t: 'q', nr, n: 8, r: 5, f: 3, ms: 9000, x: [7, 'niedrig'] });
  // Ungültig: Summe stimmt nicht / rückwärts
  await R.msg(P[2], { t: 'q', nr, n: 3, r: 3, f: 1, ms: 100 });
  await R.msg(P[2], { t: 'q', nr, n: 2, r: 2, f: 0, ms: 3000 });
  await R.msg(P[2], { t: 'q', nr, n: 1, r: 1, f: 0, ms: 1000 });
  room = R.last(T, 'room');
  const mia = room.players.find(p => p.pid === P[0].pid);
  assert.equal(mia.q.done, true); assert.equal(mia.q.why, 'leben');
  assert.deepEqual(mia.q.falsch, [[5, 'hoch'], [6, 'zeit'], [7, 'normal']]);
  assert.equal(room.players.find(p => p.pid === P[1].pid).rank, 1);
  assert.equal(room.players.find(p => p.pid === P[2].pid).q.n, 2);
  await R.msg(T, { t: 'quali-end' });
  room = R.last(T, 'room');
  assert.equal(room.phase, 'final-setup');
  assert.deepEqual(room.final.p, [P[1].pid, P[0].pid]);

  await R.msg(T, { t: 'final-start', p: room.final.p, cfg: { leben: 2 } });
  room = R.last(T, 'room');
  assert.equal(room.phase, 'final');
  let f = room.final;
  assert.ok(f.item && ZWEI.includes(f.item.id), 'Beamer kennt den Wert');
  // Handys kennen den aktuellen Wert nicht
  const yf = R.last(P[0], 'you').final;
  assert.equal(yf.item, undefined);
  assert.equal(JSON.stringify(yf).includes('"kat"'), false);

  // Wert 1: beide richtig, Tom rät richtig mit, Ali falsch
  R.tick(f.startAt - R.now() + 500);
  await R.msg(P[2], { t: 'fa', nr: f.nr, r: 1, a: f.item.kat, ms: 900 });
  await R.msg(P[3], { t: 'fa', nr: f.nr, r: 1, a: falscheAntwort(f.item.kat), ms: 900 });
  assert.equal(R.last(T, 'zp').n, 2);
  await R.msg(P[1], { t: 'fa', nr: f.nr, r: 1, a: f.item.kat, ms: 600 });
  await R.msg(P[0], { t: 'fa', nr: f.nr, r: 1, a: f.item.kat, ms: 800 });
  room = R.last(T, 'room');
  f = room.final;
  assert.equal(f.round, 2);
  assert.deepEqual(f.last.pub, { n: 2, r: 1 });
  assert.equal(R.last(P[2], 'you').final.meinLetzter.ok, true);
  assert.equal(R.last(P[3], 'you').final.meinLetzter.ok, false);
  assert.equal(R.last(P[0], 'you').final.meinLetzter.ok, true);

  // Wert 2: Mia (Slot 1) falsch → ein Leben weniger, noch dabei
  R.tick(f.startAt - R.now() + 500);
  await R.msg(P[0], { t: 'fa', nr: f.nr, r: 2, a: falscheAntwort(f.item.kat), ms: 1200 });
  await R.msg(P[0], { t: 'fa', nr: f.nr, r: 2, a: f.item.kat, ms: 1300 }); // zweite Antwort zählt nicht
  await R.msg(P[1], { t: 'fa', nr: f.nr, r: 2, a: f.item.kat, ms: 1500 });
  // Finalisten fertig, das Publikum noch nicht: Es darf noch mitraten
  assert.equal(R.last(T, 'room').final.round, 2);
  await R.msg(P[2], { t: 'fa', nr: f.nr, r: 2, a: f.item.kat, ms: 1900 });
  assert.equal(R.last(T, 'room').final.round, 2);
  await R.msg(T, { t: 'tick', nr: f.nr, r: 2, grund: 'alle' }); // Beamer: 2 Sekunden später
  f = R.last(T, 'room').final;
  assert.equal(f.last.pub.n, 1);
  assert.equal(f.round, 3);
  assert.equal(f.st[1].leben, 1);
  assert.equal(f.st[1].alive, true);
  // Wert 3: Mia wieder falsch → raus, Mia 2 gewinnt
  R.tick(f.startAt - R.now() + 500);
  await R.msg(T, { t: 'tick', nr: f.nr, r: 3, grund: 'alle' }); // zu früh: Finalisten fehlen noch
  assert.equal(R.last(T, 'room').phase, 'final');
  await R.msg(P[1], { t: 'fa', nr: f.nr, r: 3, a: f.item.kat, ms: 1500 });
  await R.msg(P[0], { t: 'fa', nr: f.nr, r: 3, a: falscheAntwort(f.item.kat), ms: 1200 });
  await R.msg(P[2], { t: 'fa', nr: f.nr, r: 3, a: f.item.kat, ms: 1600 });
  await R.msg(P[3], { t: 'fa', nr: f.nr, r: 3, a: f.item.kat, ms: 1700 }); // ganzes Publikum fertig → sofort
  room = R.last(T, 'room');
  assert.equal(room.phase, 'podium');
  assert.deepEqual(room.final.st.map(x => x.place), [1, 2]);
  assert.equal(room.final.verlauf.length, 3);
  assert.equal(room.players.find(p => p.pid === P[2].pid).z.r, 3);
  assert.equal(room.players.find(p => p.pid === P[3].pid).z.n, 2);
  const yp = R.last(P[0], 'you');
  assert.equal(yp.final.me.place, 2);
  assert.equal(yp.final.verlauf.length, 3);

  // Revanche: gleiche Finalisten, neue Werte
  await R.msg(T, { t: 'revanche' });
  room = R.last(T, 'room');
  assert.equal(room.phase, 'final');
  assert.equal(room.final.revanche, 1);
  assert.equal(room.final.round, 1);
});

test('Zeit abgelaufen: Beamer meldet tick, Server wertet aus', async () => {
  const R = makeRoom();
  const { T, P } = await klasse(R, ['Ali', 'Ben']);
  await R.msg(T, { t: 'quali-start' });
  await R.msg(T, { t: 'quali-end' });
  await R.msg(T, { t: 'final-start', p: P.map(c => c.pid), cfg: { leben: 1 } });
  let f = R.last(T, 'room').final;
  R.tick(f.startAt - R.now() + 100);
  await R.msg(P[0], { t: 'fa', nr: f.nr, r: 1, a: f.item.kat, ms: 700 });
  await R.msg(T, { t: 'tick', nr: f.nr, r: 1 }); // zu früh: nichts passiert
  assert.equal(R.last(T, 'room').phase, 'final');
  R.tick(zeitFinale(1) + GNADE + 100);
  await R.msg(P[1], { t: 'fa', nr: f.nr, r: 1, a: f.item.kat, ms: 700 }); // zu spät
  await R.msg(T, { t: 'tick', nr: f.nr, r: 1 });
  const room = R.last(T, 'room');
  assert.equal(room.phase, 'podium');
  assert.equal(room.final.st[1].a, 'zeit');
  assert.equal(room.final.st[0].place, 1);
});

test('Handy neu geladen: Stand im Qualifying bleibt erhalten', async () => {
  const R = makeRoom();
  const { T, P } = await klasse(R, ['Ali']);
  await R.msg(T, { t: 'quali-start' });
  const nr = R.last(P[0], 'you').quali.nr;
  await R.msg(P[0], { t: 'q', nr, n: 4, r: 3, f: 1, ms: 8000, x: [2, 'normal'] });
  const neu = R.conn();
  await R.logic.open(neu, { code: 'ABCDE', role: 'player', pid: P[0].pid });
  const y = R.last(neu, 'you');
  assert.deepEqual([y.me.q.n, y.me.q.r, y.me.q.f], [4, 3, 1]);
  assert.equal(y.me.name, 'Ali K.');
});

test('Computergegner: Trefferquote, passende falsche Antworten, menschliche Bedenkzeit', () => {
  const r = rng(2024);
  const items = aufgaben(5, alleIds(), 'deutlich', 60);
  for (const [id, c] of Object.entries(CPU)) {
    let richtig = 0, n = 0;
    for (let i = 0; i < 3000; i++) {
      const item = items[i % items.length], limit = zeitFinale(1 + (i % 40));
      const e = cpuEntscheidung(c.quote, item, limit, r);
      n++; if (e.a === item.kat) richtig++;
      assert.ok(KATEGORIEN.includes(e.a));
      if (e.a !== item.kat) assert.ok(kann(wert(item.id), e.a, item.sex), 'falsche Antwort, die es gar nicht gibt: ' + e.a + ' bei ' + item.id);
      assert.ok(e.ms >= 1200 && e.ms <= Math.max(1600, limit - 1200), 'Bedenkzeit ' + e.ms);
    }
    assert.ok(Math.abs(richtig / n - c.quote) < 0.04, id + ': trifft ' + Math.round(richtig / n * 100) + ' % statt ' + c.quote * 100 + ' %');
  }
});

test('Allein im Qualifying: Finale gegen den Computer', async () => {
  const R = makeRoom();
  const { T, P } = await klasse(R, ['Ali']);
  await R.msg(T, { t: 'quali-start' });
  await R.msg(T, { t: 'quali-end' });
  let room = R.last(T, 'room');
  assert.deepEqual(room.final.p, [P[0].pid, 'cpu-mittel'], 'Computer (mittel) ist vorausgewählt');
  await R.msg(T, { t: 'final-pick', p: [P[0].pid, 'cpu-schwer'] });
  await R.msg(T, { t: 'final-start', p: [P[0].pid, 'cpu-schwer'], cfg: { leben: 1 } });
  room = R.last(T, 'room');
  assert.equal(room.phase, 'final', 'Computer braucht kein Handy');
  let f = room.final;
  assert.equal(f.names[1], CPU['cpu-schwer'].name);
  assert.equal(f.cpu.length, 1);
  assert.ok(f.cpu[0] > f.startAt && f.cpu[0] < f.deadline);
  // Das Handy erfährt nichts über den Computer
  const y = R.last(P[0], 'you').final;
  assert.equal(y.cpu, undefined);
  // Spätestens nach FINALE_MAX Werten ist Schluss; dann gewinnt der schnellere Mensch. So ist der Test nie Glückssache.
  for (let runde = 1; runde <= FINALE_MAX && room.phase === 'final'; runde++) {
    f = room.final;
    R.tick(f.startAt - R.now() + 300);
    await R.msg(P[0], { t: 'fa', nr: f.nr, r: f.round, a: f.item.kat, ms: 300 });
    await R.msg(T, { t: 'cpu', nr: f.nr, r: f.round }); // zu früh: nichts passiert
    assert.equal(R.last(T, 'room').final.round, f.round);
    R.tick(f.cpu[0] - R.now() + 60);
    await R.msg(T, { t: 'cpu', nr: f.nr, r: f.round });
    room = R.last(T, 'room');
    assert.ok(room.phase === 'podium' || room.final.round === f.round + 1, 'Runde ausgewertet');
  }
  assert.equal(room.phase, 'podium', 'Finale beendet');
  assert.equal(room.final.st[0].place, 1);
  assert.equal(room.final.st[1].place, 2);
});

test('Computergegner antwortet auch, wenn die Meldung vom Beamer fehlt (Zeit um)', async () => {
  const R = makeRoom();
  const { T, P } = await klasse(R, ['Ali', 'Ben']);
  await R.msg(T, { t: 'quali-start' });
  await R.msg(T, { t: 'quali-end' });
  await R.msg(T, { t: 'final-start', p: [P[0].pid, 'cpu-leicht'], cfg: { leben: 2 } });
  const f = R.last(T, 'room').final;
  R.tick(f.deadline - R.now() + GNADE + 100);
  await R.msg(T, { t: 'tick', nr: f.nr, r: 1 });
  const g = R.last(T, 'room').final;
  assert.equal(g.round, 2);
  assert.notEqual(g.last.ant[1].a, 'zeit', 'Computer hat geantwortet');
  assert.equal(g.last.ant[0].a, 'zeit');
});
