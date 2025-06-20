/**
 * Map Manager for TurtleBot3 Dashboard
 * Uses Leaflet.js for map display and manages robot/goal markers
 * Integrates with ROS2 data via window.rosConnection
 */

class MapManager {
    constructor() {
        this.viewer = null;
        this.robotMarkers = {};
        this.robotStatus = {};
        this.goalMarker = null;
        this.goalCoords = null;
        this.goalSelectionActive = false;
        this.mapResolution = 0.05;
        this.mapOrigin = { x: 0, y: 0 };
        this.mapClient = null;
        
        // Get container dimensions
        const mapContainer = document.getElementById('map');
        this.width = mapContainer.clientWidth || 800;
        this.height = mapContainer.clientHeight || 600;
        
        this.init();
    }

    init() {
        // Initialize ROS2D viewer with container dimensions
        this.viewer = new ROS2D.Viewer({
            divID: 'map',
            width: this.width,
            height: this.height
        });

        // Subscribe to the map topic
        const mapTopic = new ROSLIB.Topic({
            ros: window.rosConnection.ros,
            name: '/map',
            messageType: 'nav_msgs/msg/OccupancyGrid'
        });

        mapTopic.subscribe((message) => {
            console.log('Received map data:', message);
            if (!message || !message.info) return;
            
            // Update map metadata
            this.mapResolution = message.info.resolution;
            this.mapOrigin = {
                x: message.info.origin.position.x,
                y: message.info.origin.position.y
            };

            // Create grid client if not exists
            if (!this.mapClient) {
                this.mapClient = new ROS2D.OccupancyGridClient({
                    ros: window.rosConnection.ros,
                    rootObject: this.viewer.scene,
                    continuous: true
                });

                // Scale and center the map
                this.mapClient.on('change', () => {
                    // Calculate scale to fit the map in the viewer
                    const mapWidth = message.info.width * message.info.resolution;
                    const mapHeight = message.info.height * message.info.resolution;
                    const scaleX = this.width / mapWidth;
                    const scaleY = this.height / mapHeight;
                    const scale = Math.min(scaleX, scaleY) * 0.8; // Adjust scale factor as needed

                    this.viewer.scene.scaleX = scale;
                    this.viewer.scene.scaleY = scale;

                    // Center the map
                    const originX = message.info.origin.position.x;
                    const originY = message.info.origin.position.y;
                    
                    this.viewer.scene.x = -(originX * scale) + this.width / 2 - (mapWidth * scale) / 2;
                    this.viewer.scene.y = -(originY * scale) + this.height / 2 - (mapHeight * scale) / 2;

                    console.log('Map scaled and centered:', {
                        scale,
                        originX,
                        originY,
                        sceneX: this.viewer.scene.x,
                        sceneY: this.viewer.scene.y
                    });

                    // Initialize robot markers after map is loaded
                    this.initializeRobotMarkers();
                    // Subscribe to robot pose topics for all detected robots
                    const robotIds = Object.keys(window.rosConnection.robotData);
                    robotIds.forEach(robotId => {
                        const topicName = robotId === 'default' ? '/amcl_pose' : `/${robotId}/amcl_pose`;
                        const poseTopic = new ROSLIB.Topic({
                            ros: window.rosConnection.ros,
                            name: topicName,
                            messageType: 'geometry_msgs/msg/PoseWithCovarianceStamped'
                        });
                        poseTopic.subscribe((msg) => {
                            // Use correct message structure
                            const pos = msg.pose && msg.pose.pose ? msg.pose.pose.position : (msg.position || {});
                            this.updateRobotPosition(robotId, {
                                x: pos.x,
                                y: pos.y
                            });
                        });
                    });
                });
            }
        });

        // Set up map click handler for goal selection
        const mapDiv = document.getElementById('map');
        mapDiv.addEventListener('click', (event) => {
            if (this.goalSelectionActive) {
                const rect = mapDiv.getBoundingClientRect();
                const x = event.clientX - rect.left;
                const y = event.clientY - rect.top;
                this.setGoal(x, y);
            }
        });
        
        this.setupGoalSelectionUI();
    }

    createMarker(color) {
        const shape = new createjs.Shape();
        const radius = 3;

        shape.graphics.beginFill(color)
            .drawCircle(0, 0, radius);

        return shape;
    }

    initializeRobotMarkers() {
        // Remove existing markers
        Object.values(this.robotMarkers).forEach(marker => {
            if (this.viewer && this.viewer.scene && marker) {
                this.viewer.scene.removeChild(marker);
            }
        });
        this.robotMarkers = {};
        // Dynamically create markers for all detected robots
        const robotIds = Object.keys(window.rosConnection.robotData);
        robotIds.forEach(robotId => {
            const marker = this.createMarker('#00ff00');
            this.robotMarkers[robotId] = marker;
            marker.scaleX = 0.05;
            marker.scaleY = 0.05;
            marker.visible = true;
            this.viewer.scene.addChild(marker);
        });
        console.log('Robot markers initialized:', robotIds);

        if (this.goalMarker && this.goalCoords) {
            this.viewer.scene.addChild(this.goalMarker);
            this.goalMarker.visible = true;
            this.viewer.scene.update();
        }
    }

