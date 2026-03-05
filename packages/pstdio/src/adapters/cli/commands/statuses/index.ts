import type { Argv } from "yargs";
import { API_URL } from "@/features/api-url";
import { ensureApi } from "@/features/ensure-api";
import * as createCommand from "./create";
import * as deleteCommand from "./delete";
import * as listCommand from "./list";
import * as setDefaultCommand from "./set-default";

export const command = "statuses [command]";
export const describe = "Manage ticket statuses";

let _yargs: Argv;

export const builder = (yargs: Argv) => {
  _yargs = yargs;
  return yargs.command(listCommand).command(createCommand).command(setDefaultCommand).command(deleteCommand);
};

export const middlewares = [() => ensureApi(API_URL)];

export const handler = () => {
  _yargs.showHelp();
};
