import type { ExtensionDefinition } from "@pstdio/sdk/extensions";
import { camsCurrentCommand, camsSelectCommand, camsTreeCommand } from "./cams-commands";
import { bumpCounterCommand, readCounterCommand, resetCounterCommand } from "./counter-commands";
import { awakenCommand, tryAwakenCommand, workspaceOnlyCommand } from "./demo-commands";
import {
  createGlassLabArtifactCommand,
  deleteGlassLabArtifactCommand,
  queryArtifactMenuCommand,
  queryGlassLabArtifactsCommand,
  updateArtifactMenuCommand,
} from "./glass-lab-artifacts-command";
import { heartbeatCommand } from "./heartbeat-command";
import { openLabResourceCommand, queryLabResourcesCommand } from "./lab-resources-command";
import { sayHelloCommand } from "./say-hello-command";

export { labAwakenCommand, labHeartbeatCommand } from "./command-refs";
export { labSchedules } from "./schedules";

export const labCommands = {
  "say-hello": sayHelloCommand,
  "counter.bump": bumpCounterCommand,
  "counter.read": readCounterCommand,
  "counter.reset": resetCounterCommand,
  "glass-lab-artifacts.create": createGlassLabArtifactCommand,
  "glass-lab-artifacts.delete": deleteGlassLabArtifactCommand,
  "glass-lab-artifacts.query": queryGlassLabArtifactsCommand,
  "artifact-menu.query": queryArtifactMenuCommand,
  "artifact-menu.update": updateArtifactMenuCommand,
  "cams.tree": camsTreeCommand,
  "cams.select": camsSelectCommand,
  "cams.current": camsCurrentCommand,
  "command-palette-resources.query": queryLabResourcesCommand,
  "command-palette-resources.open": openLabResourceCommand,
  awaken: awakenCommand,
  "demo.try-awaken": tryAwakenCommand,
  heartbeat: heartbeatCommand,
  "demo.workspace-only": workspaceOnlyCommand,
} satisfies NonNullable<ExtensionDefinition["commands"]>;
