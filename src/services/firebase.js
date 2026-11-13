import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { initializeAuth, getAuth, getReactNativePersistence, browserLocalPersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Burk Haustechnik Firebase project configuration
export const firebaseConfig = {
  apiKey: "AIzaSyAXf_veu3fsfYhyaRJI8531_ObU4zMY040",
  authDomain: "burk-haustechnik.firebaseapp.com",
  projectId: "burk-haustechnik",
  storageBucket: "burk-haustechnik.firebasestorage.app",
  messagingSenderId: "209459117942",
  appId: "1:209459117942:web:5c2e32cfcee6467492c457",
  measurementId: "G-9CBCVHREHS"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

let authInstance;
try {
  const persistence = typeof getReactNativePersistence === 'function'
    ? getReactNativePersistence(AsyncStorage)
    : (browserLocalPersistence || undefined);

  authInstance = persistence
    ? initializeAuth(app, { persistence })
    : getAuth(app);
} catch (e) {
  authInstance = getAuth(app);
}

export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = authInstance;

export default app;
