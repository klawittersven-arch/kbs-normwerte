// Beamer-Seite der Lehrkraft: Lobby mit QR-Code, Live-Rangliste im Qualifying, Finale mit Ton, Siegerehrung
import { KNet, randomCode, randomId, store } from './net.js';
import {
  WERTE, GRUPPEN, STUFEN, STUFE_TEXT, FINAL_GROESSEN, LEBEN_WAHL, LEBEN_QUALI, QUALI_WERTE, SUDDEN_DEATH_AB,
  KAT_TEXT, KAT_ZEICHEN, INHALT_FEHLER, GNADE, zeitFinale, wert, alleIds, standardIds,
} from './regeln.js';
import { Ton } from './ton.js';
import { esc, herzenHTML, zeigeWert, zeitbalken, aufloesung, richtigText } from './ui.js';

const $ = s => document.querySelector(s);
const view = $('#view'), netdot = $('#netdot'), codeChip = $('#codeChip'), toastEl = $('#toast');

let sess = store('normwerte.lehrer');
let net = null, room = null, screen = '';
// Gespeicherte Einstellungen des Beamers. Voreinstellung: nur Vitalzeichen (Laborwerte abgewählt).
// Ältere gespeicherte Auswahl (vor Version 2: alle Werte an) wird einmal auf die Voreinstellung zurückgesetzt.
const gespeichert = store('normwerte.lehrer.cfg') || {};
if (gespeichert.v !== 2) delete gespeichert.ids;
let cfg = Object.assign({ ids: standardIds(), stufe: 'deutlich', finalN: 4, leben: 3 }, gespeichert, { v: 2 });
cfg.ids = Array.isArray(cfg.ids) ? alleIds().filter(id => cfg.ids.includes(id)) : standardIds();
if (!cfg.ids.length) cfg.ids = standardIds();
if (!STUFEN.includes(cfg.stufe)) cfg.stufe = 'deutlich';
if (!FINAL_GROESSEN.includes(cfg.finalN)) cfg.finalN = 4;
if (!LEBEN_WAHL.includes(cfg.leben)) cfg.leben = 3;
let quitArmed = 0;
const bekannt = new Set(); // Namen in der Lobby, die schon angezeigt wurden
const serverNow = () => net ? net.serverNow() : Date.now();

// ---------------------------------------------------------------- Ton & Werkzeuge
Ton.an = store('normwerte.ton.beamer') !== false;
const btnTon = $('#btnTon');
function tonText() { btnTon.textContent = Ton.an ? 'Ton: an' : 'Ton: aus'; btnTon.setAttribute('aria-pressed', String(Ton.an)); }
tonText();
btnTon.onclick = () => { Ton.init(); Ton.an = !Ton.an; if (!Ton.an) Ton.stopPuls(); store('normwerte.ton.beamer', Ton.an); tonText(); };
document.addEventListener('pointerdown', () => Ton.init(), { capture: true });
document.addEventListener('keydown', () => Ton.init(), { capture: true });
$('#btnFull').onclick = vollbild;
function vollbild() {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  else document.documentElement.requestFullscreen().catch(() => {});
}
$('#btnSess').onclick = () => { $('#dlgCode').textContent = sess.code; $('#dlg').hidden = false; };
$('#btnDlgClose').onclick = () => { $('#dlg').hidden = true; };
$('#btnNewSess').onclick = () => { $('#dlg').hidden = true; newSession(); };
$('#btnWipe').onclick = () => { $('#dlg').hidden = true; send({ t: 'wipe' }); setTimeout(newSession, 600); };

let toastT = 0;
function toast(t) { toastEl.textContent = t; toastEl.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { toastEl.hidden = true; }, 4500); }

