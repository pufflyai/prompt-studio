import type { Argv } from "yargs";
import * as addCommand from "./add";
import * as checkCommand from "./check";
import * as enableCommand from "./enable";

export const command = "extensions [command]";
export const describe = "Inspect and validate installed pstdio extensions";

let _yargs: Argv;

export const builder = (yargs: Argv) => {
  _yargs = yargs;
  return yargs.command(addCommand).command(checkCommand).command(enableCommand);
};

export const handler = () => {
  _yargs.showHelp();
};
