// public.js — Public Site Logic + Swiper Sliders + AI Images + AD SCRIPT INJECTION
// =======================================================================================

const MOD_LINK_OVERRIDES = {};
let appsData = [];
let currentUser = null;
let displayedCount = 12;
const ITEMS_PER_LOAD = 12;
let currentFilter = 'all';
let searchQuery = '';
let swiperInstances = {};

/* ==========================================
   THEME TOGGLE
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
        updateThemeIcon(newTheme);
    });
}

function updateThemeIcon(currentTheme) {
    const toggle = document.getElementById('themeToggle');
    if (!toggle) return;
    toggle.innerHTML = currentTheme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
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
    document.querySelectorAll('.mobile-nav-links a').forEach(link => link.addEventListener('click', close));
}

/* ==========================================
   AUTH & ADMIN LINK
   ========================================== */
function initAuth() {
    if (typeof supabase === 'undefined') {
        console.warn('[Public] Supabase not loaded yet');
        return;
    }
    supabase.auth.onAuthStateChange(async (event, session) => {
        const user = session?.user ?? null;
        currentUser = user;
        let isAdmin = false;
        if (user) {
            const { data } = await supabase.from('admins').select('id').eq('id', user.id).maybeSingle();
            isAdmin = !!data || user.email === 'jack1122@freelightmods.com';
        }
        const adminLink = document.getElementById('adminLink');
        const mobileAdminLink = document.getElementById('mobileAdminLink');
        if (adminLink) adminLink.style.display = isAdmin ? 'inline-flex' : 'none';
        if (mobileAdminLink) mobileAdminLink.style.display = isAdmin ? 'flex' : 'none';
    });
}

/* ==========================================
   DATA LOADING
   ========================================== */
function loadAppsData() {
    if (typeof supabase === 'undefined') {
        console.warn('[Public] Supabase not loaded');
        loadSampleData();
        return;
    }
    fetchAppsPublic();
    supabase.channel('public:apks')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'apks' }, () => {
            fetchAppsPublic();
        })
        .subscribe();
}

async function fetchAppsPublic() {
    const { data, error } = await supabase
        .from('apks')
        .select('*')
        .order('date_added', { ascending: false });
    if (error) {
        console.error('[Public] Fetch error:', error);
        loadSampleData();
        return;
    }
    appsData = (data || []).map(row => ({
        id: row.id,
        name: row.name,
        version: row.version,
        size: row.size,
        icon: row.icon,
        image: row.image,
        mod: row.mod,
        link: row.link || '',
        category: row.category || 'app',
        downloads: row.downloads || 0,
        fileExtension: row.file_extension || 'apk',
        sliderSection: row.slider_section,
        aspectRatio: row.aspect_ratio || '16:9',
        borderRadius: row.border_radius || '16px',
        borderStyle: row.border_style || 'none'
    }));
    displayedCount = ITEMS_PER_LOAD;
    renderGrid();
    loadSliders();
    renderHomeAds();
}

function loadSampleData() {
    appsData = [
        { id: 'spotify-premium', name: 'Spotify Premium', icon: 'fab fa-spotify', version: 'v8.9.18', size: '82 MB', mod: 'Unlocked', downloads: 15420, link: '#', category: 'app', image: '', fileExtension: 'apk' },
        { id: 'youtube-premium', name: 'YouTube Premium', icon: 'fab fa-youtube', version: 'v18.45.41', size: '134 MB', mod: 'No Ads', downloads: 28750, link: '#', category: 'app', image: '', fileExtension: 'apk' },
        { id: 'minecraft-mod', name: 'Minecraft Mod', icon: 'fas fa-cube', version: 'v1.20.0', size: '210 MB', mod: 'Unlimited Items', downloads: 8900, link: '#', category: 'game', image: '', fileExtension: 'apk' }
    ];
    appsData.forEach(app => { if (MOD_LINK_OVERRIDES[app.id]) app.link = MOD_LINK_OVERRIDES[app.id]; });
    displayedCount = ITEMS_PER_LOAD;
    renderGrid();
    loadSliders();
    renderHomeAds();
}

/* ==========================================
   ADS SYSTEM — Script Injection
   ========================================== */
function getAdSettings() {
    try {
        const stored = localStorage.getItem('flm_ad_settings');
        return stored ? JSON.parse(stored) : null;
    } catch (e) { return null; }
}

