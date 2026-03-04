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

const resolveProjectId = (deps: Deps, explicitId?: string) => {
  if (explicitId) return explicitId;

  const root = deps.findGitRoot(deps.cwd());
  if (!root) throw new Error("No project specified. Provide --project-id or run inside a linked project.");
  const config = deps.readConfig(root);
  if (!config) throw new Error("No project specified. Provide --project-id or run inside a linked project.");
  return config.project_id;
};

const resolveStatusId = async (deps: Deps, projectId: string, statusName: string) => {
  const statuses = await deps.listTicketStatuses(API_URL, projectId);
  const found = statuses.find((s) => s.name === statusName);
  if (!found) throw new Error(`Status not found: ${statusName}`);
  return found.id;
};

const resolveTagIds = async (deps: Deps, projectId: string, tagNames: string[]) => {
  const allTags = await deps.listTicketTags(API_URL, projectId);
  return tagNames.map((name) => {
    const found = allTags.find((t) => t.name === name);
    if (!found) throw new Error(`Tag not found: ${name}`);
    return found.id;
  });
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<UpdateArgs>) => {
    const projectId = resolveProjectId(deps, argv["project-id"]);

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
      updates.status_id = await resolveStatusId(deps, projectId, argv.status);
    }

    if (argv.tag) {
      updates.tag_ids = await resolveTagIds(deps, projectId, argv.tag);
    }

    await deps.updateTicket(API_URL, ticket.id, updates);

    deps.log(`Updated ticket ${argv.id}`);
  };

export const handler = createHandler();
