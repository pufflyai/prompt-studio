import { defineCommandGroup } from "../../command-group";
import * as addCommand from "./add";
import * as checkCommand from "./check";
import * as devCommand from "./dev";
import * as installBrowserCommand from "./install-browser";
import * as testCommand from "./test";
import * as updateCommand from "./update";

export const { command, describe, subcommands, builder, handler } = defineCommandGroup({
  name: "extensions",
  describe: "Manage extension source installs",
  subcommands: [addCommand, checkCommand, devCommand, installBrowserCommand, updateCommand, testCommand],
});
