# Overview

This project is a Chrome browser extension called "TakeYouForward DSA Confidence Tracker" that enhances the TakeYouForward DSA (Data Structures and Algorithms) learning platform. The extension allows users to track their confidence levels for different DSA problems directly on the TakeYouForward website by adding an interactive confidence column to existing problem sheets. Users can rate their confidence on a 5-level scale (Not Set, Low, Medium, High, Expert) and view statistics about their progress through a popup interface.

**NEW: Cloud Sync Feature** - The extension now includes user authentication and cloud synchronization capabilities, allowing users to sync their confidence data across multiple devices through a secure API backend.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
The extension follows a standard Chrome Extension V3 architecture with multiple components:

- **Content Script (content.js)**: Injected into TakeYouForward pages to modify the DOM and add confidence tracking functionality. Uses a class-based approach with the `DSAConfidenceTracker` class that handles initialization, data loading, UI injection, and event handling. Now includes cloud sync integration.

- **Sync Manager (sync-manager.js)**: Handles all cloud synchronization operations including user authentication, data upload/download, and API communication with the backend server.

- **Popup Interface (popup.html/js/css)**: Provides a standalone popup window accessible via the browser toolbar. Displays statistics and status information using a `PopupManager` class for state management and user interaction. Now includes authentication controls and sync status.

- **Background Service Worker (background.js)**: Handles extension lifecycle events like installation and updates. Manages version migrations and sets up default storage values.

## Backend Architecture
A Node.js Express server provides cloud storage and user authentication:

- **API Server (api-server.js)**: RESTful API endpoints for user authentication and confidence data synchronization
- **Database Layer**: PostgreSQL database with Drizzle ORM for user management and confidence data storage
- **Authentication System**: Session-based authentication with secure user management

## Data Storage Solution
The extension uses Chrome's local storage API (`chrome.storage.local`) for data persistence:

- **Storage Structure**: Confidence data is stored as a flat object with problem identifiers as keys and confidence levels as values
- **Storage Key**: Uses `'tuf_dsa_confidence'` as the primary storage key
- **Data Format**: Stores confidence levels as string values ('none', 'low', 'medium', 'high', 'expert') with corresponding numeric values and colors

## UI Injection Strategy
The extension dynamically modifies existing TakeYouForward pages by:

- **DOM Observation**: Uses MutationObserver to watch for dynamic content changes on the page
- **Column Injection**: Adds a confidence column to existing problem tables
- **Dropdown Controls**: Injects custom select elements for each problem row to allow confidence level selection
- **Visual Feedback**: Applies color-coded styling based on confidence levels for quick visual assessment

## Permission and Security Model
The extension requests minimal permissions:

- **Host Permissions**: Limited to `takeuforward.org` domain only
- **Storage Permission**: For local data persistence
- **Active Tab Permission**: For tab-specific functionality
- **Scripting Permission**: For content script injection

## Event-Driven Architecture
The extension uses Chrome's message passing system for communication between different components:

- **Content Script ↔ Popup**: Bidirectional communication for statistics and status updates
- **Background ↔ Content Script**: Handles extension lifecycle and tab management
- **Storage Events**: Automatic synchronization of confidence data changes across all active instances

# External Dependencies

## Chrome Extension APIs
- **chrome.storage.local**: Local data persistence for confidence tracking data
- **chrome.runtime**: Extension lifecycle management and version handling
- **chrome.tabs**: Tab querying and message passing between extension components
- **chrome.scripting**: Content script injection and management

## Target Website Integration
- **TakeYouForward Platform**: The extension specifically targets and integrates with takeuforward.org DSA course pages including A2Z DSA course sheets, interview preparation sheets, and problem collections

## Web Standards
- **DOM Manipulation**: Direct DOM modification for UI injection without external libraries
- **CSS3**: Modern CSS features for styling including gradients, transitions, and flexbox layouts
- **ES6+ JavaScript**: Modern JavaScript features including classes, async/await, and arrow functions
- **Web APIs**: MutationObserver for DOM change detection and standard event handling

The extension is designed to be lightweight and self-contained, avoiding external dependencies to ensure fast loading and minimal security surface area.