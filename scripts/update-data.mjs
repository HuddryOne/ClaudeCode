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
    id: d.Driver.driverId,
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


/* ---------------- Hilfen für viele Abfragen ---------------- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function pool(items, size, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: size }, async () => {
    while (i < items.length) { const k = i++; try { out[k] = await fn(items[k], k); } catch (e) { out[k] = { error: e.message }; } }
  }));
  return out;
}

/* ---------------- NFL: alle 32 Teams, Tabelle, Spiele ---------------- */
const ESPN = "https://site.api.espn.com/apis/site/v2/sports/football/nfl";
function gameFrom(ev, seasonLabel) {
  const comp = (ev.competitions || [])[0]; if (!comp) return null;
  const st = (comp.status || ev.status || {}).type || {};
  const side = (c) => c && ({ id: String(c.id || (c.team && c.team.id)), abbr: c.team && c.team.abbreviation, name: c.team && c.team.displayName, score: scoreOf(c), winner: !!c.winner });
  const home = side(comp.competitors.find((c) => c.homeAway === "home")), away = side(comp.competitors.find((c) => c.homeAway === "away"));
  if (!home || !away) return null;
  return {
    id: ev.id, date: ev.date, week: ev.week ? ev.week.number : null, season: seasonLabel,
    type: (ev.seasonType && ev.seasonType.abbreviation) || "", completed: !!st.completed, timeValid: ev.timeValid !== false,
    home, away, venue: comp.venue ? [comp.venue.fullName, comp.venue.address && comp.venue.address.city].filter(Boolean).join(", ") : ""
  };
}
async function fetchNflLeague() {
  const list = await getJson(`${ESPN}/teams`);
  const teams = (((list.sports || [])[0] || {}).leagues || [])[0].teams.map((t) => t.team);
  if (teams.length < 30) throw new Error("NFL-Teamliste unvollständig");
  // Tabelle mit allen Kennzahlen
  const st = await getJson(`https://site.api.espn.com/apis/v2/sports/football/nfl/standings?season=${SEASON}&level=3`);
  const divisions = { AFC: {}, NFC: {} };
  for (const d of collectDivisions(st, [])) {
    divisions[d.conf][d.div] = d.entries.map((e) => {
      const s = {}; (e.stats || []).forEach((x) => { const k = x.name || x.type; if (k) s[k] = x.displayValue != null ? x.displayValue : x.value; if (x.type && x.type !== k) s[x.type] = x.displayValue != null ? x.displayValue : x.value; });
      return { id: String(e.team.id), abbr: e.team.abbreviation, name: e.team.displayName, stats: s };
    });
  }
  const games = {}; const info = {};
  const seasons = [[SEASON, 2], [String(+SEASON - 1), 3], [String(+SEASON - 1), 2]];
  await pool(teams, 4, async (t) => {
    const det = await getJson(`${ESPN}/teams/${t.id}`).catch(() => null);
    const tm = det && det.team || {};
    const rec = {}; ((tm.record || {}).items || []).forEach((it) => { rec[it.type] = it.summary; });
    const ven = tm.franchise && tm.franchise.venue || tm.venue || null;
    info[t.abbreviation] = {
      id: String(t.id), abbr: t.abbreviation, name: t.displayName, short: t.shortDisplayName, location: t.location,
      color: t.color, alt: t.alternateColor, logo: (t.logos || [])[0] && t.logos[0].href,
      standing: tm.standingSummary || "", record: rec,
      venue: ven ? [ven.fullName, ven.address && ven.address.city, ven.address && ven.address.state].filter(Boolean).join(", ") : ""
    };
    const mine = [];
    for (const [season, type] of seasons) {
      const sch = await getJson(`${ESPN}/teams/${t.id}/schedule?season=${season}&seasontype=${type}`).catch(() => null);
      for (const ev of (sch && sch.events) || []) {
        const g = gameFrom(ev, season + (type === 3 ? " Playoffs" : ""));
        if (!g) continue;
        if (season === SEASON && type === 2) games[g.id] = g;
        mine.push(g);
      }
      await sleep(100);
    }
    const done = mine.filter((g) => g.completed).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
    const next = mine.filter((g) => !g.completed && g.season === SEASON).sort((a, b) => a.date.localeCompare(b.date))[0] || null;
    info[t.abbreviation].last10 = done; info[t.abbreviation].next = next;
  });
  const all = Object.values(games).sort((a, b) => a.date.localeCompare(b.date));
  if (Object.keys(info).length < 30 || all.length < 50) throw new Error("NFL-Liga-Daten unvollständig");
  return { divisions, teams: info, games: all };
}

