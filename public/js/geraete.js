/*
 * Die Gerätedisplays als SVG (eigene Zeichnungen, © 2026 Sven Klawitter).
 * Alle Geräte liegen in einem Feld von 400 × 300 und passen sich jeder Bildschirmgröße an.
 * Es werden keine Alarmgrenzen oder Normbereiche angezeigt – sonst wäre die Antwort verraten.
 */
import { wert, zahl, wertText } from './regeln.js';

let uid = 0;
const SKEW = Math.tan(6 * Math.PI / 180);
const t = (x, y, txt, attrs = '') => `<text x="${x}" y="${y}" ${attrs}>${txt}</text>`;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ------------------------------------------------------------------ 7-Segment-Ziffern (LCD)
const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g', ' ': '' };
function segPolys(W, H, T) {
  const g = T * 0.2, h = T / 2;
  const hs = (x1, x2, y) => `${x1},${y} ${x1 + h},${y - h} ${x2 - h},${y - h} ${x2},${y} ${x2 - h},${y + h} ${x1 + h},${y + h}`;
  const vs = (x, y1, y2) => `${x},${y1} ${x + h},${y1 + h} ${x + h},${y2 - h} ${x},${y2} ${x - h},${y2 - h} ${x - h},${y1 + h}`;
  return {
    a: hs(h + g, W - h - g, h), g: hs(h + g, W - h - g, H / 2), d: hs(h + g, W - h - g, H - h),
    f: vs(h, h + g, H / 2 - g), b: vs(W - h, h + g, H / 2 - g), e: vs(h, H / 2 + g, H - h - g), c: vs(W - h, H / 2 + g, H - h - g),
  };
}
// text z. B. "38,4": rechtsbündig mit `zellen` Stellen, rechte Kante bei x, obere Kante bei y, Höhe h
function seg7(text, x, y, h, zellen, an, aus) {
  const cells = [];
  for (const ch of String(text)) {
    if (ch === ',' || ch === '.') { if (cells.length) cells[cells.length - 1].dp = true; continue; }
    cells.push({ c: ch in SEG ? ch : ' ', dp: false });
  }
  while (cells.length < zellen) cells.unshift({ c: ' ', dp: false });
  const W = h * 0.56, T = h * 0.12, gap = h * 0.2;
  const polys = segPolys(W, h, T);
  const breite = cells.length * W + (cells.length - 1) * gap;
  let out = `<g transform="translate(${x - breite + SKEW * h},${y}) skewX(-6)">`;
  cells.forEach((cell, i) => {
    const ox = i * (W + gap);
    out += `<g transform="translate(${ox},0)">`;
    for (const s of 'abcdefg') out += `<polygon points="${polys[s]}" fill="${SEG[cell.c].includes(s) ? an : aus}"/>`;
    out += `<rect x="${W + gap * 0.22}" y="${h - T}" width="${T}" height="${T}" fill="${cell.dp ? an : aus}"/>`;
    out += '</g>';
  });
  return out + '</g>';
}
const lcdZahl = (v, p) => zahl(v, p.schritt, false);

