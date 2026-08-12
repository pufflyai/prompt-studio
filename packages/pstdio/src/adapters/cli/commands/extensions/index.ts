import type { Argv } from "yargs";
import * as addCommand from "./add";
import * as checkCommand from "./check";
import * as devCommand from "./dev";

export const command = "extensions [command]";
export const describe = "Manage extension source installs";

let _yargs: Argv;

export const builder = (yargs: Argv) => {
  _yargs = yargs;
  return yargs.command(addCommand).command(checkCommand).command(devCommand);
};

export const handler = () => {
  _yargs.showHelp();
};
