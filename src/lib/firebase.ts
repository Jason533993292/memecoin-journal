import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { getFirestore } from "firebase/firestore";
import {
  getAuth,
  GoogleAuthProvider,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDS2Rj1M0Jekub0uiUq_gjY0vylYvlmTa4",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "memecoin-journal.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "memecoin-journal",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "memecoin-journal.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "748290550330",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:748290550330:web:04a33a9a36541e0f062303",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-H01LY0XBPG"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const appCheckSiteKey = process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY?.trim();

// App Check stays inactive until the public reCAPTCHA Enterprise site key is
// configured. Monitor its metrics before enabling enforcement in Firebase.
if (typeof window !== "undefined" && appCheckSiteKey) {
  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (error: unknown) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code !== "appCheck/already-initialized") {
      console.warn("Firebase App Check could not initialize.");
    }
  }
}

const db = getFirestore(app);
const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();

export {
  app,
  db,
  auth,
  googleProvider,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  type User,
};
