# ToolTime: Bewertung des Mandanten- und Einladungs­konzepts

Stand der Codeprüfung: 11. November 2026
Geprüfte Projekte:

- `/home/oem/Programming/ToolTime`
- `/home/oem/Programming/TTApp`

Diese Datei enthält eine fachliche und technische Bewertung. Bei der Prüfung wurden keine Dateien des bestehenden Projekts verändert, keine Implementierung gestartet und keine Deployments ausgeführt.

## Kurzfazit

Das Konzept ist fachlich sinnvoll und passt grundsätzlich zum Produkt. Es ist aber kein isoliertes Feature „Firmenverwaltung plus neue Rolle“, sondern eine Sicherheits- und Mandantenmigration.

Im aktuellen Stand fehlen drei grundlegende Voraussetzungen:

1. echte Firebase-Authentifizierung für Web und App,
2. geschlossene, mandantenfähige Firestore-/Storage-Regeln,
3. ein vertrauenswürdiges serverseitiges Backend für Einladungen, Rollen, Benutzeranlage, E-Mail und Rate-Limiting.

Eine zusätzliche Rolle `superadmin` im Frontend allein hätte derzeit praktisch keine Sicherheitswirkung.

Die TTApp war zugänglich und wurde anhand ihres aktuellen Codes geprüft. Die zuvor genannten Beobachtungen sind weitgehend bestätigt.

## 1. Bestätigter Ist-Zustand

### Web-Cockpit

#### Keine echte Anmeldung

Firebase Auth wird zwar initialisiert, aber nicht für die Anmeldung verwendet:

- `admin-web/src/firebase.ts:33`

Die tatsächliche Anmeldung:

- lädt globale Benutzer aus Firestore beziehungsweise `localStorage`,
- sucht clientseitig nach der E-Mail,
- vergleicht ein im Benutzerdokument gespeichertes Klartextpasswort,
- verwendet fest kodierte Fallback-Passwörter,
- speichert anschließend das komplette Benutzerobjekt als Sitzung in `localStorage`.

Fundstellen:

- `admin-web/src/components/LoginView.tsx:20`
- `admin-web/src/services/firestoreService.ts:1853`
- `admin-web/src/services/firestoreService.ts:1875`

Damit kann ein Browser seine Rolle oder Sitzung lokal manipulieren. Frontend-Prüfungen wie `currentUser.role === 'admin'` sind nur UI-Logik, keine Autorisierung.

#### Vorhandene Rollen und Verwaltung

Vorhanden sind:

- `admin`
- `projektleiter`
- `bauleiter`
- `kaufmaennisch`
- `monteur`

Eine Rolle `superadmin` gibt es nicht:

- `admin-web/src/types/index.ts:296`

Vorhanden ist bereits eine globale Benutzerverwaltung mit:

- Rollenfilter,
- Benutzeranlage,
- Status,
- Sprache,
- PIN-Anzeige und -Änderung,
- Projektzuordnung für Monteure.

Fundstellen:

- `admin-web/src/components/UserManagementView.tsx:24`
- `admin-web/src/components/UserManagementView.tsx:74`
- `admin-web/src/components/UserManagementView.tsx:203`

Sie ist aber global und nicht firmenbezogen. PINs werden sichtbar im Cockpit angezeigt und unverschlüsselt nach Firestore geschrieben.

Die Benutzeransicht wird derzeit lediglich clientseitig auf `admin` beschränkt:

- `admin-web/src/App.tsx:127`
- `admin-web/src/App.tsx:478`

#### Keine echten URL-Routen

Das Cockpit arbeitet mit internem `activeTab`-State. React Router oder eine andere Routing-Schicht ist nicht vorhanden. `/admin/tenants` und `/admin/tenants/:tenantId` müssten daher neu eingeführt oder bewusst durch eine andere Navigationsstruktur ersetzt werden.

#### Projekte und Zuordnungen

Projekte sind globale Dokumente unter `/projects/{projectId}`. Sie enthalten aktuell unter anderem:

- Projektleiter und Stellvertretung,
- kaufmännische Leitung und Stellvertretung,
- `assignedMonteurIds`,
- Status und Projektdaten.

Sie besitzen keinen `tenantId`:

- `admin-web/src/types/index.ts:90`

