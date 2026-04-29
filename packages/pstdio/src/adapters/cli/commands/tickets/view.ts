import type { Arguments, Argv } from "yargs";
import { resolveProjectId as defaultResolveProjectId } from "@/features/projects/resolve-project-id";
import { getTicket as defaultGetTicket } from "@/features/tickets/api/get-ticket";
import { listTickets as defaultListTickets } from "@/features/tickets/api/list-tickets";
import { resolveTicketByShorthand as defaultResolveTicketByShorthand } from "@/features/tickets/resolve-ticket-by-shorthand";

export const command = "view [field]";
export const describe =
  "View ticket details, or a single field (status, title, tags, shorthand, parent-ticket, sub-tickets)";

export const builder = (yargs: Argv) =>
  yargs
    .positional("field", {
      type: "string",
      describe: "Single field to output (status, title, tags, shorthand, parent-ticket, sub-tickets)",
    })
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
  listTickets: typeof defaultListTickets;
  log: (msg: string) => void;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  resolveProjectId: defaultResolveProjectId,
  resolveTicketByShorthand: defaultResolveTicketByShorthand,
  getTicket: defaultGetTicket,
  listTickets: defaultListTickets,
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

const FIELD_NAMES = ["shorthand", "title", "status", "tags", "parent-ticket", "sub-tickets"];

const compareTicketShorthand = (left: string, right: string) =>
  left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });

const resolveParentTicketField = async (
  deps: Deps,
  projectId: string,
  ticket: NonNullable<Awaited<ReturnType<Deps["getTicket"]>>>,
) => {
  if (!ticket.parent_id) return null;

  const parentTicket = await deps.getTicket(ticket.parent_id);
  if (parentTicket) return parentTicket.shorthand;

  const parentListItem = await deps.resolveTicketByShorthand(projectId, ticket.parent_id);
  return parentListItem?.shorthand ?? null;
};

const resolveSubTicketsField = async (
  deps: Deps,
  projectId: string,
  ticket: NonNullable<Awaited<ReturnType<Deps["getTicket"]>>>,
) => {
  const childGroups = await Promise.all(
    [ticket.id, ticket.shorthand].flatMap((parentId) =>
      [false, true].map((draft) => deps.listTickets({ project_id: projectId, parent_id: parentId, draft })),
    ),
  );
  const children = [...new Map(childGroups.flat().map((child) => [child.id, child])).values()];
  if (children.length === 0) return null;
  return children
    .map((child) => child.shorthand)
    .sort(compareTicketShorthand)
    .join(", ");
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
      if (resolver) {
        deps.log(resolver(ticket, listItem) ?? "");
        return;
      }

      if (argv.field === "parent-ticket") {
        deps.log((await resolveParentTicketField(deps, projectId, ticket)) ?? "");
        return;
      }

      if (argv.field === "sub-tickets") {
        deps.log((await resolveSubTicketsField(deps, projectId, ticket)) ?? "");
        return;
      }

      throw new Error(`Unknown field: ${argv.field}. Valid fields: ${FIELD_NAMES.join(", ")}`);
    }

    deps.log(formatField("Shorthand", ticket.shorthand));
    deps.log(formatField("Title", ticket.display_title));
    deps.log(formatField("Status", listItem.status_name));
    deps.log(formatField("Tags", listItem.tag_names.length > 0 ? listItem.tag_names.join(", ") : null));
    deps.log(formatField("Created", ticket.created_at));
    deps.log(formatField("Updated", ticket.updated_at));
  };

export const handler = createHandler();
