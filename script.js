// ===== Configuration =====
let appsData = [];
let currentUser = null;

// Set current year
document.getElementById('currentYear').textContent = new Date().getFullYear();

// ===== Theme Toggle =====
const themeToggle = document.getElementById('themeToggle');
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
auth.onAuthStateChanged((user) => {
  currentUser = user;
  const adminLink = document.getElementById('adminLink');
  
  if (user) {
    // Check if user is admin
    db.collection('admins').doc(user.uid).get().then((doc) => {
      if (doc.exists || user.email === 'jack1122@freelightmods.com') {
        if (adminLink) adminLink.style.display = 'inline-block';
      }
    });
  } else {
    if (adminLink) adminLink.style.display = 'none';
  }
});

// ===== Load APK Data from Firestore =====
async function loadAppsData() {
  const grid = document.getElementById('appGrid');
  
  try {
    const snapshot = await db.collection('apks')
      .orderBy('downloads', 'desc')
      .limit(50)
      .get();
    
    appsData = [];
    snapshot.forEach(doc => {
      appsData.push({ id: doc.id, ...doc.data() });
    });
    
    renderAppGrid();
    updateTotalModsCount();
    
    // Cache for offline
    localStorage.setItem('apkData', JSON.stringify(appsData));
  } catch (error) {
    console.log('Using cached data');
    const cached = localStorage.getItem('apkData');
    if (cached) {
      appsData = JSON.parse(cached);
      renderAppGrid();
      updateTotalModsCount();
    } else {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1/-1;">
          <i class="fas fa-database"></i>
          <h3>No mods available</h3>
          <p>Check back soon for new additions!</p>
        </div>
      `;
    }
  }
}

function updateTotalModsCount() {
  const countElement = document.getElementById('totalModsCount');
  if (countElement) {
    countElement.textContent = appsData.length + '+';
  }
}

// ===== Render App Grid =====
function renderAppGrid() {
  const grid = document.getElementById('appGrid');
  if (!grid) return;
  
  if (appsData.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1/-1;">
        <i class="fas fa-box-open"></i>
        <h3>Coming Soon</h3>
        <p>We're adding amazing mods. Check back later!</p>
      </div>
    `;
    return;
  }
  
  grid.innerHTML = '';
  
  appsData.forEach(app => {
    const card = document.createElement('div');
    card.className = 'app-card';
    
    const iconHtml = app.image 
      ? `<img src="${app.image}" alt="${app.name}" onerror="this.parentElement.innerHTML='<i class=\\'${app.icon || 'fas fa-mobile-alt'}\\'></i>'">`
      : `<i class="${app.icon || 'fas fa-mobile-alt'}"></i>`;
    
    card.innerHTML = `
      <div class="app-icon">
        ${iconHtml}
      </div>
      <div class="app-info">
        <h3>${app.name}</h3>
        <div class="app-meta">
          <span><i class="fas fa-code-branch"></i> ${app.version || 'N/A'}</span>
          <span><i class="fas fa-weight-hanging"></i> ${app.size || 'N/A'}</span>
        </div>
        <div class="app-meta" style="margin-top: -8px;">
          <span><i class="fas fa-crown" style="color: #fbbf24;"></i> ${app.mod || 'Modded'}</span>
        </div>
        ${app.downloads ? `<div class="app-meta">
          <span><i class="fas fa-download"></i> ${formatNumber(app.downloads)} downloads</span>
        </div>` : ''}
      </div>
      <a href="${app.link}" class="download-btn" target="_blank" data-app-id="${app.id}" data-app-name="${app.name}">
        <i class="fas fa-download"></i> Download APK
      </a>
    `;
    grid.appendChild(card);
  });
  
  // Add download tracking
  document.querySelectorAll('.download-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const appId = btn.dataset.appId;
      const appName = btn.dataset.appName;
      
      if (appId && appId !== 'undefined') {
        try {
          // Increment download count
          await db.collection('apks').doc(appId).update({
            downloads: firebase.firestore.FieldValue.increment(1)
          });
          
          // Track download
          await db.collection('analytics').add({
            event: 'download',
            appId: appId,
            appName: appName,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            sessionId: tracker?.sessionId || 'unknown'
          });
        } catch (error) {
          console.log('Download tracking:', error);
        }
      }
    });
  });
}

