import { defineCommandGroup } from "../../command-group";
import * as cloudCommand from "./cloud";
import * as configureCommand from "./configure-cloud";
import * as bootstrapCommand from "./export-bootstrap";
import * as listCommand from "./list";
import * as removeCommand from "./remove";
import * as renameCommand from "./rename";
import * as startCommand from "./start";
import * as stopCommand from "./stop";

export const { command, describe, subcommands, builder, handler } = defineCommandGroup(
  { name: "devices", describe: "List, rename and remove the devices of your account" },
  listCommand,
  cloudCommand,
  bootstrapCommand,
  configureCommand,
  startCommand,
  stopCommand,
  renameCommand,
  removeCommand,
);
