# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Mandatory Startup Procedure

Every AI agent working on this repository must:

1. Read this `AGENTS.md`.
2. Read `HANDOVER.md` **completely** before starting implementation.
3. Inspect the relevant existing code before making changes.
4. Run `git status` before modifying files (and make sure you are on branch `Monteur`).
5. Never assume `HANDOVER.md` is more accurate than the code. If they conflict, investigate and treat the current implementation as the source of truth (then fix the handover).
6. Continue from the current project state instead of rebuilding existing functionality.

**If you have not read `HANDOVER.md` in the current session, do not start implementation. Read it first.**

# Versioning Rules (MANDATORY)
1. ALWAYS update the version display in this project whenever you make changes!
2. App and Web (Admin) have SEPARATE versions:
   - **App Version**: `/home/oem/Programming/TTApp/src/constants/version.js` (e.g. `v1.2`, `v1.3`, ...)
   - **Web Admin Version**: `/home/oem/Programming/ToolTime/admin-web/src/version.ts` (e.g. `v18`, `v19`, ...)
3. Updating the App does NOT update the Web version, and updating Web does NOT update the App version.

# Git Branching & Deployment Rules (MANDATORY)
- **Monteur App**: Exclusively use branch `Monteur` (do NOT use or recreate `Monteur-App`).
- **Web Admin**: Exclusively use branch `main` in `/home/oem/Programming/ToolTime/admin-web`.
- **AUTOMATIC EXPO DEPLOYMENT**: Jedes Mal, wenn Änderungen für die Monteur-App gepusht werden (`git push origin Monteur`), MUSS parallel/automatisch das EAS-Update für Expo veröffentlicht werden:
  `npx eas-cli update --branch preview --environment preview --message "<APP_VERSION> - <Beschreibung>" --non-interactive`
  (Der Nutzer muss das NICHT extra anfordern – das gehört ab sofort fest zum Release-Ablauf dazu!)

# Project Facts (details in HANDOVER.md)

- Expo SDK 57 / React Native 0.86 / React 19 mobile app ("TTApp", Monteur app for Burk Haustechnik). Plain **JavaScript** (`.js`/`.jsx`); no TypeScript, no linter, no tests.
- Package manager: **npm** (`package-lock.json`). Do not introduce yarn/pnpm lockfiles.
- Backend: Firebase (Firestore + Storage) project `burk-haustechnik`, shared with a separate admin web app in `/home/oem/Programming/ToolTime` (different repo; its Firestore/Storage rules are in `ToolTime/backend`). Data contracts with it are implicit; do not change field names/collections casually.
- Navigation is state-based in `App.js` (`appPhase` + `currentScreen`), not React Navigation. Do not add a navigation library unless asked.
- Offline-first: writes go to AsyncStorage first (`storageService.js`), then `syncService.syncBookings()` pushes/pulls deltas.

# Development Rules

- Commands: `npm install`, `npm start` (`expo start`), `npm run android|ios|web`. There is no build/lint/test script. EAS OTA updates are used (`expo-updates`); there is no `eas.json` in the repo.
- Layering: screens/components (`src/screens`, `src/components`) → handlers in `App.js` → `src/services/*`. Keep Firestore access in `syncService.js`/`authService.js`; keep AsyncStorage access in `storageService.js` (auth keys live in `authService.js`).
- Project-scoped data: rooms, materials, project info and `lastSyncedAt` are cached **per project ID** (`<key>_<projectId>`). Always pass `projectId` explicitly; do not rely on the `resolveProjectId` fallback (ends at `hallenbad-weingarten`).
- Folders: screens in `src/screens/*Screen.jsx`; reusable UI in `src/components`; booking-screen sub-components and their `*Styles.js` in `src/components/booking`; constants in `src/constants`; i18n in `src/locales/i18n.js`.
- Naming: PascalCase `.jsx` for components/screens; camelCase `.js` for services/helpers/styles. Styles use `StyleSheet.create` (booking components keep them in separate `*Styles.js` files); colors come from `COLORS` in `src/constants/theme.js`.
- UI strings: German is the base language and fallback. Supported: `de`, `ro`, `pl`, `hr` (`LANGUAGES` in `i18n.js`). New user-visible text must be added to `TRANSLATIONS` with all four languages and rendered via `t(key, lang)`; units via `formatUnit`. (Existing code still has some hard-coded German strings, e.g. in `App.js`; do not add more.)
- Prefer extending existing abstractions (`bookingHelpers.js`, `storageService`, `computeRoomPercentage`, existing modals) over adding parallel systems. Before creating a new component/service/utility/dependency/data model, search for an existing one. Install Expo-related packages with `npx expo install`.
- No unrelated refactoring. Keep diffs focused. Preserve existing comments/docstrings.
- Do not silently change: Firestore collection/field names or document paths, sync semantics, PIN/auth behavior, `app.json` (`runtimeVersion.policy` is `appVersion`; native-affecting changes need a version/build decision), or the `updates` config. Call these out to the user first.
- Security: never copy, print or commit secrets, tokens, private keys or real PINs. The repo already contains the Firebase web config (`src/services/firebase.js`) and hard-coded seed PINs (`authService.js`); do not add more and do not repeat them in docs, logs or new files. Use `.env*.local` (gitignored) if env values are ever needed; none are used today.
- Timestamps are ISO strings (`new Date().toISOString()`); delta sync compares ISO strings lexicographically.

# Verification

There is no automated test, lint or type-check tooling. Therefore:

- Run what exists: `npx expo-doctor` and a bundling smoke test such as `npx expo export --platform web` (output goes to gitignored `dist/`), and `npm start` for manual checks.
- For logic changes, trace the affected flow in code (outbox → `getLocalUnsyncedDelta` → `syncBookings`) and consider offline vs. online behavior when touching sync.
- Do not claim something was tested if it was not. State exactly what was run and what could only be reasoned about (on-device behavior, real Firestore writes).
- Always bump `APP_VERSION` in `src/constants/version.js` for app changes.

# Handover Maintenance

- After every meaningful implementation session, update `HANDOVER.md` (Current Status, Known Issues, Current Work, Recent Changes, Important Files, Last Updated).
- Do not rewrite it blindly. Preserve useful history and context; correct what is wrong; mark unverified items `Unknown / needs confirmation`.
- A new agent with zero conversation context must be able to continue safely from `HANDOVER.md` alone.