// ------------------------------------------------------------------ Kurven (EKG, Atmung, Pulswelle)
// Läuft von rechts nach links durch das Fenster [x0, x0+w]. beat(x, P) zeichnet eine Periode der Breite P ab (x|0).
function laufkurve(id, x0, yBase, w, yTop, hFenster, periodeS, pxProS, beat, farbe, dicke) {
  const P = Math.max(4, periodeS * pxProS);
  const n = Math.ceil(w / P) + 1;
  let d = 'M0,0';
  for (let i = 0; i < 2 * n; i++) d += beat(i * P, P);
  const weg = n * P, dauer = (n * periodeS).toFixed(3);
  return `<clipPath id="${id}"><rect x="${x0}" y="${yTop}" width="${w}" height="${hFenster}"/></clipPath>
    <g clip-path="url(#${id})"><g transform="translate(${x0},${yBase})"><g>
      <path d="${d}" fill="none" stroke="${farbe}" stroke-width="${dicke}" stroke-linejoin="round" stroke-linecap="round"/>
      <animateTransform attributeName="transform" type="translate" from="0 0" to="${-weg} 0" dur="${dauer}s" repeatCount="indefinite"/>
    </g></g></g>`;
}
function ekgBeat(hf, pxProS) {
  const RR = 60 / hf, k = Math.min(1, (RR * 0.85) / 0.5), s = k * pxProS;
  return (x, P) => {
    const X = tt => (x + tt * s).toFixed(1);
    return ` L${X(0.02)},0 Q${X(0.06)},-12 ${X(0.1)},0 L${X(0.16)},0 L${X(0.18)},5 L${X(0.205)},-62 L${X(0.23)},14 L${X(0.25)},0 L${X(0.32)},0 Q${X(0.4)},-26 ${X(0.48)},0 L${(x + P).toFixed(1)},0`;
  };
}
const atemBeat = (x, P) => {
  const X = f => (x + f * P).toFixed(1);
  return ` C${X(0.15)},0 ${X(0.25)},-44 ${X(0.4)},-44 C${X(0.55)},-44 ${X(0.68)},0 ${X(0.85)},0 L${X(1)},0`;
};
const plethBeat = (x, P) => {
  const X = f => (x + f * P).toFixed(1);
  return ` C${X(0.05)},0 ${X(0.1)},-26 ${X(0.16)},-26 C${X(0.24)},-26 ${X(0.3)},-12 ${X(0.36)},-11 C${X(0.42)},-10 ${X(0.46)},-13 ${X(0.5)},-11 C${X(0.65)},-6 ${X(0.85)},0 ${X(1)},0`;
};
const HERZ = 'M0,-3 C0,-7 -6,-8 -7,-4 C-8,0 -3,4 0,7 C3,4 8,0 7,-4 C6,-8 0,-7 0,-3Z';
const blink = periodeS => `<animate attributeName="opacity" values="1;1;.15;.15" keyTimes="0;.25;.35;1" dur="${periodeS.toFixed(3)}s" repeatCount="indefinite"/>`;
const uhrzeit = deko => String(6 + (deko % 14)).padStart(2, '0') + ':' + String((deko * 7) % 60).padStart(2, '0');

// ------------------------------------------------------------------ Geräte
function monitor(item, p, art) {
  const id = 'g' + (++uid);
  const ekg = art === 'ekg';
  const farbe = ekg ? '#3cf07c' : '#ffe14d';
  const v = item.w;
  const kurve = ekg
    ? laufkurve(id + 'c', 28, 168, 222, 54, 186, 60 / Math.max(v, 1), 55, ekgBeat(v, 55), farbe, 3)
    : laufkurve(id + 'c', 28, 190, 222, 54, 186, 60 / Math.max(v, 1), 20, atemBeat, farbe, 3);
  return `
    <defs><linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#474d58"/><stop offset="1" stop-color="#22262d"/></linearGradient></defs>
    <rect x="4" y="4" width="392" height="292" rx="24" fill="url(#${id}g)" stroke="#15181d" stroke-width="2"/>
    <rect x="18" y="16" width="364" height="240" rx="10" fill="#050808" stroke="#0e1113" stroke-width="2"/>
    ${t(32, 36, 'Bett ' + (1 + (item.deko % 12)), 'font-size="13" fill="#8ea3a8" font-weight="600"')}
    ${t(368, 36, uhrzeit(item.deko), 'font-size="13" fill="#8ea3a8" text-anchor="end" font-weight="600"')}
    <line x1="26" y1="44" x2="374" y2="44" stroke="#1b2729" stroke-width="1.5"/>
    ${t(32, 64, ekg ? 'II' : 'Resp', `font-size="13" fill="${farbe}" font-weight="700"`)}
    <line x1="258" y1="52" x2="258" y2="246" stroke="#1b2729" stroke-width="1.5"/>
    ${kurve}
    ${t(270, 76, ekg ? 'HF' : 'AF', `font-size="22" fill="${farbe}" font-weight="800"`)}
    ${ekg ? `<g transform="translate(355,70)"><path d="${HERZ}" fill="${farbe}">${blink(60 / Math.max(v, 1))}</path></g>` : ''}
    ${t(370, 178, esc(lcdZahl(v, p)), `font-size="${v >= 100 ? 64 : 82}" fill="${farbe}" text-anchor="end" font-weight="600" letter-spacing="-2"`)}
    ${t(370, 210, '/min', `font-size="15" fill="${farbe}" text-anchor="end" font-weight="600"`)}
    <circle cx="44" cy="276" r="7" fill="#2b3038" stroke="#5c6470"/><circle cx="68" cy="276" r="7" fill="#2b3038" stroke="#5c6470"/>
    <circle cx="92" cy="276" r="7" fill="#2b3038" stroke="#5c6470"/>
    <circle cx="356" cy="276" r="5" fill="#3cf07c"/>
    ${t(200, 281, 'PATIENTENMONITOR', 'font-size="10" fill="#8b93a1" text-anchor="middle" letter-spacing="2" font-weight="700"')}`;
}

