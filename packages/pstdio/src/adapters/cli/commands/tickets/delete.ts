import type { Arguments, Argv } from "yargs";
import { API_URL } from "@/features/api-url";
import { resolveProjectId as defaultResolveProjectId } from "@/features/projects/resolve-project-id";
import { deleteTicket as defaultDeleteTicket } from "@/features/tickets/api/delete-ticket";
import { removeTicketDir as defaultRemoveTicketDir } from "@/features/tickets/local-ticket";
import { resolveTicketByShorthand as defaultResolveTicketByShorthand } from "@/features/tickets/resolve-ticket-by-shorthand";

export const command = "delete";
export const describe = "Delete a ticket";

export const builder = (yargs: Argv) =>
  yargs
    .option("id", { type: "string", demandOption: true, describe: "Ticket shorthand" })
    .option("project-id", { type: "string", describe: "Project ID" });

type DeleteArgs = {
  id: string;
  "project-id"?: string;
};

type Deps = {
  cwd: () => string;
  resolveProjectId: typeof defaultResolveProjectId;
  resolveTicketByShorthand: typeof defaultResolveTicketByShorthand;
  deleteTicket: typeof defaultDeleteTicket;
  removeTicketDir: typeof defaultRemoveTicketDir;
  log: (msg: string) => void;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  resolveProjectId: defaultResolveProjectId,
  resolveTicketByShorthand: defaultResolveTicketByShorthand,
  deleteTicket: defaultDeleteTicket,
  removeTicketDir: defaultRemoveTicketDir,
  log: console.log,
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<DeleteArgs>) => {
    const { projectId, root } = deps.resolveProjectId(deps.cwd(), argv["project-id"]);

    const ticket = await deps.resolveTicketByShorthand(API_URL, projectId, argv.id);
    if (!ticket) throw new Error(`Ticket not found: ${argv.id}`);

    await deps.deleteTicket(API_URL, ticket.id);

    if (root) {
      deps.removeTicketDir(root, argv.id);
    }

    deps.log(`Deleted ticket ${argv.id}`);
  };

export const handler = createHandler();
