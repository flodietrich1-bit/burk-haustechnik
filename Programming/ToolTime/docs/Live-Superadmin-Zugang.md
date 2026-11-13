# Superadmin-Zugang auf der Live-Domain einrichten

Die Live-Anmeldung unter `https://p12-aufmass.de/admin/tenants` verwendet Firebase Authentication im Projekt `burk-haustechnik`. Ein Benutzer kann die Firmenübersicht nur öffnen, wenn sein Firebase-ID-Token den Custom Claim `platformRole: superadmin` enthält. Lokale Emulator-Konten gelten nicht für die Live-Domain.

## Einmalige Einrichtung

1. In der Firebase-Konsole das Projekt **burk-haustechnik** öffnen. Unter **Authentication → Users** einen Benutzer mit der gewünschten E-Mail-Adresse und einem eigenen starken Passwort anlegen. Falls der Benutzer bereits existiert, diesen Schritt überspringen. Die E-Mail-Adresse vorher sorgfältig prüfen.
2. Auf einem vertrauenswürdigen Rechner dem Admin SDK **Application Default Credentials eines Service Accounts** bereitstellen. Bevorzugt: einen Service Account mit der Rolle `roles/firebaseauth.admin` verwenden und ihn über `gcloud auth application-default login --impersonate-service-account SERVICE_ACCOUNT_EMAIL` einbinden. Das ausführende Google-Konto braucht dazu `roles/iam.serviceAccountTokenCreator` auf diesem Service Account. Alternativ kann ein Service-Account-JSON-Schlüssel außerhalb des Repositories liegen und über `GOOGLE_APPLICATION_CREDENTIALS` referenziert werden. Den Schlüssel niemals in Chat oder Git kopieren. Ein normales `gcloud auth application-default login` mit dem eingebauten gcloud-OAuth-Client reicht für Firebase Authentication laut Firebase-Dokumentation nicht aus.
3. Im Projektverzeichnis `backend` die Abhängigkeiten installieren (`npm ci`). Dann das folgende Kommando mit der **tatsächlich gewünschten** E-Mail-Adresse ausführen:

   ```bash
   FIREBASE_PROJECT_ID=burk-haustechnik \
   CONFIRM_PROJECT_ID=burk-haustechnik \
   SUPERADMIN_EMAIL='deine-adresse@example.com' \
   npm run grant:superadmin
   ```

4. `https://p12-aufmass.de/admin/tenants` öffnen und mit genau dieser E-Mail-Adresse und dem in Firebase Authentication eingerichteten Passwort anmelden. Wenn der Benutzer schon angemeldet war, zuvor abmelden und neu anmelden, damit der neue Claim im ID-Token erscheint.

Das Skript [grantSuperadmin.js](../backend/scripts/grantSuperadmin.js) legt kein Konto und keine Firma an. Es verweigert Emulatoren und verlangt die explizite Bestätigung der Projekt-ID. Bereits vorhandene Custom Claims des Benutzers bleiben erhalten. Zugangsdaten, Passwörter und Service-Account-Schlüssel gehören nicht in dieses Repository oder in einen Chat.

Die Firebase-Web-API-Key identifiziert nur das Projekt und autorisiert keine Admin-Aktionen. Quellen: [Firebase API Keys](https://firebase.google.com/docs/projects/api-keys), [Admin-SDK-Anmeldung und Einschränkung für gcloud-Benutzer-ADC](https://firebase.google.com/docs/admin/setup#testing_with_gcloud_end_user_credentials), [Service-Account-Impersonation](https://cloud.google.com/docs/authentication/set-up-adc-local-dev-environment#service-account-impersonation), [Firebase Authentication IAM-Rolle](https://cloud.google.com/iam/docs/roles-permissions/firebaseauth).
