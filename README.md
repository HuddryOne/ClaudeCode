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

Einfach `index.html` im Browser öffnen – keine Installation nötig. Für eine Online-Version kann die Datei z. B. über GitHub Pages veröffentlicht werden.

## Daten aktualisieren

Alle Termine, Kader und Sender stehen im `<script>`-Block in `index.html` (Abschnitte `nfl`, `ev({...})`, `ROSTER`, `TVPAGE`, `F1DRIVERS`, `F1CONS`, `F1TEAMS`, `NFL`, `WECCARS`, `WECMAKES`, `WECDRIVERS`). Zeiten werden in UTC eingetragen und automatisch umgerechnet.

Datenstand: 4. November 2026. Angaben ohne Gewähr.
