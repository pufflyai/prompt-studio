import { defineCommand, type ExtensionContextBase, type ResourceRef } from "@pstdio/sdk/extensions";
import { migratePlannerStorage } from "../../data/migrate-storage";
import { findTicket } from "../../data/resolve";
import { readTicketStatuses } from "../../data/status-operations";
import { readTicketTags } from "../../data/tag-operations";
import { readStoredPlan } from "../../timeline/commands/plan-store";
import { buildTicketPropertiesControls } from "./params";

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

  return buildTicketPropertiesControls({
    ticket,
    statuses,
    tags,
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
