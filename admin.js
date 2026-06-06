// admin.js — FULLY FIXED (Edit saves all fields, no recursion) + ADS MANAGER (Supabase Sync)
// ==========================================================================================

const MOD_URL_TEMPLATES = {};
let appsData = [];
let currentUser = null;
let currentPage = 1;
const itemsPerPage = 15;
let searchDebounce = null;
let adminInitialized = false;
let sessionTimeout = null;
let inactivityTimer = null;

function getEl(id) { return document.getElementById(id); }

// Hardcoded admin emails (bypass RLS issues)
const ADMIN_EMAILS = ['parkjem45@gmail.com'];

/* ==========================================
   SUPABASE AD SYNC HELPERS
   ========================================== */
const AD_SETTINGS_BUCKET = 'termux-bucket';
const AD_SETTINGS_PATH = 'ad_settings.json';
const AD_SETTINGS_PUBLIC_URL = 'https://egexyoqnzhaygvcbsdyi.supabase.co/storage/v1/object/public/' + AD_SETTINGS_BUCKET + '/' + AD_SETTINGS_PATH;

async function uploadAdSettingsToSupabase(settings) {
    try {
        if (typeof supabase === 'undefined') {
            console.warn('[Ads] Supabase not available for upload');
            return false;
        }
        const json = JSON.stringify(settings);
        const blob = new Blob([json], { type: 'application/json' });
        const { error } = await supabase.storage
            .from(AD_SETTINGS_BUCKET)
            .upload(AD_SETTINGS_PATH, blob, {
                contentType: 'application/json',
                upsert: true
            });
        if (error) {
            console.warn('[Ads] Supabase upload error:', error);
            return false;
        }
        console.log('[Ads] Settings synced to Supabase successfully');
        return true;
    } catch (e) {
        console.warn('[Ads] Failed to upload to Supabase:', e);
        return false;
    }
}

async function fetchAdSettingsFromSupabase() {
    try {
        const url = AD_SETTINGS_PUBLIC_URL + '?t=' + Date.now();
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) {
            if (response.status === 404) {
                console.log('[Ads] No settings found on Supabase yet');
            }
            return null;
        }
        const data = await response.json();
        console.log('[Ads] Settings loaded from Supabase');
        return data;
    } catch (e) {
        console.warn('[Ads] Failed to fetch from Supabase:', e);
        return null;
    }
}

/* ==========================================
   SESSION MANAGEMENT
   ========================================== */
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;

function resetSessionTimer() {
    if (sessionTimeout) clearTimeout(sessionTimeout);
    if (inactivityTimer) clearTimeout(inactivityTimer);
    sessionTimeout = setTimeout(() => logoutDueToInactivity('Session expired.'), SESSION_TIMEOUT_MS);
    inactivityTimer = setTimeout(() => {
        if (confirm('Inactive for 15 min. Stay logged in?')) resetSessionTimer();
        else logoutDueToInactivity('Logged out due to inactivity.');
    }, INACTIVITY_TIMEOUT_MS);
}

function logoutDueToInactivity(msg) { showToast(msg, 'warning'); logout(); }
function setupActivityListeners() {
    ['mousedown','mousemove','keypress','scroll','touchstart','click'].forEach(e =>
        document.addEventListener(e, () => resetSessionTimer())
    );
}

/* ==========================================
   AUTHENTICATION FLOW
   ========================================== */
async function initAuth() {
    if (typeof supabase === 'undefined') {
        showLoginError('Supabase not loaded.');
        return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) await handleUser(session.user);
    else showLogin();

    supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_OUT') showLogin();
        else if (session?.user) await handleUser(session.user);
        else showLogin();
    });
}

async function handleUser(user) {
    try {
        const isAdmin = await checkAdminStatus(user);
        if (isAdmin) {
            currentUser = user;
            showDashboard();
            updateUserInfo(user);
            resetSessionTimer();
            setupActivityListeners();
            if (!adminInitialized) {
                adminInitialized = true;
                initAdmin();
            }
        } else {
            console.error('[Admin] Not an admin:', user.email);
            await supabase.auth.signOut();
            showLoginError('Access denied. You are not an admin.');
        }
    } catch (e) {
        console.error(e);
        showLoginError('Authentication error.');
    }
}

