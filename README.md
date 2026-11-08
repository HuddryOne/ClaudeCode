# Broncos · Red Bull · Toyota

Persönliche Sport-Website für drei Teams:

- **Denver Broncos** (NFL) – Stammformation/Kader, Spielplan 2026
- **Oracle Red Bull Racing** (Formel 1) – Fahrer, Teamdaten, restliche Rennwochenenden mit allen Trainings, Qualifying und Rennen
- **Toyota Racing** (WEC, Hypercar) – Fahrer beider Autos (#7, #8), WEC-Kalender 2026 mit allen Sessions

Dazu:

- **Kalender** mit Filter pro Team, „nur Rennen & Spiele“, vergangene Termine und Export als `.ics` (für Google/Apple/Outlook-Kalender)
- **Tabellen:** F1-Fahrer- und Konstrukteurswertung und alle 11 F1-Teams mit Teamchef, Motor und Fahrern (ein Klick auf ein Team öffnet die Teamseite mit Auto, Titeln, Fahrern, WM-Stand, Saison, nächsten Rennen und Geschichte), alle 32 NFL-Teams nach Conference und Division mit Bilanz, WEC-Rangliste der Hypercar-Autos, Herstellerwertung und Fahrerwertung. Ein Klick auf ein WEC-Auto öffnet die Teamseite mit Fahrzeug, Antrieb, Einsatzteam, Fahrern, Saison und Geschichte
- **Countdown** zum nächsten Event
- **Wo schauen?** – Free-TV (ServusTV, ORF, RTL) und Bezahlangebote (WOW/Sky, DAZN Game Pass, Eurosport/HBO Max, FIAWEC+) in Österreich, pro Termin direkt angezeigt
- Alle Zeiten automatisch in österreichischer Zeit (Europe/Vienna), helles und dunkles Design, handytauglich

## Aufbau der Seite

- **Übersicht:** Countdown zum nächsten Rennen/Spiel je Team, nächste Termine, Live-Karte bei Broncos-Spielen.
- **Kalender:** alle Termine mit Trainings, Qualifying, Rennen und Spielen, Filter und `.ics`-Export.
- **NFL:** alle 32 Teams nach Divisions (AFC West mit den Broncos zuerst und hervorgehoben), Spielergebnisse je Woche. Ein Klick auf ein Team öffnet `#nfl-<kürzel>` mit Bilanz, Stadion, nächstem Spiel und den letzten 10 Spielen; bei den Broncos zusätzlich Kader, Ergebnisse und Spielplan.
- **Formel 1:** Fahrer- und Konstrukteurswertung (Red Bull hervorgehoben). Fahrer öffnen `#f1d-<id>` mit Saison- und Karriereerfolgen (Titel, Starts, Siege, Podien, Poles), Teams öffnen `#f1-<team>` mit Steckbrief, Fahrern und Erfolgen.
- **WEC:** Hypercar, LMGT3 und Le Mans mit allen Autos und ihren Fahrern, Wertungen und Teamseiten (`#wec-<team>`).
- **Wo schauen?:** TV und Streams in Österreich.

Detailseiten sind nur per Klick erreichbar und haben einen Zurück-Link. Alte Adressen (`#broncos`, `#redbull`, `#toyota`, `#tabellen`) leiten weiter.

## Benutzen

Online: **https://huddryone.github.io/ClaudeCode/**

Der Workflow `.github/workflows/deploy-pages.yml` veröffentlicht die Seite bei jeder Änderung an `index.html` oder `data/` und nach jeder täglichen Datenaktualisierung. In den Repository-Einstellungen ist dafür unter *Pages* als Quelle „GitHub Actions“ eingestellt.

Offline: `index.html` einfach im Browser öffnen, keine Installation nötig.

## Live-Karte für Broncos-Spiele

Während eines Broncos-Spiels zeigt die App eine Live-Karte im Zeitmonitor, auf der Übersicht und auf der Broncos-Seite: Spielstand, Viertel und Uhr, Ballbesitz, Down & Distance, Red Zone, Timeouts, letzter Spielzug, Punkte pro Viertel und Siegchance. Nach Spielende erscheint der Endstand und wird sofort in die Ergebnistabelle übernommen.

- Abgefragt wird direkt im Browser bei ESPN, nur von 30 Minuten vor Kickoff bis 6 Stunden danach. An anderen Tagen gibt es keine einzige Abfrage.
- Takt: vor dem Spiel jede Minute, im Spiel alle 15 Sekunden (Core-API `/status` und `/situation`, je unter 1 KB; Scoreboard höchstens jede Minute oder nach einem neuen Spielzug), in Pausen jede Minute.
- Im Hintergrund-Tab und offline wird pausiert; bei Fehlern wartet die App immer länger (30 s bis 5 min) und zeigt den letzten Stand.
- In der claude.ai-Vorschau sind Abfragen nach außen gesperrt, dort erscheint ein Hinweis auf die Web-Version.

## 24 Stunden von Le Mans

Im Tab *WEC → Le Mans* steht für jedes Jahr das komplette Starterfeld (Hypercar, LMP2, LMGT3) mit Team, Fahrzeug, Fahrern samt FIA-Einstufung (Platin/Gold/Silber/Bronze), die Reserveliste und nach dem Rennen die Klassensieger. Die Daten stehen im Objekt `LEMANS` in `index.html` (ein Eintrag pro Jahr).

Eine geplante Claude-Aufgabe prüft jeden Montag im Mai und Juni, ob das Rennen in der kommenden Woche stattfindet. Wenn ja, sucht sie die neueste offizielle Starterliste, lässt sie vom Workflow `.github/workflows/lemans-entrylist.yml` als Text unter `data/lemans/` ablegen (Auslöser: Push von `data/lemans/request.txt` mit „<Jahr> <PDF-URL>“) und trägt das Starterfeld ein. In der Woche nach dem Rennen ergänzt sie die Klassensieger.

## Automatische Aktualisierung (alle 24 Stunden)

Der GitHub-Workflow `.github/workflows/update-data.yml` läuft jeden Tag um 04:17 UTC (und auf Knopfdruck unter *Actions → Daten täglich aktualisieren → Run workflow*). Er startet `scripts/update-data.mjs`, das diese Daten holt:

| Bereich | Quelle |
|---|---|
| F1-Fahrer- und Konstrukteurswertung | Jolpica F1 API (Nachfolger von Ergast) |
| NFL-Tabelle aller 32 Teams | ESPN (öffentliche Endpunkte) |
| Broncos-Kader (alle Spieler) | ESPN |
| Broncos-Spielplan inkl. Ergebnissen und Anstoßzeiten | ESPN |
| Alle 32 NFL-Teams: Tabelle, Bilanz, letzte 10 Spiele, alle Spiele der Saison | ESPN |
| F1-Erfolge aller aktuellen Fahrer und Teams (montags bzw. alle 3 Tage) und Liste aller Weltmeister | Jolpica F1 |

Die Ergebnisse landen in `data/live.json` und im Block `<script id="live-data">` in `index.html`, der Workflow committet die Änderung. Fällt eine Quelle aus, bleibt deren letzter Stand erhalten. Ist der Block leer, zeigt die Seite die fest eingetragenen Daten.

**Nicht automatisch:** WEC (es gibt keine öffentliche Schnittstelle), F1-Teamsteckbriefe, Teamgeschichte und TV-Sender. Diese Daten werden weiter von Hand gepflegt.

## Daten von Hand ändern

Alle Termine, Kader und Sender stehen im `<script>`-Block in `index.html` (Abschnitte `nfl`, `ev({...})`, `ROSTER`, `TVPAGE`, `F1DRIVERS`, `F1CONS`, `F1TEAMS`, `NFL`, `WECCARS`, `WECMAKES`, `WECDRIVERS`). Zeiten werden in UTC eingetragen und automatisch umgerechnet.

Datenstand: 4. November 2026. Angaben ohne Gewähr.
