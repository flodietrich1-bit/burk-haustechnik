# P12 Aufmaß / ToolTime – Übergabe für den nächsten Chat

Stand: 12. November 2026. Diese Datei fasst den aktuellen Workspace-Stand und die offenen Arbeiten zusammen. Vorhandene Änderungen sind uncommitted; nichts wurde deployed.

## Fortschritt am 12. November 2026 (Folgearbeit)

- Lokaler Stack gemeinsam neu gestartet und unter `localhost` sowie im LAN erreichbar gemacht. Firebase-Emulatoren binden nun an `0.0.0.0`; Webclient verwendet im Emulator-Modus den Host der Browser-URL statt fest `127.0.0.1`.
- `Failed to fetch` behoben: API-Basis ist ohne explizite Konfiguration host-dynamisch; Verbindungsfehler nennen die sichere Ziel-URL und einen konkreten Verbindungshinweis.
- Speichern von Firmendaten, Branding-Farbe sowie Suspendieren/Reaktivieren ist im erweiterten lokalen API-Smoke-Test erfolgreich verifiziert. Logo-Upload bleibt zusätzlich manuell im Browser zu prüfen.
- Firmenanlage erfasst und validiert jetzt Firmenname, Ansprechpartner, Telefon und E-Mail. Projektzähler werten `draft`/`in_progress` als aktiv und alle übrigen vorhandenen Zustände als inaktiv.
- Defektes `p12-aufmass-logo.svg` wurde durch ein neu aufgebautes P12-Aufmaß-SVG ersetzt und responsive in Admin- und Detailheader integriert.
- Web-Build und Lint erfolgreich (Lint nur mit bereits vorhandenen Warnungen); Firestore-Regeltests 5/5 erfolgreich; lokaler API-Smoke-Test erfolgreich.

## Produkt- und Designentscheidungen

- Der Produktname lautet **P12 Aufmaß**. Der Stil soll dem P12 Ventures Brand-Guide folgen: P12 kräftig, Produktwort leicht, violette Markenfarben.
- Die Mandantenkachel soll Firmenname, Ansprechpartner, Ansprechpartner-Telefon und Ansprechpartner-E-Mail zeigen. Darunter die Zahlen aktiver/inaktiver Benutzer und Projekte. Status sowie Suspendieren/Aktivieren müssen zugänglich bleiben.
- Firmendaten erscheinen im Detail als Text und werden per Bearbeiten-Modal gepflegt.
- Logo und Firmenfarbe sollen bei Auswahl automatisch speichern.
- Es gibt laut Nutzer noch keine echten Nutzer; Burk ist erster Mandant. Monteure können ohne E-Mail eingeladen werden. Pro Monteur zunächst ein aktives Gerät. Einladungen gelten sieben Tage.
- `projektleiter` wird als Rolle `bauleiter` behandelt. Mandantenpfade sind die Zielstruktur.

## Aktuell noch kaputt / zuerst beheben

### Speichern im Browser

Der Nutzer erhält beim Speichern `Failed to fetch` (Screenshot vom Firmenbearbeiten-Modal). Ursache ist mit hoher Wahrscheinlichkeit die lokale Erreichbarkeit/Konfiguration zwischen Browser und Backend. Die API-Basis wurde in `admin-web/src/services/apiClient.ts` auf den aktuellen Host umgestellt und der CORS-Dev-Modus in `backend/server.js` erweitert, aber die laufenden Prozesse wurden danach nicht zuverlässig gemeinsam neu gestartet und der Speichervorgang nicht end-to-end verifiziert.

Nächster Chat soll zuerst:

1. Erreichbarkeit von Web (`5173`), Backend (`3001/api/health`) und Firebase-Emulatoren prüfen.
2. Backend und Web mit den aktuellen Änderungen neu starten. `admin-web` Script `dev:local` verwendet Emulatoren und bindet Vite an `0.0.0.0`; Backend-Local-Script ist `backend` `dev:local`.
3. Im Backend muss `ALLOWED_ORIGINS` für lokale Hosts funktionieren. Aktuell erlaubt `server.js` bei `NODE_ENV !== production` localhost, Loopback und private IPv4 Bereiche.
4. Browser-Konsole/Network prüfen: API-Request zu `http(s)://<gleicher-host>:3001/api/tenants/burk`, Status und CORS. Danach Speichern von Firmendaten, Logo und Farbe tatsächlich testen.
5. `Failed to fetch` sichtbarer auflösen: Fehler im UI um tatsächliche API-URL und Verbindungshinweis ergänzen, aber keine Tokens/Geheimnisse ausgeben.