// ---------------------------------------------------------------- Verbindung
function newSession() {
  sess = { code: randomCode(5), key: randomId(24) };
  store('normwerte.lehrer', sess);
  room = null; screen = '';
  connect();
}
function connect() {
  if (net) net.close();
  codeChip.hidden = false; codeChip.textContent = 'Code ' + sess.code;
  net = KNet({
    code: sess.code, params: { role: 'teacher', key: sess.key },
    onMessage,
    onStatus: s => { netdot.dataset.s = s; if (s === 'offline' && net.stopped === 'code-taken') newSession(); },
  });
  net.open();
}
function onMessage(m) {
  if (typeof m.now === 'number' && net.rtt > 5000) net.offset = m.now - Date.now();
  switch (m.t) {
    case 'room': room = m; render(); break;
    case 'fp': if (FB && m.nr === FB.nr && m.r === FB.round) { FB.dran.add(m.slot); if (room && room.final) { karten(room.final); alleDa(room.final); } } break;
    case 'zp': if (FB && m.nr === FB.nr && m.r === FB.round) { FB.zCount = m.n; publikum(room.final); } break;
    case 'error':
      if (m.why === 'code-taken') newSession();
      else if (m.why === 'final-offline') toast('Alle Finalisten-Handys müssen verbunden sein. Wer nicht verbunden ist, öffnet die Seite neu oder scannt den QR-Code noch einmal.');
      else if (m.why === 'final-players') toast('Bitte mindestens zwei verschiedene Personen für das Finale auswählen.');
      else if (m.why === 'no-players') toast('Es hat sich noch niemand angemeldet.');
      else if (m.why === 'kick-finalist') toast('Finalisten können während des Finales nicht entfernt werden.');
      break;
    case 'ended': room = null; screen = ''; break;
  }
}
function send(obj) { if (net && !net.send(obj, true)) toast('Keine Verbindung zum Server. Der Befehl wird gesendet, sobald die Verbindung wieder steht.'); }

function joinUrl() { return location.origin + '/mitspielen?c=' + sess.code; }
function drawQR(canvas, text) {
  const qr = window.qrcode(0, 'M'); qr.addData(text); qr.make();
  const n = qr.getModuleCount(), q = 2, s = Math.max(4, Math.floor(512 / (n + 2 * q)));
  canvas.width = canvas.height = (n + 2 * q) * s;
  const g = canvas.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = '#0d1030';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) g.fillRect((c + q) * s, (r + q) * s, s, s);
}

// ---------------------------------------------------------------- Einstellungen
function seg(name, options, value, onPick) {
  const w = document.createElement('div');
  w.className = 'seg'; w.setAttribute('role', 'radiogroup'); w.setAttribute('aria-label', name);
  for (const [val, label] of options) {
    const b = document.createElement('button');
    b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(val === value)); b.textContent = label;
    b.onclick = () => { w.querySelectorAll('button').forEach(x => x.setAttribute('aria-checked', String(x === b))); onPick(val); };
    w.appendChild(b);
  }
  return w;
}
function setCfg(part) {
  const altN = cfg.finalN;
  Object.assign(cfg, part);
  store('normwerte.lehrer.cfg', cfg);
  send({ t: 'cfg', cfg });
  // Größe des Finales geändert → Auswahl der Finalisten anpassen
  if (room && room.phase === 'final-setup' && cfg.finalN !== altN) {
    const cur = (room.final && room.final.p) || [];
    const r = room.players.filter(p => p.rank > 0).sort((a, b) => a.rank - b.rank).map(p => p.pid);
    const next = cur.slice(0, cfg.finalN);
    for (const pid of r) if (next.length < cfg.finalN && !next.includes(pid)) next.push(pid);
    send({ t: 'final-pick', p: next });
  }
}
const gruppeIds = g => WERTE.filter(p => g === 'alle' || p.gruppe === g).map(p => p.id);
function werteWahl() {
  const set = new Set(cfg.ids);
  for (const g of ['vital', 'labor', 'alle']) { const ids = gruppeIds(g); if (ids.length === set.size && ids.every(id => set.has(id))) return g; }
  return '';
}
function werteKurz(ids) {
  const w = (ids || []).map(id => wert(id)).filter(Boolean);
  if (w.length === WERTE.length) return 'alle Werte';
  return w.map(p => p.kurz).join(', ');
}
function optionen(el, mitFinale) {
  el.innerHTML = '';
  const add = (lbl, node, desc, id) => {
    const l = document.createElement('div'); l.className = 'lbl'; l.textContent = lbl;
    el.append(l, node);
    if (desc) { const d = document.createElement('div'); d.className = 'desc'; if (id) d.id = id; d.textContent = desc; el.appendChild(d); }
  };
  add('Werte', seg('Werte', [['vital', GRUPPEN.vital], ['labor', GRUPPEN.labor], ['alle', 'Beides']], werteWahl(), g => { setCfg({ ids: gruppeIds(g) }); chips(); }));
  const chipBox = document.createElement('div'); chipBox.className = 'wchips'; chipBox.id = 'wchips';
  el.appendChild(chipBox);
  function chips() {
    chipBox.innerHTML = '';
    for (const [g, name] of Object.entries(GRUPPEN)) {
      const l = document.createElement('span'); l.className = 'glbl'; l.textContent = name + ':'; chipBox.appendChild(l);
      for (const p of WERTE.filter(x => x.gruppe === g)) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'wchip'; b.textContent = p.kurz; b.title = p.name;
        b.setAttribute('aria-pressed', String(cfg.ids.includes(p.id)));
        b.onclick = () => {
          const on = cfg.ids.includes(p.id);
          if (on && cfg.ids.length === 1) return toast('Mindestens ein Wert muss ausgewählt sein.');
          setCfg({ ids: alleIds().filter(id => id === p.id ? !on : cfg.ids.includes(id)) });
          chips();
          el.querySelectorAll('.seg[aria-label="Werte"] button').forEach((x, i) => x.setAttribute('aria-checked', String(['vital', 'labor', 'alle'][i] === werteWahl())));
        };
        chipBox.appendChild(b);
      }
    }
  }
  chips();
  add('Stufe', seg('Stufe', STUFEN.map(s => [s, STUFE_TEXT[s].name]), cfg.stufe, stufe => { setCfg({ stufe }); $('#desc-stufe').textContent = STUFE_TEXT[stufe].kurz; }), STUFE_TEXT[cfg.stufe].kurz, 'desc-stufe');
  if (mitFinale) {
    add('Finale', seg('Größe des Finales', FINAL_GROESSEN.map(n => [n, n + ' Personen']), cfg.finalN, finalN => setCfg({ finalN })));
    add('Leben', seg('Leben im Finale', LEBEN_WAHL.map(n => [n, n === 1 ? '1 Leben' : n + ' Leben']), cfg.leben, leben => setCfg({ leben })), `im Finale. Ab Wert ${SUDDEN_DEATH_AB} kostet jeder Fehler alle Leben.`);
  }
}
function bigCount(num, text) {
  let el = $('#bigcount');
  if (num == null) { if (el) el.remove(); return; }
  if (!el) { el = document.createElement('div'); el.id = 'bigcount'; el.className = 'bigcount'; document.body.appendChild(el); }
  el.innerHTML = `<div><b>${num}</b><span>${esc(text || '')}</span></div>`;
}
function inhaltWarnung() {
  if (!INHALT_FEHLER.length) return '';
  return `<div class="tcard warnbox"><h2>Achtung: In normwerte.js stimmt etwas nicht</h2><p class="hint">Diese Einträge sind im Spiel ausgeblendet, bis sie korrigiert sind:</p>
    <ul>${INHALT_FEHLER.map(f => `<li><b>${esc(f.name)}</b> (Eintrag ${f.nr}): ${esc(f.probleme.join('; '))}</li>`).join('')}</ul></div>`;
}

