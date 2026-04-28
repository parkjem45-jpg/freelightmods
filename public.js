// public.js
let appsData = [];
let currentUser = null;

// Theme Toggle
const themeToggle = document.getElementById('themeToggle');
if (themeToggle) {
    const html = document.documentElement;
    const saved = localStorage.getItem('theme') || 'dark';
    html.setAttribute('data-theme', saved);
    themeToggle.innerHTML = saved === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    
    themeToggle.addEventListener('click', () => {
        const isDark = html.getAttribute('data-theme') === 'dark';
        html.setAttribute('data-theme', isDark ? 'light' : 'dark');
        localStorage.setItem('theme', isDark ? 'light' : 'dark');
        themeToggle.innerHTML = isDark ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
    });
}

// Mobile Menu Logic
const mobileToggle = document.getElementById('mobileToggle');
const closeMobileMenu = document.getElementById('closeMobileMenu');
const mobileMenuSidebar = document.getElementById('mobileMenuSidebar');
const mobileMenuOverlay = document.getElementById('mobileMenuOverlay');
const body = document.body;

function openMobileMenu() { body.classList.add('mobile-menu-open'); }
function closeMobileMenuFunc() { body.classList.remove('mobile-menu-open'); }

if (mobileToggle) mobileToggle.addEventListener('click', openMobileMenu);
if (closeMobileMenu) closeMobileMenu.addEventListener('click', closeMobileMenuFunc);
if (mobileMenuOverlay) mobileMenuOverlay.addEventListener('click', closeMobileMenuFunc);

// Close menu when clicking a link inside it
document.querySelectorAll('.mobile-nav-links a').forEach(link => {
    link.addEventListener('click', closeMobileMenuFunc);
});

// Auth Observer & Admin Link
if (typeof auth !== 'undefined') {
    auth.onAuthStateChanged((user) => {
        currentUser = user;
        const adminLink = document.getElementById('adminLink');
        const mobileAdminLink = document.getElementById('mobileAdminLink');
        const isVisible = user && (user.email === 'jack1122@freelightmods.com');
        
        if (adminLink) adminLink.style.display = isVisible ? 'inline-flex' : 'none';
        if (mobileAdminLink) mobileAdminLink.style.display = isVisible ? 'flex' : 'none';
    });
}

// Realtime Data Loader
async function loadAppsData() {
    const grid = document.getElementById('appGrid');
    if (!grid) return;

    try {
        if (typeof db !== 'undefined') {
            db.collection('apks').orderBy('dateAdded', 'desc').onSnapshot((snapshot) => {
                appsData = [];
                snapshot.forEach(doc => appsData.push({ id: doc.id, ...doc.data() }));
                renderGrid(grid);
            }, (error) => {
                console.error("Firestore error:", error);
                loadSampleData(grid);
            });
        } else {
            loadSampleData(grid);
        }
    } catch (e) {
        console.error("Load error:", e);
        loadSampleData(grid);
    }
}

function loadSampleData(grid) {
    // Fallback sample data if Firebase fails
    appsData = [
        { id: '1', name: 'Spotify Premium', icon: 'fab fa-spotify', version: 'v8.9.18', size: '82 MB', mod: 'Unlocked', downloads: 15420, link: '#', image: '' },
        { id: '2', name: 'YouTube Premium', icon: 'fab fa-youtube', version: 'v18.45.41', size: '134 MB', mod: 'No Ads', downloads: 28750, link: '#', image: '' }
    ];
    renderGrid(grid);
}

