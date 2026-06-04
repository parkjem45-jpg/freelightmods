// auth.js — Standalone Authentication Utility (Safe Version)
// ==========================================================
// NOTE: This file is optional. admin.html uses admin.js directly.
// If you include this, make sure it does not conflict with admin.js.

(function() {
  'use strict';

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
      if (themeIcon) themeIcon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }
  }

  // Safe logout helper
  window.logout = function() {
    if (typeof auth === 'undefined') {
      alert('Auth not loaded');
      return;
    }
    if (confirm('Are you sure you want to logout?')) {
      auth.signOut().then(() => {
        window.location.reload();
      }).catch(err => {
        alert('Logout error: ' + err.message);
      });
    }
  };

  window.sendPasswordReset = async function() {
    if (typeof auth === 'undefined') return;
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

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
})();