async function checkAdminStatus(user) {
    if (ADMIN_EMAILS.includes(user.email)) {
        try {
            await supabase.from('admins').upsert({ id: user.id, email: user.email, role: 'admin' });
        } catch(e) {}
        return true;
    }
    try {
        const { data, error } = await supabase
            .from('admins')
            .select('id')
            .eq('id', user.id)
            .maybeSingle();
        if (error) return false;
        return !!data;
    } catch (e) {
        return false;
    }
}

function showLogin() {
    const overlay = getEl('loginOverlay');
    const dash = getEl('adminDashboard');
    if (overlay) { overlay.style.display = 'flex'; overlay.classList.remove('hidden'); }
    if (dash) dash.style.display = 'none';
    adminInitialized = false;
    currentUser = null;
    if (sessionTimeout) clearTimeout(sessionTimeout);
    if (inactivityTimer) clearTimeout(inactivityTimer);
}

function showDashboard() {
    const overlay = getEl('loginOverlay');
    const dash = getEl('adminDashboard');
    if (overlay) { overlay.classList.add('hidden'); setTimeout(() => overlay.style.display = 'none', 300); }
    if (dash) dash.style.display = 'flex';
}

function updateUserInfo(user) {
    const emailDisplay = getEl('userEmailDisplay');
    const accountEmail = getEl('accountEmail');
    if (emailDisplay) emailDisplay.textContent = user.email || 'Admin';
    if (accountEmail) accountEmail.value = user.email || '';
}

/* ==========================================
   LOGIN FORM (with rate limiting)
   ========================================== */
let loginAttempts = 0;
let loginLockoutUntil = null;

function initLoginForm() {
    const form = getEl('authForm');
    if (!form) return;
    let mode = 'login';
    const tabs = document.querySelectorAll('.auth-tab');
    const errorDiv = getEl('authError');
    const btn = getEl('authBtn');
    const passwordGroup = getEl('passwordGroup');
    const confirmGroup = getEl('confirmPasswordGroup');

    if (tabs.length) {
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                mode = tab.getAttribute('data-tab');
                if (errorDiv) errorDiv.style.display = 'none';
                loginAttempts = 0;
                if (mode === 'signup') {
                    if (passwordGroup) passwordGroup.style.display = 'block';
                    if (confirmGroup) confirmGroup.style.display = 'block';
                    if (btn) btn.innerHTML = '<i class="fas fa-user-plus"></i> <span>Create Account</span>';
                } else {
                    if (passwordGroup) passwordGroup.style.display = 'block';
                    if (confirmGroup) confirmGroup.style.display = 'none';
                    if (btn) btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> <span>Login</span>';
                }
            });
        });
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (loginLockoutUntil && Date.now() < loginLockoutUntil) {
            const remaining = Math.ceil((loginLockoutUntil - Date.now()) / 1000);
            showLoginError('Too many attempts. Wait ' + remaining + 's.');
            return;
        }
        const email = getEl('email').value.trim();
        const password = getEl('password').value;
        if (errorDiv) errorDiv.style.display = 'none';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Processing...</span>';
        }

        try {
            if (mode === 'signup') {
                const confirmInput = getEl('confirmPassword');
                const confirm = confirmInput ? confirmInput.value : '';
                if (password !== confirm) throw new Error('Passwords do not match');
                if (password.length < 8) throw new Error('Password must be at least 8 characters');
                if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password))
                    throw new Error('Password must contain uppercase, lowercase, and number');
                const { error } = await supabase.auth.signUp({ email, password });
                if (error) throw error;
                showToast('Account created! You are now an admin.', 'success');
            } else {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
                loginAttempts = 0;
                loginLockoutUntil = null;
            }
        } catch (err) {
            loginAttempts++;
            if (loginAttempts >= 5) {
                loginLockoutUntil = Date.now() + 60 * 1000;
                showLoginError('Too many failed attempts. Locked out for 60 seconds.');
            } else {
                showLoginError((err.message || 'Authentication failed') + ' (Attempt ' + loginAttempts + '/5)');
            }
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = mode === 'signup'
                    ? '<i class="fas fa-user-plus"></i> <span>Create Account</span>'
                    : '<i class="fas fa-sign-in-alt"></i> <span>Login</span>';
            }
        }
    });
}

