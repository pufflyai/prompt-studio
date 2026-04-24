import type { Arguments, Argv } from "yargs";
import { resolveProjectId as defaultResolveProjectId } from "@/features/projects/resolve-project-id";
import { updateTicket as defaultUpdateTicket } from "@/features/tickets/api/update-ticket";
import { resolveStatusId as defaultResolveStatusId } from "@/features/tickets/resolve-status-id";
import { resolveTagIds as defaultResolveTagIds } from "@/features/tickets/resolve-tag-ids";
import { resolveTicketByShorthand as defaultResolveTicketByShorthand } from "@/features/tickets/resolve-ticket-by-shorthand";

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
  resolveTicketByShorthand: typeof defaultResolveTicketByShorthand;
  updateTicket: typeof defaultUpdateTicket;
  resolveStatusId: typeof defaultResolveStatusId;
  resolveTagIds: typeof defaultResolveTagIds;
  log: (msg: string) => void;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  resolveProjectId: defaultResolveProjectId,
  resolveTicketByShorthand: defaultResolveTicketByShorthand,
  updateTicket: defaultUpdateTicket,
  resolveStatusId: defaultResolveStatusId,
  resolveTagIds: defaultResolveTagIds,
  log: console.log,
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<UpdateArgs>) => {
    const { projectId } = deps.resolveProjectId(deps.cwd(), argv["project-id"]);

    const ticket = await deps.resolveTicketByShorthand(projectId, argv.id);
    if (!ticket) throw new Error(`Ticket not found: ${argv.id}`);

    const updates: Record<string, unknown> = {};

    if (argv.status) {
      updates.status_id = await deps.resolveStatusId(projectId, argv.status);
    }

    if (argv.tag) {
      updates.tag_ids = await deps.resolveTagIds(projectId, argv.tag);
    }

    await deps.updateTicket(ticket.id, updates);

    deps.log(`Updated ticket ${argv.id}`);
  };

export const handler = createHandler();
