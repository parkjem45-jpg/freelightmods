// ============================================
// Free Lite Mods - Main Site Application
// ============================================

// State
let appsData = [];
let currentFilter = 'all';

// Sample fallback data
const sampleData = [
  { id: '1', name: 'Spotify Premium', icon: 'fab fa-spotify', version: 'v8.9.18', size: '82 MB', mod: 'Unlocked Premium', downloads: 15420, link: '#', category: 'app', image: '' },
  { id: '2', name: 'YouTube Premium', icon: 'fab fa-youtube', version: 'v18.45.41', size: '134 MB', mod: 'No Ads, Background Play', downloads: 28750, link: '#', category: 'app', image: '' },
  { id: '3', name: 'Minecraft Modded', icon: 'fas fa-cube', version: 'v1.20.81', size: '720 MB', mod: 'Unlocked All, God Mode', downloads: 35200, link: '#', category: 'game', image: '' },
  { id: '4', name: 'Instagram Pro', icon: 'fab fa-instagram', version: 'v312.0.0', size: '67 MB', mod: 'Download Media, No Ads', downloads: 19800, link: '#', category: 'app', image: '' },
  { id: '5', name: 'CapCut Pro', icon: 'fas fa-video', version: 'v11.5.0', size: '210 MB', mod: 'No Watermark, Pro Features', downloads: 22400, link: '#', category: 'app', image: '' },
  { id: '6', name: 'Netflix Premium', icon: 'fas fa-film', version: 'v8.106.0', size: '98 MB', mod: '4K HDR, All Regions', downloads: 12300, link: '#', category: 'app', image: '' },
  { id: '7', name: 'PUBG Mobile Mod', icon: 'fas fa-person-rifle', version: 'v3.0.0', size: '1.2 GB', mod: 'Aimbot, Wallhack', downloads: 41000, link: '#', category: 'game', image: '' },
  { id: '8', name: 'Snapchat Plus', icon: 'fab fa-snapchat', version: 'v12.70.0', size: '95 MB', mod: 'Screenshot Privacy, Ghost Mode', downloads: 8900, link: '#', category: 'app', image: '' }
];

// ============================================
// Initialization
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('currentYear').textContent = new Date().getFullYear();
  
  initTheme();
  initNavigation();
  initLoader();
  loadData();
  initAI();
  initFilters();
  initNewsletter();
  
  // Refresh data periodically
  setInterval(loadData, 60000);
});

// ============================================
// Loader
// ============================================
function initLoader() {
  window.addEventListener('load', () => {
    setTimeout(() => {
      const loader = document.getElementById('loader');
      if (loader) {
        loader.classList.add('hidden');
        setTimeout(() => loader.remove(), 500);
      }
    }, 800);
  });
}

// ============================================
// Theme Toggle
// ============================================
function initTheme() {
  const toggle = document.getElementById('themeToggle');
  if (!toggle) return;
  
  const icon = toggle.querySelector('i');
  const savedTheme = localStorage.getItem('theme') || 'dark';
  
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(icon, savedTheme);
  
  toggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    updateThemeIcon(icon, next);
  });
}

function updateThemeIcon(icon, theme) {
  if (icon) {
    icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
  }
}