function pulsoximeter(item, p) {
  const id = 'g' + (++uid);
  const puls = item.puls || 75, cyan = '#38dcff', gelb = '#ffd23f';
  return `
    <defs>
      <linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbfcfe"/><stop offset="1" stop-color="#c3cdd9"/></linearGradient>
      <linearGradient id="${id}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6c9a8"/><stop offset="1" stop-color="#d99b78"/></linearGradient>
    </defs>
    <rect x="-30" y="112" width="150" height="84" rx="40" fill="url(#${id}f)" stroke="#b07a5c" stroke-width="2"/>
    <path d="M10,128 C30,124 46,126 60,130" stroke="#c48a68" stroke-width="2" fill="none" opacity=".6"/>
    <rect x="66" y="36" width="300" height="232" rx="64" fill="url(#${id}g)" stroke="#9aa6b4" stroke-width="2.5"/>
    <path d="M100,40 L332,40 C350,40 362,52 364,64 L68,64 C70,52 82,40 100,40Z" fill="#2f7de1" opacity=".9"/>
    <rect x="112" y="76" width="226" height="152" rx="16" fill="#04070a" stroke="#1c2530" stroke-width="3"/>
    ${t(126, 100, 'SpO₂', `font-size="17" fill="${cyan}" font-weight="800"`)}
    ${t(250, 178, esc(lcdZahl(item.w, p)), `font-size="76" fill="${cyan}" text-anchor="end" font-weight="600" letter-spacing="-2"`)}
    ${t(254, 120, '%', `font-size="20" fill="${cyan}" font-weight="700"`)}
    <line x1="276" y1="88" x2="276" y2="180" stroke="#16212b" stroke-width="2"/>
    ${t(286, 100, 'PR', `font-size="14" fill="${gelb}" font-weight="800"`)}
    ${t(286, 114, 'bpm', `font-size="10" fill="${gelb}" font-weight="600"`)}
    ${t(330, 162, String(puls), `font-size="32" fill="${gelb}" text-anchor="end" font-weight="600"`)}
    <g transform="translate(320,104)"><path d="${HERZ}" fill="${gelb}">${blink(60 / puls)}</path></g>
    ${laufkurve(id + 'c', 124, 216, 204, 184, 40, 60 / puls, 70, plethBeat, cyan, 2.5)}
    <circle cx="226" cy="248" r="10" fill="#2f7de1" stroke="#1d5bb0" stroke-width="2"/>`;
}

function blutdruck(item, p) {
  const id = 'g' + (++uid);
  const an = '#1d2719', aus = 'rgba(29,39,25,.07)', lab = 'font-weight="800" fill="#2b3526"';
  const puls = item.puls || 75;
  return `
    <defs><linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d5dde6"/></linearGradient></defs>
    <path d="M200,22 C200,-6 250,-4 268,-30" fill="none" stroke="#8e98a3" stroke-width="12" stroke-linecap="round"/>
    <rect x="188" y="12" width="24" height="16" rx="4" fill="#6f7a86"/>
    <rect x="34" y="22" width="332" height="270" rx="32" fill="url(#${id}g)" stroke="#a9b3be" stroke-width="2.5"/>
    <rect x="56" y="44" width="206" height="226" rx="12" fill="#c5d2bd" stroke="#93a287" stroke-width="3"/>
    ${t(68, 74, 'SYS', `font-size="15" ${lab}`)}${t(68, 89, 'mmHg', 'font-size="10" fill="#2b3526" font-weight="600"')}
    ${seg7(item.w, 248, 56, 64, 3, an, aus)}
    ${t(68, 150, 'DIA', `font-size="15" ${lab}`)}${t(68, 165, 'mmHg', 'font-size="10" fill="#2b3526" font-weight="600"')}
    ${seg7(item.w2, 248, 134, 52, 3, an, aus)}
    ${t(68, 222, 'PUL', `font-size="13" ${lab}`)}${t(68, 236, '/min', 'font-size="10" fill="#2b3526" font-weight="600"')}
    <g transform="translate(134,226)"><path d="${HERZ}" fill="${an}">${blink(60 / puls)}</path></g>
    ${seg7(puls, 248, 208, 38, 3, an, aus)}
    <circle cx="314" cy="152" r="32" fill="#2f6fd6" stroke="#1f55a8" stroke-width="3"/>
    ${t(314, 149, 'START', 'font-size="11" fill="#fff" text-anchor="middle" font-weight="800"')}
    ${t(314, 163, 'STOP', 'font-size="11" fill="#fff" text-anchor="middle" font-weight="800"')}
    <circle cx="314" cy="232" r="16" fill="#dfe5eb" stroke="#a9b3be" stroke-width="2"/>
    ${t(314, 236, 'MEM', 'font-size="9" fill="#55606c" text-anchor="middle" font-weight="800"')}`;
}

