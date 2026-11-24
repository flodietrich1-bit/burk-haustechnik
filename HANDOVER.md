# Project Handover

Evidence labels used below: **[code]** confirmed from code, **[config]** confirmed from configuration, **[git]** from Git history, **[inferred]** inferred but not verified, **Unknown / needs confirmation**.

## 1. Project Overview

TTApp is a React Native (Expo) mobile app for installers ("Monteure") of Burk Haustechnik (plumbing/heating contractor) [code: names, data]. A Monteur unlocks the app with a 4-digit PIN, picks a construction project, picks a room, and records installed material quantities per room (against planned quantities from the bill of quantities), takes proof photos, files "Mehrbedarf" (additional demand) requests and unplanned-material records, and completes rooms. Everything works offline and is synced to Firebase (Firestore/Storage), where a separate admin web app (`/home/oem/Programming/ToolTime`, different repo) manages projects, positions, rooms and users [code: Firestore paths; admin app content only partially inspected].

UI languages: German (base), Romanian, Polish, Croatian [code: `i18n.js`].

## 2. Current Status

- App version `v2.63` (`src/constants/version.js`) [code]. iOS native `buildNumber: "7"` in `app.json` [config].
- Implemented [code]: Mehrsprachigkeit & Übersetzung für LV-Modus vervollständigt:
  - Dynamische Übersetzung der Gewerke-Chipfilter (`translateGroup(tradeName, currentLang)`).
  - Dynamische Übersetzung der Gewerke-Badges und Titel-Glosse auf Positionskarten (`getForeignGloss`, `position.translations?.[currentLang]`).
  - Übersetzung des Unplanned-Material-Badges (`t('lvUnplannedBadge', currentLang)`).
  - Erweiterung des Sanitär-/Heizung-Glossars (`GLOSSARY`) und der Gewerke-Erkennung in `translateGroup` (Frischwasserstation, Trink-/Warmwasser, Schmutz-/Regenwasser, Brandschutz, Elektro etc.).
- Duale Projekt-Architektur (`measurementMode: 'ROOM_BASED' | 'LV_BASED'`):
  - Gewerke-Filterung über handliche horizontale Chipkacheln.
  - Direkte Auflistung aller Positionen laut LV (inkl. `sourceType === 'CUSTOM_ADDED'` bzw. Zusatzpositionen).
  - Globale Echtzeit-Suchleiste nach `displayCode`, `aliasTitle` und `officialTitle`.
  - Feste Aktionsleiste **„Zum Aufmaß vorbereiten (X Positionen) ›“** und Screen **„Aufmaß vorbereiten“** mit Baustellen-Fotodokumentation, Freitext-Nachtrag und verbindlicher Einreichung in `measurement_sections`.
- Intelligente Fallback-Erkennung (`src/utils/projectMode.js`): Projekte ohne DWG/CAD-Pläne und ohne Räume, aber mit LV-Positionen werden automatisch als `LV_BASED` erkannt.
- Weiterhin voll integriert: PIN/Passwort-Login, Multi-Projekt-Auswahl mit LV-Modus-Badge, Offline-Cache, automatischer EAS-Update-Check beim Start.

- Maturity: working prototype in active iteration (≈ 11 app releases v1.2→v2.11 in 10 days, 2026-09-21 → 2026-09-30) [git]. No automated tests, linting or type checking. Not production-hardened security-wise (see §7, §13).
- Whether the app is deployed to real users / which EAS channel is used: Unknown / needs confirmation.

## 3. Technology Stack

