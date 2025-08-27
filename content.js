// TakeYouForward DSA Confidence Tracker Content Script

class DSAConfidenceTracker {
  constructor() {
    this.confidenceLevels = {
      'none': { label: 'Not Set', color: '#e0e0e0', value: 0 },
      'low': { label: 'Low', color: '#ff6b6b', value: 1 },
      'medium': { label: 'Medium', color: '#feca57', value: 2 },
      'high': { label: 'High', color: '#48dbfb', value: 3 },
      'expert': { label: 'Expert', color: '#0be881', value: 4 }
    };
    this.storageKey = 'tuf_dsa_confidence';
    this.userKey = 'tuf_dsa_user';
    this.confidenceData = {};
    this.syncManager = new window.SyncManager();
    this.init();
  }

  async init() {
    // Check if user is authenticated and sync data
    await this.initializeSync();
    
    // Load existing confidence data
    await this.loadConfidenceData();
    
    // Wait for page to fully load
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.injectConfidenceColumn());
    } else {
      this.injectConfidenceColumn();
    }

    // Watch for dynamic content changes
    this.observePageChanges();
  }

  async initializeSync() {
    // Check if user is already authenticated
    const isAuthenticated = await this.syncManager.checkAuthStatus();
    
    if (isAuthenticated) {
      console.log('User authenticated, syncing data...');
      await this.syncWithCloud();
    } else {
      console.log('User not authenticated, using local storage only');
    }
  }

  async syncWithCloud() {
    try {
      // Try to download latest data from cloud
      const cloudResult = await this.syncManager.downloadFromCloud();
      
      if (cloudResult.success) {
        // Merge cloud data with local data
        const localData = await this.getLocalData();
        const mergedData = { ...cloudResult.data, ...localData };
        
        // Save merged data locally
        this.confidenceData = mergedData;
        await this.saveConfidenceData();
        
        // Upload merged data back to cloud
        await this.syncManager.syncToCloud(mergedData);
        console.log('Data synced successfully, please refresh!');
      }
    } catch (error) {
      console.log('Cloud sync failed, continuing with local data:', error.message);
    }
  }

  async getLocalData() {
    try {
      const result = await chrome.storage.local.get([this.storageKey]);
      return result[this.storageKey] || {};
    } catch (error) {
      console.error('Error getting local data:', error);
      return {};
    }
  }

  async loadConfidenceData() {
    try {
      const result = await chrome.storage.local.get([this.storageKey]);
      this.confidenceData = result[this.storageKey] || {};
    } catch (error) {
      console.error('Error loading confidence data:', error);
      this.confidenceData = {};
    }
  }

  async saveConfidenceData() {
    try {
      // Save locally first
      await chrome.storage.local.set({ [this.storageKey]: this.confidenceData });
      
      // Try to sync to cloud if authenticated
      if (this.syncManager.isAuthenticated) {
        const syncResult = await this.syncManager.syncToCloud(this.confidenceData);
        if (!syncResult.success) {
          console.log('Cloud sync failed:', syncResult.error);
        }
      }
    } catch (error) {
      console.error('Error saving confidence data:', error);
    }
  }

  observePageChanges() {
    const observer = new MutationObserver((mutations) => {
      let shouldReinject = false;
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1 && (node.tagName === 'TABLE' || node.querySelector('table'))) {
              shouldReinject = true;
            }
          });
        }
      });
      
      if (shouldReinject) {
        setTimeout(() => this.injectConfidenceColumn(), 100);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  injectConfidenceColumn() {
    const tables = this.findDSATables();
    
    tables.forEach((table, tableIndex) => {
      // Skip if already processed
      if (table.querySelector('.tuf-confidence-header')) {
        return;
      }

      this.processTable(table, tableIndex);
    });
  }

  findDSATables() {
    const tables = [];
    
    // Look for tables containing DSA problems
    const allTables = document.querySelectorAll('table');
    
    allTables.forEach(table => {
      const headers = table.querySelectorAll('th, thead td');
      const headerTexts = Array.from(headers).map(h => h.textContent.toLowerCase().trim());
      
      // Check if this looks like a DSA problems table
      const isDSATable = headerTexts.some(text => 
        text.includes('problem') || 
        text.includes('status') || 
        text.includes('practice') ||
        text.includes('difficulty')
      );

      if (isDSATable) {
        tables.push(table);
      }
    });

    return tables;
  }

  processTable(table, tableIndex) {
    const headerRow = table.querySelector('thead tr, tr:first-child');
    if (!headerRow) return;

    // Add confidence header
    const confidenceHeader = document.createElement('th');
    confidenceHeader.textContent = 'Confidence';
    confidenceHeader.className = 'tuf-confidence-header';
    confidenceHeader.style.cssText = `
      background-color: #f8f9fa;
      padding: 12px 8px;
      text-align: center;
      font-weight: 600;
      color: #495057;
      position: sticky;
      top: 0;
      z-index: 10;
    `;
    
    headerRow.appendChild(confidenceHeader);

    // Process data rows
    const dataRows = table.querySelectorAll('tbody tr, tr:not(:first-child)');
    dataRows.forEach((row, rowIndex) => {
      this.addConfidenceCell(row, tableIndex, rowIndex);
    });
  }

  addConfidenceCell(row, tableIndex, rowIndex) {
    // Skip if already has confidence cell
    if (row.querySelector('.tuf-confidence-cell')) {
      return;
    }

    const problemCell = this.extractProblemInfo(row);
    if (!problemCell.name) return;

    const confidenceCell = document.createElement('td');
    confidenceCell.className = 'tuf-confidence-cell';
    confidenceCell.style.cssText = `
      padding: 8px;
      text-align: center;
      vertical-align: middle;
    `;

    const problemKey = this.generateProblemKey(problemCell.name, tableIndex, rowIndex);
    const currentConfidence = this.confidenceData[problemKey] || 'none';

    const dropdown = this.createConfidenceDropdown(problemKey, currentConfidence);
    confidenceCell.appendChild(dropdown);
    
    row.appendChild(confidenceCell);
  }

  extractProblemInfo(row) {
    const cells = row.querySelectorAll('td');
    let problemName = '';
    
    // Try different strategies to find problem name
    for (let cell of cells) {
      const links = cell.querySelectorAll('a');
      if (links.length > 0) {
        const link = links[0];
        if (link.textContent.trim() && !link.href.includes('youtube') && !link.href.includes('editorial')) {
          problemName = link.textContent.trim();
          break;
        }
      }
      
      // Fallback: look for text content that might be a problem name
      if (!problemName && cell.textContent.trim() && 
          cell.textContent.length > 5 && 
          cell.textContent.length < 100) {
        problemName = cell.textContent.trim();
      }
    }

    return { name: problemName };
  }

  generateProblemKey(problemName, tableIndex, rowIndex) {
    const url = window.location.href;
    const pageKey = url.split('/').pop() || 'unknown';
    return `${pageKey}_${tableIndex}_${rowIndex}_${problemName.substring(0, 50)}`;
  }

  createConfidenceDropdown(problemKey, currentConfidence) {
    const select = document.createElement('select');
    select.className = 'tuf-confidence-select';
    select.style.cssText = `
      width: 100%;
      padding: 6px 8px;
      border: 1px solid #ced4da;
      border-radius: 4px;
      background-color: white;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s ease;
    `;

    // Add options
    Object.entries(this.confidenceLevels).forEach(([key, level]) => {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = level.label;
      option.selected = key === currentConfidence;
      select.appendChild(option);
    });

    // Apply current confidence color
    this.updateDropdownStyle(select, currentConfidence);

    // Handle confidence changes
    select.addEventListener('change', async (e) => {
      const newConfidence = e.target.value;
      this.confidenceData[problemKey] = newConfidence;
      await this.saveConfidenceData();
      this.updateDropdownStyle(select, newConfidence);
      
      // Dispatch custom event for statistics
      window.dispatchEvent(new CustomEvent('confidenceUpdated', {
        detail: { problemKey, confidence: newConfidence }
      }));
    });

    return select;
  }

  updateDropdownStyle(select, confidence) {
    const level = this.confidenceLevels[confidence];
    if (level) {
      select.style.backgroundColor = level.color;
      select.style.color = confidence === 'none' ? '#666' : 'white';
      select.style.fontWeight = confidence === 'none' ? 'normal' : '600';
    }
  }

  // Export functionality
  async exportData() {
    const exportData = {
      timestamp: new Date().toISOString(),
      url: window.location.href,
      data: this.confidenceData
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tuf_confidence_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Import functionality
  async importData(jsonData) {
    try {
      const importedData = JSON.parse(jsonData);
      if (importedData.data) {
        this.confidenceData = { ...this.confidenceData, ...importedData.data };
        await this.saveConfidenceData();
        
        // Refresh the page to show updated confidence levels
        window.location.reload();
      }
    } catch (error) {
      console.error('Error importing data:', error);
      alert('Error importing data. Please check the file format.');
    }
  }

  // Get statistics
  getStatistics() {
    const stats = {
      total: 0,
      none: 0,
      low: 0,
      medium: 0,
      high: 0,
      expert: 0
    };

    Object.values(this.confidenceData).forEach(confidence => {
      stats.total++;
      stats[confidence] = (stats[confidence] || 0) + 1;
    });

    return stats;
  }
}

// Initialize the tracker
const tracker = new DSAConfidenceTracker();

// Make tracker available globally for popup communication
window.tufConfidenceTracker = tracker;

// Add message listener for popup communication
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getStatistics') {
    sendResponse(tracker.getStatistics());
  } else if (request.action === 'exportData') {
    tracker.exportData();
    sendResponse({ success: true });
  } else if (request.action === 'clearData') {
    tracker.confidenceData = {};
    tracker.saveConfidenceData();
    window.location.reload();
    sendResponse({ success: true });
  }
});

console.log('TakeYouForward DSA Confidence Tracker loaded successfully!');
