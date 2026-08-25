import {
  defineCommand,
  type ExtensionContextBase,
  type ExtensionStorageApi,
  type ResourceRef,
} from "@pstdio/sdk/extensions";
import { findTicket } from "../../data/resolve";
import { readTicketStatuses } from "../../data/status-operations";
import { readTicketTags } from "../../data/tag-operations";
import { normalizeTicketDependencies } from "../../data/ticket-dependencies";
import { buildTicketPropertiesControls, type TicketRef } from "./params";

// Resolve a dependency/parent reference to the real ticket id (so its chip opens the
// right tab) plus its shorthand for display; a deleted ticket falls back to the raw value.
const resolveTicketRef = async (storage: ExtensionStorageApi, value: string): Promise<TicketRef> => {
  const ticket = await findTicket(storage, value);
  return { id: ticket?.id ?? value, label: ticket?.shorthand ?? value };
};

export const queryTicketProperties = async (
  ctx: Pick<ExtensionContextBase, "storage">,
  resource: ResourceRef | undefined,
) => {
  const ticketId = resource?.type === "ticket" ? resource.id : undefined;
  if (!ticketId) return {};

  const ticket = await findTicket(ctx.storage, ticketId);
  if (!ticket) return {};

  const [{ statuses }, { tags }] = await Promise.all([readTicketStatuses(ctx.storage), readTicketTags(ctx.storage)]);

  const dependencies = await Promise.all(
    normalizeTicketDependencies(ticket.dependsOn).map((value) => resolveTicketRef(ctx.storage, value)),
  );
  const parent = ticket.parentId ? await resolveTicketRef(ctx.storage, ticket.parentId) : null;

  return buildTicketPropertiesControls({ ticket, statuses, tags, dependencies, parent });
};

// Loads the control declarations for the ticket properties panel. Returns an empty
// result (empty state) when no ticket resource is open.
export const ticketPropertiesQueryCommand = defineCommand({
  title: "Query ticket properties",
  async run(ctx, _commandParams) {
    return queryTicketProperties(ctx, ctx.resource);
  },
});
