import { defineCommandGroup } from "../../command-group";
import * as cancelCommand from "./cancel";
import * as eventsCommand from "./events";
import * as runCommand from "./run";
import * as statusCommand from "./status";
import * as watchCommand from "./watch";

export const { command, describe, subcommands, builder, handler } = defineCommandGroup(
  { name: "automation", describe: "Create and inspect durable automation runs" },
  runCommand,
  statusCommand,
  eventsCommand,
  cancelCommand,
  watchCommand,
);
