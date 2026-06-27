// admin.js — FULLY REDESIGNED SMART UI (Login bugs fixed, original logic preserved)

const MOD_URL_TEMPLATES = {};
const AD_SETTINGS_PUBLIC_URL = 'https://egexyoqnzhaygvcbsdyi.supabase.co/storage/v1/object/public/termux-bucket/ad_settings.json';
let appsData = [];
let currentUser = null;
let currentPage = 1;
const itemsPerPage = 15;
let searchDebounce = null;
let adminInitialized = false;
let sessionTimeout = null;
let inactivityTimer = null;

function getEl(id) { return document.getElementById(id); }

const ADMIN_EMAILS = ['parkjem45@gmail.com'];

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
                // Ensure Supabase is still available before initialising
                if (typeof supabase === 'undefined') {
                    showToast('Supabase connection lost. Reloading...', 'error');
                    setTimeout(() => location.reload(), 2000);
                    return;
                }
                adminInitialized = true;
                await initAdmin();
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
    if (errorDiv) {
        errorDiv.textContent = msg;
        errorDiv.style.display = 'block';      // <--- FIXED: originally 'flex'
    }
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

async function initAdmin() {
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
    setupModalClose();
    setupKeyboardShortcuts();

    setupNewsManager();
    setupVideosManager();
    setupGalleryManager();
    setupStoriesManager();
    setupMusicManager();
    setupBooksManager();
    setupGuidesManager();

    await initAdsManager();
    fetchApps();
}

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

            const sidebar = getEl('sidebar');
            const overlay = getEl('sidebarOverlay');
            if (window.innerWidth <= 900 && sidebar) {
                sidebar.classList.remove('open');
                if (overlay) overlay.classList.remove('active');
            }
        });
    });
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(x => x.classList.remove('active'));
    const target = getEl(tabId);
    if (target) target.classList.add('active');
    if (tabId === 'apps') { currentPage = 1; renderTable(); }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setupMobileSidebar() {
    const toggle = getEl('mobileToggle');
    const sidebar = getEl('sidebar');
    const overlay = getEl('sidebarOverlay');

    if (toggle && sidebar) {
        toggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            if (overlay) overlay.classList.toggle('active');
        });
    }

    if (overlay) {
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            overlay.classList.remove('active');
        });
    }

    window.addEventListener('resize', () => {
        if (window.innerWidth > 900) {
            sidebar.classList.remove('open');
            if (overlay) overlay.classList.remove('active');
        }
    });
}

function setupLogout() {
    const logoutNav = getEl('logoutNavItem');
    if (logoutNav) logoutNav.addEventListener('click', (e) => { e.preventDefault(); logout(); });
}

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const activeModal = document.querySelector('.modal.active');
            if (activeModal) {
                const closeBtn = activeModal.querySelector('.modal-close');
                if (closeBtn) closeBtn.click();
            }
            const sidebar = getEl('sidebar');
            const overlay = getEl('sidebarOverlay');
            if (sidebar && sidebar.classList.contains('open')) {
                sidebar.classList.remove('open');
                if (overlay) overlay.classList.remove('active');
            }
        }

        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            const searchInput = document.querySelector('.tab-content.active .search-bar input');
            if (searchInput) searchInput.focus();
        }
    });
}

function setupModalClose() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                const closeBtn = modal.querySelector('.modal-close');
                if (closeBtn) closeBtn.click();
            }
        });
    });
}

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
                previewBox.innerHTML = '<span style="color:var(--text-muted);font-size:0.85rem"><i class="fas fa-image"></i> Image preview will appear here</span>';
            }
        }, 300);
    });
}

function renderTable() {
    const tb = getEl('appsTableBody');
    if (!tb) return;
    const q = (getEl('searchApps')?.value || '').toLowerCase().trim();
    let filtered = appsData;
    if (q) filtered = appsData.filter(a => (a.name || '').toLowerCase().includes(q) || (a.mod || '').toLowerCase().includes(q));
    tb.innerHTML = '';
    if (filtered.length === 0) {
        tb.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-muted)">No items found</td></tr>';
        renderPagination(0);
        return;
    }
    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    if (currentPage > totalPages) currentPage = totalPages || 1;
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageItems = filtered.slice(start, end);
    const fragment = document.createDocumentFragment();
    pageItems.forEach((app, index) => {
        const row = buildTableRow(app);
        row.style.animationDelay = (index * 30) + 'ms';
        row.classList.add('row-animate');
        fragment.appendChild(row);
    });
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
    const sliderCell = document.createElement('td'); sliderCell.textContent = app.sliderSection ? 'Slider ' + app.sliderSection : '—';
    const linkCell = document.createElement('td'); linkCell.innerHTML = app.link && app.link.startsWith('https://') ? '<span style="color:var(--accent-success)"><i class="fas fa-check-circle"></i> Set</span>' : '<span style="color:var(--accent-danger)"><i class="fas fa-times-circle"></i> Invalid</span>';
    const actionsCell = document.createElement('td');
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'action-buttons';
    actionsDiv.innerHTML = '<button class="action-btn" data-action="edit" data-id="' + escapeHtml(app.id) + '" title="Edit"><i class="fas fa-edit"></i></button><button class="action-btn delete" data-action="delete" data-id="' + escapeHtml(app.id) + '" title="Delete"><i class="fas fa-trash"></i></button>';
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
            if (previewBox) previewBox.innerHTML = '<span style="color:var(--text-muted);font-size:0.85rem"><i class="fas fa-image"></i> Image preview will appear here</span>';
            showToast('Image published successfully!', 'success');
            setTimeout(() => switchTab('apps'), 600);
        } catch (err) { showToast('Failed to publish: ' + err.message, 'error'); }
        finally { if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-plus"></i> Publish Image'; } }
    });
}

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
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
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
            btn.innerHTML = 'Save Changes';
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

