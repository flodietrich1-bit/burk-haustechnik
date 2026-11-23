# Project Handover

Evidence labels used below: **[code]** confirmed from code, **[config]** confirmed from configuration, **[git]** from Git history, **[inferred]** inferred but not verified, **Unknown / needs confirmation**.

## 1. Project Overview

TTApp is a React Native (Expo) mobile app for installers ("Monteure") of Burk Haustechnik (plumbing/heating contractor) [code: names, data]. A Monteur unlocks the app with a 4-digit PIN, picks a construction project, picks a room, and records installed material quantities per room (against planned quantities from the bill of quantities), takes proof photos, files "Mehrbedarf" (additional demand) requests and unplanned-material records, and completes rooms. Everything works offline and is synced to Firebase (Firestore/Storage), where a separate admin web app (`/home/oem/Programming/ToolTime`, different repo) manages projects, positions, rooms and users [code: Firestore paths; admin app content only partially inspected].

UI languages: German (base), Romanian, Polish, Croatian [code: `i18n.js`].

## 2. Current Status

- App version `v2.60` (`src/constants/version.js`) [code]. iOS native `buildNumber: "5"` in `app.json` [config].
- Implemented [code]: Duale Projekt-Architektur (`measurementMode: 'ROOM_BASED' | 'LV_BASED'`). Im `ROOM_BASED`-Modus bleibt der bewährte Raum-Aufmaß-Workflow erhalten. Im `LV_BASED`-Modus wird der Raum-/Etagen-Workflow komplett übersprungen und der containerbasierte LV-Aufmaß-Workflow geöffnet: Gewerke-Kacheln mit Fortschritt, globale Echtzeit-Suchleiste nach `displayCode`, `aliasTitle` und `officialTitle`, Positionslisten sortiert nach `sortOrder` / `displayCode`, Positionskarten mit fettem `aliasTitle`, farbigem Montagehinweis-Kasten (`monteurInfo`), Zusatzposition-Badge (`CUSTOM_ADDED`), schnellen Mengenzählern (inkl. Direkt-Eingabe-Modal) und striktem Ausschluss aller VK-Preise; permanenter Warenkorb-FAB, Warenkorb-Screen mit Mengenanpassung, Freitext-Nachtrag für Material nicht im LV, Abschnitts-Pflichtbezeichnung, Baustellen-Fotodokumentation und verbindlicher Einreichung in Subcollection `measurement_sections` mit Outbox-Pufferung (`@ttapp:outbox_sections:${tenantId}:${userId}:${projectId}`) und Zwei-Wege-Sync.
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

- **2026-11-20 (v2.58)**
  - **Ziel / Anlass:** Klare Trennung zwischen App-Sperre (Passwort-LoginScreen für aktivierte Monteure ohne Einladungscode-Verlust) und vollständigem Gerät-Trennen.
  - **Änderungen:**
    - `App.js`: `handleLogout` sperrt die App (`lockDevice()`) und leitet auf `LoginScreen` weiter, sodass aktivierte Monteure ihr persönliches Passwort eingeben können und keinen neuen Einladungscode benötigen.
    - `i18n.js`: Dialog im Header auf „App sperren“ („Möchtest du die App sperren? Du kannst dich danach jederzeit mit deinem persönlichen Passwort wieder anmelden.“) geschärft.
    - `src/constants/version.js`: Bump auf `v2.58`.
  - **Verifikation:** `npx expo export --platform ios` erfolgreich (819 Module gebündelt).

- **2026-11-20 (v2.57)**
  - **Ziel / Anlass:** Echtes vollständiges Abmelden bei Klick auf den Logout-Button (`🚪`), vollständiger Reset zur Aktivierung (`ActivationScreen`) und Löschen des Firmenbrandings.
  - **Änderungen:**
    - `App.js`: `handleLogout` ruft nun `logoutDevice()` auf (statt nur `lockDevice()`), leert `monteur`, `project`, `availableProjects` und `tenantBranding` und setzt `appPhase` direkt auf `'activation'`.
    - `src/constants/version.js`: Bump auf `v2.57`.
  - **Verifikation:** `npx expo export --platform ios` erfolgreich (819 Module gebündelt).

