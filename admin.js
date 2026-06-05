// admin.js — Admin Panel Logic (Supabase Version)
// ================================================
// LOGIN: Kept exactly from working old version
// NEW: 2 publish forms, sliders, file extensions, image styling

const MOD_URL_TEMPLATES = {};
let appsData = [];
let currentUser = null;
let currentPage = 1;
const itemsPerPage = 15;
let searchDebounce = null;
let adminInitialized = false;

function getEl(id) { return document.getElementById(id); }

/* ==========================================
   AUTHENTICATION FLOW — EXACTLY FROM OLD WORKING VERSION
   ========================================== */
async function initAuth() {
    if (typeof supabase === 'undefined') {
        showLoginError('Supabase not loaded. Check your internet connection and refresh.');
        return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
        await handleUser(session.user);
    } else {
        showLogin();
    }

    supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_OUT') {
            showLogin();
            return;
        }
        const user = session?.user ?? null;
        if (user) await handleUser(user);
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
            if (!adminInitialized) {
                adminInitialized = true;
                initAdmin();
            }
        } else {
            console.error('[Admin] Not an admin:', user.email, user.id);
            await supabase.auth.signOut();
            showLoginError('Access denied. You are not an admin. If you just signed up, the database trigger may not have run yet. Try again in 5 seconds, or run emergencyMakeAdmin() in the console (F12).');
        }
    } catch (e) {
        console.error('[Admin] Auth check error:', e);
        if (user.email === 'jack1122@freelightmods.com') {
            currentUser = user;
            showDashboard();
            updateUserInfo(user);
            if (!adminInitialized) {
                adminInitialized = true;
                initAdmin();
            }
        } else {
            await supabase.auth.signOut();
            showLoginError('Authentication error: ' + (e.message || 'Unknown'));
        }
    }
}

async function checkAdminStatus(user) {
    if (user.email === 'jack1122@freelightmods.com') return true;
    const { data, error } = await supabase
        .from('admins')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();
    if (error) {
        console.error('[Admin] checkAdminStatus DB error:', error);
        return false;
    }
    return !!data;
}

function showLogin() {
    const overlay = getEl('loginOverlay');
    const dash = getEl('adminDashboard');
    if (overlay) {
        overlay.style.display = 'flex';
        void overlay.offsetWidth;
        overlay.classList.remove('hidden');
    }
    if (dash) dash.style.display = 'none';
    adminInitialized = false;
    currentUser = null;
}

function showDashboard() {
    const overlay = getEl('loginOverlay');
    const dash = getEl('adminDashboard');
    if (overlay) {
        overlay.classList.add('hidden');
        setTimeout(() => { overlay.style.display = 'none'; }, 300);
    }
    if (dash) dash.style.display = 'flex';
}

function updateUserInfo(user) {
    const emailDisplay = getEl('userEmailDisplay');
    const accountEmail = getEl('accountEmail');
    if (emailDisplay) emailDisplay.textContent = user.email || 'Admin';
    if (accountEmail) accountEmail.value = user.email || '';
}

/* ==========================================
   LOGIN FORM — EXACTLY FROM OLD WORKING VERSION
   ========================================== */
