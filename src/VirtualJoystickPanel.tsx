import {
  PanelExtensionContext,
  RenderState,
  Topic,
  SettingsTreeAction,
  SettingsTreeNode,
  SettingsTreeNodes,
} from "@foxglove/studio";
import { set } from "lodash";
import nipplejs, { JoystickManagerOptions, Position } from "nipplejs";
import React, { useCallback, useLayoutEffect, useEffect, useState } from "react";
import ReactDOM from "react-dom";

import { useMountEffect, useThrottledCallback } from "./hooks";
import { Vector3, geometry_msgs__Twist, geometry_msgs__TwistStamped } from "./types";

// 设置菜单
type Config = {
  topic: string;
  messageSchema: string | undefined;
  publishRate: number;
  maxLinearSpeed: number;
  maxAngularSpeed: number;
};

function buildSettingsTree(config: Config, topics: readonly Topic[]): SettingsTreeNodes {
  const general: SettingsTreeNode = {
    label: "General",
    fields: {
      topic: {
        label: "Topic",
        input: "autocomplete",
        value: config.topic,
        items: topics.map((t) => t.name),
        error: !topics.find(({ name }) => name === config.topic)
          ? "Topic does not exist"
          : undefined,
      },
      messageSchema: {
        input: "string",
        label: "Message Schema",
        value: config.messageSchema,
        error: !config.messageSchema ? "Message schema not found" : undefined,
        readonly: true,
      },
      publishRate: { label: "Publish rate", input: "number", value: config.publishRate },
      maxLinearSpeed: { label: "Max linear", input: "number", value: config.maxLinearSpeed },
      maxAngularSpeed: { label: "Max angular", input: "number", value: config.maxAngularSpeed },
    },
  };

  return { general };
}

