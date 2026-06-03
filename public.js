// public.js — Public Site Logic (Bug-Free Version)
// ================================================

/* ===== MOD DOWNLOAD LINK CONFIGURATION =====
 * EDIT HERE: Add your direct APK download URLs.
 * These OVERRIDE Firestore links when the app ID matches.
 * Format: 'app-id': 'https://your-cdn.com/file.apk'
 * ========================================== */
const MOD_LINK_OVERRIDES = {
    // Example: 'spotify-premium': 'https://example.com/spotify-mod.apk',
    // Add your links below:
};
/* ===== END MOD DOWNLOAD LINK CONFIGURATION ===== */

let appsData = [];
let currentUser = null;
let displayedCount = 12;
const ITEMS_PER_LOAD = 12;
let currentFilter = 'all';
let searchQuery = '';

/* ==========================================
   THEME TOGGLE — FIXED
   ========================================== */
function initTheme() {
    const toggle = document.getElementById('themeToggle');
    if (!toggle) return;

    const html = document.documentElement;
    const saved = localStorage.getItem('theme') || 'dark';
    html.setAttribute('data-theme', saved);
    updateThemeIcon(saved);

    toggle.addEventListener('click', () => {
        const isDark = html.getAttribute('data-theme') === 'dark';
        const newTheme = isDark ? 'light' : 'dark';
        html.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        // After switching, show the icon for the NEXT switch
        updateThemeIcon(newTheme);
    });
}

function updateThemeIcon(currentTheme) {
    const toggle = document.getElementById('themeToggle');
    if (!toggle) return;
    // If current is dark, show sun (click to switch to light)
    // If current is light, show moon (click to switch to dark)
    toggle.innerHTML = currentTheme === 'dark'
        ? '<i class="fas fa-sun"></i>'
        : '<i class="fas fa-moon"></i>';
}

/* ==========================================
   MOBILE MENU
   ========================================== */
function initMobileMenu() {
    const mobileToggle = document.getElementById('mobileToggle');
    const closeBtn = document.getElementById('closeMobileMenu');
    const overlay = document.getElementById('mobileMenuOverlay');
    const body = document.body;

    function open() { body.classList.add('mobile-menu-open'); }
    function close() { body.classList.remove('mobile-menu-open'); }

    if (mobileToggle) mobileToggle.addEventListener('click', open);
    if (closeBtn) closeBtn.addEventListener('click', close);
    if (overlay) overlay.addEventListener('click', close);

    document.querySelectorAll('.mobile-nav-links a').forEach(link => {
        link.addEventListener('click', close);
    });
}

/* ==========================================
   AUTH & ADMIN LINK
   ========================================== */
function initAuth() {
    if (typeof auth === 'undefined') {
        console.warn('[Public] Firebase Auth not loaded yet');
        return;
    }
    auth.onAuthStateChanged((user) => {
        currentUser = user;
        const isAdmin = user && user.email === 'jack1122@freelightmods.com';
        const adminLink = document.getElementById('adminLink');
        const mobileAdminLink = document.getElementById('mobileAdminLink');
        if (adminLink) adminLink.style.display = isAdmin ? 'inline-flex' : 'none';
        if (mobileAdminLink) mobileAdminLink.style.display = isAdmin ? 'flex' : 'none';
    });
}

/* ==========================================
   FIREBASE DATA LOADING
   ========================================== */
function waitForFirebase(callback, retries) {
    retries = retries || 30;
    if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
        callback();
    } else if (retries > 0) {
        setTimeout(() => waitForFirebase(callback, retries - 1), 200);
    } else {
        console.warn('[Public] Firebase not available. Using sample data.');
        loadSampleData();
    }
}