function thermometer(item, p) {
  const id = 'g' + (++uid);
  const an = '#1d2719', aus = 'rgba(29,39,25,.07)';
  return `
    <defs>
      <linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#cfdbe6"/></linearGradient>
      <linearGradient id="${id}s" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#eef7fc"/><stop offset="1" stop-color="#bcd6e6"/></linearGradient>
    </defs>
    <path d="M24,132 C24,122 30,118 40,116 L96,100 L96,200 L40,184 C30,182 24,178 24,168Z" fill="url(#${id}s)" stroke="#8fb3c8" stroke-width="2.5"/>
    <ellipse cx="26" cy="150" rx="8" ry="17" fill="#d8ecf7" stroke="#8fb3c8" stroke-width="2"/>
    <rect x="84" y="70" width="304" height="160" rx="80" fill="url(#${id}g)" stroke="#a3b2c0" stroke-width="2.5"/>
    <path d="M150,74 L320,74 C350,74 372,88 382,108 L130,108 C132,90 140,78 150,74Z" fill="#17a39c" opacity=".85"/>
    <rect x="130" y="112" width="200" height="96" rx="12" fill="#c5d2bd" stroke="#93a287" stroke-width="3"/>
    ${seg7(lcdZahl(item.w, p), 286, 126, 66, 3, an, aus)}
    ${t(300, 148, '°C', `font-size="22" fill="${an}" font-weight="800"`)}
    <circle cx="358" cy="160" r="14" fill="#17a39c" stroke="#0f7a75" stroke-width="2"/>
    ${t(200, 224, 'OHR', 'font-size="10" fill="#6a7886" text-anchor="middle" letter-spacing="3" font-weight="800"')}`;
}

function bzGeraet(item, p) {
  const id = 'g' + (++uid);
  const an = '#1d2719', aus = 'rgba(29,39,25,.07)';
  return `
    <defs><linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#46576d"/><stop offset="1" stop-color="#253140"/></linearGradient></defs>
    <rect x="182" y="2" width="36" height="76" rx="3" fill="#fbfbf7" stroke="#b9bdc4" stroke-width="2"/>
    <rect x="190" y="40" width="20" height="30" fill="#e8c34a" opacity=".8"/>
    <path d="M200,6 C206,14 210,20 210,25 C210,31 205,34 200,34 C195,34 190,31 190,25 C190,20 194,14 200,6Z" fill="#d0182e" stroke="#8d0f1f" stroke-width="1.5"/>
    <rect x="92" y="56" width="216" height="238" rx="36" fill="url(#${id}g)" stroke="#18212c" stroke-width="2.5"/>
    <rect x="116" y="82" width="168" height="134" rx="12" fill="#c5d2bd" stroke="#93a287" stroke-width="3"/>
    ${seg7(lcdZahl(item.w, p), 270, 100, 68, 3, an, aus)}
    ${t(270, 202, 'mg/dL', `font-size="14" fill="${an}" text-anchor="end" font-weight="800"`)}
    <rect x="126" y="188" width="70" height="18" rx="4" fill="none" stroke="${an}" stroke-width="1.5"/>
    ${t(161, 201, 'nüchtern', `font-size="11" fill="${an}" text-anchor="middle" font-weight="700"`)}
    <path d="M132,92 C135,96 137,99 137,101 C137,104 135,105 132,105 C129,105 127,104 127,101 C127,99 129,96 132,92Z" fill="${an}"/>
    <rect x="132" y="234" width="56" height="26" rx="10" fill="#5a6c84" stroke="#18212c" stroke-width="1.5"/>
    <rect x="212" y="234" width="56" height="26" rx="10" fill="#5a6c84" stroke="#18212c" stroke-width="1.5"/>
    ${t(160, 251, '◀', 'font-size="11" fill="#c9d3e0" text-anchor="middle"')}${t(240, 251, '▶', 'font-size="11" fill="#c9d3e0" text-anchor="middle"')}`;
}

