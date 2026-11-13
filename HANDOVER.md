# Project Handover

Evidence labels used below: **[code]** confirmed from code, **[config]** confirmed from configuration, **[git]** from Git history, **[inferred]** inferred but not verified, **Unknown / needs confirmation**.

## 1. Project Overview

TTApp is a React Native (Expo) mobile app for installers ("Monteure") of Burk Haustechnik (plumbing/heating contractor) [code: names, data]. A Monteur unlocks the app with a 4-digit PIN, picks a construction project, picks a room, and records installed material quantities per room (against planned quantities from the bill of quantities), takes proof photos, files "Mehrbedarf" (additional demand) requests and unplanned-material records, and completes rooms. Everything works offline and is synced to Firebase (Firestore/Storage), where a separate admin web app (`/home/oem/Programming/ToolTime`, different repo) manages projects, positions, rooms and users [code: Firestore paths; admin app content only partially inspected].

UI languages: German (base), Romanian, Polish, Croatian [code: `i18n.js`].

## 2. Current Status

- App version `v2.43` (`src/constants/version.js`) [code]. `package.json`/`app.json` version are still `1.0.0` (unrelated to the display version) [config].
- Implemented [code]: PIN login with lockout, multi-project selection, per-project offline cache, room list with capped 0–100% progress rings and completion badges only for explicitly completed rooms, room booking with unplanned items pinned above planned material cards, floor filter pills `[Alle, UG, EG, OG, DG, Strangschema]`, floor grouping, nahtlose Mehrverbrauchserfassung ohne störende Dialoge/Folgeseite (Alerts & Abweichungen automatisch an Admin repliziert, Prozentwert > 100%, Fortschrittsbalken wechselt zu Gelb bis 110% und Rot ab 110%, Kacheln bleiben neutral weiß), alert replication to `projects/{projectId}/alerts` for admin banner, material booking per room with stock checks, rein materialbezogener "Mehrbedarf"-Nachtrag (ohne blockierenden Begründungszwang, ohne Arbeitszeit-Umschaltung), unplanned/außerplanmäßig material modal mit Erfassername und Pflichtbegründung, photo capture (camera/gallery, compress < 1000 KB), room completion (explicit confirmation and saved photo required; then locks room), delta two-way sync, auto-sync on reconnect/after actions, EAS OTA update check at startup.
- Maturity: working prototype in active iteration (≈ 11 app releases v1.2→v2.11 in 10 days, 2026-09-21 → 2026-09-30) [git]. No automated tests, linting or type checking. Not production-hardened security-wise (see §7, §13).
- Whether the app is deployed to real users / which EAS channel is used: Unknown / needs confirmation.

## 3. Technology Stack

- Expo SDK `^58.0.0`, React Native `0.88.1`, React `19.3.0`; JavaScript only (no TypeScript) [config: `package.json`].
- Libraries: `firebase ^12.19` (Firestore, Storage, Auth custom-token session), `@react-native-async-storage/async-storage`, `@react-native-community/netinfo`, `expo-file-system`, `expo-image-manipulator`, `expo-image-picker`, `expo-updates`, `expo-status-bar`, `react-native-svg` (ProgressRing) [config/code].
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

[code] Current device activation redeems a one-time invite with the backend, signs in with a Firebase custom token, and stores tenant/monteur locally. `restoreSession` uses those local records on reload. Explicit `logoutDevice` signs out and removes them; an installation ID alone cannot restore a signed-out session. The older client-side PIN flow remains as legacy code.
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
- Current smoke checks: `npx expo-doctor` 20/20 and `npx expo export --platform ios` passed on 2026-11-13 for v2.43. Metro is running on port 8081; no device was attached. Web export is unavailable because `web` is not configured in `app.json` platforms.
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

Suspected / unverified: see "suspected" markers above. The prior unplanned-reason validation discrepancy is fixed in v2.43; device behavior remains unverified. Full-screen room completion modal, room-list/header layout, and v2.42 unplanned-card ordering in Expo Go on a real device: Unknown / needs confirmation.