Das Cockpit lädt zunächst alle Projekte und filtert sie anschließend im Browser nach Rolle, ID, E-Mail oder sogar Namensvergleich:

- `admin-web/src/App.tsx:67`
- `admin-web/src/App.tsx:83`

Die Projektanlage einschließlich Beteiligten und Monteurzuordnung ist vorhanden:

- `admin-web/src/components/NewProjectModal.tsx:399`

### Backend

Das Backend ist ein einfacher Express-Dienst für:

- CAD-Konvertierung,
- Autodesk-Viewer-Funktionen,
- Aufmaß-PDF-Erzeugung.

Es hat derzeit:

- keine Auth-Middleware,
- keine Prüfung von Firebase-ID-Tokens,
- keine Mandantenprüfung,
- keine Einladungsendpunkte,
- kein Rate-Limiting,
- keinen Mailversand,
- kein QR-Code-Modul,
- kein Firebase Admin SDK.

Außerdem ist CORS derzeit auf `origin: '*'` gesetzt:

- `backend/server.js:23`

Vorhanden ist `pdfkit`, aber nur als technische PDF-Grundlage; ein Willkommens-/Einladungs-PDF existiert nicht:

- `backend/package.json:15`

### Firestore und Storage

Die eingecheckten Regeln erlauben uneingeschränkte Lese- und Schreibzugriffe:

- `backend/firestore.rules:1`
- `backend/storage.rules:1`

Besonders kritisch:

- jeder kann alle Benutzer inklusive PINs und Passwörtern lesen,
- jeder kann Rollen und Projektzuordnungen verändern,
- jeder kann alle Projekte und Buchungen lesen oder überschreiben,
- Storage ist vollständig offen.

Bestätigt ist nur der Repository-Stand. Ob exakt diese Regeln aktuell deployed sind, wurde nicht geprüft und bleibt offen. Die Deployment-Konfiguration verweist jedoch auf diese Dateien:

- `firebase.json:19`

### TTApp

#### PIN-Anmeldung bestätigt

Die App startet immer mit dem PIN-Screen:

- `/home/oem/Programming/TTApp/App.js:85`
- `/home/oem/Programming/TTApp/App.js:965`

Die PIN-Anmeldung:

- fragt global `/users` nach `pin` ab,
- probiert zusätzlich `/monteurs`,
- lädt anschließend sämtliche Projekte,
- fällt offline auf lokal gespeicherte Benutzer oder fest kodierte Seed-Benutzer zurück.

Fundstellen:

- `/home/oem/Programming/TTApp/src/services/authService.js:271`
- `/home/oem/Programming/TTApp/src/services/authService.js:291`
- `/home/oem/Programming/TTApp/src/services/authService.js:327`

Firebase Auth wird initialisiert, aber nicht zur Anmeldung benutzt:

- `/home/oem/Programming/TTApp/src/services/firebase.js:17`

#### PIN-Sperre bestätigt

Die Sperre wird ausschließlich in AsyncStorage gespeichert:

- nach drei Fehleingaben 30 Minuten,
- durch Löschen der App-Daten umgehbar,
- der manuelle Reload-Button setzt sie ausdrücklich zurück.

Fundstellen:

- `/home/oem/Programming/TTApp/src/services/authService.js:114`
- `/home/oem/Programming/TTApp/src/services/authService.js:141`
- `/home/oem/Programming/TTApp/src/screens/PinLockScreen.jsx:88`

#### Offline- und Synchronisationsmodell bestätigt

Räume, Materialien, Projektinformationen, Pläne und letzter Sync-Zeitpunkt werden projektbezogen gespeichert. Buchungen und Nachträge liegen in globalen lokalen Outboxes, enthalten aber eine `projectId` und werden beim Sync gefiltert.

Fundstellen:

- `/home/oem/Programming/TTApp/src/services/storageService.js:5`
- `/home/oem/Programming/TTApp/src/services/storageService.js:68`
- `/home/oem/Programming/TTApp/src/services/storageService.js:343`
- `/home/oem/Programming/TTApp/src/services/storageService.js:544`

Die App schreibt Buchungen momentan doppelt:

- `/projects/{projectId}/bookings/{bookingId}`
- `/bookings/{bookingId}`

Entsprechend auch Nachträge:

