import type { Argv } from "yargs";
import * as archiveCommand from "./archive";
import * as createCommand from "./create";
import * as deleteCommand from "./delete";
import * as filesCommand from "./files";
import * as implementCommand from "./implement";
import * as listCommand from "./list";
import * as pullCommand from "./pull";
import * as saveCommand from "./save";
import * as updateCommand from "./update";
import * as workspacesCommand from "./workspaces";
import * as writeCommand from "./write";

export const command = "tickets [command]";
export const describe = "Manage tickets";

let _yargs: Argv;

export const builder = (yargs: Argv) => {
  _yargs = yargs;
  return yargs
    .command(writeCommand)
    .command(createCommand)
    .command(saveCommand)
    .command(listCommand)
    .command(updateCommand)
    .command(implementCommand)
    .command(pullCommand)
    .command(filesCommand)
    .command(workspacesCommand)
    .command(deleteCommand)
    .command(archiveCommand);
};

export const handler = () => {
  _yargs.showHelp();
};
