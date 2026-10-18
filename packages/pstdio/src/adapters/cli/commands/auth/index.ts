import { defineCommandGroup } from "../../command-group";
import * as tokensCommand from "./tokens";

export const { command, describe, subcommands, builder, handler } = defineCommandGroup({
  name: "auth",
  describe: "Manage machine authentication",
  subcommands: [tokensCommand],
});