function showLoginError(msg) {
    const errorDiv = getEl('authError');
    if (errorDiv) { errorDiv.textContent = msg; errorDiv.style.display = 'block'; }
}

async function logout() {
    if (!confirm('Logout?')) return;
    try {
        await supabase.auth.signOut();
        if (sessionTimeout) clearTimeout(sessionTimeout);
        if (inactivityTimer) clearTimeout(inactivityTimer);
        location.reload();
    } catch (err) { showToast('Logout failed', 'error'); }
}

/* ==========================================
   ADMIN INITIALIZATION
   ========================================== */
function initAdmin() {
    if (typeof supabase === 'undefined') { showToast('Supabase not available.', 'error'); return; }
    setupRealtime();
    setupTabs();
    setupForm();
    setupImageForm();
    setupImagePreview();
    setupSearch();
    setupMobileSidebar();
    setupLogout();
    setupTableActions();
    initAdsManager();
    fetchApps();
}

/* ==========================================
   REALTIME & DATA FETCHING
   ========================================== */
function setupRealtime() {
    if (window.apksChannel) supabase.removeChannel(window.apksChannel);
    window.apksChannel = supabase
        .channel('public:apks')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'apks' }, () => fetchApps())
        .subscribe();
}

async function fetchApps() {
    const { data, error } = await supabase.from('apks').select('*').order('date_added', { ascending: false });
    if (error) {
        console.error('[Admin] Fetch error:', error);
        if (error.code === '42501') showToast('Permission denied. Check RLS policies.', 'error');
        else showToast('Failed to load apps: ' + error.message, 'error');
        return;
    }
    appsData = (data || []).map(row => ({
        id: row.id, name: row.name, version: row.version, size: row.size, icon: row.icon,
        image: row.image, mod: row.mod, link: row.link || '', category: row.category || 'app',
        downloads: row.downloads || 0, dateAdded: row.date_added, fileExtension: row.file_extension || 'apk',
        sliderSection: row.slider_section, aspectRatio: row.aspect_ratio || '16:9',
        borderRadius: row.border_radius || '16px', borderStyle: row.border_style || 'none'
    }));
    currentPage = 1;
    renderTable();
    updateStats();
}

/* ==========================================
   TABS & NAVIGATION
   ========================================== */
function setupTabs() {
    document.querySelectorAll('[data-tab]').forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = tab.getAttribute('data-tab');
            if (!targetId) return;
            switchTab(targetId);
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            const navItem = tab.closest('.nav-item');
            if (navItem) navItem.classList.add('active');
        });
    });
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(x => x.classList.remove('active'));
    const target = getEl(tabId);
    if (target) target.classList.add('active');
    const sidebar = getEl('sidebar');
    if (sidebar) sidebar.classList.remove('open');
    if (tabId === 'apps') { currentPage = 1; renderTable(); }
}

function setupMobileSidebar() {
    const toggle = getEl('mobileToggle');
    const sidebar = getEl('sidebar');
    if (toggle && sidebar) toggle.addEventListener('click', () => sidebar.classList.toggle('open'));
}

function setupLogout() {
    const logoutNav = getEl('logoutNavItem');
    if (logoutNav) logoutNav.addEventListener('click', (e) => { e.preventDefault(); logout(); });
}

/* ==========================================
   IMAGE PREVIEW
   ========================================== */
function setupImagePreview() {
    const imgInput = getEl('imgImage');
    const previewBox = getEl('imgPreviewBox');
    if (!imgInput || !previewBox) return;
    let debounceTimer;
    imgInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            const url = imgInput.value.trim();
            if (url && url.startsWith('https://')) {
                previewBox.innerHTML = '<img src="' + escapeHtml(url) + '" alt="Preview" style="max-width:100%;max-height:100%;object-fit:contain;border-radius:8px;">';
            } else if (url && url.startsWith('http://')) {
                previewBox.innerHTML = '<span style="color:var(--accent-warning)"><i class="fas fa-exclamation-triangle"></i> Use HTTPS for security</span>';
            } else {
                previewBox.innerHTML = '<span style="color:var(--text-secondary);font-size:0.85rem"><i class="fas fa-image"></i> Image preview will appear here</span>';
            }
        }, 300);
    });
}

