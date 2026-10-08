# Project Handover

Evidence labels used below: **[code]** confirmed from code, **[config]** confirmed from configuration, **[git]** from Git history, **[inferred]** inferred but not verified, **Unknown / needs confirmation**.

## 1. Project Overview

TTApp is a React Native (Expo) mobile app for installers ("Monteure") of Burk Haustechnik (plumbing/heating contractor) [code: names, data]. A Monteur unlocks the app with a 4-digit PIN, picks a construction project, picks a room, and records installed material quantities per room (against planned quantities from the bill of quantities), takes proof photos, files "Mehrbedarf" (additional demand) requests and unplanned-material records, and completes rooms. Everything works offline and is synced to Firebase (Firestore/Storage), where a separate admin web app (`/home/oem/Programming/ToolTime`, different repo) manages projects, positions, rooms and users [code: Firestore paths; admin app content only partially inspected].

UI languages: German (base), Romanian, Polish, Croatian [code: `i18n.js`].

## 2. Current Status

- App version `v2.19` (`src/constants/version.js`) [code]. `package.json`/`app.json` version are still `1.0.0` (unrelated to the display version) [config].
- Implemented [code]: PIN login with lockout, multi-project selection, per-project offline cache, room list with live percentages, floor filter pills `[Alle, UG, EG, OG, DG, Strangschema]`, floor grouping, unblocked overconsumption booking flow via `OverConsumptionModal`, alert replication to `projects/{projectId}/alerts` for admin banner, material booking per room with stock checks, "Mehrbedarf" modal (ohne Unterschrift, Monteur bereits authentifiziert), unplanned/außerplanmäßig material modal mit Erfassername (ohne Unterschrift), photo capture (camera/gallery, compress < 1000 KB), room completion (locks room), delta two-way sync, auto-sync on reconnect/after actions, EAS OTA update check at startup.
- Maturity: working prototype in active iteration (≈ 11 app releases v1.2→v2.11 in 10 days, 2026-09-21 → 2026-09-30) [git]. No automated tests, linting or type checking. Not production-hardened security-wise (see §7, §13).
- Whether the app is deployed to real users / which EAS channel is used: Unknown / needs confirmation.

## 3. Technology Stack

- Expo SDK `~57.0.24`, React Native `0.86.3`, React `19.2.3`; JavaScript only (no TypeScript) [config: `package.json`].
- Libraries: `firebase ^12.19` (Firestore, Storage; `getAuth` initialised but sign-in never used), `@react-native-async-storage/async-storage`, `@react-native-community/netinfo`, `expo-file-system`, `expo-image-manipulator`, `expo-image-picker`, `expo-updates`, `expo-status-bar`, `react-native-svg` (ProgressRing) [config/code].
- Package manager: npm (`package-lock.json`) [config].
- Backend: Firebase project `burk-haustechnik` (Firestore + Storage); config object hard-coded in `src/services/firebase.js` [code].
- Hosting/distribution: Expo/EAS (`owner: vibe-factory-gmbh`, updates URL `https://u.expo.dev/<projectId>`, `runtimeVersion.policy: appVersion`) [config]. No `eas.json` in repo; build profiles Unknown / needs confirmation.
- Git remote: `git@github.com:flodietrich1-bit/burk-haustechnik.git`; branch `Monteur` is the only app branch [git/AGENTS.md].

## 4. Repository Structure

