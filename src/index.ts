import { ExtensionContext } from "@foxglove/studio";

import { initExamplePanel } from "./VirtualJoystickPanel";

export function activate(extensionContext: ExtensionContext): void {
  extensionContext.registerPanel({ name: "Virtual Joystick [fix]", initPanel: initExamplePanel });
}
