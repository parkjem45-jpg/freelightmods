// ============================================
// Free Lite Mods - Firebase Configuration
// Auth Only - Data stored locally
// ============================================

const firebaseConfig = {
  apiKey: "AIzaSyD4Gr3EoTEzgLVY9OC2iEiG5iRptBgZaZc",
  authDomain: "flmods.firebaseapp.com",
  projectId: "flmods",
  storageBucket: "flmods.firebasestorage.app",
  messagingSenderId: "831938140949",
  appId: "1:831938140949:web:dfc732cf77acf3a68a671c",
  measurementId: "G-VBMTJE38LM"
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = null; // No Firestore

// ============================================
// Admin Emails
// ============================================
const ADMIN_EMAILS = [
  'zerryfun@gmail.com',
];

// ============================================
// Sample Apps Data
// ============================================
const DEFAULT_APPS = [
  { id: '1', name: 'Spotify Premium', icon: 'fab fa-spotify', version: 'v8.9.18', size: '82 MB', mod: 'Unlocked Premium, No Ads', downloads: 15420, link: 'https://example.com/spotify.apk', category: 'app', image: '', dateAdded: new Date().toISOString() },
  { id: '2', name: 'YouTube Premium', icon: 'fab fa-youtube', version: 'v18.45.41', size: '134 MB', mod: 'No Ads, Background Play', downloads: 28750, link: 'https://example.com/youtube.apk', category: 'app', image: '', dateAdded: new Date().toISOString() },
  { id: '3', name: 'Minecraft Modded', icon: 'fas fa-cube', version: 'v1.20.81', size: '720 MB', mod: 'Unlocked All, God Mode', downloads: 35200, link: 'https://example.com/minecraft.apk', category: 'game', image: '', dateAdded: new Date().toISOString() },
  { id: '4', name: 'Instagram Pro', icon: 'fab fa-instagram', version: 'v312.0.0', size: '67 MB', mod: 'Download Media, No Ads', downloads: 19800, link: 'https://example.com/instagram.apk', category: 'app', image: '', dateAdded: new Date().toISOString() },
  { id: '5', name: 'CapCut Pro', icon: 'fas fa-video', version: 'v11.5.0', size: '210 MB', mod: 'No Watermark, Pro Features', downloads: 22400, link: 'https://example.com/capcut.apk', category: 'app', image: '', dateAdded: new Date().toISOString() },
  { id: '6', name: 'Netflix Premium', icon: 'fas fa-film', version: 'v8.106.0', size: '98 MB', mod: '4K HDR, All Regions', downloads: 12300, link: 'https://example.com/netflix.apk', category: 'app', image: '', dateAdded: new Date().toISOString() },
  { id: '7', name: 'PUBG Mobile Mod', icon: 'fas fa-person-rifle', version: 'v3.0.0', size: '1.2 GB', mod: 'Aimbot, Wallhack', downloads: 41000, link: 'https://example.com/pubg.apk', category: 'game', image: '', dateAdded: new Date().toISOString() },
  { id: '8', name: 'Snapchat Plus', icon: 'fab fa-snapchat', version: 'v12.70.0', size: '95 MB', mod: 'Screenshot Privacy', downloads: 8900, link: 'https://example.com/snapchat.apk', category: 'app', image: '', dateAdded: new Date().toISOString() }
];

// Initialize localStorage
if (!localStorage.getItem('apkData')) {
  localStorage.setItem('apkData', JSON.stringify(DEFAULT_APPS));
}

// ============================================
// Expose Globals
// ============================================
window.auth = auth;
window.db = null;
window.ADMIN_EMAILS = ADMIN_EMAILS;
window.DEFAULT_APPS = DEFAULT_APPS;

console.log('🔥 FLMods Ready (Local Storage Mode)');
console.log('👤 Admin: zerryfun@gmail.com');