/**
 * Main Application Logic for TurtleBot3 Dashboard
 * Coordinates all components and handles global events
 */

class MainApp {
    constructor() {
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.initializeComponents();
    }

    setupEventListeners() {
        // Remove logout button event
        // Window beforeunload - cleanup
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });

        // Handle keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });
    }

    initializeComponents() {
        // Wait for all components to be ready
        setTimeout(() => {
            this.checkComponentStatus();
        }, 1000);
    }

    checkComponentStatus() {
        const components = {
            'ROS Connection': window.rosConnection,
            'Map Manager': window.mapManager,
            'Dashboard Manager': window.dashboardManager,
            'Task Assignment Manager': window.taskAssignmentManager
        };

        console.log('Component Status:');
        Object.entries(components).forEach(([name, component]) => {
            console.log(`- ${name}: ${component ? 'Ready' : 'Not Ready'}`);
        });
    }

    handleKeyboardShortcuts(e) {
        // Ctrl/Cmd + R for refresh
        if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
            // Allow default behavior
        }
    }

    cleanup() {
        // Disconnect ROS connection
        if (window.rosConnection) {
            window.rosConnection.disconnect();
        }
        // Cleanup map
        if (window.mapManager && window.mapManager.map) {
            window.mapManager.map.remove();
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <span>${message}</span>
                <button type="button" class="btn-close btn-close-white" onclick="this.parentElement.parentElement.remove()"></button>
            </div>
        `;
        // Add to page
        document.body.appendChild(notification);
        // Remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }
}

// Initialize main app when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.mainApp = new MainApp();
});