async function initAdsManager() {
    await loadAdSettings();
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
    const defaults = getAdDefaults();
    let parsed = {};
    let source = 'defaults';

    try {
        const url = AD_SETTINGS_PUBLIC_URL + '?t=' + Date.now();
        const response = await fetch(url, { cache: 'no-store' });
        if (response.ok) {
            parsed = await response.json();
            source = 'cloud-storage';
            localStorage.setItem('flm_ad_settings', JSON.stringify(parsed));
        } else {
            throw new Error('Storage returned ' + response.status);
        }
    } catch (e) {
        try {
            const { data, error } = await supabase
                .from('settings')
                .select('data')
                .eq('id', 'ads')
                .maybeSingle();
            if (!error && data && data.data) {
                parsed = data.data;
                source = 'cloud-db';
                localStorage.setItem('flm_ad_settings', JSON.stringify(data.data));
            } else {
                throw new Error('DB fallback failed');
            }
        } catch (e2) {
            const stored = localStorage.getItem('flm_ad_settings');
            if (stored) {
                try { 
                    parsed = JSON.parse(stored); 
                    source = 'local';
                } catch (e3) { console.error('[Ads] Parse error', e3); }
            }
        }
    }

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

    console.log('[Ads] Settings loaded from:', source);
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

    localStorage.setItem('flm_ad_settings', JSON.stringify(settings));

    let storageSuccess = false;
    let dbSuccess = false;
    let errors = [];

    try {
        const { error: storageError } = await supabase
            .storage
            .from('termux-bucket')
            .upload('ad_settings.json', 
                new Blob([JSON.stringify(settings)], { type: 'application/json' }), 
                { upsert: true, contentType: 'application/json' }
            );
        if (storageError) {
            errors.push('Storage: ' + storageError.message);
        } else {
            storageSuccess = true;
        }
    } catch (e) {
        errors.push('Storage exception: ' + e.message);
    }

    try {
        const { error: dbError } = await supabase
            .from('settings')
            .upsert({ id: 'ads', data: settings, updated_at: new Date().toISOString() }, { onConflict: 'id' });
        if (dbError) {
            errors.push('DB: ' + dbError.message);
        } else {
            dbSuccess = true;
        }
    } catch (e) {
        errors.push('DB exception: ' + e.message);
    }

    if (storageSuccess && dbSuccess) {
        showToast('Ad settings saved & synced to cloud!', 'success');
    } else if (storageSuccess) {
        showToast('Saved to Storage but DB failed.', 'warning');
    } else if (dbSuccess) {
        showToast('Saved to DB but Storage failed.', 'warning');
    } else {
        showToast('Cloud sync failed: ' + errors.join(' | '), 'error');
    }
}

function renderSimplePagination(containerId, totalPages, current, onClick) {
    const container = getEl(containerId);
    if (!container || totalPages <= 1) return;
    container.innerHTML = '';
    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        if (i === current) btn.classList.add('active');
        btn.addEventListener('click', () => onClick(i));
        container.appendChild(btn);
    }
}