## 14. Current Work / Open Tasks

- v2.43 requires a nonblank reason before saving an unplanned installed material. Existing reason quick choices also satisfy the requirement. The form marks the reason field red after an invalid submit. Device behavior still needs confirmation in Expo Go.
- No documented backlog. Open tasks: Unknown / needs confirmation (ask the owner). Do not invent requirements.

## 15. Recent Relevant Changes

[git] Latest first:
- 2026-11-13 v2.43: The unplanned-install form enforces its already indicated reason requirement in `handleSave`, marks the field as required/invalid, and stores only the entered reason. Supersedes the optional-reason behavior of v2.21 for this form; Mehrbedarf reason stays optional.
- 2026-11-13 v2.42: Booking screen builds its visible list from newest unplanned entries and room material flags before standard active cards; adding an unplanned entry clears search. Fixes the card disappearing while remaining searchable after a catalog update.
- 2026-11-13 v2.41: Room-list progress ring caps its arc, number and color at green 100 even for underlying over-consumption; completion badge moves to the right and says “100% fertig” only for completed rooms. Header sync button becomes a single rotating SVG icon without red accents.
- 2026-11-13 v2.40: Room-completion modal expanded to full screen; cancel action moved to top X, only one fixed green confirmation button at bottom. Grey no-photo completion trigger made clearer; existing photo-required alert retained.
- 2026-11-13 v2.39: Explicit room completion only; photo guard in the UI and App handler; zero-photo completed rooms can be reopened with sync of cleared completion metadata. Header shows project and tenant branding from Admin, with KW and monteur initials removed.
- 2026-11-13 v2.38: `getRoomFloor` is exported from `storageService.js` and resolves explicit `floor`/`level`, a floor prefix in room code, or `Sonstiges`; fixes `undefined is not a function` in `RoomListScreen` (and the same latent issue in `BookingScreen`). `Header` replaces the full monteur name with a compact user icon and initials next to the logo and trims vertical padding.
- 2026-11-13 v2.37: Expo Go reload now has the missing `refreshData` helper; startup errors after an activation retain the local session and route to project selection rather than demanding a new one-time invite. `expo-doctor` 20/20 and iOS export passed; Expo Go device reload and live Firebase session restoration remain unverified.
- 2026-10-14 v2.21: App-Vereinfachung für Monteure (Arbeit nicht blockieren):
  - `NachtragModal.jsx`: Segmented-Control-Tabs (`📦 Material` und `⏱ Arbeitszeit`) komplett entfernt. Nachträge erfassen ab sofort ausschließlich Material ("mehr Zeit benötigt" entfernt, da Zeitrisiko beim Unternehmer/Nachkalkulation liegt und nicht ins Aufmaß gehört).
  - Begründungszwang damals aufgehoben: Notiz/Begründung in `NachtragModal.jsx` und `UnplannedInstallModal.jsx` war optional. **Seit v2.43 ist die Begründung in `UnplannedInstallModal.jsx` wieder Pflicht; Mehrbedarf bleibt optional.**
  - Mehrverbrauch nahtlos: Monteure können verbautes Material frei über Soll hochzählen; altes, ungenutztes `OverConsumptionModal.jsx` vollständig aus dem Repo gelöscht.
  - Bereinigung der Styles (`nachtragStyles.js`): Unbenutzte Tab-Styles entfernt.
  - Button im Kopfbereich von `BookingScreen.jsx` auf `+ Material benötigt` (`btnNeedMaterial`) aktualisiert.
  - Lokalisierung (`i18n.js`): Neue und aktualisierte Übersetzungen für alle 4 Sprachen (DE, RO, PL, HR).
