// ===== Real-time View Tracker with Firestore =====
class ViewTracker {
  constructor() {
    this.sessionId = this.getOrCreateSessionId();
    this.trackingEnabled = true;
    this.init();
  }

  init() {
    this.trackPageView();
    this.updateRealtimeStats();
    
    // Update stats every 30 seconds
    setInterval(() => this.updateRealtimeStats(), 30000);
    
    // Heartbeat every minute
    setInterval(() => this.sendHeartbeat(), 60000);
  }

  getOrCreateSessionId() {
    let sessionId = sessionStorage.getItem('flm_session_id');
    if (!sessionId) {
      sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);
      sessionStorage.setItem('flm_session_id', sessionId);
    }
    return sessionId;
  }

  getDeviceInfo() {
    const ua = navigator.userAgent;
    if (/mobile/i.test(ua)) return 'Mobile';
    if (/tablet/i.test(ua)) return 'Tablet';
    return 'Desktop';
  }

  getBrowserInfo() {
    const ua = navigator.userAgent;
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari')) return 'Safari';
    if (ua.includes('Edge')) return 'Edge';
    return 'Other';
  }

  async trackPageView() {
    if (!this.trackingEnabled) return;

    try {
      const pageView = {
        page: window.location.pathname || '/',
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        sessionId: this.sessionId,
        referrer: document.referrer || 'direct',
        device: this.getDeviceInfo(),
        browser: this.getBrowserInfo(),
        screenSize: `${window.innerWidth}x${window.innerHeight}`,
        language: navigator.language,
        isAdmin: window.location.pathname.includes('admin.html')
      };

      await db.collection('analytics').add(pageView);
      
      // Update session last active
      sessionStorage.setItem('flm_last_active', Date.now().toString());
    } catch (error) {
      console.warn('Analytics tracking error:', error);
      this.fallbackToLocalStorage();
    }
  }

  fallbackToLocalStorage() {
    // Fallback to localStorage if Firestore fails
    const views = JSON.parse(localStorage.getItem('flm_page_views') || '[]');
    views.push({
      page: window.location.pathname,
      timestamp: Date.now(),
      sessionId: this.sessionId
    });
    
    // Keep last 1000 views
    if (views.length > 1000) views.shift();
    localStorage.setItem('flm_page_views', JSON.stringify(views));
  }

  async sendHeartbeat() {
    if (!this.trackingEnabled) return;

    try {
      await db.collection('analytics').add({
        event: 'heartbeat',
        sessionId: this.sessionId,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        page: window.location.pathname
      });
    } catch (error) {
      // Silent fail
    }
  }

  async updateRealtimeStats() {
    // Only update if we're on admin page
    if (!window.location.pathname.includes('admin.html')) return;

    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      
      // Get active sessions
      const activeSnapshot = await db.collection('analytics')
        .where('timestamp', '>=', fiveMinutesAgo)
        .get();
      
      const activeSessions = new Set();
      let totalViews = 0;
      
      activeSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.sessionId) {
          activeSessions.add(data.sessionId);
        }
        totalViews++;
      });
      
      // Today's views
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todaySnapshot = await db.collection('analytics')
        .where('timestamp', '>=', today)
        .get();
      
      const todayViews = todaySnapshot.size;
      
      // Total all-time views
      const allTimeSnapshot = await db.collection('analytics').count().get();
      const allTimeViews = allTimeSnapshot.data().count;
      
      // Update display
      this.updateDisplay({
        activeUsers: activeSessions.size,
        viewsToday: todayViews,
        totalViews: allTimeViews,
        avgTime: await this.calculateAvgTime()
      });
      
      // Store in localStorage for quick access
      localStorage.setItem('flm_realtime_stats', JSON.stringify({
        activeUsers: activeSessions.size,
        viewsToday: todayViews,
        totalViews: allTimeViews,
        lastUpdate: Date.now()
      }));
    } catch (error) {
      console.warn('Realtime stats error:', error);
      this.loadFromLocalStorage();
    }
  }

  async calculateAvgTime() {
    try {
      // Get sessions from today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const snapshot = await db.collection('analytics')
        .where('timestamp', '>=', today)
        .orderBy('timestamp', 'asc')
        .get();
      
      const sessions = {};
      snapshot.forEach(doc => {
        const data = doc.data();
        if (!sessions[data.sessionId]) {
          sessions[data.sessionId] = {
            first: data.timestamp?.toDate() || new Date(),
            last: data.timestamp?.toDate() || new Date()
          };
        } else {
          sessions[data.sessionId].last = data.timestamp?.toDate() || new Date();
        }
      });
      
      let totalTime = 0;
      let sessionCount = 0;
      
      Object.values(sessions).forEach(s => {
        const duration = s.last - s.first;
        if (duration > 0 && duration < 30 * 60 * 1000) {
          totalTime += duration;
          sessionCount++;
        }
      });
      
      const avgSeconds = sessionCount > 0 ? Math.round(totalTime / sessionCount / 1000) : 0;
      return avgSeconds > 60 
        ? Math.round(avgSeconds / 60) + 'm'
        : avgSeconds + 's';
    } catch (error) {
      return '--';
    }
  }

  loadFromLocalStorage() {
    const stats = JSON.parse(localStorage.getItem('flm_realtime_stats') || '{}');
    this.updateDisplay(stats);
  }

  updateDisplay(stats) {
    const elements = {
      'activeUsers': stats.activeUsers || 0,
      'viewsToday': stats.viewsToday || 0,
      'totalViews': this.formatNumber(stats.totalViews || 0),
      'avgTimeOnSite': stats.avgTime || '--'
    };
    
    Object.entries(elements).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    });
  }

  formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }

  async getDetailedStats() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      const [todayCount, weekCount, totalCount] = await Promise.all([
        db.collection('analytics').where('timestamp', '>=', today).count().get(),
        db.collection('analytics').where('timestamp', '>=', weekAgo).count().get(),
        db.collection('analytics').count().get()
      ]);
      
      return {
        today: todayCount.data().count,
        thisWeek: weekCount.data().count,
        total: totalCount.data().count
      };
    } catch (error) {
      return { today: 0, thisWeek: 0, total: 0 };
    }
  }
}

// Initialize tracker
const tracker = new ViewTracker();

// Track downloads (called from download buttons)
window.trackDownload = async function(appId, appName) {
  try {
    await db.collection('analytics').add({
      event: 'download',
      appId: appId,
      appName: appName,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      sessionId: tracker.sessionId
    });
    
    // Increment download count on the APK
    if (appId) {
      await db.collection('apks').doc(appId).update({
        downloads: firebase.firestore.FieldValue.increment(1)
      });
    }
  } catch (error) {
    console.warn('Download tracking error:', error);
  }
};

// Track search queries
window.trackSearch = async function(query) {
  try {
    await db.collection('analytics').add({
      event: 'search',
      query: query,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      sessionId: tracker.sessionId
    });
  } catch (error) {
    // Silent fail
  }
};