- `/home/oem/Programming/TTApp/src/services/syncService.js:243`
- `/home/oem/Programming/TTApp/src/services/syncService.js:289`

Der Offline-Ablauf ist grundsätzlich brauchbar und sollte erhalten bleiben. Die Synchronisierung muss aber mit einer echten Auth-Sitzung, Mandantenprüfung und sauberem Ausloggen ergänzt werden.

#### Branding bestätigt

Farben sind statische App-Konstanten:

- `/home/oem/Programming/TTApp/src/constants/theme.js:1`

Auch Burk-Branding und Fallback-Projekttexte sind direkt in UI beziehungsweise App-Logik hinterlegt:

- `/home/oem/Programming/TTApp/src/screens/PinLockScreen.jsx:125`
- `/home/oem/Programming/TTApp/App.js:1001`

## 2. Bewertung des Konzepts

### Direkt sinnvoll und umsetzbar

Gut umsetzbar sind:

- globale Firmenübersicht für einen echten Systembetreiber,
- Firmenstatus und aggregierte Benutzer-/Projektzahlen,
- Firmenlogo und Primärfarbe,
- firmenspezifische Benutzeransicht,
- Einladung per hochentropischem QR-Token,
- ergänzender sechsstelliger Kurz-Code,
- einmalige, ablaufende Einladungen,
- serverseitige Einlösung,
- Aktivierung der App mit anschließender regulärer Firebase-Sitzung,
- dynamisches Branding,
- Weiterverwendung des bestehenden Offline-Caches nach erfolgreicher Erstaktivierung.

### Noch nicht direkt umsetzbar

Vorher oder parallel müssen entstehen:

- Firebase-Auth-basierte Identitäten,
- serverseitige Rollen- und Mandantenautorisation,
- Firestore- und Storage-Regeln,
- Backend mit Firebase Admin SDK,
- Tokenprüfung an Backend-Endpunkten,
- Routing oder eine gleichwertige Navigationslösung im Cockpit,
- Einladungs-, E-Mail-, QR- und PDF-Infrastruktur,
- App-Migration von PIN-Lookup zu Aktivierung plus regulärer Sitzung,
- Datenmigration für vorhandene globale Dokumente.

## 3. Reicht `superadmin` als zusätzliche Rolle?

Nein.

`superadmin` ist nur dann eine wirksame Rolle, wenn sie aus einer nicht manipulierbaren Identität stammt. Empfehlenswert ist:

- Firebase Auth für Web und App,
- serverseitig verwaltete Custom Claims, mindestens `platformRole`,
- Firmenrollen nicht ausschließlich als Claims, sondern als Firestore-Mitgliedschaften,
- Regeln, die `request.auth.uid` und die Mitgliedschaft verwenden,
- privilegierte Änderungen ausschließlich über Backend/Admin SDK.

Eine praktikable Trennung wäre:

- Plattformrolle: `superadmin`
- Firmenrolle: `admin | bauleiter | kaufmaennisch | monteur`

`superadmin` sollte nicht einfach als frei editierbares Feld in `/users/{uid}` liegen. Sonst könnte es bei fehlerhaften Regeln selbst gesetzt werden.

Vor Freischaltung der Firmenverwaltung müssen Auth und Regeln mindestens in einer sicheren Übergangsversion stehen. Andernfalls wären Firmen nur optisch getrennt.

## 4. Empfohlenes Datenmodell

Empfohlen werden mandantenzentrierte Pfade:

```text
tenants/{tenantId}
  name
  slug
  status
  branding:
    primaryColor
    logoPath
  createdAt
  updatedAt

tenants/{tenantId}/members/{uid}
  role: admin | bauleiter | kaufmaennisch | monteur
  status
  displayName
  email
  defaultLanguage
  createdAt

tenants/{tenantId}/projects/{projectId}
  ...bestehende Projektdaten...
  assignedUserIds[]
  status

tenants/{tenantId}/projects/{projectId}/rooms/{roomId}
tenants/{tenantId}/projects/{projectId}/positions/{positionId}
tenants/{tenantId}/projects/{projectId}/bookings/{bookingId}
tenants/{tenantId}/projects/{projectId}/addendums/{addendumId}
tenants/{tenantId}/projects/{projectId}/alerts/{alertId}

tenants/{tenantId}/invites/{inviteId}
  role
  emailNormalized
  targetUserId?
  qrTokenHash
  shortCodeHash
  shortCodeLookupHash
  status: pending | redeemed | expired | revoked
  expiresAt
  redeemedAt
  redeemedByUid
  resendGeneration
  createdByUid
  createdAt
```

