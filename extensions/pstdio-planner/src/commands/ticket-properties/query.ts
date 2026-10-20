import {
  defineCommand,
  type ExtensionContextBase,
  type ExtensionStorageApi,
  type ResourceRef,
} from "@pstdio/sdk/extensions";
import { migratePlannerStorage } from "../../data/migrate-storage";
import { findTicket } from "../../data/resolve";
import { readTicketStatuses } from "../../data/status-operations";
import { readTicketTags } from "../../data/tag-operations";
import { normalizeTicketDependencies } from "../../data/ticket-dependencies";
import type { TicketContext } from "../../data/ticket-identity";
import { readStoredPlan } from "../../timeline/commands/plan-store";
import { buildTicketPropertiesControls, type TicketRef } from "./params";

// Resolve a dependency/parent reference to the real ticket id (so its chip opens the
// right tab) plus its shorthand for display; a deleted ticket falls back to the raw value.
const resolveTicketRef = async (ctx: TicketContext, value: string): Promise<TicketRef> => {
  const ticket = await findTicket(ctx, value);
  return { id: ticket?.id ?? value, label: ticket?.shorthand ?? value };
};

export const queryTicketProperties = async (
  ctx: Pick<ExtensionContextBase, "storage" | "files" | "resources">,
  resource: ResourceRef | undefined,
) => {
  const ticketId = resource?.type === "ticket" ? resource.id : undefined;
  if (!ticketId) return {};

  await migratePlannerStorage(ctx);
  const ticket = await findTicket(ctx, ticketId);
  if (!ticket) return {};

  const [{ statuses }, { tags }, plan] = await Promise.all([
    readTicketStatuses(ctx.storage),
    readTicketTags(ctx.storage),
    readStoredPlan(ctx.storage),
  ]);

  const dependencies = await Promise.all(
    normalizeTicketDependencies(ticket.dependsOn).map((value) => resolveTicketRef(ctx, value)),
  );
  const parent = ticket.parentId ? await resolveTicketRef(ctx, ticket.parentId) : null;

  return buildTicketPropertiesControls({
    ticket,
    statuses,
    tags,
    dependencies,
    parent,
    plan: plan ?? { deadlines: [], order: [] },
  });
};

// Loads the control declarations for the ticket properties panel. Returns an empty
// result (empty state) when no ticket resource is open.
export const ticketPropertiesQueryCommand = defineCommand({
  id: "ticket-properties.query",
  title: "Query ticket properties",
  async run(ctx, _commandParams) {
    return queryTicketProperties(ctx, ctx.resource);
  },
});
