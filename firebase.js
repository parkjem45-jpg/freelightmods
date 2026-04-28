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

// Initialize Firebase (Compat mode for seamless global access)
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

// Default Admin Seeder (Run ONLY if admins collection is empty)
async function ensureDefaultAdmin() {
  const adminEmail = 'jack1122@freelightmods.com';
  const adminPassword = 'Jack6767@@'; // ⚠️ CHANGE THIS IN FIREBASE CONSOLE
  
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      try {
        await auth.signInWithEmailAndPassword(adminEmail, adminPassword);
        console.log('✅ Admin signed in');
      } catch (e) {
        if (e.code === 'auth/user-not-found') {
          try {
            const cred = await auth.createUserWithEmailAndPassword(adminEmail, adminPassword);
            await db.collection('admins').doc(cred.user.uid).set({
              email: adminEmail, role: 'super_admin', createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log('✅ Default admin created');
          } catch (err) { console.error('Seeder error:', err); }
        }
      }
    }
  });
}

// Run seeder
setTimeout(ensureDefaultAdmin, 1000);
console.log('🔥 Firebase Initialized');