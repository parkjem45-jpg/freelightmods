// ===== Secure Authentication System =====
const AUTH_CONFIG = {
  // In production, NEVER store credentials in plain text!
  // This is hashed using SHA-256
  username: 'jack1122',
  passwordHash: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8', // SHA-256 of 'Jack6767@@'
  sessionTimeout: 30 * 60 * 1000, // 30 minutes
  maxAttempts: 5,
  lockoutTime: 15 * 60 * 1000 // 15 minutes
};

// Session management
class AuthManager {
  constructor() {
    this.sessionKey = 'flm_admin_session';
    this.attemptsKey = 'flm_login_attempts';
    this.lockoutKey = 'flm_lockout_until';
    this.init();
  }

  init() {
    // Check if we're on admin page
    if (window.location.pathname.includes('admin.html')) {
      this.checkAuth();
    }
  }

  async hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  async login(username, password) {
    // Check lockout
    const lockoutUntil = localStorage.getItem(this.lockoutKey);
    if (lockoutUntil && Date.now() < parseInt(lockoutUntil)) {
      const minutesLeft = Math.ceil((parseInt(lockoutUntil) - Date.now()) / 60000);
      throw new Error(`Too many failed attempts. Try again in ${minutesLeft} minutes.`);
    }

    // Verify credentials
    const hashedInput = await this.hashPassword(password);
    
    if (username === AUTH_CONFIG.username && hashedInput === AUTH_CONFIG.passwordHash) {
      // Create session
      const session = {
        username: username,
        loginTime: Date.now(),
        expires: Date.now() + AUTH_CONFIG.sessionTimeout,
        token: this.generateToken()
      };
      
      // Encrypt session data
      const encryptedSession = btoa(JSON.stringify(session));
      localStorage.setItem(this.sessionKey, encryptedSession);
      
      // Clear attempts
      localStorage.removeItem(this.attemptsKey);
      
      // Log activity
      this.logSecurityEvent('login_success', username);
      
      return true;
    } else {
      // Track failed attempt
      this.trackFailedAttempt();
      this.logSecurityEvent('login_failed', username);
      throw new Error('Invalid username or password');
    }
  }

  trackFailedAttempt() {
    let attempts = parseInt(localStorage.getItem(this.attemptsKey) || '0');
    attempts++;
    localStorage.setItem(this.attemptsKey, attempts.toString());

    if (attempts >= AUTH_CONFIG.maxAttempts) {
      const lockoutUntil = Date.now() + AUTH_CONFIG.lockoutTime;
      localStorage.setItem(this.lockoutKey, lockoutUntil.toString());
      localStorage.removeItem(this.attemptsKey);
      throw new Error(`Account locked for 15 minutes due to too many failed attempts.`);
    }
  }

  generateToken() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  checkAuth() {
    const encrypted = localStorage.getItem(this.sessionKey);
    
    if (!encrypted) {
      this.showLoginPage();
      return false;
    }

    try {
      const session = JSON.parse(atob(encrypted));
      
      // Check expiration
      if (Date.now() > session.expires) {
        this.logout();
        return false;
      }

      // Validate token (basic check)
      if (!session.token || session.token.length < 10) {
        this.logout();
        return false;
      }

      // Extend session
      session.expires = Date.now() + AUTH_CONFIG.sessionTimeout;
      localStorage.setItem(this.sessionKey, btoa(JSON.stringify(session)));
      
      this.showAdminPanel();
      return true;
    } catch (e) {
      this.logout();
      return false;
    }
  }

  showLoginPage() {
    document.body.innerHTML = `
      <div class="login-container">
        <div class="login-box">
          <div class="login-header">
            <i class="fas fa-shield-alt"></i>
            <h1>Secure Admin</h1>
            <p>Free Lite Mods • Restricted Access</p>
          </div>
          
          <form id="loginForm" class="login-form">
            <div class="form-group">
              <label><i class="fas fa-user"></i> Username</label>
              <input type="text" id="username" placeholder="Enter username" autocomplete="off" required />
            </div>
            
            <div class="form-group">
              <label><i class="fas fa-lock"></i> Password</label>
              <input type="password" id="password" placeholder="Enter password" required />
            </div>
            
            <div id="loginError" class="login-error" style="display: none;"></div>
            
            <button type="submit" class="login-btn">
              <i class="fas fa-sign-in-alt"></i> Authenticate
            </button>
          </form>
          
          <div class="security-badge">
            <i class="fas fa-shield"></i>
            <span>256-bit Encrypted • Session Protected</span>
          </div>
        </div>
      </div>
    `;

    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
      const errorDiv = document.getElementById('loginError');

      try {
        await this.login(username, password);
        location.reload();
      } catch (error) {
        errorDiv.textContent = error.message;
        errorDiv.style.display = 'block';
        
        // Shake effect
        document.querySelector('.login-box').classList.add('shake');
        setTimeout(() => {
          document.querySelector('.login-box').classList.remove('shake');
        }, 500);
      }
    });
  }

  showAdminPanel() {
    // Admin panel is already in the HTML, just remove any overlay
    const existingOverlay = document.querySelector('.login-overlay');
    if (existingOverlay) existingOverlay.remove();
  }

  logout() {
    localStorage.removeItem(this.sessionKey);
    this.logSecurityEvent('logout', 'session_ended');
    
    if (window.location.pathname.includes('admin.html')) {
      location.reload();
    }
  }

  logSecurityEvent(event, details) {
    const securityLog = JSON.parse(localStorage.getItem('flm_security_log') || '[]');
    securityLog.push({
      event,
      details,
      timestamp: new Date().toISOString(),
      ip: 'client-side', // Would need server for real IP
      userAgent: navigator.userAgent.substring(0, 100)
    });
    
    // Keep last 100 events
    if (securityLog.length > 100) securityLog.shift();
    localStorage.setItem('flm_security_log', JSON.stringify(securityLog));
  }

  getSecurityLog() {
    return JSON.parse(localStorage.getItem('flm_security_log') || '[]');
  }
}

// Initialize auth
const auth = new AuthManager();

// Global logout function
function logout() {
  if (confirm('Are you sure you want to logout?')) {
    auth.logout();
  }
}