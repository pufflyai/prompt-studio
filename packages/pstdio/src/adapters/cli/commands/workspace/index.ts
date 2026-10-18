import { defineCommandGroup } from "../../command-group";
import * as createCommand from "./create";
import * as deleteCommand from "./delete";
import * as fileLinkCommand from "./file-link";
import * as listCommand from "./list";
import * as mergeCommand from "./merge";

export const { command, describe, subcommands, builder, handler } = defineCommandGroup(
  { name: "workspaces", describe: "Manage workspaces" },
  createCommand,
  listCommand,
  deleteCommand,
  mergeCommand,
  fileLinkCommand,
);