// ============================================
// Navigation
// ============================================
function initNavigation() {
  const menuToggle = document.getElementById('menuToggle');
  const navMenu = document.getElementById('navMenu');
  
  // Mobile menu toggle
  if (menuToggle && navMenu) {
    menuToggle.addEventListener('click', () => {
      navMenu.classList.toggle('open');
    });
    
    // Close menu on link click
    navMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('open');
      });
    });
  }
  
  // Navbar scroll effect
  window.addEventListener('scroll', () => {
    const navbar = document.getElementById('navbar');
    if (navbar) {
      navbar.classList.toggle('scrolled', window.scrollY > 50);
    }
  });
  
  // Active nav link based on scroll position
  const sections = document.querySelectorAll('section[id]');
  window.addEventListener('scroll', () => {
    let current = '';
    sections.forEach(section => {
      const sectionTop = section.offsetTop - 100;
      if (window.scrollY >= sectionTop) {
        current = section.getAttribute('id');
      }
    });
    
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href') === `#${current}`) {
        link.classList.add('active');
      }
    });
  });
  
  // Auth state observer for admin link
  if (typeof auth !== 'undefined') {
    auth.onAuthStateChanged((user) => {
      const adminLink = document.getElementById('adminLink');
      if (adminLink) {
        if (user && window.ADMIN_EMAILS && window.ADMIN_EMAILS.includes(user.email)) {
          adminLink.style.display = 'flex';
        } else {
          adminLink.style.display = 'none';
        }
      }
    });
  }
  
  // Secret admin access (press 'A' key 5 times rapidly)
  let aCount = 0;
  let aTimer = null;
  document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'a') {
      aCount++;
      clearTimeout(aTimer);
      aTimer = setTimeout(() => { aCount = 0; }, 2000);
      if (aCount >= 5) {
        window.location.href = 'admin.html';
        aCount = 0;
      }
    }
  });
  
  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (href === '#') return;
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
}

// ============================================
// Data Loading
// ============================================
async function loadData() {
  try {
    if (typeof db !== 'undefined') {
      const snapshot = await db.collection('apks').orderBy('downloads', 'desc').limit(50).get();
      appsData = [];
      snapshot.forEach(doc => {
        appsData.push({ id: doc.id, ...doc.data() });
      });
      // Cache data locally
      localStorage.setItem('apkData', JSON.stringify(appsData));
    } else {
      throw new Error('Firebase not available');
    }
  } catch (error) {
    console.log('Using cached or sample data');
    const cached = localStorage.getItem('apkData');
    if (cached) {
      try {
        appsData = JSON.parse(cached);
        if (!appsData.length) throw new Error('Empty cache');
      } catch (e) {
        appsData = [...sampleData];
      }
    } else {
      appsData = [...sampleData];
    }
  }
  
  renderApps();
  updateStats();
}

function updateStats() {
  const countEl = document.getElementById('totalModsCount');
  if (countEl) {
    countEl.textContent = appsData.length + '+';
  }
}

function formatNumber(num) {
  if (!num) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

// ============================================
// Filter Tabs
// ============================================
function initFilters() {
  const filterBtns = document.querySelectorAll('.filter-btn');
  if (!filterBtns.length) return;
  
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderApps();
    });
  });
}

// ============================================
// Render Apps
// ============================================
function renderApps() {
  const appGrid = document.getElementById('appGrid');
  const gamesGrid = document.getElementById('gamesGrid');
  
  if (!appGrid && !gamesGrid) return;
  
  // Use sample data if no real data
  let displayData = appsData.length > 0 ? appsData : [...sampleData];
  
  // Filter data
  let apps = displayData.filter(a => a.category === 'app');
  let games = displayData.filter(a => a.category === 'game');
  
  if (currentFilter === 'app') {
    apps = displayData.filter(a => a.category === 'app');
  } else if (currentFilter === 'game') {
    apps = displayData.filter(a => a.category === 'game');
  }
  
  // Render apps grid
  if (appGrid) {
    const appsToShow = currentFilter === 'game' ? games : 
                      currentFilter === 'app' ? apps : 
                      [...apps, ...games].slice(0, 12);
    renderGrid(appGrid, appsToShow.slice(0, 8));
  }
  
  // Render games grid
  if (gamesGrid) {
    renderGrid(gamesGrid, games.slice(0, 4));
  }
}

function renderGrid(gridElement, items) {
  if (!gridElement) return;
  
  if (!items.length) {
    gridElement.innerHTML = `
      <div class="empty-state" style="grid-column: 1/-1; text-align: center; padding: 3rem;">
        <i class="fas fa-box-open"></i>
        <p>No mods available yet. Check back soon!</p>
      </div>
    `;
    return;
  }
  
  gridElement.innerHTML = items.map(app => createAppCard(app)).join('');
  
  // Attach download handlers
  gridElement.querySelectorAll('.download-btn').forEach(btn => {
    btn.addEventListener('click', handleDownload);
  });
}

