import type { Arguments, Argv } from "yargs";
import { resolveProjectId as defaultResolveProjectId } from "@/features/projects/resolve-project-id";
import { getTicket as defaultGetTicket } from "@/features/tickets/api/get-ticket";
import { resolveTicketByShorthand as defaultResolveTicketByShorthand } from "@/features/tickets/resolve-ticket-by-shorthand";

export const command = "view [field]";
export const describe = "View ticket details, or a single field (status, title, tags, shorthand)";

export const builder = (yargs: Argv) =>
  yargs
    .positional("field", { type: "string", describe: "Single field to output (status, title, tags, shorthand)" })
    .option("id", { type: "string", demandOption: true, describe: "Ticket shorthand (e.g. PS-12)" })
    .option("project-id", { type: "string", describe: "Project ID" });

type ViewArgs = {
  id: string;
  field?: string;
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

type FieldResolver = (
  ticket: NonNullable<Awaited<ReturnType<Deps["getTicket"]>>>,
  listItem: NonNullable<Awaited<ReturnType<Deps["resolveTicketByShorthand"]>>>,
) => string | null;

const FIELD_RESOLVERS: Record<string, FieldResolver> = {
  shorthand: (ticket) => ticket.shorthand,
  title: (ticket) => ticket.display_title,
  status: (_ticket, listItem) => listItem.status_name,
  tags: (_ticket, listItem) => (listItem.tag_names.length > 0 ? listItem.tag_names.join(", ") : null),
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<ViewArgs>) => {
    const { projectId } = deps.resolveProjectId(deps.cwd(), argv["project-id"]);

    const listItem = await deps.resolveTicketByShorthand(projectId, argv.id);
    if (!listItem) throw new Error(`Ticket not found: ${argv.id}`);

    const ticket = await deps.getTicket(listItem.id);
    if (!ticket) throw new Error(`Ticket not found: ${argv.id}`);

    if (argv.field) {
      const resolver = FIELD_RESOLVERS[argv.field];
      if (!resolver)
        throw new Error(`Unknown field: ${argv.field}. Valid fields: ${Object.keys(FIELD_RESOLVERS).join(", ")}`);
      deps.log(resolver(ticket, listItem) ?? "");
      return;
    }

    deps.log(formatField("Shorthand", ticket.shorthand));
    deps.log(formatField("Title", ticket.display_title));
    deps.log(formatField("Status", listItem.status_name));
    deps.log(formatField("Tags", listItem.tag_names.length > 0 ? listItem.tag_names.join(", ") : null));
    deps.log(formatField("Created", ticket.created_at));
    deps.log(formatField("Updated", ticket.updated_at));
  };

export const handler = createHandler();
