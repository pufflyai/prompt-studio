import type { Argv } from "yargs";

export const command = "tickets [command]";
export const describe = "Manage tickets";

let _yargs: Argv;

export const builder = (yargs: Argv) => {
  _yargs = yargs;
  return yargs;
};

export const handler = () => {
  _yargs.showHelp();
};