let newsData = [], newsPage = 1, newsSearch = '', newsSearchDebounce;
const NEWS_PER_PAGE = 10;
function setupNewsManager() {
    const input = getEl('searchNews');
    if (input) input.addEventListener('input', () => { clearTimeout(newsSearchDebounce); newsSearchDebounce = setTimeout(() => { newsSearch = input.value.trim().toLowerCase(); newsPage = 1; renderNewsTable(); }, 150); });
    fetchNews();
    supabase.channel('public:flm_news').on('postgres_changes', { event: '*', schema: 'public', table: 'flm_news' }, () => fetchNews()).subscribe();
}
async function fetchNews() {
    const { data, error } = await supabase.from('flm_news').select('*').order('created_at', { ascending: false });
    if (error) { console.warn('News load error:', error.message); newsData = []; renderNewsTable(); return; }
    newsData = data || []; renderNewsTable();
}
function renderNewsTable() {
    const tb = getEl('newsTableBody');
    if (!tb) return;
    let filtered = newsData;
    if (newsSearch) filtered = newsData.filter(n => (n.title || '').toLowerCase().includes(newsSearch) || (n.category || '').toLowerCase().includes(newsSearch));
    const totalPages = Math.ceil(filtered.length / NEWS_PER_PAGE);
    if (newsPage > totalPages) newsPage = totalPages || 1;
    const start = (newsPage - 1) * NEWS_PER_PAGE;
    const pageItems = filtered.slice(start, start + NEWS_PER_PAGE);
    tb.innerHTML = pageItems.length ? '' : '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-muted)">No news found</td></tr>';
    pageItems.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td><strong>' + escapeHtml(item.title) + '</strong></td>' +
            '<td>' + escapeHtml(item.category || 'General') + '</td>' +
            '<td>' + escapeHtml(item.author || 'FLM Team') + '</td>' +
            '<td>' + formatDate(item.created_at) + '</td>' +
            '<td><div class="action-buttons"><button class="action-btn" onclick="editNews(\'' + item.id + '\')" title="Edit"><i class="fas fa-edit"></i></button><button class="action-btn delete" onclick="deleteNews(\'' + item.id + '\')" title="Delete"><i class="fas fa-trash"></i></button></div></td>';
        tb.appendChild(tr);
    });
    renderSimplePagination('newsPagination', totalPages, newsPage, (p) => { newsPage = p; renderNewsTable(); });
}
function openNewsModal() { getEl('newsModalTitle').textContent = 'Add News Article'; getEl('newsEditId').value = ''; getEl('newsTitle').value = ''; getEl('newsCategory').value = 'tech'; getEl('newsAuthor').value = 'FLM Team'; getEl('newsExcerpt').value = ''; getEl('newsImage').value = ''; getEl('newsContent').value = ''; getEl('newsModal').classList.add('active'); }
function closeNewsModal() { getEl('newsModal').classList.remove('active'); }
window.editNews = function(id) {
    const item = newsData.find(n => n.id == id);
    if (!item) return;
    getEl('newsModalTitle').textContent = 'Edit News Article';
    getEl('newsEditId').value = item.id;
    getEl('newsTitle').value = item.title || '';
    getEl('newsCategory').value = item.category || 'tech';
    getEl('newsAuthor').value = item.author || 'FLM Team';
    getEl('newsExcerpt').value = item.excerpt || '';
    getEl('newsImage').value = item.image_url || '';
    getEl('newsContent').value = item.content || '';
    getEl('newsModal').classList.add('active');
};
window.saveNews = async function() {
    const btn = getEl('saveNewsBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...'; }
    try {
        const data = { title: getEl('newsTitle').value.trim(), category: getEl('newsCategory').value, author: getEl('newsAuthor').value.trim(), excerpt: getEl('newsExcerpt').value.trim(), image_url: getEl('newsImage').value.trim(), content: getEl('newsContent').value.trim() };
        const id = getEl('newsEditId').value;
        if (id) { const { error } = await supabase.from('flm_news').update(data).eq('id', id); if (error) throw error; showToast('News updated!', 'success'); }
        else { const { error } = await supabase.from('flm_news').insert([data]); if (error) throw error; showToast('News added!', 'success'); }
        closeNewsModal(); fetchNews();
    } catch (e) { showToast('Save failed: ' + e.message, 'error'); }
    finally { if (btn) { btn.disabled = false; btn.innerHTML = 'Save'; } }
};
window.deleteNews = async function(id) {
    if (!confirm('Delete this news article?')) return;
    try { const { error } = await supabase.from('flm_news').delete().eq('id', id); if (error) throw error; showToast('Deleted!', 'success'); fetchNews(); }
    catch (e) { showToast('Delete failed: ' + e.message, 'error'); }
};

let videosData = [], videosPage = 1, videosSearch = '', videosSearchDebounce;
const VIDEOS_PER_PAGE = 10;
function setupVideosManager() {
    const input = getEl('searchVideos');
    if (input) input.addEventListener('input', () => { clearTimeout(videosSearchDebounce); videosSearchDebounce = setTimeout(() => { videosSearch = input.value.trim().toLowerCase(); videosPage = 1; renderVideosTable(); }, 150); });
    fetchVideos();
    supabase.channel('public:flm_videos').on('postgres_changes', { event: '*', schema: 'public', table: 'flm_videos' }, () => fetchVideos()).subscribe();
}
async function fetchVideos() {
    const { data, error } = await supabase.from('flm_videos').select('*').order('created_at', { ascending: false });
    if (error) { console.warn('Videos load error:', error.message); videosData = []; renderVideosTable(); return; }
    videosData = data || []; renderVideosTable();
}
function renderVideosTable() {
    const tb = getEl('videosTableBody');
    if (!tb) return;
    let filtered = videosData;
    if (videosSearch) filtered = videosData.filter(v => (v.title || '').toLowerCase().includes(videosSearch));
    const totalPages = Math.ceil(filtered.length / VIDEOS_PER_PAGE);
    if (videosPage > totalPages) videosPage = totalPages || 1;
    const start = (videosPage - 1) * VIDEOS_PER_PAGE;
    const pageItems = filtered.slice(start, start + VIDEOS_PER_PAGE);
    tb.innerHTML = pageItems.length ? '' : '<tr><td colspan="4" style="text-align:center;padding:40px;color:var(--text-muted)">No videos found</td></tr>';
    pageItems.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td><strong>' + escapeHtml(item.title) + '</strong></td>' +
            '<td>' + escapeHtml(item.category || 'General') + '</td>' +
            '<td><a href="' + escapeHtml(item.video_url || '#') + '" target="_blank" style="color:var(--accent-cyan)">Link <i class="fas fa-external-link-alt" style="font-size:0.7rem"></i></a></td>' +
            '<td><div class="action-buttons"><button class="action-btn" onclick="editVideo(\'' + item.id + '\')" title="Edit"><i class="fas fa-edit"></i></button><button class="action-btn delete" onclick="deleteVideo(\'' + item.id + '\')" title="Delete"><i class="fas fa-trash"></i></button></div></td>';
        tb.appendChild(tr);
    });
    renderSimplePagination('videosPagination', totalPages, videosPage, (p) => { videosPage = p; renderVideosTable(); });
}
function openVideoModal() { getEl('videoModalTitle').textContent = 'Add Video'; getEl('videoEditId').value = ''; getEl('videoTitle').value = ''; getEl('videoUrl').value = ''; getEl('videoCategory').value = 'tutorial'; getEl('videoTags').value = ''; getEl('videoDescription').value = ''; getEl('videoModal').classList.add('active'); }
function closeVideoModal() { getEl('videoModal').classList.remove('active'); }
window.editVideo = function(id) {
    const item = videosData.find(v => v.id == id);
    if (!item) return;
    getEl('videoModalTitle').textContent = 'Edit Video';
    getEl('videoEditId').value = item.id;
    getEl('videoTitle').value = item.title || '';
    getEl('videoUrl').value = item.video_url || '';
    getEl('videoCategory').value = item.category || 'tutorial';
    getEl('videoTags').value = item.tags || '';
    getEl('videoDescription').value = item.description || '';
    getEl('videoModal').classList.add('active');
};
window.saveVideo = async function() {
    const btn = getEl('saveVideoBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...'; }
    try {
        const data = { title: getEl('videoTitle').value.trim(), video_url: getEl('videoUrl').value.trim(), category: getEl('videoCategory').value, tags: getEl('videoTags').value.trim(), description: getEl('videoDescription').value.trim() };
        const id = getEl('videoEditId').value;
        if (id) { const { error } = await supabase.from('flm_videos').update(data).eq('id', id); if (error) throw error; showToast('Video updated!', 'success'); }
        else { const { error } = await supabase.from('flm_videos').insert([data]); if (error) throw error; showToast('Video added!', 'success'); }
        closeVideoModal(); fetchVideos();
    } catch (e) { showToast('Save failed: ' + e.message, 'error'); }
    finally { if (btn) { btn.disabled = false; btn.innerHTML = 'Save'; } }
};
window.deleteVideo = async function(id) {
    if (!confirm('Delete this video?')) return;
    try { const { error } = await supabase.from('flm_videos').delete().eq('id', id); if (error) throw error; showToast('Deleted!', 'success'); fetchVideos(); }
    catch (e) { showToast('Delete failed: ' + e.message, 'error'); }
};

