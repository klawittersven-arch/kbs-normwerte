# KBS Normwert-Blitz

Ein Spiel für die ganze Klasse zu Normwerten (Vitalzeichen und Laborwerte, CE 02/05). Die SuS sehen Messwerte so, wie sie auf Station aussehen: am EKG-Monitor, am Pulsoximeter, am Blutdruckmessgerät, am Ohrthermometer, am Blutzuckermessgerät oder im Laborbefund. Sie entscheiden jedes Mal: **zu niedrig**, **normal** oder **zu hoch**? Das geht per Wischen oder Tippen. Erst spielen alle allein auf dem Handy (Qualifying). Dann spielen die Besten im Finale am Beamer gegeneinander, und alle anderen raten auf dem Handy mit.

| Seite | Adresse | Für wen |
|---|---|---|
| Üben | `/` | alle, auch zu Hause (ohne Klasse, ohne Anmeldung), mit Liste aller Normwerte |
| Klassenmodus | `/lehrer` | Lehrkraft am Laptop mit Beamer |
| Mitspielen | `/mitspielen` | SuS, wird über den QR-Code geöffnet |

**Link für den Beamer (nach der Einrichtung):** `https://kbs-normwerte.klawittersven.workers.dev/lehrer`

Spiel, Gerätegrafiken und Töne: © 2026 Sven Klawitter. Alle Grafiken sind eigene Zeichnungen, ohne Markennamen.

---

## Einmalige Einrichtung bei Cloudflare (etwa 10 Minuten)

Genauso wie bei KBS Simon says, KBS-Kart und Tetris:

1. Bei Cloudflare anmelden: <https://dash.cloudflare.com>
2. Links im Menü **Workers & Pages** öffnen (je nach Ansicht unter **Compute (Workers)**).
3. **Create application** (Anwendung erstellen) wählen, dann **GitHub** bzw. **Import a repository**.
4. Das Repository **kbs-normwerte** auswählen. Falls es nicht in der Liste steht: in den GitHub-Einstellungen der Cloudflare-App den Zugriff auf `kbs-normwerte` erlauben.
5. Einstellungen prüfen:
   - **Project name / Worker name:** `kbs-normwerte` (muss genau so heißen, sonst schlägt der Build fehl)
   - **Build command:** leer lassen
   - **Deploy command:** `npx wrangler deploy` (ist voreingestellt)
   - **Root directory:** leer lassen
6. **Save and Deploy** klicken. Nach ein bis zwei Minuten ist das Spiel online unter `https://kbs-normwerte.klawittersven.workers.dev`.

**Updates:** Jede Änderung, die im Branch `main` dieses GitHub-Repositorys landet, veröffentlicht Cloudflare automatisch.

**Sicherheitsnetz:** Vor jedem Veröffentlichen prüft Cloudflare automatisch die Normwerte-Datei und die Spiellogik. Hast du dich vertippt (zum Beispiel einen Normbereich, der außerhalb von `bereich` liegt), wird **nicht** veröffentlicht. Die alte Version bleibt online. Den Grund siehst du bei Cloudflare unter **Deployments → Build log**, zum Beispiel: „Eintrag 7 (Kalium): Der Normbereich muss innerhalb von bereich liegen“.

---

## Ablauf im Unterricht

1. **Lehrer-Link am Laptop öffnen**, Beamer und Lautsprecher an, **F** für Vollbild. Oben rechts steht der Code der Sitzung.
2. **Anmeldung:** Die SuS scannen den QR-Code und geben ihren Vornamen und den ersten Buchstaben des Nachnamens ein (z. B. „Lena K.“). Die Namen erscheinen am Beamer. Mit **×** entfernst du unpassende Namen.
3. **Einstellungen** (unter den Namen, bleiben gespeichert):
   - **Werte:** Vitalzeichen, Laborwerte oder beides. Voreingestellt sind nur die Vitalzeichen, alle Laborwerte sind abgewählt. Mit den kleinen Knöpfen darunter wählst du einzelne Werte an oder ab, z. B. nur HF, RR und SpO₂ für eine Einführungsstunde.
   - **Stufe:** **Deutlich** (Werte liegen klar im Normbereich oder klar daneben) oder **Knapp** (Werte nah an der Grenze, z. B. AF 21/min oder Kalium 5,1 mmol/l).
   - **Finale:** mit 2, 3, 4, 6 oder 8 Personen.
   - **Leben:** 1, 2 oder 3 Leben im Finale.