### Logo

Das derzeitige Headerlogo ist weiterhin nur Text `P12 Aufmaß` in HTML; es ist nicht das echte bereitgestellte SVG. Ein generiertes Logo wurde angezeigt, aber nicht in Dateien übernommen. Außerdem wurde irrtümlich nur der Text `VENTURES` in einer SVG-Datei ersetzt; dadurch blieben VENTURES-Glyphen erhalten. Diese defekte Datei `admin-web/public/p12-aufmass-logo.svg` darf nicht als Logo verwendet werden.

Referenzen außerhalb des ToolTime-Workspace:

- Brand-Guide: `/home/oem/Programming/P12V/drive-download-20261111T103519Z-1-001/P12VTRS_Brand-Guide_v1.0.pdf`
- Referenzlogo: `/home/oem/Programming/P12V/drive-download-20261111T103519Z-1-001/01_logo/langform/p12-ventures-farbig.svg`
- PNG: `/home/oem/Programming/P12V/drive-download-20261111T103519Z-1-001/01_logo/langform/p12-ventures-farbig.png`
- Favicon wurde bereits nach `admin-web/public/favicon.svg` kopiert.

Umsetzung: passendes Vektorlogo im Brand-Guide-Stil anlegen: Bildmarke/„P12“ wie Vorlage, rechts neu gesetzter Text „Aufmaß“ mit vergleichbarer leichter Typografie. Der Nutzer möchte nicht einfach das falsche Wort austauschen lassen, sondern ein optisch passendes echtes P12-Aufmaß-Logo. Anschließend in Admin- und Detailheader verwenden. Prüfen, ob `p12-aufmass-logo.svg` defekte alte Datei überschrieben/ersetzt wird.

## Bereits implementierter Stand

- Firebase-Auth Login und Superadmin-Claim für Web.
- Admin-Routen/Firmenverwaltung und Mandanten-Detailansicht.
- Firestore- und Storage-Regeln für Mandantenstruktur.
- Backend-Admin-Routen für Firmen, Mitglieder und Einladungen.
- Kurz-Code/QR-Einladungen, PDF-Erzeugung, serverseitige einmalige Einlösung und Rate-Limits.
- Emulator-Seed für `superadmin@tooltime.local` / `ToolTime-Local-2026!`; Burk ist Tenant `burk`.
- Firmendatenmodell mit Ansprechpartner, Kontakt- und Rechnungsfeldern.
- Detailansicht: Firmendaten lesbar, Bearbeiten-Modal; PLZ/Ort-Layout korrigiert.
- Farb- und Logoauswahl im Detail soll automatisch speichern.
- Suspendieren/Aktivieren-API und Sperrung für normale Mandantenmitglieder in Regeln.
- Firestore-Regeltests waren zuletzt 5/5 erfolgreich; Web-Build war zuletzt erfolgreich, bevor die jüngste LAN/API-Konfiguration ergänzt wurde. Bei Gelegenheit erneut Build ausführen.
- Tenant-Projekte werden im Web-Cockpit unter `/tenants/{tenantId}/projects` angesprochen.

## Noch offene Systemarbeiten

### Web-Cockpit

- Firmen-Kacheln in `admin-web/src/pages/TenantAdminPage.tsx` sind auf gewünschte Infos ausgelegt, aber Backend-Daten für getrennte Statuszahlen müssen fachlich stimmen.
- Backend-Liste in `backend/routes/tenantRoutes.js` zählt derzeit aktive Mitglieder per Status, inaktive per `status != active`; Projekte werden als „aktiv“ alles außer `archived` gezählt und „inaktiv“ nur `archived`. Verifizieren, welche Projektstatus im realen Code vorkommen (`active`, `in_progress`, `completed`, `archived` etc.) und daraus sinnvolle aktiv/inaktiv Zählung festlegen. Die derzeitige Filterung per `!=` zählt ggf. Dokumente ohne status nicht zuverlässig.
- Firmenanlage erfasst aktuell nur Name, Kürzel und Primärfarbe. Produktentscheidung: Beim Anlegen sollten mindestens Firmenname, Ansprechpartner, Telefon und E-Mail erfasst werden, da die Kachel diese Daten zeigen soll. Bestehendes Create-Formular erweitern.
- Der Wert `tenant.name` ist der Firmenname; `slug` ist nur interne technische ID und soll nicht in der Firmenkachel erscheinen.
- Rollenverwaltung zeigt Mitglieder und Einladungen; tatsächliche Rollenzuweisungs-/Projektzuweisung für bestehende Mitglieder im UI fehlt.
- Alte Benutzer-/PIN-Oberfläche im Projektcockpit existiert noch; direkte Änderungen sind bereits in Firestore-Service blockiert und sollten durch tenantbasierte Benutzerverwaltung ersetzt/ausgeblendet werden.
- Passwortänderungsmodal im Cockpit gegen Firebase Auth integrieren oder aus der UI entfernen.
- Dynamisches Tenant-Branding im Cockpitheader ist noch nicht fertig: zurzeit bleibt dort BURK-Logo und feste Cockpitfarben.

