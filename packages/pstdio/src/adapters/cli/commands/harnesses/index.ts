import type { Argv } from "yargs";
import * as listCommand from "./list";
import * as removeCommand from "./remove";
import * as sendCommand from "./send";
import * as setupCommand from "./setup";
import * as startCommand from "./start";
import * as stopCommand from "./stop";
import * as updateCommand from "./update";

export const command = "harnesses [command]";
export const describe = "Manage and run harness providers";

let _yargs: Argv;

export const builder = (yargs: Argv) => {
  _yargs = yargs;
  return yargs
    .command(listCommand)
    .command(setupCommand)
    .command(updateCommand)
    .command(removeCommand)
    .command(startCommand)
    .command(sendCommand)
    .command(stopCommand);
};

export const handler = () => {
  _yargs.showHelp();
};
