# Firestore-Mandantenmodell

## Live-Stand (13. November 2026)

Die alten globalen Demo-Dokumente wurden im Projekt `burk-haustechnik` entfernt: `/projects`, `/bookings` und `/addendums` enthalten keine Dokumente mehr. Unter `/users` liegt genau das UID-Profil des vorhandenen Firebase-Authentication-Kontos `info@p12-aufmass.de`. Die Firma `/tenants/burk` und dessen aktive Admin-Mitgliedschaft wurden angelegt. Der Superadmin-Custom-Claim ist gesetzt und die Firestore-Regeln wurden veröffentlicht. Das Konto muss sich neu anmelden, damit sein Token den neuen Claim enthält.

Firebase Storage ist live noch nicht eingerichtet; Logo- und Plan-Uploads benötigen nach Einrichtung einen separaten Deploy der Storage-Regeln. Die Live-Backend-API ist derzeit nicht unter der Frontend-Adresse erreichbar. Damit ist die Datenbasis sauber, aber der Live-Adminbereich noch nicht vollständig betriebsbereit.

Der Produktions-Build des Frontends verwendet `/api`. Sobald ein Cloud-Run-Service bereitsteht, muss Firebase Hosting diesen Pfad an den Dienst weiterleiten. Solange die API fehlt, liest die Admin-Oberfläche Firmen und Mitglieder direkt aus Firestore und zeigt Bearbeitungsfunktionen als eingeschränkt an. Der spätere API-Dienst braucht unter anderem `FIREBASE_PROJECT_ID`, `ALLOWED_ORIGINS`, `INVITE_HMAC_SECRET` und für automatische Einladungen `RESEND_API_KEY`. Der Secret-Wert gehört in Secret Manager, nicht in Git oder einen öffentlichen Build. Cloud Run und Firebase Storage können Kosten verursachen; die Bereitstellung setzt die passende Abrechnungsentscheidung voraus.

## Datenquellen

- Firebase Authentication verwaltet Anmeldung, Passwort und die unveränderliche UID. Passwörter gehören nicht in Firestore.
- `users/{firebaseUid}` ist das globale Profil. Es enthält E-Mail, Anzeigename, `tenantIds` und gegebenenfalls `platformRole: "superadmin"`. Nur der Server mit Admin SDK schreibt hier.
- `tenants/{tenantId}` ist die Firma mit Name, Logo, Farben, Domain-Slug und Status.
- `tenants/{tenantId}/members/{firebaseUid}` verbindet eine Person mit einer Firma. Hier stehen Firmenrolle, Status und Projektzuweisungen. Dieselbe Person kann mehreren Firmen angehören.
- `tenants/{tenantId}/projects/{projectId}` und die Untercollections enthalten Geschäftsdaten. Plan-Dateien liegen in Firebase Storage unter `tenants/{tenantId}/projects/{projectId}/plans/`.
- Einladungen liegen unter `tenants/{tenantId}/invites`. Nach Einlösung legt der Server das globale Profil und die Mitgliedschaft an bzw. aktualisiert beide.
- Der CAD-Konverter prüft Firebase-Authentifizierung und Firmenrolle. Er liefert Konvertierung und optional eine APS-URN; die Browseranwendung speichert den Plan unter dem Firmenpfad. Die alte globale CAD-Schreibroute ist nicht mehr aktiv.

Die Browseranwendung verwendet nur einen flüchtigen Speicher für die Anzeige. Ein erfolgreicher Schreibvorgang setzt eine bestätigte Firestore- oder Storage-Operation voraus. Die lokal gespeicherte letzte Firma und das zuletzt geöffnete Projekt sind reine Oberflächenpräferenzen.

## Alter Demo-Bestand in der Live-Datenbank

Die Collections `/users`, `/projects`, `/bookings` und `/addendums` der früheren App sind global und haben keine verlässliche Firmenzuordnung. Dokument-IDs wie `user_admin_1` sind keine Firebase-Authentication-UIDs. Ein Feld `role: "admin"` darin erzeugt weder eine Anmeldung noch eine Superadmin-Berechtigung. Ein dort vorhandenes Feld `password` ist Klartext und darf nicht in das neue Modell kopiert werden; betroffene Passwörter müssen über Firebase Authentication neu gesetzt werden.

Der vorhandene Bestand wurde vom Auftraggeber als Testdaten eingestuft. `backend/scripts/cleanLegacyDemoData.js` zeigt zunächst die Anzahl der globalen Demo-Dokumente an. Mit `RESET_TENANT_ID=burk` und `SUPERADMIN_EMAIL` zeigt es auch Demo-Projekte, Einladungen und Mitglieder innerhalb von BURK an. Mit `APPLY_LEGACY_CLEANUP=yes` entfernt es die aufgelisteten Daten und Klartext-Passwortfelder aus Auth-verknüpften Profilen. Die Firmenkonfiguration einschließlich Logo und Farben, das angegebene Superadmin-Mitglied und Firebase-Authentication-Konten bleiben erhalten. Beide Modi verlangen `FIREBASE_PROJECT_ID` und das gleiche `CONFIRM_PROJECT_ID`.

Beispiel aus dem `backend`-Ordner nach Einrichtung von Application Default Credentials für das richtige Firebase-Projekt:

```sh
FIREBASE_PROJECT_ID=burk-haustechnik CONFIRM_PROJECT_ID=burk-haustechnik SUPERADMIN_EMAIL=info@p12-aufmass.de RESET_TENANT_ID=burk npm run cleanup:legacy
FIREBASE_PROJECT_ID=burk-haustechnik CONFIRM_PROJECT_ID=burk-haustechnik SUPERADMIN_EMAIL=info@p12-aufmass.de RESET_TENANT_ID=burk APPLY_LEGACY_CLEANUP=yes npm run cleanup:legacy
FIREBASE_PROJECT_ID=burk-haustechnik CONFIRM_PROJECT_ID=burk-haustechnik SUPERADMIN_EMAIL=info@p12-aufmass.de BOOTSTRAP_TENANT_ID=burk npm run bootstrap
```

## Live-Inbetriebnahme

Das Frontend, Firestore- und Storage-Regeln sowie die Backend-API müssen auf dasselbe Firebase-Projekt zeigen. Für eine Live-Anmeldung als Superadmin braucht es einen vorhandenen Firebase-Authentication-Benutzer. `backend/scripts/bootstrap.js` verknüpft dessen UID mit dem globalen Profil und einer Firmenmitgliedschaft; es erhält vorhandenes Branding und Projekte. Das Skript verlangt `SUPERADMIN_EMAIL`, `FIREBASE_PROJECT_ID` und das gleiche `CONFIRM_PROJECT_ID`. Die lokale Emulator-Anlage ist davon unabhängig. Das reine Anlegen eines `/users`-Dokuments mit einer beliebigen ID genügt nicht.
