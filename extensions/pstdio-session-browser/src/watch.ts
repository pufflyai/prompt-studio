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
import { sessionId } from "./resource";
import { selectedHarness } from "./selection";
import { createSessionMetadataQuery } from "./session-metadata-query";
import { createStreamRecovery } from "./stream-recovery";

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
const startedAt = (value?: string | null) => (value ? new Date(value).getTime() : undefined);

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
  const subscriptionController = new AbortController();
  const subscriptionSignal = AbortSignal.any([ctx.signal, subscriptionController.signal]);
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
  let wake = Promise.withResolvers<void>();
  const changed = () => wake.resolve();
  ctx.signal.addEventListener("abort", changed, { once: true });
  let failure: unknown;
  const metadata = createSessionMetadataQuery(ctx, id, () => ({ queue: queueClock, run: runClock }));
  let stopMetadata = () => {};
  const recovery = createStreamRecovery(() => {
    retryStream = true;
    changed();
  });
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
    void writes.catch((error) => {
      failure = error;
      changed();
    });
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
          if (event.event !== "ready") recovery.succeeded();
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
        { signal: subscriptionSignal },
      )
      .catch(async (error) => {
        if (!subscriptionSignal.aborted) {
          recovery.failed();
          await write({ notice: error instanceof Error ? error.message : String(error) });
        }
      })
      .finally(() => {
        streamActive = false;
        changed();
      });
    void stream.catch(() => undefined);
  };
  const applyMetadata = async (result: NonNullable<ReturnType<typeof metadata.query.getSnapshot>["data"]>) => {
    metadata.accepted(result);
    const { session, reads, readAt } = result;
    const snapshot = { ...result.snapshot };
    harnessId = selectedHarness(snapshot.values ?? {})?.harnessId;
    remote = Boolean(snapshot.nativeHarnessAccount?.remote);
    if (!result.sessionRead || queueClock !== readAt.queue) {
      delete snapshot.queuedFollowUps;
      delete snapshot.queueReadOnly;
      delete snapshot.queueSteeringUnavailableReason;
      delete snapshot.operations;
    } else if (!reads.queued.error) {
      queue = reads.queued.queue;
      queueMessages = reads.queued.messages;
    }
    if (!result.sessionRead || runClock !== readAt.run) {
      delete snapshot.streaming;
      delete snapshot.streamingStartedAt;
    }
    await write(snapshot);
    await recoverNativeInputs(ctx, id, session, (recoverDraft) => writeEvent({ recoverDraft }), emittedRecovery);
  };
  try {
    stopMetadata = metadata.query.subscribe(changed);
    let accepted: ReturnType<typeof metadata.query.getSnapshot>["data"];
    while (!ctx.signal.aborted) {
      const waiting = wake.promise;
      await metadata.query.read();
      if (ctx.signal.aborted) break;
      if (failure) throw failure;
      const state = metadata.query.getSnapshot();
      if (state.error) throw state.error;
      const result = state.data;
      if (result && result !== accepted) {
        accepted = result;
        await applyMetadata(result);
      }
      if (ctx.signal.aborted) break;
      const run = startedAt(result?.session.lastRequestStarted);
      if (!streamActive && (!connected || retryStream || run !== lastConnectedRun)) connect(run);
      await waiting;
      wake = Promise.withResolvers<void>();
    }
  } finally {
    recovery.close();
    stopMetadata();
    metadata.dispose();
    ctx.signal.removeEventListener("abort", changed);
    subscriptionController.abort();
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
