import type { Argv } from "yargs";
import * as createCommand from "./create";
import * as deleteCommand from "./delete";
import * as listCommand from "./list";
import * as mergeCommand from "./merge";

export const command = "workspaces [command]";
export const describe = "Manage workspaces";

let _yargs: Argv;

export const builder = (yargs: Argv) => {
  _yargs = yargs;
  return yargs.command(createCommand).command(listCommand).command(deleteCommand).command(mergeCommand);
};

export const handler = () => {
  _yargs.showHelp();
};
