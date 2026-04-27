import type { Arguments, Argv } from "yargs";
import { pushPlannerTicket as defaultPushPlannerTicket } from "@/features/planner/api/push-ticket";
import { resolveProjectId as defaultResolveProjectId } from "@/features/projects/resolve-project-id";

export const command = "save";
export const describe = "Save local ticket content and files to the configured ticket source";

export const builder = (yargs: Argv) =>
  yargs
    .option("id", { type: "string", demandOption: true, describe: "Ticket shorthand (e.g. PS-12)" })
    .option("status", { type: "string", describe: "Status name to assign" })
    .option("tag", { type: "array", string: true, describe: "Tags to assign" });

type SaveArgs = {
  id: string;
  status?: string;
  tag?: string[];
};

type Deps = {
  cwd: () => string;
  resolveProjectId: typeof defaultResolveProjectId;
  pushTicket: typeof defaultPushPlannerTicket;
  log: (msg: string) => void;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  resolveProjectId: defaultResolveProjectId,
  pushTicket: defaultPushPlannerTicket,
  log: console.log,
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<SaveArgs>) => {
    const { root, projectId } = deps.resolveProjectId(deps.cwd());
    if (!root) throw new Error("Not inside a pstdio project. Run 'pstdio projects create' first.");

    const result = await deps.pushTicket(projectId, {
      ticket_id: argv.id,
      repo_path: root,
      status: argv.status,
      tags: argv.tag,
    });

    for (const message of result.messages) {
      deps.log(message);
    }
  };

export const handler = createHandler();