let galleryData = [], galleryPage = 1, gallerySearch = '', gallerySearchDebounce;
const GALLERY_PER_PAGE = 10;
function setupGalleryManager() {
    const input = getEl('searchGallery');
    if (input) input.addEventListener('input', () => { clearTimeout(gallerySearchDebounce); gallerySearchDebounce = setTimeout(() => { gallerySearch = input.value.trim().toLowerCase(); galleryPage = 1; renderGalleryTable(); }, 150); });
    fetchGallery();
    supabase.channel('public:flm_gallery').on('postgres_changes', { event: '*', schema: 'public', table: 'flm_gallery' }, () => fetchGallery()).subscribe();
}
async function fetchGallery() {
    const { data, error } = await supabase.from('flm_gallery').select('*').order('created_at', { ascending: false });
    if (error) { console.warn('Gallery load error:', error.message); galleryData = []; renderGalleryTable(); return; }
    galleryData = data || []; renderGalleryTable();
}
function renderGalleryTable() {
    const tb = getEl('galleryTableBody');
    if (!tb) return;
    let filtered = galleryData;
    if (gallerySearch) filtered = galleryData.filter(g => (g.title || '').toLowerCase().includes(gallerySearch));
    const totalPages = Math.ceil(filtered.length / GALLERY_PER_PAGE);
    if (galleryPage > totalPages) galleryPage = totalPages || 1;
    const start = (galleryPage - 1) * GALLERY_PER_PAGE;
    const pageItems = filtered.slice(start, start + GALLERY_PER_PAGE);
    tb.innerHTML = pageItems.length ? '' : '<tr><td colspan="4" style="text-align:center;padding:40px;color:var(--text-muted)">No images found</td></tr>';
    pageItems.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td><img src="' + escapeHtml(item.image_url || '') + '" style="width:60px;height:40px;object-fit:cover;border-radius:8px;" onerror="this.style.display=\'none\'" loading="lazy"></td>' +
            '<td><strong>' + escapeHtml(item.title) + '</strong></td>' +
            '<td>' + escapeHtml(item.category || 'Other') + '</td>' +
            '<td><div class="action-buttons"><button class="action-btn" onclick="editGallery(\'' + item.id + '\')" title="Edit"><i class="fas fa-edit"></i></button><button class="action-btn delete" onclick="deleteGallery(\'' + item.id + '\')" title="Delete"><i class="fas fa-trash"></i></button></div></td>';
        tb.appendChild(tr);
    });
    renderSimplePagination('galleryPagination', totalPages, galleryPage, (p) => { galleryPage = p; renderGalleryTable(); });
}
function openGalleryModal() { getEl('galleryModalTitle').textContent = 'Add Gallery Image'; getEl('galleryEditId').value = ''; getEl('galleryTitle').value = ''; getEl('galleryImageUrl').value = ''; getEl('galleryCategory').value = 'ai-art'; getEl('galleryModal').classList.add('active'); }
function closeGalleryModal() { getEl('galleryModal').classList.remove('active'); }
window.editGallery = function(id) {
    const item = galleryData.find(g => g.id == id);
    if (!item) return;
    getEl('galleryModalTitle').textContent = 'Edit Gallery Image';
    getEl('galleryEditId').value = item.id;
    getEl('galleryTitle').value = item.title || '';
    getEl('galleryImageUrl').value = item.image_url || '';
    getEl('galleryCategory').value = item.category || 'ai-art';
    getEl('galleryModal').classList.add('active');
};
window.saveGallery = async function() {
    const btn = getEl('saveGalleryBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...'; }
    try {
        const data = { title: getEl('galleryTitle').value.trim(), image_url: getEl('galleryImageUrl').value.trim(), category: getEl('galleryCategory').value };
        const id = getEl('galleryEditId').value;
        if (id) { const { error } = await supabase.from('flm_gallery').update(data).eq('id', id); if (error) throw error; showToast('Gallery updated!', 'success'); }
        else { const { error } = await supabase.from('flm_gallery').insert([data]); if (error) throw error; showToast('Gallery added!', 'success'); }
        closeGalleryModal(); fetchGallery();
    } catch (e) { showToast('Save failed: ' + e.message, 'error'); }
    finally { if (btn) { btn.disabled = false; btn.innerHTML = 'Save'; } }
};
window.deleteGallery = async function(id) {
    if (!confirm('Delete this image?')) return;
    try { const { error } = await supabase.from('flm_gallery').delete().eq('id', id); if (error) throw error; showToast('Deleted!', 'success'); fetchGallery(); }
    catch (e) { showToast('Delete failed: ' + e.message, 'error'); }
};