```
App.js                      Root component: all app state, handlers, screen routing (~1000 lines)
index.js                    registerRootComponent(App)
app.json                    Expo config (name TTApp, EAS updates, icons)
src/constants/              version.js (APP_VERSION), theme.js (COLORS), initialData.js (seed rooms/materials for hallenbad-weingarten)
src/locales/i18n.js         LANGUAGES, TRANSLATIONS, GLOSSARY, t(), formatUnit()
src/services/firebase.js    Firebase init (db, storage, auth)
src/services/authService.js PIN auth, lockout, seed monteurs/projects, active monteur
src/services/storageService.js AsyncStorage layer: rooms/materials/project cache, outbox (bookings, addendums), lastSyncedAt, delta computation, computeRoomPercentage
src/services/syncService.js Online check, photo upload, syncBookings() push+pull
src/screens/                PinLock, ProjectSelect, SyncLoading, RoomList, Booking, PhotoCapture, Done (+ SetupProfile, unused)
src/components/             Header, PinPad, ProgressBar, ProgressRing, SignaturePad
src/components/booking/     BookingScreen sub-components (MaterialBookingCard, NachtragModal, UnplannedInstallModal, OverConsumptionModal, CompleteRoomModal), their *Styles.js, bookingHelpers.js
assets/                     icons/splash
dist/, .expo/               Generated, gitignored
AGENTS.md / CLAUDE.md       Agent rules (CLAUDE.md just contains `@AGENTS.md`)
.claude/settings.json       Enables an Expo Claude plugin
```
No README, no tests, no CI config, no `.env` files in the repo.

## 5. Architecture

[code] Single-activity, state-driven app. `App.js` holds all state and handlers and passes props down.

- `appPhase`: `loading` → `pin` → (`project_select` if >1 assigned project) → `app`. Within `app`, `currentScreen`: `rooms` → `book` → `photos` → (`book`) / `done` → `rooms`. There is no navigation library.
- Startup (`initApp`): loads language, active monteur, cached rooms/materials/project (using the fallback project), pending delta; always shows the PIN screen; checks for an EAS update in production builds and reloads if available.
- Login: `PinLockScreen` → `authenticateByPin` → `handleUnlockWithAutoSync` (sync overlay when online, then project select or direct entry).
- Booking flow: selecting a room restores room drafts (`draftQuantities`, `photos`, `draftUnclear`). Quantity steppers in `BookingScreen` change `sessionQuantities`; leaving the room (`handleLeaveRoomDraft`) or saving photos persists drafts into the room object, recomputes `pct` (`computeRoomPercentage`) and triggers a silent sync if online. "Complete room" (`handleCompleteRoom`) enqueues one booking per material delta (plus photo-doc booking if no deltas, unclear-item bookings with `status: 'pending_assignment'`, and a `room_completion` booking), updates local `installedQty`, marks the room `isCompleted`/100 %, and syncs.
- Extra flows: `handleAddNachtrag` (Mehrbedarf → `enqueueAddendum`), `handleAddUnclearItem` (unplanned installed material → adds to local catalog + room + addendum of type `ausserplanmaessig`), `handleOverConsumptionAlert` (enqueue booking with `type: 'over_consumption_alert'`).
- Offline-first: all of the above write to AsyncStorage first. `getLocalUnsyncedDelta(projectId)` finds pending bookings/addendums (`status === 'pending'`) and rooms with unsynced changes. `syncBookings` pushes those, then pulls positions and rooms changed since `lastSyncedAt` (per project), then stores a new `lastSyncedAt`. A NetInfo listener triggers silent sync on reconnect.
- Photos: compressed to < 1000 KB at capture, copied to `documentDirectory/proofs/`, and uploaded during sync via base64 `uploadString` to Storage path `projects/<projectId>/proofs/...`; fallbacks: alternate bucket names, then a low-res base64 data URI stored directly in Firestore.

## 6. Data Model / Database

**Firestore** (project `burk-haustechnik`) [code: `syncService.js`, `authService.js`]:
- `users` (queried by `pin`, string then number) and `monteurs` (queried by `pin`): login lookup; schema written by admin web, not inspected. User fields read: `name`, `pin`, `assignedProjectIds`/`projectIds`, `role`, `defaultLanguage`.
- `projects` (all docs read at login) with subcollections:
  - `positions` (bill-of-quantities items; read: `posNr`, `shortText`, `qty`, `deliveredQty`, `installedQty`, `qu`, `group`, `updatedAt`, …) – pulled only.
  - `rooms` (read/written: `pct`, `progressPercent`, `isCompleted`, `status`, `completedAt/By`, `completionDelta`, `draftQuantities`, `photos`, `materials[]` with `positionId`/`plannedQty`/`installedQty`, `updatedAt`, …) – pulled and pushed (merge).
  - `bookings/{id}` – pushed; also duplicated to root `bookings/{id}`.
  - `addendums/{id}` – pushed; also duplicated to root `addendums/{id}`.
  - `monteurs/{id}` – monteur profile pushed by `syncMonteurToFirebase`.