// ---------------------------------------------------------------- Bildschirme
function render() {
  if (!room) return;
  if (room.phase !== 'final' && room.phase !== 'podium') stopFinal();
  switch (room.phase) {
    case 'lobby': return lobby();
    case 'quali': return quali();
    case 'final-setup': return setup();
    case 'final': return final();
    case 'podium': return podium();
  }
}

function lobby() {
  if (screen !== 'lobby') {
    screen = 'lobby';
    view.innerHTML = `<div class="tpage">${inhaltWarnung()}<div class="lobby">
      <div class="tcard joinbox">
        <h2>Mitspielen!</h2>
        <canvas id="qr" class="qr" role="img" aria-label="QR-Code zum Mitspielen"></canvas>
        <div class="joinurl">${esc(location.host)}/mitspielen</div>
        <div>Code: <span class="joincode">${esc(sess.code)}</span></div>
      </div>
      <div class="lobbyright">
        <div class="tcard" style="flex:1;min-height:0">
          <div class="thead"><h2 id="nameCount">Angemeldet</h2></div>
          <div class="names" id="names"></div>
        </div>
        <div class="tcard"><div class="optgrid" id="opts"></div></div>
        <div class="tactions">
          <p class="hint grow">Erst spielen alle allein auf dem Handy (${LEBEN_QUALI} Leben, bis zu ${QUALI_WERTE} Werte). Die Besten kommen ins Finale am Beamer.</p>
          <button class="big-btn" id="btnStart">Qualifying starten <span class="kbd">Enter</span></button>
        </div>
      </div>
    </div></div>`;
    drawQR($('#qr'), joinUrl());
    optionen($('#opts'), true);
    $('#btnStart').onclick = startQuali;
  }
  const ps = room.players;
  $('#nameCount').textContent = ps.length ? `Angemeldet: ${ps.length}` : 'Angemeldet';
  $('#names').innerHTML = ps.length ? ps.map(p => `<span class="name ${p.online ? '' : 'off'} ${bekannt.has(p.pid) ? '' : 'neu'}">${esc(p.name)}<button class="x" data-pid="${esc(p.pid)}" title="${esc(p.name)} entfernen" aria-label="${esc(p.name)} entfernen">×</button></span>`).join('')
    : '<p class="empty">Noch niemand da. Scannt den QR-Code und gebt euren Namen ein.</p>';
  ps.forEach(p => bekannt.add(p.pid));
  $('#names').querySelectorAll('.x').forEach(b => { b.onclick = () => send({ t: 'kick', pid: b.dataset.pid }); });
  $('#btnStart').disabled = !ps.length;
}
function startQuali() {
  Ton.init();
  if (!room || !room.players.length) return toast('Es hat sich noch niemand angemeldet.');
  send({ t: 'quali-start', cfg });
}

