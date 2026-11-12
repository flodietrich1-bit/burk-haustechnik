import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || 'burk-haustechnik';

const usingEmulators = Boolean(process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST);
const adminApp = getApps()[0] || initializeApp({
  ...(usingEmulators ? {} : { credential: applicationDefault() }),
  projectId,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || (usingEmulators ? 'burk-haustechnik.firebasestorage.app' : `${projectId}.firebasestorage.app`),
});

export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);
export const adminStorage = getStorage(adminApp);
