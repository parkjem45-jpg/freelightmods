// ===== Real-time View Tracker =====
class ViewTracker {
  constructor() {
    this.trackingKey = 'flm_page_views';
    this.sessionKey = 'flm_visitor_session';
    this.realtimeKey = 'flm_realtime_views';
    this.init();
  }

  init() {
    this.trackPageView();
    this.updateRealtimeViews();
    this.startRealtimeCleanup();
    
    // Update every 30 seconds
    setInterval(() => this.updateRealtimeViews(), 30000);
  }

  trackPageView() {
    // Get or create session
    let session = this.getSession();
    
    const pageView = {
      page: window.location.pathname,
      timestamp: Date.now(),
      sessionId: session.id,
      referrer: document.referrer || 'direct',
      isAdmin: window.location.pathname.includes('admin.html')
    };

    // Save to views history
    const views = this.getViews();
    views.push(pageView);
    
    // Keep last 30 days
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const filteredViews = views.filter(v => v.timestamp > thirtyDaysAgo);
    
    localStorage.setItem(this.trackingKey, JSON.stringify(filteredViews));
    
    // Update session last active
    session.lastActive = Date.now();
    localStorage.setItem(this.sessionKey, JSON.stringify(session));
    
    // Update realtime
    this.updateRealtimeViews();
  }

  getSession() {
    let session = JSON.parse(localStorage.getItem(this.sessionKey) || 'null');
    
    // Create new session if expired (>30 min inactive)
    if (!session || (Date.now() - session.lastActive) > 30 * 60 * 1000) {
      session = {
        id: this.generateSessionId(),
        startTime: Date.now(),
        lastActive: Date.now(),
        device: this.getDeviceInfo(),
        location: 'Unknown' // Would need IP geolocation service
      };
    }
    
    return session;
  }

  generateSessionId() {
    return 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);
  }

  getDeviceInfo() {
    const ua = navigator.userAgent;
    if (/mobile/i.test(ua)) return 'Mobile';
    if (/tablet/i.test(ua)) return 'Tablet';
    return 'Desktop';
  }

  getViews() {
    return JSON.parse(localStorage.getItem(this.trackingKey) || '[]');
  }

  updateRealtimeViews() {
    const views = this.getViews();
    const now = Date.now();
    const fiveMinutesAgo = now - (5 * 60 * 1000);
    
    // Count active sessions in last 5 minutes
    const activeSessions = new Set();
    const recentViews = views.filter(v => v.timestamp > fiveMinutesAgo);
    
    recentViews.forEach(v => activeSessions.add(v.sessionId));
    
    const realtimeData = {
      activeUsers: activeSessions.size,
      pageViewsLast5Min: recentViews.length,
      lastUpdate: now
    };
    
    localStorage.setItem(this.realtimeKey, JSON.stringify(realtimeData));
    
    // Update display if on admin page
    this.updateDisplay();
  }

  startRealtimeCleanup() {
    // Clean old sessions every minute
    setInterval(() => {
      const session = JSON.parse(localStorage.getItem(this.sessionKey) || 'null');
      if (session) {
        session.lastActive = Date.now();
        localStorage.setItem(this.sessionKey, JSON.stringify(session));
      }
      this.updateRealtimeViews();
    }, 60000);
  }

  updateDisplay() {
    const displayElements = {
      'activeUsers': document.getElementById('activeUsers'),
      'viewsToday': document.getElementById('viewsToday'),
      'totalViews': document.getElementById('totalViews'),
      'avgTimeOnSite': document.getElementById('avgTimeOnSite')
    };

    if (!Object.values(displayElements).some(el => el)) return;

    const realtime = JSON.parse(localStorage.getItem(this.realtimeKey) || '{"activeUsers":0}');
    const views = this.getViews();
    const today = new Date().setHours(0, 0, 0, 0);
    
    // Today's views
    const todayViews = views.filter(v => v.timestamp > today).length;
    
    // Total views
    const totalViews = views.length;
    
    // Average time (simplified calculation)
    const sessions = {};
    views.forEach(v => {
      if (!sessions[v.sessionId]) {
        sessions[v.sessionId] = { first: v.timestamp, last: v.timestamp };
      } else {
        sessions[v.sessionId].last = v.timestamp;
      }
    });
    
    let totalTime = 0;
    let sessionCount = 0;
    Object.values(sessions).forEach(s => {
      const duration = s.last - s.first;
      if (duration < 30 * 60 * 1000) { // Ignore sessions >30min
        totalTime += duration;
        sessionCount++;
      }
    });
    
    const avgTime = sessionCount > 0 ? Math.round(totalTime / sessionCount / 1000) : 0;
    const avgTimeFormatted = avgTime > 60 
      ? Math.round(avgTime / 60) + 'm'
      : avgTime + 's';

    // Update display
    if (displayElements.activeUsers) {
      displayElements.activeUsers.textContent = realtime.activeUsers || 0;
    }
    if (displayElements.viewsToday) {
      displayElements.viewsToday.textContent = todayViews;
    }
    if (displayElements.totalViews) {
      displayElements.totalViews.textContent = this.formatNumber(totalViews);
    }
    if (displayElements.avgTimeOnSite) {
      displayElements.avgTimeOnSite.textContent = avgTimeFormatted;
    }
  }

  formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }

  getDetailedStats() {
    const views = this.getViews();
    const today = new Date().setHours(0, 0, 0, 0);
    const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    return {
      today: views.filter(v => v.timestamp > today).length,
      thisWeek: views.filter(v => v.timestamp > weekAgo).length,
      total: views.length,
      pages: this.getPageStats(views),
      hourly: this.getHourlyStats(views)
    };
  }

  getPageStats(views) {
    const stats = {};
    views.forEach(v => {
      const page = v.page.replace('/', 'home') || 'home';
      stats[page] = (stats[page] || 0) + 1;
    });
    return stats;
  }

  getHourlyStats(views) {
    const hourly = Array(24).fill(0);
    views.forEach(v => {
      const hour = new Date(v.timestamp).getHours();
      hourly[hour]++;
    });
    return hourly;
  }
}

// Initialize tracker
const tracker = new ViewTracker();