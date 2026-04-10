// ===== Simple View Tracker =====
class ViewTracker {
  constructor() {
    this.sessionId = this.getSessionId();
    this.trackPageView();
  }

  getSessionId() {
    let id = sessionStorage.getItem('session_id');
    if (!id) {
      id = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
      sessionStorage.setItem('session_id', id);
    }
    return id;
  }

  async trackPageView() {
    try {
      await db.collection('analytics').add({
        page: window.location.pathname,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        sessionId: this.sessionId,
        referrer: document.referrer || 'direct'
      });
    } catch (e) {
      console.log('Analytics offline');
    }
  }
}

const tracker = new ViewTracker();