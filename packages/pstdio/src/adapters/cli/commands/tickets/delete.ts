import type { Arguments, Argv } from "yargs";
import { API_URL } from "@/features/api-url";
import { findGitRoot, readConfig } from "@/features/config/config";
import { deleteTicket as defaultDeleteTicket } from "@/features/tickets/api/delete-ticket";
import { listTickets as defaultListTickets } from "@/features/tickets/api/list-tickets";
import { removeTicketDir as defaultRemoveTicketDir } from "@/features/tickets/local-ticket";

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
  findGitRoot: typeof findGitRoot;
  readConfig: typeof readConfig;
  listTickets: typeof defaultListTickets;
  deleteTicket: typeof defaultDeleteTicket;
  removeTicketDir: typeof defaultRemoveTicketDir;
  log: (msg: string) => void;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  findGitRoot,
  readConfig,
  listTickets: defaultListTickets,
  deleteTicket: defaultDeleteTicket,
  removeTicketDir: defaultRemoveTicketDir,
  log: console.log,
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<DeleteArgs>) => {
    let projectId = argv["project-id"];
    let root: string | null = null;

    if (!projectId) {
      root = deps.findGitRoot(deps.cwd());
      if (!root) throw new Error("No project specified. Provide --project-id or run inside a linked project.");
      const config = deps.readConfig(root);
      if (!config) throw new Error("No project specified. Provide --project-id or run inside a linked project.");
      projectId = config.project_id;
    }

    const tickets = await deps.listTickets(API_URL, {
      project_id: projectId,
      shorthand: argv.id,
    });
    if (tickets.length === 0) {
      throw new Error(`Ticket not found: ${argv.id}`);
    }

    await deps.deleteTicket(API_URL, tickets[0].id);

    if (root) {
      deps.removeTicketDir(root, argv.id);
    }

    deps.log(`Deleted ticket ${argv.id}`);
  };

export const handler = createHandler();
