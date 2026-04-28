// ============================================
// Free Lite Mods - Admin Panel Application
// ============================================

// State
let appsData = [];
let currentUser = null;
let currentPage = 1;
const itemsPerPage = 15;
let unsubscribeSnapshot = null;

// ============================================
// Initialization
// ============================================
auth.onAuthStateChanged(async (user) => {
  if (user) {
    // Check if user is admin
    const isAdmin = window.ADMIN_EMAILS && window.ADMIN_EMAILS.includes(user.email);
    
    if (isAdmin) {
      currentUser = user;
      document.body.classList.add('authenticated');
      
      // Update user info in sidebar
      updateUserInfo(user);
      
      // Initialize panel
      initAdminPanel();
    } else {
      // Check Firestore admins collection
      try {
        const adminDoc = await db.collection('admins').doc(user.uid).get();
        if (adminDoc.exists) {
          currentUser = user;
          document.body.classList.add('authenticated');
          updateUserInfo(user);
          initAdminPanel();
        } else {
          alert('⚠️ Access denied. You do not have admin privileges.');
          auth.signOut();
        }
      } catch (error) {
        console.error('Admin check failed:', error);
        alert('⚠️ Error verifying admin status. Please try again.');
        auth.signOut();
      }
    }
  } else {
    // No user, show login
    showLoginPage();
  }
});

function updateUserInfo(user) {
  const userName = document.querySelector('.user-name');
  const accountEmail = document.getElementById('accountEmail');
  
  if (userName) {
    userName.textContent = user.email || 'Admin';
  }
  if (accountEmail) {
    accountEmail.value = user.email || '';
  }
}

// ============================================
// Admin Panel Initialization
// ============================================
function initAdminPanel() {
  initTheme();
  initSidebar();
  initTabs();
  setupRealtimeListener();
  setupForm();
  setupSearch();
  setupModal();
}

// ============================================
// Theme
// ============================================
function initTheme() {
  const toggle = document.getElementById('themeToggle');
  if (!toggle) return;
  
  const icon = toggle.querySelector('i');
  const savedTheme = localStorage.getItem('theme') || 'dark';
  
  document.documentElement.setAttribute('data-theme', savedTheme);
  if (icon) {
    icon.className = savedTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
  }
  
  toggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    if (icon) {
      icon.className = next === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }
  });
}

// ============================================
// Sidebar
// ============================================
function initSidebar() {
  const toggle = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('sidebar');
  
  if (toggle && sidebar) {
    toggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
    
    // Close sidebar when clicking outside
    document.addEventListener('click', (e) => {
      if (window.innerWidth <= 768) {
        if (!sidebar.contains(e.target) && !toggle.contains(e.target)) {
          sidebar.classList.remove('open');
        }
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
      const tabId = tab.dataset.tab;
      switchTab(tabId);
    });
  });
}

function switchTab(tabId) {
  // Deactivate all tabs
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  
  // Activate selected tab
  const targetTab = document.getElementById(tabId);
  const targetNav = document.querySelector(`[data-tab="${tabId}"]`);
  
  if (targetTab) targetTab.classList.add('active');
  if (targetNav) targetNav.classList.add('active');
  
  // Refresh table if switching to apps tab
  if (tabId === 'apps') {
    renderAppsTable();
  }
  
  // Close mobile sidebar
  document.getElementById('sidebar')?.classList.remove('open');
}

// ============================================
// Realtime Data
// ============================================
function setupRealtimeListener() {
  if (unsubscribeSnapshot) unsubscribeSnapshot();
  
  unsubscribeSnapshot = db.collection('apks')
    .orderBy('dateAdded', 'desc')
    .onSnapshot((snapshot) => {
      appsData = [];
      snapshot.forEach(doc => {
        appsData.push({ id: doc.id, ...doc.data() });
      });
      
      renderAppsTable();
      updateStats();
      
      // Cache data
      localStorage.setItem('apkData', JSON.stringify(appsData));
    }, (error) => {
      console.error('Realtime listener error:', error);
      loadDataOnce();
    });
}

async function loadDataOnce() {
  try {
    const snapshot = await db.collection('apks').orderBy('dateAdded', 'desc').get();
    appsData = [];
    snapshot.forEach(doc => {
      appsData.push({ id: doc.id, ...doc.data() });
    });
    renderAppsTable();
    updateStats();
  } catch (error) {
    console.error('Failed to load data:', error);
    showFormMessage('⚠️ Failed to load data. Check your connection.', 'error');
  }
}

// ============================================
// Stats
// ============================================
function updateStats() {
  const totalAppsEl = document.getElementById('totalApps');
  const totalDownloadsEl = document.getElementById('totalDownloads');
  const gamesCountEl = document.getElementById('gamesCount');
  const appsCountEl = document.getElementById('appsCount');
  
  if (totalAppsEl) totalAppsEl.textContent = appsData.length;
  if (totalDownloadsEl) {
    const total = appsData.reduce((sum, app) => sum + (app.downloads || 0), 0);
    totalDownloadsEl.textContent = formatNumber(total);
  }
  if (gamesCountEl) gamesCountEl.textContent = appsData.filter(a => a.category === 'game').length;
  if (appsCountEl) appsCountEl.textContent = appsData.filter(a => a.category === 'app').length;
}

