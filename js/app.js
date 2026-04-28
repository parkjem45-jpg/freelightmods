// ============================================
// Free Lite Mods - Main Site
// Local Storage Version
// ============================================

let appsData = [];
let currentFilter = 'all';

// Load data
function loadData() {
  const stored = localStorage.getItem('apkData');
  if (stored) {
    try {
      appsData = JSON.parse(stored);
    } catch (e) {
      appsData = [...window.DEFAULT_APPS || []];
    }
  } else {
    appsData = [...window.DEFAULT_APPS || []];
    localStorage.setItem('apkData', JSON.stringify(appsData));
  }
  
  if (!appsData.length && window.DEFAULT_APPS) {
    appsData = [...window.DEFAULT_APPS];
    localStorage.setItem('apkData', JSON.stringify(appsData));
  }
  
  renderApps();
  updateStats();
}

function updateStats() {
  const el = document.getElementById('totalModsCount');
  if (el) el.textContent = appsData.length + '+';
}

function formatNumber(num) {
  if (!num) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

function renderApps() {
  const appGrid = document.getElementById('appGrid');
  const gamesGrid = document.getElementById('gamesGrid');
  
  const apps = appsData.filter(a => a.category === 'app');
  const games = appsData.filter(a => a.category === 'game');
  
  if (appGrid) renderGrid(appGrid, currentFilter === 'game' ? games : [...apps, ...games].slice(0, 8));
  if (gamesGrid) renderGrid(gamesGrid, games.slice(0, 4));
}

function renderGrid(grid, items) {
  if (!items.length) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><i class="fas fa-box-open"></i><p>No mods yet</p></div>';
    return;
  }
  
  grid.innerHTML = items.map(app => `
    <div class="app-card">
      <div class="app-icon-wrap">
        ${app.image ? `<img src="${app.image}" onerror="this.style.display='none'">` : ''}
        <i class="${app.icon || 'fas fa-mobile-screen'}"></i>
      </div>
      <h3>${app.name}</h3>
      <div class="app-meta">
        <span><i class="fas fa-code-branch"></i> ${app.version}</span>
        <span><i class="fas fa-weight-hanging"></i> ${app.size}</span>
      </div>
      <div class="app-meta">
        <span><i class="fas fa-crown" style="color:#f59e0b"></i> ${app.mod}</span>
      </div>
      <div class="app-meta">
        <span><i class="fas fa-download"></i> ${formatNumber(app.downloads || 0)} downloads</span>
      </div>
      <button class="download-btn" onclick="handleDownload('${app.id}', '${app.link || '#'}')">
        <i class="fas fa-download"></i> Download APK
      </button>
    </div>
  `).join('');
}

function handleDownload(appId, link) {
  // Update download count
  const app = appsData.find(a => a.id === appId);
  if (app) {
    app.downloads = (app.downloads || 0) + 1;
    localStorage.setItem('apkData', JSON.stringify(appsData));
    renderApps();
  }
  
  if (link && link !== '#') {
    window.open(link, '_blank');
  } else {
    alert('Download link coming soon!');
  }
}

// Filters
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderApps();
    });
  });
  
  loadData();
});

window.handleDownload = handleDownload;