/* ==========================================
   TABLE RENDERING
   ========================================== */
function renderTable() {
    const tb = getEl('appsTableBody');
    if (!tb) return;
    const q = (getEl('searchApps')?.value || '').toLowerCase().trim();
    let filtered = appsData;
    if (q) filtered = appsData.filter(a => (a.name || '').toLowerCase().includes(q) || (a.mod || '').toLowerCase().includes(q));
    tb.innerHTML = '';
    if (filtered.length === 0) {
        tb.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-secondary)">No items found</td></table>';
        renderPagination(0);
        return;
    }
    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    if (currentPage > totalPages) currentPage = totalPages || 1;
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageItems = filtered.slice(start, end);
    const fragment = document.createDocumentFragment();
    pageItems.forEach(app => fragment.appendChild(buildTableRow(app)));
    tb.appendChild(fragment);
    attachTableImageHandlers(tb);
    renderPagination(filtered.length);
}

function buildTableRow(app) {
    const tr = document.createElement('tr');
    tr.setAttribute('data-app-id', app.id);
    const iconCell = document.createElement('td');
    const iconDiv = document.createElement('div');
    iconDiv.className = 'app-icon-small';
    if (app.image && app.image.trim()) {
        const img = document.createElement('img');
        img.src = app.image; img.alt = app.name || 'App'; img.loading = 'lazy'; img.dataset.fallback = 'true';
        iconDiv.appendChild(img);
    } else {
        iconDiv.innerHTML = '<i class="' + escapeHtml(app.icon || 'fas fa-mobile-alt') + '"></i>';
    }
    iconCell.appendChild(iconDiv);

    const nameCell = document.createElement('td');
    nameCell.innerHTML = '<strong>' + escapeHtml(app.name) + '</strong><br><small class="text-secondary">' + escapeHtml(app.category || 'app') + '</small>';
    const versionCell = document.createElement('td'); versionCell.textContent = escapeHtml(app.version || 'N/A');
    const sizeCell = document.createElement('td'); sizeCell.textContent = escapeHtml(app.size || 'N/A');
    const extCell = document.createElement('td'); extCell.innerHTML = '<span style="font-family:monospace;font-size:0.8rem">.' + escapeHtml(app.fileExtension || 'apk') + '</span>';
    const sliderCell = document.createElement('td'); sliderCell.textContent = app.sliderSection ? 'Slider ' + app.sliderSection : '\u2014';
    const linkCell = document.createElement('td'); linkCell.innerHTML = app.link && app.link.startsWith('https://') ? '<span style="color:var(--accent-success)"><i class="fas fa-check-circle"></i> Set</span>' : '<span style="color:var(--accent-danger)"><i class="fas fa-times-circle"></i> Invalid</span>';
    const actionsCell = document.createElement('td');
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'action-buttons';
    actionsDiv.innerHTML = '<button class="action-btn" data-action="edit" data-id="' + escapeHtml(app.id) + '"><i class="fas fa-edit"></i></button><button class="action-btn delete" data-action="delete" data-id="' + escapeHtml(app.id) + '"><i class="fas fa-trash"></i></button>';
    actionsCell.appendChild(actionsDiv);

    tr.appendChild(iconCell); tr.appendChild(nameCell); tr.appendChild(versionCell);
    tr.appendChild(sizeCell); tr.appendChild(extCell); tr.appendChild(sliderCell); tr.appendChild(linkCell); tr.appendChild(actionsCell);
    return tr;
}

function setupTableActions() {
    const tbody = getEl('appsTableBody');
    if (!tbody) return;
    tbody.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const action = btn.getAttribute('data-action');
        const id = btn.getAttribute('data-id');
        if (action === 'edit') editApp(id);
        else if (action === 'delete') deleteApp(id);
    });
}