Zusätzlich kann es ein globales, nicht clientlesbares Verzeichnis geben:

```text
userTenantMemberships/{uid}/tenants/{tenantId}
```

Das erleichtert nach dem Login das Finden der Firmenmitgliedschaften. Alternativ kann eine Callable Function die Mitgliedschaften zurückgeben.

### Warum Untercollections statt nur `tenantId` auf globalen Dokumenten?

Beides ist möglich. Untercollections bieten hier aber:

- klarere Regelgrenzen,
- geringeres Risiko vergessener `tenantId`-Filter,
- natürliches tenantbezogenes Storage-Schema,
- einfachere Löschung, Archivierung und Exporte.

Globale Doppelablagen wie die heutigen `/bookings` und `/addendums` sollten langfristig entfallen. Für systemweite Auswertungen sind Collection-Group-Queries oder serverseitig gepflegte Aggregate geeigneter.

### Migration der bestehenden Daten

Empfohlene verlustfreie Migration:

1. Eine erste Firma, etwa `burk`, anlegen.
2. Alle vorhandenen Benutzer dieser Firma zuordnen.
3. Alle vorhandenen Projekte und Untercollections unverändert der Firma zuordnen.
4. IDs der Projekte, Räume, Positionen und Buchungen beibehalten.
5. Bestehende Beziehungen zunächst übernehmen; Namens-/Slug-Zuordnungen anschließend auf stabile UIDs normalisieren.
6. Vor dem Umschalten eine Bestandsaufnahme mit Dokumentzahlen und Referenzprüfung erzeugen.
7. Migration idempotent und mit einem `migrationVersion`-Feld durchführen.
8. Erst nach erfolgreicher Verifikation Clients und Regeln auf die neuen Pfade umschalten.
9. Alte globale Daten zunächst nur lesend als Rollback-Quelle behalten und erst später entfernen.

Eine risikoärmere Zwischenstufe wäre, zunächst `tenantId: "burk"` zu allen globalen Dokumenten hinzuzufügen und Regeln darauf aufzubauen. Das reduziert die erste Migration, belässt aber dauerhaft mehr Risiko durch falsch formulierte Queries. Als Übergang ist das sinnvoll, als endgültiges Modell weniger attraktiv.

## 5. Sichere Einlösung der Einladung

### Token und Kurz-Code

QR und Kurz-Code sollten zwei Darstellungen derselben Einladung sein, aber nicht dieselbe Sicherheitsstärke haben:

- QR: mindestens 128 Bit kryptografischer Zufall, als undurchsichtiges Token.
- Kurz-Code: sechs Zeichen aus einem eingeschränkten Alphabet, beispielsweise ohne `0/O/1/I/L`.
- In Firestore nur Hashes speichern, keine verwendbaren Tokens.
- Kurz-Code für Lookup mit einem serverseitigen HMAC hashen; nicht mit einem normalen, öffentlich reproduzierbaren Hash.
- Nach Einlösung beide Varianten gemeinsam ungültig machen.

`H8-4K2P` hat sechs Zeichen; der Bindestrich ist nur Darstellung und wird bei der Normalisierung entfernt.

### Unbekannte Codes

Ein unbekannter Code gehört zu keiner Einladung. Deshalb kann der Fehlversuch nicht sinnvoll „an der Einladung“ gespeichert werden.

Er muss in separaten serverseitigen Rate-Limit-Buckets gezählt werden, beispielsweise kombiniert nach:

- IP-Präfix,
- App-/Geräte-Installationstoken,
- Firebase App Check,
- normalisiertem Code-HMAC beziehungsweise Code-Präfix,
- globalem System-Budget.

Nur pro Einladung zu zählen schützt nicht vor verteiltem Raten. Nur pro IP zu zählen schützt nicht vor Botnetzen und kann Mobilfunk-NATs unnötig sperren.

Empfehlung:

