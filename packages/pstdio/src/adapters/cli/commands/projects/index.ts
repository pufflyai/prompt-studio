import { defineCommandGroup } from "../../command-group";
import * as bindCommand from "./bind";
import * as createCommand from "./create";
import * as deleteCommand from "./delete";
import * as environmentCommand from "./environment";
import * as listCommand from "./list";
import * as viewCommand from "./view";

export const { command, describe, subcommands, builder, handler } = defineCommandGroup(
  { name: "projects", describe: "Manage projects" },
  createCommand,
  bindCommand,
  environmentCommand,
  deleteCommand,
  listCommand,
  viewCommand,
);
