import { defineCommand, params } from "@pstdio/sdk/extensions";
import { applyTicketAttribute } from "../set-ticket-attribute";

// Persists an edit from the ticket properties panel. The control id doubles as the
// attribute id (status / tag), so this delegates to the shared attribute mutation.
export const ticketPropertiesUpdateCommand = defineCommand({
  title: "Update ticket property",
  params: {
    controlId: params.text({ required: true }),
    value: params.json<string | string[]>(),
    values: params.json<Record<string, unknown>>(),
  },
  async run(ctx) {
    const rowId = ctx.resource?.type === "ticket" ? ctx.resource.id : undefined;
    if (!rowId) return null;

    return applyTicketAttribute({
      storage: ctx.storage,
      rowId,
      attributeId: ctx.params.controlId,
      value: ctx.params.value,
    });
  },
});