function loadAppsData() {
    const grid = document.getElementById('appGrid');
    if (!grid) return;

    waitForFirebase(() => {
        try {
            db.collection('apks').orderBy('dateAdded', 'desc').onSnapshot((snapshot) => {
                appsData = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    if (MOD_LINK_OVERRIDES[doc.id]) {
                        data.link = MOD_LINK_OVERRIDES[doc.id];
                    }
                    appsData.push({ id: doc.id, ...data });
                });
                displayedCount = ITEMS_PER_LOAD;
                renderGrid();
            }, (error) => {
                console.error('[Firestore] Error:', error);
                loadSampleData();
            });
        } catch (e) {
            console.error('[Public] Firestore error:', e);
            loadSampleData();
        }
    });
}

function loadSampleData() {
    appsData = [
        { id: 'spotify-premium', name: 'Spotify Premium', icon: 'fab fa-spotify', version: 'v8.9.18', size: '82 MB', mod: 'Unlocked', downloads: 15420, link: '#', category: 'app', image: '' },
        { id: 'youtube-premium', name: 'YouTube Premium', icon: 'fab fa-youtube', version: 'v18.45.41', size: '134 MB', mod: 'No Ads', downloads: 28750, link: '#', category: 'app', image: '' },
        { id: 'minecraft-mod', name: 'Minecraft Mod', icon: 'fas fa-cube', version: 'v1.20.0', size: '210 MB', mod: 'Unlimited Items', downloads: 8900, link: '#', category: 'game', image: '' }
    ];
    appsData.forEach(app => {
        if (MOD_LINK_OVERRIDES[app.id]) app.link = MOD_LINK_OVERRIDES[app.id];
    });
    displayedCount = ITEMS_PER_LOAD;
    renderGrid();
}

/* ==========================================
   GRID RENDERING (No inline onerror!)
   ========================================== */
function renderGrid() {
    const grid = document.getElementById('appGrid');
    if (!grid) return;
    grid.innerHTML = '';

    let filtered = getFilteredApps();

    if (filtered.length === 0) {
        grid.innerHTML = `<div class="no-results"><i class="fas fa-search"></i><h3>No mods found</h3><p>Try a different search or filter.</p></div>`;
        updateLoadMore(0);
        return;
    }

    const toShow = filtered.slice(0, displayedCount);
    const fragment = document.createDocumentFragment();

    toShow.forEach(app => {
        const card = buildAppCard(app);
        fragment.appendChild(card);
    });

    grid.appendChild(fragment);
    attachImageErrorHandlers(grid);
    updateLoadMore(filtered.length);
    updateStats(filtered.length);
}

function getFilteredApps() {
    let result = appsData;
    if (currentFilter !== 'all') {
        result = result.filter(a => (a.category || 'app') === currentFilter);
    }
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        result = result.filter(a =>
            (a.name || '').toLowerCase().includes(q) ||
            (a.mod || '').toLowerCase().includes(q) ||
            (a.version || '').toLowerCase().includes(q)
        );
    }
    return result;
}

function buildAppCard(app) {
    const card = document.createElement('div');
    card.className = 'app-card';
    card.setAttribute('data-id', app.id);
    card.setAttribute('data-category', app.category || 'app');

    // Build icon div separately (no inline onerror!)
    const iconDiv = document.createElement('div');
    iconDiv.className = 'app-icon';
    if (app.image && app.image.trim()) {
        const img = document.createElement('img');
        img.src = app.image;
        img.alt = app.name || 'App icon';
        img.loading = 'lazy';
        img.dataset.fallback = 'true';
        iconDiv.appendChild(img);
    } else {
        iconDiv.innerHTML = `<i class="${escapeHtml(app.icon || 'fas fa-mobile-alt')}"></i>`;
    }

    const downloadCount = app.downloads ? `<span><i class="fas fa-download"></i> ${formatNum(app.downloads)}</span>` : '';
    const modBadge = app.mod ? `<span><i class="fas fa-crown" style="color:#fbbf24"></i> ${escapeHtml(app.mod)}</span>` : '';

    const infoDiv = document.createElement('div');
    infoDiv.className = 'app-info';
    infoDiv.innerHTML = `
        <h3>${escapeHtml(app.name)}</h3>
        <div class="app-meta">
            <span><i class="fas fa-code-branch"></i> ${escapeHtml(app.version || 'v1.0')}</span>
            <span><i class="fas fa-weight-hanging"></i> ${escapeHtml(app.size || 'N/A')}</span>
        </div>
        <div class="app-meta" style="margin-top:4px">${modBadge}</div>
        <div class="app-meta">${downloadCount}</div>
    `;

    const btn = document.createElement('div');
    btn.className = 'download-btn';
    btn.setAttribute('data-id', app.id);
    btn.setAttribute('data-name', app.name || '');
    btn.setAttribute('data-link', app.link || '#');
    btn.innerHTML = '<i class="fas fa-download"></i> Download APK';

    card.appendChild(iconDiv);
    card.appendChild(infoDiv);
    card.appendChild(btn);

    return card;
}

