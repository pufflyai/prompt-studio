import type { Argv } from "yargs";
import { ensureApi } from "@/features/ensure-api";
import * as approveCommand from "./approve";
import * as archiveCommand from "./archive";
import * as createCommand from "./create";
import * as denyCommand from "./deny";
import * as followUpCommand from "./follow-up";
import * as listCommand from "./list";
import * as resolveSessionIdCommand from "./resolve-session-id";
import * as stopCommand from "./stop";
import * as streamCommand from "./stream";
import * as viewCommand from "./view";

export const command = "sessions [command]";
export const describe = "Manage sessions";

let _yargs: Argv;

export const builder = (yargs: Argv) => {
  _yargs = yargs;
  return yargs
    .command(approveCommand)
    .command(archiveCommand)
    .command(createCommand)
    .command(denyCommand)
    .command(followUpCommand)
    .command(listCommand)
    .command(resolveSessionIdCommand)
    .command(streamCommand)
    .command(stopCommand)
    .command(viewCommand);
};

export const middlewares = [() => ensureApi(process.env.PSTDIO_API_URL)];

export const handler = () => {
  _yargs.showHelp();
};
