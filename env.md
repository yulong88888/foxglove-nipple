* ROS1环境测试
```shell
sudo docker run -d -p 6080:80 -p 9090:9090 --name=ros_base -e RESOLUTION=1280x800 --shm-size=512m tiryoh/ros-desktop-vnc:melodic

sudo docker exec -it ros_base bash

sudo apt update
sudo apt upgrade
sudo apt-get install ros-melodic-rosbridge-server

roscore
rosrun turtlesim turtlesim_node
roslaunch rosbridge_server rosbridge_websocket.launch
```

* ROS2环境测试
```shell
sudo docker run -d -p 6080:80 -p 9090:9090 --name=ros_base -e RESOLUTION=1280x800 --shm-size=512m tiryoh/ros2-desktop-vnc:foxy

sudo docker exec -it ros_base bash

sudo apt update
sudo apt upgrade
sudo apt-get install ros-foxy-rosbridge-server

ros2 run turtlesim turtlesim_node
ros2 launch rosbridge_server rosbridge_websocket.launch
```