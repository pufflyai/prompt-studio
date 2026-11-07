import type { ChatRendererSnapshot } from "@pstdio/sdk/extensions";
export const composerControls: NonNullable<ChatRendererSnapshot["controls"]> = [
  { id: "harness", name: "Harness", type: "harness", settingsMode: "resolved", defaultValue: { harnessId: "" } },
];

export const connectionRefresh = { id: "connection", label: "Check connection", refresh: true };
export const conversationOperations = (remote: boolean, queueReadOnly: boolean) => [
  ...(remote ? [connectionRefresh] : []),
  ...(queueReadOnly ? [{ id: "refresh-queue", label: "Refresh queue" }] : []),
];