let qualiCdT = 0;
function quali() {
  const Q = room.quali;
  if (screen !== 'quali:' + Q.nr) {
    screen = 'quali:' + Q.nr;
    view.innerHTML = `<div class="tpage">
      <div class="qhead">
        <div class="tcard"><div class="thead"><div><h2>Qualifying</h2><p>Alle spielen allein auf dem Handy · ${LEBEN_QUALI} Leben · bis zu ${QUALI_WERTE} Werte · Stufe „${esc(STUFE_TEXT[Q.stufe].name)}“</p></div></div>
          <p>Werte: ${esc(werteKurz(Q.ids))}</p></div>
        <div class="tcard qside"><div class="counter" id="qCount"></div><canvas id="qrSmall" class="qr small" role="img" aria-label="QR-Code für Nachzügler"></canvas></div>
      </div>
      <div class="ranks" id="ranks"></div>
      <div class="tactions"><p class="hint grow" id="qHint"></p>
        <button class="ghost-btn" id="btnBack">Zurück zur Anmeldung</button>
        <button class="big-btn" id="btnEnd">Qualifying beenden <span class="kbd">Enter</span></button></div>
    </div>`;
    drawQR($('#qrSmall'), joinUrl());
    $('#btnEnd').onclick = endQuali;
    $('#btnBack').onclick = () => { if (confirm('Zurück zur Anmeldung? Die Ergebnisse dieses Qualifyings werden gelöscht.')) send({ t: 'to-lobby' }); };
    clearTimeout(qualiCdT);
    const cd = () => {
      const rest = Q.startAt - serverNow();
      if (rest <= 0 || screen !== 'quali:' + Q.nr) { bigCount(null); return; }
      const s = Math.ceil(rest / 1000);
      bigCount(s <= 3 ? s : '…', 'Alle schauen aufs eigene Handy!');
      qualiCdT = setTimeout(cd, 100);
    };
    cd();
  }
  const ps = room.players;
  const ranked = ps.filter(p => p.q).sort((a, b) => a.rank - b.rank);
  const rest = ps.filter(p => !p.q);
  const done = ps.filter(p => p.q && p.q.done).length;
  $('#qCount').innerHTML = `${done}/${ps.length}<small>fertig</small>`;
  const N = cfg.finalN;
  const row = (p, place) => {
    const q = p.q;
    let st;
    if (!q) st = '<span class="stt live">startet …</span>';
    else if (!q.done) st = `<span class="stt live">Wert ${Math.min(q.n + 1, QUALI_WERTE)}</span>`;
    else if (q.why === 'fertig') st = '<span class="stt fertig">alle geschafft</span>';
    else if (q.why === 'ende') st = '<span class="stt out">beendet</span>';
    else st = '<span class="stt out">raus</span>';
    const h = `<span class="herzen">${herzenHTML(LEBEN_QUALI - (q ? q.f : 0), LEBEN_QUALI)}</span>`;
    return `<div class="rk ${place && place <= N ? 'fin' : ''} ${p.online ? '' : 'off'}"><span class="p">${place ? place + '.' : ''}</span><span class="nm">${esc(p.name)}</span>${st}${h}<span class="lv">${q ? q.r : 0}</span></div>`;
  };
  $('#ranks').innerHTML = ranked.map(p => row(p, p.rank)).join('') + rest.map(p => row(p, 0)).join('');
  const all = done === ps.length && ps.length > 0;
  $('#btnEnd').classList.toggle('pulse', all);
  $('#qHint').textContent = all ? 'Alle sind fertig! Weiter zum Finale.' : `Die Zahl rechts zeigt die richtigen Antworten. Bei Gleichstand zählen weniger Fehler, dann die Zeit. Die ersten ${N} kommen ins Finale.`;
  quitArmed = 0;
}
function endQuali() {
  const ps = room.players, open = ps.filter(p => !(p.q && p.q.done)).length;
  if (open && Date.now() - quitArmed > 4000) {
    quitArmed = Date.now();
    return toast(`${open} ${open === 1 ? 'spielt' : 'spielen'} noch. Nochmal drücken, um trotzdem zu beenden (der bisherige Stand zählt).`);
  }
  send({ t: 'quali-end' });
}

