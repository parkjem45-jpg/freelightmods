// ===== Main Site Script =====
let appsData = [];
let currentUser = null;

// Sample fallback data
const sampleData = [
  { id: '1', name: 'Spotify Premium', icon: 'fab fa-spotify', version: 'v8.9.18', size: '82 MB', mod: 'Unlocked Premium', downloads: 15420, link: '#', category: 'app', image: '' },
  { id: '2', name: 'YouTube Premium', icon: 'fab fa-youtube', version: 'v18.45.41', size: '134 MB', mod: 'No Ads, Background Play', downloads: 28750, link: '#', category: 'app', image: '' },
  { id: '3', name: 'Minecraft', icon: 'fas fa-cube', version: 'v1.20.81', size: '720 MB', mod: 'Unlocked All, God Mode', downloads: 35200, link: '#', category: 'game', image: '' },
  { id: '4', name: 'Instagram Pro', icon: 'fab fa-instagram', version: 'v312.0.0', size: '67 MB', mod: 'Download Media, No Ads', downloads: 19800, link: '#', category: 'app', image: '' },
  { id: '5', name: 'CapCut Pro', icon: 'fas fa-video', version: 'v11.5.0', size: '210 MB', mod: 'No Watermark, Pro Features', downloads: 22400, link: '#', category: 'app', image: '' },
  { id: '6', name: 'Netflix Premium', icon: 'fas fa-film', version: 'v8.106.0', size: '98 MB', mod: '4K HDR, All Regions', downloads: 12300, link: '#', category: 'app', image: '' }
];

// Set current year
document.getElementById('currentYear')?.textContent = new Date().getFullYear();

// ===== Theme Toggle =====
const themeToggle = document.getElementById('themeToggle');
const htmlElement = document.documentElement;

if (themeToggle) {
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
    if (themeIcon) {
      themeIcon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }
  }
}

// ===== Mobile Menu =====
const mobileToggle = document.getElementById('mobileToggle');
const navLinks = document.getElementById('navLinks');

if (mobileToggle && navLinks) {
  mobileToggle.addEventListener('click', () => {
    if (navLinks.style.display === 'flex') {
      navLinks.style.display = '';
      navLinks.style.flexDirection = '';
      navLinks.style.position = '';
      navLinks.style.top = '';
      navLinks.style.left = '';
      navLinks.style.right = '';
      navLinks.style.background = '';
      navLinks.style.padding = '';
      navLinks.style.borderBottom = '';
      navLinks.style.zIndex = '';
    } else {
      navLinks.style.display = 'flex';
      navLinks.style.flexDirection = 'column';
      navLinks.style.position = 'absolute';
      navLinks.style.top = '80px';
      navLinks.style.left = '0';
      navLinks.style.right = '0';
      navLinks.style.background = 'var(--bg-secondary)';
      navLinks.style.padding = '24px';
      navLinks.style.borderBottom = '1px solid var(--border-color)';
      navLinks.style.zIndex = '99';
    }
  });
  
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      if (window.innerWidth <= 768) {
        navLinks.style.display = 'none';
      }
    });
  });
}

// ===== Secret Admin Access =====
let aPressCount = 0;
let pressTimer = null;

document.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'a') {
    aPressCount++;
    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => { aPressCount = 0; }, 2000);
    if (aPressCount >= 5) {
      window.location.href = 'admin.html';
      aPressCount = 0;
    }
  }
});

// ===== Auth State Observer =====
if (typeof auth !== 'undefined') {
  auth.onAuthStateChanged((user) => {
    currentUser = user;
    const adminLink = document.getElementById('adminLink');
    if (user && adminLink) {
      const email = user.email || '';
      if (email === 'jack1122@freelightmods.com') {
        adminLink.style.display = 'inline-block';
      } else if (typeof db !== 'undefined') {
        db.collection('admins').doc(user.uid).get().then((doc) => {
          if (doc.exists) adminLink.style.display = 'inline-block';
        }).catch(() => {});
      }
    } else if (adminLink) {
      adminLink.style.display = 'none';
    }
  });
}

