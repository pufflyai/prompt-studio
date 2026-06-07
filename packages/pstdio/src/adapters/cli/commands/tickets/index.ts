import type { Argv } from "yargs";
import * as filesCommand from "./files";
import * as implementCommand from "./implement";
import * as pullCommand from "./pull";
import * as saveCommand from "./save";
import * as updateWhenAttemptStatusCommand from "./update-when-attempt-status";
import * as workspacesCommand from "./workspaces";
import * as worktreesCommand from "./worktrees";
import * as writeCommand from "./write";

export const command = "tickets [command]";
export const describe = "Manage tickets";

let _yargs: Argv;

// create/update/delete/archive/list/view are owned by the pstdio-planner
// extension and dispatched through the extension CLI router (see index.ts). What
// remains here is the local-file draft workflow plus attempt/workspace commands.
export const builder = (yargs: Argv) => {
  _yargs = yargs;
  return yargs
    .command(writeCommand)
    .command(saveCommand)
    .command(implementCommand)
    .command(pullCommand)
    .command(filesCommand)
    .command(workspacesCommand)
    .command(worktreesCommand)
    .command(updateWhenAttemptStatusCommand);
};

export const handler = () => {
  _yargs.showHelp();
};
