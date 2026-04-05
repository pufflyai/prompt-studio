import type { Arguments, Argv } from "yargs";
import { findGitRoot, readConfig } from "@/features/config/config";
import { deleteStatus } from "@/features/statuses/api/delete-status";
import { listStatuses } from "@/features/statuses/api/list-statuses";

export const command = "delete";
export const describe = "Delete a ticket status";

export const builder = (yargs: Argv) =>
  yargs.option("name", {
    type: "string",
    demandOption: true,
    describe: "Name of the status to delete",
  });

type DeleteArgs = { name: string };

type Deps = {
  cwd: () => string;
  findGitRoot: typeof findGitRoot;
  readConfig: typeof readConfig;
  listStatuses: typeof listStatuses;
  deleteStatus: typeof deleteStatus;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  findGitRoot,
  readConfig,
  listStatuses,
  deleteStatus,
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<DeleteArgs>) => {
    const root = deps.findGitRoot(deps.cwd());
    if (!root) throw new Error("Not inside a git repository.");

    const config = deps.readConfig(root);
    if (!config) throw new Error("Not inside a pstdio project. Run 'pstdio projects create' first.");

    const statuses = await deps.listStatuses(config.project_id);
    const status = statuses.find((s) => s.name === argv.name);

    if (!status) {
      throw new Error(`Status not found: "${argv.name}"`);
    }

    if (status.is_default) {
      throw new Error(`Cannot delete the default status "${argv.name}". Set another status as default first.`);
    }

    await deps.deleteStatus(config.project_id, status.id);

    console.log(`Deleted status "${argv.name}"`);
  };

export const handler = createHandler();