function initLoginForm() {
    const form = getEl('authForm');
    if (!form) return;

    let mode = 'login';
    const tabs = document.querySelectorAll('.auth-tab');
    const errorDiv = getEl('authError');
    const btn = getEl('authBtn');
    const passwordGroup = getEl('passwordGroup');
    const confirmGroup = getEl('confirmPasswordGroup');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            mode = tab.getAttribute('data-tab');
            if (errorDiv) errorDiv.style.display = 'none';

            if (mode === 'signup') {
                passwordGroup.style.display = 'block';
                if (confirmGroup) confirmGroup.style.display = 'block';
                btn.innerHTML = '<i class="fas fa-user-plus"></i> <span>Create Account</span>';
            } else {
                passwordGroup.style.display = 'block';
                if (confirmGroup) confirmGroup.style.display = 'none';
                btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> <span>Login</span>';
            }
        });
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = getEl('email').value.trim();
        const password = getEl('password').value;
        if (errorDiv) errorDiv.style.display = 'none';
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Processing...</span>';

        try {
            if (mode === 'signup') {
                const confirm = getEl('confirmPassword') ? getEl('confirmPassword').value : '';
                if (confirm && password !== confirm) throw new Error('Passwords do not match');
                if (password.length < 6) throw new Error('Password must be at least 6 characters');

                const { data, error } = await supabase.auth.signUp({ email, password });
                if (error) throw error;

                if (data.user) {
                    try {
                        await supabase.from('admins').upsert({ id: data.user.id, email, role: 'admin' });
                    } catch (insertErr) {
                        console.warn('[Admin] Fallback insert failed (trigger should handle it):', insertErr);
                    }
                }

                if (data.session) {
                    showToast('Account created! Logging you in...', 'success');
                } else {
                    showToast('Account created! Please check your email to confirm, then log in.', 'success');
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-user-plus"></i> <span>Create Account</span>';
                }
            } else {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
            }
        } catch (err) {
            if (errorDiv) {
                errorDiv.textContent = err.message || 'An error occurred';
                errorDiv.style.display = 'block';
            }
            btn.disabled = false;
            btn.innerHTML = mode === 'signup'
                ? '<i class="fas fa-user-plus"></i> <span>Create Account</span>'
                : '<i class="fas fa-sign-in-alt"></i> <span>Login</span>';
        }
    });
}

function showLoginError(msg) {
    const errorDiv = getEl('authError');
    if (errorDiv) {
        errorDiv.textContent = msg;
        errorDiv.style.display = 'block';
    }
}

/* ==========================================
   EMERGENCY: Make Current User Admin
   ========================================== */
window.emergencyMakeAdmin = async function() {
    if (typeof supabase === 'undefined') {
        console.error('Supabase not loaded');
        return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        console.error('You are not logged in. Log in first, then run this again.');
        return;
    }
    console.log('Trying to promote:', user.email, user.id);
    const { error } = await supabase.from('admins').upsert({ id: user.id, email: user.email, role: 'admin' });
    if (error) {
        console.error('Failed:', error);
        console.log('Run this SQL in Supabase SQL Editor to fix manually:');
        console.log(`INSERT INTO public.admins (id, email, role) VALUES ('${user.id}', '${user.email}', 'admin') ON CONFLICT (id) DO NOTHING;`);
    } else {
        console.log('Success! Reloading page...');
        location.reload();
    }
};

/* ==========================================
   ADMIN INITIALIZATION
   ========================================== */
function initAdmin() {
    if (typeof supabase === 'undefined') {
        showToast('Supabase not available. Check that supabase.js loaded.', 'error');
        return;
    }
    setupRealtime();
    setupTabs();
    setupForm();
    setupImageForm();
    setupImagePreview();
    setupSearch();
    setupMobileSidebar();
    setupLogout();
    setupTableActions();
    fetchApps();
}

/* ==========================================
   REALTIME & DATA FETCHING
   ========================================== */
function setupRealtime() {
    if (window.apksChannel) {
        supabase.removeChannel(window.apksChannel);
    }
    window.apksChannel = supabase
        .channel('public:apks')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'apks' }, () => {
            fetchApps();
        })
        .subscribe((status) => {
            if (status !== 'SUBSCRIBED') {
                console.warn('[Realtime] Status:', status);
            }
        });
}

