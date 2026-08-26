import { commandRef } from "@pstdio/sdk/extensions";

export const labAwakenCommand = commandRef<{ title?: string }, { awakened: boolean }>({
  extensionId: "pstdio.extension-lab",
  id: "awaken",
});

export const labHeartbeatCommand = commandRef({ extensionId: "pstdio.extension-lab", id: "heartbeat" });
