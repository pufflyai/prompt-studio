import type { Argv } from "yargs";
import { API_URL } from "@/features/api-url";
import { ensureApi } from "@/features/ensure-api";
import * as installSkillsCommand from "./install-skills";
import * as listCommand from "./list";
import * as setupCommand from "./setup";

export const command = "agents [command]";
export const describe = "Manage coding agents";

let _yargs: Argv;

export const builder = (yargs: Argv) => {
  _yargs = yargs;
  return yargs.command(listCommand).command(setupCommand).command(installSkillsCommand);
};

export const middlewares = [() => ensureApi(API_URL)];

export const handler = () => {
  _yargs.showHelp();
};