function renderGrid(grid) {
    grid.innerHTML = '';
    if (appsData.length === 0) {
        grid.innerHTML = `<div class="loading-state"><i class="fas fa-cloud"></i><br>No APKs found</div>`;
        return;
    }

    appsData.slice(0, 12).forEach(app => {
        const card = document.createElement('div');
        card.className = 'app-card';
        const iconHtml = app.image 
            ? `<img src="${app.image}" alt="${app.name}" onerror="this.parentElement.innerHTML='<i class=\\'fas fa-mobile-alt\\'></i>'">`
            : `<i class="${app.icon || 'fas fa-mobile-alt'}"></i>`;
        
        card.innerHTML = `
            <div class="app-icon">${iconHtml}</div>
            <div class="app-info">
                <h3>${app.name}</h3>
                <div class="app-meta">
                    <span><i class="fas fa-code-branch"></i> ${app.version || 'v1.0'}</span>
                    <span><i class="fas fa-weight-hanging"></i> ${app.size || 'N/A'}</span>
                </div>
                <div class="app-meta" style="margin-top:4px">
                    <span><i class="fas fa-crown" style="color:#fbbf24"></i> ${app.mod || 'Pro Mod'}</span>
                </div>
                ${app.downloads ? `<div class="app-meta"><span><i class="fas fa-download"></i> ${formatNum(app.downloads)}</span></div>` : ''}
            </div>
            <div class="download-btn" data-id="${app.id}" data-name="${app.name}" data-link="${app.link || '#'}">
                <i class="fas fa-download"></i> Download APK
            </div>
        `;
        grid.appendChild(card);
    });

    // Attach click listeners
    document.querySelectorAll('.download-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const link = btn.dataset.link;
            const id = btn.dataset.id;
            if (id && typeof db !== 'undefined') {
                db.collection('apks').doc(id).update({ downloads: firebase.firestore.FieldValue.increment(1) }).catch(() => {});
            }
            if (link && link !== '#') window.open(link, '_blank');
            else alert('Download starting...');
        });
    });

    document.getElementById('totalModsCount').textContent = appsData.length + '+';
}

// AI Assistant Logic
const aiToggle = document.getElementById('aiToggle');
const aiChat = document.getElementById('aiChatWindow');
if (aiToggle && aiChat) {
    aiToggle.addEventListener('click', () => { 
        aiChat.style.display = 'block'; 
        aiToggle.style.display = 'none'; 
    });
    document.getElementById('aiClose')?.addEventListener('click', () => { 
        aiChat.style.display = 'none'; 
        aiToggle.style.display = 'flex'; 
    });
    
    document.getElementById('aiSend').addEventListener('click', sendAI);
    document.getElementById('aiInput').addEventListener('keypress', e => e.key === 'Enter' && sendAI());
}

function sendAI() {
    const input = document.getElementById('aiInput');
    const msg = input.value.trim();
    if (!msg) return;
    addAI(msg, 'user');
    input.value = '';
    const id = showTyping();
    setTimeout(() => {
        document.getElementById(id)?.remove();
        addAI(getResponse(msg), 'bot');
    }, 800 + Math.random() * 500);
}

function addAI(text, type) {
    const div = document.createElement('div');
    div.className = `ai-message ${type}`;
    div.innerHTML = type === 'bot' ? `<i class="fas fa-robot"></i><div>${text}</div>` : `<div>${text}</div>`;
    const box = document.getElementById('aiMessages');
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}

function showTyping() {
    const id = 't-' + Date.now();
    const div = document.createElement('div');
    div.id = id; div.className = 'ai-message bot';
    div.innerHTML = `<i class="fas fa-robot"></i><div class="typing-indicator"><span></span><span></span><span></span></div>`;
    document.getElementById('aiMessages').appendChild(div);
    return id;
}

function getResponse(q) {
    const l = q.toLowerCase();
    if (l.includes('download') || l.includes('install')) return 'Tap "Download APK" and enable "Unknown Sources" in Android settings.';
    if (l.includes('safe') || l.includes('virus')) return 'All mods are scanned & verified before publishing.';
    if (l.includes('admin')) return 'Press "A" 5 times on keyboard for secret access.';
    if (l.includes('free')) return '100% free. No hidden fees.';
    if (l.includes('update')) return 'We update daily. Check back often!';
    return 'I\'m here to help! Ask about installing, downloading, or finding specific apps.';
}

// Secret Admin Access
let aCount = 0;
document.addEventListener('keydown', e => {
    if (e.key.toLowerCase() === 'a') {
        aCount++; clearTimeout(window._aT);
        window._aT = setTimeout(() => aCount = 0, 2000);
        if (aCount >= 5) window.location.href = 'admin.html';
    }
});

function formatNum(n) {
    if (n >= 1e6) return (n/1e6).toFixed(1)+'M';
    if (n >= 1e3) return (n/1e3).toFixed(1)+'K';
    return n;
}

document.addEventListener('DOMContentLoaded', loadAppsData);