- **2026-11-20 (v2.56)**
  - **Ziel / Anlass:** Umsetzung des exakten Website-Links gemäß Screendesign („Du hast noch keinen Zugang? Firma anmelden / Mehr erfahren →“) unter den Login-/Aktivierungs-Boxen.
  - **Änderungen:**
    - `LoginScreen.jsx`: `Linking` und diskreten 2-Zeiler unter der Passwort-Login-Box eingebunden (dezent zentrierter Text + blauer unterstrichener Link zu `https://p12-aufmass.de`).
    - `ActivationScreen.jsx`: Container bereinigt auf das schlichte Design ohne graue Box/Rahmen (gleicher Look wie auf LoginScreen).
    - `i18n.js`: Lokalisierte Keys `noAccessQuestion` und `registerCompanyLink` in allen 4 Sprachen (DE, RO, PL, HR).
    - `src/constants/version.js`: Bump auf `v2.56`.
  - **Verifikation:** `npx expo export --platform ios` erfolgreich (819 Module fehlerfrei gebündelt).

- **2026-11-20 (v2.55)**
  - **Ziel / Anlass:** Integration eines diskreten Website-Links und Anfrage-Hinweises auf dem Aktivierungs-Screen vor dem offiziellen Livegang im Apple App Store & Google Play Store.
  - **Änderungen:**
    - `ActivationScreen.jsx`: `Linking` eingebunden, Button/Container „Noch kein Zugang? Website besuchen & Zugang anfragen ↗“ auf dem primären Auswahl-Screen sowie im manuellen Eingabe-Modus integriert (Ziel: `https://p12-aufmass.de`).
    - `i18n.js`: Lokalisierte Keys `noAccessTitle` und `visitWebsiteBtn` in allen 4 Sprachen (DE, RO, PL, HR) hinterlegt.
    - `src/constants/version.js`: Bump auf `v2.55`.
  - **Verifikation:** `npx expo export --platform ios` erfolgreich (819 Module gebündelt).

- **2026-11-19 (v2.54)**
  - **Ziel / Anlass:** Vorbereitung des ersten iOS TestFlight Releases via EAS Build & App Store Connect.
  - **Änderungen:**
    - `assets/icon.png`: Neues offizielles P12-Aufmaß-Icon als 1024x1024 RGB-PNG (ohne Alpha-Kanal für Apple App Store Konformität) integriert.
    - `app.json`: `bundleIdentifier: "com.vibefactory.ttapp"`, `buildNumber: "1"`, vollständige `NSPhotoLibraryUsageDescription` & erweiterte `NSCameraUsageDescription` (inkl. Baustellen-/Raumfotos) in `infoPlist` eingetragen; Plugins `expo-camera` (`microphonePermission: false`) und `expo-image-picker` sauber konfiguriert.
    - `eas.json`: Neu angelegt mit Build-Profilen (`development`, `preview`, `production` mit `autoIncrement: true`) und `submit`-Konfiguration.
    - `src/constants/version.js`: Bump auf `v2.54`.
  - **Verifikation:** `npx expo export --platform ios` erfolgreich (819 Module gebündelt).

- **2026-11-16 (v2.53)**
  - **Ziel / Anlass:** Große, leicht treffbare Klickflächen für `+` und `−`, stabile feste Breite für die Stepper-Box (kein Wachsen/Schrumpfen beim Slider-Ziehen) und Aktivierung des Tastatur-Modals auch bei Stückzahlen (ohne Komma).
  - **Änderungen:**
    - `materialCardStyles.js`: `installedStepperPill` mit stabiler fester Breite (`width: 172`, `height: 48`) gegen Resizing beim Slider-Ziehen. `stepperInlineBtn` auf `46x48px` vergrößert (`fontSize: 24`). `installedValCenter` als flexibler, vollflächiger Touchbereich.
    - `MaterialBookingCard.jsx`: `canOpenCalculator` für alle Einheiten freigegeben (`isMeter` oder Stück). Bei Stückzahlen öffnet sich der Ziffernblock (`0-9`, `⌫`, `C`), während die Komma-Taste optisch und funktional deaktiviert ist. `hitSlop`-Erweiterung auf Plus, Minus und Zahlenmitte für zuverlässiges Tippen.
    - `src/constants/version.js`: Bump auf `v2.53`.
  - **Verifikation:** `npx expo-doctor` (20/20 Checks bestanden), `npx expo export --platform ios` (819 Module erfolgreich gebündelt), `git diff --check` fehlerfrei.

