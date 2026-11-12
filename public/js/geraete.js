/*
 * Die Gerätedisplays als SVG (eigene Zeichnungen, © 2026 Sven Klawitter).
 * Alle Geräte liegen in einem Feld von 400 × 300 und passen sich jeder Bildschirmgröße an.
 * Es werden keine Alarmgrenzen oder Normbereiche angezeigt – sonst wäre die Antwort verraten.
 */
import { wert, zahl, wertText, stellen, WERTE } from './regeln.js';

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

// ------------------------------------------------------------------ Notfall, Ausscheidung, Kinder
// 24-h-Urinsammelbehälter mit Skala und Etikett
function urinBehaelter(item, p) {
  const id = 'g' + (++uid);
  const y = ml => 272 - Math.max(0, Math.min(4000, ml)) / 4000 * 214;
  let skala = '';
  for (let ml = 500; ml <= 4000; ml += 500) {
    skala += `<line x1="112" y1="${y(ml)}" x2="${ml % 1000 ? 124 : 132}" y2="${y(ml)}" stroke="#55606c" stroke-width="${ml % 1000 ? 1.5 : 2.5}"/>`;
    if (!(ml % 1000)) skala += t(138, y(ml) + 4, String(ml), 'font-size="10" fill="#55606c" font-weight="700"');
  }
  return `
    <defs>
      <linearGradient id="${id}u" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6d64f"/><stop offset="1" stop-color="#e2a92a"/></linearGradient>
      <clipPath id="${id}k"><rect x="104" y="46" width="160" height="232" rx="18"/></clipPath>
    </defs>
    <path d="M150,30 C150,8 218,8 218,30" fill="none" stroke="#9aa3ad" stroke-width="9" stroke-linecap="round"/>
    <rect x="152" y="26" width="64" height="24" rx="5" fill="#3f6fb5" stroke="#2c4f82" stroke-width="2"/>
    <rect x="104" y="46" width="160" height="232" rx="18" fill="#eef3f6" stroke="#9fb0bd" stroke-width="3"/>
    <g clip-path="url(#${id}k)"><rect x="104" y="${y(item.w)}" width="160" height="${290 - y(item.w)}" fill="url(#${id}u)" opacity=".9"/>
      <rect x="104" y="${y(item.w)}" width="160" height="4" fill="#fff3b0" opacity=".7"/></g>
    ${skala}
    ${t(196, 290, 'ml', 'font-size="10" fill="#55606c" text-anchor="middle" font-weight="700"')}
    <rect x="272" y="70" width="118" height="168" rx="10" fill="#ffffff" stroke="#c9cfd6" stroke-width="2"/>
    ${t(331, 94, '24-h-Urin', 'font-size="14" fill="#1d2b3a" text-anchor="middle" font-weight="800"')}
    ${t(331, 112, uhrzeit(item.deko || 0).slice(0, 2) + ':00 – ' + uhrzeit(item.deko || 0).slice(0, 2) + ':00 Uhr', 'font-size="10" fill="#6b7480" text-anchor="middle"')}
    <line x1="284" y1="124" x2="378" y2="124" stroke="#d6dbe0" stroke-width="1.5"/>
    ${t(331, 146, 'Gesamtmenge', 'font-size="11" fill="#6b7480" text-anchor="middle" font-weight="700"')}
    ${t(331, 188, esc(zahl(item.w, p.schritt)), `font-size="${item.w >= 1000 ? 30 : 34}" fill="#1d2b3a" text-anchor="middle" font-weight="800"`)}
    ${t(331, 214, 'ml', 'font-size="15" fill="#1d2b3a" text-anchor="middle" font-weight="700"')}`;
}