/* ---------------- Formel 1: Erfolge aller Fahrer und Teams ---------------- */
const JOL = "https://api.jolpi.ca/ergast/f1";
async function jol(p) { await sleep(350); return getJson(JOL + p); }
const total = (js) => num(js && js.MRData && js.MRData.total);
// Saison-Endstände: Titel = Platz 1 (laufende Saison erst zählen, wenn sie beendet ist)
function standingsLists(js) { return (js && js.MRData && js.MRData.StandingsTable && js.MRData.StandingsTable.StandingsLists) || []; }
function champions(js, current) {
  return standingsLists(js).filter((l) => l.season !== current && ((l.DriverStandings || l.ConstructorStandings || [])[0] || {}).position === "1").map((l) => l.season);
}
function driverChampions(js, current) {
  const out = [];
  standingsLists(js).forEach((l) => { if (l.season === current) return; (l.DriverStandings || []).forEach((d) => { if (d.position === "1") out.push([l.season, d.Driver.givenName + " " + d.Driver.familyName]); }); });
  return out;
}
async function fetchF1Stats() {
  const ds = await jol(`/${SEASON}/driverstandings/?limit=100`);
  const cs = await jol(`/${SEASON}/constructorstandings/?limit=100`);
  const dl = ds.MRData.StandingsTable.StandingsLists[0].DriverStandings;
  const cl = cs.MRData.StandingsTable.StandingsLists[0].ConstructorStandings;
  // Saisonbilanz aus allen Ergebnissen dieser Saison
  const races = [];
  for (let off = 0, tot = 1; off < tot; off += 100) {
    const page = await jol(`/${SEASON}/results/?limit=100&offset=${off}`);
    tot = total(page);
    (page.MRData.RaceTable.Races || []).forEach((r) => races.push(r));
  }
  const sd = {}, sc = {};
  for (const race of races) for (const r of race.Results || []) {
    const p = num(r.position), d = (sd[r.Driver.driverId] ||= { wins: 0, podiums: 0, best: 99, races: 0 }), c = (sc[r.Constructor.constructorId] ||= { wins: 0, podiums: 0 });
    d.races++; if (p === 1) { d.wins++; c.wins++; } if (p >= 1 && p <= 3) { d.podiums++; c.podiums++; } if (p && p < d.best) d.best = p;
  }
  const drivers = {};
  for (const s of dl) {
    const id = s.Driver.driverId;
    const titles = await jol(`/drivers/${id}/driverstandings/?limit=100`).catch(() => null);
    const starts = await jol(`/drivers/${id}/results/?limit=1`);
    const wins = await jol(`/drivers/${id}/results/1/?limit=1`);
    const p2 = await jol(`/drivers/${id}/results/2/?limit=1`);
    const p3 = await jol(`/drivers/${id}/results/3/?limit=1`);
    const poles = await jol(`/drivers/${id}/qualifying/1/?limit=1`).catch(() => null);
    const first = (starts.MRData.RaceTable.Races || [])[0], fw = (wins.MRData.RaceTable.Races || [])[0];
    drivers[id] = {
      id, given: s.Driver.givenName, family: s.Driver.familyName, code: s.Driver.code || "", number: s.Driver.permanentNumber || "",
      nationality: s.Driver.nationality || "", dob: s.Driver.dateOfBirth || "", url: s.Driver.url || "",
      team: f1Team(s.Constructors[s.Constructors.length - 1]), pos: num(s.position || s.positionText), points: num(s.points),
      titles: champions(titles, SEASON),
      starts: total(starts), wins: total(wins), podiums: total(wins) + total(p2) + total(p3), poles: total(poles),
      firstRace: first ? first.season + " " + first.raceName : "", firstWin: fw ? fw.season + " " + fw.raceName : "",
      season: sd[id] || { wins: 0, podiums: 0, best: null, races: 0 }
    };
  }
  const constructors = {};
  for (const c of cl) {
    const id = c.Constructor.constructorId, key = f1Team(c.Constructor);
    const ct = await jol(`/constructors/${id}/constructorstandings/?limit=100`).catch(() => null);
    const dt = await jol(`/constructors/${id}/driverstandings/?limit=200`).catch(() => null);
    const seasons = await jol(`/constructors/${id}/seasons/?limit=100`);
    const wins = await jol(`/constructors/${id}/results/1/?limit=1`);
    const p2 = await jol(`/constructors/${id}/results/2/?limit=1`);
    const p3 = await jol(`/constructors/${id}/results/3/?limit=1`);
    const poles = await jol(`/constructors/${id}/qualifying/1/?limit=1`).catch(() => null);
    const races = await jol(`/constructors/${id}/races/?limit=1`).catch(() => null);
    const ss = (seasons.MRData.SeasonTable.Seasons || []).map((x) => x.season);
    constructors[key || id] = {
      id, key, name: c.Constructor.name, nationality: c.Constructor.nationality || "", url: c.Constructor.url || "",
      pos: num(c.position || c.positionText), points: num(c.points),
      titles: champions(ct, SEASON),
      driverTitles: driverChampions(dt, SEASON),
      seasons: ss.length, firstSeason: ss[0] || "", races: total(races),
      wins: total(wins), podiums: total(wins) + total(p2) + total(p3), poles: total(poles),
      season: sc[id] || { wins: 0, podiums: 0 }
    };
  }
  if (Object.keys(drivers).length < 15 || Object.keys(constructors).length < 8) throw new Error("F1-Statistik unvollständig");
  return { round: num(ds.MRData.StandingsTable.StandingsLists[0].round), drivers, constructors };
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
    broncosSchedule: fetchBroncosSchedule,
    nflLeague: fetchNflLeague,
    f1Stats: fetchF1Stats
  };
  let ok = 0;
  for (const [key, fn] of Object.entries(tasks)) {
    // Die F1-Karrierestatistik ist aufwendig (ca. 250 Abfragen): nur montags oder wenn älter als 3 Tage
    if (key === "f1Stats" && prev.f1Stats && prev.sources && prev.sources.f1Stats && !process.env.FORCE_ALL) {
      const age = Date.now() - Date.parse(prev.sources.f1Stats);
      if (new Date().getUTCDay() !== 1 && age < 3 * 864e5) { console.log("SKIP f1Stats (aktuell genug)"); continue; }
    }
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
