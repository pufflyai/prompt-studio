import { defineCommand, l10n, params, sessionSlots } from "@pstdio/sdk/extensions";
import { sessionNickname } from "./session-nickname";

export const copySessionNickname = defineCommand({
  id: "copy-nickname",
  title: l10n("commands.copyNickname", "Copy session nickname"),
  cli: true,
  copyResultToClipboard: true,
  menus: [{ slot: sessionSlots.headerOverflow, group: "session", icon: "copy" }],
  params: { sessionId: params.text({ required: true, resolvedFrom: "resource" }) },
  run: (_ctx, input) => sessionNickname(input.sessionId),
});
