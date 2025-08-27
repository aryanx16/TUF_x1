// TakeYouForward DSA Confidence Tracker Background Script

// Extension installation and update handling
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('TakeYouForward DSA Confidence Tracker installed successfully!');
        
        // Set default settings
        chrome.storage.local.set({
            'tuf_dsa_confidence': {},
            'extension_version': chrome.runtime.getManifest().version,
            'install_date': new Date().toISOString()
        });

        // Create context menus
        try {
            chrome.contextMenus.create({
                id: 'tuf-confidence-tracker',
                title: 'TUF Confidence Tracker',
                contexts: ['page'],
                documentUrlPatterns: ['https://takeuforward.org/*']
            });
            
            chrome.contextMenus.create({
                id: 'export-confidence-data',
                parentId: 'tuf-confidence-tracker',
                title: 'Export Confidence Data',
                contexts: ['page']
            });
            
            chrome.contextMenus.create({
                id: 'view-statistics',
                parentId: 'tuf-confidence-tracker',
                title: 'View Statistics',
                contexts: ['page']
            });
        } catch (error) {
            console.log('Context menu creation failed:', error);
        }
    } else if (details.reason === 'update') {
        console.log('Extension updated to version:', chrome.runtime.getManifest().version);
        
        // Handle any migration needed for updates
        handleVersionUpdate(details.previousVersion);
    }
});

// Handle version updates and data migration
async function handleVersionUpdate(previousVersion) {
    try {
        const currentVersion = chrome.runtime.getManifest().version;
        
        // Update version in storage
        await chrome.storage.local.set({
            'extension_version': currentVersion,
            'update_date': new Date().toISOString(),
            'previous_version': previousVersion
        });

        console.log(`Updated from version ${previousVersion} to ${currentVersion}`);
        
        // Add any version-specific migration logic here
        // For example:
        // if (compareVersions(previousVersion, '1.1.0') < 0) {
        //     await migrateToV1_1_0();
        // }
        
    } catch (error) {
        console.error('Error handling version update:', error);
    }
}

// Tab update listener to inject content script when needed
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Only proceed if the page has finished loading
    if (changeInfo.status !== 'complete') return;
    
    // Check if this is a TakeYouForward DSA sheet page
    if (tab.url && isTakeYouForwardDSAPage(tab.url)) {
        // The content script should already be injected via manifest
        // This is just for logging and potential future features
        console.log('TakeYouForward DSA page detected:', tab.url);
    }
});

// Check if URL is a TakeYouForward DSA sheet page
function isTakeYouForwardDSAPage(url) {
    const dsaPatterns = [
        'takeuforward.org/strivers-a2z-dsa-course/',
        'takeuforward.org/interviews/strivers-sde-sheet',
        'takeuforward.org/interview-sheets/strivers-79',
        'takeuforward.org/interviews/blind-75'
    ];
    
    return dsaPatterns.some(pattern => url.includes(pattern));
}

// Message handling for communication between components
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
        case 'getExtensionInfo':
            sendResponse({
                version: chrome.runtime.getManifest().version,
                name: chrome.runtime.getManifest().name
            });
            break;
            
        case 'logEvent':
            console.log('Extension Event:', request.data);
            break;
            
        case 'backup':
            handleBackup(request.data).then(result => {
                sendResponse(result);
            });
            return true; // Keep message channel open for async response
            
        default:
            console.log('Unknown action:', request.action);
    }
});

// Backup functionality
async function handleBackup(data) {
    try {
        const timestamp = new Date().toISOString();
        const backupKey = `backup_${timestamp}`;
        
        await chrome.storage.local.set({
            [backupKey]: {
                timestamp,
                data: data,
                version: chrome.runtime.getManifest().version
            }
        });
        
        return { success: true, backupKey };
    } catch (error) {
        console.error('Backup failed:', error);
        return { success: false, error: error.message };
    }
}

// Cleanup old backups (keep only last 5)
async function cleanupOldBackups() {
    try {
        const storage = await chrome.storage.local.get();
        const backupKeys = Object.keys(storage).filter(key => key.startsWith('backup_'));
        
        if (backupKeys.length > 5) {
            const sortedKeys = backupKeys.sort().reverse(); // Latest first
            const keysToRemove = sortedKeys.slice(5); // Remove all except latest 5
            
            await chrome.storage.local.remove(keysToRemove);
            console.log('Cleaned up old backups:', keysToRemove.length);
        }
    } catch (error) {
        console.error('Error cleaning up backups:', error);
    }
}

// Run cleanup periodically
chrome.alarms.create('cleanupBackups', { delayInMinutes: 60, periodInMinutes: 1440 }); // Daily

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'cleanupBackups') {
        cleanupOldBackups();
    }
});


// Context menu click handler
chrome.contextMenus.onClicked.addListener((info, tab) => {
    switch (info.menuItemId) {
        case 'export-confidence-data':
            chrome.tabs.sendMessage(tab.id, { action: 'exportData' });
            break;
            
        case 'view-statistics':
            chrome.action.openPopup();
            break;
    }
});

// Error handling for uncaught exceptions
chrome.runtime.onConnect.addListener((port) => {
    port.onDisconnect.addListener(() => {
        if (chrome.runtime.lastError) {
            console.log('Port disconnected:', chrome.runtime.lastError.message);
        }
    });
});

// Storage quota monitoring
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.tuf_dsa_confidence) {
        // Monitor storage usage
        chrome.storage.local.getBytesInUse((bytesInUse) => {
            const quota = chrome.storage.local.QUOTA_BYTES;
            const usagePercent = (bytesInUse / quota) * 100;
            
            if (usagePercent > 80) {
                console.warn('Storage usage high:', usagePercent.toFixed(1) + '%');
                // Could implement cleanup or warning here
            }
        });
    }
});

console.log('TakeYouForward DSA Confidence Tracker background script loaded');
