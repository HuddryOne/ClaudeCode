// Holt täglich aktuelle Daten und schreibt sie in data/live.json und in den
// <script id="live-data">-Block von index.html.
//
// Quellen (frei, ohne API-Schlüssel):
//   Formel 1: Jolpica F1 API (Nachfolger der Ergast API)
//   NFL:      öffentliche ESPN-Endpunkte (Tabelle, Broncos-Kader, Broncos-Spielplan)
//   WEC:      keine öffentliche API, wird weiterhin von Hand gepflegt
//
// Schlägt eine Quelle fehl, bleibt der letzte erfolgreiche Stand dieser Quelle erhalten.
// Aufruf: node scripts/update-data.mjs

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIVE_JSON = path.join(ROOT, "data", "live.json");
const INDEX = path.join(ROOT, "index.html");
const SEASON = process.env.SEASON || "2026";

async function getJson(url, tries = 3) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "sportkalender-update/1.0", Accept: "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
    }
  }
  throw new Error(`${url}: ${lastErr && lastErr.message}`);
}

const num = (v) => (v == null || v === "" ? 0 : Number(v));

/* ---------------- Formel 1 ---------------- */
const F1_TEAM_IDS = {
  mercedes: "mercedes", ferrari: "ferrari", mclaren: "mclaren", red_bull: "redbull", rb: "rb",
  racing_bulls: "rb", alpine: "alpine", haas: "haas", sauber: "audi", audi: "audi", williams: "williams",
  aston_martin: "aston", cadillac: "cadillac"
};
function f1Team(c) {
  if (!c) return null;
  if (F1_TEAM_IDS[c.constructorId]) return F1_TEAM_IDS[c.constructorId];
  const n = (c.name || "").toLowerCase();
  if (n.includes("racing bulls") || n === "rb f1 team") return "rb";
  if (n.includes("red bull")) return "redbull";
  for (const [k, v] of [["mercedes", "mercedes"], ["ferrari", "ferrari"], ["mclaren", "mclaren"], ["alpine", "alpine"], ["haas", "haas"], ["audi", "audi"], ["sauber", "audi"], ["williams", "williams"], ["aston", "aston"], ["cadillac", "cadillac"]]) {
    if (n.includes(k)) return v;
  }
  return null;
}

async function fetchF1() {
  const base = "https://api.jolpi.ca/ergast/f1/" + SEASON;
  const [ds, cs] = await Promise.all([getJson(base + "/driverstandings/?limit=100"), getJson(base + "/constructorstandings/?limit=100")]);
  const dl = ds.MRData.StandingsTable.StandingsLists[0];
  const cl = cs.MRData.StandingsTable.StandingsLists[0];
  if (!dl || !cl) throw new Error("Keine F1-Wertung gefunden");
  const drivers = dl.DriverStandings.map((d) => ({
    pos: num(d.position || d.positionText),
    points: num(d.points),
    wins: num(d.wins),
    given: d.Driver.givenName,
    family: d.Driver.familyName,
    number: d.Driver.permanentNumber ? Number(d.Driver.permanentNumber) : null,
    nationality: d.Driver.nationality || "",
    team: f1Team(d.Constructors[d.Constructors.length - 1])
  }));
  const constructors = cl.ConstructorStandings.map((c) => ({
    pos: num(c.position || c.positionText), points: num(c.points), wins: num(c.wins), team: f1Team(c.Constructor), name: c.Constructor.name
  }));
  if (drivers.length < 10 || constructors.length < 8) throw new Error("F1-Wertung unvollständig");
  if (constructors.some((c) => !c.team)) console.warn("Unbekanntes F1-Team:", constructors.filter((c) => !c.team).map((c) => c.name));
  return { round: num(dl.round), season: dl.season, drivers, constructors };
}

/* ---------------- NFL ---------------- */
function stat(entry, name) {
  const s = (entry.stats || []).find((x) => x.name === name || x.type === name);
  return s ? num(s.value) : 0;
}
function collectDivisions(node, out) {
  if (!node) return out;
  const entries = node.standings && node.standings.entries;
  const m = /^(AFC|NFC)\s+(East|North|South|West)$/i.exec(node.name || node.abbreviation || "");
  if (entries && m) out.push({ conf: m[1].toUpperCase(), div: m[2][0].toUpperCase() + m[2].slice(1).toLowerCase(), entries });
  (node.children || []).forEach((c) => collectDivisions(c, out));
  return out;
}
async function fetchNflStandings() {
  const data = await getJson(`https://site.api.espn.com/apis/v2/sports/football/nfl/standings?season=${SEASON}&level=3`);
  const divs = collectDivisions(data, []);
  if (divs.length !== 8) throw new Error(`NFL: ${divs.length} statt 8 Divisions gefunden`);
  const table = { AFC: {}, NFC: {} };
  for (const d of divs) {
    table[d.conf][d.div] = d.entries
      .map((e) => [e.team.displayName, stat(e, "wins"), stat(e, "losses"), stat(e, "ties")])
      .sort((a, b) => {
        const pa = (a[1] + a[3] / 2) / Math.max(1, a[1] + a[2] + a[3]);
        const pb = (b[1] + b[3] / 2) / Math.max(1, b[1] + b[2] + b[3]);
        return pb - pa || b[1] - a[1];
      })
      .map((t) => (t[3] ? t : t.slice(0, 3)));
  }
  return table;
}

