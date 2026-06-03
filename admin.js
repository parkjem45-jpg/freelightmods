// admin.js — Admin Panel Logic (Fixed Version)
// ================================================
// Fixed: Link field properly handled in edit/save operations.
// Added: Better error handling, validation, and data integrity.

const MOD_URL_TEMPLATES = {
    // 'spotify-premium': 'https://example.com/spotify.apk',
};

let appsData = [];
let currentUser = null;
let currentPage = 1;
const itemsPerPage = 15;
let unsubscribe = null;
let searchDebounce = null;
let adminInitialized = false;

/* ==========================================
   DOM HELPERS
   ========================================== */
function getEl(id) { return document.getElementById(id); }

/* ==========================================
   AUTHENTICATION FLOW
   ========================================== */
function initAuth() {
    if (typeof auth === 'undefined') {
        console.warn('[Admin] Firebase Auth not loaded');
        showLoginError('Firebase not loaded. Please check your connection.');
        return;
    }

    auth.onAuthStateChanged(async (user) => {
        if (user) {
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
                    await auth.signOut();
                    showLoginError('Access denied. You are not an admin.');
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
                    await auth.signOut();
                    showLoginError('Authentication error. Please try again.');
                }
            }
        } else {
            showLogin();
        }
    });
}

async function checkAdminStatus(user) {
    if (user.email === 'jack1122@freelightmods.com') return true;
    try {
        const doc = await db.collection('admins').doc(user.uid).get();
        return doc.exists;
    } catch (e) {
        return false;
    }
}

function showLogin() {
    const overlay = getEl('loginOverlay');
    const dash = getEl('adminDashboard');
    if (overlay) {
        overlay.classList.remove('hidden');
        overlay.style.display = 'flex';
    }
    if (dash) dash.style.display = 'none';
}

function showDashboard() {
    const overlay = getEl('loginOverlay');
    const dash = getEl('adminDashboard');
    if (overlay) {
        overlay.classList.add('hidden');
        setTimeout(() => { overlay.style.display = 'none'; }, 300);
    }
    if (dash) {
        dash.style.display = 'flex';
    }
}

function updateUserInfo(user) {
    const emailDisplay = getEl('userEmailDisplay');
    const accountEmail = getEl('accountEmail');
    if (emailDisplay) emailDisplay.textContent = user.email || 'Admin';
    if (accountEmail) accountEmail.value = user.email || '';
}

/* ==========================================
   LOGIN FORM
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
                confirmGroup.style.display = 'block';
                btn.innerHTML = '<i class="fas fa-user-plus"></i> <span>Create Account</span>';
            } else {
                passwordGroup.style.display = 'block';
                confirmGroup.style.display = 'none';
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
                const confirm = getEl('confirmPassword').value;
                if (password !== confirm) throw new Error('Passwords do not match');
                if (password.length < 6) throw new Error('Password must be at least 6 characters');

                const cred = await auth.createUserWithEmailAndPassword(email, password);
                await db.collection('admins').doc(cred.user.uid).set({
                    email: email,
                    role: 'admin',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                showToast('Account created! Logging in...', 'success');
                await auth.signInWithEmailAndPassword(email, password);
            } else {
                await auth.signInWithEmailAndPassword(email, password);
            }
        } catch (err) {
            if (errorDiv) {
                errorDiv.textContent = getReadableError(err);
                errorDiv.style.display = 'block';
            }
            btn.disabled = false;
            btn.innerHTML = mode === 'signup'
                ? '<i class="fas fa-user-plus"></i> <span>Create Account</span>'
                : '<i class="fas fa-sign-in-alt"></i> <span>Login</span>';
        }
    });
}

function getReadableError(error) {
    const messages = {
        'auth/invalid-email': 'Invalid email address.',
        'auth/user-disabled': 'This account has been disabled.',
        'auth/user-not-found': 'No account found with this email.',
        'auth/wrong-password': 'Incorrect password.',
        'auth/email-already-in-use': 'Email is already registered.',
        'auth/weak-password': 'Password should be at least 6 characters.',
        'auth/network-request-failed': 'Network error. Check your connection.',
        'auth/too-many-requests': 'Too many attempts. Try again later.',
        'auth/invalid-credential': 'Invalid email or password.'
    };
    return messages[error.code] || error.message;
}

function showLoginError(msg) {
    const errorDiv = getEl('authError');
    if (errorDiv) {
        errorDiv.textContent = msg;
        errorDiv.style.display = 'block';
    }
}

/* ==========================================
   ADMIN INITIALIZATION (Guarded)
   ========================================== */
