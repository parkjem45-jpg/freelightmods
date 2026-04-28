// ============================================
// Free Lite Mods - Admin Panel
// Local Storage Version - No Firestore Needed
// ============================================

// State
let appsData = [];
let currentUser = null;
let currentPage = 1;
const itemsPerPage = 15;

// ============================================
// Auth Check
// ============================================
if (typeof auth !== 'undefined') {
  auth.onAuthStateChanged((user) => {
    if (user) {
      if (window.ADMIN_EMAILS && window.ADMIN_EMAILS.includes(user.email)) {
        currentUser = user;
        document.body.classList.add('authenticated');
        updateUserInfo(user);
        initAdminPanel();
      } else {
        alert('⚠️ Access denied. Admin only.');
        auth.signOut();
      }
    } else {
      showLoginPage();
    }
  });
} else {
  showLoginPage();
}

function updateUserInfo(user) {
  const userName = document.querySelector('.user-name');
  const accountEmail = document.getElementById('accountEmail');
  if (userName) userName.textContent = user.email || 'Admin';
  if (accountEmail) accountEmail.value = user.email || '';
}

// ============================================
// Init Panel
// ============================================
function initAdminPanel() {
  loadLocalData();
  initTheme();
  initSidebar();
  initTabs();
  setupForm();
  setupSearch();
  setupModal();
  updateStats();
  renderAppsTable();
}

// ============================================
// Local Data CRUD
// ============================================
function loadLocalData() {
  const stored = localStorage.getItem('apkData');
  if (stored) {
    try {
      appsData = JSON.parse(stored);
    } catch (e) {
      appsData = [...window.DEFAULT_APPS];
      saveLocalData();
    }
  } else {
    appsData = [...window.DEFAULT_APPS];
    saveLocalData();
  }
}

function saveLocalData() {
  localStorage.setItem('apkData', JSON.stringify(appsData));
}

function addApp(appData) {
  const newApp = {
    id: 'app_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    ...appData,
    downloads: 0,
    dateAdded: new Date().toISOString()
  };
  appsData.unshift(newApp);
  saveLocalData();
  return newApp;
}

function updateApp(id, updates) {
  const index = appsData.findIndex(a => a.id === id);
  if (index !== -1) {
    appsData[index] = { ...appsData[index], ...updates, updatedAt: new Date().toISOString() };
    saveLocalData();
    return true;
  }
  return false;
}

function deleteAppById(id) {
  appsData = appsData.filter(a => a.id !== id);
  saveLocalData();
}

// ============================================
// Theme
// ============================================
function initTheme() {
  const toggle = document.getElementById('themeToggle');
  if (!toggle) return;
  const icon = toggle.querySelector('i');
  const saved = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  if (icon) icon.className = saved === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
  
  toggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    if (icon) icon.className = next === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
  });
}

// ============================================
// Sidebar
// ============================================
function initSidebar() {
  const toggle = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('sidebar');
  if (toggle && sidebar) {
    toggle.addEventListener('click', () => sidebar.classList.toggle('open'));
    document.addEventListener('click', (e) => {
      if (window.innerWidth <= 768 && !sidebar.contains(e.target) && !toggle.contains(e.target)) {
        sidebar.classList.remove('open');
      }
    });
  }
}

// ============================================
// Tabs
// ============================================
function initTabs() {
  document.querySelectorAll('[data-tab]').forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab(tab.dataset.tab);
    });
  });
}

function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  
  const targetTab = document.getElementById(tabId);
  const targetNav = document.querySelector(`[data-tab="${tabId}"]`);
  
  if (targetTab) targetTab.classList.add('active');
  if (targetNav) targetNav.classList.add('active');
  
  if (tabId === 'apps') renderAppsTable();
  document.getElementById('sidebar')?.classList.remove('open');
}

// ============================================
// Stats
// ============================================
function updateStats() {
  const totalApps = document.getElementById('totalApps');
  const totalDownloads = document.getElementById('totalDownloads');
  const gamesCount = document.getElementById('gamesCount');
  const appsCount = document.getElementById('appsCount');
  
  if (totalApps) totalApps.textContent = appsData.length;
  if (totalDownloads) totalDownloads.textContent = formatNumber(appsData.reduce((s, a) => s + (a.downloads || 0), 0));
  if (gamesCount) gamesCount.textContent = appsData.filter(a => a.category === 'game').length;
  if (appsCount) appsCount.textContent = appsData.filter(a => a.category === 'app').length;
}

function formatNumber(num) {
  if (!num) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toLocaleString();
}