- Delta pull uses `where('updatedAt', '>', lastSyncedAt)` on ISO strings (falls back to full fetch + client filter on error).

**Local (AsyncStorage keys)** [code]: `ttapp_selected_language`, `ttapp_cached_rooms_<pid>`, `ttapp_cached_materials_<pid>`, `ttapp_cached_project_<pid>`, `ttapp_last_synced_at_<pid>`, `ttapp_outbox_bookings`, `ttapp_outbox_addendums` (both global, not per project), `ttapp_active_monteur`, `ttapp_known_monteurs`, `ttapp_all_projects`, `ttapp_pin_failed_attempts`, `ttapp_pin_locked_until`, legacy unscoped `ttapp_cached_rooms/materials/project` (written only for `hallenbad-weingarten`). `UNCLEAR` and `USER_PROFILE` keys are declared but unused.

**Booking types** (all in the one `bookings` outbox): normal material booking, `photo_doc` (`itemOz: 'DOKU'`), `room_completion`, `over_consumption_alert`, and unclear items (`isUnclear: true`; the passed `status: 'pending_assignment'` is overwritten with `'pending'` by `enqueueBooking`, so they sync like normal bookings — see §13).

## 7. Authentication & Authorization

[code] "Authentication" is a client-side 4-digit PIN lookup; there is **no Firebase Auth sign-in** (`getAuth` is created but never used).
- Online: query `users` then `monteurs` by PIN directly from the client. Offline/fallback: `ttapp_known_monteurs` cache or the hard-coded `SEED_MONTEURS` list in `authService.js` (contains names and PINs — do not copy them elsewhere). Note: `ttapp_known_monteurs` is only read, never written anywhere in the app [code], so the offline fallback is effectively the seed list.
- Lockout: 3 wrong PINs → 30 min lock, stored in AsyncStorage (bypassable by clearing app data).
- Project access: Strictly governed by project settings (`projects/{projectId}.assignedMonteurIds`, managed in `ProjectSettingsView` in ToolTime admin-web) matching `monteur.id`, name slug, or name; plus `monteur.assignedProjectIds`/`projectIds`; admins have access to all projects. Users with no assigned projects see an empty state in `ProjectSelectScreen` and cannot access unauthorized projects.
- Authorization is enforced only by Firestore/Storage rules in `ToolTime/backend/*.rules` (outside this repo). The local copies are fully open (`allow read, write: if true`) [config of sibling repo]. Whether the deployed rules are identical: Unknown / needs confirmation.

## 8. External Integrations

- Firebase Firestore and Storage (see §6) [code].
- Expo EAS Update (OTA) via `expo-updates` [code/config].
- Device: camera/gallery (`expo-image-picker`), file system, NetInfo.
- Admin web app (`/home/oem/Programming/ToolTime/admin-web`, Vite app with Firebase App Hosting config; separate repo/branch `main`, own version in `src/version.ts`) shares the Firestore data. Its internals were not inspected beyond listing and the rules files.
- No other third-party APIs found.

## 9. Development Setup

[config] `npm install`, then `npm start` (Expo dev server; use Expo Go/dev client, `npm run android|ios|web`). Node version, EAS CLI login and device/emulator requirements: Unknown / needs confirmation. No env vars are needed; the Firebase config is committed. Real Firestore data is used from any dev run (there is no emulator/staging config) — be careful with writes. `git remote` uses SSH.

## 10. Build / Test / Validation

- Only scripts: `start`, `android`, `ios`, `web` [config].
- No tests, ESLint, Prettier, TypeScript or CI [verified by file listing].
- Suggested smoke checks (not run during the takeover): `npx expo-doctor`, `npx expo export --platform web`.
- Release/OTA publish procedure (`eas update`, channel/branch names): Unknown / needs confirmation.

