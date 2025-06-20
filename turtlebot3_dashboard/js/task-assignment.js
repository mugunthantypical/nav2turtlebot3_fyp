/**
 * Task Assignment Manager for TurtleBot3 Dashboard
 * Handles goal selection, form validation, and sending navigation goals to robots
 */

class TaskAssignmentManager {
    constructor() {
        this.init();
    }

    init() {
        this.setEventListeners();
        this.updateRobotSelection();
        // Optionally, update robot list periodically in case robots change
        setInterval(() => this.updateRobotSelection(), 3000);
    }

    setEventListeners() {
        const assignTaskBtn = document.getElementById('assignTaskBtn');
        if (assignTaskBtn) {
            assignTaskBtn.addEventListener('click', () => this.handleAssignTask());
        }
   }

    updateRobotSelection() {
        if (!window.rosConnection || !window.rosConnection.getAllRobotData) return;
        const robotData = window.rosConnection.getAllRobotData();
        const robotIds = Object.keys(robotData);
        const robotSelect = document.getElementById('robotSelection');
        const wrapper = document.getElementById('robotSelectionWrapper');

        if (robotSelect && wrapper) {
            if (robotIds.length === 1) {
                // Only one robot: hide dropdown, auto-select
                wrapper.style.display = 'none';
                robotSelect.innerHTML = '';
                robotSelect.value = robotIds[0];
            } else {
                // Multiple robots: show dropdown
                wrapper.style.display = '';
                const current = robotSelect.value;
                robotSelect.innerHTML = '<option value="">Choose robot...</option>';
                robotIds.forEach(robotId => {
                    const label = robotId === 'default' ? 'Robot' : robotId.toUpperCase();
                    const opt = document.createElement('option');
                    opt.value = robotId;
                    opt.textContent = label;
                    robotSelect.appendChild(opt);
                });
                if (current && robotData[current]) {
                    robotSelect.value = current;
                }
            }
        }
    }

    handleAssignTask() {
        // Get form values
        const goal = window.mapManager ? window.mapManager.getGoal() : null;
        const description = document.getElementById('taskDescription').value.trim();
        const robotSelect = document.getElementById('robotSelection');
        const robotData = window.rosConnection.getAllRobotData();
        const robotIds = Object.keys(robotData);

        let robotId = '';
        if (robotIds.length === 1) {
            robotId = robotIds[0];
        } else {
            robotId = robotSelect.value;
        }

        // Validate
        if (!goal) {
            window.rosConnection.showNotification('Please select a goal on the map.', 'warning');
            return;
        }
        if (!description) {
            window.rosConnection.showNotification('Please enter a task description.', 'warning');
            return;
        }
        if (!robotId) {
            window.rosConnection.showNotification('Please select a robot.', 'warning');
            return;
        }
        if (!window.rosConnection || !window.rosConnection.isConnected) {
            window.rosConnection.showNotification('Not connected to ROS2 bridge.', 'error');
            return;
        }

        // Check if robot is already at the goal
        const robotPos = robotData[robotId] && robotData[robotId].position;
        if (robotPos) {
            const dx = robotPos.x - goal.x;
            const dy = robotPos.y - goal.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < 0.2) {
                window.rosConnection.showNotification('Robot is already at the goal location.', 'warning');
                return;
            }
        }

        // Send navigation goal using ROS coordinates
        const success = window.rosConnection.sendNavigationGoal(robotId, goal);
        if (success) {
            window.rosConnection.showNotification(`Task assigned to ${robotId}!`, 'success');
            this.resetForm();
        }
    }

    resetForm() {
        
        document.getElementById('taskDescription').value = '';
        document.getElementById('robotSelection').value = '';
        document.getElementById('assignTaskBtn').disabled = true;
        document.getElementById('goalCoordinates').classList.add('d-none');
        document.getElementById('setGoalBtn').style.display = 'block';
        document.getElementById('goalChosenBtn').style.display = 'none';
        document.getElementById('cancelGoalBtn').style.display = 'none';
        
        if (window.mapManager) {
            window.mapManager.goalSelectionActive = false;
        }
    }
}

// Initialize task assignment manager when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.taskAssignmentManager = new TaskAssignmentManager();
});