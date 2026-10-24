import { defineCommandGroup } from "../../command-group";
import * as bindCommand from "./bind";
import * as cloudCommand from "./cloud";
import * as createCommand from "./create";
import * as deleteCommand from "./delete";
import * as environmentCommand from "./environment";
import * as listCommand from "./list";
import * as localCommand from "./local";
import * as recoveryPointsCommand from "./recovery-points";
import * as restoreCommand from "./restore";
import * as viewCommand from "./view";

export const { command, describe, subcommands, builder, handler } = defineCommandGroup(
  { name: "projects", describe: "Manage projects" },
  createCommand,
  bindCommand,
  cloudCommand,
  localCommand,
  environmentCommand,
  deleteCommand,
  listCommand,
  viewCommand,
  recoveryPointsCommand,
  restoreCommand,
);
