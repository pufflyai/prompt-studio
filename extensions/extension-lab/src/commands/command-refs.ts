import { commandRef } from "@pstdio/sdk/extensions";

export const labAwakenCommand = commandRef<{ title?: string }, { awakened: boolean }>("extension-lab.awaken");

export const labHeartbeatCommand = commandRef("extension-lab.heartbeat");