4. **Qualifying starten** (Enter). Nach einem Countdown spielen alle **gleichzeitig allein auf dem Handy**. Alle bekommen dieselben Werte in derselben Reihenfolge. Nach **3 Fehlern** ist Schluss, spätestens nach **40 Werten**. Am Beamer läuft eine Live-Rangliste mit Herzen (Leben) und der Zahl der richtigen Antworten. Nachzügler können über den kleinen QR-Code noch einsteigen.
5. Nach jedem Fehler zeigt das Handy die **Auflösung**, z. B. „SpO₂ 89 % ist ▼ zu niedrig. Normal: 95–100 % · Hypoxämie“. Am Ende sieht jede/r die eigenen Fehler noch einmal zum Nachlesen.
6. **Qualifying beenden** (Enter), sobald alle fertig sind (der Knopf blinkt dann). Wer noch spielt, behält den bisherigen Stand.
7. **Finale einrichten:** Die Besten sind vorausgewählt, über die Auswahllisten lässt sich jemand austauschen. Alle Einstellungen lassen sich fürs Finale noch ändern. **Finale starten** (Enter), sobald alle Finalisten-Handys verbunden sind.
8. **Finale:** Der Wert erscheint **nur am Beamer**, groß und als Gerätedisplay (mit Ton, z. B. dem Herzschlag am Monitor). Die Finalisten antworten auf dem Handy, alle anderen **raten auf dem Handy mit** (das zählt nicht fürs Finale). Nach jedem Wert zeigt der Beamer die Auflösung, wer richtig lag und wie viele aus dem Publikum richtig geraten haben. Ein Fehler oder keine Antwort kostet ein Leben. Wer keine Leben mehr hat, ist raus und rät ab dann im Publikum mit. Wer zuletzt übrig ist, gewinnt.
9. **Siegerehrung** mit Pokal, Platzierungen, den Besten im Publikum und allen Werten des Finales zum Nachlesen. Danach **Revanche** (Enter, gleiche Finalisten, neue Werte), **Andere Finalisten** oder **Neues Spiel** (Esc, zurück zur Anmeldung, alle bleiben angemeldet).

### Regeln im Detail

- **Zeit pro Wert (Qualifying):** 10 Sekunden, alle 5 Werte 1 Sekunde weniger, nie unter 5 Sekunden. Getestet wird Wissen, nicht Tipptempo.
- **Zeit pro Wert (Finale):** 10 Sekunden, alle 3 Werte 1 Sekunde weniger, nie unter 4 Sekunden. Haben alle Finalisten geantwortet, bekommt das Publikum noch 2 Sekunden, dann kommt die Auflösung. Hat das ganze Publikum auch schon geantwortet, kommt sie sofort.
- **Rangliste im Qualifying:** mehr richtige Antworten vorn, bei Gleichstand weniger Fehler, dann die schnelleren Antworten.
- **Sudden Death:** Ab dem 30. Wert im Finale kostet jeder Fehler alle Leben, damit das Finale sicher endet.
- Scheiden die letzten Finalisten beim selben Wert aus, steht vorn, wer im Finale mehr richtig hatte, bei Gleichstand, wer schneller geantwortet hat.
- Jeder Wert kommt etwa gleich oft dran, nie zweimal direkt hintereinander. „Zu niedrig“, „normal“ und „zu hoch“ kommen etwa gleich oft vor. Bei SpO₂ und Quick gibt es kein „zu hoch“, bei CRP und Kreatinin kein „zu niedrig“.
- Beim Blutdruck sind immer beide Werte gleich eingeordnet (z. B. 85/50 oder 165/100, nie 150/60). Der Puls auf dem Blutdruckgerät und dem Pulsoximeter ist immer normal und wird nicht abgefragt.
- Die Geräte zeigen keine Alarmgrenzen oder Normbereiche an, sonst wäre die Antwort verraten.

### Wischen und Tippen

| Antwort | Wischen über das Gerät | Knopf |
|---|---|---|
| zu niedrig | nach links ◀ | ▼ zu niedrig |
| normal | nach oben ▲ | ● normal |
| zu hoch | nach rechts ▶ | ▲ zu hoch |

Auf der Übungsseite am Laptop gehen auch die Pfeiltasten (← ↑ →).

### Tasten am Beamer

| Taste | Funktion |
|---|---|
| Enter | Qualifying starten / beenden, Finale starten, Revanche |
| Esc | Neues Spiel (zurück zur Anmeldung) |
| F | Vollbild |
| M | Ton an/aus |

