import type { Arguments, Argv } from "yargs";
import { resolveProjectId as defaultResolveProjectId } from "@/features/projects/resolve-project-id";
import { updateTicket as defaultUpdateTicket } from "@/features/tickets/api/update-ticket";
import { resolveTicketByShorthand as defaultResolveTicketByShorthand } from "@/features/tickets/resolve-ticket-by-shorthand";

export const command = "archive";
export const describe = "Archive a ticket";

export const builder = (yargs: Argv) =>
  yargs
    .option("id", { type: "string", demandOption: true, describe: "Ticket shorthand" })
    .option("project-id", { type: "string", describe: "Project ID" });

type ArchiveArgs = {
  id: string;
  "project-id"?: string;
};

type Deps = {
  cwd: () => string;
  resolveProjectId: typeof defaultResolveProjectId;
  resolveTicketByShorthand: typeof defaultResolveTicketByShorthand;
  updateTicket: typeof defaultUpdateTicket;
  log: (msg: string) => void;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  resolveProjectId: defaultResolveProjectId,
  resolveTicketByShorthand: defaultResolveTicketByShorthand,
  updateTicket: defaultUpdateTicket,
  log: console.log,
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<ArchiveArgs>) => {
    const { projectId } = deps.resolveProjectId(deps.cwd(), argv["project-id"]);

    const ticket = await deps.resolveTicketByShorthand(projectId, argv.id);
    if (!ticket) throw new Error(`Ticket not found: ${argv.id}`);

    if (ticket.archived) {
      throw new Error(`Ticket already archived: ${argv.id}`);
    }

    await deps.updateTicket(ticket.id, { archived: true });

    deps.log(`Archived ticket ${argv.id}`);
  };

export const handler = createHandler();
