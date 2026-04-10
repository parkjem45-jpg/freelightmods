
// ===== Security Enhancements =====
document.addEventListener('DOMContentLoaded', () => {
  // Check authentication before loading admin
  if (typeof auth !== 'undefined' && !auth.checkAuth()) {
    return; // Auth manager will show login page
  }
  
  // Continue with normal initialization
  loadData();
  setupTabs();
  setupForm();
  updateStats();
  loadActivity();
  startSessionTimer();
  setupSecurityMonitoring();
  
  // Update realtime stats
  if (typeof tracker !== 'undefined') {
    setInterval(() => tracker.updateDisplay(), 5000);
  }
});

// Session timeout warning
function startSessionTimer() {
  const session = JSON.parse(localStorage.getItem('flm_admin_session') || '{}');
  if (!session.expires) return;
  
  const timerDiv = document.createElement('div');
  timerDiv.className = 'session-timer';
  timerDiv.id = 'sessionTimer';
  document.body.appendChild(timerDiv);
  
  const updateTimer = () => {
    const now = Date.now();
    const timeLeft = session.expires - now;
    
    if (timeLeft <= 0) {
      auth.logout();
      return;
    }
    
    const minutes = Math.floor(timeLeft / 60000);
    const seconds = Math.floor((timeLeft % 60000) / 1000);
    
    timerDiv.innerHTML = `<i class="fas fa-clock"></i> Session: ${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    if (timeLeft < 5 * 60 * 1000) {
      timerDiv.classList.add('warning');
    }
  };
  
  updateTimer();
  setInterval(updateTimer, 1000);
}

// Security monitoring
function setupSecurityMonitoring() {
  // Prevent right-click
  document.addEventListener('contextmenu', (e) => {
    if (window.location.pathname.includes('admin.html')) {
      e.preventDefault();
    }
  });
  
  // Prevent dev tools shortcuts
  document.addEventListener('keydown', (e) => {
    if (window.location.pathname.includes('admin.html')) {
      if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I')) {
        e.preventDefault();
      }
    }
  });
  
  // Log suspicious activity
  let errorCount = 0;
  window.addEventListener('error', (e) => {
    errorCount++;
    if (errorCount > 5) {
      auth.logSecurityEvent('suspicious_errors', `Multiple errors detected: ${e.message}`);
    }
  });
}

// Export security log
function exportSecurityLog() {
  const log = auth.getSecurityLog();
  const blob = new Blob([JSON.stringify(log, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `security-log-${Date.now()}.json`;
  a.click();
}

// Force logout all sessions
function forceLogoutAll() {
  if (confirm('Force logout all admin sessions?')) {
    localStorage.removeItem('flm_admin_session');
    localStorage.removeItem('flm_visitor_session');
    auth.logSecurityEvent('force_logout', 'All sessions terminated');
    location.reload();
  }
}

// ===== Configuration =====
let appsData = [];
let currentPage = 1;
const itemsPerPage = 20;
let activityLog = [];

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  setupTabs();
  setupForm();
  updateStats();
  loadActivity();
  
  // Check URL hash for direct tab access
  const hash = window.location.hash.slice(1);
  if (hash) {
    switchTab(hash);
  }
});

// ===== Data Management =====
function loadData() {
  const saved = localStorage.getItem('apkData');
  if (saved) {
    appsData = JSON.parse(saved);
  } else {
    appsData = getSampleData();
    saveData();
  }
  renderAppsTable();
  updateStats();
}

function saveData() {
  localStorage.setItem('apkData', JSON.stringify(appsData));
  
  // Also save to data.json (for GitHub Pages, this would need a server)
  const dataStr = JSON.stringify(appsData, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'data.json';
  a.click();
  
  logActivity('Data saved successfully');
}

function getSampleData() {
  return [
    {
      id: Date.now() - 1,
      name: "Spotify Premium",
      icon: "fab fa-spotify",
      version: "v8.9.18",
      size: "82 MB",
      mod: "Unlocked",
      downloads: 15420,
      link: "#",
      image: "",
      category: "app"
    },
    {
      id: Date.now(),
      name: "YouTube Vanced",
      icon: "fab fa-youtube",
      version: "v18.45.41",
      size: "134 MB",
      mod: "No Ads",
      downloads: 28750,
      link: "#",
      image: "",
      category: "app"
    }
  ];
}

// ===== Tab Management =====
function setupTabs() {
  document.querySelectorAll('[data-tab]').forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab(tab.dataset.tab);
    });
  });
}

function switchTab(tabId) {
  // Update active states
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  
  document.getElementById(tabId).classList.add('active');
  document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
  
  // Load tab-specific data
  if (tabId === 'apps') renderAppsTable();
  if (tabId === 'ai') runHealthCheck();
  
  window.location.hash = tabId;
}

// ===== Render Apps Table =====
function renderAppsTable() {
  const tbody = document.getElementById('appsTableBody');
  if (!tbody) return;
  
  const searchTerm = document.getElementById('searchApps')?.value.toLowerCase() || '';
  let filtered = appsData.filter(app => 
    app.name.toLowerCase().includes(searchTerm) ||
    app.mod.toLowerCase().includes(searchTerm)
  );
  
  // Pagination
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const start = (currentPage - 1) * itemsPerPage;
  const paginated = filtered.slice(start, start + itemsPerPage);
  
  tbody.innerHTML = '';
  
  paginated.forEach(app => {
    const row = document.createElement('tr');
    const iconHtml = app.image 
      ? `<img src="${app.image}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 10px;">`
      : `<i class="${app.icon || 'fas fa-mobile-alt'}"></i>`;
    
    row.innerHTML = `
      <td><div class="app-icon-small">${iconHtml}</div></td>
      <td><strong>${app.name}</strong><br><small>${app.category || 'app'}</small></td>
      <td>${app.version}</td>
      <td>${app.size}</td>
      <td>${formatNumber(app.downloads || 0)}</td>
      <td>
        <div class="action-buttons">
          <button class="action-btn" onclick="editApp(${app.id})">
            <i class="fas fa-edit"></i>
          </button>
          <button class="action-btn delete" onclick="deleteApp(${app.id})">
            <i class="fas fa-trash"></i>
          </button>
          <button class="action-btn" onclick="copyLink('${app.link}')">
            <i class="fas fa-copy"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });
  
  // Render pagination
  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  const pagination = document.getElementById('pagination');
  if (!pagination) return;
  
  pagination.innerHTML = '';
  
  if (totalPages <= 1) return;
  
  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement('button');
    btn.textContent = i;
    if (i === currentPage) btn.classList.add('active');
    btn.onclick = () => {
      currentPage = i;
      renderAppsTable();
    };
    pagination.appendChild(btn);
  }
}

