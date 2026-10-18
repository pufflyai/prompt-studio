import { defineCommandGroup } from "../../command-group";
import * as installSkillsCommand from "./install-skills";
import * as listCommand from "./list";
import * as setupCommand from "./setup";

export const { command, describe, subcommands, builder, handler } = defineCommandGroup({
  name: "agents",
  describe: "Manage coding agents",
  subcommands: [listCommand, setupCommand, installSkillsCommand],
});
