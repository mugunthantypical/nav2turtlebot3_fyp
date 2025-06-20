/**
 * Dashboard Manager for TurtleBot3 Dashboard
 * Updates statistics and robot status in the right panel
 * Integrates with ROS2 data via window.rosConnection
 */

class DashboardManager {
    constructor() {
        // Initialize robotStats dynamically from rosConnection if available
        this.robotStats = {};
        if (window.rosConnection && window.rosConnection.getAllRobotData) {
            const robotData = window.rosConnection.getAllRobotData();
            Object.keys(robotData).forEach(robotId => {
                this.robotStats[robotId] = { status: 'offline', lastUpdate: null };
            });
        }
        this.statsUpdateInterval = 1000; // Update every second
        this.init();
    }

    init() {
        // Initial stats update
        this.updateAllStats();
        
        // Set up periodic updates
        setInterval(() => this.updateAllStats(), this.statsUpdateInterval);
    }

    updateRobotStatus(robotId, status) {
        // Ensure robotStats entry exists
        if (!this.robotStats[robotId]) {
            this.robotStats[robotId] = { status: 'offline', lastUpdate: null };
        }
        this.robotStats[robotId].status = status;
        this.robotStats[robotId].lastUpdate = new Date();
        this.updateAllStats();
    }

    updateAllStats() {
        let totalOnline = 0;
        let totalBusy = 0;
        let totalAvailable = 0;

        // Get latest data from ROSConnection
        if (window.rosConnection) {
            const robotData = window.rosConnection.getAllRobotData();
            // Add new robots if detected
            Object.keys(robotData).forEach(robotId => {
                if (!this.robotStats[robotId]) {
                    this.robotStats[robotId] = { status: 'offline', lastUpdate: null };
                }
                const data = robotData[robotId];
                if (data) {
                    this.robotStats[robotId].status = data.status;
                    this.robotStats[robotId].lastUpdate = data.lastUpdate;
                }
            });
        }

        // Update robot status
        Object.entries(this.robotStats).forEach(([robotId, stats]) => {
            // Update status in the robotStats object
            if (stats.lastUpdate) {
                const timeSinceUpdate = Date.now() - new Date(stats.lastUpdate).getTime();
                if (timeSinceUpdate > 5000) { // If no update for 5 seconds, mark as offline
                    stats.status = 'offline';
                }
            }

            // Update status badge in UI
            const statusBadge = document.querySelector(`#${robotId}_status`);
            if (statusBadge) {
                statusBadge.className = `badge ${this.getStatusClass(stats.status)}`;
                statusBadge.textContent = stats.status.charAt(0).toUpperCase() + stats.status.slice(1);
            }

            // Update robot marker on map
            if (window.mapManager) {
                window.mapManager.setRobotStatus(robotId, stats.status);
            }

            // Update counters
            switch (stats.status) {
                case 'online':
                    totalOnline++;
                    totalAvailable++;
                    break;
                case 'busy':
                    totalOnline++;
                    totalBusy++;
                    break;
            }
        });

        // Update dashboard counters
        this.updateCounter('totalOnline', totalOnline);
        this.updateCounter('totalAvailable', totalAvailable);
        this.updateCounter('totalBusy', totalBusy);
    }

    updateCounter(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
        }
    }

    getStatusClass(status) {
        switch (status) {
            case 'online':
                return 'bg-success';
            case 'busy':
                return 'bg-warning';
            case 'offline':
                return 'bg-secondary';
            default:
                return 'bg-secondary';
        }
    }
}

// Initialize dashboard manager when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.dashboardManager = new DashboardManager();
});