import { defineCommandGroup } from "../../command-group";
import * as listCommand from "./list";
import * as sendCommand from "./send";
import * as showCommand from "./show";
import * as snoozeCommand from "./snooze";
import { dismissCommand, doneCommand, readCommand } from "./transition";

export const { command, describe, subcommands, builder, handler } = defineCommandGroup(
  { name: "notifications", describe: "Manage notifications" },
  listCommand,
  showCommand,
  sendCommand,
  readCommand,
  doneCommand,
  dismissCommand,
  snoozeCommand,
);