const TWIST_SCHEMA_STAMPED = "geometry_msgs/msg/TwistStamped";
const TWIST_SCHEMA = "geometry_msgs/msg/Twist";
// TODO:
// - err if there is no topic
// - disable if no topic
function VirtualJoystickPanel({ context }: { context: PanelExtensionContext }): JSX.Element {
  // 配置
  const [config, setConfig] = useState<Config>(() => {
    const partialConfig = context.initialState as Config;
    const { publishRate = 5, maxLinearSpeed = 1, maxAngularSpeed = 1, ...rest } = partialConfig;

    return {
      ...rest,
      publishRate,
      maxLinearSpeed,
      maxAngularSpeed,
    };
  });

  const [topics, setTopics] = useState<ReadonlyArray<Topic>>([]);
  const [currentTopic, setCurrentTopic] = useState<Topic | void>(() => {
    const initialState = context.initialState as Config;
    return initialState.topic && initialState.messageSchema
      ? {
          name: initialState.topic,
          schemaName: initialState.messageSchema,
          datatype: initialState.messageSchema,
        }
      : undefined;
  });
  const currentTopicRef = React.useRef<Topic | void>();
  currentTopicRef.current = currentTopic;

  const [renderDone, setRenderDone] = useState<(() => void) | undefined>();
  const nippleManagerRef = React.useRef<nipplejs.JoystickManager | null>(null);

  const { saveState } = context;

  // 主题
  const [colorScheme, setColorScheme] = useState<"dark" | "light">("light");

  const advertiseTopic = useCallback(
    (topic: Topic) => {
      if (currentTopicRef.current?.name) {
        context.unadvertise?.(currentTopicRef.current?.name);
      }
      context.advertise?.(topic.name, topic?.schemaName);
    },
    [context],
  );

  useMountEffect(() => {
    if (currentTopic) {
      advertiseTopic(currentTopic);
    }
  });

  // 配置设置回调
  const settingsActionHandler = useCallback(
    (action: SettingsTreeAction) => {
      if (action.action !== "update") {
        return;
      }

      setConfig((previous) => {
        const newConfig = { ...previous };
        set(newConfig, action.payload.path.slice(1), action.payload.value);

        if (newConfig.publishRate < 1) {
          newConfig.publishRate = 1;
        }
        if (newConfig.maxLinearSpeed < 0) {
          newConfig.maxLinearSpeed = 0;
        }
        if (newConfig.maxAngularSpeed < 0) {
          newConfig.maxAngularSpeed = 0;
        }

        // eslint-disable-next-line no-warning-comments
        // TODO: Error checking here to see if topic actually exists?
        const newTopic = topics.find((topic) => topic.name === newConfig.topic);
        setCurrentTopic(newTopic);
        if (newTopic && newTopic.name !== currentTopicRef.current?.name) {
          newConfig.messageSchema = newTopic?.schemaName;
          newConfig.messageSchema = newTopic?.schemaName;
        }

        return newConfig;
      });
    },
    [topics],
  );

  const cmdMove = React.useCallback(
    (lx: number, az: number) => {
      const linearSpeed = lx * config.maxLinearSpeed;
      const angularSpeed = az * config.maxAngularSpeed;

      const linearVec: Vector3 = {
        x: linearSpeed,
        y: 0,
        z: 0,
      };

      const angularVec: Vector3 = {
        x: 0,
        y: 0,
        z: angularSpeed,
      };

      let message: geometry_msgs__Twist | geometry_msgs__TwistStamped;
      if (currentTopicRef.current?.schemaName === TWIST_SCHEMA_STAMPED) {
        message = {
          header: {
            stamp: { sec: 0, nsec: 0 },
            // eslint-disable-next-line no-warning-comments
            // TODO: Make frame_id configurable
            frame_id: "",
          },
          twist: {
            linear: linearVec,
            angular: angularVec,
          },
        };
      } else if (currentTopicRef.current?.schemaName === TWIST_SCHEMA) {
        message = {
          linear: linearVec,
          angular: angularVec,
        };
      } else {
        console.error("Unknown message schema");
        return;
      }
      // console.log("linear speed: ", message.twist.linear.x);
      if (currentTopicRef.current.name) {
        // console.log("publishing: ", currentTopic.name, currentTopic.schemaName);
        context.publish?.(currentTopicRef.current.name, message);
      }
    },
    [config, context],
  );

  const cmdMoveThrottled = useThrottledCallback(cmdMove, 1000 / config.publishRate);

  const initNipple = React.useCallback(() => {
    // Destroy any previous nipple elements
    if (nippleManagerRef.current) {
      nippleManagerRef.current.destroy();
    }
    let diffValue: [number, number];
    let startPoint: Position;
    // nipple
    const options: JoystickManagerOptions = {
      zone: document.getElementById("nipple_zone") as HTMLDivElement,
      color: colorScheme === "light" ? "black" : "white",
      size: 200,
      // 透明度
      restOpacity: 0.8,
      mode: "static",
      // 解决动态元素问题
      dynamicPage: true,
      position: { left: "50%", top: "50%" },
    };
    // nipple_manager
    nippleManagerRef.current = nipplejs.create(options);

    // nipple_start
    nippleManagerRef.current.on("start", (_, data) => {
      startPoint = data.position;
    });
    // nipple_move
    nippleManagerRef.current.on("move", (_, data) => {
      const x = startPoint.x - data.position.x;
      const y = startPoint.y - data.position.y;
      // X 角速度
      const resultX = (x / 100) * 1.5707;
      // Y 线速度
      const resultY = (y / 100) * 1.0;
      diffValue = [resultY, resultX];
      cmdMoveThrottled(diffValue[0], diffValue[1]);
    });
    // nipple_end
    nippleManagerRef.current.on("end", () => {
      // 停车
      cmdMoveThrottled(0, 0);
    });
  }, [colorScheme, cmdMoveThrottled]);

  useEffect(() => {
    initNipple();
  }, [initNipple]);

  useEffect(() => {
    const tree = buildSettingsTree(config, topics);
    context.updatePanelSettingsEditor({
      actionHandler: settingsActionHandler,
      nodes: tree,
    });
    saveState(config);
  }, [config, context, saveState, settingsActionHandler, topics]);

  // We use a layout effect to setup render handling for our panel. We also setup some topic subscriptions.
  // 我们使用布局效果来设置面板的渲染处理。 我们还设置了一些主题订阅。
  useLayoutEffect(() => {
    // The render handler is run by the broader studio system during playback when your panel
    // 当您的面板在播放期间，渲染处理程序由更广泛的工作室系统运行
    // needs to render because the fields it is watching have changed. How you handle rendering depends on your framework.
    // 需要渲染，因为它正在观察的字段已经改变。 你如何处理渲染取决于你的框架。
    // You can only setup one render handler - usually early on in setting up your panel.
    // 您只能设置一个渲染处理程序 - 通常在设置面板的早期。
    //
    // Without a render handler your panel will never receive updates.
    // 如果没有渲染处理程序，您的面板将永远不会收到更新。
    //
    // The render handler could be invoked as often as 60hz during playback if fields are changing often.
    // 如果字段经常更改，则可以在播放期间以 60hz 的频率调用渲染处理程序。
    context.onRender = (renderState: RenderState, done) => {
      // render functions receive a _done_ callback. You MUST call this callback to indicate your panel has finished rendering.
      // 渲染函数接收 _done_ 回调。 您必须调用此回调以指示您的面板已完成渲染。
      // Your panel will not receive another render callback until _done_ is called from a prior render. If your panel is not done
      // 在从先前的渲染调用 _done_ 之前，您的面板不会收到另一个渲染回调。 如果您的面板没有完成
      // rendering before the next render call, studio shows a notification to the user that your panel is delayed.
      // 在下一次渲染调用之前渲染，studio会向用户显示您的面板延迟的通知。

      // Set the done callback into a state variable to trigger a re-render.
      // 将完成的回调设置为状态变量以触发重新渲染。
      setRenderDone(() => done);

      // We may have new topics - since we are also watching for messages in the current frame, topics may not have changed
      // 我们可能有新的主题 - 因为我们也在关注当前帧中的消息，所以主题可能没有改变
      // It is up to you to determine the correct action when state has not changed.
      // 当状态没有改变时，由你来决定正确的动作。
      setTopics(
        renderState.topics?.filter(({ schemaName }) => {
          return [TWIST_SCHEMA, TWIST_SCHEMA_STAMPED].includes(schemaName);
        }) ?? [],
      );

      // 更换主题颜色
      if (renderState.colorScheme) {
        setColorScheme(renderState.colorScheme);
      }
    };

    // After adding a render handler, you must indicate which fields from RenderState will trigger updates.
    // If you do not watch any fields then your panel will never render since the panel context will assume you do not want any updates.

    // tell the panel context that we care about any update to the _topic_ field of RenderState
    context.watch("topics");
    context.watch("colorScheme");
  }, [context, colorScheme, initNipple]);

  // invoke the done callback once the render is complete
  // 渲染完成后调用done回调
  useEffect(() => {
    renderDone?.();
  }, [renderDone]);

  return (
    <div style={{ padding: "1rem" }}>
      <div id="nipple_zone"></div>
    </div>
  );
}

export function initExamplePanel(context: PanelExtensionContext): void {
  ReactDOM.render(<VirtualJoystickPanel context={context} />, context.panelElement);
}