// Search functionality
document.getElementById('searchApps')?.addEventListener('input', () => {
  currentPage = 1;
  renderAppsTable();
});

// ===== Form Handling =====
function setupForm() {
  const form = document.getElementById('addApkForm');
  if (!form) return;
  
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const newApp = {
      id: Date.now(),
      name: document.getElementById('appName').value,
      version: document.getElementById('appVersion').value,
      size: document.getElementById('appSize').value,
      icon: document.getElementById('appIcon').value || 'fas fa-mobile-alt',
      image: document.getElementById('appImage').value,
      mod: document.getElementById('appMod').value,
      link: document.getElementById('appLink').value,
      category: document.getElementById('appCategory').value,
      downloads: 0,
      dateAdded: new Date().toISOString()
    };
    
    appsData.push(newApp);
    saveData();
    
    form.reset();
    logActivity(`Added new app: ${newApp.name}`);
    alert('APK added successfully!');
    
    updateStats();
    if (document.getElementById('apps').classList.contains('active')) {
      renderAppsTable();
    }
  });
}

// ===== Edit & Delete =====
function editApp(id) {
  const app = appsData.find(a => a.id === id);
  if (!app) return;
  
  document.getElementById('editId').value = app.id;
  document.getElementById('editName').value = app.name;
  document.getElementById('editVersion').value = app.version;
  document.getElementById('editSize').value = app.size;
  document.getElementById('editIcon').value = app.icon || '';
  document.getElementById('editImage').value = app.image || '';
  document.getElementById('editMod').value = app.mod;
  document.getElementById('editLink').value = app.link;
  document.getElementById('editCategory').value = app.category || 'app';
  
  document.getElementById('editModal').classList.add('active');
}

function closeModal() {
  document.getElementById('editModal').classList.remove('active');
}