## 11. Deployment

App distributed through Expo/EAS (project owner `vibe-factory-gmbh`), updates checked on every production start (`Updates.checkForUpdateAsync` then `reloadAsync`) [code]. `runtimeVersion` policy `appVersion` with `app.json` version `1.0.0` means OTA updates target all builds with runtime `1.0.0` [config]. Store builds / EAS build config: Unknown / needs confirmation. Admin web is hosted via Firebase (`ToolTime/firebase.json`: App Hosting rootDir `admin-web`, Hosting `admin-web/dist`) [config of sibling repo].

## 12. Important Design Decisions

- Offline-first with outbox + delta sync; sync is idempotent-ish via deterministic IDs and `setDoc(..., {merge:true})`.
- Per-project local caches (commit `56cd02a`); outbox stays global but is filtered per project at sync time (items without `projectId` are treated as belonging to any project).
- Rooms are pushed even while in progress (percentage/draft quantities/photos) so admin sees progress; completed rooms become read-only locally (lock). Remote can unlock a room by setting `isCompleted:false` or `status:'in_progress'` (see `mapRemoteRoom`).
- Percentage = installed(+draft) / planned over `plannedItems` (capped per item), fallbacks to `room.materials`, then project materials with `assignedRoomNames` (`computeRoomPercentage`).
- Stock rule: a Monteur cannot book more than delivered/available; over-consumption goes through an alert flow that enqueues a reorder alert. Planned = 0 for unplanned items (v2.11).
- Fallback for photos never writes `file://` paths to Firestore; data-URI fallback is a deliberate last resort.
- Terminology: "Nachtrag" was renamed "Mehrbedarf" in UI (v2.4) but code/Firestore still use `addendum(s)`/`nachtrag`.
- Do not change the AGENTS.md versioning/branching rules.

## 13. Known Issues / Technical Debt

Confirmed from code:
1. **Security**: no Firebase Auth; PIN lookup by client query; seed PINs hard-coded in `authService.js`; local rules in sibling repo are `if true`. PIN is stored in plaintext in AsyncStorage (`ttapp_active_monteur`) and Firestore `monteurs/<id>` subdoc via `syncMonteurToFirebase` (it spreads the whole monteur object including `pin`).
2. **Dead/broken code**: `SetupProfileScreen.jsx` imports `setupMonteurProfile`, which does not exist in `authService.js`; the screen is imported in `App.js` but never rendered. `handleFinishBooking` in `App.js` is defined but never referenced elsewhere in `App.js`. Unused imports: `getPendingBookings` (`App.js`, `syncService.js`), `uploadBytes` (`syncService.js`). `auth` from `firebase.js` is never used.
3. **Unclear items status lost**: `App.js` passes `status: 'pending_assignment'` to `enqueueBooking`, but `enqueueBooking` always overwrites it with `'pending'`, so the intended status never reaches Firestore (items still sync, flagged only by `isUnclear: true`). The `UNCLEAR` outbox key is unused.
4. **Circular import**: `authService.js` ↔ `syncService.js` (`checkOnlineStatus` / `getActiveMonteur`).
5. **Hard-coded defaults**: `DEFAULT_PROJECT_ID = 'hallenbad-weingarten'` and `calendarWeek` fallback `27` are used as fallbacks in many places; seed rooms/materials for that project are shipped in `initialData.js` and used when no cache exists.
6. `enqueueBooking`'s optimistic `updateLocalMaterialInstalledQty` uses `getMaterials()` without projectId (resolves to the monteur's active project) and may double-count with the later local `installedQty` update in `handleCompleteRoom` — **suspected**, not verified.
7. `needsFullPositionsFetch` triggers a full positions fetch whenever any position has `deliveredQty` 0/undefined, i.e. every sync in such projects (performance), and pulled positions overwrite `installedQty` handling in subtle ways (suspected).
8. Hard-coded German strings remain (e.g. `App.js` sync overlay text, alerts).
9. `app.json`/`package.json` version `1.0.0` is not in sync with `APP_VERSION`; `runtimeVersion` tied to it.
10. Large files: `App.js` (~1000 lines of mixed state/business logic), `BookingScreen.jsx` (~670), `syncService.js` (~590).
11. `expo-image-picker` uses `MediaTypeOptions` (check against SDK 57 docs; deprecated in newer SDKs — suspected).
12. Possible mismatch between app writes and local Firestore rules: rules only match `projects/{id}`, `positions`, `rooms`, `bookings`, `addendums`, `users`; no explicit match for `projects/*/bookings`, `projects/*/addendums`, `projects/*/monteurs`, or root `monteurs`, which would be denied if those rules are deployed as-is (**suspected**; deployed rules unknown).