// ============================================
// Form - Add New APK
// ============================================
function setupForm() {
  const form = document.getElementById('addApkForm');
  if (!form) return;
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitBtn = form.querySelector('button[type="submit"]');
    const origHTML = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';
    
    try {
      const newApp = {
        name: document.getElementById('appName').value.trim(),
        version: document.getElementById('appVersion').value.trim(),
        size: document.getElementById('appSize').value.trim(),
        icon: document.getElementById('appIcon').value.trim() || 'fas fa-mobile-screen',
        image: document.getElementById('appImage').value.trim(),
        mod: document.getElementById('appMod').value.trim(),
        link: document.getElementById('appLink').value.trim(),
        category: document.getElementById('appCategory').value,
        addedBy: currentUser?.email || 'admin'
      };
      
      if (!newApp.name || !newApp.version || !newApp.mod || !newApp.link) {
        throw new Error('Please fill all required fields');
      }
      
      addApp(newApp);
      
      showMessage('✅ APK added successfully!', 'success');
      form.reset();
      document.getElementById('appIcon').value = 'fas fa-mobile-screen';
      
      updateStats();
      setTimeout(() => switchTab('apps'), 1000);
    } catch (error) {
      showMessage('❌ Error: ' + error.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = origHTML;
    }
  });
}

function showMessage(text, type) {
  const msg = document.getElementById('formMessage');
  if (!msg) return;
  msg.textContent = text;
  msg.style.display = 'block';
  msg.className = 'form-message';
  msg.style.background = type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)';
  msg.style.border = `1px solid ${type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`;
  msg.style.color = type === 'success' ? '#10b981' : '#ef4444';
  msg.style.padding = '12px';
  msg.style.borderRadius = '12px';
  setTimeout(() => msg.style.display = 'none', 5000);
}

// ============================================
// Search
// ============================================
function setupSearch() {
  const search = document.getElementById('searchApps');
  if (search) {
    search.addEventListener('input', () => {
      currentPage = 1;
      renderAppsTable();
    });
  }
}

// ============================================
// Render Table
// ============================================
function renderAppsTable() {
  const tbody = document.getElementById('appsTableBody');
  if (!tbody) return;
  
  const searchTerm = document.getElementById('searchApps')?.value.toLowerCase() || '';
  
  let filtered = appsData.filter(app =>
    (app.name || '').toLowerCase().includes(searchTerm) ||
    (app.mod || '').toLowerCase().includes(searchTerm)
  );
  
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const start = (currentPage - 1) * itemsPerPage;
  const paginated = filtered.slice(start, start + itemsPerPage);
  
  if (!paginated.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fas fa-box-open"></i><p>No APKs found</p></div></td></tr>`;
    renderPagination(0);
    return;
  }
  
  tbody.innerHTML = paginated.map(app => {
    const iconHtml = app.image
      ? `<img src="${app.image}" alt="${app.name}" onerror="this.style.display='none'"><i class="${app.icon || 'fas fa-mobile-screen'}"></i>`
      : `<i class="${app.icon || 'fas fa-mobile-screen'}"></i>`;
    
    return `
      <tr>
        <td><div class="app-icon-sm">${iconHtml}</div></td>
        <td><strong>${app.name}</strong><br><small style="color:var(--text-secondary)">${app.category}</small></td>
        <td>${app.version}</td>
        <td>${app.size}</td>
        <td>${formatNumber(app.downloads || 0)}</td>
        <td>
          <div class="action-btns">
            <button class="icon-btn" onclick="editApp('${app.id}')"><i class="fas fa-edit"></i></button>
            <button class="icon-btn delete" onclick="deleteApp('${app.id}')"><i class="fas fa-trash"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
  
  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  const pag = document.getElementById('pagination');
  if (!pag) return;
  if (totalPages <= 1) { pag.innerHTML = ''; return; }
  
  let html = '';
  for (let i = 1; i <= totalPages; i++) {
    html += `<button class="${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
  }
  pag.innerHTML = html;
}

function goToPage(page) {
  currentPage = page;
  renderAppsTable();
}

// ============================================
// Modal - Edit
// ============================================
function setupModal() {
  const modal = document.getElementById('editModal');
  if (!modal) return;
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
  });
}

function editApp(id) {
  const app = appsData.find(a => a.id === id);
  if (!app) return;
  
  document.getElementById('editId').value = id;
  document.getElementById('editName').value = app.name || '';
  document.getElementById('editVersion').value = app.version || '';
  document.getElementById('editSize').value = app.size || '';
  document.getElementById('editIcon').value = app.icon || '';
  document.getElementById('editImage').value = app.image || '';
  document.getElementById('editMod').value = app.mod || '';
  document.getElementById('editLink').value = app.link || '';
  document.getElementById('editCategory').value = app.category || 'app';
  
  document.getElementById('editModal').classList.add('open');
}