- großzügiges IP-/Geräte-Grundlimit,
- engeres Limit für wiederholte Eingaben desselben Codes,
- globaler Schutz gegen hohe Fehlerraten,
- Firebase App Check als zusätzliche Hürde,
- protokollierte Anomalien und Alarmierung,
- einheitliche Antwort für unbekannt, abgelaufen, widerrufen und bereits verbraucht.

Die API sollte nicht verraten, ob ein konkreter Code existiert. Die App darf etwa melden: „Einladung ungültig, abgelaufen oder bereits verwendet.“

### Staffelung der Sperren

Die vorgeschlagene Staffelung ist als produktbezogene Rückmeldung verständlich, sollte aber nicht ausschließlich an der Einladung hängen.

Sinnvoller:

- Fehlversuche eines bekannten Codes können zusätzlich am Invite gezählt werden.
- Unbekannte Codes gehen in Rate-Limit-Buckets.
- Nach mehreren Fehlern gilt ein serverseitiges `retryAfter`.
- HTTP-seitig wäre `429` plus strukturierter Fehlercode und `retryAfterSeconds` passend.
- Eine Einladung sollte nicht allein durch fremde Fehleingaben dauerhaft gesperrt werden; sonst kann ein Angreifer gezielt fremde Einladungen sabotieren.

Daher wird keine automatische dauerhafte Sperrung nach nur fünf Fehleingaben empfohlen. Besser sind zeitliche Sperre, globale Limits und gegebenenfalls manueller Widerruf.

### Parallelität und einmalige Einlösung

Die Einlösung muss in einer Firestore-Transaktion erfolgen:

1. Einladung lesen.
2. Status und `expiresAt` prüfen.
3. Rate-Limit prüfen.
4. vorgesehenen Benutzer beziehungsweise E-Mail-Kontext prüfen.
5. Firebase-Auth-Benutzer erstellen oder bestehende Identität verbinden.
6. Mitgliedschaft vorbereiten.
7. Einladung atomar auf `redeemed` setzen.

Bei zwei parallelen Anfragen darf genau eine Transaktion erfolgreich committen.

Das Erzeugen eines Firebase-Auth-Benutzers ist nicht Teil derselben Firestore-Transaktion. Der Prozess braucht deshalb Idempotenz, beispielsweise über eine reservierte `redemptionId` und wiederholbare Arbeitsschritte. Alternativ wird erst der Firestore-Claim atomar reserviert, dann Auth/Mitgliedschaft vervollständigt und bei Fehlern kontrolliert fortgesetzt.

### Ablauf, erneuter Versand und Widerruf

Empfehlung:

- Standardablauf 72 Stunden oder 7 Tage.
- „Erneut senden“ erzeugt eine neue Token-Generation.
- Die alte Generation wird sofort widerrufen.
- Kein Zurücksetzen eines alten Tokens.
- Versandanzahl, Zeitpunkt und auslösender Admin werden protokolliert.
- Statuswechsel: `pending → redeemed`, `pending → expired`, `pending → revoked`.
- Eine eingelöste Einladung wird nie wieder aktiviert.

### Reguläre Sitzung nach Aktivierung

Nach erfolgreicher Aktivierung sollte der Backend-Endpunkt ein Firebase Custom Token ausstellen oder einen geeigneten Firebase-Auth-Anmeldefluss einleiten. Die App meldet sich damit über Firebase Auth an und erhält danach reguläre ID-/Refresh-Tokens.

Ab diesem Moment:

- alle Firestore-Zugriffe laufen als `request.auth.uid`,
- Regeln prüfen Firma, Rolle und Projektzuordnung,
- der Kurz-Code wird nie wieder zur täglichen Anmeldung benutzt,
- die Sitzung bleibt sicher erneuerbar,
- lokales Sperren der App kann optional weiterhin über PIN/Biometrie erfolgen, ist aber nur Geräteschutz und keine Cloud-Authentifizierung.

## 6. Erforderliche Änderungen in der TTApp

### Onboarding

Neu benötigt werden:

- Zustand „nicht aktiviert“ versus „aktivierte Sitzung“,
- Willkommensscreen,
- QR-Scanner mit Kameraberechtigung,
- manuelle alphanumerische Codeeingabe,
- automatische Großschreibung und Normalisierung,
- Countdown aus `retryAfterSeconds`,
- Wiederaufnahme einer begonnenen Aktivierung,
- verständlicher Offline-Hinweis: Erstaktivierung benötigt Internet.

