// Cloud Sync Manager for DSA Confidence Tracker
class SyncManager {
  constructor() {
    // Determine API URL based on current environment
    this.apiBaseUrl = this.determineApiUrl();
    this.isAuthenticated = false;
    this.currentUser = null;
    this.lastSync = null;
  }

  determineApiUrl() {
    // Default to localhost - users can configure their own API server
    console.log('API URL set to: http://localhost:5001');
    return 'https://tuf-v2.onrender.com';
  }

  // Check if user is authenticated
  async checkAuthStatus() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/auth/me`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        this.isAuthenticated = true;
        this.currentUser = data.user;
        return true;
      } else {
        this.isAuthenticated = false;
        this.currentUser = null;
        return false;
      }
    } catch (error) {
      console.log('Auth check failed (offline/server unavailable):', error.message);
      this.isAuthenticated = false;
      return false;
    }
  }

  // Login with username and password
  async login(username, password) {
    try {
      console.log('Attempting login to:', `${this.apiBaseUrl}/api/auth/login`);
      
      const response = await fetch(`${this.apiBaseUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });
      
      if (response.ok) {
        const data = await response.json();
        this.isAuthenticated = true;
        this.currentUser = data.user;
        return { success: true, user: data.user };
      } else {
        const error = await response.json();
        return { success: false, error: error.error || 'Login failed' };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Unable to connect to server' };
    }
  }

  // Sign up with username and password
  async signup(username, password) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });
      
      if (response.ok) {
        const data = await response.json();
        this.isAuthenticated = true;
        this.currentUser = data.user;
        return { success: true, user: data.user };
      } else {
        const error = await response.json();
        return { success: false, error: error.error || 'Signup failed' };
      }
    } catch (error) {
      console.error('Signup error:', error);
      return { success: false, error: 'Unable to connect to server' };
    }
  }

  // Logout
  async logout() {
    try {
      await fetch(`${this.apiBaseUrl}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.log('Logout request failed (offline):', error.message);
    }
    
    this.isAuthenticated = false;
    this.currentUser = null;
  }

  // Sync local data to cloud
  async syncToCloud(confidenceData) {
    if (!this.isAuthenticated) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const response = await fetch(`${this.apiBaseUrl}/api/confidence/sync`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ confidenceData }),
      });
      
      if (response.ok) {
        this.lastSync = new Date();
        return { success: true };
      } else {
        const error = await response.json();
        return { success: false, error: error.error || 'Sync failed' };
      }
    } catch (error) {
      console.error('Sync to cloud error:', error);
      return { success: false, error: 'Network error' };
    }
  }

  // Download data from cloud
  async downloadFromCloud() {
    if (!this.isAuthenticated) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const response = await fetch(`${this.apiBaseUrl}/api/confidence`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        return { success: true, data };
      } else {
        const error = await response.json();
        return { success: false, error: error.error || 'Download failed' };
      }
    } catch (error) {
      console.error('Download from cloud error:', error);
      return { success: false, error: 'Network error' };
    }
  }

  // Update single confidence level
  async updateConfidence(problemId, confidenceLevel) {
    if (!this.isAuthenticated) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const response = await fetch(`${this.apiBaseUrl}/api/confidence/${problemId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ confidenceLevel }),
      });
      
      if (response.ok) {
        return { success: true };
      } else {
        const error = await response.json();
        return { success: false, error: error.error || 'Update failed' };
      }
    } catch (error) {
      console.error('Update confidence error:', error);
      return { success: false, error: 'Network error' };
    }
  }

  // Get statistics from cloud
  async getCloudStats() {
    if (!this.isAuthenticated) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const response = await fetch(`${this.apiBaseUrl}/api/stats`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const stats = await response.json();
        return { success: true, stats };
      } else {
        const error = await response.json();
        return { success: false, error: error.error || 'Failed to get stats' };
      }
    } catch (error) {
      console.error('Get cloud stats error:', error);
      return { success: false, error: 'Network error' };
    }
  }
}

// Export for use in other files
window.SyncManager = SyncManager;