// Reanimations-Feedback: gefragter Wert groß, der andere klein (und immer richtig)
export function cprWerte(item) {
  const p = wert(item.id);
  const andere = WERTE.find(x => x.anzeige === 'cpr' && x.id !== item.id);
  if (!p || !andere) return { haupt: p, wert: item.w };
  const d = item.deko || 0, n = andere.normal;
  const mitte = (n[0] + n[1]) / 2, spanne = (n[1] - n[0]) / 4;
  const v = Number((Math.round((mitte + ((d % 7) - 3) / 3 * spanne) / andere.schritt) * andere.schritt).toFixed(stellen(andere.schritt)));
  return { haupt: p, wert: item.w, neben: andere, nebenWert: v };
}
function cpr(item, p) {
  const id = 'g' + (++uid);
  const w = cprWerte(item);
  const neben = w.neben ? `
    ${t(286, 100, esc(w.neben.kurz.toUpperCase()), `font-size="${w.neben.kurz.length > 11 ? 8.5 : 10}" fill="#8b95a5" text-anchor="middle" font-weight="800"`)}
    ${t(286, 150, esc(zahl(w.nebenWert, w.neben.schritt, false)), 'font-size="30" fill="#c9d2de" text-anchor="middle" font-weight="700"')}
    ${t(286, 172, esc(w.neben.einheit), 'font-size="12" fill="#8b95a5" text-anchor="middle" font-weight="700"')}` : '';
  const zyklus = 1 + ((item.deko || 0) % 5);
  return `
    <defs><linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#363d48"/><stop offset="1" stop-color="#1a1f27"/></linearGradient></defs>
    <rect x="24" y="22" width="352" height="256" rx="30" fill="url(#${id}g)" stroke="#11151b" stroke-width="2"/>
    <rect x="24" y="22" width="352" height="22" rx="11" fill="#f08a24"/>
    ${t(200, 38, 'REANIMATION · FEEDBACK', 'font-size="11" fill="#1a1f27" text-anchor="middle" font-weight="800" letter-spacing="2"')}
    <rect x="44" y="58" width="312" height="190" rx="14" fill="#06090d" stroke="#2a313c" stroke-width="2"/>
    <rect x="56" y="72" width="164" height="162" rx="10" fill="#0f1620" stroke="#f08a24" stroke-width="2.5"/>
    ${t(138, 96, esc(p.kurz.toUpperCase()), 'font-size="12" fill="#f8b46a" text-anchor="middle" font-weight="800" letter-spacing="1"')}
    ${t(138, 172, esc(zahl(item.w, p.schritt, false)), `font-size="${item.w >= 100 ? 62 : 66}" fill="#ffffff" text-anchor="middle" font-weight="700" letter-spacing="-1"`)}
    ${t(138, 204, esc(p.einheit), 'font-size="16" fill="#f8b46a" text-anchor="middle" font-weight="700"')}
    <rect x="228" y="72" width="116" height="122" rx="10" fill="#0c1118" stroke="#262d38" stroke-width="2"/>
    ${neben}
    ${t(286, 222, 'Zyklus ' + zyklus + ' · 30:2', 'font-size="11" fill="#8b95a5" text-anchor="middle" font-weight="700"')}`;
}

// Fingerkuppe nach dem Drücken und Stoppuhr
function rekap(item, p) {
  const id = 'g' + (++uid);
  const an = '#1d2719', aus = 'rgba(29,39,25,.07)';
  return `
    <defs>
      <linearGradient id="${id}h" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e9b38f"/><stop offset=".5" stop-color="#f6cbac"/><stop offset="1" stop-color="#dba07c"/></linearGradient>
      <radialGradient id="${id}n" cx=".5" cy=".4" r=".6"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#f1d3cf"/></radialGradient>
    </defs>
    <path d="M40,300 L40,110 C40,52 160,52 160,110 L160,300Z" fill="url(#${id}h)" stroke="#b77d5c" stroke-width="2.5"/>
    <path d="M62,128 C62,82 138,82 138,128 L138,168 C138,180 62,180 62,168Z" fill="url(#${id}n)" stroke="#d7a99e" stroke-width="2"/>
    <path d="M56,228 C80,236 120,236 144,228" stroke="#c38a69" stroke-width="2" fill="none" opacity=".6"/>
    ${t(100, 206, 'Nagelbett', 'font-size="11" fill="#7a4a33" text-anchor="middle" font-weight="700"')}
    <path d="M100,22 L100,52" stroke="#55606c" stroke-width="3"/><path d="M90,42 L100,54 L110,42" fill="none" stroke="#55606c" stroke-width="3"/>
    ${t(100, 16, 'drücken – loslassen', 'font-size="11" fill="#55606c" text-anchor="middle" font-weight="700"')}
    <rect x="262" y="36" width="36" height="22" rx="5" fill="#3a4554"/>
    <circle cx="280" cy="164" r="104" fill="#2f3a48" stroke="#1d2530" stroke-width="3"/>
    <circle cx="280" cy="164" r="88" fill="#dfe6ec"/>
    <rect x="212" y="122" width="136" height="80" rx="10" fill="#c5d2bd" stroke="#93a287" stroke-width="3"/>
    ${seg7(lcdZahl(item.w, p), 316, 134, 54, 2, an, aus)}
    ${t(332, 186, 's', `font-size="20" fill="${an}" font-weight="800"`)}
    ${t(280, 112, 'STOPPUHR', 'font-size="10" fill="#55606c" text-anchor="middle" font-weight="800" letter-spacing="2"')}
    ${t(280, 226, 'bis wieder rosig', 'font-size="11" fill="#55606c" text-anchor="middle" font-weight="700"')}`;
}

