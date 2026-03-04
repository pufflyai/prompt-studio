import type { Arguments, Argv } from "yargs";
import { API_URL } from "@/features/api-url";
import { findGitRoot, readConfig } from "@/features/config/config";
import { listTicketStatuses as defaultListTicketStatuses } from "@/features/tickets/api/list-ticket-statuses";
import { listTicketTags as defaultListTicketTags } from "@/features/tickets/api/list-ticket-tags";
import { listTickets as defaultListTickets } from "@/features/tickets/api/list-tickets";
import { updateTicket as defaultUpdateTicket } from "@/features/tickets/api/update-ticket";

export const command = "update";
export const describe = "Update ticket status or tags";

export const builder = (yargs: Argv) =>
  yargs
    .option("id", { type: "string", demandOption: true, describe: "Ticket shorthand" })
    .option("status", { type: "string", describe: "New status name" })
    .option("tag", { type: "array", string: true, describe: "Replace tags" });

type UpdateArgs = {
  id: string;
  status?: string;
  tag?: string[];
};

type Deps = {
  cwd: () => string;
  findGitRoot: typeof findGitRoot;
  readConfig: typeof readConfig;
  listTickets: typeof defaultListTickets;
  updateTicket: typeof defaultUpdateTicket;
  listTicketStatuses: typeof defaultListTicketStatuses;
  listTicketTags: typeof defaultListTicketTags;
  log: (msg: string) => void;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  findGitRoot,
  readConfig,
  listTickets: defaultListTickets,
  updateTicket: defaultUpdateTicket,
  listTicketStatuses: defaultListTicketStatuses,
  listTicketTags: defaultListTicketTags,
  log: console.log,
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<UpdateArgs>) => {
    const root = deps.findGitRoot(deps.cwd());
    if (!root) throw new Error("Not inside a pstdio project. Run 'pstdio projects create' first.");

    const config = deps.readConfig(root);
    if (!config) throw new Error("Not inside a pstdio project. Run 'pstdio projects create' first.");

    const projectId = config.project_id;

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
      const statuses = await deps.listTicketStatuses(API_URL, projectId);
      const found = statuses.find((s) => s.name === argv.status);
      if (!found) throw new Error(`Status not found: ${argv.status}`);
      updates.status_id = found.id;
    }

    if (argv.tag) {
      const allTags = await deps.listTicketTags(API_URL, projectId);
      const tagIds: string[] = [];
      for (const name of argv.tag) {
        const found = allTags.find((t) => t.name === name);
        if (!found) throw new Error(`Tag not found: ${name}`);
        tagIds.push(found.id);
      }
      updates.tag_ids = tagIds;
    }

    await deps.updateTicket(API_URL, ticket.id, updates);

    deps.log(`Updated ticket ${argv.id}`);
  };

export const handler = createHandler();
