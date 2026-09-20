// Central Firebase Configuration for Burk Haustechnik ToolTime
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

export const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || "",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "burk-haustechnik.firebaseapp.com",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "burk-haustechnik",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "burk-haustechnik.firebasestorage.app",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "209459117942",
  appId: process.env.VITE_FIREBASE_APP_ID || "1:209459117942:web:5c2e32cfcee6467492c457",
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID || "G-9CBCVHREHS"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);

export default app;