function formatNumber(num) {
  if (!num) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toLocaleString();
}

// ============================================
// Form
// ============================================
function setupForm() {
  const form = document.getElementById('addApkForm');
  if (!form) return;
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalHTML = submitBtn.innerHTML;
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
        downloads: 0,
        dateAdded: firebase.firestore.FieldValue.serverTimestamp(),
        addedBy: currentUser ? currentUser.email : 'unknown'
      };
      
      // Validate required fields
      if (!newApp.name || !newApp.version || !newApp.size || !newApp.mod || !newApp.link) {
        throw new Error('Please fill in all required fields');
      }
      
      await db.collection('apks').add(newApp);
      
      showFormMessage('✅ APK added successfully!', 'success');
      form.reset();
      document.getElementById('appIcon').value = 'fas fa-mobile-screen';
      
      // Switch to apps tab after success
      setTimeout(() => switchTab('apps'), 1500);
    } catch (error) {
      showFormMessage('❌ Error: ' + error.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalHTML;
    }
  });
}

function showFormMessage(text, type) {
  const msgDiv = document.getElementById('formMessage');
  if (!msgDiv) return;
  
  msgDiv.textContent = text;
  msgDiv.style.display = 'block';
  msgDiv.className = 'form-message';
  
  if (type === 'success') {
    msgDiv.style.background = 'rgba(16, 185, 129, 0.1)';
    msgDiv.style.border = '1px solid rgba(16, 185, 129, 0.3)';
    msgDiv.style.color = '#10b981';
  } else {
    msgDiv.style.background = 'rgba(239, 68, 68, 0.1)';
    msgDiv.style.border = '1px solid rgba(239, 68, 68, 0.3)';
    msgDiv.style.color = '#ef4444';
  }
  
  setTimeout(() => {
    msgDiv.style.display = 'none';
  }, 5000);
}

// ============================================
// Search
// ============================================
function setupSearch() {
  const searchInput = document.getElementById('searchApps');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
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
    (app.mod || '').toLowerCase().includes(searchTerm) ||
    (app.category || '').toLowerCase().includes(searchTerm)
  );
  
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const start = (currentPage - 1) * itemsPerPage;
  const paginated = filtered.slice(start, start + itemsPerPage);
  
  if (!paginated.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="empty-state">
            <i class="fas fa-box-open"></i>
            <p>No APKs found</p>
          </div>
        </td>
      </tr>
    `;
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
        <td>
          <strong>${app.name || 'Unknown'}</strong>
          <br><small style="color: var(--text-secondary);">${app.category || 'app'}</small>
        </td>
        <td>${app.version || 'N/A'}</td>
        <td>${app.size || 'N/A'}</td>
        <td>${formatNumber(app.downloads || 0)}</td>
        <td>
          <div class="action-btns">
            <button class="icon-btn" onclick="editApp('${app.id}')" title="Edit">
              <i class="fas fa-edit"></i>
            </button>
            <button class="icon-btn delete" onclick="deleteApp('${app.id}')" title="Delete">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
  
  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  const pagination = document.getElementById('pagination');
  if (!pagination) return;
  
  if (totalPages <= 1) {
    pagination.innerHTML = '';
    return;
  }
  
  let html = '';
  for (let i = 1; i <= totalPages; i++) {
    html += `<button class="${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
  }
  pagination.innerHTML = html;
}

function goToPage(page) {
  currentPage = page;
  renderAppsTable();
}

// ============================================
// Modal
// ============================================
function setupModal() {
  const modal = document.getElementById('editModal');
  if (!modal) return;
  
  // Close on background click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
  
  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('open')) {
      closeModal();
    }
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