- **2026-11-16 (v2.52)**
  - **Ziel / Anlass:** Redesign der Positionskarte in der Raumansicht gemäß Wunsch/Screenshot und Anpassung der Stepper-Rundungslogik auf die nächste volle Ganzzahl.
  - **Änderungen:**
    - `MaterialBookingCard.jsx` & `materialCardStyles.js`:
      - Entfernen der mittleren Spalte „VERFÜGBAR (Offen)“, Sublabels („Raum“, „In Raum“) und vertikalen Trennlinie in der grauen Mengen-Box.
      - Zweispaltiger Aufbau: „GEPLANT“ links mit formatierter Menge/Einheit, „VERBAUT“ rechts als integrierte Stepper-Pille `[ − | VERBAUT +X m | + ]` mit weißem Hintergrund, blauem Label und blauer Mengenangabe (Mitte weiterhin antippbar für Taschenrechner-Modal bei Meter-Einheiten).
      - Durchgehender, dezent grün hinterlegter Balken als unterer Abschluss der Mengen-Box mit zentriertem Text `Noch übrig: {geplant - verbaut} m` (bzw. bei Mehrverbrauch zentrierter Amber/Rot-Hinweis `Mehrverbrauch: +X m`).
      - Separaten Stepper unten rechts auf der Karte entfernt (`cardFooterRow` entfällt).
      - Mehr Abstand nach oben (`marginTop: 14`) vom Fortschrittsbalken zur Mengen-Box und reduziertes unteres Padding der Kachel (`paddingBottom: 10`) für einen bündigen und leerraumfreien Abschluss.
    - `BookingScreen.jsx`:
      - `handleStep`: Stepper-Rundung springt bei Klick auf `+` oder `−` immer zuerst zur nächsten vollen Ganzzahl (z. B. `15,7` -> `+` -> `16,0`; `15,7` -> `−` -> `15,0`; `16,0` -> `+` -> `17,0`; `15,0` -> `−` -> `14,0`).
    - `i18n.js`: Neue lokalisierte Keys `remainingLeft`, `overConsumptionRemaining`, `siteStockRemaining` in allen 4 Sprachen (DE, RO, PL, HR).
    - `src/constants/version.js`: Bump auf `v2.52`.
  - **Verifikation:** `npx expo-doctor` (20/20 Checks bestanden), `npx expo export --platform ios` (819 Module erfolgreich gebündelt), `git diff --check` fehlerfrei.

- **2026-11-16 (v2.51)**
  - **Ziel / Anlass:** Drei Mengeneingabe-Wege auf den Raum-Materialkacheln: (1) ziehbarer „Verbaut“-Slider bis max. 100%, (2) Plus/Minus-Stepper immer in Ganzzahl-Schritten (über 100% nur via `+`), (3) direktes Antippen der Zahl für exakte Taschenrechner-Eingabe (`0`–`9` und `,` bis 2 Nachkommastellen) ausschließlich bei Meter-Einheiten (`m`).
  - **Änderungen:**
    - `ProgressBar.jsx`: Interaktiver PanResponder-Slider mit Thumb-Griff und präzisem Einrasten bei 0% und 100%.
    - `bookingHelpers.js`: `isMeterUnit(qu)` und erweitertes `formatQty(val, isMeter, forceTwoDecimals)` für 2 Nachkommastellen bei Meter-Einheiten.
    - `MaterialBookingCard.jsx` & `materialCardStyles.js`: Slider-Kopplung (bis max. 100%, bei Meter in `0,01`-Schritten, bei Stückzahlen in Ganzzahlen); antippen von „Verbaut“ oder der Stepper-Zahl öffnet bei Meter-Einheiten ein Taschenrechner-Modal (`0`–`9`, `,`, `⌫`, `C`, `✓ Übernehmen`).
    - `BookingScreen.jsx` & `CompleteRoomModal.jsx`: `handleStep` (immer `±1` Ganzzahl-Schritte), `handleSetDelta` und Scroll-Lock während aktivem Slider-Ziehen.
    - `src/constants/version.js`: Bump auf `v2.51`.
  - **Verifikation:** `npx expo-doctor` (20/20 Checks bestanden), `npx expo export --platform ios` (819 Module erfolgreich gebündelt), `git diff --check` fehlerfrei.

