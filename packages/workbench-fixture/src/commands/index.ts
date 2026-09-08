import { awakenCommand } from "./awaken-command";
import { camsCurrentCommand, camsSelectCommand, camsTreeCommand } from "./cams-commands";
import { bumpCounterCommand, readCounterCommand, resetCounterCommand } from "./counter-commands";
import { tryAwakenCommand, workspaceOnlyCommand } from "./demo-commands";
import {
  createGlassLabArtifactCommand,
  deleteGlassLabArtifactCommand,
  queryArtifactMenuCommand,
  queryGlassLabArtifactsCommand,
  updateArtifactMenuCommand,
} from "./glass-lab-artifacts-command";
import { heartbeatCommand } from "./heartbeat-command";
import { openLabResourceCommand } from "./lab-resources-command";
import { sayHelloCommand } from "./say-hello-command";
import { readWebviewFileCommand } from "./webview-file-command";

export { labSchedules } from "./schedules";

export const labCommands = [
  sayHelloCommand,
  bumpCounterCommand,
  readCounterCommand,
  resetCounterCommand,
  createGlassLabArtifactCommand,
  deleteGlassLabArtifactCommand,
  queryGlassLabArtifactsCommand,
  queryArtifactMenuCommand,
  updateArtifactMenuCommand,
  camsTreeCommand,
  camsSelectCommand,
  camsCurrentCommand,
  openLabResourceCommand,
  awakenCommand,
  tryAwakenCommand,
  heartbeatCommand,
  workspaceOnlyCommand,
  readWebviewFileCommand,
];
