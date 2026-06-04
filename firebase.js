// firebase.js — Firebase Configuration & Initialization
// ⚠️ Keep this file safe. The API key is public by design for web apps.

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
  console.log('[Firebase] App initialized successfully');
} catch (e) {
  if (!/already exists/.test(e.message)) {
    console.error("[Firebase] Init failed:", e);
  }
}

const db = firebase.firestore();
const auth = firebase.auth();

// Storage — ONLY initialize if the Storage SDK script is actually loaded
let storage = null;
try {
  if (typeof firebase.storage === 'function') {
    storage = firebase.storage();
    console.log('[Firebase] Storage initialized');
  } else {
    console.warn('[Firebase] Storage SDK not loaded. If you need uploads, add: <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-storage-compat.js"></script>');
  }
} catch (e) {
  console.warn('[Firebase] Storage init failed:', e);
}

// Analytics with error handling
try {
  firebase.analytics();
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

console.log('[Firebase] Core services ready (Auth + Firestore)');

// ============================================
// STORAGE UPLOAD FUNCTIONS
// ============================================

const BUCKET = "termux-bucket";

async function uploadTextFile(content, customFilename = null) {
    if (!storage) {
        console.error("[Firebase] Storage not available. Include firebase-storage-compat.js");
        return { success: false, error: "Storage SDK not loaded" };
    }
    const timestamp = Math.floor(Date.now() / 1000);
    const filename = customFilename || `termux_${timestamp}.txt`;
    const fullPath = `${BUCKET}/${filename}`;
    
    console.log("╔═══════════════════════════════════════╗");
    console.log("║     📤 UPLOADING TO FIREBASE          ║");
    console.log("╚═══════════════════════════════════════╝");
    console.log(`📤 Uploading ${filename}...`);
    
    try {
        if (!auth.currentUser) {
            await auth.signInAnonymously();
        }
        
        const storageRef = storage.ref(fullPath);
        await storageRef.putString(content);
        const downloadURL = await storageRef.getDownloadURL();
        
        console.log("✅ Upload successful!\n");
        console.log("🔗 Public URL:");
        console.log(downloadURL);
        
        return { 
            success: true, 
            url: downloadURL, 
            filename: filename,
            path: fullPath
        };
    } catch (error) {
        console.error("❌ Upload failed:", error.message);
        return { success: false, error: error.message };
    }
}

async function uploadFile(file, customFilename = null) {
    if (!storage) {
        return { success: false, error: "Storage SDK not loaded" };
    }
    const timestamp = Math.floor(Date.now() / 1000);
    const filename = customFilename || `${timestamp}_${file.name}`;
    const fullPath = `${BUCKET}/${filename}`;
    
    console.log(`📤 Uploading ${filename}...`);
    
    try {
        if (!auth.currentUser) {
            await auth.signInAnonymously();
        }
        
        const storageRef = storage.ref(fullPath);
        await storageRef.put(file);
        const downloadURL = await storageRef.getDownloadURL();
        
        console.log("✅ Upload successful!");
        console.log("🔗 URL:", downloadURL);
        
        return { 
            success: true, 
            url: downloadURL, 
            filename: filename,
            path: fullPath
        };
    } catch (error) {
        console.error("❌ Upload failed:", error.message);
        return { success: false, error: error.message };
    }
}

async function listFiles() {
    if (!storage) {
        return { success: false, error: "Storage SDK not loaded" };
    }
    try {
        if (!auth.currentUser) {
            await auth.signInAnonymously();
        }
        
        const listRef = storage.ref(BUCKET);
        const result = await listRef.listAll();
        
        const files = await Promise.all(result.items.map(async (itemRef) => {
            const url = await itemRef.getDownloadURL();
            return {
                name: itemRef.name,
                fullPath: itemRef.fullPath,
                url: url
            };
        }));
        
        console.log(`📁 Found ${files.length} files:`);
        files.forEach(f => console.log(`  - ${f.name}`));
        
        return { success: true, files: files };
    } catch (error) {
        console.error("Failed to list files:", error.message);
        return { success: false, error: error.message };
    }
}

async function quickTest() {
    const content = `Test upload from browser at ${new Date().toISOString()}\nFirebase Storage Test`;
    const result = await uploadTextFile(content);
    
    if (result.success) {
        alert(`✅ Upload successful!\n\n🔗 URL: ${result.url}`);
    } else {
        alert(`❌ Upload failed: ${result.error}`);
    }
    
    return result;
}

window.uploadTextFile = uploadTextFile;
window.uploadFile = uploadFile;
window.quickTest = quickTest;
window.listFiles = listFiles;