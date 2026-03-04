import type { Argv } from "yargs";
import * as createCommand from "./create";
import * as implementCommand from "./implement";
import * as listCommand from "./list";
import * as saveCommand from "./save";
import * as updateCommand from "./update";
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
    .command(implementCommand);
};

export const handler = () => {
  _yargs.showHelp();
};
