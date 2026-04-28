// admin.js
let appsData = [];
let currentUser = null;
let currentPage = 1;
const itemsPerPage = 20;
let unsubscribe = null;

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

// Mobile Sidebar
const sidebar = document.querySelector('.sidebar');
document.querySelector('.mobile-toggle')?.addEventListener('click', () => sidebar?.classList.toggle('open'));

// Auth State
auth.onAuthStateChanged(async (user) => {
    if (user) {
        try {
            const doc = await db.collection('admins').doc(user.uid).get();
            if (doc.exists || user.email === 'jack1122@freelightmods.com') {
                currentUser = user;
                document.body.classList.add('authenticated');
                const emailEl = document.querySelector('.user-email');
                if (emailEl) emailEl.textContent = user.email;
                initAdmin();
            } else {
                alert('Access denied.'); auth.signOut();
            }
        } catch (e) {
            if (user.email === 'jack1122@freelightmods.com') { currentUser = user; initAdmin(); }
            else { alert('Error checking admin status.'); auth.signOut(); }
        }
    } else {
        showLogin();
    }
});

function initAdmin() {
    setupRealtime();
    setupTabs();
    setupForm();
    setupSearch();
    window.saveEdit = saveEdit;
    window.closeModal = () => document.getElementById('editModal').classList.remove('active');
    window.deleteApp = deleteApp;
    window.goToPage = p => { currentPage = p; renderTable(); };
    window.exportData = () => {
        const blob = new Blob([JSON.stringify(appsData, null, 2)], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `flm-backup-${Date.now()}.json`; a.click();
    };
    window.logout = () => { if(confirm('Logout?')) auth.signOut().then(() => location.reload()); };
}

function showLogin() {
    document.body.innerHTML = `
    <div class="login-container"><div class="login-box">
      <div class="login-header"><i class="fas fa-shield-alt"></i><h1>Admin Access</h1><p>Sign in to manage mods</p></div>
      <div class="auth-tabs">
        <button class="auth-tab active" data-tab="login">Login</button>
        <button class="auth-tab" data-tab="signup">Create</button>
      </div>
      <form id="authForm">
        <div class="form-group"><label><i class="fas fa-envelope"></i> Email</label><input type="email" id="email" required></div>
        <div class="form-group"><label><i class="fas fa-lock"></i> Password</label><input type="password" id="password" required></div>
        <div id="authError" class="login-error"></div>
        <button type="submit" class="login-btn" id="authBtn"><i class="fas fa-sign-in-alt"></i> Login</button>
      </form>
      <div style="margin-top:16px;text-align:center"><a href="index.html"><i class="fas fa-arrow-left"></i> Back to Site</a></div>
    </div></div>`;
  
    let mode = 'login';
    document.querySelectorAll('.auth-tab').forEach(t => t.addEventListener('click', e => {
        document.querySelectorAll('.auth-tab').forEach(x => x.classList.remove('active'));
        e.target.classList.add('active'); mode = e.target.dataset.tab;
        document.getElementById('authBtn').innerHTML = mode === 'signup' ? '<i class="fas fa-user-plus"></i> Create Account' : '<i class="fas fa-sign-in-alt"></i> Login';
    }));
    
    document.getElementById('authForm').addEventListener('submit', async e => {
        e.preventDefault();
        const em = document.getElementById('email').value.trim(), pw = document.getElementById('password').value;
        const err = document.getElementById('authError'); const btn = document.getElementById('authBtn');
        btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...'; err.style.display = 'none';
        
        try {
            if (mode === 'signup') {
                if (pw.length < 6) throw new Error('Password must be 6+ chars');
                const u = await auth.createUserWithEmailAndPassword(em, pw);
                await db.collection('admins').doc(u.user.uid).set({ email: em, role: 'admin', createdAt: firebase.firestore.FieldValue.serverTimestamp() });
                alert('Account created. Please login.');
                document.querySelector('[data-tab="login"]').click();
            } else {
                await auth.signInWithEmailAndPassword(em, pw);
            }
        } catch (e) {
            err.textContent = e.message; err.style.display = 'block';
        } finally {
            btn.disabled = false; btn.innerHTML = mode === 'signup' ? '<i class="fas fa-user-plus"></i> Create Account' : '<i class="fas fa-sign-in-alt"></i> Login';
        }
    });
}

function setupRealtime() {
    if (unsubscribe) unsubscribe();
    unsubscribe = db.collection('apks').orderBy('dateAdded', 'desc').onSnapshot(s => {
        appsData = []; s.forEach(d => appsData.push({ id: d.id, ...d.data() }));
        renderTable(); updateStats();
    }, e => console.error('Realtime error', e));
}

function setupTabs() {
    document.querySelectorAll('[data-tab]').forEach(t => t.addEventListener('click', e => {
        e.preventDefault();
        document.querySelectorAll('.tab-content').forEach(x => x.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(x => x.classList.remove('active'));
        document.getElementById(e.target.dataset.tab)?.classList.add('active');
        e.target.closest('.nav-item')?.classList.add('active');
    }));
}

function renderTable() {
    const tb = document.getElementById('appsTableBody'); if (!tb) return;
    const q = (document.getElementById('searchApps')?.value || '').toLowerCase();
    let f = appsData.filter(a => (a.name||'').toLowerCase().includes(q) || (a.mod||'').toLowerCase().includes(q));
    tb.innerHTML = '';
    if (f.length === 0) { tb.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px">No apps found</td></tr>'; return; }
    
    f.slice(0, 20).forEach(a => {
        const icon = a.image ? `<img src="${a.image}" onerror="this.parentElement.innerHTML='<i class=\\'fas fa-mobile-alt\\'></i>'">` : `<i class="${a.icon||'fas fa-mobile-alt'}"></i>`;
        tb.innerHTML += `
        <tr>
            <td><div class="app-icon-small">${icon}</div></td>
            <td><strong>${a.name}</strong><br><small class="text-secondary">${a.category||'app'}</small></td>
            <td>${a.version||'N/A'}</td><td>${a.size||'N/A'}</td>
            <td>${a.downloads||0}</td>
            <td>
            <div class="action-buttons">
                <button class="action-btn" onclick="editApp('${a.id}')"><i class="fas fa-edit"></i></button>
                <button class="action-btn delete" onclick="deleteApp('${a.id}')"><i class="fas fa-trash"></i></button>
            </div>
            </td>
        </tr>`;
    });
}

function setupSearch() {
    document.getElementById('searchApps')?.addEventListener('input', renderTable);
}

function setupForm() {
    const f = document.getElementById('addApkForm'); if (!f) return;
    f.addEventListener('submit', async e => {
        e.preventDefault(); const btn = f.querySelector('button[type="submit"]');
        btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';
        try {
            await db.collection('apks').add({
                name: f.appName.value.trim(), version: f.appVersion.value.trim(), size: f.appSize.value.trim(),
                icon: f.appIcon.value.trim() || 'fas fa-mobile-alt', image: f.appImage.value.trim(),
                mod: f.appMod.value.trim(), link: f.appLink.value.trim(), category: f.appCategory.value,
                downloads: 0, dateAdded: firebase.firestore.FieldValue.serverTimestamp()
            });
            f.reset(); showMessage('✅ Added successfully!', 'success');
            setTimeout(() => document.querySelector('[data-tab="apps"]').click(), 500);
        } catch (err) { showMessage('❌ ' + err.message, 'error'); }
        finally { btn.disabled = false; btn.innerHTML = '<i class="fas fa-plus"></i> Add APK'; }
    });
}

function showMessage(t, type) {
    const d = document.getElementById('formMessage'); if (!d) return;
    d.textContent = t; d.style.display = 'block';
    d.style.background = type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(245,87,108,0.15)';
    d.style.color = type === 'success' ? '#10b981' : '#f5576c';
    d.style.border = `1px solid ${type === 'success' ? '#10b981' : '#f5576c'}`;
    setTimeout(() => d.style.display = 'none', 4000);
}

function editApp(id) {
    const a = appsData.find(x => x.id === id); if (!a) return;
    document.getElementById('editId').value = id;
    ['Name','Version','Size','Icon','Image','Mod','Link','Category'].forEach(k => {
        document.getElementById('edit'+k).value = a[k.toLowerCase()] || '';
    });
    document.getElementById('editModal').classList.add('active');
}

async function saveEdit() {
    const id = document.getElementById('editId').value; if (!id) return;
    const btn = document.querySelector('#editModal .btn-primary');
    btn.disabled = true; btn.innerHTML = 'Saving...';
    try {
        await db.collection('apks').doc(id).update({
            name: document.getElementById('editName').value.trim(),
            version: document.getElementById('editVersion').value.trim(),
            size: document.getElementById('editSize').value.trim(),
            icon: document.getElementById('editIcon').value.trim(),
            image: document.getElementById('editImage').value.trim(),
            mod: document.getElementById('editMod').value.trim(),
            link: document.getElementById('editLink').value.trim(),
            category: document.getElementById('editCategory').value
        });
        document.getElementById('editModal').classList.remove('active');
        showMessage('✅ Updated!', 'success');
    } catch (e) { alert(e.message); }
    finally { btn.disabled = false; btn.innerHTML = 'Save Changes'; }
}

async function deleteApp(id) {
    if (!confirm('Delete permanently?')) return;
    try { await db.collection('apks').doc(id).delete(); showMessage('✅ Deleted', 'success'); }
    catch (e) { alert(e.message); }
}

function updateStats() {
    const el = id => document.getElementById(id);
    if (el('totalApps')) el('totalApps').textContent = appsData.length;
    if (el('totalDownloads')) el('totalDownloads').textContent = appsData.reduce((s,a)=>s+(a.downloads||0),0);
    if (el('gamesCount')) el('gamesCount').textContent = appsData.filter(a=>a.category==='game').length;
    if (el('appsCount')) el('appsCount').textContent = appsData.filter(a=>a.category==='app').length;
}