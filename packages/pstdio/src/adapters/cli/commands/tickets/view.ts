import type { Arguments, Argv } from "yargs";
import { API_URL } from "@/features/api-url";
import { resolveProjectId as defaultResolveProjectId } from "@/features/projects/resolve-project-id";
import { getTicket as defaultGetTicket } from "@/features/tickets/api/get-ticket";
import { resolveTicketByShorthand as defaultResolveTicketByShorthand } from "@/features/tickets/resolve-ticket-by-shorthand";

export const command = "view";
export const describe = "View ticket details";

export const builder = (yargs: Argv) =>
  yargs
    .option("id", { type: "string", demandOption: true, describe: "Ticket shorthand (e.g. PS-12)" })
    .option("project-id", { type: "string", describe: "Project ID" });

type ViewArgs = {
  id: string;
  "project-id"?: string;
};

type Deps = {
  cwd: () => string;
  resolveProjectId: typeof defaultResolveProjectId;
  resolveTicketByShorthand: typeof defaultResolveTicketByShorthand;
  getTicket: typeof defaultGetTicket;
  log: (msg: string) => void;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  resolveProjectId: defaultResolveProjectId,
  resolveTicketByShorthand: defaultResolveTicketByShorthand,
  getTicket: defaultGetTicket,
  log: console.log,
};

const formatField = (label: string, value: string | null, width = 13) => `${`${label}:`.padEnd(width)}${value ?? "-"}`;

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<ViewArgs>) => {
    const { projectId } = deps.resolveProjectId(deps.cwd(), argv["project-id"]);

    const listItem = await deps.resolveTicketByShorthand(API_URL, projectId, argv.id);
    if (!listItem) throw new Error(`Ticket not found: ${argv.id}`);

    const ticket = await deps.getTicket(API_URL, listItem.id);
    if (!ticket) throw new Error(`Ticket not found: ${argv.id}`);

    deps.log(formatField("Shorthand", ticket.shorthand));
    deps.log(formatField("Title", ticket.display_title));
    deps.log(formatField("Status", listItem.status_name));
    deps.log(formatField("Tags", listItem.tag_names.length > 0 ? listItem.tag_names.join(", ") : null));
    deps.log(formatField("Priority", ticket.priority));
    deps.log(formatField("Complexity", ticket.complexity));
    deps.log(formatField("Created", ticket.created_at));
    deps.log(formatField("Updated", ticket.updated_at));
  };

export const handler = createHandler();
