import { accountEvents, eventRef, gitEvents, workspaceEvents } from "@pstdio/sdk/extensions";
export const changed = eventRef({ extensionId: "pstdio.workspaces", id: "changed" });
export const refreshEvents = [
  changed,
  "pstdio.view.workspaces.changed",
  "pstdio.view.sessions.changed",
  "pstdio.view.resources.changed",
  accountEvents.changed,
  workspaceEvents.ready,
  gitEvents.committed,
] as const;
