import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import type { AppBindings } from "../../../types";
import type { RouteDeps } from "../../deps";

export const streamSessionHandler = (deps: RouteDeps) => {
  return (c: Context<AppBindings>) => {
    const id = c.req.param("id");

    return streamSSE(c, async (stream) => {
      const entry = deps.sessionStore.get(id);

      await stream.writeSSE({ data: JSON.stringify({ sessionId: id }), event: "ready" });

      if (!entry) {
        // No active event store — session is not running
        const session = await deps.sessionsService.get(id);
        const status = session?.status ?? "unknown";
        await stream.writeSSE({ data: JSON.stringify({ status }), event: "end" });
        return;
      }

      let aborted = false;
      stream.onAbort(() => {
        aborted = true;
      });

      for await (const patch of entry.eventStore.historyPlusStream()) {
        if (aborted) break;

        if (patch.path === "/approval_request") {
          await stream.writeSSE({ data: JSON.stringify(patch.value), event: "approval_request" });
        } else {
          await stream.writeSSE({ data: JSON.stringify(patch), event: "patch" });
        }
      }

      if (!aborted) {
        const session = await deps.sessionsService.get(id);
        const status = session?.status ?? "completed";
        await stream.writeSSE({ data: JSON.stringify({ status }), event: "end" });
      }
    });
  };
};