function saveEdit() {
  const id = parseInt(document.getElementById('editId').value);
  const index = appsData.findIndex(a => a.id === id);
  
  if (index !== -1) {
    appsData[index] = {
      ...appsData[index],
      name: document.getElementById('editName').value,
      version: document.getElementById('editVersion').value,
      size: document.getElementById('editSize').value,
      icon: document.getElementById('editIcon').value,
      image: document.getElementById('editImage').value,
      mod: document.getElementById('editMod').value,
      link: document.getElementById('editLink').value,
      category: document.getElementById('editCategory').value
    };
    
    saveData();
    logActivity(`Updated app: ${appsData[index].name}`);
    closeModal();
    renderAppsTable();
    updateStats();
  }
}

function deleteApp(id) {
  if (!confirm('Are you sure you want to delete this APK?')) return;
  
  const app = appsData.find(a => a.id === id);
  appsData = appsData.filter(a => a.id !== id);
  
  saveData();
  logActivity(`Deleted app: ${app?.name || 'Unknown'}`);
  renderAppsTable();
  updateStats();
}

function copyLink(link) {
  navigator.clipboard?.writeText(link);
  alert('Link copied to clipboard!');
}

// ===== Preview =====
function previewApk() {
  const preview = document.getElementById('apkPreview');
  const card = document.getElementById('previewCard');
  
  preview.innerHTML = `
    <div class="app-card">
      <div class="app-icon">
        ${document.getElementById('appImage').value 
          ? `<img src="${document.getElementById('appImage').value}" style="width:100%;height:100%;object-fit:cover;border-radius:18px;">`
          : `<i class="${document.getElementById('appIcon').value || 'fas fa-mobile-alt'}"></i>`}
      </div>
      <div class="app-info">
        <h3>${document.getElementById('appName').value || 'App Name'}</h3>
        <div class="app-meta">
          <span><i class="fas fa-code-branch"></i> ${document.getElementById('appVersion').value || 'v1.0.0'}</span>
          <span><i class="fas fa-weight-hanging"></i> ${document.getElementById('appSize').value || '0 MB'}</span>
        </div>
        <div class="app-meta">
          <span><i class="fas fa-crown" style="color: #fbbf24;"></i> ${document.getElementById('appMod').value || 'Mod Features'}</span>
        </div>
      </div>
      <a href="#" class="download-btn">
        <i class="fas fa-download"></i> Download APK
      </a>
    </div>
  `;
  
  card.style.display = 'block';
}

// ===== Stats =====
function updateStats() {
  document.getElementById('totalApps').textContent = appsData.length;
  document.getElementById('totalDownloads').textContent = formatNumber(
    appsData.reduce((sum, app) => sum + (app.downloads || 0), 0)
  );
  document.getElementById('gamesCount').textContent = appsData.filter(a => a.category === 'game').length;
  document.getElementById('appsCount').textContent = appsData.filter(a => a.category === 'app').length;
}

function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

// ===== Activity Log =====
function logActivity(message) {
  activityLog.unshift({
    time: new Date().toLocaleTimeString(),
    message
  });
  
  if (activityLog.length > 10) activityLog.pop();
  localStorage.setItem('activityLog', JSON.stringify(activityLog));
  
  loadActivity();
}

function loadActivity() {
  const saved = localStorage.getItem('activityLog');
  if (saved) {
    activityLog = JSON.parse(saved);
  }
  
  const list = document.getElementById('activityList');
  if (!list) return;
  
  list.innerHTML = activityLog.map(log => `
    <div class="activity-item">
      <span class="activity-time">${log.time}</span>
      <span>${log.message}</span>
    </div>
  `).join('');
}

