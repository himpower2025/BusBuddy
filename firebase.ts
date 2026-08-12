/// <reference types="vite/client" />
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence, disableNetwork } from 'firebase/firestore';

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
let isFirebaseFallback = true;
let fallbackReason = "";

const hasValidConfig = !!(firebaseConfig.apiKey && firebaseConfig.apiKey.startsWith('AIzaSy'));

if (hasValidConfig) {
  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    isFirebaseFallback = false; // ✅ 키가 있으면 일단 Live로 설정

    signInAnonymously(auth).catch((error: any) => {
      console.warn("Anonymous auth skipped or failed:", error);
    });
  } catch (error: any) {
    console.error("Firebase initialization failed:", error);
    isFirebaseFallback = true;
    fallbackReason = error?.message || String(error);
  }
} else {
  isFirebaseFallback = true;
  fallbackReason = "Missing or malformed VITE_FIREBASE_API_KEY";
}

if (isFirebaseFallback) {
  db = new Proxy({}, {
    get() {
      return () => { throw new Error(`Firebase not initialized: ${fallbackReason}`); };
    }
  });
  auth = {
    currentUser: null,
    onAuthStateChanged: (cb: any) => { if (typeof cb === 'function') cb(null); return () => {}; }
  };
}

export { db, auth, isFirebaseFallback, fallbackReason, firebaseConfig };