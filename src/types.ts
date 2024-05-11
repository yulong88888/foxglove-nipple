import type { Time } from "@foxglove/rostime";

export type Header = {
  frame_id: string;
  stamp: Time;
  seq?: number;
};

export type Vector3 = {
  x: number;
  y: number;
  z: number;
};

// https://docs.ros.org/en/noetic/api/geometry_msgs/html/msg/Twist.html
export type geometry_msgs__Twist = {
  linear: Vector3;
  angular: Vector3;
};

export type geometry_msgs__TwistStamped = {
  header: Header;
  twist: geometry_msgs__Twist;
};
