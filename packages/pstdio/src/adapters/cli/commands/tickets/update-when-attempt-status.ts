import type { Arguments, Argv } from "yargs";
import { API_URL } from "@/features/api-url";
import { resolveProjectId as defaultResolveProjectId } from "@/features/projects/resolve-project-id";
import { updateWhenAttemptStatus as defaultUpdateWhenAttemptStatus } from "@/features/tickets/api/update-when-attempt-status";
import { resolveTicketByShorthand as defaultResolveTicketByShorthand } from "@/features/tickets/resolve-ticket-by-shorthand";

export const command = "update-when-attempt-status";
export const describe = "Conditionally update ticket status when all attempts match a given attempt status";

export const builder = (yargs: Argv) =>
  yargs
    .option("id", { type: "string", demandOption: true, describe: "Ticket shorthand (e.g. PS-12)" })
    .option("all-attempts-status", {
      type: "string",
      demandOption: true,
      describe: "Required attempt status name for all workspaces",
    })
    .option("set-status", {
      type: "string",
      demandOption: true,
      describe: "Ticket status name to set when condition is met",
    })
    .option("project-id", { type: "string", describe: "Project ID" });

export type UpdateWhenAttemptStatusArgs = {
  id: string;
  "all-attempts-status": string;
  "set-status": string;
  "project-id"?: string;
};

type Deps = {
  cwd: () => string;
  resolveProjectId: typeof defaultResolveProjectId;
  resolveTicketByShorthand: typeof defaultResolveTicketByShorthand;
  updateWhenAttemptStatus: typeof defaultUpdateWhenAttemptStatus;
  log: (msg: string) => void;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  resolveProjectId: defaultResolveProjectId,
  resolveTicketByShorthand: defaultResolveTicketByShorthand,
  updateWhenAttemptStatus: defaultUpdateWhenAttemptStatus,
  log: console.log,
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<UpdateWhenAttemptStatusArgs>) => {
    const { projectId } = deps.resolveProjectId(deps.cwd(), argv["project-id"]);

    const ticket = await deps.resolveTicketByShorthand(API_URL, projectId, argv.id);
    if (!ticket) throw new Error(`Ticket not found: ${argv.id}`);

    const result = await deps.updateWhenAttemptStatus(API_URL, ticket.id, {
      all_attempts_status: argv["all-attempts-status"],
      set_status: argv["set-status"],
    });

    if (result.updated) {
      deps.log(`Ticket ${argv.id} updated to "${argv["set-status"]}".`);
    } else {
      deps.log(`No change — not all attempts have status "${argv["all-attempts-status"]}".`);
    }
  };

export const handler = createHandler();
