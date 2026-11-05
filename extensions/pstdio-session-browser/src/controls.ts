import type { ChatRendererSnapshot } from "@pstdio/sdk/extensions";
export const composerControls: NonNullable<ChatRendererSnapshot["controls"]> = [
  { id: "harness", name: "Harness", type: "harness", settingsMode: "resolved", defaultValue: { harnessId: "" } },
];
