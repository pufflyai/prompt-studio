import type { Argv } from "yargs";
import * as cancelCommand from "./cancel";
import * as eventsCommand from "./events";
import * as runCommand from "./run";
import * as statusCommand from "./status";
import * as watchCommand from "./watch";

export const command = "automation [command]";
export const describe = "Create and inspect durable automation runs";

let commandYargs: Argv;

export const builder = (yargs: Argv) => {
  commandYargs = yargs;
  return yargs
    .command(runCommand)
    .command(statusCommand)
    .command(eventsCommand)
    .command(cancelCommand)
    .command(watchCommand);
};

export const handler = () => {
  commandYargs.showHelp();
};
