import type { ApprovalRequest, ChatDraft, SessionMessage } from "@pstdio/sdk/extensions";
import {
  applySessionMessagePatch,
  type ChatRendererEvent,
  type ChatRendererSnapshot,
  type ChatRendererStreamEvent,
  type CommandContext,
  chatRendererStreamFrames,
  defineCommand,
  type ExtensionSessionStreamEvent,
  type JsonObject,
  params,
  type ResourceRef,
  streamOf,
} from "@pstdio/sdk/extensions";
import { conversationOperations } from "./controls";
import { conversationState } from "./conversation-state";
import { recoverNativeInputs } from "./native-recovery";
import { readQueue } from "./queue-snapshot";
import { sessionId } from "./resource";
import { selectedHarness } from "./selection";
import { readSessionSnapshot } from "./snapshot";

type ChatWatchUpdate =
  | { snapshot: ChatRendererSnapshot }
  | { recoverDraft: ChatDraft }
  | { patch: Extract<ChatRendererEvent, { patch: unknown }>["patch"] };

export const approvalSnapshot = (approval?: ApprovalRequest): ChatRendererSnapshot["approval"] =>
  approval
    ? {
        id: approval.id,
        title: `Allow ${approval.toolName}?`,
        choices: [
          { id: "approve", label: "Allow" },
          { id: "deny", label: "Deny" },
        ],
      }
    : null;
const waitForRefresh = (signal: AbortSignal) =>
  new Promise<void>((done) => {
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", finish);
      done();
    };
    const timer = setTimeout(finish, 2000);
    if (signal.aborted) finish();
    else signal.addEventListener("abort", finish, { once: true });
  });

