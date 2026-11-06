# Geplante Erweiterungen

Stand: 4. November 2026. Umgesetzt wird jeweils erst nach Freigabe.

## 1. NFL: Live-Karte für Broncos-Spiele (umgesetzt am 6.11.2026, Live-Test am 8.11.2026)

- **Quelle:** ESPN-Scoreboard `site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=JJJJMMTT`, direkt aus dem Browser (CORS erlaubt, geprüft am 4.11.2026).
- **Felder:** Status (`status.type.state`), Viertel und Uhr (`status.period`, `status.displayClock`), Spielstand (`competitors[].score`), Punkte pro Viertel (`linescores`), Ballbesitz, Down & Distance, Red Zone, Timeouts und letzter Spielzug (`competitions[0].situation`). Die `situation`-Felder wurden beim Spiel Jaguars @ Ravens am 6.11.2026 bestätigt. Während des Spiels liefert die Core-API (`/status`, `/situation`) aktuellere Daten als das Scoreboard. Der Datumsfilter des Scoreboards erwartet das US-Datum (Eastern Time).
- **Abfragetakt:** nur an Spieltagen ab 30 Minuten vor Kickoff, jede Minute vor dem Spiel, alle 15 s während des Spiels, alle 60 s in der Halbzeit, nach Spielende eine letzte Abfrage. Pause, solange der Tab im Hintergrund ist; bei Fehlern immer längere Wartezeiten (30 s bis 5 min).
- **Anzeige:** Live-Karte im Zeitmonitor, auf der Übersicht und auf der Broncos-Seite; nach Spielende Endstand und sofortige Übernahme in die Ergebnistabelle.
- **Fehlerfälle:** ESPN nicht erreichbar, kein Spiel heute, Spiel verlegt oder verschoben, fehlende Felder, offline, claude.ai-Vorschau ohne Netzzugriff.

## 2. WEC: Live-Timing-Knopf (nach der NFL-Live-Karte)

- Während einer WEC-Session (1 Stunde vor Beginn bis Ende) zeigt die App im Zeitmonitor, auf der Toyota-Seite und im Kalender einen deutlichen Knopf **„Live-Timing öffnen“**.
- Der Knopf führt zum offiziellen Live-Timing in FIAWEC+. Dort meldet man sich selbst an. Die App speichert und nutzt **keine** Zugangsdaten.
- Kein Mitlesen von FIAWEC+ oder Al Kamel (Nutzungsbedingungen, Kontosperre, Sicherheit).

## 3. WEC: Ergebnisse kurz nach jeder Session (nach Punkt 2, Ziel: Saison 2027)

- **Quelle:** öffentlich veröffentlichte offizielle Ergebnisse und Wertungen der FIA WEC (Dokumente auf `fiawec.alkamelsystems.com`).
- **Vorab-Test:** mit einem kurzen Prüf-Workflow klären, ob die Dateien automatisch abrufbar und auslesbar sind (PDF oder ggf. CSV/JSON) und wie schnell sie nach einer Session erscheinen.
- **Wenn ja:** Ein Workflow holt an Rennwochenenden nach jeder Session (Trainings, Qualifying, Hyperpole, Rennen) die Ergebnisse, schreibt sie in `data/live.json` und veröffentlicht die Seite neu. Angezeigt werden Hypercar-Reihenfolge, Abstände, Runden und beste Rundenzeit mit hervorgehobenem Toyota #7 und #8; danach werden die WEC-Wertungen aktualisiert.
- **Wenn nein:** Ergebnisse trägt weiterhin die wöchentliche Claude-Aufgabe nach.