// ===== Load Data =====
async function loadAppsData() {
  try {
    if (typeof db !== 'undefined') {
      const snapshot = await db.collection('apks').orderBy('downloads', 'desc').limit(50).get();
      appsData = [];
      snapshot.forEach(doc => appsData.push({ id: doc.id, ...doc.data() }));
      localStorage.setItem('apkData', JSON.stringify(appsData));
    } else {
      throw new Error('Firebase not available');
    }
  } catch (error) {
    console.log('Using cached/sample data', error);
    const cached = localStorage.getItem('apkData');
    appsData = cached ? JSON.parse(cached) : [...sampleData];
  }
  renderAppGrid();
  updateTotalModsCount();
}

function updateTotalModsCount() {
  const el = document.getElementById('totalModsCount');
  if (el) el.textContent = appsData.length + '+';
}

function formatNumber(num) {
  if (!num) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

function renderAppGrid() {
  const grid = document.getElementById('appGrid');
  if (!grid) return;
  if (appsData.length === 0) appsData = [...sampleData];
  grid.innerHTML = '';
  
  appsData.slice(0, 12).forEach(app => {
    const card = document.createElement('div');
    card.className = 'app-card';
    const iconHtml = app.image
      ? `<img src="${app.image}" alt="${app.name}" onerror="this.innerHTML='<i class=\\'${app.icon || 'fas fa-mobile-alt'}\\'></i>'">`
      : `<i class="${app.icon || 'fas fa-mobile-alt'}"></i>`;
    
    card.innerHTML = `
      <div class="app-icon">${iconHtml}</div>
      <div class="app-info">
        <h3>${app.name}</h3>
        <div class="app-meta">
          <span><i class="fas fa-code-branch"></i> ${app.version || 'N/A'}</span>
          <span><i class="fas fa-weight-hanging"></i> ${app.size || 'N/A'}</span>
        </div>
        <div class="app-meta" style="margin-top: -8px;">
          <span><i class="fas fa-crown" style="color: #fbbf24;"></i> ${app.mod || 'Modded'}</span>
        </div>
        ${app.downloads ? `<div class="app-meta"><span><i class="fas fa-download"></i> ${formatNumber(app.downloads)} downloads</span></div>` : ''}
      </div>
      <div class="download-btn" data-app-id="${app.id}" data-app-name="${app.name}" data-app-link="${app.link || '#'}">
        <i class="fas fa-download"></i> Download APK
      </div>
    `;
    grid.appendChild(card);
  });

  // Download button handlers
  document.querySelectorAll('.download-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const link = btn.dataset.appLink;
      const appId = btn.dataset.appId;
      const appName = btn.dataset.appName;
      
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
        } catch (err) { console.log('Download tracking offline'); }
      }
      
      if (link && link !== '#') {
        window.open(link, '_blank');
      } else {
        alert('Download link coming soon! Check back later.');
      }
    });
  });
}

// ===== AI Assistant with Gemini =====
const GEMINI_API_KEY = 'AIzaSyCMzK8CkieI8yl9lSWK47VfD1ufDd_A0qg';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const aiToggle = document.getElementById('aiToggle');
const aiChatWindow = document.getElementById('aiChatWindow');
const aiClose = document.getElementById('aiClose');
const aiSend = document.getElementById('aiSend');
const aiInput = document.getElementById('aiInput');
const aiMessages = document.getElementById('aiMessages');

if (aiToggle) {
  aiToggle.addEventListener('click', () => {
    aiChatWindow.style.display = 'block';
    aiToggle.style.display = 'none';
  });
}
if (aiClose) {
  aiClose.addEventListener('click', () => {
    aiChatWindow.style.display = 'none';
    aiToggle.style.display = 'flex';
  });
}

function addAIMessage(text, sender) {
  if (!aiMessages) return;
  const div = document.createElement('div');
  div.className = `ai-message ${sender}`;
  if (sender === 'bot') {
    div.innerHTML = `<i class="fas fa-robot"></i><div>${text.replace(/\n/g, '<br>')}</div>`;
  } else {
    div.innerHTML = `<div>${text.replace(/\n/g, '<br>')}</div>`;
  }
  aiMessages.appendChild(div);
  aiMessages.scrollTop = aiMessages.scrollHeight;
}

function showTypingIndicator() {
  if (!aiMessages) return null;
  const id = 'typing-' + Date.now();
  const indicator = document.createElement('div');
  indicator.id = id;
  indicator.className = 'ai-message bot';
  indicator.innerHTML = `<i class="fas fa-robot"></i><div class="typing-indicator"><span></span><span></span><span></span></div>`;
  aiMessages.appendChild(indicator);
  aiMessages.scrollTop = aiMessages.scrollHeight;
  return id;
}