function laborbefund(item, p) {
  const d = item.deko || 0;
  const mono = 'font-family="ui-monospace,Menlo,Consolas,monospace"';
  const grau = '#6b7480', tinte = '#1d2b3a';
  let striche = '';
  for (let i = 0, x = 300; x < 360; i++) { const w = 1 + ((d >> (i % 12)) & 1) + ((i * 7 + d) % 3 === 0 ? 1 : 0); striche += `<rect x="${x}" y="54" width="${w}" height="22" fill="${tinte}"/>`; x += w + 1 + (i % 2); }
  const pat = item.sex === 'w' ? 'Patientin' : item.sex === 'm' ? 'Patient' : 'Station ' + (1 + d % 6) + String.fromCharCode(65 + d % 3);
  const alter = 28 + (d % 61);
  const name = p.name.length <= 12 ? p.name : p.kurz;
  const v = zahl(item.w, p.schritt);
  return `
    <rect x="32" y="12" width="348" height="284" fill="rgba(0,0,0,.25)"/>
    <rect x="26" y="6" width="348" height="284" fill="#fdfdfa" stroke="#d6d6cc" stroke-width="1.5"/>
    ${t(44, 34, 'Zentrallabor', `font-size="17" fill="${tinte}" font-weight="800"`)}
    ${t(356, 34, 'Befund', `font-size="13" fill="${grau}" text-anchor="end" font-weight="600"`)}
    <line x1="44" y1="44" x2="356" y2="44" stroke="${tinte}" stroke-width="1.5"/>
    ${t(44, 64, 'Pat.-Nr. ' + String(4711000 + d * 37).slice(0, 7), `font-size="12" fill="${tinte}" ${mono}`)}
    ${t(44, 80, item.sex ? `${pat}, ${alter} J.` : pat, `font-size="12" fill="${tinte}" ${mono}`)}
    ${t(44, 96, 'Entnahme ' + uhrzeit(d), `font-size="12" fill="${grau}" ${mono}`)}
    ${striche}
    ${t(44, 128, 'Untersuchung', `font-size="11" fill="${grau}" font-weight="700"`)}
    ${t(286, 128, 'Ergebnis', `font-size="11" fill="${grau}" text-anchor="end" font-weight="700"`)}
    ${t(296, 128, 'Einheit', `font-size="11" fill="${grau}" font-weight="700"`)}
    <line x1="44" y1="136" x2="356" y2="136" stroke="#c9ccd1" stroke-width="1"/>
    <rect x="38" y="146" width="324" height="52" rx="6" fill="#eef3f8"/>
    ${t(46, 180, esc(name), `font-size="${name.length > 10 && v.length > 5 ? 16 : 20}" fill="${tinte}" font-weight="700"`)}
    ${t(286, 182, esc(v), `font-size="${v.length > 6 ? 25 : 29}" fill="${tinte}" text-anchor="end" font-weight="800" ${mono}`)}
    ${t(296, 180, esc(p.einheit), `font-size="14" fill="${tinte}" font-weight="600"`)}
    <rect x="46" y="214" width="96" height="9" rx="4" fill="#e3e6ea"/><rect x="230" y="214" width="56" height="9" rx="4" fill="#e3e6ea"/>
    <rect x="46" y="234" width="120" height="9" rx="4" fill="#e3e6ea"/><rect x="246" y="234" width="40" height="9" rx="4" fill="#e3e6ea"/>
    <line x1="44" y1="262" x2="356" y2="262" stroke="#c9ccd1" stroke-width="1"/>
    ${t(44, 278, 'Seite 1 von 1', `font-size="10" fill="${grau}"`)}
    ${t(356, 278, 'technisch validiert', `font-size="10" fill="${grau}" text-anchor="end"`)}`;
}

// Ausschnitt je Gerät (schmale Geräte werden so größer dargestellt)
const AUSSCHNITT = { bz: '62 0 276 300', spo2: '0 20 400 268' };
const GERAETE = { ekg: (i, p) => monitor(i, p, 'ekg'), atmung: (i, p) => monitor(i, p, 'atmung'), spo2: pulsoximeter, rr: blutdruck, thermometer, bz: bzGeraet, labor: laborbefund };

// Das fertige SVG für einen Wert
export function geraet(item) {
  const p = wert(item.id);
  if (!p) return '';
  const inner = (GERAETE[p.anzeige] || laborbefund)(item, p);
  return `<svg class="geraet-svg" viewBox="${AUSSCHNITT[p.anzeige] || '0 0 400 300'}" role="img" aria-label="${esc(p.name + ': ' + wertText(item, p))}" preserveAspectRatio="xMidYMid meet" font-family="Rubik,system-ui,sans-serif">${inner}</svg>`;
}
