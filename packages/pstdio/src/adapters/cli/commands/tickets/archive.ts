import type { Arguments, Argv } from "yargs";
import { API_URL } from "@/features/api-url";
import { findGitRoot, readConfig } from "@/features/config/config";
import { listTickets as defaultListTickets } from "@/features/tickets/api/list-tickets";
import { updateTicket as defaultUpdateTicket } from "@/features/tickets/api/update-ticket";

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
  findGitRoot: typeof findGitRoot;
  readConfig: typeof readConfig;
  listTickets: typeof defaultListTickets;
  updateTicket: typeof defaultUpdateTicket;
  log: (msg: string) => void;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  findGitRoot,
  readConfig,
  listTickets: defaultListTickets,
  updateTicket: defaultUpdateTicket,
  log: console.log,
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<ArchiveArgs>) => {
    let projectId = argv["project-id"];

    if (!projectId) {
      const root = deps.findGitRoot(deps.cwd());
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

    const ticket = tickets[0];
    if (ticket.archived) {
      throw new Error(`Ticket already archived: ${argv.id}`);
    }

    await deps.updateTicket(API_URL, ticket.id, { archived: true });

    deps.log(`Archived ticket ${argv.id}`);
  };

export const handler = createHandler();
