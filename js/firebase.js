// ===== Firebase Configuration & Initialization =====
// Using Firebase Compat (namespaced) SDK

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

// Enable offline persistence
db.enablePersistence({ synchronizeTabs: true })
  .catch((err) => {
    if (err.code === 'failed-precondition') {
      console.log('Multiple tabs open, persistence enabled in first tab only');
    } else if (err.code === 'unimplemented') {
      console.log('Browser doesn\'t support persistence');
    }
  });

// Create default admin account if doesn't exist
async function ensureAdminAccount() {
  const adminEmail = 'jack1122@freelightmods.com';
  const adminPassword = 'Jack6767@@';
  
  try {
    await auth.signInWithEmailAndPassword(adminEmail, adminPassword);
    console.log('✅ Admin account exists');
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      try {
        const userCredential = await auth.createUserWithEmailAndPassword(adminEmail, adminPassword);
        console.log('✅ Admin account created:', adminEmail);
        const user = userCredential.user;
        if (user) {
          await db.collection('admins').doc(user.uid).set({
            email: adminEmail,
            role: 'super_admin',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        }
      } catch (createError) {
        console.error('Failed to create admin:', createError);
      }
    } else {
      console.log('Admin check:', error.message);
    }
  }
}

// Run admin account check after a short delay
setTimeout(() => {
  ensureAdminAccount();
}, 1000);

// Expose auth and db globally
window.auth = auth;
window.db = db;
console.log('🔥 Firebase initialized successfully');