Suspected / unverified: see "suspected" markers above.

## 14. Current Work / Open Tasks

- Working tree was clean at takeover (branch `Monteur`, HEAD `2014ddb`); no uncommitted/in-progress work found. No TODO/FIXME comments exist in app code [verified by grep].
- No documented backlog. Open tasks: Unknown / needs confirmation (ask the owner). Do not invent requirements.

## 15. Recent Relevant Changes

[git] Latest first:
- 2026-10-08 v2.19: Unterschriftenfeld bei Nachträgen und außerplanmäßigem Material entfernt:
  - `NachtragModal.jsx`: `SignaturePad` und Signaturvalidierung für Material- und Arbeitszeit-Nachträge entfernt.
  - `UnplannedInstallModal.jsx`: `SignaturePad` und Signaturvalidierung für außerplanmäßig verbautes Material entfernt.
  - Begründung: Der Monteur ist bereits über seine PIN/Benutzer-ID sicher authentifiziert; das manuelle Unterschreiben per Touchscreen bot keinen Mehrwert und verlangsamte den Buchungsablauf. Der Name des Monteurs bleibt in den Datensätzen unverändert hinterlegt (`requestedBy` / `signerName`).
- 2026-10-08 v2.18: "Plan ansehen"-Button & Modaleinbindung aus Monteur-App entfernt:
  - `BookingScreen.jsx`: "📐 Plan ansehen"-Button im Kopfbereich und `PlanViewerModal`-Einbindung entfernt.
  - `RoomListScreen.jsx`: Geschoss-Banner ("Montageplan {floor} öffnen"), Geschoss-Gruppen-Button ("📐 Plan {fl}") und `PlanViewerModal`-Einbindung entfernt.
  - Styles bereinigt (`bookingStyles.js`, `RoomListScreen.jsx`).
  - Hintergrund: Die CAD-Vektor-Ansicht auf mobilen Geräten bot für Monteure vor Ort keinen praktischen Mehrwert. Der Code von `PlanViewerModal.jsx` bleibt für spätere Anwendungsfälle erhalten.
- 2026-10-07 v2.17: Strikte Umsetzung der Zugriffsrechte aus den Projekteinstellungen:
  - Projektzuordnung (`authService.js`): Funktion `isUserAssignedToProject(monteur, project)` prüft `project.assignedMonteurIds` (aus den Admin-Web-Projekteinstellungen) auf Monteur-ID, Namens-Slug und Name.
  - Fallback-Entfernung: Der fehlerhafte Fallback, der bei leeren oder nicht gematchten IDs alle Projekte anzeigte, wurde vollständig entfernt. Monteure sehen exakt nur ihre zugewiesenen Projekte.
  - Automatisches Routing (`App.js`): Bei 1 Projekt direktes Öffnen des Bauvorhabens ohne Switcher; bei >1 Projekten Auswahlliste; bei 0 Projekten sauberer Empty-State mit Abmelde-Option.
  - UX-Verbesserungen: Sperr-/Abmelde-Button (`🔒`) in Header und `ProjectSelectScreen` zur bequemen Rückkehr zur PIN-Eingabe.
  - Internationalisierung: Neue Übersetzungsschlüssel für leeren Projektstatus und Abmelden (`de`, `ro`, `pl`, `hr`).