function createAppCard(app) {
  const iconHtml = app.image 
    ? `<img src="${app.image}" alt="${app.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"><i class="${app.icon || 'fas fa-mobile-screen'}" style="display:none;"></i>`
    : `<i class="${app.icon || 'fas fa-mobile-screen'}"></i>`;
  
  return `
    <div class="app-card" data-category="${app.category || 'app'}">
      <div class="app-icon-wrap">${iconHtml}</div>
      <h3>${app.name || 'Unknown App'}</h3>
      <div class="app-meta">
        <span><i class="fas fa-code-branch"></i> ${app.version || 'N/A'}</span>
        <span><i class="fas fa-weight-hanging"></i> ${app.size || 'N/A'}</span>
      </div>
      <div class="app-meta">
        <span><i class="fas fa-crown" style="color: #f59e0b;"></i> ${app.mod || 'Modded'}</span>
      </div>
      ${app.downloads ? `
        <div class="app-meta">
          <span><i class="fas fa-download"></i> ${formatNumber(app.downloads)} downloads</span>
        </div>
      ` : ''}
      <button class="download-btn" 
              data-app-id="${app.id || ''}" 
              data-app-name="${app.name}" 
              data-app-link="${app.link || '#'}">
        <i class="fas fa-download"></i> Download APK
      </button>
    </div>
  `;
}

async function handleDownload(e) {
  e.preventDefault();
  e.stopPropagation();
  
  const btn = e.currentTarget;
  const link = btn.dataset.appLink;
  const appId = btn.dataset.appId;
  const appName = btn.dataset.appName;
  
  // Track download in Firebase
  if (appId && appId !== 'undefined' && typeof db !== 'undefined') {
    try {
      await db.collection('apks').doc(appId).update({
        downloads: firebase.firestore.FieldValue.increment(1)
      });
      
      await db.collection('analytics').add({
        event: 'download',
        appId: appId,
        appName: appName,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      console.log('Download tracking offline:', error.message);
    }
  }
  
  // Show visual feedback
  const originalHTML = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-check"></i> Starting Download...';
  btn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
  btn.style.borderColor = 'transparent';
  
  setTimeout(() => {
    btn.innerHTML = originalHTML;
    btn.style.background = '';
    btn.style.borderColor = '';
  }, 2000);
  
  // Open download link
  if (link && link !== '#') {
    setTimeout(() => {
      window.open(link, '_blank');
    }, 500);
  } else {
    setTimeout(() => {
      alert('Download link coming soon! This mod will be available shortly.');
    }, 500);
  }
}

// ============================================
// Newsletter
// ============================================
function initNewsletter() {
  const form = document.getElementById('newsletterForm');
  if (!form) return;
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.querySelector('input[type="email"]').value.trim();
    
    if (!email) return;
    
    const btn = form.querySelector('button');
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    btn.disabled = true;
    
    try {
      if (typeof db !== 'undefined') {
        await db.collection('subscribers').add({
          email: email,
          subscribedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
      
      form.querySelector('input[type="email"]').value = '';
      btn.innerHTML = '<i class="fas fa-check"></i>';
      
      setTimeout(() => {
        btn.innerHTML = originalHTML;
        btn.disabled = false;
      }, 2000);
      
      alert('✅ Thanks for subscribing! You will receive updates about new mods.');
    } catch (error) {
      console.log('Newsletter subscription:', error.message);
      btn.innerHTML = originalHTML;
      btn.disabled = false;
      alert('Subscription feature coming soon!');
    }
  });
}

// ============================================
// AI Assistant (Gemini)
// ============================================
function initAI() {
  const trigger = document.getElementById('aiTrigger');
  const panel = document.getElementById('aiPanel');
  const close = document.getElementById('aiClose');
  const clear = document.getElementById('aiClear');
  const sendBtn = document.getElementById('aiSend');
  const input = document.getElementById('aiInput');
  const messages = document.getElementById('aiMessages');
  
  if (!trigger || !panel) return;
  
  // Toggle panel
  trigger.addEventListener('click', () => {
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) {
      input?.focus();
    }
  });
  
  // Close panel
  close?.addEventListener('click', () => {
    panel.classList.remove('open');
  });
  
  // Clear chat
  clear?.addEventListener('click', () => {
    if (messages) {
      messages.innerHTML = `
        <div class="ai-msg bot">
          <i class="fas fa-robot"></i>
          <div class="msg-content">
            <p>Chat cleared! How can I help you today?</p>
          </div>
        </div>
      `;
    }
  });
  
  // Send message
  function sendMessage() {
    const message = input?.value.trim();
    if (!message || !messages) return;
    
    // Add user message
    addMessage(message, 'user');
    input.value = '';
    
    // Show typing indicator
    const typingId = showTyping(messages);
    
    // Get response
    getAIResponse(message).then(response => {
      removeTyping(typingId);
      addMessage(response, 'bot');
    }).catch(() => {
      removeTyping(typingId);
      addMessage("Sorry, I encountered an error. Please try again.", 'bot');
    });
  }
  
  sendBtn?.addEventListener('click', sendMessage);
  input?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
}

function addMessage(text, sender) {
  const messages = document.getElementById('aiMessages');
  if (!messages) return;
  
  const div = document.createElement('div');
  div.className = `ai-msg ${sender}`;
  
  if (sender === 'bot') {
    div.innerHTML = `
      <i class="fas fa-robot"></i>
      <div class="msg-content"><p>${text.replace(/\n/g, '<br>')}</p></div>
    `;
  } else {
    div.innerHTML = `
      <div class="msg-content"><p>${text.replace(/\n/g, '<br>')}</p></div>
    `;
  }
  
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function showTyping(messages) {
  const id = 'typing-' + Date.now();
  const div = document.createElement('div');
  div.id = id;
  div.className = 'ai-msg bot';
  div.innerHTML = `
    <i class="fas fa-robot"></i>
    <div class="msg-content">
      <div class="typing-dots">
        <span>.</span><span>.</span><span>.</span>
      </div>
    </div>
  `;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
  return id;
}

function removeTyping(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

async function getAIResponse(query) {
  const GEMINI_API_KEY = 'AIzaSyCMzK8CkieI8yl9lSWK47VfD1ufDd_A0qg';
  const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  try {
    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `You are a helpful assistant for Free Lite Mods, a website offering free modded APKs and games. Keep responses friendly and under 150 words. User asks: ${query}`
          }]
        }]
      })
    });
    
    const data = await response.json();
    
    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
      return data.candidates[0].content.parts[0].text;
    }
    
    return getFallbackResponse(query);
  } catch (error) {
    console.log('AI API error, using fallback:', error.message);
    return getFallbackResponse(query);
  }
}