    updateRobotPosition(robotId, position) {
        const marker = this.robotMarkers[robotId];
        if (!marker) return;

        // Place marker in map coordinates (meters)
        marker.x = position.x;
        marker.y = -position.y;

        // No extra scaling needed
        marker.scaleX = 0.05;
        marker.scaleY = 0.05;

        marker.visible = true;
        this.viewer.scene.update();

        // --- Remove goal marker if robot reached the goal ---
        if (this.goalMarker && this.goalCoords) {
            const dx = position.x - this.goalCoords.x;
            const dy = position.y - this.goalCoords.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < 0.4) { // 20cm tolerance
                this.viewer.scene.removeChild(this.goalMarker);
                this.goalMarker = null;
                this.goalCoords = null;
                this.viewer.scene.update();
            }
        }
    }

    setRobotStatus(robotId, status) {
        const marker = this.robotMarkers[robotId];
        if (!marker) return;

        let color;
        switch(status) {
            case 'online':
                color = '#00ff00';  // Green
                break;
            case 'busy':
                color = '#ffa500';  // Orange
                break;
            case 'offline':
                color = '#ff0000';  // Red
                break;
            default:
                color = '#808080';  // Gray
        }

        marker.graphics.clear()
            .beginFill(color)
            .drawCircle(0, 0, 3);   // Back to top
        
        marker.visible = true;  // Ensure marker is visible
        this.viewer.scene.update();
    }

    canvasToROS(canvasX, canvasY) {
        const scale = this.viewer.scene.scaleX;
        const rosX = (canvasX - this.viewer.scene.x) / scale;
        const rosY = -(canvasY - this.viewer.scene.y) / scale;
        return { x: rosX, y: rosY };
    }

    setGoal(canvasX, canvasY) {
        if (!this.goalSelectionActive) return;

        // Remove previous goal marker
        if (this.goalMarker) {
            this.viewer.scene.removeChild(this.goalMarker);
        }

        // Convert canvas coordinates to ROS coordinates
        const rosCoords = this.canvasToROS(canvasX, canvasY);

        // Create new goal marker
        this.goalMarker = new createjs.Shape();
        const size = 0.2; // meters in ROS coordinates
        
        this.goalMarker.graphics
            .beginFill('rgba(255, 0, 0, 0.7)')
            .drawCircle(0, 0, size);

        // Store ROS coordinates for navigation
        this.goalCoords = rosCoords;

        // Position the marker in scene coordinates
        // const scale = this.viewer.scene.scaleX;
        this.goalMarker.x = rosCoords.x;
        this.goalMarker.y = -rosCoords.y;
        this.goalMarker.scaleX = 0.8;
        this.goalMarker.scaleY = 0.8;
        this.goalMarker.visible = true;
        
        this.viewer.scene.addChild(this.goalMarker);
        this.viewer.scene.update();

        // Update UI
        document.getElementById('setGoalBtn').style.display = 'none';
        document.getElementById('cancelGoalBtn').style.display = 'block';
        document.getElementById('goalChosenBtn').style.display = 'block';
        document.getElementById('assignTaskBtn').disabled = false;

        // Show coordinates
        const goalCoordinates = document.getElementById('goalCoordinates');
        const goalCoordsText = document.getElementById('goalCoordsText');
        goalCoordinates.classList.remove('d-none');
        goalCoordsText.textContent = `X: ${rosCoords.x.toFixed(2)}, Y: ${rosCoords.y.toFixed(2)}`;
        
        this.goalSelectionActive = false;
        document.getElementById('map').style.cursor = 'default';

        console.log('Goal set:', {
            ros: rosCoords,
            canvas: { x: canvasX, y: canvasY },
            // scale: scale
        });
    }

    getGoal() {
        return this.goalCoords;
    }

    setupGoalSelectionUI() {
        const setGoalBtn = document.getElementById('setGoalBtn');
        const cancelGoalBtn = document.getElementById('cancelGoalBtn');
        const goalChosenBtn = document.getElementById('goalChosenBtn');

        setGoalBtn.addEventListener('click', () => {
            this.goalSelectionActive = true;
            document.getElementById('map').style.cursor = 'crosshair';
            setGoalBtn.style.display = 'none';
            cancelGoalBtn.style.display = 'block';
            goalChosenBtn.style.display = 'none';
            
            // Reset any existing goal
            if (this.goalMarker) {
                this.viewer.scene.removeChild(this.goalMarker);
                this.goalMarker = null;
                this.goalCoords = null;
            }
            document.getElementById('goalCoordinates').classList.add('d-none');
            document.getElementById('assignTaskBtn').disabled = true;
        });

        cancelGoalBtn.addEventListener('click', () => {
            this.goalSelectionActive = false;
            document.getElementById('map').style.cursor = 'default';
            if (this.goalMarker) {
                this.viewer.scene.removeChild(this.goalMarker);
                this.goalMarker = null;
                this.goalCoords = null;
            }
            setGoalBtn.style.display = 'block';
            cancelGoalBtn.style.display = 'none';
            goalChosenBtn.style.display = 'none';
            document.getElementById('goalCoordinates').classList.add('d-none');
            document.getElementById('assignTaskBtn').disabled = true;
        });
    }
}

// Initialize map manager when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.mapManager = new MapManager();
});