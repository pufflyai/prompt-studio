import type { Argv } from "yargs";
import { API_URL } from "@/features/api-url";
import { ensureApi } from "@/features/ensure-api";
import * as createCommand from "./create";
import * as deleteCommand from "./delete";
import * as listCommand from "./list";

export const command = "tags [command]";
export const describe = "Manage ticket tags";

let _yargs: Argv;

export const builder = (yargs: Argv) => {
  _yargs = yargs;
  return yargs.command(listCommand).command(createCommand).command(deleteCommand);
};

export const middlewares = [() => ensureApi(API_URL)];

export const handler = () => {
  _yargs.showHelp();
};
