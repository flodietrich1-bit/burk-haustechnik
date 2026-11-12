import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { connectFirestoreEmulator, getFirestore, type Firestore } from "firebase/firestore";
import { connectStorageEmulator, getStorage, type FirebaseStorage } from "firebase/storage";
import { browserLocalPersistence, connectAuthEmulator, getAuth, initializeAuth, type Auth } from "firebase/auth";

export const firebaseConfig = {
  apiKey: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_API_KEY) || "AIzaSyAXf_veu3fsfYhyaRJI8531_ObU4zMY040",
  authDomain: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN) || "burk-haustechnik.firebaseapp.com",
  projectId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_PROJECT_ID) || "burk-haustechnik",
  storageBucket: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET) || "burk-haustechnik.firebasestorage.app",
  messagingSenderId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID) || "209459117942",
  appId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_APP_ID) || "1:209459117942:web:5c2e32cfcee6467492c457",
  measurementId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_MEASUREMENT_ID) || "G-9CBCVHREHS"
};

let appInstance: FirebaseApp;
if (!getApps().length) {
  appInstance = initializeApp(firebaseConfig);
} else {
  appInstance = getApp();
}

export const db: Firestore = getFirestore(appInstance);

let storageInstance: FirebaseStorage | null = null;
try {
  storageInstance = getStorage(appInstance);
} catch (e) {
  console.warn("Firebase Storage unavailable:", e);
}
export const storage = storageInstance as FirebaseStorage;

const useEmulators = import.meta.env?.VITE_USE_FIREBASE_EMULATORS === 'true';
let authInstance: Auth | null = null;
// Only initialize Auth when an API key is present to avoid auth/invalid-api-key top-level exception
if (firebaseConfig.apiKey) {
  try {
    authInstance = useEmulators ? initializeAuth(appInstance, { persistence: browserLocalPersistence }) : getAuth(appInstance);
  } catch (e) {
    console.warn("Firebase Auth initialization skipped:", e);
  }
}
export const auth = authInstance as Auth;

if (useEmulators && !(globalThis as { __tooltimeEmulatorsConnected?: boolean }).__tooltimeEmulatorsConnected) {
  const emulatorHost = window.location.hostname;
  connectAuthEmulator(auth, `http://${emulatorHost}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, emulatorHost, 8085);
  if (storage) connectStorageEmulator(storage, emulatorHost, 9199);
  (globalThis as { __tooltimeEmulatorsConnected?: boolean }).__tooltimeEmulatorsConnected = true;
}

export default appInstance;