function closeModal() {
  document.getElementById('editModal')?.classList.remove('open');
}

function saveEdit() {
  const id = document.getElementById('editId').value;
  if (!id) return;
  
  const saveBtn = document.querySelector('#editModal .btn-primary');
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
  
  try {
    const updates = {
      name: document.getElementById('editName').value.trim(),
      version: document.getElementById('editVersion').value.trim(),
      size: document.getElementById('editSize').value.trim(),
      icon: document.getElementById('editIcon').value.trim(),
      image: document.getElementById('editImage').value.trim(),
      mod: document.getElementById('editMod').value.trim(),
      link: document.getElementById('editLink').value.trim(),
      category: document.getElementById('editCategory').value
    };
    
    if (!updates.name || !updates.version || !updates.mod || !updates.link) {
      throw new Error('Required fields missing');
    }
    
    updateApp(id, updates);
    closeModal();
    renderAppsTable();
    updateStats();
    showMessage('✅ APK updated successfully!', 'success');
  } catch (error) {
    alert('❌ Error: ' + error.message);
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerHTML = 'Save Changes';
  }
}

function deleteApp(id) {
  if (!confirm('⚠️ Delete this APK permanently?')) return;
  deleteAppById(id);
  renderAppsTable();
  updateStats();
  showMessage('✅ APK deleted!', 'success');
}

// ============================================
// Export Data
// ============================================
function exportData() {
  if (!appsData.length) { alert('No data!'); return; }
  const blob = new Blob([JSON.stringify(appsData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `flmods-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================
// Import Data
// ============================================
function importData(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (Array.isArray(data)) {
        appsData = data;
        saveLocalData();
        renderAppsTable();
        updateStats();
        showMessage('✅ Data imported!', 'success');
      }
    } catch (err) {
      alert('Invalid JSON file');
    }
  };
  reader.readAsText(file);
}

// ============================================
// Clear Cache
// ============================================
function clearAllCache() {
  if (confirm('⚠️ Clear all data and reset?')) {
    localStorage.removeItem('apkData');
    location.reload();
  }
}

// ============================================
// Logout
// ============================================
function handleLogout() {
  if (confirm('Logout?')) {
    if (typeof auth !== 'undefined') {
      auth.signOut().then(() => location.reload());
    } else {
      location.reload();
    }
  }
}

// ============================================
// Login Page
// ============================================
function showLoginPage() {
  document.body.innerHTML = `
    <div class="login-container">
      <div class="login-box">
        <div class="login-header">
          <i class="fas fa-shield-halved shield-icon"></i>
          <h1>Admin Access</h1>
          <p>Free Lite Mods Admin Panel</p>
        </div>
        <form id="authForm" class="login-form">
          <div class="form-group">
            <label><i class="fas fa-envelope"></i> Email</label>
            <input type="email" id="authEmail" placeholder="admin@example.com" required>
          </div>
          <div class="form-group">
            <label><i class="fas fa-lock"></i> Password</label>
            <input type="password" id="authPassword" placeholder="••••••••" required>
          </div>
          <div id="authAlert" style="display:none;"></div>
          <button type="submit" class="login-btn">
            <i class="fas fa-sign-in-alt"></i> Login
          </button>
        </form>
        <div class="security-note">
          <i class="fas fa-shield"></i> Authorized personnel only
        </div>
        <a href="index.html" class="back-link">← Back to Site</a>
      </div>
    </div>
  `;
  
  document.getElementById('authForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    const btn = e.target.querySelector('button');
    const alertDiv = document.getElementById('authAlert');
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
    alertDiv.style.display = 'none';
    
    try {
      if (typeof auth !== 'undefined') {
        await auth.signInWithEmailAndPassword(email, password);
      } else {
        throw new Error('Auth not available');
      }
    } catch (error) {
      alertDiv.style.display = 'block';
      alertDiv.className = 'alert alert-error';
      alertDiv.textContent = '❌ ' + (error.code === 'auth/wrong-password' ? 'Wrong password' : error.code === 'auth/user-not-found' ? 'Account not found' : error.message);
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
    }
  });
}

// ============================================
// Global Exports
// ============================================
window.switchTab = switchTab;
window.editApp = editApp;
window.deleteApp = deleteApp;
window.saveEdit = saveEdit;
window.closeModal = closeModal;
window.goToPage = goToPage;
window.exportData = exportData;
window.importData = importData;
window.clearAllCache = clearAllCache;
window.handleLogout = handleLogout;