/* ==========================================
   IMAGE ERROR HANDLING (Safe, no inline JS)
   ========================================== */
function attachImageErrorHandlers(container) {
    if (!container) return;
    container.querySelectorAll('img[data-fallback]').forEach(img => {
        img.addEventListener('error', function handleImgError() {
            this.removeEventListener('error', handleImgError);
            const parent = this.parentElement;
            if (parent) parent.innerHTML = '<i class="fas fa-mobile-alt"></i>';
        });
    });
}

/* ==========================================
   EVENT DELEGATION (Download buttons only)
   ========================================== */
function initEventDelegation() {
    const grid = document.getElementById('appGrid');
    if (!grid) return;

    grid.addEventListener('click', (e) => {
        const btn = e.target.closest('.download-btn');
        if (!btn) return;

        const id = btn.getAttribute('data-id');
        const link = btn.getAttribute('data-link');
        const name = btn.getAttribute('data-name');

        // Increment download count
        if (id && typeof db !== 'undefined') {
            db.collection('apks').doc(id).update({
                downloads: firebase.firestore.FieldValue.increment(1)
            }).catch(() => {});
        }

        // Open link in new tab (ONLY the download button does this)
        if (link && link !== '#' && link.startsWith('http')) {
            const a = document.createElement('a');
            a.href = link;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } else {
            alert(`Download link for "${escapeHtml(name)}" is not set yet.\n\nEdit MOD_LINK_OVERRIDES in public.js to add the URL.`);
        }
    });
}

/* ==========================================
   SEARCH & FILTER
   ========================================== */
function initSearch() {
    const input = document.getElementById('searchInput');
    const clearBtn = document.getElementById('clearSearch');
    const filterTags = document.getElementById('filterTags');

    if (!input) return;

    let debounceTimer;
    input.addEventListener('input', () => {
        searchQuery = input.value.trim();
        if (clearBtn) clearBtn.classList.toggle('visible', searchQuery.length > 0);
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            displayedCount = ITEMS_PER_LOAD;
            renderGrid();
        }, 150);
    });

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            input.value = '';
            searchQuery = '';
            clearBtn.classList.remove('visible');
            displayedCount = ITEMS_PER_LOAD;
            renderGrid();
        });
    }

    if (filterTags) {
        filterTags.addEventListener('click', (e) => {
            const tag = e.target.closest('.filter-tag');
            if (!tag) return;
            filterTags.querySelectorAll('.filter-tag').forEach(t => t.classList.remove('active'));
            tag.classList.add('active');
            currentFilter = tag.getAttribute('data-filter') || 'all';
            displayedCount = ITEMS_PER_LOAD;
            renderGrid();
        });
    }
}

function initLoadMore() {
    const btn = document.getElementById('loadMoreBtn');
    if (!btn) return;
    btn.addEventListener('click', () => {
        displayedCount += ITEMS_PER_LOAD;
        renderGrid();
    });
}

function updateLoadMore(total) {
    const wrap = document.getElementById('loadMoreWrap');
    if (!wrap) return;
    wrap.style.display = (displayedCount < total) ? 'block' : 'none';
}

function updateStats(count) {
    const el = document.getElementById('totalModsCount');
    if (el) el.textContent = count + '+';
}

/* ==========================================
   AI ASSISTANT — FIXED
   ========================================== */
