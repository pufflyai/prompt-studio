import { defineCommandGroup } from "../../../command-group";
import * as cancelCommand from "./cancel";
import * as captureCommand from "./capture";
import * as downloadCommand from "./download";
import * as restoreCommand from "./restore";
import * as sourcesCommand from "./sources";
import * as statusCommand from "./status";

export const { command, describe, subcommands, builder, handler } = defineCommandGroup(
  { name: "folder", describe: "Capture, download and restore project folder copies from Cloud" },
  sourcesCommand,
  statusCommand,
  captureCommand,
  downloadCommand,
  restoreCommand,
  cancelCommand,
);
