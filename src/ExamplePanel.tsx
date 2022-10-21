import { PanelExtensionContext, RenderState, Topic, MessageEvent } from "@foxglove/studio";
import { useLayoutEffect, useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { JoystickManagerOptions, Position } from 'nipplejs';
import nipplejs from 'nipplejs';

type PanelState = {
  outmsg?: string;
};

function ExamplePanel({ context }: { context: PanelExtensionContext }): JSX.Element {
  const [topics, setTopics] = useState<readonly Topic[] | undefined>();
  const [messages, setMessages] = useState<readonly MessageEvent<unknown>[] | undefined>();

  const [renderDone, setRenderDone] = useState<(() => void) | undefined>();

  // Restore our state from the layout via the context.initialState property.
  const [state, setState] = useState<PanelState>(() => {
    return context.initialState as PanelState;
  });

  let startPoint: Position;
  let timer: ReturnType<typeof setInterval> | undefined;;
  let diffValue: [number, number];

  let currentTopic: string = "/turtle1/cmd_vel"
  const message = {
    linear: {
      x: 0,
      y: 0,
      z: 0,
    },
    angular: {
      x: 0,
      y: 0,
      z: 0,
    },
  };

  let cmdMove = (lx: number, az: number) => {
    setState({ outmsg: lx + ', ' + az });
    message.linear.x = lx;
    message.angular.z = az;
    context.publish?.(currentTopic, message);
  }

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
      setTopics(renderState.topics);

      // currentFrame has messages on subscribed topics since the last render call
      // 自上次渲染调用以来，currentFrame 有关于订阅主题的消息
      setMessages(renderState.currentFrame);
    };

    // After adding a render handler, you must indicate which fields from RenderState will trigger updates.
    // If you do not watch any fields then your panel will never render since the panel context will assume you do not want any updates.

    // tell the panel context that we care about any update to the _topic_ field of RenderState
    context.watch("topics");

    // tell the panel context we want messages for the current frame for topics we've subscribed to
    // 告诉面板上下文我们想要我们订阅的主题的当前框架的消息
    // This corresponds to the _currentFrame_ field of render state.
    // 这对应于渲染状态的 _currentFrame_ 字段。
    context.watch("currentFrame");

    // subscribe to some topics, you could do this within other effects, based on input fields, etc
    // Once you subscribe to topics, currentFrame will contain message events from those topics (assuming there are messages).
    // context.subscribe(["/some/topic"]);
    context.advertise?.("/turtle1/cmd_vel", "geometry_msgs/Twist");

    // nipple
    let options: JoystickManagerOptions = {
      zone: document.getElementById('nipple_zone') as HTMLElement,
      color: '#FF8000',
      size: 200,
      mode: 'static',
      position: { left: '50%', top: '50%' },
    };
    // nipple_manager
    let manager = nipplejs.create(options);
    // nipple_start
    manager.on('start', (evt, data) => {
      evt
      console.log('start')
      // console.log(data.position)
      startPoint = data.position
      // 开启发送定时器
      timer = setInterval(() => {
        cmdMove(diffValue[0], diffValue[1])
      }, 200)
    })
    // nipple_move
    manager.on('move', (evt, data) => {
      evt
      // console.log(data.position)
      let x = startPoint.x - data.position.x
      let y = startPoint.y - data.position.y
      // X 角速度
      let resultX = x / 100 * 1.5707
      // Y 线速度
      let resultY = y / 100 * 1.0
      diffValue = [resultY, resultX]
    })
    // nipple_end
    manager.on('end', () => {
      console.log('stop')
      // 停车
      cmdMove(0, 0)
      clearInterval(timer)
    })
  }, [context]);

  // invoke the done callback once the render is complete
  // 渲染完成后调用done回调
  useEffect(() => {
    renderDone?.();
  }, [renderDone]);

  return (
    <div style={{ padding: "1rem" }}>
      <h2>nipple test</h2>
      <div style={{ display: "none" }}>
        <p>
          Check the{" "}
          <a href="https://foxglove.dev/docs/studio/extensions/getting-started">documentation</a> for
          more details on building extension panels for Foxglove Studio.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", rowGap: "0.2rem" }}>
          <b style={{ borderBottom: "1px solid" }}>Topic</b>
          <b style={{ borderBottom: "1px solid" }}>Datatype</b>
          {(topics ?? []).map((topic) => (
            <>
              <div key={topic.name}>{topic.name}</div>
              <div key={topic.datatype}>{topic.datatype}</div>
            </>
          ))}
        </div>
        <div>{messages?.length}</div>
      </div>

      <div id="nipple_zone"></div>

      <div>{state.outmsg}</div>
    </div>
  );
}

export function initExamplePanel(context: PanelExtensionContext): void {
  ReactDOM.render(<ExamplePanel context={context} />, context.panelElement);
}