function injectAdCode(container, html) {
    if (!container || !html) return;
    container.innerHTML = '';
    try {
        const range = document.createRange();
        const fragment = range.createContextualFragment(html);
        container.appendChild(fragment);
    } catch (e) {
        console.error('[Ads] Injection failed:', e);
        container.innerHTML = '<div style="color:var(--accent-danger);padding:12px;text-align:center;">Ad failed to load</div>';
    }
}

function renderHomeAds() {
    const settings = getAdSettings();
    if (!settings) return;

    // Top ad (above hero)
    if (settings.homeTop && settings.homeTop.enabled && settings.homeTop.code) {
        const container = document.getElementById('adHomeTop');
        if (container) {
            container.style.display = 'flex';
            container.className = 'ad-container ad-home-top ad-size-' + (settings.homeTop.size || 'auto');
            injectAdCode(container, settings.homeTop.code);
        }
    } else {
        const container = document.getElementById('adHomeTop');
        if (container) { container.style.display = 'none'; container.innerHTML = ''; }
    }

    // Inline ad (inside grid) — handled by insertInlineAds after renderGrid
    insertInlineAds();
}

function insertInlineAds() {
    const settings = getAdSettings();
    if (!settings || !settings.homeInline || !settings.homeInline.enabled || !settings.homeInline.code) return;

    const grid = document.getElementById('appGrid');
    if (!grid) return;

    // Remove existing inline ads
    grid.querySelectorAll('.ad-inline-slot').forEach(el => el.remove());

    const adData = settings.homeInline;
    const position = parseInt(adData.position) || 6;
    const cards = grid.querySelectorAll('.app-card');

    if (cards.length >= position) {
        const adEl = document.createElement('div');
        adEl.className = 'ad-inline-slot ad-size-' + (adData.size || 'auto');
        const inner = document.createElement('div');
        inner.className = 'ad-inner';
        adEl.appendChild(inner);
        const targetIndex = position - 1;
        if (cards[targetIndex]) {
            cards[targetIndex].insertAdjacentElement('beforebegin', adEl);
            injectAdCode(inner, adData.code);
        }
    }
}

/* ==========================================
   SLIDERS (Swiper.js)
   ========================================== */
async function loadSliders() {
    if (typeof supabase === 'undefined') {
        console.warn('[Public] Supabase not loaded for sliders');
        return;
    }
    try {
        const { data, error } = await supabase
            .from('apks')
            .select('*')
            .in('slider_section', [1, 2, 3])
            .order('date_added', { ascending: false });

        if (error) throw error;

        const grouped = { 1: [], 2: [], 3: [] };
        (data || []).forEach(row => {
            if (grouped[row.slider_section]) grouped[row.slider_section].push(row);
        });

        renderSliderGroup(1, grouped[1]);
        renderSliderGroup(2, grouped[2]);
        renderSliderGroup(3, grouped[3]);
    } catch (err) {
        console.error('[Slider] Error:', err);
    }
}

function renderSliderGroup(section, items) {
    const wrapper = document.getElementById('sliderWrapper' + section);
    if (!wrapper) return;
    wrapper.innerHTML = '';

    if (!items || items.length === 0) {
        wrapper.innerHTML = '<div class="swiper-slide"><div class="slider-loading">No items yet. Add from Admin Panel.</div></div>';
        initSwiper(section, []);
        return;
    }

    items.forEach(app => {
        const slide = document.createElement('div');
        slide.className = 'swiper-slide';

        const ratio = app.aspect_ratio || '16:9';
        const radius = app.border_radius || '16px';
        const border = app.border_style || 'none';
        const ext = app.file_extension || 'apk';
        const isAuto = ratio === 'auto';

        const imgUrl = app.image && app.image.trim() ? app.image : '';

        let imageHtml = '';
        if (imgUrl) {
            if (isAuto) {
                imageHtml = '<img src="' + escapeHtml(imgUrl) + '" alt="' + escapeHtml(app.name) + '" loading="lazy" style="object-fit:contain;max-height:220px;width:auto;max-width:100%;" onerror="this.style.display=\'none\';this.parentElement.innerHTML=\'<i class=\\\'fas fa-image img-fallback\\\'></i>\';">';
            } else {
                imageHtml = '<img src="' + escapeHtml(imgUrl) + '" alt="' + escapeHtml(app.name) + '" loading="lazy" onerror="this.style.display=\'none\';this.parentElement.innerHTML=\'<i class=\\\'fas fa-image img-fallback\\\'></i>\';">';
            }
        } else {
            imageHtml = '<i class="fas fa-image img-fallback"></i>';
        }

        // FIXED: Use single-line string concatenation to avoid JS syntax errors
        slide.innerHTML = '<div class="slider-card" onclick="handleSliderDownload(\'' + escapeHtml(app.id) + '\')">' +
            '<div class="slider-image-wrap" data-ratio="' + escapeHtml(ratio) + '" style="--img-ratio:' + (isAuto ? 'auto' : ratio) + ';--img-radius:' + radius + ';--img-border:' + border + ';' + (isAuto ? 'min-height:160px;' : '') + '">' +
            imageHtml +
            '</div>' +
            '<div class="slider-content">' +
            '<h3>' + escapeHtml(app.name) + '</h3>' +
            '<p>' + escapeHtml(app.mod || app.category || 'Featured') + '</p>' +
            '<div class="slider-meta">' +
            '<span><i class="fas fa-code-branch"></i> ' + escapeHtml(app.version || 'v1.0') + '</span>' +
            '<span><i class="fas fa-weight-hanging"></i> ' + escapeHtml(app.size || 'N/A') + '</span>' +
            '<span><i class="fas fa-file"></i> .' + escapeHtml(ext) + '</span>' +
            '</div>' +
            '<button class="slider-btn"><i class="fas fa-download"></i> Download</button>' +
            '</div>' +
            '</div>';
        wrapper.appendChild(slide);
    });

    initSwiper(section, items);
}

