// firebase.js — Firebase Configuration & Initialization
// ⚠️ SECURITY NOTE: Replace these keys with your own Firebase project settings.
// These are hardcoded for your project: freelightmods

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyD4Gr3EoTEzgLVY9OC2iEiG5iRptBgZaZc",
  authDomain: "flmods.firebaseapp.com",
  projectId: "flmods",
  storageBucket: "flmods.firebasestorage.app",
  messagingSenderId: "831938140949",
  appId: "1:831938140949:web:dfc732cf77acf3a68a671c",
  measurementId: "G-VBMTJE38LM"
};

// Initialize Firebase (Compat mode)
try {
  firebase.initializeApp(firebaseConfig);
} catch (e) {
  if (!/already exists/.test(e.message)) console.error("Firebase init failed:", e);
}

const db = firebase.firestore();
const auth = firebase.auth();

// Analytics with error handling
try {
  const analytics = firebase.analytics();
} catch (e) {
  console.warn('[Firebase] Analytics not available:', e);
}

// Enable offline persistence for better performance
try {
  db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('[Firebase] Persistence blocked: multiple tabs open.');
    } else if (err.code === 'unimplemented') {
      console.warn('[Firebase] Persistence not supported in this browser.');
    }
  });
} catch (e) {
  console.warn('[Firebase] Persistence enablement failed:', e);
}

console.log('[Firebase] Initialized successfully');
