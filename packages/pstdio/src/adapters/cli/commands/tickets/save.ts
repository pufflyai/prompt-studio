import type { Arguments, Argv } from "yargs";
import { API_URL } from "@/features/api-url";
import { findGitRoot, readConfig } from "@/features/config/config";
import { listTicketTags as defaultListTicketTags } from "@/features/tickets/api/list-ticket-tags";
import { listTickets as defaultListTickets } from "@/features/tickets/api/list-tickets";
import { updateTicket as defaultUpdateTicket } from "@/features/tickets/api/update-ticket";
import { readTicketFile } from "@/features/tickets/local-ticket";

export const command = "save";
export const describe = "Push local ticket file to the database";

export const builder = (yargs: Argv) =>
  yargs
    .option("id", { type: "string", demandOption: true, describe: "Ticket shorthand (e.g. PS-12)" })
    .option("tag", { type: "array", string: true, describe: "Tags to assign" });

type SaveArgs = {
  id: string;
  tag?: string[];
};

type Deps = {
  cwd: () => string;
  findGitRoot: typeof findGitRoot;
  readConfig: typeof readConfig;
  listTickets: typeof defaultListTickets;
  updateTicket: typeof defaultUpdateTicket;
  listTicketTags: typeof defaultListTicketTags;
  log: (msg: string) => void;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  findGitRoot,
  readConfig,
  listTickets: defaultListTickets,
  updateTicket: defaultUpdateTicket,
  listTicketTags: defaultListTicketTags,
  log: console.log,
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<SaveArgs>) => {
    const root = deps.findGitRoot(deps.cwd());
    if (!root) throw new Error("Not inside a pstdio project. Run 'pstdio projects create' first.");

    const config = deps.readConfig(root);
    if (!config) throw new Error("Not inside a pstdio project. Run 'pstdio projects create' first.");

    const projectId = config.project_id;

    const content = readTicketFile(root, argv.id);
    if (content === null) {
      throw new Error(`Local ticket not found: .pstdio/tickets/${argv.id}/ticket.md`);
    }

    const tickets = await deps.listTickets(API_URL, {
      project_id: projectId,
      shorthand: argv.id,
      draft: true,
    });
    if (tickets.length === 0) {
      throw new Error(`Ticket not found: ${argv.id}`);
    }

    const ticket = tickets[0];

    let tagIds: string[] | undefined;
    if (argv.tag && argv.tag.length > 0) {
      const allTags = await deps.listTicketTags(API_URL, projectId);
      tagIds = [];
      for (const name of argv.tag) {
        const found = allTags.find((t) => t.name === name);
        if (!found) throw new Error(`Tag not found: ${name}`);
        tagIds.push(found.id);
      }
    }

    await deps.updateTicket(API_URL, ticket.id, {
      input: content,
      draft: false,
      tag_ids: tagIds,
    });

    deps.log(`Pushed ticket ${argv.id}`);
  };

export const handler = createHandler();
