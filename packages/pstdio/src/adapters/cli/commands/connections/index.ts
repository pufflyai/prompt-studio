import { defineCommandGroup } from "../../command-group";
import * as checkCommand from "./check";

export const { command, describe, subcommands, builder, handler } = defineCommandGroup({
  name: "connections",
  describe: "Inspect host-managed extension connections",
  subcommands: [checkCommand],
});
