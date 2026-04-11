// ===== Admin Authentication with Firebase =====

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

// Check auth state
if (typeof auth !== 'undefined') {
  auth.onAuthStateChanged(async (user) => {
    if (window.location.pathname.includes('admin.html')) {
      if (user) {
        const userInfo = document.getElementById('userInfo');
        if (userInfo) {
          userInfo.innerHTML = `
            <div class="user-avatar">
              <i class="fas fa-user-circle"></i>
            </div>
            <div class="user-details">
              <span class="user-email">${user.email}</span>
              <span class="user-role">Administrator</span>
            </div>
          `;
        }
        
        document.body.classList.add('authenticated');
        
        if (typeof initAdminPanel === 'function') {
          initAdminPanel(user);
        }
      } else {
        showAuthUI();
      }
    }
  });
}

function showAuthUI() {
  document.body.innerHTML = `
    <div class="login-container">
      <div class="login-box">
        <div class="login-header">
          <i class="fas fa-shield-alt"></i>
          <h1>Admin Access</h1>
          <p>Sign in or create an account</p>
        </div>
        
        <div class="auth-tabs">
          <button class="auth-tab active" data-tab="login">Login</button>
          <button class="auth-tab" data-tab="signup">Sign Up</button>
          <button class="auth-tab" data-tab="reset">Reset</button>
        </div>
        
        <form id="authForm" class="login-form">
          <div class="form-group">
            <label><i class="fas fa-envelope"></i> Email</label>
            <input type="email" id="email" placeholder="admin@example.com" required />
          </div>
          <div class="form-group" id="passwordGroup">
            <label><i class="fas fa-lock"></i> Password</label>
            <input type="password" id="password" placeholder="••••••••" required />
          </div>
          <div class="form-group" id="confirmPasswordGroup" style="display:none;">
            <label><i class="fas fa-check"></i> Confirm Password</label>
            <input type="password" id="confirmPassword" placeholder="••••••••" />
          </div>
          <div id="authError" class="login-error" style="display: none;"></div>
          <div id="authSuccess" class="login-success" style="display: none;"></div>
          <button type="submit" class="login-btn" id="authSubmitBtn">
            <i class="fas fa-sign-in-alt"></i> <span>Login</span>
          </button>
        </form>
        
        <div class="security-badge">
          <i class="fas fa-shield"></i>
          <span>Firebase Secured</span>
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
  const passwordGroup = document.getElementById('passwordGroup');
  const confirmGroup = document.getElementById('confirmPasswordGroup');
  const errorDiv = document.getElementById('authError');
  const successDiv = document.getElementById('authSuccess');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      mode = tab.dataset.tab;
      
      errorDiv.style.display = 'none';
      successDiv.style.display = 'none';
      
      if (mode === 'signup') {
        passwordGroup.style.display = 'block';
        confirmGroup.style.display = 'block';
        submitSpan.textContent = 'Sign Up';
        submitBtn.innerHTML = '<i class="fas fa-user-plus"></i> <span>Sign Up</span>';
      } else if (mode === 'reset') {
        passwordGroup.style.display = 'none';
        confirmGroup.style.display = 'none';
        submitSpan.textContent = 'Send Reset Email';
        submitBtn.innerHTML = '<i class="fas fa-envelope"></i> <span>Send Reset Email</span>';
      } else {
        passwordGroup.style.display = 'block';
        confirmGroup.style.display = 'none';
        submitSpan.textContent = 'Login';
        submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> <span>Login</span>';
      }
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password')?.value;
    
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Processing...</span>';

    try {
      if (mode === 'signup') {
        const confirm = document.getElementById('confirmPassword').value;
        if (password !== confirm) throw new Error('Passwords do not match');
        if (password.length < 6) throw new Error('Password must be at least 6 characters');
        
        await auth.createUserWithEmailAndPassword(email, password);
        successDiv.textContent = 'Account created! Redirecting...';
        successDiv.style.display = 'block';
        setTimeout(() => location.reload(), 1500);
        
      } else if (mode === 'reset') {
        await auth.sendPasswordResetEmail(email);
        successDiv.textContent = 'Password reset email sent!';
        successDiv.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-envelope"></i> <span>Send Reset Email</span>';
        
      } else {
        await auth.signInWithEmailAndPassword(email, password);
      }
    } catch (error) {
      errorDiv.textContent = getReadableError(error);
      errorDiv.style.display = 'block';
      submitBtn.disabled = false;
      
      if (mode === 'login') {
        submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> <span>Login</span>';
      } else if (mode === 'signup') {
        submitBtn.innerHTML = '<i class="fas fa-user-plus"></i> <span>Sign Up</span>';
      } else {
        submitBtn.innerHTML = '<i class="fas fa-envelope"></i> <span>Send Reset Email</span>';
      }
    }
  });
}

function getReadableError(error) {
  const messages = {
    'auth/invalid-email': 'Invalid email address.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/email-already-in-use': 'Email is already registered.',
    'auth/weak-password': 'Password should be at least 6 characters.',
    'auth/network-request-failed': 'Network error. Check your connection.',
    'auth/too-many-requests': 'Too many attempts. Try again later.'
  };
  return messages[error.code] || error.message;
}

// Logout function
window.logout = function() {
  if (confirm('Are you sure you want to logout?')) {
    auth.signOut().then(() => {
      window.location.reload();
    });
  }
};

// Password reset
window.sendPasswordReset = async function() {
  const user = auth.currentUser;
  if (user) {
    try {
      await auth.sendPasswordResetEmail(user.email);
      alert('Password reset email sent to ' + user.email);
    } catch (error) {
      alert('Error: ' + error.message);
    }
  }
};