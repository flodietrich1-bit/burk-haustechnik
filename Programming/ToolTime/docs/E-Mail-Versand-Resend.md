# E-Mail-Versand über Resend

Der Express-Backend-Dienst verschickt Einladungen serverseitig über [emailService.js](../backend/services/emailService.js). Der Absender ist standardmäßig `P12 Aufmaß <info@p12-aufmass.de>`. Die Einladung enthält den Link zur gebrandeten Firmenseite; die erzeugte PDF mit QR-Code und Aktivierungscode wird als Anhang übertragen. Auch künftige transaktionale E-Mails können denselben Dienst nutzen.

## Produktiv einrichten

1. In Resend die Domain `p12-aufmass.de` hinzufügen, die angezeigten DNS-Einträge setzen und auf **Verified** warten. Erst dann kann `info@p12-aufmass.de` als Absender für beliebige Empfänger verwendet werden. Prüfen, ob der API-Key das Senden für diese Domain erlaubt.
2. Den vorhandenen Firebase/Google-Secret-Wert **dem laufenden Express-Backend** als Umgebungsvariable `RESEND_API_KEY` zur Laufzeit zuordnen. Nur der Secret-Name wird in der Konfiguration referenziert; der Wert gehört weder in Git noch in `VITE_`-Variablen. `EMAIL_FROM` kann auf `P12 Aufmaß <info@p12-aufmass.de>` gesetzt werden, ist aber bereits der Standard. `INVITE_WEB_BASE_URL` muss `https://p12-aufmass.de` sein.
3. Das Backend mit dieser Umgebungsvariable neu ausrollen bzw. neu starten. Eine neu erstellte Einladung an eine kontrollierte Testadresse senden und im Dialog „Einladungs-E-Mail mit PDF wurde versendet“ sowie im Resend-Dashboard den Versand prüfen. In der empfangenen Mail Link, PDF-Anhang, Code und Aktivierung testen. Bestehende Einladungen werden durch das Einrichten des Secrets nicht rückwirkend versandt.

**Wichtig zur aktuellen Projektstruktur:** Die vorhandene [firebase.json](../firebase.json) konfiguriert Firebase App Hosting mit `admin-web` als Root. Das ist die Vite-Weboberfläche. Das Express-Backend in [backend/](../backend/) ist ein eigener Prozess. Ein Secret, das nur dem Web-App-Hosting-Backend zugeordnet wurde, erscheint **nicht automatisch** im Express-Prozess. Die konkrete Laufzeit oder Deployment-Konfiguration dieses API-Prozesses ist im Repository derzeit nicht beschrieben. Dort muss die Secret-Zuordnung erfolgen; andernfalls bleibt `emailSent` false. Falls das Express-Backend selbst in einem separaten Firebase App Hosting Backend läuft, kann in dessen Einstellungen unter **Settings → Environment** eine Secret-Variable mit Key `RESEND_API_KEY` und dem vorhandenen Secret als Wert angehängt und per **Save and deploy** aktiviert werden. Bei einer anderen Laufzeit, etwa Cloud Run, muss das Secret an genau diesen Dienst gebunden werden.

## Lokal testen

In der lokalen Backend-Umgebung `RESEND_API_KEY` und optional `INVITE_WEB_BASE_URL=http://localhost:5173` setzen, danach den Backend-Prozess neu starten. Ohne Key wird keine echte E-Mail versandt; Link und PDF bleiben im Dialog verfügbar. Für einen Test ohne Empfänger `npm run test:email` in [backend/](../backend/) ausführen. Dieser Test prüft die Resend-Anfrage, den PDF-Anhang und das Verhalten bei Versandfehlern mit einem simulierten Dienst.

`RESEND_API_KEY` hat Vorrang vor den bestehenden SMTP-Variablen. Ist Resend nicht gesetzt, kann SMTP weiter als Fallback dienen. Ein Resend-Fehler löst keinen stillen SMTP-Zweitversand aus. Wird der Versand abgelehnt oder schlägt die Verbindung fehl, bleibt die Einladung gültig und die Oberfläche weist auf die manuelle Weitergabe von Link und PDF hin.

Quellen: [Resend Send Email API](https://resend.com/docs/api-reference/emails/send-email), [verifizierte Domains](https://resend.com/docs/dashboard/domains/introduction), [Idempotency Keys](https://resend.com/docs/dashboard/emails/idempotency-keys), [Firebase App Hosting Secrets](https://firebase.google.com/docs/app-hosting/configure).