function attachTableImageHandlers(container) {
    if (!container) return;
    container.querySelectorAll('img[data-fallback]').forEach(img => {
        img.addEventListener('error', function handleImgError() {
            this.removeEventListener('error', handleImgError);
            const parent = this.parentElement;
            if (parent) parent.innerHTML = '<i class="fas fa-mobile-alt"></i>';
        });
    });
}

function renderPagination(totalItems) {
    const container = getEl('pagination');
    if (!container) return;
    container.innerHTML = '';
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if (totalPages <= 1) return;
    const fragment = document.createDocumentFragment();
    const prevBtn = document.createElement('button');
    prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
    prevBtn.disabled = currentPage === 1;
    prevBtn.addEventListener('click', () => { if (currentPage > 1) { currentPage--; renderTable(); } });
    fragment.appendChild(prevBtn);
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    if (endPage - startPage < 4) startPage = Math.max(1, endPage - 4);
    for (let i = startPage; i <= endPage; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        if (i === currentPage) btn.classList.add('active');
        btn.addEventListener('click', () => { currentPage = i; renderTable(); });
        fragment.appendChild(btn);
    }
    const nextBtn = document.createElement('button');
    nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.addEventListener('click', () => { if (currentPage < totalPages) { currentPage++; renderTable(); } });
    fragment.appendChild(nextBtn);
    container.appendChild(fragment);
}

function setupSearch() {
    const input = getEl('searchApps');
    if (!input) return;
    input.addEventListener('input', () => {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(() => { currentPage = 1; renderTable(); }, 150);
    });
}

/* ==========================================
   ADD MOD / GAME FORM
   ========================================== */
function setupForm() {
    const f = getEl('addApkForm');
    if (!f) return;
    f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = f.querySelector('button[type="submit"]');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...'; }
        try {
            const linkValue = getEl('appLink').value.trim();
            if (!linkValue || !linkValue.startsWith('https://')) throw new Error('HTTPS download link required');
            const newApp = {
                name: getEl('appName').value.trim().substring(0, 100),
                version: getEl('appVersion').value.trim().substring(0, 50),
                size: getEl('appSize').value.trim().substring(0, 20),
                icon: getEl('appIcon').value.trim().substring(0, 50) || 'fas fa-mobile-alt',
                image: getEl('appImage').value.trim().substring(0, 500),
                mod: getEl('appMod').value.trim().substring(0, 500),
                link: linkValue,
                category: getEl('appCategory').value,
                downloads: 0,
                file_extension: getEl('appFileExt') ? getEl('appFileExt').value : 'apk',
                slider_section: getEl('appSliderSection') && getEl('appSliderSection').value ? parseInt(getEl('appSliderSection').value) : null,
                aspect_ratio: getEl('appAspectRatio') ? getEl('appAspectRatio').value : '16:9',
                border_radius: getEl('appBorderRadius') ? getEl('appBorderRadius').value : '16px',
                border_style: getEl('appBorderStyle') ? getEl('appBorderStyle').value : 'none'
            };
            const { error } = await supabase.from('apks').insert([newApp]);
            if (error) throw error;
            f.reset();
            showToast('Item added successfully!', 'success');
            setTimeout(() => switchTab('apps'), 600);
        } catch (err) { showToast('Failed to add: ' + err.message, 'error'); }
        finally { if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-plus"></i> Add Mod / Game'; } }
    });
}