// Peak-Flow-Meter mit Zeiger und Eintrag im Asthma-Tagebuch (ohne farbige Zonen, sonst wäre die Antwort verraten)
function peakflow(item, p) {
  const id = 'g' + (++uid);
  const d = item.deko || 0;
  const best = 400 + (d % 21) * 10;
  const heute = Math.round(best * item.w / 100 / 10) * 10;
  const x = l => 72 + (Math.max(60, Math.min(800, l)) - 60) / 740 * 250;
  let skala = '';
  for (let l = 100; l <= 800; l += 50) {
    skala += `<line x1="${x(l)}" y1="58" x2="${x(l)}" y2="${l % 100 ? 66 : 72}" stroke="#1d2b3a" stroke-width="${l % 100 ? 1 : 2}"/>`;
    if (!(l % 100)) skala += t(x(l), 50, String(l), 'font-size="9" fill="#1d2b3a" text-anchor="middle" font-weight="700"');
  }
  return `
    <defs><linearGradient id="${id}r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7fafc"/><stop offset="1" stop-color="#cdd8e2"/></linearGradient></defs>
    <rect x="8" y="64" width="54" height="40" rx="10" fill="#7d8b99" stroke="#5c6875" stroke-width="2"/>
    <rect x="54" y="34" width="290" height="98" rx="40" fill="url(#${id}r)" stroke="#9fb0bd" stroke-width="3"/>
    ${skala}
    ${t(334, 120, 'l/min', 'font-size="9" fill="#55606c" text-anchor="end" font-weight="700"')}
    <path d="M${x(heute)},74 l-9,22 l18,0z" fill="#d6402f" stroke="#9a2a1e" stroke-width="1.5"/>
    <rect x="${x(heute) - 2}" y="94" width="4" height="22" fill="#d6402f"/>
    <rect x="20" y="148" width="360" height="132" rx="10" fill="#fffdf6" stroke="#e1d9bf" stroke-width="2"/>
    ${t(36, 172, 'Asthma-Tagebuch', 'font-size="13" fill="#1d2b3a" font-weight="800"')}
    ${t(36, 200, 'Persönlicher Bestwert:', 'font-size="12" fill="#55606c" font-weight="600"')}
    ${t(196, 200, best + ' l/min', 'font-size="12" fill="#1d2b3a" font-weight="800"')}
    ${t(36, 222, 'Heute gemessen:', 'font-size="12" fill="#55606c" font-weight="600"')}
    ${t(196, 222, heute + ' l/min', 'font-size="12" fill="#1d2b3a" font-weight="800"')}
    ${t(36, 260, 'vom Bestwert:', 'font-size="13" fill="#55606c" font-weight="700"')}
    ${t(364, 262, esc(zahl(item.w, p.schritt)) + ' %', 'font-size="44" fill="#1d2b3a" text-anchor="end" font-weight="800"')}`;
}

// Perzentilenkurve (vereinfacht): BMI nach Alter, Linien für die 3./10./50./90./97. Perzentile
function probit(q) {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549671500253125, 4.374664141464968, 2.938163982698783];
  const dd = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const rand = r => (((((c[0] * r + c[1]) * r + c[2]) * r + c[3]) * r + c[4]) * r + c[5]) / ((((dd[0] * r + dd[1]) * r + dd[2]) * r + dd[3]) * r + 1);
  if (q < 0.02425) return rand(Math.sqrt(-2 * Math.log(q)));
  if (q > 0.97575) return -rand(Math.sqrt(-2 * Math.log(1 - q)));
  const r0 = q - 0.5, r = r0 * r0;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * r0 / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}
