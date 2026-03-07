import type { Arguments, Argv } from "yargs";
import { API_URL } from "@/features/api-url";
import { resolveProjectId as defaultResolveProjectId } from "@/features/projects/resolve-project-id";
import { listTickets as defaultListTickets } from "@/features/tickets/api/list-tickets";
import { updateTicket as defaultUpdateTicket } from "@/features/tickets/api/update-ticket";
import { resolveStatusId as defaultResolveStatusId } from "@/features/tickets/resolve-status-id";
import { resolveTagIds as defaultResolveTagIds } from "@/features/tickets/resolve-tag-ids";

export const command = "update";
export const describe = "Update ticket status or tags";

export const builder = (yargs: Argv) =>
  yargs
    .option("id", { type: "string", demandOption: true, describe: "Ticket shorthand" })
    .option("project-id", { type: "string", describe: "Project ID" })
    .option("status", { type: "string", describe: "New status name" })
    .option("tag", { type: "array", string: true, describe: "Replace tags" });

type UpdateArgs = {
  id: string;
  "project-id"?: string;
  status?: string;
  tag?: string[];
};

type Deps = {
  cwd: () => string;
  resolveProjectId: typeof defaultResolveProjectId;
  listTickets: typeof defaultListTickets;
  updateTicket: typeof defaultUpdateTicket;
  resolveStatusId: typeof defaultResolveStatusId;
  resolveTagIds: typeof defaultResolveTagIds;
  log: (msg: string) => void;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  resolveProjectId: defaultResolveProjectId,
  listTickets: defaultListTickets,
  updateTicket: defaultUpdateTicket,
  resolveStatusId: defaultResolveStatusId,
  resolveTagIds: defaultResolveTagIds,
  log: console.log,
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<UpdateArgs>) => {
    const { projectId } = deps.resolveProjectId(deps.cwd(), argv["project-id"]);

    const tickets = await deps.listTickets(API_URL, {
      project_id: projectId,
      shorthand: argv.id,
    });
    if (tickets.length === 0) {
      throw new Error(`Ticket not found: ${argv.id}`);
    }

    const ticket = tickets[0];
    const updates: Record<string, unknown> = {};

    if (argv.status) {
      updates.status_id = await deps.resolveStatusId(API_URL, projectId, argv.status);
    }

    if (argv.tag) {
      updates.tag_ids = await deps.resolveTagIds(API_URL, projectId, argv.tag);
    }

    await deps.updateTicket(API_URL, ticket.id, updates);

    deps.log(`Updated ticket ${argv.id}`);
  };

export const handler = createHandler();
