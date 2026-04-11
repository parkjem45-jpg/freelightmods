// ===== Admin Panel - Fully Functional =====
let appsData = [];
let currentUser = null;
let currentPage = 1;
const itemsPerPage = 20;
let unsubscribeSnapshot = null;

// Theme toggle
const themeToggle = document.getElementById('themeToggle');
if (themeToggle) {
  const htmlElement = document.documentElement;
  const themeIcon = themeToggle.querySelector('i');
  const savedTheme = localStorage.getItem('theme') || 'dark';
  htmlElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
  
  themeToggle.addEventListener('click', () => {
    const currentTheme = htmlElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    htmlElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
  });
  
  function updateThemeIcon(theme) {
    themeIcon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
  }
}

// Auth state observer
auth.onAuthStateChanged(async (user) => {
  if (user) {
    // Check if user is admin
    try {
      const adminDoc = await db.collection('admins').doc(user.uid).get();
      const isDefaultAdmin = user.email === 'jack1122@freelightmods.com';
      
      if (adminDoc.exists || isDefaultAdmin) {
        currentUser = user;
        document.body.classList.add('authenticated');
        
        // Update user info
        const userEmail = document.querySelector('.user-email');
        if (userEmail) userEmail.textContent = user.email;
        
        const accountEmail = document.getElementById('accountEmail');
        if (accountEmail) accountEmail.value = user.email;
        
        // Initialize admin panel
        initAdminPanel();
      } else {
        // Not an admin
        alert('Access denied. Admin privileges required.');
        auth.signOut();
      }
    } catch (error) {
      console.error('Auth error:', error);
      // Fallback for default admin
      if (user.email === 'jack1122@freelightmods.com') {
        currentUser = user;
        initAdminPanel();
      } else {
        alert('Error checking admin status. Please try again.');
        auth.signOut();
      }
    }
  } else {
    // Show login page
    showLoginPage();
  }
});

function initAdminPanel() {
  setupRealtimeListener();
  setupTabs();
  setupForm();
  setupSearch();
  setupModalClose();
}

function setupModalClose() {
  const modal = document.getElementById('editModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }
}

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
      localStorage.setItem('apkData', JSON.stringify(appsData));
    }, (error) => {
      console.error('Snapshot error:', error);
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
    showMessage('Error loading data: ' + error.message, 'error');
  }
}

function showLoginPage() {
  document.body.innerHTML = `
    <div class="login-container">
      <div class="login-box">
        <div class="login-header">
          <i class="fas fa-shield-alt"></i>
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
            <input type="email" id="email" placeholder="admin@example.com" required />
          </div>
          <div class="form-group">
            <label><i class="fas fa-lock"></i> Password</label>
            <input type="password" id="password" placeholder="••••••••" required />
          </div>
          <div id="authError" class="login-error" style="display: none;"></div>
          <div id="authSuccess" class="login-success" style="display: none;"></div>
          <button type="submit" class="login-btn" id="authSubmitBtn">
            <i class="fas fa-sign-in-alt"></i> <span>Login</span>
          </button>
        </form>
        
        <div class="security-badge">
          <i class="fas fa-shield"></i>
          <span>Default Admin: jack1122@freelightmods.com</span>
        </div>
        <div style="margin-top: 16px; text-align: center;">
          <a href="index.html" style="color: var(--text-secondary);">
            <i class="fas fa-arrow-left"></i> Back to Site
          </a>
        </div>
      </div>
    </div>
  `;

  let mode = 'login';
  const tabs = document.querySelectorAll('.auth-tab');
  const form = document.getElementById('authForm');
  const submitBtn = document.getElementById('authSubmitBtn');
  const submitSpan = submitBtn.querySelector('span');
  const errorDiv = document.getElementById('authError');
  const successDiv = document.getElementById('authSuccess');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      mode = tab.dataset.tab;
      
      if (mode === 'signup') {
        submitSpan.textContent = 'Create Account';
        submitBtn.innerHTML = '<i class="fas fa-user-plus"></i> <span>Create Account</span>';
      } else {
        submitSpan.textContent = 'Login';
        submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> <span>Login</span>';
      }
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Processing...</span>';

    try {
      if (mode === 'signup') {
        if (password.length < 6) throw new Error('Password must be at least 6 characters');
        
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        
        // Add to admins collection
        await db.collection('admins').doc(userCredential.user.uid).set({
          email: email,
          role: 'admin',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        successDiv.textContent = 'Admin account created! You can now login.';
        successDiv.style.display = 'block';
        
        // Switch to login tab
        setTimeout(() => {
          document.querySelector('[data-tab="login"]').click();
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> <span>Login</span>';
        }, 1500);
      } else {
        await auth.signInWithEmailAndPassword(email, password);
        // Page will reload via auth state observer
      }
    } catch (error) {
      errorDiv.textContent = getReadableError(error);
      errorDiv.style.display = 'block';
      submitBtn.disabled = false;
      if (mode === 'signup') {
        submitBtn.innerHTML = '<i class="fas fa-user-plus"></i> <span>Create Account</span>';
      } else {
        submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> <span>Login</span>';
      }
    }
  });
}

function getReadableError(error) {
  const messages = {
    'auth/invalid-email': 'Invalid email address.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/email-already-in-use': 'Email is already registered.',
    'auth/weak-password': 'Password should be at least 6 characters.',
    'auth/network-request-failed': 'Network error. Check your connection.',
    'auth/too-many-requests': 'Too many attempts. Try again later.'
  };
  return messages[error.code] || error.message;
}

// Tab Management
function setupTabs() {
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
}