async function fetchApps() {
    const { data, error } = await supabase
        .from('apks')
        .select('*')
        .order('date_added', { ascending: false });
    if (error) {
        console.error('[Admin] Fetch error:', error);
        showToast('Failed to load apps: ' + error.message, 'error');
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
        dateAdded: row.date_added,
        fileExtension: row.file_extension || 'apk',
        sliderSection: row.slider_section,
        aspectRatio: row.aspect_ratio || '16:9',
        borderRadius: row.border_radius || '16px',
        borderStyle: row.border_style || 'none'
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
   IMAGE PREVIEW (for Add Image tab)
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
            if (url && url.startsWith('http')) {
                previewBox.innerHTML = '<img src="' + escapeHtml(url) + '" alt="Preview" onerror="this.style.display='none';this.parentElement.innerHTML='<span style=color:var(--accent-danger)><i class=\'fas fa-exclamation-circle\'></i> Failed to load</span>'">';
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
    if (q) {
        filtered = appsData.filter(a =>
            (a.name || '').toLowerCase().includes(q) ||
            (a.mod || '').toLowerCase().includes(q)
        );
    }
    tb.innerHTML = '';
    if (filtered.length === 0) {
        tb.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-secondary)">No items found</td></tr>';
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
    const sliderBadge = app.sliderSection ? `<span style="display:inline-block;margin-left:6px;padding:2px 8px;border-radius:6px;background:linear-gradient(135deg,var(--accent-cyan),var(--accent-purple));color:var(--bg-primary);font-size:0.7rem;font-weight:700">S${app.sliderSection}</span>` : '';
    nameCell.innerHTML = '<strong>' + escapeHtml(app.name) + '</strong>' + sliderBadge + '<br><small class="text-secondary">' + escapeHtml(app.category || 'app') + '</small>';

    const versionCell = document.createElement('td'); versionCell.textContent = app.version || 'N/A';
    const sizeCell = document.createElement('td'); sizeCell.textContent = app.size || 'N/A';

    const extCell = document.createElement('td');
    extCell.innerHTML = '<span style="font-family:monospace;font-size:0.8rem;color:var(--accent-cyan)">.' + escapeHtml(app.fileExtension || 'apk') + '</span>';

    const sliderCell = document.createElement('td');
    if (app.sliderSection) {
        sliderCell.innerHTML = '<span style="display:inline-block;padding:4px 10px;border-radius:20px;background:rgba(0,242,254,0.1);color:var(--accent-cyan);font-size:0.75rem;font-weight:700;border:1px solid rgba(0,242,254,0.2)">Slider ' + app.sliderSection + '</span>';
    } else {
        sliderCell.innerHTML = '<span style="color:var(--text-secondary);font-size:0.8rem">—</span>';
    }

    const linkCell = document.createElement('td');
    const hasLink = app.link && app.link.startsWith('http');
    linkCell.innerHTML = hasLink
        ? '<span style="color:var(--accent-success);font-size:0.8rem"><i class="fas fa-check-circle"></i> Set</span>'
        : '<span style="color:var(--accent-danger);font-size:0.8rem"><i class="fas fa-times-circle"></i> Missing</span>';

    const actionsCell = document.createElement('td');
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'action-buttons';
    actionsDiv.innerHTML = `
        <button class="action-btn" data-action="edit" data-id="${escapeHtml(app.id)}" title="Edit"><i class="fas fa-edit"></i></button>
        <button class="action-btn delete" data-action="delete" data-id="${escapeHtml(app.id)}" title="Delete"><i class="fas fa-trash"></i></button>
    `;
    actionsCell.appendChild(actionsDiv);

    tr.appendChild(iconCell); 
    tr.appendChild(nameCell); 
    tr.appendChild(versionCell);
    tr.appendChild(sizeCell); 
    tr.appendChild(extCell); 
    tr.appendChild(sliderCell); 
    tr.appendChild(linkCell); 
    tr.appendChild(actionsCell);
    return tr;
}

/* ==========================================
   TABLE EVENT DELEGATION
   ========================================== */
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

/* ==========================================
   PAGINATION
   ========================================== */
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

    const info = document.createElement('span');
    info.className = 'page-info';
    info.textContent = currentPage + ' / ' + totalPages;
    fragment.appendChild(info);

    container.appendChild(fragment);
}

/* ==========================================
   SEARCH
   ========================================== */
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
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';

        try {
            const linkValue = getEl('appLink').value.trim();
            if (!linkValue || !linkValue.startsWith('http')) {
                throw new Error('Please enter a valid download link starting with http:// or https://');
            }

            const newApp = {
                name: getEl('appName').value.trim(),
                version: getEl('appVersion').value.trim(),
                size: getEl('appSize').value.trim(),
                icon: getEl('appIcon').value.trim() || 'fas fa-mobile-alt',
                image: getEl('appImage').value.trim(),
                mod: getEl('appMod').value.trim(),
                link: linkValue,
                category: getEl('appCategory').value,
                downloads: 0,
                file_extension: getEl('appFileExt').value,
                slider_section: getEl('appSliderSection').value ? parseInt(getEl('appSliderSection').value) : null,
                aspect_ratio: getEl('appAspectRatio').value,
                border_radius: getEl('appBorderRadius').value,
                border_style: getEl('appBorderStyle').value
            };

            const { error } = await supabase.from('apks').insert([newApp]);
            if (error) throw error;

            f.reset();
            showToast('Mod / Game added successfully!', 'success');
            setTimeout(() => switchTab('apps'), 600);
        } catch (err) {
            console.error('[Admin] Add error:', err);
            let msg = 'Failed to add: ' + err.message;
            if (err.code === '42501' || err.message?.includes('row-level security')) {
                msg = 'Permission denied. Make sure you ran the SQL setup in Supabase.';
            }
            if (err.message && err.message.includes('column')) {
                msg = 'Database columns missing. Please run the schema.sql in Supabase SQL Editor first!';
            }
            showToast(msg, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-plus"></i> Add Mod / Game';
        }
    });
}

