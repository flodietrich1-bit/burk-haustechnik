# Firmen-Admin ohne E-Mail-Versand einladen

1. Als Superadmin die Firma öffnen und bei „Benutzer und Rollen“ einen Administrator mit seiner echten E-Mail-Adresse einladen.
2. Im Ergebnis „Aktivierungslink kopieren“ wählen oder den Aktivierungscode notieren. Der QR-Code bleibt für die spätere TT-App; der Web-Link führt zu `/invite`.
3. Den Link in einem privaten Browserfenster öffnen. Wer nur den Code hat, öffnet die normale Anmeldeseite und wählt „Einladung annehmen“.
4. Die eingeladene E-Mail-Adresse und den Aktivierungscode eingeben. Nach erfolgreicher Prüfung ein neues Passwort festlegen. Besteht für diese E-Mail schon ein Konto, stattdessen mit dessen Passwort anmelden.
5. „Konto aktivieren“ öffnet den Firmenbereich. Künftige Anmeldungen leiten automatisch zur eigenen Firma; bei mehreren Firmen erscheint eine Auswahl.

Einladungen sind einmalig und sieben Tage gültig. Der Server prüft die E-Mail des angemeldeten Firebase-Kontos gegen die Einladung. Der Link ist ein Zugangsschlüssel und sollte vertraulich behandelt werden. Für den lokalen Test mit derselben Person genügt ein privates Browserfenster; der Superadmin bleibt im anderen Fenster angemeldet.

## Automatischer Versand

Der vorhandene SMTP-Versand in [invitationDeliveryService.js](../backend/services/invitationDeliveryService.js) wird durch `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `INVITE_FROM_EMAIL` und `INVITE_WEB_BASE_URL` konfiguriert. Mit `INVITE_WEB_BASE_URL` enthält die Admin-E-Mail den Aktivierungslink. Ohne `SMTP_HOST` wird keine E-Mail verschickt. Für einen produktiven Versand werden ein Mailanbieter, eine verifizierte Absenderdomain und passende SMTP-Zugangsdaten benötigt. Der manuelle Web-Link funktioniert unabhängig davon.

Im Einladungsdialog bereitet „E-Mail mit PDF vorbereiten“ einen Text mit Aktivierungslink vor. Unterstützt das Gerät Dateifreigabe, wird die PDF mitgeteilt. Andernfalls öffnet sich ein `mailto:`-Entwurf und die PDF wird heruntergeladen; sie muss dann im E-Mail-Programm angehängt werden. Browser können eine Datei nicht zuverlässig direkt an einen `mailto:`-Entwurf anhängen.

## Noch offen

Die Monteur-App muss den bestehenden App-QR-Code beziehungsweise Kurz-Code selbst einlösen und danach die firmenspezifischen Daten laden. Der Web-Admin-Ablauf benötigt dafür keine App-Installation.
