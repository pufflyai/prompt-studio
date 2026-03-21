import type { Argv } from "yargs";
import * as listCommand from "./list";
import * as runCommand from "./run";

export const command = "hooks [command]";
export const describe = "Manage lifecycle hooks";

let _yargs: Argv;

export const builder = (yargs: Argv) => {
  _yargs = yargs;
  return yargs.command(listCommand).command(runCommand);
};

export const handler = () => {
  _yargs.showHelp();
};