function setup() {
  const f = room.final || { p: [] };
  const ranked = room.players.filter(p => p.rank > 0).sort((a, b) => a.rank - b.rank);
  const others = room.players.filter(p => !(p.rank > 0));
  const all = ranked.concat(others);
  if (screen !== 'setup') {
    screen = 'setup';
    view.innerHTML = `<div class="tpage">
      <div class="thead"><div><h2>Finale</h2><p>Die Besten aus dem Qualifying sind ausgewählt. Der Wert erscheint nur am Beamer, geantwortet wird auf dem Handy. Alle anderen raten auf dem Handy mit.</p></div></div>
      <div class="tcard"><div class="slots" id="slots"></div></div>
      <div class="tcard"><div class="optgrid" id="opts"></div></div>
      <div class="ranks" id="ranks"></div>
      <div class="tactions"><button class="ghost-btn" id="btnLobby">Neues Spiel <span class="kbd">Esc</span></button><span class="grow"></span>
        <button class="big-btn" id="btnFinal">Finale starten <span class="kbd">Enter</span></button></div>
    </div>`;
    optionen($('#opts'), true);
    $('#btnLobby').onclick = toLobby;
    $('#btnFinal').onclick = startFinal;
  }
  const slots = $('#slots');
  const n = Math.min(cfg.finalN, Math.max(2, all.length));
  slots.innerHTML = '';
  for (let i = 0; i < n; i++) {
    const pid = f.p[i] || '';
    const pl = room.players.find(p => p.pid === pid);
    const d = document.createElement('div'); d.className = 'slot';
    d.innerHTML = `<h3>Finalist/in ${i + 1}</h3>`;
    const sel = document.createElement('select');
    sel.innerHTML = '<option value="">– niemand –</option>' + all.map(p => `<option value="${esc(p.pid)}" ${p.pid === pid ? 'selected' : ''}>${p.rank ? p.rank + '. ' : ''}${esc(p.name)}${p.q ? ' · ' + richtigText(p.q.r) : ''}</option>`).join('');
    sel.onchange = () => {
      const next = [];
      slots.querySelectorAll('select').forEach(s => { if (s.value && !next.includes(s.value)) next.push(s.value); });
      send({ t: 'final-pick', p: next });
    };
    d.appendChild(sel);
    const on = document.createElement('div');
    on.className = 'online ' + (pl ? (pl.online ? 'ja' : 'nein') : '');
    on.textContent = pl ? (pl.online ? '● Handy verbunden' : '● Handy nicht verbunden: Seite neu öffnen') : '';
    d.appendChild(on);
    slots.appendChild(d);
  }
  $('#ranks').innerHTML = ranked.map(p => `<div class="rk ${f.p.includes(p.pid) ? 'fin' : ''}"><span class="p">${p.rank}.</span><span class="nm">${esc(p.name)}</span><span></span><span class="herzen">${herzenHTML(LEBEN_QUALI - (p.q ? p.q.f : 0), LEBEN_QUALI)}</span><span class="lv">${p.q ? p.q.r : 0}</span></div>`).join('');
  $('#btnFinal').disabled = f.p.length < 2;
}
function startFinal() {
  Ton.init();
  const f = room.final || { p: [] };
  if (f.p.length < 2) return toast('Bitte mindestens zwei Personen für das Finale auswählen.');
  send({ t: 'final-start', p: f.p, cfg });
}
function toLobby() {
  if (!confirm('Neues Spiel starten? Alle bleiben angemeldet, die Ergebnisse werden gelöscht.')) return;
  send({ t: 'to-lobby' });
}

// ---------------------------------------------------------------- Finale
let FB = null; // { nr, round, timers, raf, lastShown, dran: Set, zCount, offen }
function stopFinal() {
  Ton.stopPuls();
  if (!FB) return;
  FB.timers.forEach(clearTimeout);
  clearTimeout(FB.alleT);
  cancelAnimationFrame(FB.raf);
  bigCount(null);
  FB = null;
}

