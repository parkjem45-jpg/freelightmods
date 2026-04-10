// ===== Configuration =====
let appsData = [];

// Set current year
document.getElementById('currentYear').textContent = new Date().getFullYear();

// ===== Theme Toggle =====
const themeToggle = document.getElementById('themeToggle');
const htmlElement = document.documentElement;
const themeIcon = themeToggle.querySelector('i');

// Check saved theme
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

// ===== Load APK Data from Firestore =====
async function loadAppsData() {
  try {
    const snapshot = await db.collection('apks').orderBy('downloads', 'desc').get();
    appsData = [];
    snapshot.forEach(doc => {
      appsData.push({ id: doc.id, ...doc.data() });
    });
    renderAppGrid();
    updateTotalModsCount();
    
    // Cache for offline
    localStorage.setItem('apkData', JSON.stringify(appsData));
  } catch (error) {
    console.log('Using cached/local data');
    const cached = localStorage.getItem('apkData');
    if (cached) {
      appsData = JSON.parse(cached);
      renderAppGrid();
      updateTotalModsCount();
    } else {
      // Sample data if nothing exists
      appsData = getSampleData();
      renderAppGrid();
      updateTotalModsCount();
    }
  }
}

function updateTotalModsCount() {
  const countElement = document.getElementById('totalModsCount');
  if (countElement) {
    countElement.textContent = appsData.length + '+';
  }
}

// Sample data fallback
function getSampleData() {
  return [
    {
      id: '1',
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
      id: '2',
      name: "YouTube Vanced",
      icon: "fab fa-youtube",
      version: "v18.45.41",
      size: "134 MB",
      mod: "No Ads",
      downloads: 28750,
      link: "#",
      image: "",
      category: "app"
    },
    {
      id: '3',
      name: "Netflix Premium",
      icon: "fas fa-film",
      version: "v8.106.0",
      size: "98 MB",
      mod: "4K HDR",
      downloads: 12300,
      link: "#",
      image: "",
      category: "app"
    },
    {
      id: '4',
      name: "Instagram Pro",
      icon: "fab fa-instagram",
      version: "v312.0.0",
      size: "67 MB",
      mod: "Download Media",
      downloads: 19800,
      link: "#",
      image: "",
      category: "app"
    },
    {
      id: '5',
      name: "Minecraft",
      icon: "fas fa-cube",
      version: "v1.20.81",
      size: "720 MB",
      mod: "Unlocked",
      downloads: 35200,
      link: "#",
      image: "",
      category: "game"
    },
    {
      id: '6',
      name: "CapCut Pro",
      icon: "fas fa-video",
      version: "v11.5.0",
      size: "210 MB",
      mod: "No Watermark",
      downloads: 22400,
      link: "#",
      image: "",
      category: "app"
    }
  ];
}

