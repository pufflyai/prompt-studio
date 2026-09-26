import type { SSEStreamingApi } from "hono/streaming";
import type { JsonPatch, SessionMessage } from "pstdio-api-contracts";
import type { SessionsRouteDeps } from "../deps";
import { getQueuedSessionMessages } from "../queued-session-messages";

// Queue positions are authoritative. Matching prompt text would retire the wrong
// occurrence when a user queues the same prompt more than once.
export const createStreamQueuePublisher = (id: string, deps: SessionsRouteDeps, stream: SSEStreamingApi) => {
  let userIds = new Set<string>();
  const publish = async () => {
    let data: { messages: SessionMessage[] } | { error: string };
    try {
      const session = await deps.sessionService.get(id);
      data = { messages: session?.project_id ? await getQueuedSessionMessages(deps, session.project_id, id) : [] };
    } catch {
      data = { error: "Could not refresh queued messages" };
    }
    await stream.writeSSE({ event: "queued_messages", data: JSON.stringify(data) });
  };
  return {
    async snapshot(messages: SessionMessage[]) {
      userIds = new Set(messages.filter((message) => message.role === "user").map((message) => message.id));
      await publish();
    },
    async beforePatch(patch: JsonPatch) {
      let users: SessionMessage[] = [];
      if (patch.path === "/messages" && Array.isArray(patch.value)) users = patch.value;
      else if (/^\/messages\/\d+$/.test(patch.path) && patch.op !== "remove") users = [patch.value as SessionMessage];
      users = users.filter((message) => message.role === "user");
      const added = users.some((message) => !userIds.has(message.id));
      if (patch.path === "/messages") userIds = new Set();
      for (const message of users) userIds.add(message.id);
      if (added) await publish();
    },
  };
};