function formatNumber(num) {
  if (!num) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

// ===== REAL AI Assistant (Google Gemini API) =====
const GEMINI_API_KEY = 'AIzaSyB0LrQcsXD-prcam7s3O1iEJbIvcPthlgo'; // Using same key - replace with your actual Gemini key if different

class RealAIAssistant {
  constructor() {
    this.context = `You are a helpful AI assistant for Free Lite Mods, a website offering modded APKs and games. 
    You help users with questions about downloading, installing APKs, troubleshooting, and general inquiries.
    Keep responses friendly, concise, and helpful. If you don't know something, suggest contacting support.
    Website features: modded apps, games, fast downloads, safe scanning.`;
  }

  async askGemini(question) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `${this.context}\n\nUser question: ${question}`
            }]
          }]
        })
      });

      const data = await response.json();
      
      if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
        return data.candidates[0].content.parts[0].text;
      }
      
      return this.fallbackResponse(question);
    } catch (error) {
      console.log('Gemini API error, using fallback:', error);
      return this.fallbackResponse(question);
    }
  }

  fallbackResponse(question) {
    const lowerQ = question.toLowerCase();
    
    const responses = {
      'download': 'To download APKs, simply click the "Download APK" button on any app card. Make sure you have "Unknown Sources" enabled in your Android settings.',
      'install': 'After downloading, open the APK file and follow the installation prompts. If blocked, go to Settings > Security > Enable "Unknown Sources".',
      'safe': 'All our mods are scanned with VirusTotal before uploading. We prioritize safety, but always exercise caution when installing third-party apps.',
      'admin': 'Admin access is restricted. If you need admin privileges, please contact the site owner.',
      'account': 'Regular users don\'t need accounts. Only administrators need accounts to manage content.',
      'update': 'We update our mod collection regularly. Check back daily for new additions!',
      'game': 'We have many modded games available. Browse the Apps section or search for specific titles.',
      'free': 'Yes! All mods on Free Lite Mods are completely free to download.',
      'contact': 'For support, use the Request link in the navigation menu or contact us through our social channels.',
      'error': 'If you encounter errors, try refreshing the page or clearing your browser cache. If the problem persists, it might be a temporary server issue.'
    };
    
    for (const [key, response] of Object.entries(responses)) {
      if (lowerQ.includes(key)) return response;
    }
    
    return "I'm here to help! Could you provide more details about what you need? You can ask about downloading, installing, safety, or specific apps.";
  }

  async processQuery(query) {
    // Check if we have internet and try Gemini first
    if (navigator.onLine) {
      try {
        return await this.askGemini(query);
      } catch (e) {
        return this.fallbackResponse(query);
      }
    }
    return this.fallbackResponse(query);
  }
}

// Initialize AI
const ai = new RealAIAssistant();
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
  
  addAIMessage(message, 'user');
  aiInput.value = '';
  
  const typingId = showTypingIndicator();
  
  try {
    const response = await ai.processQuery(message);
    removeTypingIndicator(typingId);
    addAIMessage(response, 'bot');
  } catch (error) {
    removeTypingIndicator(typingId);
    addAIMessage("Sorry, I encountered an error. Please try again later.", 'bot');
  }
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

// ===== Mobile Menu =====
const menuToggle = document.querySelector('.mobile-menu-toggle');
const navLinks = document.querySelector('.nav-links');
if (menuToggle) {
  menuToggle.addEventListener('click', () => {
    navLinks.style.display = navLinks.style.display === 'flex' ? 'none' : 'flex';
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
setInterval(loadAppsData, 60000); // Refresh every minute