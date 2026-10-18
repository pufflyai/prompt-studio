import { defineCommandGroup } from "../../../command-group";
import * as issueCommand from "./issue";
import * as listCommand from "./list";
import * as revokeCommand from "./revoke";

export const { command, describe, subcommands, builder, handler } = defineCommandGroup({
  name: "tokens",
  describe: "Issue, list, and revoke machine tokens",
  subcommands: [issueCommand, listCommand, revokeCommand],
});