Der QR-Code sollte ausschließlich eine ToolTime-URL beziehungsweise ein undurchsichtiges Token enthalten, keine Firma, Rolle oder UID als vertrauenswürdige Daten.

### PIN

Die bestehende PIN-Abfrage darf nicht mehr Identität aus Firestore suchen.

Zwei mögliche Ziele:

- Empfehlung: Einladung aktiviert eine Firebase-Sitzung; danach schützt eine lokale PIN oder Biometrie nur das bereits aktivierte Gerät.
- Alternative: vollständige Abschaffung der PIN nach Aktivierung.

Bei lokaler PIN:

- niemals Benutzer über PIN aus Firestore suchen,
- PIN gerätebezogen und sicher gespeichert,
- Fehlversuche lokal begrenzen,
- „Gerät abmelden“ löscht Firebase-Sitzung, lokale Auth-Daten und sensible Cache-Schlüssel,
- Firmenwechsel oder Benutzerwechsel darf nicht einfach fremde Caches öffnen.

### Offline-Nutzung

Der bestehende Offline-first-Ansatz kann bleiben. Ergänzt werden müssen:

- Cache-Schlüssel mindestens nach `tenantId + projectId`,
- Outbox-Einträge mit `tenantId`, `projectId`, `createdByUid`,
- keine Übernahme des Benutzernamens als Autoritätsmerkmal,
- Auth-Status vor dem Push prüfen,
- bei abgelaufener Offline-Sitzung Buchungen weiter lokal zulassen, aber erst nach erneuter Anmeldung hochladen,
- bei entzogenem Firmen-/Projektzugriff keine neuen Cloud-Schreibvorgänge zulassen,
- klarer Konfliktfall, wenn ein Projekt während längerer Offline-Zeit entzogen wurde.

Die aktuelle globale Outbox mit Projektfilter ist migrationsfähig, sollte aber tenantbezogen versioniert werden.

### Synchronisierung

Heute schreibt die App direkt nach Firestore und teilweise doppelt in globale und projektbezogene Collections. Künftig sollte sie:

- nur in den Tenant-/Projektpfad schreiben,
- die Regeln über UID, Mitgliedschaft und Projektfreigabe passieren,
- keine PIN oder komplettes Benutzerprofil in Projekt-Untercollections kopieren,
- serverseitige Zeitstempel beziehungsweise robuste Konfliktversionen verwenden,
- stabile idempotente Buchungs-IDs beibehalten.

Besonders problematisch ist derzeit, dass das vollständige Monteur-Objekt inklusive PIN nach `/projects/.../monteurs/...` gespiegelt wird:

- `/home/oem/Programming/TTApp/src/services/authService.js:416`

### Dynamisches Branding

Nach Aktivierung sollte ein kleines Tenant-Bootstrap-Dokument geladen und lokal gespeichert werden:

```text
tenantId
tenantName
logoVersion/logoUrl
primaryColor
secondaryColor optional
brandingVersion
```

Dabei:

- Farbe validieren,
- ausreichenden Kontrast sicherstellen,
- sichere Standardfarben verwenden, falls Branding fehlt,
- Logo lokal cachen,
- Branding-Version zur Cache-Invalidierung verwenden,
- kritische Statusfarben wie Rot/Grün nicht vollständig durch Firmenfarben ersetzen.

## 7. Wirklich architekturrelevante Produktentscheidungen

### 1. Darf ein Benutzer mehreren Firmen angehören?

**Empfehlung:** Das Datenmodell grundsätzlich dafür auslegen, die erste Version der App aber auf eine aktive Firma gleichzeitig beschränken.

Begründung: Externe Bauleiter, Partner oder Systembetreiber können später mehrere Firmen benötigen. Ein hartes `user.tenantId` würde das erschweren.

### 2. Ist die Einladung an eine konkrete E-Mail/Person gebunden?

**Empfehlung:** Für Web-Rollen zwingend an E-Mail binden; für Monteure optional eine „gerätebasierte Aktivierung ohne E-Mail“ als gesonderten Einladungstyp zulassen.

Begründung: Nicht jeder Monteur besitzt eine Firmen-E-Mail. Ein einziger unspezifischer Einladungsfluss würde entweder Web-Konten schwächen oder Monteure unnötig blockieren.