async function saveEdit() {
  const id = document.getElementById('editId').value;
  if (!id) return;
  
  const saveBtn = document.querySelector('#editModal .btn-primary');
  const originalHTML = saveBtn.innerHTML;
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
  
  try {
    const updatedData = {
      name: document.getElementById('editName').value.trim(),
      version: document.getElementById('editVersion').value.trim(),
      size: document.getElementById('editSize').value.trim(),
      icon: document.getElementById('editIcon').value.trim(),
      image: document.getElementById('editImage').value.trim(),
      mod: document.getElementById('editMod').value.trim(),
      link: document.getElementById('editLink').value.trim(),
      category: document.getElementById('editCategory').value,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    // Validate
    if (!updatedData.name || !updatedData.version || !updatedData.mod || !updatedData.link) {
      throw new Error('Please fill in all required fields');
    }
    
    await db.collection('apks').doc(id).update(updatedData);
    
    closeModal();
    showFormMessage('✅ APK updated successfully!', 'success');
  } catch (error) {
    alert('❌ Error: ' + error.message);
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerHTML = originalHTML;
  }
}

async function deleteApp(id) {
  if (!confirm('⚠️ Are you sure you want to permanently delete this APK? This action cannot be undone.')) return;
  
  try {
    await db.collection('apks').doc(id).delete();
    showFormMessage('✅ APK deleted successfully!', 'success');
  } catch (error) {
    alert('❌ Error: ' + error.message);
  }
}

// ============================================
// Export Data
// ============================================
function exportData() {
  if (!appsData.length) {
    alert('No data to export!');
    return;
  }
  
  const dataStr = JSON.stringify(appsData, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `flm-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  showFormMessage('✅ Data exported successfully!', 'success');
}

// ============================================
// Cache Management
// ============================================
function clearAllCache() {
  if (confirm('⚠️ This will clear all local data and reload the page. Continue?')) {
    localStorage.clear();
    sessionStorage.clear();
    location.reload();
  }
}

// ============================================
// Logout
// ============================================
function handleLogout() {
  if (confirm('Are you sure you want to logout?')) {
    if (unsubscribeSnapshot) {
      unsubscribeSnapshot();
    }
    auth.signOut().then(() => {
      window.location.reload();
    }).catch((error) => {
      console.error('Logout error:', error);
      window.location.reload();
    });
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
          <p>Sign in to manage your APK repository</p>
        </div>
        
        <div class="auth-tabs">
          <button class="auth-tab active" data-tab="login">Login</button>
          <button class="auth-tab" data-tab="signup">Create Admin</button>
        </div>
        
        <form id="authForm" class="login-form">
          <div class="form-group">
            <label><i class="fas fa-envelope"></i> Email</label>
            <input type="email" id="authEmail" placeholder="admin@example.com" required>
          </div>
          <div class="form-group" id="passwordGroup">
            <label><i class="fas fa-lock"></i> Password</label>
            <input type="password" id="authPassword" placeholder="••••••••" required>
          </div>
          <div class="form-group" id="confirmGroup" style="display:none;">
            <label><i class="fas fa-check"></i> Confirm Password</label>
            <input type="password" id="authConfirm" placeholder="••••••••">
          </div>
          <div id="authAlert" style="display:none;"></div>
          <button type="submit" class="login-btn" id="authSubmitBtn">
            <i class="fas fa-sign-in-alt"></i> <span>Login</span>
          </button>
        </form>
        
        <div class="security-note">
          <i class="fas fa-shield"></i>
          <span>Authorized personnel only</span>
        </div>
        <a href="index.html" class="back-link">
          <i class="fas fa-arrow-left"></i> Back to Site
        </a>
      </div>
    </div>
  `;
  
  let mode = 'login';
  const tabs = document.querySelectorAll('.auth-tab');
  const form = document.getElementById('authForm');
  const submitBtn = document.getElementById('authSubmitBtn');
  const alertDiv = document.getElementById('authAlert');
  const passwordGroup = document.getElementById('passwordGroup');
  const confirmGroup = document.getElementById('confirmGroup');
  
  // Tab switching
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      mode = tab.dataset.tab;
      
      alertDiv.style.display = 'none';
      
      if (mode === 'signup') {
        passwordGroup.style.display = 'block';
        confirmGroup.style.display = 'block';
        submitBtn.innerHTML = '<i class="fas fa-user-plus"></i> <span>Create Account</span>';
      } else {
        passwordGroup.style.display = 'block';
        confirmGroup.style.display = 'none';
        submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> <span>Login</span>';
      }
    });
  });
  
  // Form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    
    alertDiv.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Processing...</span>';
    
    try {
      if (mode === 'signup') {
        const confirm = document.getElementById('authConfirm').value;
        
        if (password !== confirm) throw new Error('Passwords do not match');
        if (password.length < 6) throw new Error('Password must be at least 6 characters');
        
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        
        // Add to admins collection
        await db.collection('admins').doc(userCredential.user.uid).set({
          email: email,
          role: 'admin',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showAlert('✅ Account created successfully! You can now login.', 'success');
        
        // Switch to login mode
        setTimeout(() => {
          document.querySelector('[data-tab="login"]')?.click();
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> <span>Login</span>';
        }, 1500);
      } else {
        await auth.signInWithEmailAndPassword(email, password);
        // Page will reload via auth state observer
      }
    } catch (error) {
      showAlert('⚠️ ' + getReadableError(error), 'error');
      submitBtn.disabled = false;
      
      if (mode === 'signup') {
        submitBtn.innerHTML = '<i class="fas fa-user-plus"></i> <span>Create Account</span>';
      } else {
        submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> <span>Login</span>';
      }
    }
  });
  
  function showAlert(message, type) {
    alertDiv.textContent = message;
    alertDiv.style.display = 'block';
    alertDiv.className = type === 'success' ? 'alert alert-success' : 'alert alert-error';
  }
}

function getReadableError(error) {
  const messages = {
    'auth/invalid-email': 'Invalid email address format.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/email-already-in-use': 'This email is already registered.',
    'auth/weak-password': 'Password should be at least 6 characters.',
    'auth/network-request-failed': 'Network error. Please check your connection.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.'
  };
  return messages[error.code] || error.message;
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
window.clearAllCache = clearAllCache;
window.handleLogout = handleLogout;