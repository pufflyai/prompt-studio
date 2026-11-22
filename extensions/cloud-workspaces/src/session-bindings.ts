import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { instanceDirectory, serializeState, writeJson } from "./local-state";

export function createSessionBindings(root: string) {
  return {
    bindSession(sessionId: string, instanceId: string, machineId: string, conversationId?: string) {
      instanceDirectory(root, sessionId);
      instanceDirectory(root, instanceId);
      instanceDirectory(root, machineId);
      const path = join(root, `${sessionId}.json`);
      return serializeState(path, async () => {
        if (!conversationId) {
          try {
            const saved = JSON.parse(await readFile(path, "utf8"));
            if (saved.instanceId === instanceId && saved.machineId === machineId) conversationId = saved.conversationId;
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
          }
        }
        await writeJson(path, { instanceId, machineId, ...(conversationId ? { conversationId } : {}) });
      });
    },
    async sessionTarget(sessionId: string) {
      instanceDirectory(root, sessionId);
      return JSON.parse(await readFile(join(root, `${sessionId}.json`), "utf8")) as {
        instanceId: string;
        machineId: string;
        conversationId?: string;
      };
    },
  };
}