// Render Apps Table
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
  
  if (paginated.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:60px;">No APKs found</td></tr>`;
    renderPagination(0);
    return;
  }
  
  tbody.innerHTML = '';
  
  paginated.forEach(app => {
    const row = document.createElement('tr');
    const iconHtml = app.image 
      ? `<img src="${app.image}" style="width:40px;height:40px;object-fit:cover;border-radius:10px;" onerror="this.innerHTML='<i class=\\'${app.icon || 'fas fa-mobile-alt'}\\'></i>'">`
      : `<i class="${app.icon || 'fas fa-mobile-alt'}"></i>`;
    
    row.innerHTML = `
      <td><div class="app-icon-small">${iconHtml}</div></td>
      <td><strong>${app.name || 'Unknown'}</strong><br><small>${app.category || 'app'}</small></td>
      <td>${app.version || 'N/A'}</td>
      <td>${app.size || 'N/A'}</td>
      <td>${formatNumber(app.downloads || 0)}</td>
      <td>
        <div class="action-buttons">
          <button class="action-btn" onclick="editApp('${app.id}')"><i class="fas fa-edit"></i></button>
          <button class="action-btn delete" onclick="deleteApp('${app.id}')"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });
  
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

function setupSearch() {
  const searchInput = document.getElementById('searchApps');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      currentPage = 1;
      renderAppsTable();
    });
  }
}

// Form Handling
function setupForm() {
  const form = document.getElementById('addApkForm');
  if (!form) return;
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';
    
    try {
      const newApp = {
        name: document.getElementById('appName').value.trim(),
        version: document.getElementById('appVersion').value.trim(),
        size: document.getElementById('appSize').value.trim(),
        icon: document.getElementById('appIcon').value.trim() || 'fas fa-mobile-alt',
        image: document.getElementById('appImage').value.trim(),
        mod: document.getElementById('appMod').value.trim(),
        link: document.getElementById('appLink').value.trim(),
        category: document.getElementById('appCategory').value,
        downloads: 0,
        dateAdded: firebase.firestore.FieldValue.serverTimestamp(),
        addedBy: currentUser ? currentUser.email : 'unknown'
      };
      
      await db.collection('apks').add(newApp);
      
      showMessage('✅ APK added successfully!', 'success');
      form.reset();
      document.getElementById('appIcon').value = 'fas fa-mobile-alt';
      
      // Switch to apps tab
      setTimeout(() => switchTab('apps'), 1000);
    } catch (error) {
      showMessage('❌ Error: ' + error.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fas fa-plus"></i> Add APK';
    }
  });
}

function showMessage(text, type) {
  const msgDiv = document.getElementById('formMessage');
  if (msgDiv) {
    msgDiv.textContent = text;
    msgDiv.style.display = 'block';
    msgDiv.style.padding = '12px';
    msgDiv.style.borderRadius = '8px';
    msgDiv.style.backgroundColor = type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 87, 108, 0.1)';
    msgDiv.style.color = type === 'success' ? '#10b981' : '#f5576c';
    msgDiv.style.border = `1px solid ${type === 'success' ? '#10b981' : '#f5576c'}`;
    
    setTimeout(() => msgDiv.style.display = 'none', 5000);
  }
}

// Edit & Delete
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
  
  document.getElementById('editModal').classList.add('active');
}

function closeModal() {
  document.getElementById('editModal').classList.remove('active');
}

async function saveEdit() {
  const id = document.getElementById('editId').value;
  if (!id) return;
  
  const saveBtn = document.querySelector('#editModal .btn-primary');
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
  
  try {
    await db.collection('apks').doc(id).update({
      name: document.getElementById('editName').value.trim(),
      version: document.getElementById('editVersion').value.trim(),
      size: document.getElementById('editSize').value.trim(),
      icon: document.getElementById('editIcon').value.trim(),
      image: document.getElementById('editImage').value.trim(),
      mod: document.getElementById('editMod').value.trim(),
      link: document.getElementById('editLink').value.trim(),
      category: document.getElementById('editCategory').value,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    closeModal();
    showMessage('✅ APK updated successfully!', 'success');
  } catch (error) {
    alert('Error: ' + error.message);
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerHTML = 'Save Changes';
  }
}

async function deleteApp(id) {
  if (!confirm('Are you sure you want to delete this APK?')) return;
  
  try {
    await db.collection('apks').doc(id).delete();
    showMessage('✅ APK deleted successfully!', 'success');
  } catch (error) {
    alert('Error: ' + error.message);
  }
}

// Stats
function updateStats() {
  const totalAppsEl = document.getElementById('totalApps');
  const totalDownloadsEl = document.getElementById('totalDownloads');
  const gamesCountEl = document.getElementById('gamesCount');
  const appsCountEl = document.getElementById('appsCount');
  
  if (totalAppsEl) totalAppsEl.textContent = appsData.length;
  if (totalDownloadsEl) totalDownloadsEl.textContent = formatNumber(
    appsData.reduce((sum, app) => sum + (app.downloads || 0), 0)
  );
  if (gamesCountEl) gamesCountEl.textContent = appsData.filter(a => a.category === 'game').length;
  if (appsCountEl) appsCountEl.textContent = appsData.filter(a => a.category === 'app').length;
}

function formatNumber(num) {
  if (!num) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

// Export
function exportData() {
  const dataStr = JSON.stringify(appsData, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `flm-backup-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function clearAllCache() {
  if (confirm('Clear all cached data?')) {
    localStorage.clear();
    location.reload();
  }
}

// Logout
function logout() {
  if (confirm('Are you sure you want to logout?')) {
    auth.signOut().then(() => location.reload());
  }
}

// Global functions
window.switchTab = switchTab;
window.editApp = editApp;
window.deleteApp = deleteApp;
window.saveEdit = saveEdit;
window.closeModal = closeModal;
window.goToPage = goToPage;
window.exportData = exportData;
window.clearAllCache = clearAllCache;
window.logout = logout;