/* ==========================================
   ADD IMAGE FORM
   ========================================== */
function setupImageForm() {
    const f = getEl('addImageForm');
    if (!f) return;

    f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = f.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Publishing...';

        try {
            const linkValue = getEl('imgLink').value.trim();
            const imgValue = getEl('imgImage').value.trim();
            if (!linkValue || !linkValue.startsWith('http')) {
                throw new Error('Please enter a valid download link starting with http:// or https://');
            }
            if (!imgValue || !imgValue.startsWith('http')) {
                throw new Error('Please enter a valid image URL starting with http:// or https://');
            }

            const newItem = {
                name: getEl('imgName').value.trim(),
                version: getEl('imgVersion').value.trim() || 'v1.0',
                size: getEl('imgSize').value.trim() || 'N/A',
                icon: getEl('imgIcon').value.trim() || 'fas fa-image',
                image: imgValue,
                mod: getEl('imgMod').value.trim(),
                link: linkValue,
                category: getEl('imgCategory').value,
                downloads: 0,
                file_extension: getEl('imgFileExt').value,
                slider_section: getEl('imgSliderSection').value ? parseInt(getEl('imgSliderSection').value) : null,
                aspect_ratio: getEl('imgAspectRatio').value,
                border_radius: getEl('imgBorderRadius').value,
                border_style: getEl('imgBorderStyle').value
            };

            const { error } = await supabase.from('apks').insert([newItem]);
            if (error) throw error;

            f.reset();
            const previewBox = getEl('imgPreviewBox');
            if (previewBox) {
                previewBox.innerHTML = '<span style="color:var(--text-secondary);font-size:0.85rem"><i class="fas fa-image"></i> Image preview will appear here</span>';
            }
            showToast('Image published successfully!', 'success');
            setTimeout(() => switchTab('apps'), 600);
        } catch (err) {
            console.error('[Admin] Image add error:', err);
            let msg = 'Failed to publish image: ' + err.message;
            if (err.code === '42501' || err.message?.includes('row-level security')) {
                msg = 'Permission denied. Make sure you ran the SQL setup in Supabase.';
            }
            if (err.message && err.message.includes('column')) {
                msg = 'Database columns missing. Please run the schema.sql in Supabase SQL Editor first!';
            }
            showToast(msg, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-plus"></i> Publish Image';
        }
    });
}