export const watchConversation = async (ctx: CommandContext, resource?: ResourceRef) => {
  const id = sessionId(resource);
  if (!id) {
    // A visible draft owns the same shared watch as a saved conversation. Ending
    // immediately churns the client connection before its first session opens.
    await new Promise<void>((done) => {
      if (ctx.signal.aborted) done();
      else ctx.signal.addEventListener("abort", () => done(), { once: true });
    });
    return;
  }
  const hold = await ctx.sessions.retainResources(id);
  let revision = 0;
  let messages: SessionMessage[] = [];
  let queueMessages: SessionMessage[] = [];
  let queue: Awaited<ReturnType<typeof ctx.sessions.getQueuedMessages>>["queue"];
  let approvals: ApprovalRequest[] = [];
  let harnessId: string | undefined;
  let remote = false;
  let hasTranscript = false;
  let canonicalDisplay = false;
  let queueClock = 0;
  let runClock = 0;
  let streamActive = false;
  let retryStream = false;
  let lastConnectedRun: number | undefined;
  let connected = false;
  let stream = Promise.resolve();
  let writes = Promise.resolve();
  const emittedRecovery = new Set<string>();
  const writeEvent = (event: ChatWatchUpdate) => {
    writes = writes.then(async () => {
      for (const frame of chatRendererStreamFrames({ revision: revision++, ...event })) {
        if (ctx.signal.aborted) return;
        await ctx.stream.write(JSON.parse(JSON.stringify(frame)));
      }
    });
    // Retain the rejection for the loop/finally, but own it immediately while
    // another public stream callback or availability read is still pending.
    void writes.catch(() => undefined);
    return writes;
  };
  const matchesCanonicalMessages = (displayed: SessionMessage[]) =>
    displayed.length === messages.length && displayed.every((message, index) => message === messages[index]);
  const write = (snapshot: ChatRendererSnapshot) => {
    if (snapshot.messages) canonicalDisplay = matchesCanonicalMessages(snapshot.messages);
    return writeEvent({ snapshot });
  };
  const display = () => {
    const state = conversationState(id, [...messages, ...queueMessages], queue, harnessId, remote);
    return { ...state, messages: hasTranscript ? state.messages : undefined };
  };
  const patch = async (data: Extract<ExtensionSessionStreamEvent, { event: "patch" }>["data"]) => {
    if (data.path === "/approval_requests") {
      approvals = Array.isArray(data.value) ? (data.value as ApprovalRequest[]) : [];
      await write({ approval: approvalSnapshot(approvals[0]) });
      return;
    }
    const next = applySessionMessagePatch(messages, data);
    if (next === messages) return;
    messages = next;
    if (data.path === "/messages") hasTranscript = true;
    // The native owner already holds history. Forward indexes only while queue projection leaves
    // the transcript unchanged; reconnect snapshots and projected/reordered queues re-establish it.
    const displayed = display();
    if (
      data.path !== "/messages" &&
      canonicalDisplay &&
      displayed.messages &&
      matchesCanonicalMessages(displayed.messages)
    ) {
      await writeEvent({
        patch: {
          op: data.op,
          path: data.path,
          ...(data.op === "remove" ? {} : { value: messages[Number(data.path.slice("/messages/".length))] }),
        },
      });
    } else await write(displayed);
  };
  const queued = async (data: Extract<ExtensionSessionStreamEvent, { event: "queued_messages" }>["data"]) => {
    queueClock++;
    if ("error" in data) {
      await write({
        notice: data.error,
        queueReadOnly: true,
        operations: conversationOperations(remote, true),
      });
      return;
    }
    queue = data.queue;
    queueMessages = data.messages;
    const displayed = display();
    if (canonicalDisplay && displayed.messages && matchesCanonicalMessages(displayed.messages))
      delete displayed.messages;
    await write({
      ...displayed,
      operations: conversationOperations(remote, Boolean(queue?.readOnly)),
    });
  };
  const connect = (run?: number) => {
    streamActive = true;
    connected = true;
    retryStream = false;
    lastConnectedRun = run;
    // The public transport multiplexes this subscription on the shared browser connection.
    stream = ctx.sessions
      .stream(
        id,
        async (event) => {
          if (ctx.signal.aborted) return;
          if (event.event === "patch") await patch(event.data);
          else if (event.event === "queued_messages") await queued(event.data);
          else if (event.event === "approval_request") {
            approvals = [...approvals.filter((item) => item.id !== event.data.id), event.data];
            await write({ approval: approvalSnapshot(approvals[0]) });
          } else if (event.event === "end") {
            runClock++;
            await write({ streaming: false, approval: null });
          }
        },
        { signal: ctx.signal },
      )
      .catch(async (error) => {
        if (!ctx.signal.aborted) {
          retryStream = true;
          await write({ notice: error instanceof Error ? error.message : String(error) });
        }
      })
      .finally(() => {
        streamActive = false;
      });
    void stream.catch(() => undefined);
  };
  try {
    while (!ctx.signal.aborted) {
      const queuedAt = queueClock;
      const runAt = runClock;
      const pendingQueue = readQueue(ctx, id);
      const { snapshot, session } = await readSessionSnapshot(ctx, id, undefined, {
        messages: false,
        queue: pendingQueue,
      });
      const refreshedQueue = await pendingQueue;
      if (ctx.signal.aborted) break;
      harnessId = selectedHarness(snapshot.values ?? {})?.harnessId;
      remote = Boolean(snapshot.nativeHarnessAccount?.remote);
      if (queueClock !== queuedAt) {
        delete snapshot.queuedFollowUps;
        delete snapshot.queueReadOnly;
        delete snapshot.queueSteeringUnavailableReason;
        delete snapshot.operations;
      } else if (!refreshedQueue.error) {
        queue = refreshedQueue.queue;
        queueMessages = refreshedQueue.messages;
      }
      if (runClock !== runAt) {
        delete snapshot.streaming;
        delete snapshot.streamingStartedAt;
      }
      await write(snapshot);
      await recoverNativeInputs(ctx, id, session, (recoverDraft) => writeEvent({ recoverDraft }), emittedRecovery);
      if (ctx.signal.aborted) break;
      if (!streamActive && (!connected || retryStream || snapshot.streamingStartedAt !== lastConnectedRun))
        connect(snapshot.streamingStartedAt);
      await waitForRefresh(ctx.signal);
    }
  } finally {
    try {
      await stream;
      await writes;
    } finally {
      hold.close();
    }
  }
};

export const watch = defineCommand({
  id: "watch",
  title: "Watch conversation",
  stream: streamOf<ChatRendererStreamEvent & JsonObject>(),
  params: { renderer: params.json<{ resource?: ResourceRef }>() },
  run: (ctx, input) => watchConversation(ctx, input.renderer?.resource ?? ctx.resource),
});
