# Firmen-Admin einladen

1. Als Superadmin die Firma öffnen und bei „Benutzer und Rollen“ einen Administrator mit seiner echten E-Mail-Adresse einladen.
2. Im Ergebnis „Aktivierungslink kopieren“ wählen oder den Aktivierungscode notieren. Für Web-Rollen führen Link und QR-Code zu `/<FIRMA>/invite?token=…&Firma=<FIRMA>`; der QR-Code für Monteure bleibt ein TT-App-Link.
3. Den Link in einem privaten Browserfenster öffnen. Wer nur den Code hat, öffnet `/<FIRMA>` und wählt „Einladung annehmen“. Die Firmenseite zeigt Name, Logo und Farben bereits vor der Anmeldung.
4. Die eingeladene E-Mail-Adresse und den Aktivierungscode eingeben. Nach erfolgreicher Prüfung ein neues Passwort festlegen. Besteht für diese E-Mail schon ein Konto, stattdessen mit dessen Passwort anmelden.
5. „Konto aktivieren“ öffnet den Firmenbereich. Künftige Anmeldungen leiten automatisch zur eigenen Firma; bei mehreren Firmen erscheint eine Auswahl.

Einladungen sind einmalig und sieben Tage gültig. Der Server prüft die E-Mail des angemeldeten Firebase-Kontos gegen die Einladung. Der Link ist ein Zugangsschlüssel und sollte vertraulich behandelt werden. Für den lokalen Test mit derselben Person genügt ein privates Browserfenster; der Superadmin bleibt im anderen Fenster angemeldet.

## Automatischer Versand

Einladungen werden über Resend von `info@p12-aufmass.de` mit Aktivierungslink und der erzeugten PDF als Anhang verschickt, sobald der Backend-Prozess `RESEND_API_KEY` erhält. Die genaue Einrichtung und die Voraussetzungen stehen in [E-Mail-Versand-Resend.md](./E-Mail-Versand-Resend.md). Optional bleibt SMTP als Fallback erhalten. Ohne eingerichteten Versand funktionieren Web-Link, Code und PDF weiterhin manuell.

Im Einladungsdialog bereitet „E-Mail mit PDF vorbereiten“ einen Text mit Aktivierungslink vor. Unterstützt das Gerät Dateifreigabe, wird die PDF mitgeteilt. Andernfalls öffnet sich ein `mailto:`-Entwurf und die PDF wird heruntergeladen; sie muss dann im E-Mail-Programm angehängt werden. Browser können eine Datei nicht zuverlässig direkt an einen `mailto:`-Entwurf anhängen.

## Noch offen

Die Monteur-App muss den bestehenden App-QR-Code beziehungsweise Kurz-Code selbst einlösen und danach die firmenspezifischen Daten laden. Der Web-Admin-Ablauf benötigt dafür keine App-Installation.
