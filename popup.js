// TakeYouForward DSA Confidence Tracker Popup Script

class PopupManager {
    constructor() {
        this.syncManager = new window.SyncManager();
        this.init();
    }

    async init() {
        await this.initializeAuth();
        await this.loadStatistics();
        this.setupEventListeners();
        this.checkCurrentTab();
    }

    async initializeAuth() {
        const isAuthenticated = await this.syncManager.checkAuthStatus();
        this.updateAuthUI(isAuthenticated);
    }

    updateAuthUI(isAuthenticated) {
        const loginForm = document.getElementById('login-form');
        const userInfo = document.getElementById('user-info');
        const userEmail = document.getElementById('user-email');
        
        if (isAuthenticated && this.syncManager.currentUser) {
            loginForm.style.display = 'none';
            userInfo.style.display = 'flex';
            userEmail.textContent = this.syncManager.currentUser.email || 'User';
        } else {
            loginForm.style.display = 'flex';
            userInfo.style.display = 'none';
        }
    }

    async checkCurrentTab() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const statusMessage = document.getElementById('status-message');
            
            if (!tab.url.includes('takeuforward.org')) {
                this.showMessage('Please navigate to a TakeYouForward DSA sheet page to use this extension.', 'info');
                this.disableActions();
            } else if (this.isDSASheetPage(tab.url)) {
                this.showMessage('✅ Extension is active on this page!', 'success');
            } else {
                this.showMessage('Navigate to a DSA sheet page (A2Z, SDE, or 79 problems) to track confidence.', 'info');
            }
        } catch (error) {
            console.error('Error checking current tab:', error);
        }
    }

    isDSASheetPage(url) {
        const dsaSheetPatterns = [
            '/strivers-a2z-dsa-course/',
            '/interviews/strivers-sde-sheet',
            '/interview-sheets/strivers-79',
            '/interviews/blind-75'
        ];
        
        return dsaSheetPatterns.some(pattern => url.includes(pattern));
    }

    async loadStatistics() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (tab.url.includes('takeuforward.org')) {
                const response = await chrome.tabs.sendMessage(tab.id, { action: 'getStatistics' });
                if (response) {
                    this.updateStatisticsDisplay(response);
                }
            } else {
                // Load from storage if not on TUF page
                const result = await chrome.storage.local.get(['tuf_dsa_confidence']);
                const confidenceData = result.tuf_dsa_confidence || {};
                const stats = this.calculateStatsFromData(confidenceData);
                this.updateStatisticsDisplay(stats);
            }
        } catch (error) {
            console.error('Error loading statistics:', error);
            this.updateStatisticsDisplay({
                total: 0, none: 0, low: 0, medium: 0, high: 0, expert: 0
            });
        }
    }

    calculateStatsFromData(data) {
        const stats = { total: 0, none: 0, low: 0, medium: 0, high: 0, expert: 0 };
        
        Object.values(data).forEach(confidence => {
            stats.total++;
            stats[confidence] = (stats[confidence] || 0) + 1;
        });
        
        return stats;
    }

    updateStatisticsDisplay(stats) {
        // Update individual counts
        document.getElementById('total-problems').textContent = stats.total;
        document.getElementById('expert-count').textContent = stats.expert;
        document.getElementById('high-count').textContent = stats.high;
        document.getElementById('medium-count').textContent = stats.medium;
        document.getElementById('low-count').textContent = stats.low;
        // document.getElementById('none-count').textContent = stats.none;

        // Update progress bar
        const confidentProblems = stats.expert + stats.high + stats.medium;
        const progressPercentage = stats.total > 0 ? Math.round((confidentProblems / stats.total) * 100) : 0;
        
        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');
        
        progressFill.style.width = `${progressPercentage}%`;
        progressText.textContent = `${progressPercentage}% confident problems (${confidentProblems}/${stats.total})`;

        // Add animation to updated values
        document.querySelectorAll('.stat-value').forEach(el => {
            el.classList.add('updated');
            setTimeout(() => el.classList.remove('updated'), 300);
        });
    }

    setupEventListeners() {
        // Authentication event listeners
        document.getElementById('login-btn').addEventListener('click', async () => {
            const username = document.getElementById('username-input').value.trim();
            const password = document.getElementById('password-input').value.trim();
            
            if (!username || !password) {
                this.showMessage('Please enter both username and password.', 'error');
                return;
            }

            this.showMessage('Logging in...', 'info');
            const result = await this.syncManager.login(username, password);
            
            if (result.success) {
                this.showMessage('Login successful!', 'success');
                this.updateAuthUI(true);
                await this.syncData();
            } else {
                this.showMessage(`Login failed: ${result.error}`, 'error');
            }
        });

        document.getElementById('signup-btn').addEventListener('click', async () => {
            const username = document.getElementById('username-input').value.trim();
            const password = document.getElementById('password-input').value.trim();
            
            if (!username || !password) {
                this.showMessage('Please enter both username and password.', 'error');
                return;
            }

            this.showMessage('Creating account...', 'info');
            const result = await this.syncManager.signup(username, password);
            
            if (result.success) {
                this.showMessage('Account created! Logging in...', 'success');
                this.updateAuthUI(true);
                await this.syncData();
            } else {
                this.showMessage(`Signup failed: ${result.error}`, 'error');
            }
        });

        document.getElementById('logout-btn').addEventListener('click', async () => {
            await this.syncManager.logout();
            this.updateAuthUI(false);
            this.showMessage('Logged out successfully.', 'success');
        });

        document.getElementById('sync-btn').addEventListener('click', async () => {
            await this.syncData();
        });

        // Export data button
        document.getElementById('export-btn').addEventListener('click', async () => {
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                
                if (tab.url.includes('takeuforward.org')) {
                    await chrome.tabs.sendMessage(tab.id, { action: 'exportData' });
                    this.showMessage('Data exported successfully!', 'success');
                } else {
                    // Export from storage if not on TUF page
                    await this.exportFromStorage();
                }
            } catch (error) {
                console.error('Error exporting data:', error);
                this.showMessage('Error exporting data. Please try again.', 'error');
            }
        });

        // Import data file input
        document.getElementById('import-file').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const text = await this.readFileAsText(file);
                const data = JSON.parse(text);
                
                if (data.data) {
                    await this.importData(data.data);
                    this.showMessage('Data imported successfully!', 'success');
                    await this.loadStatistics();
                } else {
                    throw new Error('Invalid file format');
                }
            } catch (error) {
                console.error('Error importing data:', error);
                this.showMessage('Error importing data. Please check the file format.', 'error');
            }
            
            // Reset file input
            e.target.value = '';
        });

        // Clear all data button
        document.getElementById('clear-btn').addEventListener('click', async () => {
            if (confirm('Are you sure you want to clear all confidence data? This action cannot be undone.')) {
                try {
                    await chrome.storage.local.remove(['tuf_dsa_confidence']);
                    
                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    if (tab.url.includes('takeuforward.org')) {
                        await chrome.tabs.sendMessage(tab.id, { action: 'clearData' });
                    }
                    
                    this.showMessage('All data cleared successfully!', 'success');
                    await this.loadStatistics();
                } catch (error) {
                    console.error('Error clearing data:', error);
                    this.showMessage('Error clearing data. Please try again.', 'error');
                }
            }
        });

        // Refresh statistics every 5 seconds when on TUF page
        setInterval(() => {
            this.loadStatistics();
        }, 5000);
    }

    async exportFromStorage() {
        const result = await chrome.storage.local.get(['tuf_dsa_confidence']);
        const exportData = {
            timestamp: new Date().toISOString(),
            url: 'exported_from_storage',
            data: result.tuf_dsa_confidence || {}
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json'
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tuf_confidence_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async importData(data) {
        const existing = await chrome.storage.local.get(['tuf_dsa_confidence']);
        const existingData = existing.tuf_dsa_confidence || {};
        
        const mergedData = { ...existingData, ...data };
        await chrome.storage.local.set({ tuf_dsa_confidence: mergedData });
    }

    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = e => reject(e);
            reader.readAsText(file);
        });
    }

    async syncData() {
        if (!this.syncManager.isAuthenticated) {
            this.showMessage('Please login first to sync data.', 'error');
            return;
        }

        const syncStatus = document.getElementById('sync-status');
        if (syncStatus) {
            syncStatus.textContent = 'Syncing...';
            syncStatus.className = 'sync-status syncing';
        }

        try {
            // Get local data
            const result = await chrome.storage.local.get(['tuf_dsa_confidence']);
            const localData = result.tuf_dsa_confidence || {};

            // Download from cloud
            const cloudResult = await this.syncManager.downloadFromCloud();
            
            if (cloudResult.success) {
                // Merge local and cloud data
                const mergedData = { ...cloudResult.data, ...localData };
                
                // Save merged data locally
                await chrome.storage.local.set({ tuf_dsa_confidence: mergedData });
                
                // Upload merged data to cloud
                const uploadResult = await this.syncManager.syncToCloud(mergedData);
                
                if (uploadResult.success) {
                    this.showMessage('Data synced successfully! Please refresh!', 'success');
                    if (syncStatus) {
                        syncStatus.textContent = 'Synced';
                        syncStatus.className = 'sync-status';
                    }
                    await this.loadStatistics();
                } else {
                    throw new Error(uploadResult.error || 'Upload failed');
                }
            } else {
                throw new Error(cloudResult.error || 'Download failed');
            }
        } catch (error) {
            console.error('Sync error:', error);
            this.showMessage(`Sync failed: ${error.message}`, 'error');
            if (syncStatus) {
                syncStatus.textContent = 'Sync Error';
                syncStatus.className = 'sync-status error';
            }
        }
    }

    showMessage(text, type) {
        const statusMessage = document.getElementById('status-message');
        statusMessage.textContent = text;
        statusMessage.className = `status-message ${type}`;
        statusMessage.style.display = 'block';

        // Auto-hide success/info messages
        if (type !== 'error') {
            setTimeout(() => {
                statusMessage.style.display = 'none';
            }, 3000);
        }
    }

    disableActions() {
        const actionButtons = document.querySelectorAll('.action-btn');
        actionButtons.forEach(btn => {
            btn.style.opacity = '0.5';
            btn.style.pointerEvents = 'none';
        });
    }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    try {
        new PopupManager();
    } catch (error) {
        console.error('Failed to initialize popup:', error);
        // Show basic error message if popup fails to load
        document.body.innerHTML = `
            <div style="padding: 20px; text-align: center;">
                <h3>Extension Error</h3>
                <p>Failed to load popup. Please reload the extension.</p>
                <p style="font-size: 12px; color: #666;">Error: ${error.message}</p>
            </div>
        `;
    }
});

// Handle any popup-specific keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
            case 'e':
                e.preventDefault();
                document.getElementById('export-btn').click();
                break;
            case 'i':
                e.preventDefault();
                document.getElementById('import-file').click();
                break;
        }
    }
});