### 3. Soll ein Monteur dieselbe Einladung auf mehreren Geräten verwenden können?

**Empfehlung:** Nein, Einladung einmalig. Weitere Geräte erhalten eine neue Gerätefreigabe oder einen bewusst definierten „weiteres Gerät“-Flow.

Begründung: Sonst verliert „einmalige Einlösung“ ihren Sicherheitswert und Geräte lassen sich schlecht widerrufen.

### 4. Wie lange sollen Einladungen gültig sein?

**Empfehlung:** 7 Tage als Standard, widerrufbar, alter Token bei erneutem Versand sofort ungültig.

Begründung: Baustellen-Onboarding erfolgt nicht immer am selben Tag; 24 Stunden wären häufig zu knapp. Für besonders sensible Admin-Einladungen können 72 Stunden verwendet werden.

### 5. Darf Firmenbranding die komplette App-Farbwelt ersetzen?

**Empfehlung:** Nur Primär-/Akzentfarbe und Logo dynamisieren; semantische Farben und Kontrastregeln zentral beibehalten.

Begründung: Frei wählbare Farben können Lesbarkeit, Warnzustände und Barrierefreiheit zerstören.

### 6. Werden „Projektleiter“ und „Bauleiter“ eine oder zwei Rollen?

**Empfehlung:** Vor der Migration vereinheitlichen. Wenn fachlich kein Rechteunterschied besteht, eine kanonische Rolle `bauleiter` wählen und alte Werte migrieren.

Begründung: Der aktuelle Code behandelt beide Begriffe teilweise gleich, teilweise getrennt. Das führt sonst zu unnötig komplizierten Regeln.

## 8. Verbesserter, umsetzbarer Projektauftrag

### Phase 1 – Sicherheits- und Architekturgrundlage

1. Zielrollen, Mehrfirmenfähigkeit und Einladungstypen verbindlich festlegen.
2. Firebase Auth für Web und TTApp entwerfen.
3. Tenant-, Membership-, Projekt- und Einladungsmodell festlegen.
4. Firestore-/Storage-Regeln sowie Emulator-Tests dafür erstellen.
5. Backend auf Firebase Admin SDK und verifizierte ID-Tokens umstellen.
6. Bestehende unauthentifizierte CAD-/PDF-Endpunkte schützen oder bewusst trennen.
7. Keine neue Firmenverwaltung produktiv freischalten, bevor diese Basis steht.

### Phase 2 – Bestehende Daten migrieren

1. Bestandsinventar von Benutzern, Projekten und Untercollections erzeugen.
2. Erste Firma für den gesamten vorhandenen Burk-Bestand anlegen.
3. Benutzer auf Firebase-Auth-UIDs und Memberships abbilden.
4. Projekte und alle Unterdaten verlustfrei dem Tenant zuordnen.
5. Namens-, Slug- und E-Mail-Zuordnungen durch stabile UIDs ersetzen.
6. Doppelte globale Buchungen/Nachträge identifizieren und deduplizieren.
7. Migration mit Zählwerten, Referenzprüfungen und Rollback verifizieren.

### Phase 3 – Web-Cockpit authentifizieren

1. Aktuelle Klartext-/`localStorage`-Anmeldung entfernen.
2. Firebase-Auth-Login und sicheren Session-Bootstrap einführen.
3. Rollen- und Tenant-Zugriff serverseitig beziehungsweise per Rules durchsetzen.
4. Bestehende Benutzer- und Projektverwaltung tenantbezogen umbauen.
5. Kaufmann-Zugriff fachlich ergänzen, falls dieser das Cockpit nutzen soll.
6. URL-Routing für `/admin/tenants` und Detailansichten einführen.
7. `superadmin` ausschließlich über serverseitig verwaltete Plattformberechtigung freigeben.

### Phase 4 – Firmenverwaltung

1. Firmenliste mit Status und serverseitig ermittelten Kennzahlen bauen.
2. Firmenanlage mit eindeutigem Kürzel, Logo und validierter Primärfarbe.
3. Detailansicht mit Rollen- und Statusfiltern.
4. Audit-Log für Firmen-, Rollen- und Benutzeränderungen.
5. Logo-Uploads tenantbezogen über geschützte Storage-Pfade führen.