function final() {
  const f = room.final;
  if (!FB || FB.nr !== f.nr || screen !== 'final:' + f.nr) {
    stopFinal();
    screen = 'final:' + f.nr;
    view.innerHTML = `<div class="tpage"><div class="final">
      <div class="fmain">
        <div class="fbar"><div class="runde" id="fRunde"></div><div class="hinweis" id="fText"></div></div>
        <div class="zeitbalken" id="fBarBox"><i id="fBar"></i></div>
        <div class="fwert"><div class="wertname" id="fName"></div><div class="geraet" id="fGeraet"><div class="leer">Gleich geht’s los …</div></div><div class="faufl" id="fAufl" hidden></div></div>
      </div>
      <div class="fside"><div id="fCards"></div><div class="publikum" id="fPub"></div>
        <div class="tactions" style="margin-top:auto"><button class="ghost-btn" id="btnAbort">Finale abbrechen</button></div></div>
    </div></div>`;
    FB = { nr: f.nr, round: 0, timers: [], raf: 0, lastShown: '', dran: new Set(), zCount: 0, offen: false };
    $('#btnAbort').onclick = () => { if (confirm('Finale abbrechen? Es geht zurück zur Auswahl der Finalisten.')) send({ t: 'final-abort' }); };
  }
  if (f.last && FB.lastShown !== f.nr + ':' + f.last.round) {
    FB.lastShown = f.nr + ':' + f.last.round;
    rundenErgebnis(f);
  }
  if (FB.round !== f.round && f.state === 'run') planeRunde(f);
  karten(f);
  publikum(f);
  alleDa(f);
}

// Alle Finalisten haben geantwortet: Das Publikum hat noch 2 Sekunden, dann wird aufgelöst
function alleDa(f) {
  if (!FB || !FB.offen || FB.alleT || f.state !== 'run' || f.round !== FB.round) return;
  if (!f.st.every((x, i) => !x.alive || x.a || FB.dran.has(i))) return;
  status(rundenKopf(f.round), 'Alle Finalisten haben geantwortet!', 'gut');
  const nr = f.nr, r = f.round;
  FB.alleT = setTimeout(() => send({ t: 'tick', nr, r, grund: 'alle' }), 2000);
}

function status(runde, text, cls) {
  $('#fRunde').innerHTML = runde;
  const t = $('#fText'); t.textContent = text; t.className = 'hinweis ' + (cls || '');
}
const rundenKopf = r => `Wert ${r}<small>${r >= SUDDEN_DEATH_AB ? 'Sudden Death: jeder Fehler zählt' : 'Finale'}</small>`;

function geraeteTon(item) {
  const p = wert(item.id); if (!p) return;
  if (p.anzeige === 'ekg') Ton.startPuls(item.w, 'monitor');
  else if (p.anzeige === 'spo2') Ton.startPuls(item.puls || 75, 'oxi');
  else if (p.anzeige === 'labor') Ton.drucker();
  else if (p.anzeige !== 'atmung') Ton.fertig();
}

function planeRunde(f) {
  FB.timers.forEach(clearTimeout); FB.timers = [];
  cancelAnimationFrame(FB.raf);
  FB.round = f.round; FB.dran = new Set(); FB.zCount = 0; FB.offen = false;
  clearTimeout(FB.alleT); FB.alleT = 0;
  const at = (fn, when) => FB.timers.push(setTimeout(fn, Math.max(0, when - serverNow())));
  if (serverNow() < f.startAt) {
    if (f.first) {
      zeit(null);
      status(rundenKopf(f.round), 'Gleich geht’s los!', 'beamer');
      for (let s = 3; s >= 1; s--) at(() => { bigCount(s, 'Gut hinschauen!'); Ton.piep(false); }, f.startAt - s * 1000);
    } else at(() => status(rundenKopf(f.round), 'Nächster Wert …', 'beamer'), f.startAt - 1500);
  }
  at(() => {
    bigCount(null);
    if (!FB || FB.round !== f.round || !f.item) return;
    $('#fAufl').hidden = true;
    zeigeWert(f.item, $('#fName'), $('#fGeraet'));
    if (window.__nwTest) window.__nwTest.final = { round: f.round, kat: f.item.kat }; // nur für automatische Tests
    FB.offen = true;
    status(rundenKopf(f.round), 'Zu niedrig, normal oder zu hoch?', 'frage');
    Ton.piep(true);
    setTimeout(() => { if (FB && FB.offen && FB.round === f.round) geraeteTon(f.item); }, 450);
    if (room && room.final) { karten(room.final); publikum(room.final); alleDa(room.final); }
    const limit = zeitFinale(f.round);
    const tick = () => {
      if (!FB || FB.round !== f.round || !FB.offen) return;
      const rest = f.deadline - serverNow();
      zeit(Math.max(0, rest), limit);
      if (rest > 0) FB.raf = requestAnimationFrame(tick);
    };
    FB.raf = requestAnimationFrame(tick);
  }, f.startAt);
  for (let s = 3; s >= 1; s--) at(() => { if (FB && FB.offen && FB.round === f.round) Ton.tick(); }, f.deadline - s * 1000);
  // Zeit abgelaufen: dem Server Bescheid geben (er wertet dann aus)
  at(() => send({ t: 'tick', nr: f.nr, r: f.round }), f.deadline + GNADE + 200);
  at(() => send({ t: 'tick', nr: f.nr, r: f.round }), f.deadline + GNADE + 2500);
}
function zeit(rest, gesamt) { zeitbalken(rest, gesamt, $('#fBarBox'), $('#fBar')); }