function setupImageForm() {
    const f = getEl('addImageForm');
    if (!f) return;
    f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = f.querySelector('button[type="submit"]');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Publishing...'; }
        try {
            const linkValue = getEl('imgLink').value.trim();
            const imgValue = getEl('imgImage').value.trim();
            if (!linkValue || !linkValue.startsWith('https://')) throw new Error('HTTPS download link required');
            if (!imgValue || !imgValue.startsWith('https://')) throw new Error('HTTPS image URL required');
            const newItem = {
                name: getEl('imgName').value.trim().substring(0, 100),
                version: getEl('imgVersion').value.trim().substring(0, 50) || 'v1.0',
                size: getEl('imgSize').value.trim().substring(0, 20) || 'N/A',
                icon: getEl('imgIcon').value.trim().substring(0, 50) || 'fas fa-image',
                image: imgValue,
                mod: getEl('imgMod').value.trim().substring(0, 500),
                link: linkValue,
                category: getEl('imgCategory').value,
                downloads: 0,
                file_extension: getEl('imgFileExt') ? getEl('imgFileExt').value : 'zip',
                slider_section: getEl('imgSliderSection') && getEl('imgSliderSection').value ? parseInt(getEl('imgSliderSection').value) : null,
                aspect_ratio: getEl('imgAspectRatio') ? getEl('imgAspectRatio').value : 'auto',
                border_radius: getEl('imgBorderRadius') ? getEl('imgBorderRadius').value : '16px',
                border_style: getEl('imgBorderStyle') ? getEl('imgBorderStyle').value : 'none'
            };
            const { error } = await supabase.from('apks').insert([newItem]);
            if (error) throw error;
            f.reset();
            const previewBox = getEl('imgPreviewBox');
            if (previewBox) previewBox.innerHTML = '<span style="color:var(--text-secondary);font-size:0.85rem"><i class="fas fa-image"></i> Image preview will appear here</span>';
            showToast('Image published successfully!', 'success');
            setTimeout(() => switchTab('apps'), 600);
        } catch (err) { showToast('Failed to publish: ' + err.message, 'error'); }
        finally { if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-plus"></i> Publish Image'; } }
    });
}

/* ==========================================
   EDIT & DELETE (FULLY FIXED)
   ========================================== */
function editApp(id) {
    const app = appsData.find(x => x.id === id);
    if (!app) return;
    getEl('editId').value = id;
    getEl('editName').value = app.name || '';
    getEl('editVersion').value = app.version || '';
    getEl('editSize').value = app.size || '';
    getEl('editIcon').value = app.icon || '';
    getEl('editImage').value = app.image || '';
    getEl('editMod').value = app.mod || '';
    getEl('editLink').value = app.link || '';
    getEl('editCategory').value = app.category || 'app';
    if (getEl('editFileExt')) getEl('editFileExt').value = app.fileExtension || 'apk';
    if (getEl('editSliderSection')) getEl('editSliderSection').value = app.sliderSection || '';
    if (getEl('editAspectRatio')) getEl('editAspectRatio').value = app.aspectRatio || '16:9';
    if (getEl('editBorderRadius')) getEl('editBorderRadius').value = app.borderRadius || '16px';
    if (getEl('editBorderStyle')) getEl('editBorderStyle').value = app.borderStyle || 'none';
    const modal = getEl('editModal');
    if (modal) modal.classList.add('active');
}

async function saveEdit() {
    const id = getEl('editId').value;
    if (!id) return;
    const btn = getEl('saveEditBtn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Saving...';
    }

    try {
        const linkValue = getEl('editLink').value.trim();
        if (linkValue && !linkValue.startsWith('https://')) {
            throw new Error('Download link must use HTTPS for security');
        }

        const updateData = {
            name: getEl('editName').value.trim(),
            version: getEl('editVersion').value.trim(),
            size: getEl('editSize').value.trim(),
            icon: getEl('editIcon').value.trim(),
            image: getEl('editImage').value.trim(),
            mod: getEl('editMod').value.trim(),
            link: linkValue,
            category: getEl('editCategory').value,
            aspect_ratio: getEl('editAspectRatio') ? getEl('editAspectRatio').value : '16:9',
            border_radius: getEl('editBorderRadius') ? getEl('editBorderRadius').value : '16px',
            border_style: getEl('editBorderStyle') ? getEl('editBorderStyle').value : 'none'
        };

        if (getEl('editFileExt')) {
            updateData.file_extension = getEl('editFileExt').value;
        }

        if (getEl('editSliderSection')) {
            const sliderVal = getEl('editSliderSection').value;
            updateData.slider_section = sliderVal ? parseInt(sliderVal) : null;
        }

        const { error } = await supabase.from('apks').update(updateData).eq('id', id);
        if (error) throw error;

        closeModal();
        showToast('Item updated successfully!', 'success');
        fetchApps();
    } catch (e) {
        console.error('Edit error:', e);
        showToast('Update failed: ' + e.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Save Changes';
        }
    }
}

