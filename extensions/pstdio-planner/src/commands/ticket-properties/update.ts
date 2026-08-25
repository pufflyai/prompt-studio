import { defineCommand, type ExtensionContextBase, params, type ResourceRef } from "@pstdio/sdk/extensions";
import { plannerTicketsChanged } from "../../events";
import { applyTicketAttribute } from "../set-ticket-attribute";

export const updateTicketProperty = async (
  ctx: Pick<ExtensionContextBase, "events" | "storage">,
  resource: ResourceRef | undefined,
  input: { controlId: string; value?: unknown },
) => {
  const rowId = resource?.type === "ticket" ? resource.id : undefined;
  if (!rowId) return null;
  const value =
    typeof input.value === "string" ||
    (Array.isArray(input.value) && input.value.every((item) => typeof item === "string"))
      ? input.value
      : undefined;

  const ticket = await applyTicketAttribute({
    storage: ctx.storage,
    rowId,
    attributeId: input.controlId,
    value,
  });
  if (ticket) await ctx.events.emit(plannerTicketsChanged, { ticketId: ticket.id });
  return ticket;
};

// Persists an edit from the ticket properties panel. The control id doubles as the
// attribute id (status / tag), so this delegates to the shared attribute mutation.
export const ticketPropertiesUpdateCommand = defineCommand({
  title: "Update ticket property",
  params: {
    controlId: params.text({ required: true }),
    value: params.json<string | string[]>(),
    values: params.json<Record<string, unknown>>(),
  },
  async run(ctx, commandParams) {
    return updateTicketProperty(ctx, ctx.resource, commandParams);
  },
});