const POS_ORDER = ["QB", "RB", "FB", "WR", "TE", "OT", "T", "OG", "G", "C", "DE", "DT", "NT", "DL", "OLB", "LB", "ILB", "MLB", "CB", "S", "FS", "SS", "DB", "PK", "K", "P", "LS"];
async function fetchBroncosRoster() {
  const data = await getJson(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/den/roster?season=${SEASON}`);
  const groups = { offense: "Offense", defense: "Defense", specialTeam: "Special Teams", specialteam: "Special Teams" };
  const out = [];
  for (const g of data.athletes || []) {
    const label = groups[g.position] || g.position;
    const items = (g.items || []).slice().sort((a, b) => {
      const pa = POS_ORDER.indexOf(a.position && a.position.abbreviation), pb = POS_ORDER.indexOf(b.position && b.position.abbreviation);
      return (pa < 0 ? 99 : pa) - (pb < 0 ? 99 : pb) || num(a.jersey) - num(b.jersey);
    });
    out.push([label]);
    for (const a of items) {
      const info = [];
      if (a.jersey) info.push("Nr. " + a.jersey);
      if (a.experience && a.experience.years != null) info.push(a.experience.years === 0 ? "Rookie" : a.experience.years + ". NFL-Jahr");
      if (a.college && a.college.name) info.push(a.college.name);
      if (a.injuries && a.injuries.length) info.push("verletzt: " + (a.injuries[0].status || ""));
      out.push([(a.position && a.position.abbreviation) || "", a.fullName || a.displayName, info.join(" · ")]);
    }
  }
  if (out.length < 30) throw new Error("Broncos-Kader unvollständig");
  return out;
}

function scoreOf(c) {
  if (!c || c.score == null) return null;
  if (typeof c.score === "object") return c.score.displayValue != null ? c.score.displayValue : c.score.value;
  return c.score;
}
async function fetchBroncosSchedule() {
  const data = await getJson(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/den/schedule?season=${SEASON}&seasontype=2`);
  const games = [];
  const weeks = new Set();
  for (const ev of data.events || []) {
    const comp = (ev.competitions || [])[0];
    if (!comp) continue;
    const me = comp.competitors.find((c) => c.team && (c.team.abbreviation === "DEN" || /Broncos/.test(c.team.displayName || "")));
    const opp = comp.competitors.find((c) => c !== me);
    if (!me || !opp) continue;
    const wk = ev.week && ev.week.number;
    weeks.add(wk);
    const venue = comp.venue ? [comp.venue.fullName, comp.venue.address && comp.venue.address.city].filter(Boolean).join(", ") : "";
    const tv = (comp.broadcasts || []).map((b) => (b.media && b.media.shortName) || (b.names || []).join("/")).filter(Boolean).join(", ");
    const tbd = ev.timeValid === false;
    let result = "";
    if (comp.status && comp.status.type && comp.status.type.completed) {
      const a = scoreOf(me), b = scoreOf(opp);
      const w = Number(a) > Number(b) ? "Sieg" : Number(a) < Number(b) ? "Niederlage" : "Unentschieden";
      result = `${w} ${a}:${b}`;
    }
    games.push([wk, tbd ? ev.date.slice(0, 10) : ev.date, me.homeAway === "home", opp.team.displayName, venue, tv, tbd, tbd, result]);
  }
  if (games.length < 15) throw new Error("Broncos-Spielplan unvollständig");
  games.sort((a, b) => a[0] - b[0]);
  let bye = null;
  for (let w = 1; w <= 18; w++) if (!weeks.has(w)) { bye = w; break; }
  return { games, bye };
}

/* ---------------- Ablauf ---------------- */
async function main() {
  let prev = {};
  try { prev = JSON.parse(await readFile(LIVE_JSON, "utf8")); } catch {}
  const next = { ...prev, sources: { ...(prev.sources || {}) } };
  const now = new Date().toISOString();
  const tasks = {
    f1: fetchF1,
    nflStandings: fetchNflStandings,
    broncosRoster: fetchBroncosRoster,
    broncosSchedule: fetchBroncosSchedule
  };
  let ok = 0;
  for (const [key, fn] of Object.entries(tasks)) {
    try {
      next[key] = await fn();
      next.sources[key] = now;
      ok++;
      console.log(`OK   ${key}`);
    } catch (e) {
      console.warn(`FEHLER ${key}: ${e.message} (alter Stand bleibt)`);
    }
  }
  if (!ok) { console.error("Keine Quelle erreichbar, nichts geändert."); process.exitCode = 1; return; }
  next.updated = now;

  const json = JSON.stringify(next, null, 1);
  await mkdir(path.dirname(LIVE_JSON), { recursive: true });
  await writeFile(LIVE_JSON, json + "\n");

  const html = await readFile(INDEX, "utf8");
  const re = /(<script id="live-data" type="application\/json">)([\s\S]*?)(<\/script>)/;
  if (!re.test(html)) throw new Error("live-data-Block in index.html nicht gefunden");
  const safe = JSON.stringify(next).replace(/</g, "\\u003c");
  await writeFile(INDEX, html.replace(re, (_, a, _b, c) => a + safe + c));
  console.log(`Fertig: ${ok}/${Object.keys(tasks).length} Quellen aktualisiert.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