- 2026-10-09 v2.20: Nahtlose Mehrverbrauchserfassung ohne störende Dialoge / Folgeseite:
  - `BookingScreen.jsx`: `OverConsumptionModal` und Blockaden beim Überschreiten der Planmenge entfernt. Der Monteur kann Material ohne Zwischenschritt weiter buchen.
  - Automatische Abweichungserfassung: Beim Überschreiten der Planmenge wird automatisch ein `over_consumption_alert` ausgelöst und via Firestore synchronisiert, sodass die Position direkt im Admin-Cockpit unter "Abweichungen" und im Nachbestell-Modul aufgeführt wird.
  - Dynamische Prozentanzeige: Prozentwerte für Material (`MaterialBookingCard.jsx`) und Raum (`storageService.js`) können nun Werte über 100 % annehmen (z. B. 108 %, 115 %).
  - Farblogik des Fortschrittsbalkens (`ProgressBar.jsx`, `ProgressRing.jsx`):
    - Bis 100 %: Grün (`COLORS.green`)
    - 101 % bis 110 %: Gelb (`#EAB308`)
    - Über 110 %: Rot (`COLORS.red`)
    - Der sichtbare Balken/Ring ist auf 100 % gedeckelt und wächst optisch nicht aus dem Rahmen.
  - Kachel-Design (`materialCardStyles.js`): Die Kacheln werden bei Mehrverbrauch nicht mehr rötlich eingefärbt, sondern behalten ihren neutralen Hintergrund.
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
| Booking UI / unplanned card ordering / completion recovery / full-screen modal | `src/screens/BookingScreen.jsx`, `src/components/booking/CompleteRoomModal.jsx`, `src/components/booking/UnplannedInstallModal.jsx`, `src/components/booking/completeRoomStyles.js`, `src/components/booking/bookingStyles.js` |
| Tenant branding / header | `src/services/authService.js`, `src/components/Header.jsx` |
| Room List & Floor Filter / capped ring | `src/screens/RoomListScreen.jsx`, `src/components/ProgressRing.jsx` |
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

- **2026-11-13 (v2.43)**
  - **Anlass:** Nutzer verlangt eine Pflichtbegründung beim Erfassen außerplanmäßig verbauten Materials.
  - **Ursache:** Die Anzeige für fehlende Pflichtfelder berücksichtigte die Begründung bereits, `handleSave` aber nicht. Ein leerer Grund wurde durch einen pauschalen Standardtext ersetzt.
  - **Änderungen:** `handleSave` blockiert bei leerer/aus Leerzeichen bestehender Begründung. Feld mit Pflichtstern und rotem Fehlerzustand; Text oder vorhandene Schnellwahl zählt. Gespeichert wird die tatsächliche Begründung. App-Anzeigeversion v2.43. Der Mehrbedarf-Dialog bleibt unverändert.
  - **Verifikation:** `npx expo-doctor` 20/20, iOS-Export und `git diff --check` bestanden. Expo-Go-Gerät: Unknown / needs confirmation.

- **2026-11-13 (v2.42)**
  - **Anlass:** Ein neu als außerplanmäßig verbaut erfasster Posten war im Raum nur über die Suche sichtbar, nicht als Kachel oben in der Liste.
  - **Ursache:** `BookingScreen` setzte seine lokalen aktiven Material-IDs bei Änderung der Kataloglänge zurück. Der neue Posten war dann nicht mehr in dieser Liste, obwohl der Katalogeintrag vorhanden war.
  - **Änderungen:** Sichtbare Kacheln beziehen die neuesten außerplanmäßigen IDs zuerst aus `unclearItems` und den Raum-Materialien; IDs werden dedupliziert. Beim Speichern wird eine aktive Suche gelöscht. App-Anzeigeversion v2.42.
  - **Verifikation:** `npx expo-doctor` 20/20, iOS-Export und `git diff --check` bestanden. Live-Verhalten auf dem Gerät und Firestore: Unknown / needs confirmation.