- **2026-11-16 (v2.50)**
  - **Ziel / Anlass:** Behebung der schwarzen Kamera-Vorschau beim QR-Scan auf iOS (Expo Go / Fabric).
  - **Änderungen:**
    - `ActivationScreen.jsx`: Primärer Start über den nativen System-Barcode-Scanner `CameraView.launchScanner` (`DataScannerViewController` unter iOS 16+ / Google Code Scanner unter Android) inkl. `CameraView.onModernBarcodeScanned`-Listener und automatischem `CameraView.dismissScanner()`. Zusätzlich Fallback-`<CameraView>` repariert: konstante `BARCODE_SCANNER_SETTINGS`-Referenz, direkte Übergabe von `onBarcodeScanned` ab Initial-Render (keine nachträgliche Session-Rekonfiguration durch `cameraReady`-Toggle), explizites `flex: 1, width: '100%', height: '100%'` Layout für `CameraView` und `StyleSheet.absoluteFillObject` für das Overlay.
    - `src/constants/version.js`: Bump auf `v2.50`.
  - **Verifikation:** `npx expo-doctor` (20/20 Checks bestanden), `npx expo export --platform ios` (819 Module erfolgreich gebündelt), `git diff --check` fehlerfrei.

- **2026-11-16 (v2.49)**
  - **Ziel / Anlass:** Beseitigung der falschen Beschriftung „‹ Räume“ auf dem manuellen Aktivierungs-Screen und Bereitstellung eines sauberen Zurück-Buttons mit Vektor-Chevron-Icon und lokalisiertem Text „Zurück“ (`backShort`).
  - **Änderungen:**
    - `ActivationScreen.jsx`: `ChevronLeftIcon` SVG-Komponente hinzugefügt; Button-Text von `back` („Räume“) auf `backShort` („Zurück“) umgestellt; `backBtnPill`-Styling mit `flexDirection: 'row'`, `alignItems: 'center'` und `gap: 4` verfeinert.
    - `src/constants/version.js`: Bump auf `v2.49`.
  - **Verifikation:** `npx expo-doctor` (20/20 Checks bestanden), `npx expo export --platform ios` (819 Module erfolgreich gebündelt), `git diff --check` fehlerfrei.

- **2026-11-16 (v2.48)**
  - **Ziel / Anlass:** Redesign des Aktivierungs-Screens: Vertikal zentriertes, elegantes Layout; Burk-Logo (aus Admin-Panel) oder P12-Aufmaß-Vektorlogo als Standard-Fallback; 2 klare Buttons („Einladung scannen (QR-Code)“ / „Code manuell eingeben“); Vollbild-Eingabemodus für manuellen Code ohne Scan-Button und mit direktem „Jetzt aktivieren“.
  - **Änderungen:**
    - `P12AufmassLogo.jsx`: Neues hochauflösendes Vektorlogo-Komponenten-SVG für P12 Aufmaß.
    - `ActivationScreen.jsx`: Modus-Umschaltung (`choice` vs `manual`). Screen 1: Großes Firmenlogo (Burk oder P12 Aufmaß), Titel „Geräteaktivierung“, Subtext „Scanne jetzt deine Einladung (QR-Code) oder gib deinen 6-stelligen Code ein.“ und zwei vertikal zentrierte Haupt-Buttons. Screen 2: Reiner manueller Eingabemodus im Vollbild mit Code-Eingabefeld, „Jetzt aktivieren“-Button und Zurück-Navigation (ohne Scan-Button).
    - `App.js`: Frühes Laden von `tenantBranding` auch vor Geräteaktivierung und Übergabe als Prop an `ActivationScreen`.
    - `i18n.js`: Neue Übersetzungen für `activationTitle`, `activationSubtitle`, `enterCodeManuallyBtn`, `manualCodePrompt`, `backToChoice` in allen 4 Sprachen.
    - `src/constants/version.js`: Bump auf `v2.48`.
  - **Verifikation:** `npx expo-doctor` (20/20 Checks bestanden), `npx expo export --platform ios` (819 Module erfolgreich gebündelt), `git diff --check` fehlerfrei.

