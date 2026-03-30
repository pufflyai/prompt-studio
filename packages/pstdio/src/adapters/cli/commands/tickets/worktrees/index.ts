import type { Argv } from "yargs";
import * as listCommand from "./list";
import * as removeAllCommand from "./remove-all";

export const command = "worktrees [command]";
export const describe = "Manage worktrees linked to tickets";

let _yargs: Argv;

export const builder = (yargs: Argv) => {
  _yargs = yargs;
  return yargs.command(listCommand).command(removeAllCommand);
};

export const handler = () => {
  _yargs.showHelp();
};
