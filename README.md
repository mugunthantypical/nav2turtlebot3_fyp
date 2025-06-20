# Web Interface for ROS 2 Navigation for Multi-Turtlebot3

This repository provides a web-based interface and supporting ROS 2 packages for simulating, controlling, and visualizing multiple TurtleBot3 robots using Navigation2 (Nav2). It is designed for research, education, and development in multi-robot navigation and coordination.

## Features

- **Web Dashboard**: Real-time robot status, map visualization, and task assignment via a browser-based interface (`turtlebot3_dashboard/`).
- **Multi-Robot Simulation**: Launch files and worlds for simulating multiple TurtleBot3 robots in Gazebo (`turtlebot3_multi_robot/`, `turtlebot3_simulations/`).
- **Navigation2 Integration**: Full support for ROS 2 Navigation2 stack for autonomous navigation.
- **Custom Launch & Config**: Easily configurable launch files, parameters, and robot descriptions for multi-robot scenarios.

## Getting Started

### Prerequisites

- ROS 2 (Foxy, Galactic, Humble, or compatible)
- Gazebo (for simulation)
- rosbridge_server (`sudo apt install ros-<'your_ros2_distro'>-rosbridge-server`)
- Python 3
- A modern web browser

### Installation

1. **Clone the repository:**
   ```bash
   git clone <this-repo-url>
   cd multi_turtlebot3_dashboard
   ```

2. **Install dependencies:**
   ```bash
   sudo apt install ros-<'your_ros2_distro'>-navigation2
   sudo apt install ros-<'your_ros2_distro'>-nav2-bringup
   sudo apt install python3-colcon-common-extensions

   mkdir -p robot_ws/src
   cd robot_ws/src

   # For Humble use master branch
   git clone  https://github.com/arshadlab/turtlebot3_multi_robot.git -b master
   # For foxy use foxy branch
   git clone  https://github.com/arshadlab/turtlebot3_multi_robot.git -b foxy

   git clone -b <'your_ros2_distro'> https://github.com/ROBOTIS-GIT/turtlebot3_msgs.git
   git clone -b <'your_ros2_distro'> https://github.com/ROBOTIS-GIT/turtlebot3.git
   git clone -b <'your_ros2_distro'> https://github.com/ROBOTIS-GIT/turtlebot3_simulations.git
   ```

3. **Build the workspace:**
   ```bash
   cd robot_ws/
   source /opt/ros/<'your_ros_distro'>/setup.bash
   rosdep install --from-paths src -r -y
   colcon build --symlink-install
   echo 'source ~/robot_ws/install/setup.bash' >> ~/.bashrc
   source ~/.bashrc
   ```

## Repository Structure

- `turtlebot3/` - Core TurtleBot3 ROS 2 packages (bringup, navigation, description, cartographer, node, teleop, example).
- `turtlebot3_dashboard/` - Web interface (HTML, CSS, JS) for robot monitoring and control.
- `turtlebot3_multi_robot/` - Multi-robot launch files, Gazebo worlds, and configuration for multi-robot navigation.
- `turtlebot3_simulations/` - Simulation environments and supporting packages for TurtleBot3 in Gazebo.

### How to Launch the Simulation and Web Interface

1. **Launch the multi-robot Gazebo simulation:**
   ```bash
   ros2 launch turtlebot3_multi_robot gazebo_multi_nav2_workd.launch.py
   ```

2. **Start the ROS bridge server to enable web communication:**
   ```bash
   ros2 launch rosbridge_server rosbridge_websocket_launch.xml
   ```
   This will open a websocket on port 9090 for the web dashboard to communicate with ROS 2.

3. **Serve the web dashboard:**
   ```bash
   cd multi_turtlebot3_dashboard/turtlebot3_dashboard
   python3 -m http.server 8080
   ```
   This will serve the dashboard at [http://localhost:8080](http://localhost:8080).

4. **Open the web interface:**
   - In your browser, go to [http://localhost:8080/index.html](http://localhost:8080/index.html).
   - Use the dashboard to monitor, control, and assign tasks to the TurtleBot3 robots in simulation.

## Customization

- **Add robots:** Edit launch files in `turtlebot3_multi_robot/launch/`.
- **Change maps/params:** Update files in `turtlebot3_navigation2/map/` and `turtlebot3_navigation2/param/`.
- **Web dashboard:** Modify JS/CSS/HTML in `turtlebot3_dashboard/`.

## Contributing

Contributions are welcome! Please see `CONTRIBUTING.md` for guidelines.

## License

This project is licensed under the Apache License 2.0. See the `LICENSE` file for details.
