// firebase.js — Firebase Configuration & Initialization
// ⚠️ SECURITY NOTE: Replace these keys with your own Firebase project settings.
// These are hardcoded for your project: freelightmods

const firebaseConfig = {
  apiKey: "AIzaSyB0LrQcsXD-prcam7s3O1iEJbIvcPthlgo",
  authDomain: "freelightmods.firebaseapp.com",
  projectId: "freelightmods",
  storageBucket: "freelightmods.firebasestorage.app",
  messagingSenderId: "515712275200",
  appId: "1:515712275200:web:bd76d1badb0f158fa699e5",
  measurementId: "G-MT7QJW5YF7"
};

// Initialize Firebase (Compat mode)
try {
  firebase.initializeApp(firebaseConfig);
} catch (e) {
  if (!/already exists/.test(e.message)) console.error("Firebase init failed:", e);
}

const db = firebase.firestore();
const auth = firebase.auth();
const analytics = firebase.analytics();

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