function getFallbackResponse(query) {
  const q = query.toLowerCase();
  
  if (q.includes('download') || q.includes('install')) return 'To install: 1️⃣ Click "Download APK" on any app card. 2️⃣ Open the downloaded file. 3️⃣ If blocked, enable "Unknown Sources" in Android Settings > Security.';
  if (q.includes('safe') || q.includes('virus') || q.includes('malware')) return '✅ All mods are scanned with VirusTotal before being uploaded. We prioritize your safety and security!';
  if (q.includes('free')) return 'Yes! 🎉 All mods on Free Lite Mods are completely free. No hidden fees or subscriptions.';
  if (q.includes('admin') || q.includes('login')) return 'Admin access is restricted to authorized personnel only. Press "A" 5 times for secret admin access. 🤫';
  if (q.includes('update')) return 'We update our mods regularly! Check back daily for new releases and updates. 📦';
  if (q.includes('spotify')) return 'Yes! 🎵 Spotify Premium mod is available with unlocked premium features including no ads and unlimited skips.';
  if (q.includes('youtube')) return 'YouTube Premium mod is available! 📺 Features include no ads, background play, and downloads.';
  if (q.includes('minecraft')) return 'Minecraft modded version is available! ⛏️ Includes God Mode, unlimited resources, and all skins unlocked.';
  if (q.includes('contact') || q.includes('support')) return '📧 Join our Telegram or Discord for support. Links are in the footer section below!';
  
  return "I'm here to help! 😊 Ask me about downloading mods, installing APKs, finding specific apps, or anything about Free Lite Mods.";
}

// ============================================
// Export for global access
// ============================================
window.loadData = loadData;
window.renderApps = renderApps;