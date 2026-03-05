import type { Arguments, Argv } from "yargs";
import { API_URL } from "@/features/api-url";
import { findGitRoot, readConfig } from "@/features/config/config";
import { listStatuses } from "@/features/statuses/api/list-statuses";
import { setDefaultStatus } from "@/features/statuses/api/set-default-status";

export const command = "set-default";
export const describe = "Set a status as the default";

export const builder = (yargs: Argv) =>
  yargs.option("name", {
    type: "string",
    demandOption: true,
    describe: "Name of the status to set as default",
  });

type SetDefaultArgs = { name: string };

type Deps = {
  cwd: () => string;
  findGitRoot: typeof findGitRoot;
  readConfig: typeof readConfig;
  listStatuses: typeof listStatuses;
  setDefaultStatus: typeof setDefaultStatus;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  findGitRoot,
  readConfig,
  listStatuses,
  setDefaultStatus,
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<SetDefaultArgs>) => {
    const root = deps.findGitRoot(deps.cwd());
    if (!root) throw new Error("Not inside a git repository.");

    const config = deps.readConfig(root);
    if (!config) throw new Error("Not inside a pstdio project. Run 'pstdio projects create' first.");

    const statuses = await deps.listStatuses(API_URL, config.project_id);
    const status = statuses.find((s) => s.name === argv.name);

    if (!status) {
      throw new Error(`Status not found: "${argv.name}"`);
    }

    await deps.setDefaultStatus(API_URL, config.project_id, status.id);

    console.log(`Default status set to "${argv.name}"`);
  };

export const handler = createHandler();