function initAdmin() {
    setupRealtime();
    setupTabs();
    setupForm();
    setupSearch();
    setupMobileSidebar();
    setupLogout();
    setupTableActions();
}

function setupRealtime() {
    if (unsubscribe && typeof unsubscribe === 'function') {
        try { unsubscribe(); } catch (e) {}
    }

    try {
        unsubscribe = db.collection('apks')
            .orderBy('dateAdded', 'desc')
            .onSnapshot((snapshot) => {
                appsData = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    if (MOD_URL_TEMPLATES[doc.id]) {
                        data.link = MOD_URL_TEMPLATES[doc.id];
                    }
                    // Ensure link field always exists
                    if (!data.link) data.link = '';
                    appsData.push({ id: doc.id, ...data });
                });
                currentPage = 1;
                renderTable();
                updateStats();
            }, (error) => {
                console.error('[Admin] Realtime error:', error);
                showToast('Failed to load apps. Check connection.', 'error');
            });
    } catch (e) {
        console.error('[Admin] Setup realtime error:', e);
        showToast('Database connection failed.', 'error');
    }
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

    if (tabId === 'apps') {
        currentPage = 1;
        renderTable();
    }
}

function setupMobileSidebar() {
    const toggle = getEl('mobileToggle');
    const sidebar = getEl('sidebar');
    if (toggle && sidebar) {
        toggle.addEventListener('click', () => sidebar.classList.toggle('open'));
    }
}

function setupLogout() {
    const logoutNav = getEl('logoutNavItem');
    if (logoutNav) {
        logoutNav.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }
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
        tb.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-secondary)">No apps found</td></tr>';
        renderPagination(0);
        return;
    }

    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    if (currentPage > totalPages) currentPage = totalPages || 1;

    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageItems = filtered.slice(start, end);

    const fragment = document.createDocumentFragment();
    pageItems.forEach(app => {
        const tr = buildTableRow(app);
        fragment.appendChild(tr);
    });

    tb.appendChild(fragment);
    attachTableImageHandlers(tb);
    renderPagination(filtered.length);
}

function buildTableRow(app) {
    const tr = document.createElement('tr');
    tr.setAttribute('data-app-id', app.id);

    // Build icon cell
    const iconCell = document.createElement('td');
    const iconDiv = document.createElement('div');
    iconDiv.className = 'app-icon-small';
    if (app.image && app.image.trim()) {
        const img = document.createElement('img');
        img.src = app.image;
        img.alt = app.name || 'App';
        img.loading = 'lazy';
        img.dataset.fallback = 'true';
        iconDiv.appendChild(img);
    } else {
        iconDiv.innerHTML = '<i class="' + escapeHtml(app.icon || 'fas fa-mobile-alt') + '"></i>';
    }
    iconCell.appendChild(iconDiv);

    // Name cell
    const nameCell = document.createElement('td');
    nameCell.innerHTML = '<strong>' + escapeHtml(app.name) + '</strong><br><small class="text-secondary">' + escapeHtml(app.category || 'app') + '</small>';

    // Other cells
    const versionCell = document.createElement('td');
    versionCell.textContent = app.version || 'N/A';

    const sizeCell = document.createElement('td');
    sizeCell.textContent = app.size || 'N/A';

    const downloadsCell = document.createElement('td');
    downloadsCell.textContent = formatNum(app.downloads || 0);

    // Link indicator cell
    const linkCell = document.createElement('td');
    const hasLink = app.link && app.link.startsWith('http');
    linkCell.innerHTML = hasLink
        ? '<span style="color:var(--accent-success);font-size:0.8rem"><i class="fas fa-check-circle"></i> Set</span>'
        : '<span style="color:var(--accent-danger);font-size:0.8rem"><i class="fas fa-times-circle"></i> Missing</span>';

    // Actions cell
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
    tr.appendChild(downloadsCell);
    tr.appendChild(linkCell);
    tr.appendChild(actionsCell);

    return tr;
}