const MEDIAN = [[2, 16.0], [4, 15.6], [6, 15.4], [8, 15.9], [10, 16.8], [12, 17.9], [14, 19.1], [16, 20.3], [18, 21.3]];
function bmiKurve(alter, perz) {
  let m = MEDIAN[MEDIAN.length - 1][1];
  for (let i = 1; i < MEDIAN.length; i++) if (alter <= MEDIAN[i][0]) { const [x0, y0] = MEDIAN[i - 1], [x1, y1] = MEDIAN[i]; m = y0 + (y1 - y0) * (alter - x0) / (x1 - x0); break; }
  return m * Math.exp(probit(perz / 100) * (0.085 + 0.0045 * alter));
}
function perzentile(item, p) {
  const d = item.deko || 0;
  const alter = 3 + (d % 15), maedchen = d % 2 === 0;
  const X = a => 58 + (a - 2) / 16 * 300, Y = b => 238 - (b - 12) / 22 * 196;
  let gitter = '';
  for (let a = 2; a <= 18; a += 2) gitter += `<line x1="${X(a)}" y1="42" x2="${X(a)}" y2="238" stroke="#e6e9ee" stroke-width="1"/>` + t(X(a), 252, String(a), 'font-size="9" fill="#55606c" text-anchor="middle" font-weight="600"');
  for (let bmi = 14; bmi <= 34; bmi += 4) gitter += `<line x1="58" y1="${Y(bmi)}" x2="358" y2="${Y(bmi)}" stroke="#e6e9ee" stroke-width="1"/>` + t(52, Y(bmi) + 3, String(bmi), 'font-size="9" fill="#55606c" text-anchor="end" font-weight="600"');
  let kurven = '';
  for (const k of [3, 10, 50, 90, 97]) {
    let dpath = '';
    for (let a = 2; a <= 18.001; a += 0.5) dpath += (dpath ? ' L' : 'M') + X(a).toFixed(1) + ',' + Y(bmiKurve(a, k)).toFixed(1);
    kurven += `<path d="${dpath}" fill="none" stroke="${k === 50 ? '#1d2b3a' : '#7d8b99'}" stroke-width="${k === 50 ? 2.2 : 1.5}" ${k === 3 || k === 97 ? 'stroke-dasharray="5 3"' : ''}/>`;
    kurven += t(362, Y(bmiKurve(18, k)) + 3, String(k), 'font-size="9" fill="#55606c" font-weight="700"');
  }
  const bmi = bmiKurve(alter, item.w);
  return `
    <rect x="6" y="4" width="388" height="292" rx="10" fill="#ffffff" stroke="#d6d9e0" stroke-width="2"/>
    ${t(16, 24, 'BMI-Perzentilen (vereinfacht)', 'font-size="12" fill="#1d2b3a" font-weight="800"')}
    ${t(384, 24, maedchen ? 'Mädchen' : 'Jungen', 'font-size="11" fill="#55606c" text-anchor="end" font-weight="700"')}
    ${gitter}
    <line x1="58" y1="238" x2="358" y2="238" stroke="#55606c" stroke-width="1.5"/><line x1="58" y1="42" x2="58" y2="238" stroke="#55606c" stroke-width="1.5"/>
    ${t(208, 270, 'Alter (Jahre)', 'font-size="9" fill="#55606c" text-anchor="middle" font-weight="700"')}
    ${t(18, 140, 'BMI', 'font-size="9" fill="#55606c" font-weight="700" transform="rotate(-90 18 140)"')}
    ${kurven}
    <circle cx="${X(alter)}" cy="${Y(bmi)}" r="6.5" fill="#d6402f" stroke="#fff" stroke-width="2"/>
    <rect x="66" y="48" width="${maedchen ? 168 : 158}" height="50" rx="8" fill="#fff7e8" stroke="#f3d39b" stroke-width="1.5"/>
    ${t(76, 66, (maedchen ? 'Mädchen' : 'Junge') + ', ' + alter + ' Jahre · BMI ' + zahl(Math.round(bmi * 10) / 10, 0.1), 'font-size="10.5" fill="#1d2b3a" font-weight="600"')}
    ${t(76, 90, esc(zahl(item.w, 1)) + '. Perzentile', 'font-size="19" fill="#1d2b3a" font-weight="800"')}`;
}