### Phase 5 – Einladungssystem im Backend

1. Kryptografische QR-Tokens und menschenlesbare Kurz-Codes erzeugen.
2. Nur Hash/HMAC-Ableitungen speichern.
3. Ablauf, Widerruf, Generation und einmalige Verwendung implementieren.
4. `redeemInviteCode` mit Transaktion und Idempotenz implementieren.
5. Mehrstufiges Rate-Limiting für bekannte und unbekannte Codes einführen.
6. Firebase App Check und Monitoring ergänzen.
7. Auth-Benutzer und Tenant-Membership sicher anlegen.
8. Custom Token beziehungsweise regulären Firebase-Auth-Flow zurückgeben.
9. QR-Code, Einladungs-PDF und E-Mail-Versand implementieren.
10. Erneuten Versand als neue, die alte widerrufende Generation bauen.

### Phase 6 – TTApp-Onboarding

1. Aktivierungszustand getrennt von lokalem App-Lock modellieren.
2. Willkommen-, QR-Scanner- und Codeeingabe-Screens ergänzen.
3. Serverfehler und `retryAfterSeconds` inklusive Countdown darstellen.
4. Nach Aktivierung Firebase-Auth-Sitzung herstellen.
5. Tenantprofil, Benutzerprofil, Branding und Projektfreigaben laden.
6. Lokale PIN optional nur noch als Gerätesperre verwenden.
7. Seed-PINs und globale PIN-Abfragen nach abgeschlossener Migration entfernen.

### Phase 7 – Offline- und Sync-Migration

1. Cache- und Outbox-Schema um `tenantId`, UID und Schema-Version erweitern.
2. Bestehende lokale Daten migrationssicher übernehmen.
3. Synchronisierung auf tenantbezogene Pfade umstellen.
4. Globale Doppelschreibvorgänge entfernen.
5. Entzug von Mitgliedschaft oder Projektzugriff sauber behandeln.
6. Offline-Buchung bei temporär abgelaufener Sitzung ermöglichen, Upload aber bis zur Reauthentifizierung zurückhalten.
7. Konflikt-, Wiederholungs- und Abbruchfälle gezielt testen.

### Phase 8 – Absicherung und Rollout

1. Firestore-/Storage-Regeln im Emulator mit allen Rollen testen.
2. Parallel-Einlösung, Replay, Ablauf und erneuten Versand testen.
3. Verteilte Rate-Limit-Szenarien und Code-Enumeration testen.
4. Migration zunächst mit einer Testfirma durchführen.
5. Danach Burk als erste produktive Firma migrieren.
6. Erst nach erfolgreicher Validierung alte globale Pfade und PIN-Authentifizierung stilllegen.

## Abschließende Bewertung

Das Konzept ist gut realisierbar. Der richtige Einstieg ist jedoch die Authentifizierungs- und Mandantengrundlage, nicht zunächst die neue Admin-Oberfläche. Eine reine Ergänzung der Rolle `superadmin` würde die bestehenden Sicherheitsprobleme nicht lösen und keine belastbare Mandantentrennung schaffen.

## Bestätigte Produktentscheidungen vom 11. November 2026

1. Ein Benutzer darf mehreren Firmen angehören, benötigt aber für jede Firma eine eigene Einladung.
2. Web-Rollen benötigen eine E-Mail-Adresse; Monteure können ohne E-Mail eingeladen werden.
3. Pro Monteur ist zunächst genau ein aktives Gerät vorgesehen.
4. Einladungen sind standardmäßig sieben Tage gültig.
5. `projektleiter` wird auf die kanonische Rolle `bauleiter` normalisiert.
6. Burk wird als erster Tenant eingerichtet.
7. Die mandantenzentrierte Struktur unter `tenants/{tenantId}` ist das Zielmodell.
8. Es gibt noch keine echten Nutzer. Deshalb ist kein Legacy-Kompatibilitätsfenster für installierte App-Versionen erforderlich; der Bestand kann frisch aufgesetzt werden.
9. Vorläufig wird lokal implementiert und verifiziert. Ein Git-Revert stellt nur den Code wieder her, nicht Firebase-Auth-, Firestore- oder Regelzustände. Vor einem späteren produktiven Eingriff ist deshalb weiterhin ein Export oder ein reproduzierbarer Seed erforderlich.