let storiesData = [], storiesPage = 1, storiesSearch = '', storiesSearchDebounce;
const STORIES_PER_PAGE = 10;
function setupStoriesManager() {
    const input = getEl('searchStories');
    if (input) input.addEventListener('input', () => { clearTimeout(storiesSearchDebounce); storiesSearchDebounce = setTimeout(() => { storiesSearch = input.value.trim().toLowerCase(); storiesPage = 1; renderStoriesTable(); }, 150); });
    fetchStories();
    supabase.channel('public:flm_stories').on('postgres_changes', { event: '*', schema: 'public', table: 'flm_stories' }, () => fetchStories()).subscribe();
}
async function fetchStories() {
    const { data, error } = await supabase.from('flm_stories').select('*').order('votes', { ascending: false });
    if (error) { console.warn('Stories load error:', error.message); storiesData = []; renderStoriesTable(); return; }
    storiesData = data || []; renderStoriesTable();
}
function renderStoriesTable() {
    const tb = getEl('storiesTableBody');
    if (!tb) return;
    let filtered = storiesData;
    if (storiesSearch) filtered = storiesData.filter(s => (s.title || '').toLowerCase().includes(storiesSearch));
    const totalPages = Math.ceil(filtered.length / STORIES_PER_PAGE);
    if (storiesPage > totalPages) storiesPage = totalPages || 1;
    const start = (storiesPage - 1) * STORIES_PER_PAGE;
    const pageItems = filtered.slice(start, start + STORIES_PER_PAGE);
    tb.innerHTML = pageItems.length ? '' : '<tr><td colspan="4" style="text-align:center;padding:40px;color:var(--text-muted)">No stories found</td></tr>';
    pageItems.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td><strong>' + escapeHtml(item.title) + '</strong></td>' +
            '<td>' + escapeHtml(item.category || 'Story') + '</td>' +
            '<td>' + (item.votes || 0) + '</td>' +
            '<td><div class="action-buttons"><button class="action-btn" onclick="editStory(\'' + item.id + '\')" title="Edit"><i class="fas fa-edit"></i></button><button class="action-btn delete" onclick="deleteStory(\'' + item.id + '\')" title="Delete"><i class="fas fa-trash"></i></button></div></td>';
        tb.appendChild(tr);
    });
    renderSimplePagination('storiesPagination', totalPages, storiesPage, (p) => { storiesPage = p; renderStoriesTable(); });
}
function openStoryModal() { getEl('storyModalTitle').textContent = 'Add Story'; getEl('storyEditId').value = ''; getEl('storyTitle').value = ''; getEl('storyCategory').value = 'joke'; getEl('storyVotes').value = '0'; getEl('storyExcerpt').value = ''; getEl('storyContent').value = ''; getEl('storyModal').classList.add('active'); }
function closeStoryModal() { getEl('storyModal').classList.remove('active'); }
window.editStory = function(id) {
    const item = storiesData.find(s => s.id == id);
    if (!item) return;
    getEl('storyModalTitle').textContent = 'Edit Story';
    getEl('storyEditId').value = item.id;
    getEl('storyTitle').value = item.title || '';
    getEl('storyCategory').value = item.category || 'joke';
    getEl('storyVotes').value = item.votes || 0;
    getEl('storyExcerpt').value = item.excerpt || '';
    getEl('storyContent').value = item.content || '';
    getEl('storyModal').classList.add('active');
};
window.saveStory = async function() {
    const btn = getEl('saveStoryBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...'; }
    try {
        const data = { title: getEl('storyTitle').value.trim(), category: getEl('storyCategory').value, votes: parseInt(getEl('storyVotes').value) || 0, excerpt: getEl('storyExcerpt').value.trim(), content: getEl('storyContent').value.trim() };
        const id = getEl('storyEditId').value;
        if (id) { const { error } = await supabase.from('flm_stories').update(data).eq('id', id); if (error) throw error; showToast('Story updated!', 'success'); }
        else { const { error } = await supabase.from('flm_stories').insert([data]); if (error) throw error; showToast('Story added!', 'success'); }
        closeStoryModal(); fetchStories();
    } catch (e) { showToast('Save failed: ' + e.message, 'error'); }
    finally { if (btn) { btn.disabled = false; btn.innerHTML = 'Save'; } }
};
window.deleteStory = async function(id) {
    if (!confirm('Delete this story?')) return;
    try { const { error } = await supabase.from('flm_stories').delete().eq('id', id); if (error) throw error; showToast('Deleted!', 'success'); fetchStories(); }
    catch (e) { showToast('Delete failed: ' + e.message, 'error'); }
};