- 2026-10-07 v2.16: Unterzeichner im Außerplanmäßig-Modal & Bereinigung von GAEB-Folgepositionspräfixen:
  - "Außerplanmäßig verbaut" Modal (`UnplannedInstallModal.jsx`): Pflichtfeld für "Name des Unterzeichnenden" (`unclearSigner`) hinzugefügt (analog zu `NachtragModal.jsx`), vorausgefüllt mit dem Monteurnamen, validiert bei Absenden, Übergabe als `requestedBy` und `signerName`.
  - Bereinigung von Folgepositionen ("wie Pos. [01.1] , jedoch..."):
    - Im Admin-Web (`ToolTime/admin-web/src/services/gaebParser.ts`): Funktion `cleanShortText()` filtert das Standard-GAEB-Präfix `/^wie\s+(?:vor)?pos(?:ition)?\.?\s*(?:\[[^\]]+\]|\d+(?:\.\d+)*)\s*,?\s*jedoch\s+/i` beim Import heraus.
    - In der Monteur-App (`TTApp/src/components/booking/bookingHelpers.js` & `BookingScreen.jsx`): Funktion `cleanMaterialName()` säubert das Präfix zur Laufzeit in Materialkarten, Dropdowns und Modals für bereits existierende Daten und Cache.
- 2026-10-07 v2.15: Dynamischer CAD-Vektorplan (DWG/DXF -> JSON) & Raum-Highlighting:
  - Admin-Web (`ToolTime`): Parser (`dwgParser.ts`) erzeugt nun beim Upload von DWG/DXF-Plänen strukturierte Vektordaten (`vectorData`: Wände, Rohrtrassen für Kaltwasser/Warmwasser/Abwasser/Heizung, Raumgrenzen, Geräte und Beschriftungen).
  - Monteur-App (`TTApp`): `PlanViewerModal.jsx` rendert `plan.vectorData` dynamisch via SVG mit stufenlosem Pinch-to-Zoom (1x–6x) und Pan.
  - Intelligente Raum-Hervorhebung: Der Raum, aus dem der Monteur den Plan aufgerufen hat, wird im Plan mit Akzentfarbe (`#38BDF8`), Kontur und `★ Aktiver Raum`-Badge markiert.
  - Fallback: Bleibt erhalten, falls ein Plan keine Vektordaten besitzt.
- 2026-10-07 v2.14: i18n & Glossar-Korrekturen:
  - Übersetzung von Materialgruppen (`translateGroup` in `i18n.js` und Nutzung in `MaterialBookingCard.jsx`), inklusive "Verteiler & Armaturen", "Sanitär", "Trinkwasser", "Abwasser", "Dämmung", "Befestigung", "Heizung", "Lüftung" für RO, PL, HR.
  - Behebung fehlerhafter Glossar-Tags (`getForeignGloss` in `bookingHelpers.js`): Intelligente Stichwort-Erkennung (Armatur, Kugelhahn, Ventil, Verteiler, Bogen, Sanitär etc.) und Beseitigung des falschen Fallbacks zu `Țeavă` (Rohr).
  - Lokalisierung des Geschoss-Präfixes im Header-Untertitel (`floorPrefix` in `BookingScreen.jsx`: z.B. "Etaj EG", "Piętro EG").