function initSwiper(section, items) {
    const selector = '.swiper-slider-' + section;
    if (swiperInstances[section]) {
        swiperInstances[section].destroy(true, true);
    }

    const hasEnoughSlides = items.length >= 4;

    swiperInstances[section] = new Swiper(selector, {
        loop: hasEnoughSlides,
        autoplay: {
            delay: 3000 + (section * 800),
            disableOnInteraction: false,
            pauseOnMouseEnter: true
        },
        pagination: {
            el: '.swiper-pagination-' + section,
            clickable: true,
            dynamicBullets: true
        },
        navigation: {
            nextEl: '.swiper-btn-next-' + section,
            prevEl: '.swiper-btn-prev-' + section
        },
        breakpoints: {
            320: { slidesPerView: 1, spaceBetween: 16 },
            640: { slidesPerView: 2, spaceBetween: 20 },
            1024: { slidesPerView: 3, spaceBetween: 28 },
            1280: { slidesPerView: 4, spaceBetween: 28 }
        },
        grabCursor: true,
        centeredSlides: false,
        speed: 600
    });
}

window.handleSliderDownload = function(appId) {
    const url = new URL('download.html', window.location.href);
    url.searchParams.set('id', appId);
    window.open(url.toString(), '_blank');
};

/* ==========================================
   GRID RENDERING
   ========================================== */
function renderGrid() {
    const grid = document.getElementById('appGrid');
    if (!grid) return;
    grid.innerHTML = '';
    let filtered = getFilteredApps();
    if (filtered.length === 0) {
        grid.innerHTML = '<div class="no-results"><i class="fas fa-search"></i><h3>No mods found</h3><p>Try a different search or filter.</p></div>';
        updateLoadMore(0);
        return;
    }
    const toShow = filtered.slice(0, displayedCount);
    const fragment = document.createDocumentFragment();
    toShow.forEach(app => fragment.appendChild(buildAppCard(app)));
    grid.appendChild(fragment);
    attachImageErrorHandlers(grid);
    updateLoadMore(filtered.length);
    updateStats(filtered.length);
    // Re-insert inline ads after grid render
    insertInlineAds();
}