let musicData = [], musicPage = 1, musicSearch = '', musicSearchDebounce;
const MUSIC_PER_PAGE = 10;
function setupMusicManager() {
    const input = getEl('searchMusic');
    if (input) input.addEventListener('input', () => { clearTimeout(musicSearchDebounce); musicSearchDebounce = setTimeout(() => { musicSearch = input.value.trim().toLowerCase(); musicPage = 1; renderMusicTable(); }, 150); });
    fetchMusic();
    supabase.channel('public:flm_music').on('postgres_changes', { event: '*', schema: 'public', table: 'flm_music' }, () => fetchMusic()).subscribe();
}
async function fetchMusic() {
    const { data, error } = await supabase.from('flm_music').select('*').order('created_at', { ascending: false });
    if (error) { console.warn('Music load error:', error.message); musicData = []; renderMusicTable(); return; }
    musicData = data || []; renderMusicTable();
}
function renderMusicTable() {
    const tb = getEl('musicTableBody');
    if (!tb) return;
    let filtered = musicData;
    if (musicSearch) filtered = musicData.filter(m => (m.title || '').toLowerCase().includes(musicSearch));
    const totalPages = Math.ceil(filtered.length / MUSIC_PER_PAGE);
    if (musicPage > totalPages) musicPage = totalPages || 1;
    const start = (musicPage - 1) * MUSIC_PER_PAGE;
    const pageItems = filtered.slice(start, start + MUSIC_PER_PAGE);
    tb.innerHTML = pageItems.length ? '' : '<tr><td colspan="4" style="text-align:center;padding:40px;color:var(--text-muted)">No music found</td></tr>';
    pageItems.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td><strong>' + escapeHtml(item.title) + '</strong></td>' +
            '<td>' + escapeHtml(item.artist || 'Unknown') + '</td>' +
            '<td>' + escapeHtml(item.category || 'Electronic') + '</td>' +
            '<td><div class="action-buttons"><button class="action-btn" onclick="editMusic(\'' + item.id + '\')" title="Edit"><i class="fas fa-edit"></i></button><button class="action-btn delete" onclick="deleteMusic(\'' + item.id + '\')" title="Delete"><i class="fas fa-trash"></i></button></div></td>';
        tb.appendChild(tr);
    });
    renderSimplePagination('musicPagination', totalPages, musicPage, (p) => { musicPage = p; renderMusicTable(); });
}
function openMusicModal() { getEl('musicModalTitle').textContent = 'Add Music Track'; getEl('musicEditId').value = ''; getEl('musicTitle').value = ''; getEl('musicArtist').value = 'Unknown Artist'; getEl('musicAudioUrl').value = ''; getEl('musicDownloadUrl').value = ''; getEl('musicCategory').value = 'electronic'; getEl('musicDuration').value = ''; getEl('musicModal').classList.add('active'); }
function closeMusicModal() { getEl('musicModal').classList.remove('active'); }
window.editMusic = function(id) {
    const item = musicData.find(m => m.id == id);
    if (!item) return;
    getEl('musicModalTitle').textContent = 'Edit Music Track';
    getEl('musicEditId').value = item.id;
    getEl('musicTitle').value = item.title || '';
    getEl('musicArtist').value = item.artist || '';
    getEl('musicAudioUrl').value = item.audio_url || '';
    getEl('musicDownloadUrl').value = item.download_url || '';
    getEl('musicCategory').value = item.category || 'electronic';
    getEl('musicDuration').value = item.duration || '';
    getEl('musicModal').classList.add('active');
};
window.saveMusic = async function() {
    const btn = getEl('saveMusicBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...'; }
    try {
        const data = { title: getEl('musicTitle').value.trim(), artist: getEl('musicArtist').value.trim(), audio_url: getEl('musicAudioUrl').value.trim(), download_url: getEl('musicDownloadUrl').value.trim(), category: getEl('musicCategory').value, duration: parseInt(getEl('musicDuration').value) || null };
        const id = getEl('musicEditId').value;
        if (id) { const { error } = await supabase.from('flm_music').update(data).eq('id', id); if (error) throw error; showToast('Music updated!', 'success'); }
        else { const { error } = await supabase.from('flm_music').insert([data]); if (error) throw error; showToast('Music added!', 'success'); }
        closeMusicModal(); fetchMusic();
    } catch (e) { showToast('Save failed: ' + e.message, 'error'); }
    finally { if (btn) { btn.disabled = false; btn.innerHTML = 'Save'; } }
};
window.deleteMusic = async function(id) {
    if (!confirm('Delete this track?')) return;
    try { const { error } = await supabase.from('flm_music').delete().eq('id', id); if (error) throw error; showToast('Deleted!', 'success'); fetchMusic(); }
    catch (e) { showToast('Delete failed: ' + e.message, 'error'); }
};

