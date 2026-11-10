// Erzeugt das abonnierbare Kalender-Feed (calendar.ics) aus den Terminen der Seite.
// Enthalten: Broncos-Spiele (Erinnerung 5 Min vorher), F1- und WEC-Rennen (Erinnerung 30 Min vorher).
// Aufruf: node scripts/build-ics.mjs <ziel.ics>
// Lädt index.html in Chrome/Chromium und liest die Termine über window.__BBT_EVENTS() aus.
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.argv[2] || path.join(ROOT, "calendar.ics");
const ALARM = { broncos: 5, redbull: 30, toyota: 30 }; // Minuten vor Beginn
const SITE = "https://huddryone.github.io/ClaudeCode/";

let chromium, launch = {};
try { ({ chromium } = require("playwright")); }
catch { ({ chromium } = require("playwright-core")); launch = { executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome", args: ["--no-sandbox"] }; }

const browser = await chromium.launch(launch);
const page = await browser.newPage();
await page.route(/^https?:/, (r) => r.abort()); // keine Abfragen nach außen (z. B. ESPN-Live-Daten)
await page.goto(pathToFileURL(path.join(ROOT, "index.html")).href);
const events = await page.evaluate(() => window.__BBT_EVENTS());
await browser.close();

const esc = (t) => String(t || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const stamp = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
function fold(line) { // max. 75 Bytes pro Zeile
  const out = []; let cur = "";
  for (const ch of line) {
    if (Buffer.byteLength(cur + ch) > (out.length ? 74 : 75)) { out.push(cur); cur = ""; }
    cur += ch;
  }
  out.push(cur);
  return out.join("\r\n ");
}

const now = new Date();
const lines = [
  "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Broncos Bulls Toyota//Sportkalender//DE", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
  "X-WR-CALNAME:Broncos · Red Bull · Toyota", "X-WR-CALDESC:Broncos-Spiele\\, F1- und WEC-Rennen", "X-WR-TIMEZONE:Europe/Vienna",
  "REFRESH-INTERVAL;VALUE=DURATION:PT6H", "X-PUBLISHED-TTL:PT6H"
];
let count = 0;
for (const e of events) {
  if (e.bye) continue;
  const s = e.sessions.find((x) => x.main);
  if (!s) continue;
  if (e.series !== "NFL" && !/Rennen/.test(s.name)) continue;
  const uid = `bbt-${e.team}-${(s.start || "").slice(0, 10)}-${e.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}@huddryone.github.io`;
  const title = (e.series === "NFL" ? "🏈 " : e.series === "F1" ? "🏎️ " : "🏁 ") + e.title + (e.series === "NFL" ? "" : " – " + s.name);
  const desc = [e.round, e.result ? "Ergebnis: " + e.result : "", e.tv.length ? "In Österreich: " + e.tv.join(" / ") : "", s.tbd ? "Anstoßzeit noch offen – wird automatisch nachgetragen." : "", SITE].filter(Boolean).join("\n");
  lines.push("BEGIN:VEVENT", "UID:" + uid, "DTSTAMP:" + stamp(now), "SUMMARY:" + esc(title), "LOCATION:" + esc(e.venue), "DESCRIPTION:" + esc(desc), "URL:" + SITE);
  if (s.dateOnly || s.tbd) {
    const d0 = s.start.slice(0, 10).replace(/-/g, ""), d1 = new Date(Date.parse(s.start.slice(0, 10) + "T00:00:00Z") + 864e5).toISOString().slice(0, 10).replace(/-/g, "");
    lines.push("DTSTART;VALUE=DATE:" + d0, "DTEND;VALUE=DATE:" + d1, "TRANSP:TRANSPARENT");
  } else {
    const st = new Date(s.start), en = new Date(st.getTime() + (s.dur || (e.series === "NFL" ? 210 : 120)) * 60e3);
    lines.push("DTSTART:" + stamp(st), "DTEND:" + stamp(en));
    const m = ALARM[e.team];
    if (m) lines.push("BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + esc(e.title + " beginnt in " + m + " Minuten"), "TRIGGER:-PT" + m + "M", "END:VALARM");
  }
  lines.push("END:VEVENT");
  count++;
}
lines.push("END:VCALENDAR");
// Unveränderte Termine behalten ihren alten Zeitstempel, damit die Datei nur bei echten Änderungen neu ist.
const text = lines.map(fold).join("\r\n") + "\r\n";
const noStamp = (t) => t.replace(/^DTSTAMP:.*$/gm, "");
let prev = "";
try { prev = await readFile(OUT, "utf8"); } catch {}
if (prev && noStamp(prev) === noStamp(text)) {
  console.log(`Kalender-Feed unverändert (${count} Termine): ${OUT}`);
} else {
  await writeFile(OUT, text);
  console.log(`Kalender-Feed mit ${count} Terminen geschrieben: ${OUT}`);
}