function removeTypingIndicator(id) {
  if (id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }
}

async function getGeminiResponse(query) {
  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `You are a helpful AI assistant for Free Lite Mods, a website offering free modded APKs and games. Keep responses friendly and under 150 words. User question: ${query}`
          }]
        }]
      })
    });
    const data = await response.json();
    if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
      return data.candidates[0].content.parts[0].text;
    }
    return fallbackResponse(query);
  } catch (error) {
    console.log('Gemini error:', error);
    return fallbackResponse(query);
  }
}

function fallbackResponse(query) {
  const lower = query.toLowerCase();
  if (lower.includes('download')) return 'Click the "Download APK" button on any app card. Make sure to enable "Unknown Sources" in your Android settings.';
  if (lower.includes('install')) return 'After downloading, open the APK file. If blocked, go to Settings > Security > Enable "Unknown Sources".';
  if (lower.includes('safe') || lower.includes('virus')) return 'All mods are scanned with VirusTotal before uploading. We prioritize your safety!';
  if (lower.includes('admin')) return 'Admin access is restricted. Press "A" 5 times for admin access.';
  if (lower.includes('account') || lower.includes('login')) return 'You can browse and download without an account.';
  if (lower.includes('free')) return 'Yes! All mods on Free Lite Mods are completely free.';
  if (lower.includes('update')) return 'We update our mods regularly. Check back daily!';
  if (lower.includes('spotify')) return 'Spotify Premium mod is available with unlocked premium features!';
  if (lower.includes('youtube')) return 'YouTube Premium mod includes no ads and background play!';
  if (lower.includes('minecraft')) return 'Minecraft mod with unlocked features is available!';
  if (lower.includes('contact')) return 'For support, reach us on Telegram or Discord (links in footer).';
  return "I'm here to help! Ask me about downloading, installing, or finding specific modded apps.";
}

async function sendAIMessage() {
  if (!aiInput) return;
  const message = aiInput.value.trim();
  if (!message) return;
  
  addAIMessage(message, 'user');
  aiInput.value = '';
  
  const typingId = showTypingIndicator();
  try {
    const response = await getGeminiResponse(message);
    removeTypingIndicator(typingId);
    addAIMessage(response, 'bot');
  } catch {
    removeTypingIndicator(typingId);
    addAIMessage('Sorry, I had a problem. Please try again.', 'bot');
  }
}

if (aiSend) aiSend.addEventListener('click', sendAIMessage);
if (aiInput) aiInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendAIMessage(); });

// ===== Smooth Scroll =====
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    const href = this.getAttribute('href');
    if (href === '#' || href === '') return;
    const target = document.querySelector(href);
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
});

// ===== Button Click Handlers =====
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('exploreBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('apps')?.scrollIntoView({ behavior: 'smooth' });
  });
  document.getElementById('howItWorksBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' });
  });
  document.getElementById('viewAllBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    alert('All mods page coming soon!');
  });
  document.getElementById('telegramLink')?.addEventListener('click', (e) => { e.preventDefault(); alert('Join our Telegram channel!'); });
  document.getElementById('discordLink')?.addEventListener('click', (e) => { e.preventDefault(); alert('Join our Discord server!'); });
  document.getElementById('githubLink')?.addEventListener('click', (e) => { e.preventDefault(); alert('Check out our GitHub!'); });
  document.getElementById('footerHome')?.addEventListener('click', (e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
  document.getElementById('footerApps')?.addEventListener('click', (e) => { e.preventDefault(); document.getElementById('apps')?.scrollIntoView({ behavior: 'smooth' }); });
  document.getElementById('footerFaq')?.addEventListener('click', (e) => { e.preventDefault(); alert('FAQ page coming soon!'); });
  document.getElementById('footerContact')?.addEventListener('click', (e) => { e.preventDefault(); alert('Contact page coming soon!'); });
  document.getElementById('footerDmca')?.addEventListener('click', (e) => { e.preventDefault(); alert('DMCA page coming soon!'); });
  document.getElementById('footerPrivacy')?.addEventListener('click', (e) => { e.preventDefault(); alert('Privacy policy coming soon!'); });
  
  loadAppsData();
  setInterval(loadAppsData, 60000);
});