function initAI() {
    const aiToggle = document.getElementById('aiToggle');
    const aiChat = document.getElementById('aiChatWindow');
    const aiClose = document.getElementById('aiClose');
    const aiSend = document.getElementById('aiSend');
    const aiInput = document.getElementById('aiInput');

    if (!aiToggle || !aiChat) {
        console.warn('[AI] Toggle or chat window not found');
        return;
    }

    aiToggle.addEventListener('click', () => {
        aiChat.style.display = 'block';
        aiToggle.style.display = 'none';
        if (aiInput) aiInput.focus();
    });

    if (aiClose) {
        aiClose.addEventListener('click', () => {
            aiChat.style.display = 'none';
            aiToggle.style.display = 'flex';
        });
    }

    if (aiSend) aiSend.addEventListener('click', sendAI);
    if (aiInput) {
        aiInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendAI();
        });
    }
}

function sendAI() {
    const input = document.getElementById('aiInput');
    const msg = input ? input.value.trim() : '';
    if (!msg) return;

    addAIMessage(msg, 'user');
    if (input) input.value = '';

    const typingId = showTypingIndicator();
    setTimeout(() => {
        removeTypingIndicator(typingId);
        addAIMessage(getAIResponse(msg), 'bot');
    }, 800 + Math.random() * 400);
}

function addAIMessage(text, type) {
    const box = document.getElementById('aiMessages');
    if (!box) return;
    const div = document.createElement('div');
    div.className = 'ai-message ' + type;
    div.innerHTML = type === 'bot'
        ? '<i class="fas fa-robot"></i><div>' + escapeHtml(text) + '</div>'
        : '<div>' + escapeHtml(text) + '</div>';
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}

function showTypingIndicator() {
    const box = document.getElementById('aiMessages');
    const id = 'typing-' + Date.now();
    const div = document.createElement('div');
    div.id = id;
    div.className = 'ai-message bot';
    div.innerHTML = '<i class="fas fa-robot"></i><div class="typing-indicator"><span></span><span></span><span></span></div>';
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
    return id;
}

function removeTypingIndicator(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

function getAIResponse(q) {
    const l = q.toLowerCase();
    if (l.includes('download') || l.includes('install')) return 'Tap "Download APK" and enable "Unknown Sources" in Android settings. If a link is missing, the admin has not set it yet.';
    if (l.includes('safe') || l.includes('virus') || l.includes('secure')) return 'All mods are scanned and verified before publishing. We never upload malware.';
    if (l.includes('admin')) return 'Press the "A" key 5 times rapidly on your keyboard for secret admin access.';
    if (l.includes('free') || l.includes('price') || l.includes('cost')) return '100% free. No hidden fees, no subscriptions.';
    if (l.includes('update') || l.includes('new')) return 'We update daily. Check back often or bookmark the site!';
    if (l.includes('link') || l.includes('url') || l.includes('broken')) return 'If a download link is broken, the admin needs to update the URL in the admin panel.';
    return 'I am here to help! Ask about installing, downloading, or finding specific apps.';
}

/* ==========================================
   UTILITIES
   ========================================== */
function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatNum(n) {
    if (!n) return '0';
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
}

/* ==========================================
   SECRET ADMIN ACCESS
   ========================================== */
let aCount = 0;
document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'a') {
        aCount++;
        clearTimeout(window._aT);
        window._aT = setTimeout(() => aCount = 0, 2000);
        if (aCount >= 5) window.location.href = 'admin.html';
    }
});

/* ==========================================
   YEAR UPDATE
   ========================================== */
function updateYear() {
    const year = new Date().getFullYear();
    document.querySelectorAll('#currentYear, #footerYear').forEach(el => {
        if (el) el.textContent = year;
    });
}

/* ==========================================
   BOOT
   ========================================== */
document.addEventListener('DOMContentLoaded', () => {
    updateYear();
    initTheme();
    initMobileMenu();
    initAuth();
    initSearch();
    initLoadMore();
    initEventDelegation();
    initAI();
    loadAppsData();
});
