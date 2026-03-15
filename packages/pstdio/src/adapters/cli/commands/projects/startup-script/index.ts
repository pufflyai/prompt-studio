import type { Argv } from "yargs";
import * as clearCommand from "./clear";
import * as getCommand from "./get";
import * as pullCommand from "./pull";
import * as saveCommand from "./save";
import * as setCommand from "./set";

export const command = "startup-script [command]";
export const describe = "Manage the project startup script";

let _yargs: Argv;

export const builder = (yargs: Argv) => {
  _yargs = yargs;
  return yargs.command(setCommand).command(getCommand).command(saveCommand).command(pullCommand).command(clearCommand);
};

export const handler = () => {
  _yargs.showHelp();
};
