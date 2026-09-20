import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "burk-haustechnik.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "burk-haustechnik",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "burk-haustechnik.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "209459117942",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:209459117942:web:5c2e32cfcee6467492c457",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-9CBCVHREHS"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);

export default app;
