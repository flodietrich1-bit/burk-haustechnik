import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth } from 'firebase/auth';

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

export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);

export default app;
