import { defineCommandGroup } from "../../command-group";
import * as listCommand from "./list";
import * as removeCommand from "./remove";
import * as renameCommand from "./rename";

export const { command, describe, subcommands, builder, handler } = defineCommandGroup(
  { name: "devices", describe: "List, rename and remove the devices of your account" },
  listCommand,
  renameCommand,
  removeCommand,
);