// Ausschnitt je Gerät (schmale Geräte werden so größer dargestellt)
const AUSSCHNITT = { bz: '62 0 276 300', spo2: '0 20 400 268' };
function waage(item, p) {
  const id = 'g' + (++uid);
  const an = '#1d2719', aus = 'rgba(29,39,25,.07)', lab = 'font-weight="800" fill="#2b3526"';
  const groesse = 155 + ((item.deko || 0) % 41);                         // cm
  const kg = Math.round(item.w * (groesse / 100) ** 2 * 10) / 10;       // passend zum BMI
  return `
    <defs>
      <linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d5dde6"/></linearGradient>
      <linearGradient id="${id}s" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8e98a3"/><stop offset=".5" stop-color="#c9d1d9"/><stop offset="1" stop-color="#8e98a3"/></linearGradient>
    </defs>
    <rect x="184" y="240" width="32" height="70" fill="url(#${id}s)"/>
    <rect x="30" y="14" width="340" height="236" rx="26" fill="url(#${id}g)" stroke="#a9b3be" stroke-width="2.5"/>
    <rect x="50" y="34" width="232" height="196" rx="12" fill="#c5d2bd" stroke="#93a287" stroke-width="3"/>
    ${t(64, 62, 'GRÖSSE', `font-size="11" ${lab}`)}
    ${seg7(groesse, 236, 46, 24, 3, an, aus)}
    ${t(244, 68, 'cm', `font-size="12" ${lab}`)}
    ${t(64, 104, 'GEWICHT', `font-size="11" ${lab}`)}
    ${seg7(zahl(kg, 0.1, false), 236, 86, 26, 4, an, aus)}
    ${t(244, 110, 'kg', `font-size="12" ${lab}`)}
    <line x1="62" y1="124" x2="270" y2="124" stroke="#93a287" stroke-width="2"/>
    ${t(64, 168, 'BMI', `font-size="24" ${lab}`)}
    ${seg7(lcdZahl(item.w, p), 268, 136, 62, 3, an, aus)}
    ${t(268, 220, 'kg/m²', `font-size="12" text-anchor="end" ${lab}`)}
    <circle cx="326" cy="74" r="20" fill="#2f6fd6" stroke="#1f55a8" stroke-width="3"/>
    ${t(326, 78, 'BMI', 'font-size="11" fill="#fff" text-anchor="middle" font-weight="800"')}
    <circle cx="326" cy="140" r="15" fill="#dfe5eb" stroke="#a9b3be" stroke-width="2"/>
    ${t(326, 143, 'TARA', 'font-size="8" fill="#55606c" text-anchor="middle" font-weight="800"')}
    <circle cx="326" cy="194" r="15" fill="#dfe5eb" stroke="#a9b3be" stroke-width="2"/>
    ${t(326, 197, 'HOLD', 'font-size="8" fill="#55606c" text-anchor="middle" font-weight="800"')}`;
}

const GERAETE = { urin: urinBehaelter, cpr, rekap, peakflow, perzentile, waage, ekg: (i, p) => monitor(i, p, 'ekg'), atmung: (i, p) => monitor(i, p, 'atmung'), spo2: pulsoximeter, rr: blutdruck, thermometer, bz: bzGeraet, labor: laborbefund };

// Das fertige SVG für einen Wert
export function geraet(item) {
  const p = wert(item.id);
  if (!p) return '';
  const inner = (GERAETE[p.anzeige] || laborbefund)(item, p);
  return `<svg class="geraet-svg" viewBox="${AUSSCHNITT[p.anzeige] || '0 0 400 300'}" role="img" aria-label="${esc(p.name + ': ' + wertText(item, p))}" preserveAspectRatio="xMidYMid meet" font-family="Rubik,system-ui,sans-serif">${inner}</svg>`;
}
