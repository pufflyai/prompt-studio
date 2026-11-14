import { accountEvents, eventRef, gitEvents, viewDataEvents, workspaceEvents } from "@pstdio/sdk/extensions";
export const changed = eventRef({ extensionId: "pstdio.pstdio-workspaces", id: "changed" });
export const refreshEvents = [
  changed,
  viewDataEvents.workspacesChanged,
  viewDataEvents.sessionsChanged,
  viewDataEvents.resourcesChanged,
  accountEvents.changed,
  workspaceEvents.ready,
  gitEvents.committed,
] as const;
