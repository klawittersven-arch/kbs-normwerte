// Browser-Durchlauf: Beamer + 5 Handys durch Anmeldung, Qualifying, Finale (mit Mitraten), zweites Finale und Übungsseite.
// Start:  node tests/e2e.mjs      (startet den lokalen Server selbst; Bildschirmfotos in tests/ergebnisse/)
// Playwright muss installiert sein. Andere Installation: PLAYWRIGHT=/pfad/zu/playwright/index.js node tests/e2e.mjs
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const pw = await import(process.env.PLAYWRIGHT || require.resolve('playwright', { paths: [process.cwd(), ...(process.env.NODE_PATH || '').split(':'), '/opt/node-tools/node_modules'] }));
const { chromium } = pw.default || pw;
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'tests', 'ergebnisse');
fs.mkdirSync(OUT, { recursive: true });
// Mit Adresse (z. B. node tests/e2e.mjs http://127.0.0.1:8787 bei laufendem „npx wrangler dev“) wird kein eigener Server gestartet
const PORT = 8791, BASE = process.argv[2] || `http://127.0.0.1:${PORT}`;
let srv = null;
if (!process.argv[2]) {
  srv = spawn(process.execPath, [path.join(ROOT, 'server', 'local.mjs')], { env: { ...process.env, PORT: String(PORT) }, stdio: 'pipe' });
  await new Promise(r => srv.stdout.once('data', r));
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const KAT = ['niedrig', 'normal', 'hoch'];
const falsch = k => KAT[(KAT.indexOf(k) + 1) % 3];
// Testhilfe auf jeder Seite; zählt außerdem, ob eine Seite Ton startet (Handys müssen stumm bleiben)
const vorbereiten = () => {
  window.__nwTest = {};
  window.__audio = 0;
  const A = window.AudioContext || window.webkitAudioContext;
  if (!A) return;
  const Z = function (...a) { window.__audio++; return new A(...a); };
  Z.prototype = A.prototype;
  window.AudioContext = window.webkitAudioContext = Z;
};
const log = (...a) => console.log(new Date().toISOString().slice(14, 23), ...a);
const errors = [];
const browser = await chromium.launch();
let ok = false;

// Antwort per Knopf oder per Wischen über das Gerät
async function antworte(p, a, wischen) {
  if (!wischen) return p.locator(`#antworten .ant[data-a="${a}"]`).click({ force: true });
  const b = await p.locator('#wertfeld').boundingBox();
  const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
  const [zx, zy] = a === 'niedrig' ? [cx - 140, cy] : a === 'hoch' ? [cx + 140, cy] : [cx, cy - 140];
  await p.mouse.move(cx, cy); await p.mouse.down();
  await p.mouse.move((cx + zx) / 2, (cy + zy) / 2, { steps: 3 });
  await p.mouse.move(zx, zy, { steps: 3 }); await p.mouse.up();
}
const offen = p => p.waitForFunction(() => document.querySelector('#antworten.aktiv'), null, { timeout: 30000 });

try {
  const tctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  await tctx.addInitScript(vorbereiten);
  const T = await tctx.newPage();
  T.on('pageerror', e => errors.push('Beamer: ' + e.message));
  T.on('dialog', d => d.accept());
  await T.goto(BASE + '/lehrer');
  await T.waitForSelector('#qr');
  const code = (await T.textContent('#codeChip')).replace('Code ', '').trim();
  log('Code', code);

  const names = [['Lena', 'K'], ['Tom', 'B'], ['Aylin', 'S'], ['Max', 'M'], ['Sara', 'P']];
  const phones = {};
  for (const [first, ini] of names) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    await ctx.addInitScript(vorbereiten);
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push(first + ': ' + e.message));
    await p.goto(`${BASE}/mitspielen?c=${code}`);
    await p.fill('#fFirst', first); await p.fill('#fInit', ini);
    await p.click('button[type=submit]');
    await p.waitForSelector('.waitdots');
    phones[first] = { p, name: first };
  }
  await T.waitForFunction(() => document.querySelectorAll('.name').length === 5);
  await T.screenshot({ path: path.join(OUT, '01-beamer-lobby.png') });
  await phones.Lena.p.screenshot({ path: path.join(OUT, '02-handy-warten.png') });

  // Voreinstellung: Vitalzeichen an, alle Laborwerte und Zusatzoptionen (z. B. BMI) aus
  const { WERTE, standardIds } = await import('../public/js/regeln.js');
  const soll = WERTE.filter(p => standardIds().includes(p.id)).map(p => p.kurz).join(',');
  const ist = await T.$$eval('#wchips .wchip', els => els.filter(e => e.getAttribute('aria-pressed') === 'true').map(e => e.textContent).join(','));
  if (ist !== soll) throw new Error('Voreinstellung falsch: ' + ist + ' statt ' + soll);
  if (WERTE.some(p => p.id === 'bmi') && soll.includes('BMI')) throw new Error('BMI sollte nicht vorausgewählt sein');
  if ((await T.getAttribute('.seg[aria-label="Werte"] button:has-text("Vitalzeichen")', 'aria-checked')) !== 'true') throw new Error('„Vitalzeichen“ nicht vorausgewählt');
  log('Voreinstellung: nur Vitalzeichen ✓');

  // ---------------- Qualifying (alle Werte, Stufe „Deutlich“, Finale mit 4 Personen und 2 Leben)
  await T.click('.seg[aria-label="Werte"] button:has-text("Beides")');
  await T.click('.seg[aria-label="Leben im Finale"] button:has-text("2 Leben")');
  await sleep(300);
  await T.keyboard.press('Enter');

  // Plan je Handy: Anzahl richtiger Antworten vor den Fehlern, Pause pro Antwort, Zeit ablaufen lassen?
  async function qualiSpielen(ph, plan) {
    const p = ph.p;
    let richtig = 0, fehler = 0, n = 0;
    while (true) {
      await offen(p);
      const { i, kat } = await p.evaluate(() => window.__nwTest.solo);
      if (i !== n) throw new Error(`${ph.name}: Wert ${n + 1} erwartet, gezeigt ${i + 1}`);
      if (ph.name === 'Lena' && n === 1) await p.screenshot({ path: path.join(OUT, '03-handy-quali-wert.png') });
      if (plan.neuLaden === n) {
        // Seite neu laden: Es muss mit demselben Wert weitergehen (Stand vom Server)
        await p.reload();
        await offen(p);
        const w = await p.evaluate(() => window.__nwTest.solo);
        if (w.i !== n) throw new Error(`${ph.name}: Nach dem Neuladen Wert ${w.i + 1} statt ${n + 1}`);
        plan.neuLaden = -1;
        log(ph.name, 'neu geladen, weiter bei Wert', n + 1);
        continue;
      }
      if (plan.langsam) await sleep(plan.langsam);
      let war = 'ok';
      if (richtig < plan.richtig) {
        await antworte(p, kat, n % 3 === 1);
        richtig++;
      } else if (plan.zeit && fehler === 0) {
        war = 'zeit';
        await p.waitForSelector('#fbWeiter', { timeout: 15000 });
        if (ph.name === 'Aylin') await p.screenshot({ path: path.join(OUT, '04-handy-quali-zeit-um.png') });
        fehler++;
      } else {
        await antworte(p, falsch(kat), n % 2 === 0);
        fehler++;
        war = 'falsch';
        if (ph.name === 'Tom' && fehler === 1) { await sleep(300); await p.screenshot({ path: path.join(OUT, '05-handy-quali-falsch.png') }); }
      }
      n++;
      if (fehler >= 3 || n >= 40) return;
      if (war !== 'ok') {
        // Auflösung kurz lesen, dann „Weiter“
        await p.waitForSelector('#fbWeiter', { timeout: 5000 });
        await sleep(200);
        await p.click('#fbWeiter', { force: true });
      }
    }
  }
  await Promise.all([
    qualiSpielen(phones.Lena, { richtig: 40 }),
    qualiSpielen(phones.Tom, { richtig: 10 }),
    qualiSpielen(phones.Aylin, { richtig: 5, zeit: true }),
    qualiSpielen(phones.Max, { richtig: 10, langsam: 350, neuLaden: 4 }),
    qualiSpielen(phones.Sara, { richtig: 0 }),
  ]);
  log('Qualifying gespielt');
  await phones.Lena.p.waitForSelector('.placebox', { timeout: 15000 });
  await phones.Tom.p.waitForSelector('.placebox', { timeout: 15000 });
  await sleep(600);
  await phones.Tom.p.screenshot({ path: path.join(OUT, '06-handy-quali-ergebnis.png'), fullPage: true });
  await T.waitForFunction(() => document.querySelector('#qCount') && document.querySelector('#qCount').textContent.startsWith('5/5'), null, { timeout: 15000 });
  await T.screenshot({ path: path.join(OUT, '07-beamer-quali-rangliste.png') });
  const order = await T.$$eval('.rk .nm', els => els.map(e => e.textContent));
  const zahlen = await T.$$eval('.rk .lv', els => els.map(e => e.textContent));
  log('Rangliste', order.map((n, i) => n + ' ' + zahlen[i]).join(', '));
  if (order.join() !== 'Lena K.,Tom B.,Max M.,Aylin S.,Sara P.') throw new Error('Rangliste falsch: ' + order.join());
  if (zahlen.join() !== '40,10,10,5,0') throw new Error('Punkte falsch: ' + zahlen.join());

  // ---------------- Finale: 4 Personen, 2 Leben, Sara rät mit
  await T.keyboard.press('Enter');
  await T.waitForSelector('#slots select');
  await sleep(300);
  await T.screenshot({ path: path.join(OUT, '08-beamer-finale-auswahl.png') });
  await phones.Lena.p.waitForSelector('text=Du bist im Finale');
  await T.keyboard.press('Enter');
  await T.waitForSelector('#fGeraet');
  const fin = ['Lena', 'Tom', 'Max', 'Aylin'];
  // Plan je Wert: 'ok', 'falsch', 'zeit'
  const plan = {
    1: { Lena: 'ok', Tom: 'ok', Max: 'ok', Aylin: 'ok', Sara: 'ok' },
    2: { Lena: 'ok', Tom: 'ok', Max: 'ok', Aylin: 'falsch', Sara: 'falsch' },
    3: { Lena: 'ok', Tom: 'ok', Max: 'zeit', Aylin: 'falsch', Sara: 'ok' },
    4: { Lena: 'ok', Tom: 'falsch', Max: 'falsch', Sara: 'ok', Aylin: 'ok' },
    5: { Lena: 'ok', Tom: 'falsch', Sara: 'ok', Aylin: 'ok', Max: 'ok' },
  };
  for (let r = 1; r <= 5; r++) {
    await T.waitForFunction(r => window.__nwTest.final && window.__nwTest.final.round === r, r, { timeout: 30000 });
    const kat = await T.evaluate(() => window.__nwTest.final.kat);
    log('Finale Wert', r, 'richtig wäre', kat);
    if (r === 2) { await sleep(700); await T.screenshot({ path: path.join(OUT, '09-beamer-finale-wert.png') }); }
    await Promise.all(Object.entries(plan[r]).map(async ([name, what]) => {
      const p = phones[name].p;
      if (what === 'zeit') return;
      await offen(p);
      await antworte(p, what === 'ok' ? kat : falsch(kat), name === 'Sara' && r === 3);
    }));
    if (r === 1) {
      await sleep(200);
      await phones.Sara.p.screenshot({ path: path.join(OUT, '10-handy-mitraten.png') });
    }
    if (r === 3) {
      await sleep(400);
      await T.screenshot({ path: path.join(OUT, '11-beamer-finale-warten.png') });
      await phones.Max.p.screenshot({ path: path.join(OUT, '12-handy-finale-schau-zum-beamer.png') });
    }
    // Auflösung abwarten
    await T.waitForSelector('#fAufl:not([hidden])', { timeout: 20000 });
    if (process.env.DEBUG) log('  Auflösung:', (await T.textContent('#fAufl')).replace(/\s+/g, ' '), '| Sara:', await phones.Sara.p.textContent('#sLeben'));
    if (r === 2) {
      await sleep(500);
      await T.screenshot({ path: path.join(OUT, '13-beamer-finale-aufloesung.png') });
      await phones.Aylin.p.screenshot({ path: path.join(OUT, '14-handy-finale-leben-weg.png') });
    }
  }
  await T.waitForSelector('.winner', { timeout: 30000 });
  await sleep(1200);
  await T.screenshot({ path: path.join(OUT, '15-beamer-siegerehrung.png') });
  const places = await T.$$eval('.places li', els => els.map(e => e.textContent.trim()));
  log('Plätze', places.join(' | '));
  if (!places[0].startsWith('1. Lena') || !places[1].startsWith('2. Tom') || !places[2].startsWith('3. Max') || !places[3].startsWith('4. Aylin')) throw new Error('Plätze falsch');
  const pub = await T.textContent('.pubbest');
  if (!pub.includes('Sara P.') || !pub.includes('4 von 5')) throw new Error('Publikum falsch: ' + pub);
  await phones.Lena.p.waitForSelector('text=Du hast gewonnen', { timeout: 10000 });
  await phones.Lena.p.screenshot({ path: path.join(OUT, '16-handy-sieg.png'), fullPage: true });
  await phones.Sara.p.waitForSelector('text=gewinnt', { timeout: 10000 });
  await phones.Sara.p.screenshot({ path: path.join(OUT, '17-handy-zuschauer-ende.png'), fullPage: true });

  // ---------------- Andere Finalisten: 2 Personen, 1 Leben, nur Laborwerte, Stufe „Knapp“
  await T.click('#btnOther');
  await T.waitForSelector('#slots select');
  await T.click('.seg[aria-label="Größe des Finales"] button:has-text("2 Personen")');
  await T.click('.seg[aria-label="Leben im Finale"] button:has-text("1 Leben")');
  await T.click('.seg[aria-label="Werte"] button:has-text("Laborwerte")');
  await T.click('.seg[aria-label="Stufe"] button:has-text("Knapp")');
  await sleep(600);
  await T.keyboard.press('Enter');
  await T.waitForFunction(() => window.__nwTest.final && window.__nwTest.final.round === 1 && document.querySelector('#fGeraet svg'), null, { timeout: 30000 });
  await sleep(500);
  await T.screenshot({ path: path.join(OUT, '18-beamer-finale-labor.png') });
  const geraet = await T.getAttribute('#fGeraet svg', 'aria-label');
  log('Finale 2, Wert 1:', geraet);
  const kat2 = await T.evaluate(() => window.__nwTest.final.kat);
  await offen(phones.Lena.p); await offen(phones.Tom.p);
  await antworte(phones.Tom.p, kat2);
  await antworte(phones.Lena.p, falsch(kat2));
  await T.waitForSelector('.winner', { timeout: 30000 });
  const places2 = await T.$$eval('.places li', els => els.map(e => e.textContent.trim()));
  log('Plätze', places2.join(' | '));
  if (!places2[0].startsWith('1. Tom')) throw new Error('Plätze (Finale 2) falsch');
  const nachlesen = await T.$$eval('.seqcard .aufl .wt', els => els.map(e => e.textContent));
  if (!nachlesen.length || !/K⁺|Na⁺|Hb|Leukos|Thrombos|CRP|Krea|Quick/.test(nachlesen[0])) throw new Error('Laborwert erwartet: ' + nachlesen.join());

  // ---------------- Drittes Finale: nur die Zusatzoption BMI (Knopf an, alle Laborwerte aus)
  if (WERTE.some(p => p.id === 'bmi')) {
    await T.click('#btnOther');
    await T.waitForSelector('#wchips .wchip');
    await T.click('#wchips .wchip:text-is("BMI")');
    for (const p of WERTE.filter(x => x.gruppe === 'labor')) await T.click(`#wchips .wchip:text-is("${p.kurz}")`);
    const an = await T.$$eval('#wchips .wchip', els => els.filter(e => e.getAttribute('aria-pressed') === 'true').map(e => e.textContent).join(','));
    if (an !== 'BMI') throw new Error('Nur BMI erwartet, ausgewählt: ' + an);
    await sleep(600);
    await T.keyboard.press('Enter');
    await T.waitForFunction(() => window.__nwTest.final && window.__nwTest.final.round === 1 && document.querySelector('#fGeraet svg'), null, { timeout: 30000 });
    await sleep(500);
    await T.screenshot({ path: path.join(OUT, '18b-beamer-finale-bmi.png') });
    const bmi = await T.getAttribute('#fGeraet svg', 'aria-label');
    log('Finale 3 (nur BMI), Wert 1:', bmi);
    if (!/BMI \d+,\d kg\/m²/.test(bmi)) throw new Error('BMI erwartet: ' + bmi);
    const kat3 = await T.evaluate(() => window.__nwTest.final.kat);
    await offen(phones.Lena.p); await offen(phones.Tom.p);
    await antworte(phones.Lena.p, kat3);
    await antworte(phones.Tom.p, falsch(kat3), true);
    await T.waitForSelector('.winner', { timeout: 30000 });
    const p3 = await T.$$eval('.places li', els => els.map(e => e.textContent.trim()));
    log('Plätze', p3.join(' | '));
    if (!p3[0].startsWith('1. Lena')) throw new Error('Plätze (Finale 3) falsch');
  }

  // ---------------- Übungsseite
  const uctx = await browser.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  await uctx.addInitScript(vorbereiten);
  const U = await uctx.newPage();
  U.on('pageerror', e => errors.push('Üben: ' + e.message));
  await U.goto(BASE + '/');
  await U.screenshot({ path: path.join(OUT, '19-ueben-menue.png') });
  await U.click('.seg[data-name="werte"] button[data-v="vital"]');
  await U.click('#btnGo');
  for (let k = 0; k < 4; k++) {
    await offen(U);
    const { kat } = await U.evaluate(() => window.__nwTest.solo);
    if (k === 2) await U.screenshot({ path: path.join(OUT, '20-ueben-spiel.png') });
    await antworte(U, k < 3 ? kat : falsch(kat), k === 1);
  }
  await U.waitForSelector('#fbWeiter');
  await U.screenshot({ path: path.join(OUT, '21-ueben-falsch.png') });
  await U.click('#btnStop');
  await U.click('#btnListe');
  await U.waitForSelector('.nliste');
  await U.screenshot({ path: path.join(OUT, '22-ueben-normwerte.png'), fullPage: true });

  for (const ph of Object.values(phones)) if (await ph.p.evaluate(() => window.__audio)) throw new Error(ph.name + ': Handy hat Ton gestartet');

  // ---------------- Falscher Code: „Raum nicht gefunden“
  const fctx = await browser.newContext({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true });
  const F = await fctx.newPage();
  F.on('pageerror', e => errors.push('Falscher Code: ' + e.message));
  await F.goto(`${BASE}/mitspielen?c=ZZZZ9`);
  await F.waitForSelector('text=Raum nicht gefunden', { timeout: 15000 });
  log('Falscher Code: „Raum nicht gefunden“ ✓');

  // ---------------- Sitzung beenden: Handys zeigen „Das Spiel ist beendet“
  await T.click('#btnSess'); await T.click('#btnWipe');
  await Promise.all(Object.values(phones).map(ph => ph.p.waitForSelector('text=Das Spiel ist beendet', { timeout: 15000 })));
  await phones.Sara.p.screenshot({ path: path.join(OUT, '23-handy-sitzung-beendet.png') });
  await T.waitForFunction(c => !document.querySelector('#codeChip').textContent.includes(c), code, { timeout: 15000 });
  log('Sitzung gelöscht, Beamer hat einen neuen Code ✓');
  if (await U.evaluate(() => window.__audio)) throw new Error('Übungsseite hat Ton gestartet');
  log('Handys und Übungsseite stumm ✓');
  if (errors.length) throw new Error('JavaScript-Fehler:\n' + errors.join('\n'));
  ok = true;
  log('ALLES OK');
} catch (e) {
  console.error('FEHLER:', e.message);
  if (errors.length) console.error(errors.join('\n'));
} finally {
  await browser.close();
  if (srv) srv.kill();
  process.exit(ok ? 0 : 1);
}