function closeModal() {
    const modal = getEl('editModal');
    if (modal) modal.classList.remove('active');
}

async function deleteApp(id) {
    if (!confirm('Permanently delete this item?')) return;
    try {
        const { error } = await supabase.from('apks').delete().eq('id', id);
        if (error) throw error;
        showToast('Item deleted', 'success');
    } catch (e) { showToast('Delete failed: ' + e.message, 'error'); }
}

/* ==========================================
   ADS MANAGER (Supabase Sync) — Cross-Device
   ========================================== */
function initAdsManager() {
    loadAdSettings();
}

function getAdDefaults() {
    return {
        homeTop: { enabled: false, code: '', size: 'auto' },
        homeInline: { enabled: false, code: '', size: 'auto', position: 6 },
        homeBottom: { enabled: false, code: '', size: 'auto' },
        homeSticky: { enabled: false, code: '', size: 'auto' },
        downloadTop: { enabled: false, code: '', size: 'auto' },
        downloadMiddle: { enabled: false, code: '', size: 'auto' },
        downloadBottom: { enabled: false, code: '', size: 'auto' }
    };
}

async function loadAdSettings() {
    // Try to fetch from Supabase first (for cross-device sync)
    let remoteSettings = null;
    try {
        remoteSettings = await fetchAdSettingsFromSupabase();
    } catch (e) {
        console.warn('[Ads] Remote fetch failed, using localStorage fallback');
    }

    const defaults = getAdDefaults();
    let parsed = {};

    if (remoteSettings && typeof remoteSettings === 'object') {
        parsed = remoteSettings;
        // Cache in localStorage for offline fallback
        localStorage.setItem('flm_ad_settings', JSON.stringify(remoteSettings));
    } else {
        const stored = localStorage.getItem('flm_ad_settings');
        if (stored) {
            try { parsed = JSON.parse(stored); } catch (e) { console.error('[Ads] Parse error', e); }
        }
    }

    // Deep merge per slot
    const settings = {};
    for (const key of Object.keys(defaults)) {
        settings[key] = Object.assign({}, defaults[key], parsed[key] || {});
    }

    const setVal = (id, val) => { const el = getEl(id); if (el) el.value = val !== undefined ? val : ''; };
    const setChecked = (id, val) => { const el = getEl(id); if (el) el.value = val ? 'true' : 'false'; };

    setChecked('adHomeTopEnabled', settings.homeTop.enabled);
    setVal('adHomeTopSize', settings.homeTop.size);
    setVal('adHomeTopCode', settings.homeTop.code);

    setChecked('adHomeInlineEnabled', settings.homeInline.enabled);
    setVal('adHomeInlineSize', settings.homeInline.size);
    setVal('adHomeInlinePosition', settings.homeInline.position || 6);
    setVal('adHomeInlineCode', settings.homeInline.code);

    setChecked('adHomeBottomEnabled', settings.homeBottom.enabled);
    setVal('adHomeBottomSize', settings.homeBottom.size);
    setVal('adHomeBottomCode', settings.homeBottom.code);

    setChecked('adHomeStickyEnabled', settings.homeSticky.enabled);
    setVal('adHomeStickySize', settings.homeSticky.size);
    setVal('adHomeStickyCode', settings.homeSticky.code);

    setChecked('adDownloadTopEnabled', settings.downloadTop.enabled);
    setVal('adDownloadTopSize', settings.downloadTop.size);
    setVal('adDownloadTopCode', settings.downloadTop.code);

    setChecked('adDownloadMiddleEnabled', settings.downloadMiddle.enabled);
    setVal('adDownloadMiddleSize', settings.downloadMiddle.size);
    setVal('adDownloadMiddleCode', settings.downloadMiddle.code);

    setChecked('adDownloadBottomEnabled', settings.downloadBottom.enabled);
    setVal('adDownloadBottomSize', settings.downloadBottom.size);
    setVal('adDownloadBottomCode', settings.downloadBottom.code);
}

