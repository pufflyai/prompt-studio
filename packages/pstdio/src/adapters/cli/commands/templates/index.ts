import type { Argv } from "yargs";
import { API_URL } from "@/features/api-url";
import { ensureApi } from "@/features/ensure-api";
import * as createCommand from "./create";
import * as deleteCommand from "./delete";
import * as listCommand from "./list";
import * as updateCommand from "./update";
import * as writeCommand from "./write";

export const command = "templates [command]";
export const describe = "Manage templates";

let _yargs: Argv;

export const builder = (yargs: Argv) => {
  _yargs = yargs;
  return yargs
    .command(listCommand)
    .command(createCommand)
    .command(deleteCommand)
    .command(updateCommand)
    .command(writeCommand);
};

export const middlewares = [() => ensureApi(API_URL)];

export const handler = () => {
  _yargs.showHelp();
};