- **2026-11-13 (v2.41)**
  - **Anlass:** Screenshot zeigte ein irritierendes 100%-Fertig-Badge direkt am Raumtitel; bei Mehrverbrauch konnte der Ring 101 anzeigen. Sync-Icon hatte roten Rand und eine schwer erkennbare Glyphe.
  - **Änderungen:** Ring-Bogen und Zahl in der Raumliste auf 100 begrenzt und bei ≥100 grün; in Arbeit befindliche Räume mit ≥100 erhalten kein Fertig-Badge. Das vergrößerte, vertikal zentrierte Badge „100% fertig“ steht rechts ausschließlich bei explizitem Abschlussstatus; Text in allen vier Sprachen ergänzt. Sync-Knopf als klares SVG-Kreispfeil-Symbol ohne roten Rand/Zähler, mit Rotation während Synchronisierung. App-Anzeigeversion v2.41.
  - **Verifikation:** `npx expo-doctor` 20/20, iOS-Export und `git diff --check` bestanden. Gerätedarstellung: Unknown / needs confirmation.

- **2026-11-13 (v2.40)**
  - **Anlass:** Nutzer wünschte einen deutlich grauen Monteur-fertig-Button ohne Foto samt Hinweis beim Tippen und eine bildschirmfüllende Abschlussübersicht mit X oben, mehr Platz für Produkte und einem grünen Abschlussbutton unten.
  - **Änderungen:** Vorhandene Foto-Prüfung im `BookingScreen` beibehalten; grauen Button aufgehellt. `CompleteRoomModal` nutzt nun ein Full-Screen-Modal mit Safe Area, einer flexiblen scrollbaren Produktliste, X als Abbruch und einem einzelnen grünen Abschlussbutton. App-Anzeigeversion v2.40.
  - **Verifikation:** `npx expo-doctor` 20/20 und iOS-Export bestanden; Expo-Go-Layout auf echtem Gerät: Unknown / needs confirmation.

- **2026-11-13 (v2.39)**
  - **Anlass:** Screenshot zeigte gesperrten Raum bei 0 Fotos und noch offenen Materialien; Nutzer wünschte Admin-Logo/Farbwelt, neutralen Header und sichtbares Projekt statt KW/Initialen.
  - **Ursache:** `BookingScreen` und Raumliste behandelten 100 % allein als Abschluss; die UI übersprang in diesem Fall die Foto-Prüfung und `App.handleCompleteRoom` prüfte Fotos gar nicht.
  - **Änderungen:** Sperre nur bei explizitem Abschlussstatus; Foto-Pflicht in UI und App-Handler; vorhandenes Abschlussmodal zur bewussten Bestätigung aktiviert; für alte Null-Foto-Abschlüsse Wiederöffnung mit lokalem Delta und Remote-Sync ergänzt. Branding aus öffentlicher Tenant-API mit Offline-Cache im Header; KW und Monteur-Initialen entfernt, Projekttitel vergrößert. App-Anzeigeversion v2.39.
  - **Verifikation:** `npx expo-doctor` 20/20, `npx expo export --platform ios` und `git diff --check` bestanden. Auf echtem Expo-Go-Gerät, Fotoaufnahme und Firestore-Schreibzugriff: Unknown / needs confirmation.

- **2026-11-13 (v2.38)**
  - **Anlass:** Screenshot zeigte `TypeError: undefined is not a function` in der Raumliste; Nutzer wünschte weniger Platzverbrauch im Header.
  - **Ursache:** `RoomListScreen.jsx` und `BookingScreen.jsx` importierten `getRoomFloor`, das `storageService.js` nicht exportierte.
  - **Änderungen:** Gemeinsame Geschossfunktion ergänzt; Header zeigt Nutzer-Symbol und aus Vor-/Nachname gebildete Initialen neben dem burk-Logo statt ausgeschriebenem Monteurnamen, mit kleinerer vertikaler Höhe. App-Anzeigeversion v2.38.
  - **Verifikation:** gezielte Laufzeitprüfungen für Geschossfunktion, `npx expo-doctor` 20/20, iOS-Export und `git diff --check` bestanden. Darstellung und Navigation auf echtem Gerät: Unknown / needs confirmation.

