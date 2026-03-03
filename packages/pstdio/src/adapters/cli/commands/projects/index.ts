import type { Argv } from "yargs";
import { API_URL } from "@/features/api-url";
import { ensureApi } from "@/features/ensure-api";
import * as createCommand from "./create";
import * as linkCommand from "./link";
import * as listCommand from "./list";

export const command = "projects [command]";
export const describe = "Manage projects";

let _yargs: Argv;

export const builder = (yargs: Argv) => {
  _yargs = yargs;
  return yargs.command(createCommand).command(linkCommand).command(listCommand);
};

export const middlewares = [() => ensureApi(API_URL)];

export const handler = () => {
  _yargs.showHelp();
};
