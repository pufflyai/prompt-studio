import type { Argv } from "yargs";
import { API_URL } from "@/features/api-url";
import { ensureApi } from "@/features/ensure-api";
import * as installPluginsCommand from "./install-plugins";
import * as installSkillsCommand from "./install-skills";
import * as listCommand from "./list";
import * as removeCommand from "./remove";
import * as setupCommand from "./setup";
import * as updateCommand from "./update";

export const command = "agents [command]";
export const describe = "Manage coding agents";

let _yargs: Argv;

export const builder = (yargs: Argv) => {
  _yargs = yargs;
  return yargs
    .command(listCommand)
    .command(setupCommand)
    .command(updateCommand)
    .command(removeCommand)
    .command(installPluginsCommand)
    .command(installSkillsCommand);
};

export const middlewares = [() => ensureApi(API_URL)];

export const handler = () => {
  _yargs.showHelp();
};
