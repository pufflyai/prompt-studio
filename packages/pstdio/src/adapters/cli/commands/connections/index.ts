import type { Argv } from "yargs";
import { ensureApi } from "@/features/ensure-api";
import * as checkCommand from "./check";

export const command = "connections [command]";
export const describe = "Inspect host-managed extension connections";

let commandYargs: Argv;

export const builder = (yargs: Argv) => {
  commandYargs = yargs;
  return yargs.command(checkCommand);
};

export const middlewares = [() => ensureApi(process.env.PSTDIO_API_URL)];
export const handler = () => {
  commandYargs.showHelp();
};