let booksData = [], booksPage = 1, booksSearch = '', booksSearchDebounce;
const BOOKS_PER_PAGE = 10;
function setupBooksManager() {
    const input = getEl('searchBooks');
    if (input) input.addEventListener('input', () => { clearTimeout(booksSearchDebounce); booksSearchDebounce = setTimeout(() => { booksSearch = input.value.trim().toLowerCase(); booksPage = 1; renderBooksTable(); }, 150); });
    fetchBooks();
    supabase.channel('public:flm_books').on('postgres_changes', { event: '*', schema: 'public', table: 'flm_books' }, () => fetchBooks()).subscribe();
}
async function fetchBooks() {
    const { data, error } = await supabase.from('flm_books').select('*').order('created_at', { ascending: false });
    if (error) { console.warn('Books load error:', error.message); booksData = []; renderBooksTable(); return; }
    booksData = data || []; renderBooksTable();
}
function renderBooksTable() {
    const tb = getEl('booksTableBody');
    if (!tb) return;
    let filtered = booksData;
    if (booksSearch) filtered = booksData.filter(b => (b.title || '').toLowerCase().includes(booksSearch));
    const totalPages = Math.ceil(filtered.length / BOOKS_PER_PAGE);
    if (booksPage > totalPages) booksPage = totalPages || 1;
    const start = (booksPage - 1) * BOOKS_PER_PAGE;
    const pageItems = filtered.slice(start, start + BOOKS_PER_PAGE);
    tb.innerHTML = pageItems.length ? '' : '<tr><td colspan="4" style="text-align:center;padding:40px;color:var(--text-muted)">No books found</td></tr>';
    pageItems.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td><strong>' + escapeHtml(item.title) + '</strong></td>' +
            '<td>' + escapeHtml(item.author || 'Unknown') + '</td>' +
            '<td>' + escapeHtml(item.category || 'Fiction') + '</td>' +
            '<td><div class="action-buttons"><button class="action-btn" onclick="editBook(\'' + item.id + '\')" title="Edit"><i class="fas fa-edit"></i></button><button class="action-btn delete" onclick="deleteBook(\'' + item.id + '\')" title="Delete"><i class="fas fa-trash"></i></button></div></td>';
        tb.appendChild(tr);
    });
    renderSimplePagination('booksPagination', totalPages, booksPage, (p) => { booksPage = p; renderBooksTable(); });
}
function openBookModal() { getEl('bookModalTitle').textContent = 'Add Book'; getEl('bookEditId').value = ''; getEl('bookTitle').value = ''; getEl('bookAuthor').value = ''; getEl('bookCoverUrl').value = ''; getEl('bookPdfUrl').value = ''; getEl('bookCategory').value = 'fiction'; getEl('bookDescription').value = ''; getEl('bookModal').classList.add('active'); }
function closeBookModal() { getEl('bookModal').classList.remove('active'); }
window.editBook = function(id) {
    const item = booksData.find(b => b.id == id);
    if (!item) return;
    getEl('bookModalTitle').textContent = 'Edit Book';
    getEl('bookEditId').value = item.id;
    getEl('bookTitle').value = item.title || '';
    getEl('bookAuthor').value = item.author || '';
    getEl('bookCoverUrl').value = item.cover_url || '';
    getEl('bookPdfUrl').value = item.pdf_url || '';
    getEl('bookCategory').value = item.category || 'fiction';
    getEl('bookDescription').value = item.description || '';
    getEl('bookModal').classList.add('active');
};
window.saveBook = async function() {
    const btn = getEl('saveBookBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...'; }
    try {
        const data = { title: getEl('bookTitle').value.trim(), author: getEl('bookAuthor').value.trim(), cover_url: getEl('bookCoverUrl').value.trim(), pdf_url: getEl('bookPdfUrl').value.trim(), category: getEl('bookCategory').value, description: getEl('bookDescription').value.trim() };
        const id = getEl('bookEditId').value;
        if (id) { const { error } = await supabase.from('flm_books').update(data).eq('id', id); if (error) throw error; showToast('Book updated!', 'success'); }
        else { const { error } = await supabase.from('flm_books').insert([data]); if (error) throw error; showToast('Book added!', 'success'); }
        closeBookModal(); fetchBooks();
    } catch (e) { showToast('Save failed: ' + e.message, 'error'); }
    finally { if (btn) { btn.disabled = false; btn.innerHTML = 'Save'; } }
};
window.deleteBook = async function(id) {
    if (!confirm('Delete this book?')) return;
    try { const { error } = await supabase.from('flm_books').delete().eq('id', id); if (error) throw error; showToast('Deleted!', 'success'); fetchBooks(); }
    catch (e) { showToast('Delete failed: ' + e.message, 'error'); }
};

