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

## Automatische Aktualisierung (alle 24 Stunden)

Der GitHub-Workflow `.github/workflows/update-data.yml` läuft jeden Tag um 04:17 UTC (und auf Knopfdruck unter *Actions → Daten täglich aktualisieren → Run workflow*). Er startet `scripts/update-data.mjs`, das diese Daten holt:

| Bereich | Quelle |
|---|---|
| F1-Fahrer- und Konstrukteurswertung | Jolpica F1 API (Nachfolger von Ergast) |
| NFL-Tabelle aller 32 Teams | ESPN (öffentliche Endpunkte) |
| Broncos-Kader (alle Spieler) | ESPN |
| Broncos-Spielplan inkl. Ergebnissen und Anstoßzeiten | ESPN |

Die Ergebnisse landen in `data/live.json` und im Block `<script id="live-data">` in `index.html`, der Workflow committet die Änderung. Fällt eine Quelle aus, bleibt deren letzter Stand erhalten. Ist der Block leer, zeigt die Seite die fest eingetragenen Daten.

**Nicht automatisch:** WEC (es gibt keine öffentliche Schnittstelle), F1-Teamsteckbriefe, Teamgeschichte und TV-Sender. Diese Daten werden weiter von Hand gepflegt.

## Daten von Hand ändern

Alle Termine, Kader und Sender stehen im `<script>`-Block in `index.html` (Abschnitte `nfl`, `ev({...})`, `ROSTER`, `TVPAGE`, `F1DRIVERS`, `F1CONS`, `F1TEAMS`, `NFL`, `WECCARS`, `WECMAKES`, `WECDRIVERS`). Zeiten werden in UTC eingetragen und automatisch umgerechnet.

Datenstand: 4. November 2026. Angaben ohne Gewähr.
