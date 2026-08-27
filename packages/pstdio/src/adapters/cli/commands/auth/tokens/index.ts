import type { Argv } from "yargs";
import * as issueCommand from "./issue";
import * as listCommand from "./list";
import * as revokeCommand from "./revoke";

export const command = "tokens [command]";
export const describe = "Issue, list, and revoke machine tokens";

let commandYargs: Argv;

export const builder = (yargs: Argv) => {
  commandYargs = yargs;
  return yargs.command(issueCommand).command(listCommand).command(revokeCommand);
};

export const handler = () => {
  commandYargs.showHelp();
};
