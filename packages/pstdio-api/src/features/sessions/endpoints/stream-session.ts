import { readFileSync } from "node:fs";
import type { Context } from "hono";
import type { SSEStreamingApi } from "hono/streaming";
import { streamSSE } from "hono/streaming";
import type { EventStore } from "pstdio-agents";
import type { AppBindings } from "../../../types";
import type { RouteDeps } from "../../deps";

const replayPersistedMessages = async (sessionFileId: string, deps: RouteDeps, stream: SSEStreamingApi) => {
  const file = await deps.filesService.get(sessionFileId);
  if (!file) return;

  const messages = JSON.parse(readFileSync(file.storage_path, "utf-8"));
  const patch = { op: "replace" as const, path: "/messages", value: messages };
  await stream.writeSSE({ data: JSON.stringify(patch), event: "patch" });
};

const streamLivePatches = async (eventStore: EventStore, stream: SSEStreamingApi) => {
  let aborted = false;
  stream.onAbort(() => {
    aborted = true;
  });

  for await (const patch of eventStore.historyPlusStream()) {
    if (aborted) break;

    if (patch.path === "/approval_request") {
      await stream.writeSSE({ data: JSON.stringify(patch.value), event: "approval_request" });
    } else {
      await stream.writeSSE({ data: JSON.stringify(patch), event: "patch" });
    }
  }

  return aborted;
};

export const streamSessionHandler = (deps: RouteDeps) => {
  return (c: Context<AppBindings>) => {
    const id = c.req.param("id")!;

    return streamSSE(c, async (stream) => {
      const entry = deps.sessionStore.get(id);

      await stream.writeSSE({ data: JSON.stringify({ sessionId: id }), event: "ready" });

      if (!entry) {
        const session = await deps.sessionsService.get(id);

        if (session?.session_file_id) {
          await replayPersistedMessages(session.session_file_id, deps, stream);
        }

        const status = session?.status ?? "unknown";
        await stream.writeSSE({ data: JSON.stringify({ status }), event: "end" });
        return;
      }

      const aborted = await streamLivePatches(entry.eventStore, stream);

      if (!aborted) {
        const session = await deps.sessionsService.get(id);
        const status = session?.status ?? "completed";
        await stream.writeSSE({ data: JSON.stringify({ status }), event: "end" });
      }
    });
  };
};