// ===== Render App Grid =====
function renderAppGrid() {
  const grid = document.getElementById('appGrid');
  if (!grid) return;
  
  grid.innerHTML = '';
  
  if (appsData.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1/-1; text-align: center; padding: 60px; color: var(--text-secondary);">
        <i class="fas fa-box-open" style="font-size: 48px; margin-bottom: 16px;"></i>
        <h3>No mods available</h3>
        <p>Check back later for new additions!</p>
      </div>
    `;
    return;
  }
  
  appsData.forEach(app => {
    const card = document.createElement('div');
    card.className = 'app-card';
    
    const iconHtml = app.image 
      ? `<img src="${app.image}" alt="${app.name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 18px;" onerror="this.parentElement.innerHTML='<i class=\\'${app.icon || 'fas fa-mobile-alt'}\\'></i>'">`
      : `<i class="${app.icon || 'fas fa-mobile-alt'}"></i>`;
    
    card.innerHTML = `
      <div class="app-icon">
        ${iconHtml}
      </div>
      <div class="app-info">
        <h3>${app.name}</h3>
        <div class="app-meta">
          <span><i class="fas fa-code-branch"></i> ${app.version}</span>
          <span><i class="fas fa-weight-hanging"></i> ${app.size}</span>
        </div>
        <div class="app-meta" style="margin-top: -8px;">
          <span><i class="fas fa-crown" style="color: #fbbf24;"></i> ${app.mod}</span>
        </div>
        ${app.downloads ? `<div class="app-meta">
          <span><i class="fas fa-download"></i> ${formatNumber(app.downloads)} downloads</span>
        </div>` : ''}
      </div>
      <a href="${app.link}" class="download-btn" target="_blank" data-app-id="${app.id}">
        <i class="fas fa-download"></i> Download APK
      </a>
    `;
    grid.appendChild(card);
  });
  
  // Add download tracking
  document.querySelectorAll('.download-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const appId = btn.dataset.appId;
      if (appId && appId !== 'undefined') {
        try {
          await db.collection('apks').doc(appId).update({
            downloads: firebase.firestore.FieldValue.increment(1)
          });
          // Track download in analytics
          await db.collection('analytics').add({
            event: 'download',
            appId: appId,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            sessionId: tracker?.sessionId || 'unknown'
          });
        } catch (error) {
          console.log('Download tracking error:', error);
        }
      }
    });
  });
}

// Format numbers with K/M
function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

// ===== AI Assistant Logic =====
class AIAssistant {
  constructor() {
    this.knowledgeBase = {
      'not loading': 'Try refreshing the page (Ctrl+F5). If the issue persists, check your internet connection or clear browser cache.',
      'apk not downloading': 'Make sure you have "Unknown Sources" enabled in your Android settings. Also, try using a different browser like Chrome or Firefox.',
      'broken link': 'The download link might be temporarily unavailable. Please report it to our admin panel or try again later.',
      'install': 'To install APK files:\n1. Download the APK\n2. Open your device Settings\n3. Go to Security/Privacy\n4. Enable "Unknown Sources"\n5. Tap the downloaded APK to install',
      'virus': 'All our mods are scanned with VirusTotal before uploading. We prioritize safety, but always use caution when installing third-party apps.',
      'update': 'We update mods daily. Check back regularly or use the "Request" feature for specific apps.',
      'error': 'If you see an error, please provide more details so I can help diagnose the issue.',
      'admin': 'The admin panel is available at /admin.html. You need to create an account to access it.',
      'add mod': 'To add a new mod, go to the Admin Panel and sign in. Then use the "Add New APK" form.',
      'image': 'You can add custom images for apps in the admin panel. Use direct image URLs (ending in .jpg, .png, etc).',
      'account': 'You can create an account from the admin login page. Click "Sign Up" tab to register.',
      'sign up': 'Go to admin.html and click the "Sign Up" tab to create a new account.',
      'login': 'Go to admin.html to log in to your admin account.',
      'password': 'Use the admin panel login page. If you forgot your password, use Firebase password reset.',
      'dark mode': 'Click the sun/moon icon in the top-left corner to toggle between dark and light themes.',
      'theme': 'Click the theme toggle button in the top-left corner to switch between dark and light mode.'
    };
  }
  
  async processQuery(query) {
    const lowerQuery = query.toLowerCase();
    
    // Check knowledge base
    for (const [key, response] of Object.entries(this.knowledgeBase)) {
      if (lowerQuery.includes(key)) {
        return response;
      }
    }
    
    // Check for app-specific queries
    const appMentioned = appsData.find(app => 
      lowerQuery.includes(app.name.toLowerCase())
    );
    
    if (appMentioned) {
      return `${appMentioned.name} (${appMentioned.version}) is available. Size: ${appMentioned.size}. Mod features: ${appMentioned.mod}. You can download it from the main page.`;
    }
    
    // Auto-diagnose common issues
    if (lowerQuery.includes('slow') || lowerQuery.includes('lag')) {
      return 'The website is optimized for speed. If you\'re experiencing slowness:\n• Check your internet connection\n• Close other bandwidth-heavy tabs\n• Try using mobile data if on WiFi\n• Toggle theme might help on some devices';
    }
    
    if (lowerQuery.includes('mobile') || lowerQuery.includes('phone')) {
      return 'This site is fully optimized for mobile devices. You can download and install APKs directly from your phone browser.';
    }
    
    if (lowerQuery.includes('game')) {
      const games = appsData.filter(a => a.category === 'game');
      if (games.length > 0) {
        return `We have ${games.length} games available including: ${games.slice(0, 3).map(g => g.name).join(', ')}. Check the Apps section for more!`;
      }
    }
    
    // Default response
    return 'I understand you need help. Could you provide more details about the issue? You can also:\n• Check our FAQ section\n• Visit the admin panel to report issues\n• Try refreshing the page';
  }
}

// Initialize AI
const ai = new AIAssistant();
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

if (aiSend) {
  aiSend.addEventListener('click', sendAIMessage);
}

if (aiInput) {
  aiInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendAIMessage();
  });
}

async function sendAIMessage() {
  const message = aiInput.value.trim();
  if (!message) return;
  
  // Add user message
  addAIMessage(message, 'user');
  aiInput.value = '';
  
  // Show typing indicator
  const typingId = showTypingIndicator();
  
  // Process query
  setTimeout(async () => {
    removeTypingIndicator(typingId);
    const response = await ai.processQuery(message);
    addAIMessage(response, 'bot');
    
    // Auto-scan for errors in console
    checkForErrors();
  }, 800 + Math.random() * 500);
}

function addAIMessage(text, sender) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `ai-message ${sender}`;
  
  if (sender === 'bot') {
    messageDiv.innerHTML = `
      <i class="fas fa-robot"></i>
      <div>${text.replace(/\n/g, '<br>')}</div>
    `;
  } else {
    messageDiv.innerHTML = `<div>${text}</div>`;
  }
  
  aiMessages.appendChild(messageDiv);
  aiMessages.scrollTop = aiMessages.scrollHeight;
}

function showTypingIndicator() {
  const id = 'typing-' + Date.now();
  const indicator = document.createElement('div');
  indicator.id = id;
  indicator.className = 'ai-message bot';
  indicator.innerHTML = `
    <i class="fas fa-robot"></i>
    <div class="typing-indicator">
      <span></span><span></span><span></span>
    </div>
  `;
  aiMessages.appendChild(indicator);
  aiMessages.scrollTop = aiMessages.scrollHeight;
  return id;
}

function removeTypingIndicator(id) {
  const element = document.getElementById(id);
  if (element) element.remove();
}

// Auto error detection
function checkForErrors() {
  const errors = [];
  
  // Check if data loaded
  if (appsData.length === 0) {
    errors.push('No APK data found. Try refreshing or check back later.');
  }
  
  // Check for broken images
  document.querySelectorAll('.app-icon img').forEach(img => {
    if (!img.complete) {
      setTimeout(() => {
        if (img.naturalHeight === 0) {
          errors.push('Some images failed to load. Using fallback icons.');
        }
      }, 1000);
    } else if (img.naturalHeight === 0) {
      errors.push('Some images failed to load. Using fallback icons.');
    }
  });
  
  if (errors.length > 0) {
    setTimeout(() => {
      addAIMessage('⚠️ Auto-detected issues:\n• ' + errors.join('\n• '), 'bot');
    }, 500);
  }
}

// ===== Mobile Menu =====
const menuToggle = document.querySelector('.mobile-menu-toggle');
const navLinks = document.querySelector('.nav-links');
if (menuToggle) {
  menuToggle.addEventListener('click', () => {
    if (navLinks.style.display === 'flex') {
      navLinks.style.display = 'none';
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
}

// ===== Smooth Scroll =====
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    const href = this.getAttribute('href');
    if (href === "#" || href === "") return;
    const target = document.querySelector(href);
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
});

// ===== Initialize =====
loadAppsData();

// Check for new data periodically (every 60 seconds)
setInterval(loadAppsData, 60000);

// Run error check on load
window.addEventListener('load', () => {
  setTimeout(checkForErrors, 2000);
});