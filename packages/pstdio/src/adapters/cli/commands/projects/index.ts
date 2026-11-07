import { defineCommandGroup } from "../../command-group";
import * as bindCommand from "./bind";
import * as cloudCommand from "./cloud";
import * as compositionCommand from "./composition";
import * as createCommand from "./create";
import * as deleteCommand from "./delete";
import * as environmentCommand from "./environment";
import * as folderCommand from "./folder";
import * as listCommand from "./list";
import * as localCommand from "./local";
import * as recoveryPointsCommand from "./recovery-points";
import * as restoreCommand from "./restore";
import * as returnedChangesCommand from "./returned-changes";
import * as viewCommand from "./view";

export const { command, describe, subcommands, builder, handler } = defineCommandGroup(
  { name: "projects", describe: "Manage projects" },
  createCommand,
  bindCommand,
  cloudCommand,
  compositionCommand,
  localCommand,
  returnedChangesCommand,
  environmentCommand,
  deleteCommand,
  listCommand,
  viewCommand,
  recoveryPointsCommand,
  restoreCommand,
  folderCommand,
);
