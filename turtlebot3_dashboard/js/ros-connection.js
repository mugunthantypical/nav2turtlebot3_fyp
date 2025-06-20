/**
 * ROS2 Connection Manager
 * Handles WebSocket connection to rosbridge_server and ROS2 topic subscriptions
 */

class ROSConnection {
    constructor() {
        this.ros = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectInterval = 5000; // 5 seconds
        this.topics = {};
        this.subscribers = {};
        this.connectionStatus = 'disconnected';
        
        // Robot data storage (dynamic)
        this.robotData = {};
        
        this.init();
    }

    init() {
        this.connect();
        this.setupReconnection();
    }

    connect() {
        try {
            console.log('Attempting to connect to ROS2 bridge...');
            this.updateConnectionStatus('connecting');
            
            // Create ROS connection
            this.ros = new ROSLIB.Ros({
                url: 'ws://localhost:9090'
            });

            // Connection event handlers
            this.ros.on('connection', () => {
                console.log('Connected to ROS2 bridge');
                this.isConnected = true;
                this.connectionStatus = 'connected';
                this.reconnectAttempts = 0;
                this.updateConnectionStatus('connected');
                this.subscribeToTopics();
                this.showNotification('Connected to ROS2 bridge', 'success');
            });

            this.ros.on('error', (error) => {
                console.error('Error connecting to ROS2 bridge:', error);
                this.isConnected = false;
                this.connectionStatus = 'error';
                this.updateConnectionStatus('error');
                // Don't trigger page reload, just show error
                this.showNotification('Failed to connect to ROS2 bridge. Retrying...', 'error');
            });

            this.ros.on('close', () => {
                console.log('Connection to ROS2 bridge closed');
                this.isConnected = false;
                this.connectionStatus = 'disconnected';
                this.updateConnectionStatus('disconnected');
                // Don't reload, try to reconnect
                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    setTimeout(() => this.connect(), this.reconnectInterval);
                    this.reconnectAttempts++;
                }
            });
        } catch (error) {
            console.error('Failed to initialize ROS connection:', error);
            this.showNotification('Failed to initialize ROS connection', 'error');
        }
    }

    setupReconnection() {
        // Attempt reconnection every 5 seconds if disconnected
        setInterval(() => {
            if (!this.isConnected && this.reconnectAttempts < this.maxReconnectAttempts) {
                this.attemptReconnection();
            }
        }, this.reconnectInterval);
    }

    attemptReconnection() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('Max reconnection attempts reached');
            this.showNotification('Max reconnection attempts reached. Please refresh the page.', 'error');
            return;
        }

        this.reconnectAttempts++;
        console.log(`Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
        
        setTimeout(() => {
            this.connect();
        }, 1000);
    }

    // Discover robots by scanning topics
    discoverRobots(callback) {
        const service = new ROSLIB.Service({
            ros: this.ros,
            name: '/rosapi/topics',
            serviceType: 'rosapi/GetTopics'
        });

        service.callService({}, (result) => {
            const robotIds = new Set();
            result.topics.forEach(topic => {
                // Match /<robot>/amcl_pose or /amcl_pose (no namespace)
                const match = topic.match(/^\/(.+)\/amcl_pose$/);
                if (match) {
                    robotIds.add(match[1]);
                } else if (topic === '/amcl_pose') {
                    robotIds.add('default');
                }
            });
            callback(Array.from(robotIds));
        });
    }

    subscribeToTopics() {
        if (!this.isConnected) {
            console.warn('Cannot subscribe to topics: not connected');
            return;
        }

        this.discoverRobots((robotIds) => {
            robotIds.forEach(robotId => {
                // Initialize robot data if not present
                if (!this.robotData[robotId]) {
                    this.robotData[robotId] = { position: null, status: 'offline', lastUpdate: null, odom: null };
                }
                this.subscribeToRobotPosition(robotId);
                this.subscribeToRobotOdom(robotId);
                this.subscribeToGoalPose(robotId);
            });
        });
    }

    subscribeToRobotPosition(robotId) {
        const topicName = robotId === 'default' ? '/amcl_pose' : `/${robotId}/amcl_pose`;
        
        try {
            const topic = new ROSLIB.Topic({
                ros: this.ros,
                name: topicName,
                messageType: 'geometry_msgs/PoseWithCovarianceStamped'
            });

            topic.subscribe((message) => {
                this.handleRobotPositionUpdate(robotId, message);
            });

            this.subscribers[`${robotId}_position`] = topic;
            console.log(`Subscribed to ${topicName}`);
            
        } catch (error) {
            console.error(`Failed to subscribe to ${topicName}:`, error);
        }
    }

    subscribeToRobotOdom(robotId) {
        const topicName = robotId === 'default' ? '/odom' : `/${robotId}/odom`;
        
        try {
            const topic = new ROSLIB.Topic({
                ros: this.ros,
                name: topicName,
                messageType: 'nav_msgs/Odometry'
            });

            topic.subscribe((message) => {
                this.handleRobotOdomUpdate(robotId, message);
            });

            this.subscribers[`${robotId}_odom`] = topic;
            console.log(`Subscribed to ${topicName}`);
            
        } catch (error) {
            console.error(`Failed to subscribe to ${topicName}:`, error);
        }
    }

    subscribeToGoalPose(robotId) {
        const topicName = robotId === 'default' ? '/goal_pose' : `/${robotId}/goal_pose`;
        
        try {
            const topic = new ROSLIB.Topic({
                ros: this.ros,
                name: topicName,
                messageType: 'geometry_msgs/PoseStamped'
            });

            topic.subscribe((message) => {
                this.handleGoalPoseUpdate(robotId, message);
            });

            this.subscribers[`${robotId}_goal`] = topic;
            console.log(`Subscribed to ${topicName}`);
            
        } catch (error) {
            console.error(`Failed to subscribe to ${topicName}:`, error);
        }
    }

    handleRobotPositionUpdate(robotId, message) {
        const position = {
            x: message.pose.pose.position.x,
            y: message.pose.pose.position.y,
            z: message.pose.pose.position.z,
            orientation: message.pose.pose.orientation,
            timestamp: new Date()
        };

        // Update robot data
        if (!this.robotData[robotId]) {
            this.robotData[robotId] = {};
        }
        
        this.robotData[robotId].position = position;
        this.robotData[robotId].lastUpdate = new Date();
        
        // Only update status to online if not currently busy
        if (this.robotData[robotId].status !== 'busy') {
            this.robotData[robotId].status = 'online';
        }

        // Update map markers
        if (window.mapManager) {
            window.mapManager.updateRobotPosition(robotId, position);
            window.mapManager.setRobotStatus(robotId, this.robotData[robotId].status);
        }

        // Update dashboard
        if (window.dashboardManager) {
            window.dashboardManager.updateRobotStatus(robotId, this.robotData[robotId].status);
        }

        console.log(`${robotId} position update:`, position);
    }

    handleRobotOdomUpdate(robotId, message) {
        // Store odometry data
        if (!this.robotData[robotId]) {
            this.robotData[robotId] = {};
        }
        
        this.robotData[robotId].odom = {
            linear: message.twist.twist.linear,
            angular: message.twist.twist.angular,
            timestamp: new Date()
        };
        this.robotData[robotId].lastUpdate = new Date();

        // Determine if robot is moving
        const linearSpeed = Math.sqrt(
            message.twist.twist.linear.x ** 2 + 
            message.twist.twist.linear.y ** 2 + 
            message.twist.twist.linear.z ** 2
        );
        const angularSpeed = Math.abs(message.twist.twist.angular.z);

        // Update status based on movement
        if (linearSpeed > 0.05 || angularSpeed > 0.05) {
            this.robotData[robotId].status = 'busy';
        } else if (this.robotData[robotId].status === 'busy') {
            this.robotData[robotId].status = 'online';
        }

        // Update dashboard
        if (window.dashboardManager) {
            window.dashboardManager.updateRobotStatus(robotId, this.robotData[robotId].status);
        }

        // Update map marker status
        if (window.mapManager) {
            window.mapManager.setRobotStatus(robotId, this.robotData[robotId].status);
        }
    }

    handleGoalPoseUpdate(robotId, message) {
        console.log(`Goal pose received for ${robotId}:`, message);
        // Update robot status to busy when goal is received
        this.robotData[robotId].status = 'busy';
        
        if (window.dashboardManager) {
            window.dashboardManager.updateRobotStatus(robotId, 'busy');
        }
    }

    sendNavigationGoal(robotId, goal) {
        if (!this.isConnected) {
            this.showNotification('Not connected to ROS2 bridge', 'error');
            return false;
        }

        try {
            // Validate coordinates
            if (!goal || typeof goal.x !== 'number' || typeof goal.y !== 'number') {
                console.error('Invalid goal coordinates:', goal);
                this.showNotification('Invalid goal coordinates', 'error');
                return false;
            }

            // Publish to goal_pose topic
            const topicName = robotId === 'default' ? '/goal_pose' : `/${robotId}/goal_pose`;
            const goalTopic = new ROSLIB.Topic({
                ros: this.ros,
                name: topicName,
                messageType: 'geometry_msgs/msg/PoseStamped'
            });

            // Create the goal message
            const goalMessage = new ROSLIB.Message({
                header: {
                    frame_id: 'map',
                    stamp: {
                        sec: Math.floor(Date.now() / 1000),
                        nanosec: (Date.now() % 1000) * 1000000
                    }
                },
                pose: {
                    position: {
                        x: goal.x,
                        y: goal.y,
                        z: 0.0
                    },
                    orientation: {
                        x: 0.0,
                        y: 0.0,
                        z: 0.0,
                        w: 1.0
                    }
                }
            });

            console.log(`Sending navigation goal to ${robotId}:`, goalMessage);

            // Publish the goal
            goalTopic.publish(goalMessage);
            
            // Update robot status to busy
            this.robotData[robotId].status = 'busy';
            if (window.dashboardManager) {
                window.dashboardManager.updateRobotStatus(robotId, 'busy');
            }
            if (window.mapManager) {
                window.mapManager.setRobotStatus(robotId, 'busy');
            }

            this.showNotification(`Navigation goal sent to ${robotId}`, 'success');
            return true;

        } catch (error) {
            console.error(`Failed to send navigation goal to ${robotId}:`, error);
            this.showNotification(`Failed to send navigation goal to ${robotId}`, 'error');
            return false;
        }
    }

    updateConnectionStatus(status) {
        this.connectionStatus = status;
        const statusElement = document.getElementById('connectionStatus');
        if (statusElement) {
            statusElement.textContent = status.charAt(0).toUpperCase() + status.slice(1);
            statusElement.className = `badge bg-${this.getStatusColor(status)}`;
        }
    }

    getStatusColor(status) {
        switch (status) {
            case 'connected': return 'success';
            case 'connecting': return 'warning';
            case 'disconnected': return 'secondary';
            case 'error': return 'danger';
            default: return 'secondary';
        }
    }

    showNotification(message, type) {
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

    getRobotData(robotId) {
        return this.robotData[robotId] || null;
    }

    getAllRobotData() {
        return this.robotData;
    }

    isRobotOnline(robotId) {
        const data = this.robotData[robotId];
        if (!data) return false;
        
        // Consider robot offline if no update in last 10 seconds
        const now = new Date();
        const lastUpdate = data.lastUpdate;
        if (!lastUpdate) return false;
        
        const timeDiff = (now - lastUpdate) / 1000; // seconds
        return timeDiff < 10;
    }

    disconnect() {
        if (this.ros) {
            this.ros.close();
        }
        this.isConnected = false;
        this.connectionStatus = 'disconnected';
    }
}

// Initialize ROS connection when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.rosConnection = new ROSConnection();
});