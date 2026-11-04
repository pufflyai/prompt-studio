import { defineCommandGroup } from "../../command-group";
import * as addCommand from "./add";
import * as automationsCommand from "./automations";
import * as checkCommand from "./check";
import * as devCommand from "./dev";
import * as installBrowserCommand from "./install-browser";
import * as installationsCommand from "./installations";
import * as packCommand from "./pack";
import * as publicationCommand from "./publication";
import * as testCommand from "./test";
import * as updateCommand from "./update";

export const { command, describe, subcommands, builder, handler } = defineCommandGroup(
  { name: "extensions", describe: "Manage extension source installs" },
  addCommand,
  automationsCommand,
  checkCommand,
  devCommand,
  installBrowserCommand,
  installationsCommand,
  updateCommand,
  publicationCommand,
  testCommand,
  packCommand,
);