let guidesData = [], guidesPage = 1, guidesSearch = '', guidesSearchDebounce;
const GUIDES_PER_PAGE = 10;
function setupGuidesManager() {
    const input = getEl('searchGuides');
    if (input) input.addEventListener('input', () => { clearTimeout(guidesSearchDebounce); guidesSearchDebounce = setTimeout(() => { guidesSearch = input.value.trim().toLowerCase(); guidesPage = 1; renderGuidesTable(); }, 150); });
    fetchGuides();
    supabase.channel('public:flm_guides').on('postgres_changes', { event: '*', schema: 'public', table: 'flm_guides' }, () => fetchGuides()).subscribe();
}
async function fetchGuides() {
    const { data, error } = await supabase.from('flm_guides').select('*').order('sort_order', { ascending: true });
    if (error) { console.warn('Guides load error:', error.message); guidesData = []; renderGuidesTable(); return; }
    guidesData = data || []; renderGuidesTable();
}
function renderGuidesTable() {
    const tb = getEl('guidesTableBody');
    if (!tb) return;
    let filtered = guidesData;
    if (guidesSearch) filtered = guidesData.filter(g => (g.question || '').toLowerCase().includes(guidesSearch) || (g.category || '').toLowerCase().includes(guidesSearch));
    const totalPages = Math.ceil(filtered.length / GUIDES_PER_PAGE);
    if (guidesPage > totalPages) guidesPage = totalPages || 1;
    const start = (guidesPage - 1) * GUIDES_PER_PAGE;
    const pageItems = filtered.slice(start, start + GUIDES_PER_PAGE);
    tb.innerHTML = pageItems.length ? '' : '<tr><td colspan="4" style="text-align:center;padding:40px;color:var(--text-muted)">No guides found</td></tr>';
    pageItems.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td>' + escapeHtml(item.category || '') + '</td>' +
            '<td><strong>' + escapeHtml(item.question) + '</strong></td>' +
            '<td>' + (item.sort_order || 1) + '</td>' +
            '<td><div class="action-buttons"><button class="action-btn" onclick="editGuide(\'' + item.id + '\')" title="Edit"><i class="fas fa-edit"></i></button><button class="action-btn delete" onclick="deleteGuide(\'' + item.id + '\')" title="Delete"><i class="fas fa-trash"></i></button></div></td>';
        tb.appendChild(tr);
    });
    renderSimplePagination('guidesPagination', totalPages, guidesPage, (p) => { guidesPage = p; renderGuidesTable(); });
}
function openGuideModal() { getEl('guideModalTitle').textContent = 'Add Guide'; getEl('guideEditId').value = ''; getEl('guideCategory').value = ''; getEl('guideSortOrder').value = '1'; getEl('guideQuestion').value = ''; getEl('guideAnswer').value = ''; getEl('guideModal').classList.add('active'); }
function closeGuideModal() { getEl('guideModal').classList.remove('active'); }
window.editGuide = function(id) {
    const item = guidesData.find(g => g.id == id);
    if (!item) return;
    getEl('guideModalTitle').textContent = 'Edit Guide';
    getEl('guideEditId').value = item.id;
    getEl('guideCategory').value = item.category || '';
    getEl('guideSortOrder').value = item.sort_order || 1;
    getEl('guideQuestion').value = item.question || '';
    getEl('guideAnswer').value = item.answer || '';
    getEl('guideModal').classList.add('active');
};
window.saveGuide = async function() {
    const btn = getEl('saveGuideBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...'; }
    try {
        const data = { category: getEl('guideCategory').value.trim(), sort_order: parseInt(getEl('guideSortOrder').value) || 1, question: getEl('guideQuestion').value.trim(), answer: getEl('guideAnswer').value.trim() };
        const id = getEl('guideEditId').value;
        if (id) { const { error } = await supabase.from('flm_guides').update(data).eq('id', id); if (error) throw error; showToast('Guide updated!', 'success'); }
        else { const { error } = await supabase.from('flm_guides').insert([data]); if (error) throw error; showToast('Guide added!', 'success'); }
        closeGuideModal(); fetchGuides();
    } catch (e) { showToast('Save failed: ' + e.message, 'error'); }
    finally { if (btn) { btn.disabled = false; btn.innerHTML = 'Save'; } }
};
window.deleteGuide = async function(id) {
    if (!confirm('Delete this guide?')) return;
    try { const { error } = await supabase.from('flm_guides').delete().eq('id', id); if (error) throw error; showToast('Deleted!', 'success'); fetchGuides(); }
    catch (e) { showToast('Delete failed: ' + e.message, 'error'); }
};

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

function formatDate(dateString) {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

window.switchTab = switchTab;
window.saveEdit = saveEdit;
window.closeModal = closeModal;
window.logout = logout;
window.exportData = exportData;
window.saveAdSettings = saveAdSettings;
window.loadAdSettings = loadAdSettings;

window.openNewsModal = openNewsModal;
window.closeNewsModal = closeNewsModal;
window.saveNews = saveNews;
window.editNews = editNews;
window.deleteNews = deleteNews;

window.openVideoModal = openVideoModal;
window.closeVideoModal = closeVideoModal;
window.saveVideo = saveVideo;
window.editVideo = editVideo;
window.deleteVideo = deleteVideo;

window.openGalleryModal = openGalleryModal;
window.closeGalleryModal = closeGalleryModal;
window.saveGallery = saveGallery;
window.editGallery = editGallery;
window.deleteGallery = deleteGallery;

window.openStoryModal = openStoryModal;
window.closeStoryModal = closeStoryModal;
window.saveStory = saveStory;
window.editStory = editStory;
window.deleteStory = deleteStory;

window.openMusicModal = openMusicModal;
window.closeMusicModal = closeMusicModal;
window.saveMusic = saveMusic;
window.editMusic = editMusic;
window.deleteMusic = deleteMusic;

window.openBookModal = openBookModal;
window.closeBookModal = closeBookModal;
window.saveBook = saveBook;
window.editBook = editBook;
window.deleteBook = deleteBook;

window.openGuideModal = openGuideModal;
window.closeGuideModal = closeGuideModal;
window.saveGuide = saveGuide;
window.editGuide = editGuide;
window.deleteGuide = deleteGuide;

document.addEventListener('DOMContentLoaded', () => {
    initLoginForm();
    initAuth();
});