/* ==========================================
   TABLE EVENT DELEGATION (Edit/Delete)
   ========================================== */
function setupTableActions() {
    const tbody = getEl('appsTableBody');
    if (!tbody) return;

    tbody.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;

        const action = btn.getAttribute('data-action');
        const id = btn.getAttribute('data-id');

        if (action === 'edit') {
            editApp(id);
        } else if (action === 'delete') {
            deleteApp(id);
        }
    });
}

/* ==========================================
   IMAGE ERROR HANDLING
   ========================================== */
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

    // Prev
    const prevBtn = document.createElement('button');
    prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
    prevBtn.disabled = currentPage === 1;
    prevBtn.addEventListener('click', () => {
        if (currentPage > 1) { currentPage--; renderTable(); }
    });
    fragment.appendChild(prevBtn);

    // Pages
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

    // Next
    const nextBtn = document.createElement('button');
    nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.addEventListener('click', () => {
        if (currentPage < totalPages) { currentPage++; renderTable(); }
    });
    fragment.appendChild(nextBtn);

    // Info
    const info = document.createElement('span');
    info.className = 'page-info';
    info.textContent = currentPage + ' / ' + totalPages;
    fragment.appendChild(info);

    container.appendChild(fragment);
}

/* ==========================================
   SEARCH (Debounced)
   ========================================== */
function setupSearch() {
    const input = getEl('searchApps');
    if (!input) return;

    input.addEventListener('input', () => {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(() => {
            currentPage = 1;
            renderTable();
        }, 150);
    });
}

/* ==========================================
   ADD APK FORM
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

            // Validate download link
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
                dateAdded: firebase.firestore.FieldValue.serverTimestamp()
            };

            await db.collection('apks').add(newApp);
            f.reset();
            showToast('APK added successfully!', 'success');
            setTimeout(() => switchTab('apps'), 600);
        } catch (err) {
            console.error('[Admin] Add error:', err);
            showToast('Failed to add APK: ' + err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-plus"></i> Add APK';
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

        await db.collection('apks').doc(id).update({
            name: getEl('editName').value.trim(),
            version: getEl('editVersion').value.trim(),
            size: getEl('editSize').value.trim(),
            icon: getEl('editIcon').value.trim(),
            image: getEl('editImage').value.trim(),
            mod: getEl('editMod').value.trim(),
            link: linkValue,
            category: getEl('editCategory').value
        });
        closeModal();
        showToast('APK updated successfully!', 'success');
    } catch (e) {
        console.error('[Admin] Edit error:', e);
        showToast('Update failed: ' + e.message, 'error');
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
    if (!confirm('Are you sure you want to delete this APK permanently?')) return;
    try {
        await db.collection('apks').doc(id).delete();
        showToast('APK deleted', 'success');
    } catch (e) {
        console.error('[Admin] Delete error:', e);
        showToast('Delete failed: ' + e.message, 'error');
    }
}

/* ==========================================
   STATS & UTILITIES
   ========================================== */
function updateStats() {
    const total = appsData.length;
    const downloads = appsData.reduce((s, a) => s + (a.downloads || 0), 0);
    const games = appsData.filter(a => a.category === 'game').length;
    const apps = appsData.filter(a => a.category === 'app').length;

    const setText = (id, val) => {
        const el = getEl(id);
        if (el) el.textContent = val;
    };

    setText('totalApps', total);
    setText('totalDownloads', formatNum(downloads));
    setText('gamesCount', games);
    setText('appsCount', apps);
}

function exportData() {
    if (appsData.length === 0) {
        showToast('No data to export', 'warning');
        return;
    }
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

function logout() {
    if (!confirm('Are you sure you want to logout?')) return;
    auth.signOut().then(() => {
        location.reload();
    }).catch(err => {
        console.error('[Admin] Logout error:', err);
        showToast('Logout failed', 'error');
    });
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