**Tipps**
- Die Handys sind immer stumm, auch auf der Übungsseite. Ton gibt es nur im Finale über den Beamer-Laptop (mit **M** oder dem Knopf oben rechts ausschaltbar).
- Der Bildschirm der Handys bleibt während des Spiels an (sofern der Browser das unterstützt).
- Wer die Seite versehentlich schließt, scannt den QR-Code noch einmal. Das Handy wird wiedererkannt, solange derselbe Browser benutzt wird. Im Qualifying geht es mit dem nächsten Wert weiter.
- **Mehrere Klassen gleichzeitig:** Jede Lehrkraft öffnet `/lehrer` und bekommt einen eigenen Code. **Sitzung → Neue Sitzung** erzeugt einen neuen Code.

---

## Normwerte ändern

Alle Werte stehen in **`public/js/normwerte.js`**. So änderst du sie: Auf GitHub die Datei öffnen, auf den Stift klicken, ändern, dann „Commit changes“. Nach ein bis zwei Minuten gilt die Änderung überall.

Ein Eintrag sieht so aus:

```js
{
  id: 'af', gruppe: 'vital', name: 'Atemfrequenz', kurz: 'AF', anzeige: 'atmung', einheit: '/min',
  normal: [12, 20], bereich: [5, 40], abstand: 4, schritt: 1,
  niedrig: 'Bradypnoe', hoch: 'Tachypnoe',
},
```

- **normal**: Normbereich. Beide Grenzen zählen noch als „normal“. Diesen Wert wirst du am ehesten an euer Lehrbuch anpassen.
- **bereich**: kleinster und größter Wert, der im Spiel vorkommt.
- **abstand**: In der Stufe „Deutlich“ liegen auffällige Werte mindestens so weit von der Grenze weg. In der Stufe „Knapp“ liegen sie höchstens so weit weg.
- **niedrig** / **hoch**: Fachbegriff, der in der Auflösung erscheint.
- Zahlen mit **Punkt** schreiben (`3.5`), im Spiel steht dann ein Komma (3,5).
- Die `id` nicht ändern. Neue Werte: einen Eintrag kopieren, eine neue `id` vergeben (nur Kleinbuchstaben) und anpassen. Welche Geräte es gibt, steht oben in der Datei.

**Eingestellt sind diese Normbereiche für Erwachsene. Bitte einmal mit eurem Lehrbuch vergleichen:**

| Wert | normal | | Wert | normal |
|---|---|---|---|---|
| Herzfrequenz | 60–100/min | | Kalium | 3,5–5,0 mmol/l |
| Blutdruck | 100–139 / 60–89 mmHg | | Natrium | 135–145 mmol/l |
| SpO₂ | 95–100 % | | Hämoglobin | Frauen 12–16, Männer 14–18 g/dl |
| Atemfrequenz | 12–20/min | | Leukozyten | 4.000–10.000/µl |
| Körpertemperatur | 36,3–37,4 °C | | Thrombozyten | 150.000–400.000/µl |
| Blutzucker nüchtern | 70–100 mg/dl | | CRP | unter 5 mg/l |
| | | | Kreatinin | 0,5–1,2 mg/dl |
| | | | Quick | 70–130 % |

Die Übungsseite zeigt unter **Normwerte ansehen** immer die aktuelle Liste aus der Datei.

---

## Datenschutz

- **Gespeichert wird nur:** Vorname mit Anfangsbuchstabe des Nachnamens und die Spielergebnisse. Keine Konten, keine E-Mail-Adressen, keine Cookies, keine Werbung, kein Tracking.
- Die Daten liegen im Klassenraum-Speicher bei Cloudflare und werden **6 Stunden nach der letzten Änderung automatisch gelöscht**. Sofort löschen: **Sitzung → Sitzung beenden und Daten jetzt löschen**.
- Im Browser der Handys speichert die Seite eine zufällige Geräte-Kennung und den zuletzt eingegebenen Namen. Die Übungsseite speichert nur die eigenen Rekorde im Browser.
- Schriften, Grafiken und Programmbibliotheken liegen im Projekt selbst. Die Seiten laden nichts von Google oder anderen Drittanbietern nach.
- Cloudflare ist ein US-Anbieter. Stimme den Einsatz am besten kurz mit der Schulleitung oder dem Datenschutzbeauftragten ab.

## Kosten

