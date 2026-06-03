import type { ExtensionDefinition } from "@pstdio/sdk/extensions";
import { bumpCounterCommand, readCounterCommand, resetCounterCommand } from "./counter-commands";
import { awakenCommand, tryAwakenCommand, workspaceOnlyCommand } from "./demo-commands";
import { heartbeatCommand } from "./heartbeat-command";
import { sayHelloCommand } from "./say-hello-command";

export { labAwakenCommand, labHeartbeatCommand } from "./command-refs";
export { labSchedules } from "./schedules";

export const labCommands = {
  "say-hello": sayHelloCommand,
  "counter.bump": bumpCounterCommand,
  "counter.read": readCounterCommand,
  "counter.reset": resetCounterCommand,
  awaken: awakenCommand,
  "demo.try-awaken": tryAwakenCommand,
  heartbeat: heartbeatCommand,
  "demo.workspace-only": workspaceOnlyCommand,
} satisfies NonNullable<ExtensionDefinition["commands"]>;
