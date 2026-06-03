// apps-data.js — SHARED APP DATA
// ==========================================
// EDIT THIS FILE to add/update/remove apps.
// Both index.html and download.html read from here.
// ==========================================

const appsData = [
    {
        id: "minecraft",
        name: "Minecraft",
        version: "v1.20.0",
        size: "210 MB",
        mod: "Unlimited Items",
        icon: "fas fa-cube",
        image: "",
        category: "game",
        // ===== EDIT YOUR DOWNLOAD LINK BELOW =====
        link: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"
        // Replace ^ with your real link, e.g.:
        // link: "https://cdn.yourhost.com/minecraft-v1.20.0.apk"
    },
    {
        id: "youtube-premium",
        name: "YouTube Premium",
        version: "v18.45.41",
        size: "134 MB",
        mod: "No Ads",
        icon: "fab fa-youtube",
        image: "",
        category: "app",
        // ===== EDIT YOUR DOWNLOAD LINK BELOW =====
        link: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"
        // Replace ^ with your real link
    },
    {
        id: "spotify-premium",
        name: "Spotify Premium",
        version: "v8.9.18",
        size: "82 MB",
        mod: "Unlocked",
        icon: "fab fa-spotify",
        image: "",
        category: "app",
        // ===== EDIT YOUR DOWNLOAD LINK BELOW =====
        link: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"
        // Replace ^ with your real link
    }
];

// Helper: get app by ID
function getAppById(id) {
    return appsData.find(a => a.id === id) || null;
}