// Auflösung eines Werts am Beamer
function rundenErgebnis(f) {
  const L = f.last;
  FB.offen = false;
  clearTimeout(FB.alleT); FB.alleT = 0;
  Ton.stopPuls();
  cancelAnimationFrame(FB.raf);
  zeit(null);
  bigCount(null);
  // Nach dem Neuladen des Beamers: Gerät des aufgelösten Werts zeigen
  if (FB.round === 0 || FB.round !== L.round) zeigeWert(L.item, $('#fName'), $('#fGeraet'));
  const a = $('#fAufl');
  const pub = L.pub && L.pub.n ? `<div class="pub">Publikum: ${L.pub.r} von ${L.pub.n} richtig</div>` : '';
  a.innerHTML = aufloesung(L.item, undefined, { extra: pub });
  a.hidden = false;
  const falsch = L.ant.filter(x => x && !x.ok).length;
  status(`Wert ${L.round}<small>Auflösung</small>`, L.out.length ? 'Raus!' : falsch ? 'Leben weg!' : 'Alle richtig! ✓', L.out.length || falsch ? 'schlecht' : 'gut');
  if (L.out.length) Ton.raus(); else if (falsch) Ton.fehler(); else Ton.richtig();
}

function karten(f) {
  const el = $('#fCards'); if (!el) return;
  const st = f.st, L = f.last;
  const aufgeloest = !FB.offen && L && (L.round === f.round - 1 || f.state === 'done');
  const neuOut = L && aufgeloest ? L.out : [];
  el.innerHTML = f.p.map((pid, i) => {
    const x = st[i];
    let cls = '', txt = '';
    const ant = aufgeloest ? L.ant[i] : null;
    if (room.phase === 'podium' && x.place === 1) { cls = 'sieg'; txt = '🏆 Sieg'; }
    else if (!x.alive && !(ant && neuOut.includes(i))) { cls = 'out'; txt = `raus · Platz ${x.place}`; }
    else if (ant) {
      cls = ant.ok ? 'ok' : 'falsch';
      const t = ant.a === 'zeit' || !ant.a ? 'keine Antwort' : KAT_ZEICHEN[ant.a] + ' ' + KAT_TEXT[ant.a];
      txt = (ant.ok ? '✓ ' : '✗ ') + t + (!x.alive ? ` · raus (Platz ${x.place})` : '');
      if (!x.alive) cls += ' neu-out';
    } else if (FB.offen) {
      const dran = FB.dran.has(i) || x.a;
      cls = dran ? 'dran' : ''; txt = dran ? 'hat geantwortet' : 'überlegt …';
    } else txt = 'bereit';
    const h = x.alive || (ant && neuOut.includes(i)) ? `<span class="herzen">${herzenHTML(x.leben, f.leben)}</span>` : '<span></span>';
    const off = f.online && !f.online[i] && room.phase === 'final' && x.alive ? '<div class="warn">Handy nicht verbunden!</div>' : '';
    return `<div class="fcard ${cls}" data-slot="${i}"><div class="fn">${esc(f.names[i])}</div>${h}<div class="fs"><span class="st">${txt}</span><span class="r">${richtigText(x.r)}</span></div>${off}</div>`;
  }).join('');
}
function publikum(f) {
  const el = $('#fPub'); if (!el || !f) return;
  const L = f.last;
  if (FB && FB.offen) el.innerHTML = `Publikum rät mit: <b>${FB.zCount || f.zCount || 0}</b> ${FB.zCount === 1 ? 'Antwort' : 'Antworten'}`;
  else if (L && L.pub && L.pub.n) el.innerHTML = `Publikum: <b>${L.pub.r} von ${L.pub.n}</b> richtig`;
  else el.innerHTML = 'Alle anderen raten auf dem Handy mit.';
}
// Status der Karten regelmäßig auffrischen
setInterval(() => { if (FB && room && room.phase === 'final') karten(room.final); }, 1000);

