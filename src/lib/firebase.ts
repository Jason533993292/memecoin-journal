import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDS2Rj1M0Jekub0uiUq_gjY0vylYvlmTa4",
  authDomain: "memecoin-journal.firebaseapp.com",
  projectId: "memecoin-journal",
  storageBucket: "memecoin-journal.firebasestorage.app",
  messagingSenderId: "748290550330",
  appId: "1:748290550330:web:04a33a9a36541e0f062303",
  measurementId: "G-H01LY0XBPG"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

export { app, db };
