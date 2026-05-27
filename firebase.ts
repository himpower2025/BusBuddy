/// <reference types="vite/client" />
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

let db: any = null;
let auth: any = null;
let isFirebaseFallback = false;
let fallbackReason = "";

// Check if config has minimum required fields to initialize securely
const hasValidConfig = !!(firebaseConfig.apiKey && firebaseConfig.apiKey.startsWith('AIzaSy'));

if (hasValidConfig) {
  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    
    // Sign in anonymously on import to handle basic Firestore authentication queries safely
    signInAnonymously(auth).catch((error: any) => {
      console.warn("Anonymous auth skipped or failed:", error);
    });
  } catch (error: any) {
    console.error("Firebase initialization failed:", error);
    isFirebaseFallback = true;
    fallbackReason = error?.message || String(error);
  }
} else {
  console.warn("VITE_FIREBASE_API_KEY is missing or invalid. Initializing in offline sandbox mode.");
  isFirebaseFallback = true;
  fallbackReason = "Missing or malformed VITE_FIREBASE_API_KEY environment variable. Check Vercel settings.";
}

// Provide defensive mock objects if initialization failed or config was invalid
if (isFirebaseFallback) {
  db = new Proxy({}, {
    get(target, prop) {
      return () => {
        throw new Error(`Firebase not initialized: ${fallbackReason}`);
      };
    }
  });
  
  auth = {
    currentUser: null,
    onAuthStateChanged: (cb: any) => {
      if (typeof cb === 'function') cb(null);
      return () => {};
    }
  };
}

export { db, auth, isFirebaseFallback, fallbackReason, firebaseConfig };