// ---------------------------------------------------------------- Siegerehrung
let podiumT = 0;
function podium() {
  const f = room.final;
  if (screen === 'podium:' + f.nr) return;
  // Erst die Auflösung des letzten Werts am Finale-Bildschirm zeigen
  if (screen === 'final:' + f.nr && FB) {
    if (FB.lastShown !== f.nr + ':' + f.last.round) { FB.lastShown = f.nr + ':' + f.last.round; rundenErgebnis(f); }
    FB.timers.forEach(clearTimeout); cancelAnimationFrame(FB.raf); zeit(null);
    karten(f);
    clearTimeout(podiumT);
    podiumT = setTimeout(() => { screen = 'pre-podium'; podiumZeigen(); }, 4500);
    screen = 'final-end:' + f.nr;
    return;
  }
  if (screen === 'final-end:' + f.nr) return;
  podiumZeigen();
}
function podiumZeigen() {
  const f = room && room.final; if (!f || room.phase !== 'podium') return;
  stopFinal();
  screen = 'podium:' + f.nr;
  const order = f.p.map((pid, i) => ({ name: f.names[i], x: f.st[i] })).sort((a, b) => a.x.place - b.x.place);
  const w = order[0];
  const pub = room.players.filter(p => p.z && p.z.n).sort((a, b) => (b.z.r - a.z.r) || (a.z.n - b.z.n)).slice(0, 3);
  view.innerHTML = `<div class="tpage"><div class="podium">
      <div class="tcard winner">
        <div class="pokal">🏆</div>
        <h2>${esc(w.name)} gewinnt!</h2>
        <p>${richtigText(w.x.r)} im Finale${f.revanche ? ' · Revanche' : ''}</p>
        <ol class="places">${order.map(o => `<li>${o.x.place}. ${esc(o.name)} <span>${richtigText(o.x.r)}${o.x.place === 1 ? ' · Sieg' : ' · raus bei Wert ' + o.x.out}</span></li>`).join('')}</ol>
        ${pub.length ? `<p class="pubbest">Beste im Publikum: ${pub.map(p => `<b>${esc(p.name)}</b> (${p.z.r} von ${p.z.n})`).join(', ')}</p>` : ''}
      </div>
      <div class="tcard seqcard"><h2 style="font-size:1.3em">Alle Werte zum Nachlesen</h2>
        <div class="aufl-liste">${(f.verlauf || []).map(it => aufloesung(it, undefined, { klein: true })).join('')}</div>
      </div>
    </div>
    <div class="tactions"><button class="ghost-btn" id="btnLobby">Neues Spiel <span class="kbd">Esc</span></button>
      <button class="ghost-btn" id="btnOther">Andere Finalisten</button><span class="grow"></span>
      <button class="big-btn" id="btnRev">Revanche <span class="kbd">Enter</span></button></div>
  </div>`;
  $('#btnLobby').onclick = toLobby;
  $('#btnOther').onclick = () => send({ t: 'to-setup' });
  $('#btnRev').onclick = () => { Ton.init(); send({ t: 'revanche', cfg }); };
  Ton.fanfare();
  konfetti();
}
function konfetti() {
  const c = document.createElement('div'); c.className = 'confetti';
  const cols = ['#ffb238', '#ff5d73', '#4da3ff', '#3ddc97', '#b57bff', '#fff'];
  for (let i = 0; i < 90; i++) {
    const p = document.createElement('i');
    p.style.left = Math.random() * 100 + 'vw';
    p.style.background = cols[i % cols.length];
    p.style.animationDuration = 2.4 + Math.random() * 2.6 + 's';
    p.style.animationDelay = Math.random() * 1.2 + 's';
    c.appendChild(p);
  }
  document.body.appendChild(c);
  setTimeout(() => c.remove(), 6500);
}

// ---------------------------------------------------------------- Tasten
document.addEventListener('keydown', e => {
  if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
  if (!$('#dlg').hidden) { if (e.key === 'Escape') $('#dlg').hidden = true; return; }
  if (!room) return;
  if (e.key === 'Enter') {
    e.preventDefault();
    if (room.phase === 'lobby') startQuali();
    else if (room.phase === 'quali') endQuali();
    else if (room.phase === 'final-setup') startFinal();
    else if (room.phase === 'podium' && screen.startsWith('podium')) { Ton.init(); send({ t: 'revanche', cfg }); }
  } else if (e.key === 'Escape') {
    if (room.phase === 'final-setup' || (room.phase === 'podium' && screen.startsWith('podium'))) toLobby();
  } else if (e.key === 'f' || e.key === 'F') vollbild();
  else if (e.key === 'm' || e.key === 'M') btnTon.click();
});

// ---------------------------------------------------------------- Start
if (!sess || !sess.code || !sess.key) newSession(); else connect();