async function saveAdSettings() {
    const getVal = (id) => { const el = getEl(id); return el ? el.value : ''; };
    const getBool = (id) => { const el = getEl(id); return el ? el.value === 'true' : false; };

    const settings = {
        homeTop: {
            enabled: getBool('adHomeTopEnabled'),
            code: getVal('adHomeTopCode').trim(),
            size: getVal('adHomeTopSize')
        },
        homeInline: {
            enabled: getBool('adHomeInlineEnabled'),
            code: getVal('adHomeInlineCode').trim(),
            size: getVal('adHomeInlineSize'),
            position: parseInt(getVal('adHomeInlinePosition')) || 6
        },
        homeBottom: {
            enabled: getBool('adHomeBottomEnabled'),
            code: getVal('adHomeBottomCode').trim(),
            size: getVal('adHomeBottomSize')
        },
        homeSticky: {
            enabled: getBool('adHomeStickyEnabled'),
            code: getVal('adHomeStickyCode').trim(),
            size: getVal('adHomeStickySize')
        },
        downloadTop: {
            enabled: getBool('adDownloadTopEnabled'),
            code: getVal('adDownloadTopCode').trim(),
            size: getVal('adDownloadTopSize')
        },
        downloadMiddle: {
            enabled: getBool('adDownloadMiddleEnabled'),
            code: getVal('adDownloadMiddleCode').trim(),
            size: getVal('adDownloadMiddleSize')
        },
        downloadBottom: {
            enabled: getBool('adDownloadBottomEnabled'),
            code: getVal('adDownloadBottomCode').trim(),
            size: getVal('adDownloadBottomSize')
        }
    };

    // Always save to localStorage for immediate local use
    localStorage.setItem('flm_ad_settings', JSON.stringify(settings));

    // Also sync to Supabase so all devices get the update
    showToast('Syncing ad settings to cloud...', 'success');
    const synced = await uploadAdSettingsToSupabase(settings);

    if (synced) {
        showToast('Ad settings saved & synced to all devices!', 'success');
    } else {
        showToast('Ad settings saved locally (cloud sync failed).', 'warning');
    }
}
/* ==========================================
   STATS & UTILITIES
   ========================================== */
function updateStats() {
    const total = appsData.length;
    const downloads = appsData.reduce((s, a) => s + (a.downloads || 0), 0);
    const games = appsData.filter(a => a.category === 'game').length;
    const images = appsData.filter(a => ['image','ai-image','wallpaper','asset'].includes(a.category)).length;
    if (getEl('totalApps')) getEl('totalApps').textContent = total;
    if (getEl('totalDownloads')) getEl('totalDownloads').textContent = formatNum(downloads);
    if (getEl('gamesCount')) getEl('gamesCount').textContent = games;
    if (getEl('imagesCount')) getEl('imagesCount').textContent = images;
}

function exportData() {
    if (appsData.length === 0) { showToast('No data to export', 'warning'); return; }
    const dataStr = JSON.stringify(appsData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'flm-backup-' + Date.now() + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Data exported!', 'success');
}

function showToast(message, type) {
    type = type || 'success';
    const container = getEl('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-exclamation-triangle';
    toast.innerHTML = '<i class="fas ' + icon + '"></i> <span>' + escapeHtml(message) + '</span>';
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => { if (toast.parentElement) toast.remove(); }, 300);
    }, 4000);
}

function escapeHtml(str) {
    if (str == null) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function formatNum(n) {
    if (!n) return '0';
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
}

/* ==========================================
   GLOBAL WINDOW EXPOSURES
   ========================================== */
window.switchTab = switchTab;
window.saveEdit = saveEdit;
window.closeModal = closeModal;
window.logout = logout;
window.exportData = exportData;
window.saveAdSettings = saveAdSettings;
window.loadAdSettings = loadAdSettings;

/* ==========================================
   BOOT
   ========================================== */
document.addEventListener('DOMContentLoaded', () => {
    initLoginForm();
    initAuth();
});