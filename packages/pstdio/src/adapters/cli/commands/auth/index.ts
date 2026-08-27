import type { Argv } from "yargs";
import { ensureApi } from "@/features/ensure-api";
import * as tokensCommand from "./tokens";

export const command = "auth [command]";
export const describe = "Manage machine authentication";

let commandYargs: Argv;

export const builder = (yargs: Argv) => {
  commandYargs = yargs;
  return yargs.command(tokensCommand);
};

export const middlewares = [() => ensureApi(process.env.PSTDIO_API_URL)];
export const handler = () => {
  commandYargs.showHelp();
};
