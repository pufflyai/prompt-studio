import type { Argv } from "yargs";
import { ensureApi } from "@/features/ensure-api";
import * as listCommand from "./list";
import * as sendCommand from "./send";
import * as showCommand from "./show";
import * as snoozeCommand from "./snooze";
import { dismissCommand, doneCommand, readCommand } from "./transition";

export const command = "notifications [command]";
export const describe = "Manage notifications";

let _yargs: Argv;

export const builder = (yargs: Argv) => {
  _yargs = yargs;
  return yargs
    .command(listCommand)
    .command(showCommand)
    .command(sendCommand)
    .command(readCommand)
    .command(doneCommand)
    .command(dismissCommand)
    .command(snoozeCommand);
};

export const middlewares = [() => ensureApi(process.env.PSTDIO_API_URL)];

export const handler = () => {
  _yargs.showHelp();
};