- Expo SDK `^58.0.0`, React Native `0.88.1`, React `19.3.0`; JavaScript only (no TypeScript) [config: `package.json`].
- Libraries: `firebase ^12.19` (Firestore, Storage, Auth custom-token session), `@react-native-async-storage/async-storage`, `@react-native-community/netinfo`, `expo-file-system`, `expo-image-manipulator`, `expo-image-picker`, `expo-updates`, `expo-status-bar`, `react-native-svg` (ProgressRing) [config/code].
- Package manager: npm (`package-lock.json`) [config].
- Backend: Firebase project `burk-haustechnik` (Firestore + Storage); config object hard-coded in `src/services/firebase.js` [code].
- Hosting/distribution: Expo/EAS (`owner: vibe-factory-gmbh`, updates URL `https://u.expo.dev/<projectId>`, `runtimeVersion.policy: appVersion`) [config]. `eas.json` mit Profilen für internal (development, preview) und production (autoIncrement, auto-submit) konfiguriert.
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
src/components/booking/     BookingScreen sub-components (MaterialBookingCard, NachtragModal, UnplannedInstallModal, CompleteRoomModal), their *Styles.js, bookingHelpers.js
assets/                     icons/splash
dist/, .expo/               Generated, gitignored
AGENTS.md / CLAUDE.md       Agent rules (CLAUDE.md just contains `@AGENTS.md`)
.claude/settings.json       Enables an Expo Claude plugin
```
No README, no tests, no CI config, no `.env` files in the repo.

## 5. Architecture

[code] Single-activity, state-driven app. `App.js` holds all state and handlers and passes props down.

- `appPhase`: `loading` → `activation` (no saved session) or `project_select`/`app` (saved session). The legacy `pin` phase remains in code but is not used by the current activation flow. Within `app`, `currentScreen`: `rooms` → `book` → `photos` → (`book`) / `done` → `rooms`. There is no navigation library.
- Startup (`initApp`): restores the locally saved tenant/monteur session, loads assigned projects, then opens project selection or the sole assigned project. A failed data load after activation falls back to project selection without deleting activation. It checks for an EAS update in production builds.
- Login: `ActivationScreen` → `activateDeviceWithInvite` (backend invite redemption and Firebase custom-token sign-in) → project select or direct entry. `PinLockScreen`/`authenticateByPin` remain as legacy code.
- Booking flow: selecting a room restores room drafts (`draftQuantities`, `photos`, `draftUnclear`). The booking screen derives its topmost unplanned material cards from `draftUnclear`/room materials as well as the active list, so a catalog refresh cannot hide them. Quantity steppers in `BookingScreen` change `sessionQuantities`; leaving the room (`handleLeaveRoomDraft`) or saving photos persists drafts into the room object, recomputes `pct` (`computeRoomPercentage`) and triggers a silent sync if online. "Complete room" (`handleCompleteRoom`) enqueues one booking per material delta (plus photo-doc booking if no deltas, unclear-item bookings with `status: 'pending_assignment'`, and a `room_completion` booking), updates local `installedQty`, marks the room `isCompleted`/100 %, and syncs.
- Extra flows: `handleAddNachtrag` (Mehrbedarf → `enqueueAddendum`), `handleAddUnclearItem` (unplanned installed material → adds to local catalog + room + addendum of type `ausserplanmaessig`), `handleOverConsumptionAlert` (enqueue booking with `type: 'over_consumption_alert'`).
- Offline-first: all of the above write to AsyncStorage first. `getLocalUnsyncedDelta(projectId)` finds pending bookings/addendums (`status === 'pending'`) and rooms with unsynced changes. `syncBookings` pushes those, then pulls positions and rooms changed since `lastSyncedAt` (per project), then stores a new `lastSyncedAt`. A NetInfo listener triggers silent sync on reconnect. Reopening a formerly completed room with zero photos writes an explicit unlocked status and cleared completion metadata locally, then pushes that state through the room delta sync.
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

**Local (AsyncStorage keys)** [code]: `ttapp_selected_language`, `ttapp_cached_rooms_<pid>`, `ttapp_cached_materials_<pid>`, `ttapp_cached_project_<pid>`, `ttapp_last_synced_at_<pid>`, `ttapp_outbox_bookings`, `ttapp_outbox_addendums` (both global, not per project), `ttapp_active_monteur`, `@ttapp:branding:<tenantId>`, `ttapp_known_monteurs`, `ttapp_all_projects`, `ttapp_pin_failed_attempts`, `ttapp_pin_locked_until`, legacy unscoped `ttapp_cached_rooms/materials/project` (written only for `hallenbad-weingarten`). `UNCLEAR` and `USER_PROFILE` keys are declared but unused.

**Booking types** (all in the one `bookings` outbox): normal material booking, `photo_doc` (`itemOz: 'DOKU'`), `room_completion`, `over_consumption_alert`, and unclear items (`isUnclear: true`; the passed `status: 'pending_assignment'` is overwritten with `'pending'` by `enqueueBooking`, so they sync like normal bookings — see §13).

## 7. Authentication & Authorization

[code] Current device activation redeems a one-time invite with the backend, signs in with a Firebase custom token, and stores tenant/monteur locally. `restoreSession` uses those local records on reload. `logoutDevice` remains in the auth service but has no UI entry point since v2.44; invoking it would sign out and remove local activation, and an installation ID alone cannot restore a signed-out session. The older client-side PIN flow remains as legacy code.
- Online: query `users` then `monteurs` by PIN directly from the client. Offline/fallback: `ttapp_known_monteurs` cache or the hard-coded `SEED_MONTEURS` list in `authService.js` (contains names and PINs — do not copy them elsewhere). Note: `ttapp_known_monteurs` is only read, never written anywhere in the app [code], so the offline fallback is effectively the seed list.
- Lockout: 3 wrong PINs → 30 min lock, stored in AsyncStorage (bypassable by clearing app data).
- Project access: Strictly governed by project settings (`projects/{projectId}.assignedMonteurIds`, managed in `ProjectSettingsView` in ToolTime admin-web) matching `monteur.id`, name slug, or name; plus `monteur.assignedProjectIds`/`projectIds`; admins have access to all projects. Users with no assigned projects see an empty state in `ProjectSelectScreen` and cannot access unauthorized projects.
- Authorization is enforced only by Firestore/Storage rules in `ToolTime/backend/*.rules` (outside this repo). The local copies are fully open (`allow read, write: if true`) [config of sibling repo]. Whether the deployed rules are identical: Unknown / needs confirmation.

## 8. External Integrations

- Firebase Firestore and Storage (see §6) [code].
- Expo EAS Update (OTA) via `expo-updates` [code/config].
- Public tenant branding endpoint (`/api/public/branding/{tenantId}`) supplies logo, name and colors to the app header; the response is cached in AsyncStorage for offline use [code].
- Device: camera/gallery (`expo-image-picker`), file system, NetInfo.
- Admin web app (`/home/oem/Programming/ToolTime/admin-web`, Vite app with Firebase App Hosting config; separate repo/branch `main`, own version in `src/version.ts`) shares the Firestore data. Its internals were not inspected beyond listing and the rules files.
- No other third-party APIs found.

## 9. Development Setup

[config] `npm install`, then `npm start` (Expo dev server; use Expo Go/dev client, `npm run android|ios|web`). Node version, EAS CLI login and device/emulator requirements: Unknown / needs confirmation. No env vars are needed; the Firebase config is committed. Real Firestore data is used from any dev run (there is no emulator/staging config) — be careful with writes. `git remote` uses SSH.

## 10. Build / Test / Validation

- Only scripts: `start`, `android`, `ios`, `web` [config].
- No tests, ESLint, Prettier, TypeScript or CI [verified by file listing].
- Current smoke checks: `npx expo-doctor` 20/20, `npx expo export --platform ios` and `git diff --check` passed on 2026-11-14 for v2.45. Metro was restarted with `npm start -- --host lan` on port 8081 (`exp://172.20.10.2:8081`); no device was attached. Web export is unavailable because `web` is not configured in `app.json` platforms.
- Release/OTA publish procedure: `AGENTS.md` requires `npx eas-cli update --branch preview --environment preview --message "<APP_VERSION> - <Beschreibung>" --non-interactive` whenever `Monteur` is pushed. Expo Go development reloads use Metro rather than EAS Update.

## 11. Deployment

App distributed through Expo/EAS (project owner `vibe-factory-gmbh`), updates checked on every production start (`Updates.checkForUpdateAsync` then `reloadAsync`) [code]. `runtimeVersion` policy `appVersion` with `app.json` version `1.0.0` means OTA updates target all builds with runtime `1.0.0` [config]. Store builds / EAS build config: Unknown / needs confirmation. Admin web is hosted via Firebase (`ToolTime/firebase.json`: App Hosting rootDir `admin-web`, Hosting `admin-web/dist`) [config of sibling repo].

## 12. Important Design Decisions

- Offline-first with outbox + delta sync; sync is idempotent-ish via deterministic IDs and `setDoc(..., {merge:true})`.
- Per-project local caches (commit `56cd02a`); outbox stays global but is filtered per project at sync time (items without `projectId` are treated as belonging to any project).
- Rooms are pushed even while in progress (percentage/draft quantities/photos) so admin sees progress. Only explicit `isCompleted`/`status` marks a room complete; a calculated 100% alone does not lock it. Completion requires a locally saved photo and confirmation, then locks the room. A previously completed room with zero photos can be reopened in the app; its unlocked status and cleared completion fields are synced. Remote can also unlock a room by setting `isCompleted:false` or `status:'in_progress'` (see `mapRemoteRoom`).
- Percentage = installed(+draft) / planned over `plannedItems` (capped per item), fallbacks to `room.materials`, then project materials with `assignedRoomNames` (`computeRoomPercentage`). The underlying percentage can exceed 100 for over-consumption; the room-list ring and its number display at most 100 and stay green at/above 100. Only an explicit completion status shows the right-aligned “100% fertig” badge.
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

Suspected / unverified: see "suspected" markers above. The prior unplanned-reason validation discrepancy is fixed in v2.43; device behavior remains unverified. Full-screen room completion modal, room-list/header layout including v2.44 status/sync icon and v2.45 KPI-card removal, and v2.42 unplanned-card ordering in Expo Go on a real device: Unknown / needs confirmation.

## 14. Current Work / Open Tasks

- v2.45 removes the “Wöchentliches Aufmaß” KPI card from the room overview. Device layout still needs confirmation in Expo Go.
- No documented backlog. Open tasks: Unknown / needs confirmation (ask the owner). Do not invent requirements.

## 15. Recent Relevant Changes

[git] Latest first:
- 2026-11-16 v2.53: Vergrößerte Touchflächen für Plus/Minus-Buttons (`46x48px` Touchfläche, `hitSlop`), fester stabiler Breiten-Container für den Stepper-Pill (`width: 172px`, verhindert Größenänderungen/Zittern beim Slider-Ziehen), Antippen der Zahl zur genauen Tastatur-Eingabe nun auch bei Stückzahlen (Komma-Taste bei Stückzahlen deaktiviert). App-Anzeigeversion v2.53.
- 2026-11-16 v2.52: Redesign der Materialkarte in der Raumansicht: Entfernen der mittleren Spalte („VERFÜGBAR“), Sublabels („Raum“, „In Raum“) und Trennlinien. Klares 2-Spalten-Layout mit GEPLANT (links) und integriertem Stepper-Pill `[ − | VERBAUT +X m | + ]` (rechts). Durchgehender dezent grüner Balken („Noch übrig: {geplant - verbaut} m“) als unterer Abschluss der Mengen-Box. Mehr Abstand nach oben zum Fortschrittsbalken und reduziertes unteres Padding der Kachel. Stepper-Rundungslogik auf die nächste volle Ganzzahl (z. B. 15,7 -> `+` -> 16,0; 15,7 -> `−` -> 15,0). App-Anzeigeversion v2.52.
- 2026-11-16 v2.51: Drei Mengeneingabe-Möglichkeiten auf Raum-Materialkarten: (1) ziehbarer Verbaut-Slider bis max. 100%, (2) Plus/Minus-Stepper immer in Ganzzahl-Schritten (über 100% nur via `+`), (3) direktes Antippen der Zahl für exakte Taschenrechner-Eingabe (0-9 und Komma bis 2 Dezimalstellen) bei Meter-Einheiten. App-Anzeigeversion v2.51.
- 2026-11-16 v2.50: Kamera-Scanner-Fix (natives Apple VisionKit `CameraView.launchScanner` / `DataScannerViewController` als Primärscanner, Bereinigung von `CameraView`). App-Anzeigeversion v2.50.
- 2026-11-16 v2.49: Zurück-Icon & Label `backShort` („Zurück“) im manuellen Aktivierungs-Screen. App-Anzeigeversion v2.49.
- 2026-11-16 v2.48: Redesign des Aktivierungs-Screens: Burk-Firmenlogo / P12-Aufmaß-Vektorlogo, 2 klare Buttons („Einladung scannen (QR-Code)“ / „Code manuell eingeben“), dedizierter manueller Modus im Vollbild. App-Anzeigeversion v2.48.
- 2026-11-16 v2.47: Klarer Leerzustand bei nicht zugeordneten Projekten („Dir wurde noch kein Projekt zugeordnet. Bitte melde dich gegebenenfalls bei deinem zuständigen Projektleiter.“) ohne irreführende Projektauswahl-Überschrift, inkl. Pull-to-Refresh und Neuladen-Button. App-Anzeigeversion v2.47.
- 2026-11-16 v2.46: Saubere User- und Google-Auth-Löschung, Signalerkennung gelöschter User in TTApp, Abmelde-Icon im Header mit Passwort-Sperre/LoginScreen und Bereinigung gelöschter Projekte. App-Anzeigeversion v2.46.
- 2026-11-14 v2.45: Kachel „Wöchentliches Aufmaß“ aus `RoomListScreen` entfernt; floor filters und room cards starten direkt. App-Anzeigeversion v2.45.
- 2026-11-14 v2.44: Tappbares Netzwerk-Symbol oben rechts als manueller Sync-Auslöser; rotierendes Sync-Symbol während Sync; Raum-Zurücknavigation im Header. App-Anzeigeversion v2.44.
- 2026-11-13 v2.43: Pflichtbegründung beim Erfassen außerplanmäßig verbauten Materials in `handleSave`. App-Anzeigeversion v2.43.
- 2026-11-13 v2.42: Sichtbare Kacheln beziehen die neuesten außerplanmäßigen IDs zuerst aus `unclearItems` und Raum-Materialien. App-Anzeigeversion v2.42.

## 16. Important Files

| Task | Files |
|---|---|
| App flow / state / handlers / sync activity indicator | `App.js` |
| Plan Viewer Modal | `src/components/PlanViewerModal.jsx` |
| Sync (Firestore/Storage/Plans) | `src/services/syncService.js` |
| Local storage / outbox / % calc / Plans cache | `src/services/storageService.js` |
| Login / PIN / seeds | `src/services/authService.js`, `src/screens/PinLockScreen.jsx` |
| Booking UI / unplanned card ordering / completion recovery / full-screen modal | `src/screens/BookingScreen.jsx`, `src/components/booking/CompleteRoomModal.jsx`, `src/components/booking/UnplannedInstallModal.jsx`, `src/components/booking/completeRoomStyles.js`, `src/components/booking/bookingStyles.js` |
| Tenant branding / header / room back link | `src/services/authService.js`, `src/components/Header.jsx` |
| Room List & Floor Filter / capped ring / KPI-card removal | `src/screens/RoomListScreen.jsx`, `src/components/ProgressRing.jsx` |
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

- **2026-11-24 (v2.63)**
  - **Ziel / Anlass:** Vollständige Mehrsprachigkeit (DE, RO, PL, HR) für Gewerke-Chipfilter, Positions-Kategorien, Glosse und Badges im LV-Modus.
  - **Änderungen:**
    - `src/locales/i18n.js`:
      - `translateGroup` massiv ausgebaut (Frischwasserstation, Trink-/Warmwasser, Schmutz-/Regenwasser, Brandschutz, Elektro, Rohre, Dämmung etc.).
      - Neues Badge `lvUnplannedBadge` („Nicht im LV“ / „În afara devizului“ / „Poza kosztorysem“ / „Izvan troškovnika“).
      - Sanitär-/Heizungs-Fachbegriffe im `GLOSSARY` erweitert.
    - `src/components/booking/bookingHelpers.js`: `getForeignGloss` um LV-spezifische Felder (`aliasTitle`, `officialTitle`, `tradeCategory`) und technische Begriffe erweitert.
    - `src/screens/LvOverviewScreen.jsx`: Gewerke-Filter-Pills und Überschrift übersetzen die Gewerke jetzt dynamisch via `translateGroup(tradeName, currentLang)`.
    - `src/components/lv/LvPositionCard.jsx`: Gewerk-Badge (`translateGroup`) und Titel-Glosse/Übersetzungen (`transTitle`, `gloss`) für fremdsprachige Monteure integriert.
    - `src/screens/LvCartScreen.jsx`: `lvUnplannedBadge` und fremdsprachige Glosse für Cart-Items angebunden.
    - `app.json`: iOS `buildNumber` auf `"7"` erhöht.
    - `src/constants/version.js`: Bump auf `v2.63`.
  - **Verifikation:** `EXPO_NO_TELEMETRY=1 npx expo export --platform ios` fehlerfrei gebündelt (826 Module).

- **2026-11-23 (v2.62)**
  - **Ziel / Anlass:** Neugestaltung der LV-Hauptansicht: Handliche Gewerke-Chipkacheln als Filter, direkte Anzeige aller LV-Positionen inkl. hinzugefügter Materialien und Umbenennung von „Warenkorb“ in „Zum Aufmaß vorbereiten“.
  - **Änderungen:**
    - `src/screens/LvOverviewScreen.jsx`:
      - Gewerke-Auswahl als horizontal scrollbare Filter-Pills (`[ Alle (195) ]`, `[ Sanitärinstallation (42) ]`, `[ Frischwasserstation (12) ]`, ...).
      - Direkte Auflistung aller Positionen laut LV (inkl. `sourceType === 'CUSTOM_ADDED'` bzw. manuell hinzugefügter Materialien), filterbar per Chip und Suchfeld.
      - Wort „Warenkorb“ und Warenkorb-Icons (`🛒`) vollständig entfernt.
      - Feste/schwebende Aktionsleiste unten: **`[ 📋 Zum Aufmaß vorbereiten ({count} Positionen) › ]`**.
    - `src/screens/LvCartScreen.jsx`:
      - Umbenannt in **„Aufmaß vorbereiten“**, `t('lvCartTitle')` und Header entsprechend angepasst.
      - Leerer Zustand: „Noch keine Positionen erfasst. Trage Mengen in der Liste ein.“ und Rücksprung-Button „‹ Zurück zur Positionsliste“.
    - `src/locales/i18n.js`: Alle 4 Sprachen aktualisiert (`lvCartTitle`, `lvCartFab`, `lvPrepareMeasurementBtn`, `lvEmptyCart`, `lvItemsInCart`, `lvBackToPositions`).
    - `src/constants/version.js`: Bump auf `v2.62`.
  - **Verifikation:** `EXPO_NO_TELEMETRY=1 npx expo export --platform ios` fehlerfrei gebündelt (826 Module); Git push auf `origin/Monteur` (`f6f42eb`, `cab72df`); EAS Update für `preview` veröffentlicht (`ab2efc9d-a439-4122-9197-562c938dc2d6`); EAS iOS Production Build `6` (Build ID `bed5b9b9-371f-415a-a357-fc1d342f5207`) erfolgreich gebaut und an Apple App Store Connect / TestFlight übermittelt.

- **2026-11-23 (v2.61)**
  - **Ziel / Anlass:** Absicherung der LV-Modus-Erkennung gegen fehlende Flags in Firestore und automatische Umschaltung bei Projekten ohne Räume/DWG.
  - **Änderungen:**
    - `src/utils/projectMode.js`: Intelligente Erkennungsfunktion `isLvProject(project)` erstellt. Projekte ohne DWG/CAD-Pläne (`hasDwg === false`) und ohne Räume (`rooms.length === 0`), aber mit vorhandenen LV-Positionen (`totalPositions > 0`) werden automatisch als `LV_BASED` eingestuft.
    - `App.js`: Alle `measurementMode === 'LV_BASED'`-Abfragen durch `isLvProject()` ersetzt. In `refreshData` schaltet die App bei Eintreffen von Projektdaten automatisch von `rooms` auf `lv_overview` um, falls es ein LV-Projekt ist.
    - `src/screens/ProjectSelectScreen.jsx`: LV-Badge-Anzeige auf `isLvProject(proj)` umgestellt.
    - `Firestore`: Für das neu erstellte Projekt „Sigmaringen“ (`tenants/burk/projects/proj_1795473167634`) wurde das Flag `measurementMode: 'LV_BASED'` in Firestore gesetzt.
    - `src/constants/version.js`: Versions-Bump auf `v2.61`.
  - **Verifikation:** `EXPO_NO_TELEMETRY=1 npx expo export --platform ios` fehlerfrei gebündelt (826 Module); Git commit & push auf `origin/Monteur` (`337f1ca`); EAS Update für `preview` erfolgreich veröffentlicht (`5ebe9f17-e77e-4b71-a20e-adaa0afc8dfa`).

- **2026-11-23 (v2.60)**
  - **Ziel / Anlass:** Implementierung der dualen Projekt-Architektur (LV-basiertes Aufmaß vs. Raum-Aufmaß) anhand des Projekt-Steuerungs-Flags `measurementMode: 'ROOM_BASED' | 'LV_BASED'`.
  - **Änderungen:**
    - `App.js`: Dynamische Weiche beim Öffnen eines Projekts (bei `measurementMode === 'LV_BASED'` wird der Raum-Workflow übersprungen und direkt `lv_overview` geöffnet). Header-Rücknavigation und Subtitel an LV-Modus angepasst. State-Management für Aufmaß-Warenkorb (`lvCart`), Mengenanpassung, Freitext-Nachträge nicht im LV und verbindliche Einreichung.
    - `src/screens/LvOverviewScreen.jsx`: Gewerke-Kacheln mit Positionsanzahl, Erfassungsfortschritt und Warenkorb-Badge; globale Echtzeit-Suchleiste nach `displayCode`, `aliasTitle` und `officialTitle`; permanenter FAB-Warenkorb-Button.
    - `src/screens/LvPositionsScreen.jsx`: Positionsliste des ausgewählten Gewerks, sortiert nach `sortOrder` / `displayCode`, Suchfilter innerhalb des Gewerks, FAB-Button.
    - `src/components/lv/LvPositionCard.jsx`: Positionskarte mit `displayCode`, Gewerk-Tag, prominentem/fettem `aliasTitle` + `officialTitle`, gelbem Infokasten für Montagehinweise (`monteurInfo`), Zusatzposition-Badge (`CUSTOM_ADDED`), schnellem Stepper `[ − | X | + ]` mit Mengenerfassungsmodal und Bisher-Verbucht-Anzeige. Vollständiger Ausschluss/Sicherheit: keine VK-/Abrechnungspreise.
    - `src/components/lv/LvQuantityModal.jsx` & `LvUnplannedModal.jsx`: Modals zur schnellen Direkt-Mengeneingabe und zur Freitext-Erfassung von Material außerhalb des LV.
    - `src/screens/LvCartScreen.jsx`: Aufmaß-Warenkorb-Screen mit Positionsübersicht, Mengenänderung, Löschung, Pflichtfeld-Bezeichnung des Abschnitts (`sectionTitle`), Foto-Dokumentation (Kamera/Galerie) und verbindlicher Einreichung in Firestore `measurement_sections`.
    - `src/screens/ProjectSelectScreen.jsx`: Badge `📋 LV-Aufmaß` auf Projektkarten im LV-Modus.
    - `src/services/storageService.js`: Outbox-Pufferung unter `@ttapp:outbox_sections:${tenantId}:${userId}:${projectId}` (`getOutboxSections`, `enqueueSection`, `removeOutboxSection`), Cart-Draft-Persistenz (`getLvCartDraft`, `saveLvCartDraft`, `clearLvCartDraft`) und Einbindung in `getLocalUnsyncedDelta`.
    - `src/services/syncService.js`: Push-Synchronisation von `measurement_sections` inklusive automatischem Foto-Upload nach Cloud Storage unter `tenants/{tenantId}/projects/{projectId}/proofs/...`; Erweiterung von `mapRemotePos` um `displayCode`, `sortOrder`, `sourceType`, `aliasTitle`, `officialTitle`, `monteurInfo`, `tradeCategory` und strikte Preislöschung (`unitPriceVK` & `unitPrice` gelöscht).
    - `src/locales/i18n.js`: Alle neuen LV-Texte in allen 4 Sprachen (DE, RO, PL, HR) hinzugefügt.
    - `src/constants/version.js`: Versions-Bump auf `v2.60`.
  - **Verifikation:** `EXPO_NO_TELEMETRY=1 npx expo export --platform ios` erfolgreich gebündelt (825 Module); EAS Update für `preview` veröffentlicht (Group `78c28e32-ee38-4b26-a862-d14d3189fa46`); EAS Build (iOS Production, Build `5`) erfolgreich kompiliert und an TestFlight übermittelt (`https://appstoreconnect.apple.com/apps/6836813921/testflight/ios`). `git diff --check` fehlerfrei.

- **2026-11-22 (v2.59)**
  - **Ziel / Anlass:** Behebung der Apple App Store Review Beanstandungen nach Reject für Guideline 3.1.1 (IAP-Verdacht durch Registrierungs-Wording & Links) und Guideline 2.1 (Prüfer-Anmeldung ohne physischen QR-Scan).
  - **Änderungen:**
    - `ActivationScreen.jsx` & `LoginScreen.jsx`: Externe Website-Links (`https://p12-aufmass.de`) und Registrierungs-Hinweise („Firma anmelden / Mehr erfahren“) vollständig entfernt.
    - `i18n.js`: Screen-Titel und Buttons auf neutrales Verbindungs-Wording umgestellt: „Gerät mit Firma verbinden“, „Mit QR-Code verbinden“, „Zugangsdaten manuell eingeben“, Hinweistext: „Scannen Sie den QR-Code aus Ihrer P12-Verwaltungssoftware oder geben Sie Ihre Zugangsdaten manuell ein, um dieses Gerät mit Ihrem bestehenden Firmenkonto zu verknüpfen.“
    - `ActivationScreen.jsx`: Prominenter Button `[ ⌨️ Manuell anmelden ]` direkt unter dem Kamerasucher des QR-Code-Scanners platziert.
    - `ActivationScreen.jsx`: Manuelles 2-Feld-Eingabeformular mit „Firmen-ID / Lizenzschlüssel“ (z. B. `M6-2N94`), „Passwort / PIN“ (mit Sichtbarkeits-Toggle) und Button „Verbinden & Anmelden“ implementiert.
    - `authService.js` / `syncService.js` / `apiService.js`: Joker-/Reviewer-Backdoor (`activateDemoAccount`) implementiert: Bei Eingabe des Reviewer-Codes `M6-2N94` (sowie `DEMO`, `DEMO2026`, `APPLE` oder Backdoor-Passwörtern wie `see_attached_pdf`) wird bei einem Backend-Fehler automatisch eine vollständige lokale Demo-Sitzung mit allen Projekten, Räumen und Materialien aktiviert. Synchronisations-Bypass für `p12-demo` verhindert Firestore-Berechtigungsfehler.
    - `app.json` & `version.js`: iOS `buildNumber` auf `"4"` erhöht, `APP_VERSION` auf `v2.59` gesetzt, `NSCameraUsageDescription` neutralisiert.
  - **Verifikation:** `npx expo export --platform ios` erfolgreich (819 Module gebündelt).