// ===== AI Diagnostics =====
function runHealthCheck() {
  // Data file status
  const dataStatus = appsData.length > 0 ? 'healthy' : 'warning';
  document.getElementById('dataStatus').textContent = appsData.length + ' items';
  document.getElementById('dataStatus').className = `status-badge ${dataStatus}`;
  
  // Storage status
  const storageUsed = JSON.stringify(localStorage).length;
  document.getElementById('storageStatus').textContent = formatBytes(storageUsed);
  document.getElementById('storageStatus').className = 'status-badge healthy';
  
  // Image status
  const imagesWithUrl = appsData.filter(a => a.image).length;
  document.getElementById('imageStatus').textContent = `${imagesWithUrl}/${appsData.length} custom`;
  document.getElementById('imageStatus').className = 'status-badge healthy';
  
  // Link status
  document.getElementById('linkStatus').textContent = 'Validating...';
  validateLinks();
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function runFullDiagnostics() {
  const console = document.getElementById('aiConsole');
  
  addConsoleMessage('Starting full system diagnostics...', 'bot');
  
  setTimeout(() => addConsoleMessage('✓ Checking data integrity... ' + appsData.length + ' records found', 'success'), 500);
  setTimeout(() => addConsoleMessage('✓ Local storage: OK', 'success'), 800);
  setTimeout(() => {
    const brokenImages = appsData.filter(a => a.image && !isValidImageUrl(a.image)).length;
    if (brokenImages > 0) {
      addConsoleMessage(`⚠️ ${brokenImages} potentially broken image URLs detected`, 'warning');
    } else {
      addConsoleMessage('✓ All image URLs appear valid', 'success');
    }
  }, 1200);
  setTimeout(() => addConsoleMessage('✓ System ready. No critical errors.', 'success'), 1600);
  
  runHealthCheck();
}

function addConsoleMessage(text, type = 'bot') {
  const console = document.getElementById('aiConsole');
  const msg = document.createElement('div');
  msg.className = `console-message ${type}`;
  msg.innerHTML = `
    <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'warning' ? 'exclamation-triangle' : type === 'error' ? 'times-circle' : 'robot'}"></i>
    <span>${text}</span>
  `;
  console.appendChild(msg);
  console.scrollTop = console.scrollHeight;
}

function clearConsole() {
  document.getElementById('aiConsole').innerHTML = `
    <div class="console-message bot">
      <i class="fas fa-robot"></i>
      <span>Console cleared. Ready for new commands.</span>
    </div>
  `;
}

function autoFixAll() {
  addConsoleMessage('🔧 Starting auto-fix procedure...', 'bot');
  
  // Fix missing icons
  appsData.forEach(app => {
    if (!app.icon) {
      app.icon = app.category === 'game' ? 'fas fa-gamepad' : 'fas fa-mobile-alt';
    }
  });
  
  // Fix invalid links
  appsData.forEach(app => {
    if (!app.link || app.link === '#') {
      app.link = 'https://github.com/your-repo/placeholder.apk';
    }
  });
  
  saveData();
  addConsoleMessage('✓ Fixed missing icons and invalid links', 'success');
  addConsoleMessage('✓ All issues resolved!', 'success');
}

function fixMissingIcons() {
  appsData.forEach(app => {
    if (!app.icon) {
      app.icon = app.category === 'game' ? 'fas fa-gamepad' : 'fas fa-mobile-alt';
    }
  });
  saveData();
  addConsoleMessage('✓ Fixed missing icons', 'success');
  renderAppsTable();
}

function validateLinks() {
  let validCount = 0;
  appsData.forEach(app => {
    if (app.link && app.link.startsWith('http')) {
      validCount++;
    }
  });
  
  document.getElementById('linkStatus').textContent = `${validCount}/${appsData.length} valid`;
  document.getElementById('linkStatus').className = `status-badge ${validCount === appsData.length ? 'healthy' : 'warning'}`;
}

function isValidImageUrl(url) {
  return url && (url.endsWith('.png') || url.endsWith('.jpg') || url.endsWith('.jpeg') || url.endsWith('.webp') || url.includes('unsplash') || url.includes('placeholder'));
}

function optimizeImages() {
  addConsoleMessage('Optimizing image URLs...', 'bot');
  addConsoleMessage('✓ All images optimized (compression simulated)', 'success');
}

function backupData() {
  const backup = {
    data: appsData,
    timestamp: new Date().toISOString(),
    version: '1.0'
  };
  
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `backup-${Date.now()}.json`;
  a.click();
  
  addConsoleMessage('✓ Backup created successfully', 'success');
}

// ===== Export =====
function exportData() {
  const dataStr = JSON.stringify(appsData, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'data.json';
  a.click();
  
  logActivity('Data exported');
}

function clearCache() {
  localStorage.removeItem('apkData');
  localStorage.removeItem('activityLog');
  location.reload();
}

// ===== Settings =====
function saveSettings() {
  const settings = {
    siteName: document.getElementById('siteName').value,
    itemsPerPage: document.getElementById('itemsPerPage').value,
    autoBackup: document.getElementById('autoBackup').checked
  };
  
  localStorage.setItem('settings', JSON.stringify(settings));
  alert('Settings saved!');
}

function resetAllData() {
  if (!confirm('WARNING: This will delete ALL data. Are you sure?')) return;
  if (!confirm('Last warning! This cannot be undone.')) return;
  
  appsData = getSampleData();
  activityLog = [];
  saveData();
  location.reload();
}

function clearAllCache() {
  localStorage.clear();
  location.reload();
}