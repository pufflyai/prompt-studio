import type { Argv } from "yargs";
import { ensureApi } from "@/features/ensure-api";
import * as createCommand from "./create";
import * as deleteCommand from "./delete";
import * as listCommand from "./list";
import * as viewCommand from "./view";

export const command = "projects [command]";
export const describe = "Manage projects";

let _yargs: Argv;

export const builder = (yargs: Argv) => {
  _yargs = yargs;
  return yargs.command(createCommand).command(deleteCommand).command(listCommand).command(viewCommand);
};

export const middlewares = [() => ensureApi(process.env.PSTDIO_API_URL)];

export const handler = () => {
  _yargs.showHelp();
};
