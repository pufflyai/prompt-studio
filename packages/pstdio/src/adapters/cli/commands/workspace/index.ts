import type { Argv } from "yargs";
import * as createCommand from "./create";
import * as deleteCommand from "./delete";
import * as listCommand from "./list";
import * as listStatusesCommand from "./list-statuses";
import * as mergeCommand from "./merge";
import * as setStatusCommand from "./set-status";

export const command = "workspaces [command]";
export const describe = "Manage workspaces";

let _yargs: Argv;

export const builder = (yargs: Argv) => {
  _yargs = yargs;
  return yargs
    .command(createCommand)
    .command(listCommand)
    .command(listStatusesCommand)
    .command(deleteCommand)
    .command(mergeCommand)
    .command(setStatusCommand);
};

export const handler = () => {
  _yargs.showHelp();
};