- **2026-11-13 (v2.37)**
  - **Anlass:** Normaler Expo Go Reload führte trotz vorhandener Geräteaktivierung zum Aktivierungsbildschirm.
  - **Ursache:** `App.js` rief `refreshData` ohne Definition auf; der allgemeine Startup-Catch behandelte diesen Fehler wie eine fehlende Aktivierung.
  - **Änderungen:** Bereits vorhandene uncommitted Ergänzung von `refreshData` beibehalten; Startup-Catch prüft lokale Aktivierung und zeigt bei anderem Startfehler die Projektauswahl. App-Anzeigeversion auf v2.37 erhöht.
  - **Verifikation:** `npx expo-doctor` (20/20), `npx expo export --platform ios` und `git diff --check` erfolgreich. Web-Export nicht möglich, da `web` nicht in `app.json` als Plattform aktiviert ist. Reload in Expo Go und echte Firebase-Sitzung: Unknown / needs confirmation.

- **2026-11-13 (v2.34)**
  - **Ziel / Anlass:** Beseitigung mehrfacher Frame-Doppel-Scans via useRef-Lock, Härtung der Rate-Limit-Schwellen auf dem Server & iOS-Kamera-Plugin-Konfiguration.
  - **Änderungen:**
    - `ActivationScreen.jsx`: `isScanningRef` (`useRef`) als synchroner Lock implementiert, um zu verhindern, dass aufeinanderfolgende Video-Frames bei 30fps mehrfache Aktivierungsanfragen senden. Auto-Formatierung für 6-stelligen Code (`YC-89MN`), direkter Button „Entsperren / Erneut versuchen“ bei Fehlern.
    - `app.json`: `expo-camera`-Plugin und `NSCameraUsageDescription` in `ios.infoPlist` eingetragen, um native Kamera-Berechtigungen auf iOS abzusichern.
    - `ToolTime/backend`: `rateLimitService.js` entspannt (10 Versuche bis 1 Min. Pause statt Sperre nach 3 Versuchen), Cloud Run mit `trust proxy: 1` aktualisiert.
    - `src/constants/version.js`: Bump auf `v2.34`.
  - **Verifikation:** `npx expo export` für iOS (816 Module) fehlerfrei; Backend auf Cloud Run aktualisiert; Firestore `rateLimits` bereinigt.

- **2026-11-13 (v2.31)**
  - **Ziel / Anlass:** Upgrade auf Expo SDK 58 (`^58.0.0`), React Native `0.88.1` & React `19.3.0` zur vollen Kompatibilität mit der aktuellen Expo Go iOS App.
  - **Änderungen:**
    - `package.json` & `package-lock.json`: Expo 58 Module (`expo-camera`, `expo-file-system`, `expo-image-manipulator`, `expo-image-picker`, `expo-status-bar`, `expo-updates`, `react-native-svg`).
    - `app.json`: Veraltetes `privacy: "public"` entfernt (Schema-Konformität).
    - `src/constants/version.js`: Bump auf `v2.31`.
  - **Verifikation:** `npx expo-doctor` mit 20/20 Checks bestanden. `npx expo export` für iOS (816 Module) und Android (815 Module) erfolgreich gebündelt.

- **2026-11-13 (v2.30)**
  - **Ziel / Anlass:** Multi-Tenant Scoping, QR-Code/Invite-Code Geräteaktivierung & Firebase Auth Session-Management.
  - **Änderungen:**
    - `ActivationScreen.jsx` & `src/services/apiService.js`: Kamera-QR-Scan & Code-Eingabe gegen `/api/public/invites/redeem`.
    - `src/services/authService.js`: Einlösen mit Geräte-InstallationId, Sign-In via Firebase Custom-Token, lokaler PIN nur für UI-Lock.
    - `src/services/storageService.js` & `src/services/syncService.js`: Scoping auf `tenants/:tenantId/projects/:projectId/...`, Outbox-Löschschutz, Storage-Uploads nach `tenants/:tenantId/projects/:projectId/proofs/...`.
    - `App.js`: Phase `activation` integriert; `src/constants/version.js` auf `v2.30` aktualisiert.
  - **Verifikation:** `npx expo export` erfolgreich validiert (Android: 802 Module, iOS: 804 Module fehlerfrei gebündelt).

