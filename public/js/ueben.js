// Übungsseite: allein spielen, ohne Klasse und ohne Server
import { store } from './net.js';
import { erstelleAntwort } from './antwort.js';
import { SoloSpiel } from './spiel.js';
import { WERTE, GRUPPEN, STUFEN, STUFE_TEXT, QUALI_WERTE, KAT_ZEICHEN, aufgaben, zufallsSeed, normalText, normBereich } from './regeln.js';
import { Ton } from './ton.js';
import { esc, spielfeldZeigen, countdown, soloAnzeige, aufloesungsListe, wachHalten, feedback, richtigText } from './ui.js';

const $ = s => document.querySelector(s);
const panel = $('#panel');
const WAHL = { vital: GRUPPEN.vital, labor: GRUPPEN.labor, alle: 'Beides' };
const opt = Object.assign({ werte: 'alle', stufe: 'deutlich' }, store('normwerte.ueben') || {});
if (!WAHL[opt.werte]) opt.werte = 'alle';
if (!STUFEN.includes(opt.stufe)) opt.stufe = 'deutlich';
let rekorde = store('normwerte.rekorde') || {};
let spiel = null;

// Auch beim Üben bleibt das Handy stumm
Ton.an = false;

const rkey = () => opt.werte + ':' + opt.stufe;
const ids = () => WERTE.filter(p => opt.werte === 'alle' || p.gruppe === opt.werte).map(p => p.id);
const rekordText = () => { const r = rekorde[rkey()]; return r ? `Dein Rekord mit diesen Einstellungen: <b>${richtigText(r)}</b>` : `${QUALI_WERTE} Werte, 3 Leben. Wie viele schaffst du?`; };

const antwort = erstelleAntwort({ knoepfe: $('#antworten'), flaeche: $('#wertfeld'), ziel: $('#wertkarte'), tasten: true, onAntwort: a => spiel && spiel.antwort(a) });
$('#btnStop').onclick = () => { if (spiel) spiel.stop(); spiel = null; countdown(null); feedback(null); menu(); };

function seg(name, options, value) {
  return `<div class="seg c${options.length}" role="radiogroup" aria-label="${esc(name)}" data-name="${esc(name)}">${options.map(([v, l]) => `<button type="button" role="radio" data-v="${esc(v)}" aria-checked="${v === value}">${esc(l)}</button>`).join('')}</div>`;
}

function menu() {
  spielfeldZeigen(false);
  wachHalten(false);
  panel.innerHTML = `
    <div class="card">
      <h2>Normal oder nicht?</h2>
      <p>Du siehst Messwerte wie auf Station: am Monitor, am Blutdruckgerät oder im Laborbefund. Entscheide: <b>zu niedrig</b>, <b>normal</b> oder <b>zu hoch</b>? Tippe auf einen Knopf oder wische über das Gerät.</p>
      <div class="wischdemo" aria-hidden="true"><span>◀ zu niedrig</span><span>▲ normal</span><span>zu hoch ▶</span></div>
      <div class="settings">
        <div><div class="lbl">Werte</div>${seg('werte', Object.entries(WAHL), opt.werte)}</div>
        <div><div class="lbl">Stufe</div>${seg('stufe', STUFEN.map(s => [s, STUFE_TEXT[s].name]), opt.stufe)}<p class="hint" id="sDesc" style="margin-top:6px">${esc(STUFE_TEXT[opt.stufe].kurz)}</p></div>
      </div>
      <p class="hint" id="rek">${rekordText()}</p>
      <button class="big-btn" id="btnGo">Spielen</button>
      <button class="ghost-btn" id="btnListe">Normwerte ansehen</button>
    </div>
    <p class="foot">Klassenturnier mit Beamer: <a class="mehr" href="lehrer">Klassenmodus für Lehrkräfte</a><br>© 2026 Sven Klawitter · Karoline-Breitinger-Schule</p>`;
  panel.querySelectorAll('.seg').forEach(g => {
    g.querySelectorAll('button').forEach(b => b.onclick = () => {
      g.querySelectorAll('button').forEach(x => x.setAttribute('aria-checked', String(x === b)));
      opt[g.dataset.name] = b.dataset.v;
      store('normwerte.ueben', opt);
      $('#sDesc').textContent = STUFE_TEXT[opt.stufe].kurz;
      $('#rek').innerHTML = rekordText();
    });
  });
  $('#btnGo').onclick = start;
  $('#btnListe').onclick = liste;
}