/* ==========================================
   EDIT & DELETE
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
    getEl('editFileExt').value = app.fileExtension || 'apk';
    getEl('editSliderSection').value = app.sliderSection || '';
    getEl('editAspectRatio').value = app.aspectRatio || '16:9';
    getEl('editBorderRadius').value = app.borderRadius || '16px';
    getEl('editBorderStyle').value = app.borderStyle || 'none';

    const modal = getEl('editModal');
    if (modal) modal.classList.add('active');
}

async function saveEdit() {
    const id = getEl('editId').value;
    if (!id) return;
    const btn = getEl('saveEditBtn');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
        const linkValue = getEl('editLink').value.trim();
        const { error } = await supabase.from('apks').update({
            name: getEl('editName').value.trim(),
            version: getEl('editVersion').value.trim(),
            size: getEl('editSize').value.trim(),
            icon: getEl('editIcon').value.trim(),
            image: getEl('editImage').value.trim(),
            mod: getEl('editMod').value.trim(),
            link: linkValue,
            category: getEl('editCategory').value,
            file_extension: getEl('editFileExt').value,
            slider_section: getEl('editSliderSection').value ? parseInt(getEl('editSliderSection').value) : null,
            aspect_ratio: getEl('editAspectRatio').value,
            border_radius: getEl('editBorderRadius').value,
            border_style: getEl('editBorderStyle').value
        }).eq('id', id);
        if (error) throw error;
        closeModal();
        showToast('Item updated successfully!', 'success');
    } catch (e) {
        console.error('[Admin] Edit error:', e);
        let msg = 'Update failed: ' + e.message;
        if (e.code === '42501' || e.message?.includes('row-level security')) {
            msg = 'Permission denied. Check Supabase RLS policies.';
        }
        if (e.message && e.message.includes('column')) {
            msg = 'Database columns missing. Run schema.sql in Supabase first!';
        }
        showToast(msg, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Save Changes';
    }
}

function closeModal() {
    const modal = getEl('editModal');
    if (modal) modal.classList.remove('active');
}

async function deleteApp(id) {
    if (!confirm('Are you sure you want to delete this item permanently?')) return;
    try {
        const { error } = await supabase.from('apks').delete().eq('id', id);
        if (error) throw error;
        showToast('Item deleted', 'success');
    } catch (e) {
        console.error('[Admin] Delete error:', e);
        let msg = 'Delete failed: ' + e.message;
        if (e.code === '42501' || e.message?.includes('row-level security')) {
            msg = 'Permission denied. Check Supabase RLS policies.';
        }
        showToast(msg, 'error');
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
    const setText = (id, val) => { const el = getEl(id); if (el) el.textContent = val; };
    setText('totalApps', total);
    setText('totalDownloads', formatNum(downloads));
    setText('gamesCount', games);
    setText('imagesCount', images);
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

async function logout() {
    if (!confirm('Are you sure you want to logout?')) return;
    try {
        await supabase.auth.signOut();
        location.reload();
    } catch (err) {
        console.error('[Admin] Logout error:', err);
        showToast('Logout failed', 'error');
    }
}

/* ==========================================
   TOAST NOTIFICATIONS
   ========================================== */
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
   GLOBAL WINDOW EXPOSURES
   ========================================== */
window.switchTab = switchTab;
window.editApp = editApp;
window.deleteApp = deleteApp;
window.saveEdit = saveEdit;
window.closeModal = closeModal;
window.logout = logout;
window.exportData = exportData;

/* ==========================================
   BOOT
   ========================================== */
document.addEventListener('DOMContentLoaded', () => {
    initLoginForm();
    initAuth();
});
