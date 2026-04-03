import { readFileSync } from "node:fs";
import type { Context } from "hono";
import type { SSEStreamingApi } from "hono/streaming";
import { streamSSE } from "hono/streaming";
import type { AgentId, EventStore, JsonPatch, SessionMessage } from "pstdio-agents";
import type { AppBindings } from "../../../types";
import type { RouteDeps } from "../../deps";
import { buildMessagesFromPatches, resolveMessagePatchIndexOffset } from "../session-messages";

const SESSION_STREAM_HEARTBEAT_MS = 1000;

type SessionRecord = {
  id: string;
  agent: string;
  agent_session_id: string;
  project_id: string;
  session_file_id: string | null;
  cwd: string | null;
  status: string | null;
};

const replayMessagesAsPatch = async (messages: SessionMessage[], stream: SSEStreamingApi) => {
  const patch = { op: "replace" as const, path: "/messages", value: messages };
  await stream.writeSSE({ data: JSON.stringify(patch), event: "patch" });
};

const getPersistedMessages = async (sessionFileId: string, deps: RouteDeps) => {
  const file = await deps.fileService.get(sessionFileId);
  if (!file) return [];

  return JSON.parse(readFileSync(file.storage_path, "utf-8")) as SessionMessage[];
};

const replayPersistedMessages = async (sessionFileId: string, deps: RouteDeps, stream: SSEStreamingApi) => {
  const messages = await getPersistedMessages(sessionFileId, deps);
  await replayMessagesAsPatch(messages, stream);
};

const fetchAgentMessages = async (session: SessionRecord, deps: RouteDeps) => {
  const agent = deps.agentRegistry.get(session.agent as AgentId);
  if (!agent) return null;

  const cwd = session.cwd;
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

const streamLivePatches = async (patches: AsyncIterable<JsonPatch>, stream: SSEStreamingApi) => {
  let aborted = false;
  stream.onAbort(() => {
    aborted = true;
  });

  const iterator = patches[Symbol.asyncIterator]();
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

const shiftIndexedMessagePatch = (patch: JsonPatch, indexOffset: number): JsonPatch => {
  if (indexOffset === 0) {
    return patch;
  }

  const match = patch.path.match(/^\/messages\/(\d+)$/);
  if (!match) {
    return patch;
  }

  return {
    ...patch,
    path: `/messages/${Number(match[1]) + indexOffset}`,
  };
};

async function* translateIndexedMessagePatches(patches: AsyncIterable<JsonPatch>, indexOffset: number) {
  for await (const patch of patches) {
    yield shiftIndexedMessagePatch(patch, indexOffset);
  }
}

const replayActiveSession = async (
  session: SessionRecord,
  eventStore: EventStore,
  deps: RouteDeps,
  stream: SSEStreamingApi,
) => {
  const persistedMessages = session.session_file_id ? await getPersistedMessages(session.session_file_id, deps) : [];
  const snapshot = eventStore.snapshotAndSubscribe();
  const indexOffset = resolveMessagePatchIndexOffset(snapshot.history, persistedMessages.length);
  const messages = buildMessagesFromPatches(snapshot.history, persistedMessages);

  if (messages.length > 0) {
    await replayMessagesAsPatch(messages, stream);
  }

  return streamLivePatches(translateIndexedMessagePatches(snapshot.stream, indexOffset), stream);
};

const WAIT_FOR_AGENT_POLL_MS = 500;
const WAIT_FOR_AGENT_MAX_MS = 120_000;

const waitForSessionStoreEntry = async (sessionId: string, deps: RouteDeps, stream: SSEStreamingApi) => {
  // Only wait if the session exists but the agent hasn't been spawned yet.
  // This happens when workspace initialization is blocking the agent spawn.
  const session = await deps.sessionService.get(sessionId);
  if (!session) return null;

  // Session already has an agent_session_id — the agent was spawned but is no longer running.
  // This is an orphaned/completed session, not a pending spawn.
  if (session.agent_session_id) return null;

  const terminal = session.status === "completed" || session.status === "failed" || session.status === "cancelled";
  if (terminal) return null;

  const deadline = Date.now() + WAIT_FOR_AGENT_MAX_MS;

  while (Date.now() < deadline) {
    const entry = deps.sessionService.store.get(sessionId);
    if (entry) return entry;

    const current = await deps.sessionService.get(sessionId);
    if (!current) return null;

    const isTerminal = current.status === "completed" || current.status === "failed" || current.status === "cancelled";
    if (isTerminal || current.agent_session_id) return null;

    await stream.writeSSE({ data: JSON.stringify({ timestamp: Date.now() }), event: "heartbeat" });
    await new Promise((resolve) => setTimeout(resolve, WAIT_FOR_AGENT_POLL_MS));
  }

  return null;
};

export const streamSessionHandler = (deps: RouteDeps) => {
  return (c: Context<AppBindings>) => {
    const id = c.req.param("id")!;

    return streamSSE(c, async (stream) => {
      let entry = deps.sessionService.store.get(id);

      await stream.writeSSE({ data: JSON.stringify({ sessionId: id }), event: "ready" });

      // The agent may not have started yet (workspace is initializing).
      // Wait for the session store entry to appear before giving up.
      if (!entry) {
        entry = await waitForSessionStoreEntry(id, deps, stream);
      }

      if (!entry) {
        const session = await deps.sessionService.get(id);

        if (session?.agent && session.agent_session_id && session.project_id) {
          await replayCompletedSession(session as SessionRecord, deps, stream);
        }

        const status = session?.status ?? "unknown";
        await stream.writeSSE({ data: JSON.stringify({ status }), event: "end" });
        return;
      }

      const session = await deps.sessionService.get(id);
      const activeSession = session as SessionRecord | null;
      const aborted = activeSession
        ? await replayActiveSession(activeSession, entry.eventStore, deps, stream)
        : await streamLivePatches(entry.eventStore.subscribe(), stream);

      if (!aborted) {
        const finalSession = await deps.sessionService.get(id);
        const status = finalSession?.status ?? "completed";
        await stream.writeSSE({ data: JSON.stringify({ status }), event: "end" });
      }
    });
  };
};
