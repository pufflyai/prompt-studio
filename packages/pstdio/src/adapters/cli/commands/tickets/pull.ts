import type { Arguments, Argv } from "yargs";
import { pullPlannerTickets as defaultPullPlannerTickets } from "@/features/planner/api/pull-tickets";
import { resolveProjectId as defaultResolveProjectId } from "@/features/projects/resolve-project-id";

export const command = "pull";
export const describe = "Pull ticket content and files from the configured ticket source";

export const builder = (yargs: Argv) =>
  yargs
    .option("id", { type: "string", describe: "Ticket shorthand (e.g. PS-12). Omit to pull all non-archived tickets" })
    .option("force", { type: "boolean", default: false, describe: "Overwrite existing local files" });

type PullArgs = {
  id?: string;
  force: boolean;
};

type Deps = {
  cwd: () => string;
  resolveProjectId: typeof defaultResolveProjectId;
  pullTickets: typeof defaultPullPlannerTickets;
  log: (msg: string) => void;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  resolveProjectId: defaultResolveProjectId,
  pullTickets: defaultPullPlannerTickets,
  log: console.log,
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<PullArgs>) => {
    const { root, projectId } = deps.resolveProjectId(deps.cwd());
    if (!root) throw new Error("Not inside a pstdio project. Run 'pstdio projects create' first.");

    const result = await deps.pullTickets(projectId, {
      ticket_id: argv.id,
      force: argv.force,
      repo_path: root,
    });

    for (const message of result.messages) {
      deps.log(message);
    }
  };

export const handler = createHandler();
