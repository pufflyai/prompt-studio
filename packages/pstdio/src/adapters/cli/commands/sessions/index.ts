import { defineCommandGroup } from "../../command-group";
import * as approveCommand from "./approve";
import * as archiveCommand from "./archive";
import * as createCommand from "./create";
import * as denyCommand from "./deny";
import * as followUpCommand from "./follow-up";
import * as listCommand from "./list";
import * as queuedCommand from "./queued-follow-ups";
import { combineQueuedCommand, updateQueuedCommand } from "./queued-follow-ups";
import * as resolveSessionIdCommand from "./resolve-session-id";
import * as steerCommand from "./steer";
import * as stopCommand from "./stop";
import * as streamCommand from "./stream";
import * as viewCommand from "./view";

export const { command, describe, subcommands, builder, handler } = defineCommandGroup(
  { name: "sessions", describe: "Manage sessions" },
  approveCommand,
  archiveCommand,
  createCommand,
  denyCommand,
  followUpCommand,
  listCommand,
  queuedCommand,
  updateQueuedCommand,
  combineQueuedCommand,
  steerCommand,
  resolveSessionIdCommand,
  streamCommand,
  stopCommand,
  viewCommand,
);