- 2026-10-07 v2.13: Blocker-Fixes, Geschoss-Filterung & Mobiler Plan-Viewer:
  - Entfernung der harten Blockade `if (delivered <= planned)` in `BookingScreen.jsx` – Mehrverbrauchsbuchung ist nun immer möglich, sobald der Monteur `OverConsumptionModal.jsx` ausfüllt.
  - Alarmierung mit `type: 'over_consumption_alert'` wird zuverlässig erstellt und nun zusätzlich in `projects/{projectId}/alerts` repliziert, sodass das Admin-Banner sofort aktualisiert wird.
  - Geschoss-Filterleiste mit Pills `[Alle, UG, EG, OG, DG, Strangschema]` in `RoomListScreen.jsx`, Gruppierung der Raumkarten nach Geschoss und Anzeige der Raumzahlen.
  - Neuer interaktiver CAD Plan-Viewer (`PlanViewerModal.jsx`) mit stufenlosem Pinch-to-Zoom (1.0x bis 6.0x), freiem Pan/Verschieben, CAD-Vektoren, Rohr-Trassen (Kaltwasser, Warmwasser, Abwasser DN 100/50/25) und externem PDF-Öffnen.
  - Direkter Absprung "Plan ansehen" im Raum (`BookingScreen.jsx`) und in der Raumliste (`RoomListScreen.jsx`).
  - Offline-Synchronisation von Plan-Metadaten (`projects/{projectId}/plans`) und automatische lokale Speicherung der Plan-PDFs via `expo-file-system` (`PLANS_DIR`).
  - Vollständige Mehrsprachigkeit (DE, RO, PL, HR) für alle neuen Filter- und Plan-Elemente.
- 2026-10-07 v2.12: Vollständige Internationalisierung (i18n) aller UI-Inhalte, Buttons, Dialoge, Overlays, Einheiten und Raumnamen über alle 4 Sprachen (de, ro, pl, hr).
- 2026-09-30 `2014ddb` v2.11: compact header, lock completed rooms, full i18n & units, stock validation, planned=0 for unplanned items, robust Firebase Storage photo upload.
- 2026-09-23 v2.10 sync crash fix (`photosToUpload`); v2.9 BookingScreen split into modular components; v2.8 unplanned availability fix; v2.6 room view/header redesign, material dropdown, unplanned modal; v2.5 in-progress room percentages, cloud photo upload on sync, completion lock, multi-monteur sync.
- 2026-09-22 v1.3–v2.4: per-project scoping, planned materials per room, stock limit check, photo flow, persistent drafts, "Mehrbedarf" rename, immediate auto-sync.
- 2026-09-21/22: bidirectional sync uses the correct project; photo compression; real Firestore projects instead of placeholders.

## 16. Important Files

| Task | Files |
|---|---|
| App flow / state / handlers | `App.js` |
| Plan Viewer Modal | `src/components/PlanViewerModal.jsx` |
| Sync (Firestore/Storage/Plans) | `src/services/syncService.js` |
| Local storage / outbox / % calc / Plans cache | `src/services/storageService.js` |
| Login / PIN / seeds | `src/services/authService.js`, `src/screens/PinLockScreen.jsx` |
| Booking UI | `src/screens/BookingScreen.jsx`, `src/components/booking/*` |
| Room List & Floor Filter | `src/screens/RoomListScreen.jsx` |
| Photos | `src/screens/PhotoCaptureScreen.jsx` |
| Text/translation | `src/locales/i18n.js` |
| Version/theme | `src/constants/version.js`, `src/constants/theme.js` |
| Expo/EAS config | `app.json` |
| Firestore/Storage rules + admin web (other repo) | `/home/oem/Programming/ToolTime/backend/*.rules`, `/home/oem/Programming/ToolTime/admin-web` |

## 17. Agent Continuation Notes

- Follow `AGENTS.md` (read-first rule, bump `APP_VERSION` on every app change, branch `Monteur` only).
- Read the Expo SDK 57 docs before touching Expo APIs.
- Changes to Firestore field/collection names must be coordinated with the admin web app (other repo); inspect its code first.
- Always pass `projectId` explicitly to storage/sync functions.
- Handlers in `App.js` repeat the "check online → silent sync → refreshData" pattern; follow it or extract carefully without behavior change.
- Test offline and online paths mentally; there are no tests.
- Never log/copy PINs or secrets.
- `dist/` and `.expo/` are generated; ignore them.

## 18. Last Updated

2026-10-08 — v2.19 Update: Unterschriftenfeld bei Nachträgen und außerplanmäßig verbautem Material entfernt (`NachtragModal.jsx`, `UnplannedInstallModal.jsx`). Monteur-Identität bleibt durch Login-ID / Name verlässlich gewahrt.