function getFilteredApps() {
    let result = appsData;
    if (currentFilter !== 'all') result = result.filter(a => (a.category || 'app') === currentFilter);
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
    card.style.cursor = 'pointer';

    const iconDiv = document.createElement('div');
    iconDiv.className = 'app-icon';
    if (app.image && app.image.trim()) {
        const img = document.createElement('img');
        img.src = app.image; img.alt = app.name || 'App icon'; img.loading = 'lazy'; img.dataset.fallback = 'true';
        iconDiv.appendChild(img);
    } else {
        iconDiv.innerHTML = '<i class="' + escapeHtml(app.icon || 'fas fa-mobile-alt') + '"></i>';
    }

    const downloadCount = app.downloads ? '<span><i class="fas fa-download"></i> ' + formatNum(app.downloads) + '</span>' : '';
    const modBadge = app.mod ? '<span><i class="fas fa-crown" style="color:#fbbf24"></i> ' + escapeHtml(app.mod) + '</span>' : '';

    // FIXED: Use single-line string concatenation
    const infoDiv = document.createElement('div');
    infoDiv.className = 'app-info';
    infoDiv.innerHTML = '<h3>' + escapeHtml(app.name) + '</h3>' +
        '<div class="app-meta">' +
        '<span><i class="fas fa-code-branch"></i> ' + escapeHtml(app.version || 'v1.0') + '</span>' +
        '<span><i class="fas fa-weight-hanging"></i> ' + escapeHtml(app.size || 'N/A') + '</span>' +
        '</div>' +
        '<div class="app-meta" style="margin-top:4px">' + modBadge + '</div>' +
        '<div class="app-meta">' + downloadCount + '</div>';

    const btn = document.createElement('div');
    btn.className = 'download-btn';
    btn.innerHTML = '<i class="fas fa-download"></i> Download';

    card.appendChild(iconDiv);
    card.appendChild(infoDiv);
    card.appendChild(btn);

    card.addEventListener('click', () => handleDownload(app));
    btn.addEventListener('click', (e) => { e.stopPropagation(); handleDownload(app); });

    return card;
}

/* ==========================================
   DOWNLOAD HANDLER
   ========================================== */
function handleDownload(app) {
    const url = new URL('download.html', window.location.href);
    url.searchParams.set('id', app.id);
    window.open(url.toString(), '_blank');
}

/* ==========================================
   IMAGE ERROR HANDLING
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
        debounceTimer = setTimeout(() => { displayedCount = ITEMS_PER_LOAD; renderGrid(); }, 150);
    });

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            input.value = ''; searchQuery = ''; clearBtn.classList.remove('visible');
            displayedCount = ITEMS_PER_LOAD; renderGrid();
        });
    }

    if (filterTags) {
        filterTags.addEventListener('click', (e) => {
            const tag = e.target.closest('.filter-tag');
            if (!tag) return;
            filterTags.querySelectorAll('.filter-tag').forEach(t => t.classList.remove('active'));
            tag.classList.add('active');
            currentFilter = tag.getAttribute('data-filter') || 'all';
            displayedCount = ITEMS_PER_LOAD; renderGrid();
        });
    }
}

function initLoadMore() {
    const btn = document.getElementById('loadMoreBtn');
    if (!btn) return;
    btn.addEventListener('click', () => { displayedCount += ITEMS_PER_LOAD; renderGrid(); });
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
   AI ASSISTANT
   ========================================== */
function initAI() {
    const aiToggle = document.getElementById('aiToggle');
    const aiChat = document.getElementById('aiChatWindow');
    const aiClose = document.getElementById('aiClose');
    const aiSend = document.getElementById('aiSend');
    const aiInput = document.getElementById('aiInput');
    if (!aiToggle || !aiChat) { console.warn('[AI] Toggle or chat window not found'); return; }

    aiToggle.addEventListener('click', () => {
        aiChat.style.display = 'block'; aiToggle.style.display = 'none';
        if (aiInput) aiInput.focus();
    });
    if (aiClose) aiClose.addEventListener('click', () => { aiChat.style.display = 'none'; aiToggle.style.display = 'flex'; });
    if (aiSend) aiSend.addEventListener('click', sendAI);
    if (aiInput) aiInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendAI(); });
}

function sendAI() {
    const input = document.getElementById('aiInput');
    const msg = input ? input.value.trim() : '';
    if (!msg) return;
    addAIMessage(msg, 'user');
    if (input) input.value = '';
    const typingId = showTypingIndicator();
    setTimeout(() => { removeTypingIndicator(typingId); addAIMessage(getAIResponse(msg), 'bot'); }, 800 + Math.random() * 400);
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
    div.id = id; div.className = 'ai-message bot';
    div.innerHTML = '<i class="fas fa-robot"></i><div class="typing-indicator"><span></span><span></span><span></span></div>';
    box.appendChild(div); box.scrollTop = box.scrollHeight;
    return id;
}

function removeTypingIndicator(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

function getAIResponse(q) {
    const l = q.toLowerCase();
    if (l.includes('download') || l.includes('install')) return 'Tap "Download" and enable "Unknown Sources" in Android settings. If a link is missing, the admin has not set it yet.';
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
    document.querySelectorAll('#currentYear, #footerYear').forEach(el => { if (el) el.textContent = year; });
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
    initAI();
    loadAppsData();
});