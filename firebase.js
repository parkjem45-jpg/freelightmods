// firebase-config.js
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
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
const analytics = firebase.analytics();

// Enable offline persistence safely
try {
  db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
    if (err.code === 'failed-precondition') console.warn('Persistence blocked by multiple tabs.');
    else if (err.code === 'unimplemented') console.warn('Persistence not supported.');
  });
} catch (e) {}

console.log('🔥 Firebase Initialized');