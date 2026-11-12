// Handy-Seite der SuS: anmelden, Qualifying allein spielen, im Finale zum Beamer schauen und hier antworten
import { KNet, randomId, store } from './net.js';
import { erstelleAntwort } from './antwort.js';
import { SoloSpiel } from './spiel.js';
import { aufgaben, QUALI_WERTE, LEBEN_QUALI, KAT_TEXT, KAT_ZEICHEN, SUDDEN_DEATH_AB, zeitFinale } from './regeln.js';
import { Ton } from './ton.js';
import {
  esc, spielfeldZeigen, status, herzen, zeitbalken, countdown, feedback, zeigeHinweis, aufloesung, aufloesungsListe,
  soloAnzeige, toast, wachHalten, richtigText,
} from './ui.js';

const $ = s => document.querySelector(s);
const panel = $('#panel'), netdot = $('#netdot');

const params = new URLSearchParams(location.search);
let code = (params.get('c') || params.get('code') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
let pid = store('normwerte.pid');
if (!pid || !/^[a-z0-9]{8,24}$/.test(pid)) { pid = randomId(16); store('normwerte.pid', pid); }

let net = null, you = null, shown = '';
let Q = null;   // laufendes Qualifying { nr, items, spiel, ende, endeAt }
let F = null;   // Finale { nr, round, offen, tipp, plan, timers, raf, gezeigt, podiumWarte }

// Handys bleiben immer stumm (kein Ton im Klassenzimmer). Ton gibt es nur im Finale vom Beamer-Laptop.
Ton.an = false;

const antwort = erstelleAntwort({
  knoepfe: $('#antworten'), flaeche: $('#wertfeld'), ziel: $('#wertkarte'),
  onAntwort: a => { if (Q && Q.spiel) Q.spiel.antwort(a); else if (F) finalAntwort(a); },
});

// ---------------------------------------------------------------- Verbindung
const serverNow = () => net ? net.serverNow() : Date.now();
function connect() {
  net = KNet({
    code, params: { role: 'player', pid },
    onMessage,
    onStatus: s => {
      netdot.dataset.s = s;
      if (s === 'offline' && net.stopped) {
        if (net.stopped === 'no-room') show('noroom', `<div class="card"><h2>Raum nicht gefunden</h2><p>Zum Code <b>${esc(code)}</b> gibt es gerade kein Spiel. Ist die Lehrer-Seite am Beamer geöffnet? Scanne den QR-Code noch einmal.</p><button class="big-btn" id="btnRetry">Nochmal versuchen</button></div>`, () => { $('#btnRetry').onclick = () => location.reload(); });
        else if (net.stopped === 'ended') spielEnde();
      }
    },
  });
  net.open();
}
function send(obj) { if (net) net.send(obj, true); }
function spielEnde() {
  you = null; stopQuali(); stopFinal(); wachHalten(false);
  show('ended', '<div class="card"><h2>Das Spiel ist beendet</h2><p>Die Lehrkraft hat die Sitzung geschlossen. Danke fürs Mitspielen!</p><p><a class="mehr" href="./">Allein weiterüben</a></p></div>');
}

function onMessage(m) {
  // Uhrabgleich, falls die genaue Messung noch fehlt
  if (typeof m.now === 'number' && net.rtt > 5000) net.offset = m.now - Date.now();
  switch (m.t) {
    case 'you': you = m; update(); break;
    case 'ended': spielEnde(); break;
    case 'kicked': you = null; stopQuali(); stopFinal(); store('normwerte.name', null); show('kicked', '<div class="card"><h2>Abgemeldet</h2><p>Die Lehrkraft hat deinen Namen entfernt. Du kannst dich mit einem anderen Namen neu anmelden.</p><button class="big-btn" id="btnAgain">Neu anmelden</button></div>', () => { $('#btnAgain').onclick = () => location.reload(); }); break;
    case 'error':
      if (m.why === 'bad-name') { const e = $('#joinErr'); if (e) { e.textContent = 'Bitte einen Vornamen (nur Buchstaben) und den ersten Buchstaben des Nachnamens eingeben.'; e.hidden = false; } }
      else if (m.why === 'full') toast('Das Spiel ist voll (60 Personen).');
      break;
  }
}

// ---------------------------------------------------------------- Anzeige
function show(key, html, after) {
  spielfeldZeigen(false);
  if (shown === key) return;
  shown = key;
  panel.innerHTML = html;
  after && after();
  window.scrollTo(0, 0);
}

function update() {
  if (!you) return;
  const me = you.me;
  if (!me) { stopQuali(); stopFinal(); return joinForm(); }
  switch (you.phase) {
    case 'lobby': stopQuali(); stopFinal(); wachHalten(false); return show('lobby:' + me.name, waitCard(me.name), wireLeave);
    case 'quali': stopFinal(); return quali();
    case 'final-setup': stopQuali(); stopFinal(); wachHalten(false); return afterQuali();
    case 'final': case 'podium': stopQuali(); return final();
  }
}

function waitCard(name) {
  return `<div class="card"><p class="eyebrow">Hallo ${esc(name)}!</p><h2>Gleich geht’s los</h2>
    <p>Warte, bis die Lehrkraft das Qualifying startet. Du spielst es allein auf deinem Handy.</p><div class="waitdots"><i></i><i></i><i></i></div>
    <p class="hint">Du siehst Messwerte wie auf Station: am Monitor, am Blutdruckgerät oder im Laborbefund. Entscheide jedes Mal: <b>zu niedrig</b>, <b>normal</b> oder <b>zu hoch</b>? Tippe auf einen Knopf oder wische über das Gerät. Nach ${LEBEN_QUALI} Fehlern ist Schluss.</p>
    <div class="wischdemo" aria-hidden="true"><span>◀ zu niedrig</span><span>▲ normal</span><span>zu hoch ▶</span></div>
    <button class="ghost-btn" id="btnLeave">Nicht ${esc(name)}? Namen ändern</button></div>`;
}
function wireLeave() { const b = $('#btnLeave'); if (b) b.onclick = () => { store('normwerte.name', null); send({ t: 'leave' }); shown = ''; }; }

function joinForm() {
  if (shown === 'join') return;
  const last = store('normwerte.name') || {};
  show('join', `<div class="card">
    <h2>Mitspielen</h2>
    <p>Gib deinen Vornamen und den ersten Buchstaben deines Nachnamens ein. Der Name erscheint am Beamer.</p>
    <form id="joinForm" class="settings" autocomplete="off">
      <div class="row">
        <div class="field grow"><label for="fFirst">Vorname</label><input id="fFirst" maxlength="16" required value="${esc(last.first || '')}" autocapitalize="words" enterkeyhint="next"></div>
        <div class="field initial"><label for="fInit">Nachname</label><input id="fInit" maxlength="1" required value="${esc(last.initial || '')}" autocapitalize="characters" enterkeyhint="go" aria-label="Erster Buchstabe des Nachnamens"></div>
      </div>
      <p class="err" id="joinErr" hidden></p>
      <button class="big-btn" type="submit">Mitspielen</button>
    </form></div>`, () => {
    const f = $('#fFirst'), i = $('#fInit');
    f.addEventListener('input', () => { if (/\s/.test(f.value)) { f.value = f.value.trim(); i.focus(); } });
    $('#joinForm').onsubmit = e => {
      e.preventDefault();
      const first = f.value.trim(), initial = i.value.trim();
      store('normwerte.name', { first, initial });
      send({ t: 'join', first, initial });
    };
  });
}

// ---------------------------------------------------------------- Qualifying
function quali() {
  const me = you.me, qi = you.quali;
  if (!qi) return;
  const laeuft = Q && Q.nr === qi.nr && !Q.ende;
  if (me.q && me.q.done && !laeuft) return qualiErgebnis();
  if (Q && Q.nr === qi.nr) { if (Q.ende) qualiErgebnis(); return; }
  // Neues Spiel aufbauen (auch nach Neuladen: weiter mit dem nächsten Wert)
  stopQuali();
  const items = aufgaben(qi.seed, qi.ids, qi.stufe, QUALI_WERTE);
  const stand = me.q ? { n: me.q.n, r: me.q.r, f: me.q.f, ms: me.q.ms } : null;
  Q = { nr: qi.nr, items, ende: null };
  const spiel = Q.spiel = new SoloSpiel({
    items, antwort, stand, ...soloAnzeige(antwort),
    onStand: (st, x) => send({ t: 'q', nr: qi.nr, n: st.n, r: st.r, f: st.f, ms: st.ms, x }),
    onEnde: r => { if (!Q || Q.spiel !== spiel) return; Q.ende = r; shown = ''; qualiErgebnis(); },
  });
  feedback(null);
  spielfeldZeigen(true);
  shown = 'quali-play';
  status('Qualifying', 'Gleich geht’s los', 'frage');
  herzen(LEBEN_QUALI - (stand ? stand.f : 0), LEBEN_QUALI);
  zeitbalken(null);
  zeigeHinweis('<div class="gross">Gleich geht’s los!</div><p>Zu niedrig, normal oder zu hoch?</p>');
  wachHalten(true);
  // Gemeinsamer Start: Countdown bis zur Startzeit, Nachzügler bekommen 3 Sekunden
  const bis = Math.max(qi.startAt - serverNow(), stand && stand.n > 0 ? 1500 : 3000);
  const ende = performance.now() + bis;
  const cd = () => {
    if (!Q || Q.spiel !== spiel) { countdown(null); return; }
    const rest = ende - performance.now();
    if (rest <= 0) { countdown(null); return; }
    const sec = Math.ceil(rest / 1000);
    countdown(sec <= 3 ? sec : '…', sec <= 3 ? 'Los geht’s!' : 'Gleich geht’s los');
    Q.cdT = setTimeout(cd, Math.min(250, rest));
  };
  cd();
  spiel.start(bis);
}

function stopQuali() {
  if (!Q) return;
  clearTimeout(Q.cdT);
  countdown(null);
  if (Q.spiel) Q.spiel.stop();
  feedback(null);
  Q = null;
}

function qualiErgebnis() {
  const me = you.me, qi = you.quali;
  const lokal = Q && Q.ende;
  const q = me.q || { n: 0, r: 0, f: 0, falsch: [] };
  const r = lokal ? lokal.r : q.r, n = lokal ? lokal.n : q.n;
  const why = lokal ? lokal.why : q.why;
  const items = Q ? Q.items : qi ? aufgaben(qi.seed, qi.ids, qi.stufe, QUALI_WERTE) : [];
  const falsch = (q.falsch || []).length >= (lokal ? lokal.fehler.length : 0) ? (q.falsch || []) : lokal.fehler;
  const offen = qi && qi.open;
  const key = 'qres:' + r + ':' + me.rank + ':' + me.of + ':' + offen + ':' + falsch.length;
  if (shown === key) return;
  wachHalten(false);
  const titel = why === 'fertig' ? `Alle ${QUALI_WERTE} Werte geschafft! 🎉` : why === 'ende' ? 'Qualifying beendet' : `${LEBEN_QUALI} Fehler – Schluss!`;
  const rank = me.rank > 0 ? `<div class="placebox">Platz ${me.rank} von ${me.of}${offen ? '<br><small>vorläufig – andere spielen vielleicht noch</small>' : ''}</div>` : '';
  show(key, `<div class="card ${why === 'fertig' ? 'good' : 'bad'}">
      <p class="eyebrow">Qualifying</p>
      <h2>${titel}</h2>
      <div class="bigstat"><b>${r}</b><span>von ${n} richtig</span></div>
      ${rank}
    </div>
    ${falsch.length ? `<div class="card"><h3>Das solltest du dir noch einmal ansehen:</h3>${aufloesungsListe(falsch.filter(([i]) => items[i]).map(([i, a]) => [items[i], a]))}</div>` : ''}
    <div class="card"><p>Die Besten kommen ins Finale am Beamer. Lass diese Seite offen. Im Finale kannst du auf dem Handy mitraten.</p></div>`);
}

function afterQuali() {
  const me = you.me, chosen = you.final && you.final.chosen;
  const r = me.q ? me.q.r : 0;
  show('after:' + r + ':' + me.rank + ':' + chosen, `<div class="card ${chosen ? 'good' : ''}">
      <p class="eyebrow">Qualifying beendet</p>
      <h2>${chosen ? 'Du bist im Finale! 🎉' : 'Gleich kommt das Finale'}</h2>
      <div class="bigstat"><b>${r}</b><span>richtig · Platz ${me.rank || '–'} von ${me.of}</span></div>
      <p>${chosen ? 'Lass diese Seite offen. Im Finale erscheint der Wert nur am Beamer. Du antwortest hier auf dem Handy.' : 'Das Finale läuft am Beamer. Du kannst hier auf dem Handy mitraten. Das zählt nicht fürs Finale, aber du siehst, wie viele du richtig hast.'}</p>
    </div>`);
}

// ---------------------------------------------------------------- Finale (Finalisten und Mitraten)
function stopFinal() {
  if (!F) return;
  F.timers.forEach(clearTimeout);
  cancelAnimationFrame(F.raf);
  countdown(null);
  feedback(null);
  antwort.eingabe(false);
  F = null;
}
const later = (fn, at) => F.timers.push(setTimeout(fn, Math.max(0, at - serverNow())));

function final() {
  const f = you.final;
  if (!f || f.state === 'setup') return;
  if (!F || F.nr !== f.nr) { stopFinal(); F = { nr: f.nr, round: 0, offen: false, tipp: null, timers: [], raf: 0, gezeigt: 0, podiumWarte: false }; }
  if (you.phase === 'podium') {
    if (F.podiumWarte) return;
    // Erst das Ergebnis des letzten Werts zeigen, dann die Siegerehrung
    if (f.last && F.gezeigt !== f.last.round && shown === 'final-play') {
      F.gezeigt = f.last.round; F.podiumWarte = true;
      F.timers.forEach(clearTimeout); F.timers = [];
      cancelAnimationFrame(F.raf); F.offen = false; antwort.eingabe(false); zeitbalken(null);
      kopf(f); letzterWert(f);
      F.timers.push(setTimeout(() => { if (F) F.podiumWarte = false; if (you && you.phase === 'podium') { shown = ''; finalEnde(you.final); } }, 4000));
      return;
    }
    return finalEnde(f);
  }
  wachHalten(true);
  spielfeldZeigen(true);
  shown = 'final-play';
  if (f.last && F.gezeigt !== f.last.round) { F.gezeigt = f.last.round; F.offen = false; antwort.eingabe(false); letzterWert(f); }
  if (F.round !== f.round && f.state === 'run') neueRunde(f);
  kopf(f);
}

// Statuszeile: Wert, Leben bzw. Mitraten-Punkte
function kopf(f) {
  const me = f.me, sd = f.round >= SUDDEN_DEATH_AB;
  const klein = sd ? 'Sudden Death' : f.slot >= 0 && me && me.alive ? 'Finale' : 'Mitraten';
  const text = F && F.offen ? 'Schau zum Beamer!' : F && F.tipp ? 'Antwort abgegeben' : '';
  status(`Wert ${f.round}<small>${klein}</small>`, text, F && F.offen ? 'beamer' : 'frage');
  if (f.slot >= 0 && me && me.alive) herzen(me.leben, f.leben);
  else { const z = you.me && you.me.z; $('#sLeben').innerHTML = `<span class="mitraten">${z ? z.r + '/' + z.n : '0/0'} ✓</span>`; }
}

function neueRunde(f) {
  F.timers.forEach(clearTimeout); F.timers = [];
  cancelAnimationFrame(F.raf);
  F.round = f.round; F.offen = false; F.tipp = f.tipp || null;
  F.plan = { startAt: f.startAt, deadline: f.deadline };
  antwort.eingabe(false);
  zeitbalken(null);
  if (serverNow() < f.startAt) {
    if (f.first) {
      feedback(null);
      zeigeHinweis(`<div class="gross">Gleich geht’s los!</div><p>Der Wert erscheint <b>am Beamer</b>. Du antwortest hier.</p>`);
      for (let s = 3; s >= 1; s--) later(() => countdown(s, 'Schau zum Beamer!'), f.startAt - s * 1000);
    }
  }
  later(() => {
    countdown(null);
    if (!F || F.round !== f.round) return;
    if (F.tipp) { feedback(null); zeigeGetippt(F.tipp); kopf(you.final); return; }
    eingabeAuf();
  }, f.startAt);
  later(() => {
    if (!F || F.round !== f.round || !F.offen) return;
    F.offen = false; antwort.eingabe(false); zeitbalken(null);
    zeigeHinweis('<div class="gross">⏱ Zeit um!</div><p>Schau zum Beamer: Gleich kommt die Auflösung.</p>');
    kopf(you.final);
  }, f.deadline);
}

function eingabeAuf() {
  if (!F || F.tipp) return;
  feedback(null);
  const meinFinale = you.final && you.final.slot >= 0 && you.final.me && you.final.me.alive;
  zeigeHinweis(`<div class="gross">👀 Schau zum Beamer!</div><p>Ist der Wert <b>zu niedrig</b>, <b>normal</b> oder <b>zu hoch</b>?</p>${meinFinale ? '' : '<p class="hint">Mitraten: zählt nicht fürs Finale.</p>'}`);
  antwort.eingabe(true);
  F.offen = true;
  kopf(you.final);
  if (navigator.vibrate) try { navigator.vibrate(40); } catch (e) {}
  const limit = zeitFinale(F.round);
  const tick = () => {
    if (!F || !F.offen) return;
    const rest = F.plan.deadline - serverNow();
    zeitbalken(Math.max(0, rest), limit);
    if (rest > 0) F.raf = requestAnimationFrame(tick);
  };
  F.raf = requestAnimationFrame(tick);
}

function finalAntwort(a) {
  if (!F || !F.offen) return;
  F.offen = false; F.tipp = a;
  cancelAnimationFrame(F.raf);
  zeitbalken(null);
  send({ t: 'fa', nr: F.nr, r: F.round, a, ms: Math.max(0, Math.round(serverNow() - F.plan.startAt)) });
  zeigeGetippt(a);
  kopf(you.final);
}
function zeigeGetippt(a) {
  antwort.markiere(a, 'gewaehlt');
  zeigeHinweis(`<div class="meins">Deine Antwort: ${KAT_ZEICHEN[a]} ${KAT_TEXT[a]}</div><p>Schau zum Beamer: Gleich kommt die Auflösung.</p>`);
}

// Ergebnis des letzten Werts (bleibt stehen, bis der nächste Wert kommt)
function letzterWert(f) {
  const L = f.last, mein = f.meinLetzter, me = f.me;
  const finalist = f.slot >= 0 && L.ant[f.slot];
  antwort.aufloesen(L.item.kat, mein ? mein.a : null);
  let kopfzeile, art;
  if (!mein) { kopfzeile = finalist ? '⏱ Keine Antwort' : 'Nicht mitgeraten'; art = finalist ? 'bad' : 'info'; }
  else if (mein.ok) { kopfzeile = '✓ Richtig!'; art = 'gut'; }
  else { kopfzeile = '✗ Leider falsch'; art = 'bad'; }
  let extra = '';
  if (finalist && me) {
    if (!me.alive) extra = `<div class="placebox">Du bist raus: Platz ${me.place}</div><p class="hint">Rate trotzdem weiter mit!</p>`;
    else if (!mein || !mein.ok) extra = `<p class="hint">Ein Leben weniger. Noch ${me.leben === 1 ? '1 Leben' : me.leben + ' Leben'}.</p>`;
  } else if (you.me && you.me.z) extra = `<p class="hint">Mitraten: ${you.me.z.r} von ${you.me.z.n} richtig</p>`;
  feedback(`<div class="fb-lang"><h3>${kopfzeile}</h3>${aufloesung(L.item, mein ? mein.a : finalist ? 'zeit' : undefined)}${extra}</div>`, art);
}

function finalEnde(f) {
  stopFinal();
  wachHalten(false);
  const places = f.names.map((n, i) => ({ n, p: f.st[i].place, r: f.st[i].r })).sort((a, b) => a.p - b.p);
  const me = f.slot >= 0 ? f.me : null;
  const win = me && me.place === 1;
  const z = you.me && you.me.z;
  show('podium:' + f.nr + ':' + (z ? z.r + '/' + z.n : ''), `<div class="card ${win ? 'good' : ''}">
      <p class="eyebrow">Finale${f.revanche ? ' · Revanche' : ''}</p>
      <h2>${win ? '🏆 Du hast gewonnen!' : me ? `Platz ${me.place} 🎉` : `🏆 ${esc(places[0] ? places[0].n : '')} gewinnt!`}</h2>
      ${me ? `<div class="bigstat"><b>${me.r}</b><span>richtig im Finale</span></div>` : ''}
      <ol class="aufl-liste" style="list-style:none;padding:0;margin:0">${places.map(x => `<li class="punkte"><span><b>${x.p}.</b> ${esc(x.n)}</span><span>${richtigText(x.r)}</span></li>`).join('')}</ol>
      ${z ? `<p>Beim Mitraten hattest du <b>${z.r} von ${z.n}</b> richtig.</p>` : ''}
    </div>
    ${f.verlauf ? `<div class="card"><h3>Alle Werte aus dem Finale zum Nachlesen</h3>${aufloesungsListe(f.verlauf.map(it => [it, undefined]))}</div>` : ''}`);
}

// ---------------------------------------------------------------- Start
if (!code) {
  show('nocode', `<div class="card"><h2>Code eingeben</h2><p>Scanne den QR-Code am Beamer oder gib den Code ein, der dort oben rechts steht.</p>
    <form id="codeForm" class="settings"><div class="field"><label for="fCode">Code</label><input id="fCode" maxlength="5" autocapitalize="characters" required></div><button class="big-btn">Weiter</button></form></div>`, () => {
    $('#codeForm').onsubmit = e => { e.preventDefault(); const c = $('#fCode').value.toUpperCase().replace(/[^A-Z0-9]/g, ''); if (c.length === 5) location.search = '?c=' + c; };
  });
} else {
  connect();
}