Der kostenlose Cloudflare-Tarif reicht aus. Im Qualifying schickt jedes Handy pro Antwort eine kurze Nachricht, im Finale ebenso. Eine Unterrichtsstunde mit 30 SuS braucht grob 2.000 bis 4.000 Nachrichten. Das liegt weit unter den Grenzen des kostenlosen Tarifs.

---

## Notlösung ohne Cloudflare: Laptop als Server

1. [Node.js](https://nodejs.org) installieren (Version 18 oder neuer).
2. Das Repository herunterladen (bei GitHub: **Code → Download ZIP**) und entpacken.
3. Im Projektordner ein Terminal öffnen und `node server/local.mjs` eingeben.
4. Die angezeigte Adresse „Im Netz: http://192.168.…:8787/lehrer“ am Laptop öffnen (nicht `localhost`), damit der QR-Code die Netzwerkadresse enthält.

Voraussetzung: Handys und Laptop sind im selben WLAN, und das WLAN erlaubt Verbindungen zwischen den Geräten.

---

## Technik

| Datei | Inhalt |
|---|---|
| `public/js/normwerte.js` | ← die Normwerte (Normbereiche, Fachbegriffe, Gerät) |
| `public/js/regeln.js` | Regeln, Zeiten, Prüfen der Normwerte-Datei, Erzeugen der Werte (gilt für Handys, Beamer und Server) |
| `public/js/geraete.js` | Gerätedisplays als SVG (Monitor, Pulsoximeter, Blutdruckgerät, Thermometer, BZ-Gerät, Laborbefund) |
| `public/js/antwort.js` | Antwortknöpfe und Wischen |
| `public/js/spiel.js` | Spiel allein auf dem Handy (Qualifying und Üben) |
| `public/js/ui.js` | Gemeinsame Anzeige-Bausteine (Auflösung, Herzen, Zeitbalken) |
| `public/js/lehrer.js` | Beamer-Seite: Anmeldung, Rangliste, Finale, Siegerehrung |
| `public/js/mitspielen.js` | Handy-Seite: Anmeldung, Qualifying, Finale und Mitraten |
| `public/js/ueben.js` | Übungsseite mit Normwerte-Liste |
| `public/js/ton.js` | Töne (Web Audio, ohne Dateien) |
| `public/js/net.js` | WebSocket-Verbindung mit Wiederverbinden und Uhrabgleich |
| `src/room.js` | Raum-Logik einer Klasse (unabhängig vom Server) |
| `src/worker.js` | Cloudflare Worker und Durable Object (ein Raum je Code) |
| `server/local.mjs` | Lokaler Server ohne Zusatzpakete |

Im Finale entscheidet der Server, wann ein Wert erscheint und wann er ausgewertet wird. Beamer und Handys gleichen ihre Uhren mit dem Server ab. Die Handys erfahren den Wert und die richtige Antwort erst nach der Auflösung. Nur der Beamer kennt den aktuellen Wert.

### Tests

```
npm test                                   # Normwerte-Datei, Werte erzeugen, Regeln und Raum-Logik (läuft auch bei Cloudflare vor jedem Veröffentlichen)
node tests/e2e.mjs                         # Browser-Durchlauf: Beamer + 5 Handys (Playwright), Bildschirmfotos in tests/ergebnisse/
node tests/e2e.mjs http://127.0.0.1:8787   # derselbe Durchlauf gegen „npx wrangler dev“ (echte Cloudflare-Umgebung)
```

Der Browser-Durchlauf prüft:
- Anmeldung und Qualifying mit richtigen und falschen Antworten (getippt und gewischt), abgelaufener Zeit und einem neu geladenen Handy.
- Die Rangliste.
- Ein Finale mit 4 Personen und 2 Leben (Leben verlieren, Ausscheiden, keine Antwort, Platzierungen) mit Mitraten aus dem Publikum.
- Ein zweites Finale mit 2 Personen, 1 Leben, nur Laborwerten und der Stufe „Knapp“.
- Die Übungsseite und die Normwerte-Liste.
- Dass Handys und Übungsseite keinen Ton abspielen.

**Lizenzen:** Schriften Bungee und Rubik unter SIL Open Font License (siehe `public/fonts/`). QR-Code-Generator von Kazuhiko Arase unter MIT-Lizenz (`public/js/qrcode.js`). Das Schullogo gehört der Karoline-Breitinger-Schule.

---

© 2026 Sven Klawitter
