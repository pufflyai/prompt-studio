import { defineCommand, l10n, params } from "@pstdio/sdk/extensions";
import { readTicketStatuses } from "../data/status-operations";
import { updateTicketCommand } from "./update-ticket";

export const keyboardStatusOptions = defineCommand({
  id: "keyboard-status.options",
  title: l10n("commands.keyboardStatusOptions", "List ticket status choices"),
  run: async (ctx) => (await readTicketStatuses(ctx.storage)).statuses,
});
export const changeKeyboardStatus = defineCommand({
  id: "keyboard-status.change",
  title: l10n("commands.keyboardStatus", "Change ticket status"),
  mutating: true,
  params: {
    resource: params.resource({ resourceType: "ticket", required: true, resolvedFrom: "resource" }),
    statusId: params.select({
      label: l10n("params.keyboardStatus", "Status"),
      required: true,
      options: { command: keyboardStatusOptions.ref, valueField: "id", labelField: "name" },
    }),
  },
  run: (ctx, input) => updateTicketCommand.run(ctx, { id: input.resource.id, statusId: input.statusId }),
});