- **2026-11-16 (v2.47)**
  - **Ziel / Anlass:** Klarer Leerzustand bei nicht zugeordneten Projekten („Dir wurde noch kein Projekt zugeordnet. Bitte melde dich gegebenenfalls bei deinem zuständigen Projektleiter.“) ohne irreführende Projektauswahl-Überschrift, inkl. Pull-to-Refresh und Neuladen-Button.
  - **Änderungen:**
    - `i18n.js`: `noProjectsAvailable` und `noProjectsSub` mit der exakten Wunschformulierung in allen 4 Sprachen (DE, RO, PL, HR) aktualisiert. Neuen Übersetzungs-Key `refreshProjectsBtn` ergänzt.
    - `ProjectSelectScreen.jsx`: `sectionHeader` ausgeblendet, wenn `projects.length === 0`. Prominenter Neuladen-Button (`refreshBtn`) und `RefreshControl` auf der ScrollView integriert.
    - `App.js`: `handleRefreshProjects` implementiert und als `onRefresh`-Prop an `ProjectSelectScreen` übergeben; leitet bei 1 neu zugeordnetem Projekt sofort in die Raumliste weiter.
    - `src/constants/version.js`: Versions-Bump auf `v2.47`.
  - **Verifikation:** `npx expo-doctor` 20/20 Checks bestanden, `npx expo export --platform ios` (818 Module) fehlerfrei gebündelt, `git diff --check` fehlerfrei.

- **2026-11-16 (v2.46)**
  - **Ziel / Anlass:** Saubere User- und Google-Auth-Löschung, Signalerkennung gelöschter User in TTApp, Abmelde-Icon im Header mit Passwort-Sperre/LoginScreen und Bereinigung gelöschter Projekte.
  - **Änderungen:**
    - `ToolTime/backend`: In `DELETE /:tenantId/members/:uid` wird der Benutzer nun vollständig aus Firebase Auth (`adminAuth.deleteUser`) und der Profilsammlung gelöscht, aus `assignedMonteurIds` aller Projekte entfernt und offene Einladungen bereinigt. In `GET /:tenantId/projects` werden gelöschte Projekte (`status: 'deleted' || isDeleted`) serverseitig gefiltert. Neuer Endpoint `POST /api/public/invites/login` für Passwort-Login und Übergabe von `password` bei `POST /api/public/invites/redeem`.
    - `ToolTime/admin-web`: In `TenantMembersView.tsx` Löschen-Button für Mitglieder mit Bestätigungsdialog ergänzt. Versions-Bump auf `v40`.
    - `TTApp`:
      - `Header.jsx`: Abmelde-Button (`🚪`) neben Online/Sync-Status im Header mit Bestätigungsdialog („Bist du sicher, dass du dich abmelden willst?“).
      - `LoginScreen.jsx` & `authService.js`: Neues Entsperr-Screen mit Monteurname, Passwortfeld und Entsperren per individuellem Passwort. `hashHelper.js` für offline-fähigen SHA-256-Abgleich.
      - `ActivationScreen.jsx`: Schritt „Passwort festlegen“ bei neuer Geräteaktivierung integriert.
      - `syncService.js` & `App.js`: Automatische Erkennung im Admin gelöschter/inaktiver Benutzer (`isUserDeleted` -> Sofort-Abmeldung & Hinweis). Automatische Erkennung gelöschter Projekte (`isProjectDeleted` -> Cache-Purge, Weiterleitung auf verbleibendes Projekt oder Projektauswahl-Empty-State).
      - `i18n.js`: Alle neuen Meldungen, Buttons und Dialoge in allen 4 Sprachen (DE, RO, PL, HR) übersetzt.
  - **Verifikation:** `npx expo-doctor` 20/20, `npx expo export --platform ios` (818 Module) erfolgreich gebündelt; `ToolTime/backend` auf Cloud Run deployed (`tooltime-api-00011-c7q`), `ToolTime/admin-web` erfolgreich gebaut (`tsc -b && vite build`).

- **2026-11-14 (v2.45)**
  - **Anlass:** Kachel „Wöchentliches Aufmaß“ aus `RoomListScreen` entfernt; floor filters und room cards starten direkt. App-Anzeigeversion v2.45.
  - **Verifikation:** `npx expo-doctor` 20/20, iOS-Export und `git diff --check` bestanden.

- **2026-11-14 (v2.44)**
  - **Anlass:** Tappbares Netzwerk-Symbol oben rechts als manueller Sync-Auslöser; rotierendes Sync-Symbol während Sync; Raum-Zurücknavigation im Header. App-Anzeigeversion v2.44.
  - **Verifikation:** `npx expo-doctor` 20/20, iOS-Export und `git diff --check` bestanden.

