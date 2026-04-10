// Import Firebase modules (using CDN in HTML)
// This file assumes Firebase is already loaded via script tags

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB0LrQcsXD-prcam7s3O1iEJbIvcPthlgo",
  authDomain: "freelightmods.firebaseapp.com",
  projectId: "freelightmods",
  storageBucket: "freelightmods.firebasestorage.app",
  messagingSenderId: "515712275200",
  appId: "1:515712275200:web:bd76d1badb0f158fa699e5",
  measurementId: "G-MT7QJW5YF7"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize services
const auth = firebase.auth();
const db = firebase.firestore();
const analytics = firebase.analytics();

// Enable persistence for offline support
db.enablePersistence()
  .catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
    } else if (err.code === 'unimplemented') {
      console.warn('Browser doesn\'t support persistence');
    }
  });

// Export for use in other scripts (they'll use global variables)
console.log('Firebase initialized');