import type { Argv } from "yargs";
import * as checkCommand from "./check";

export const command = "extensions [command]";
export const describe = "Inspect and validate installed pstdio extensions";

let _yargs: Argv;

export const builder = (yargs: Argv) => {
  _yargs = yargs;
  return yargs.command(checkCommand);
};

export const handler = () => {
  _yargs.showHelp();
};
