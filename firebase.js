// ===== Firebase Configuration & Initialization =====
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
    // Try to sign in
    await auth.signInWithEmailAndPassword(adminEmail, adminPassword);
    console.log('✅ Admin account exists');
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      // Create admin account
      try {
        await auth.createUserWithEmailAndPassword(adminEmail, adminPassword);
        console.log('✅ Admin account created:', adminEmail);
        
        // Add admin document to Firestore
        const user = auth.currentUser;
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

// Run admin account check
setTimeout(() => {
  ensureAdminAccount();
}, 1000);

// Export for global use
window.db = db;
window.auth = auth;

console.log('🔥 Firebase initialized successfully');