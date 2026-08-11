import type { Argv } from "yargs";
import { ensureApi } from "@/features/ensure-api";
import * as createCommand from "./create";
import * as deleteCommand from "./delete";
import * as linkCommand from "./link";
import * as listCommand from "./list";
import * as reposCommand from "./repos";
import * as unlinkCommand from "./unlink";
import * as viewCommand from "./view";

export const command = "projects [command]";
export const describe = "Manage projects";

let _yargs: Argv;

export const builder = (yargs: Argv) => {
  _yargs = yargs;
  return yargs
    .command(createCommand)
    .command(deleteCommand)
    .command(linkCommand)
    .command(listCommand)
    .command(reposCommand)
    .command(unlinkCommand)
    .command(viewCommand);
};

export const middlewares = [() => ensureApi(process.env.PSTDIO_API_URL)];

export const handler = () => {
  _yargs.showHelp();
};
