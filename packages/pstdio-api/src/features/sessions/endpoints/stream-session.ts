import { readFileSync } from "node:fs";
import type { Context } from "hono";
import type { SSEStreamingApi } from "hono/streaming";
import { streamSSE } from "hono/streaming";
import type { AgentId, EventStore, JsonPatch, SessionMessage } from "pstdio-agents";
import type { AppBindings } from "../../../types";
import type { RouteDeps } from "../../deps";
import { resolveSessionCwd } from "../resolve-session-cwd";

const SESSION_STREAM_HEARTBEAT_MS = 1000;

type SessionRecord = {
  id: string;
  agent: string;
  agent_session_id: string;
  project_id: string;
  session_file_id: string | null;
  status: string | null;
};

const replayMessagesAsPatch = async (messages: SessionMessage[], stream: SSEStreamingApi) => {
  const patch = { op: "replace" as const, path: "/messages", value: messages };
  await stream.writeSSE({ data: JSON.stringify(patch), event: "patch" });
};

const replayPersistedMessages = async (sessionFileId: string, deps: RouteDeps, stream: SSEStreamingApi) => {
  const file = await deps.filesService.get(sessionFileId);
  if (!file) return;

  const messages = JSON.parse(readFileSync(file.storage_path, "utf-8")) as SessionMessage[];
  await replayMessagesAsPatch(messages, stream);
};

const fetchAgentMessages = async (session: SessionRecord, deps: RouteDeps) => {
  const agent = deps.agentRegistry.get(session.agent as AgentId);
  if (!agent) return null;

  const workspace = await deps.workspacesService.getBySessionId(session.id);
  const cwd = await resolveSessionCwd(deps, session.project_id, workspace?.id);
  return agent.getMessages(session.agent_session_id, cwd ? { cwd } : undefined).catch(() => null);
};

const replayCompletedSession = async (session: SessionRecord, deps: RouteDeps, stream: SSEStreamingApi) => {
  if (session.session_file_id) {
    await replayPersistedMessages(session.session_file_id, deps, stream);
    return;
  }

  const messages = await fetchAgentMessages(session, deps);
  if (messages && messages.length > 0) {
    await replayMessagesAsPatch(messages, stream);
  }
};

const streamLivePatches = async (eventStore: EventStore, stream: SSEStreamingApi) => {
  let aborted = false;
  stream.onAbort(() => {
    aborted = true;
  });

  const iterator = eventStore.historyPlusStream()[Symbol.asyncIterator]();
  let nextPatchPromise: Promise<IteratorResult<JsonPatch>> | null = null;

  while (!aborted) {
    nextPatchPromise ??= iterator.next();

    const nextItem = await Promise.race([
      nextPatchPromise.then((patchResult) => ({ type: "patch" as const, patchResult })),
      stream.sleep(SESSION_STREAM_HEARTBEAT_MS).then(() => ({ type: "heartbeat" as const })),
    ]);

    if (aborted) break;

    if (nextItem.type === "heartbeat") {
      await stream.writeSSE({
        data: JSON.stringify({ timestamp: Date.now() }),
        event: "heartbeat",
      });
      continue;
    }

    nextPatchPromise = null;
    if (nextItem.patchResult.done) break;

    const patch = nextItem.patchResult.value;
    if (patch.path === "/approval_request") {
      await stream.writeSSE({ data: JSON.stringify(patch.value), event: "approval_request" });
    } else {
      await stream.writeSSE({ data: JSON.stringify(patch), event: "patch" });
    }
  }

  await iterator.return?.();
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

        if (session?.agent && session.agent_session_id && session.project_id) {
          await replayCompletedSession(session as SessionRecord, deps, stream);
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