function start() {
  const items = aufgaben(zufallsSeed(), ids(), opt.stufe, QUALI_WERTE);
  spiel = new SoloSpiel({
    items, antwort, ...soloAnzeige(antwort),
    onEnde: r => setTimeout(() => ende(r, items), 300),
  });
  feedback(null);
  spielfeldZeigen(true);
  wachHalten(true);
  let s = 3;
  const cd = () => { if (s === 0 || !spiel) { countdown(null); return; } countdown(s, 'Gleich geht’s los!'); s--; setTimeout(cd, 800); };
  cd();
  spiel.start(2400);
}

function ende(r, items) {
  spiel = null;
  feedback(null);
  spielfeldZeigen(false);
  wachHalten(false);
  const k = rkey(), alt = rekorde[k] || 0, neu = r.r > alt;
  if (neu) { rekorde[k] = r.r; store('normwerte.rekorde', rekorde); }
  const fehler = r.fehler.map(([i, a]) => [items[i], a]);
  panel.innerHTML = `
    <div class="card ${neu ? 'good' : r.why === 'fertig' ? 'good' : 'bad'}">
      <h2>${neu && r.r > 0 ? 'Neuer Rekord! 🎉' : r.why === 'fertig' ? 'Alle Werte geschafft! 🎉' : '3 Fehler – Spiel vorbei'}</h2>
      <div class="bigstat"><b>${r.r}</b><span>von ${r.n} richtig${!neu && alt ? ` · Rekord: ${alt}` : ''}</span></div>
      ${fehler.length ? `<h3>Das solltest du dir noch einmal ansehen:</h3>${aufloesungsListe(fehler)}` : '<p>Kein einziger Fehler. Stark!</p>'}
      <button class="big-btn" id="btnAgain">Nochmal</button>
      <button class="ghost-btn" id="btnMenu">Einstellungen</button>
      <button class="ghost-btn" id="btnListe">Normwerte ansehen</button>
    </div>`;
  $('#btnAgain').onclick = start;
  $('#btnMenu').onclick = menu;
  $('#btnListe').onclick = liste;
  window.scrollTo(0, 0);
}

// Alle Normwerte zum Lernen (aus normwerte.js)
export function normwertTabelle(gruppe) {
  return `<ul class="nliste">${WERTE.filter(p => p.gruppe === gruppe).map(p => {
    const nb = p.normalFrau ? `${esc(normalText(p, 'w'))}<br>${esc(normalText(p, 'm'))}` : esc(normalText(p));
    return `<li><div class="nk"><b>${esc(p.name)}</b>${p.kurz !== p.name ? ` <span>(${esc(p.kurz)})</span>` : ''}</div>
      <div class="nn">${nb}</div>
      ${p.niedrig && p.bereich[0] < normBereich(p, 'w')[0] ? `<div class="nf kat-niedrig">${KAT_ZEICHEN.niedrig} ${esc(p.niedrig)}</div>` : ''}
      ${p.hoch && p.bereich[1] > normBereich(p, 'w')[1] ? `<div class="nf kat-hoch">${KAT_ZEICHEN.hoch} ${esc(p.hoch)}</div>` : ''}</li>`;
  }).join('')}</ul>`;
}
function liste() {
  spielfeldZeigen(false);
  panel.innerHTML = `
    <div class="card"><h2>Normwerte</h2><p>Diese Normbereiche gelten im Spiel (Erwachsene). Lehrbücher weichen manchmal etwas voneinander ab.</p>
      <button class="big-btn" id="btnBack">Zurück</button></div>
    ${Object.entries(GRUPPEN).map(([g, name]) => `<div class="card"><h3>${esc(name)}</h3>${normwertTabelle(g)}</div>`).join('')}`;
  $('#btnBack').onclick = menu;
  window.scrollTo(0, 0);
}

menu();
