import { defineCommand, l10n, params, sessionSlots } from "@pstdio/sdk/extensions";

export const copySessionId = defineCommand({
  id: "copy-id",
  title: l10n("commands.copyId", "Copy session ID"),
  cli: true,
  copyResultToClipboard: true,
  menus: [{ slot: sessionSlots.headerOverflow, group: "session", icon: "copy" }],
  params: { sessionId: params.text({ required: true, resolvedFrom: "resource" }) },
  run: (_ctx, input) => input.sessionId,
});