### Backend/Sicherheit

- Alte CAD-/PDF-Endpunkte in `backend/server.js` sind nicht alle an Firebase Auth/Tenant gebunden.
- Storage-Regeln für Branding und Projekte existieren, aber Storage-Rule-Tests fehlen.
- SMTP-E-Mail ist nur bei gesetzten SMTP-Umgebungswerten aktiv. Lokaler Modus liefert PDF/QR, sendet keine Mail.
- Einladungscodes und Einlösung funktionieren per API; gerätegebundene Wiederherstellung, Sperrung verlorener Geräte und erneute Identitätsprüfung sind noch nicht implementiert.
- Superadmin-Bootstrap für echte Umgebung muss sicher über `backend/scripts/bootstrap.js` konfiguriert werden; lokale Seed-Zugangsdaten niemals produktiv nutzen.
- Suspension im Backend bei allen geschützten Routen prüfen, nicht nur im Router/Firestore (Firebase Admin SDK umgeht Regeln).

### Monteur-App TTApp (separates Projekt)

- Web-Onboarding ist noch nicht in der Monteur-App umgesetzt. QR-Deep-Link und Kurz-Code sind darum auf dem Handy noch nicht einlösbar.
- App braucht Kamera/QR-Scan und manuelle Code-Eingabe, Redeem-API-Aufruf, Firebase Custom Token Login, Firmen-/Mitgliedschaftsprofil und dynamisches Branding.
- Vorhandene lokale PIN darf nur Gerätesperre bleiben; keine Serverauth ersetzen.
- Offlineprojektcache und Buchungs-Outbox müssen mandantenbezogen werden; Synchronisierung muss Firebase-authentifiziert und tenant-/projektberechtigt sein.
- Pro Monteur zunächst ein aktives Gerät; Gerätewechsel und verlorenes Gerät im Produktablauf entscheiden/implementieren.
- QR-Scanner-Bibliothek bedeutet ggf. neuen nativen Build/Runtime-Version; EAS Update allein reicht bei nativen Änderungen nicht.
- Migrationsplan/Abschaltzeitpunkt alter globaler Firestore-Schreibpfade fehlt. Nutzerangabe: derzeit keine realen Nutzer, daher frisch aufsetzen ist akzeptiert; trotzdem alte App-Versionen/Outboxes nicht unbeabsichtigt parallel schreiben lassen.

## Sinnvolle Reihenfolge im neuen Chat

1. Localhost/Emulatoren reparieren und realen Speichervorgang für Firmendaten, Branding und Suspendierung verifizieren.
2. Firmenanlage um Ansprechpartner/Telefon/E-Mail erweitern; Backend-Zähler gegen echte Statuswerte korrigieren; Kartenanzeige prüfen.
3. P12-Aufmaß-Logo als korrektes SVG erstellen/integrieren und responsive in Headern darstellen.
4. Build/Regeltests ausführen; manueller Browsercheck der Admin-Flows.
5. Web-Mitgliederverwaltung, Cockpit-Branding und alte Auth-/PIN-UI abrunden.
6. CAD/PDF-Endpunkte mandantensicher machen und Storage-Regeln testen.
7. TTApp-Onboarding/Auth/Offline-Sync und native Build-/Versionsstrategie implementieren.
8. Erst nach Emulator-Verifikation Deploy- und Bootstrap-Schritte planen. Nichts deployen ohne ausdrücklichen Auftrag.

## Aktuelle Links und lokale Zugangsdaten

- Web: `http://localhost:5173` (LAN zuletzt `http://192.168.0.200:5173`)
- Emulator-UI: `http://localhost:4000`
- Backend: `http://localhost:3001/api/health`
- Superadmin lokal: `superadmin@tooltime.local` / `ToolTime-Local-2026!`

Prozess-IDs aus früheren Turns sind nicht verlässlich; im neuen Chat Prozesse und Ports neu prüfen.
