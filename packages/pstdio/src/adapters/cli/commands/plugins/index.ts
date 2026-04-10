import type { Argv } from "yargs";
import { API_URL } from "@/features/api-url";
import { ensureApi } from "@/features/ensure-api";
import * as listCommand from "./list";
import * as registerCommand from "./register";

export const command = "plugins [command]";
export const describe = "Manage project plugins";

let _yargs: Argv;

export const builder = (yargs: Argv) => {
  _yargs = yargs;
  return yargs.command(listCommand).command(registerCommand);
};

export const middlewares = [() => ensureApi(API_URL)];

export const handler = () => {
  _yargs.showHelp();
};
