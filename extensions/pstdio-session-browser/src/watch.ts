import type { ApprovalRequest, ChatDraft, SessionMessage } from "@pstdio/sdk/extensions";
import {
  applySessionMessagePatch,
  type ChatRendererEvent,
  type ChatRendererSnapshot,
  type ChatRendererStreamEvent,
  type CommandContext,
  defineCommand,
  type ExtensionSessionStreamEvent,
  type JsonObject,
  params,
  type ResourceRef,
  streamOf,
} from "@pstdio/sdk/extensions";
import { createStreamObservation } from "./changes";
import { diagnosticChatFrames } from "./chat-stream-diagnostics";
import { conversationOperations } from "./controls";
import { conversationState } from "./conversation-state";
import { recoverNativeInputs } from "./native-recovery";
import type { readQueue } from "./queue-snapshot";
import { createRecoveryBackoff } from "./recovery-backoff";
import { sessionId } from "./resource";
import { selectedHarness } from "./selection";
import { createSessionMetadataQuery } from "./session-metadata-query";
import { executionNotice, type readSessionSnapshot } from "./snapshot";

type ChatWatchUpdate =
  | { snapshot: ChatRendererSnapshot }
  | { recoverDraft: ChatDraft }
  | { patch: Extract<ChatRendererEvent, { patch: unknown }>["patch"] };

export const approvalSnapshot = (approval?: ApprovalRequest): ChatRendererSnapshot["approval"] => {
  if (!approval) return null;
  // Name what the tool will do, so the person can judge the request before allowing it.
  // The tool call in the transcript keeps the full command; a long one would push the form off screen.
  const input = (approval.toolInput as { command?: unknown } | null)?.command;
  const command = typeof input === "string" ? input.trim() : "";
  const shown = command.length > 200 ? `${command.slice(0, 200)}…` : command;
  return {
    id: approval.id,
    title: shown ? `Allow ${approval.toolName} to run: ${shown}` : `Allow ${approval.toolName}?`,
    choices: [
      { id: "approve", label: "Allow" },
      { id: "deny", label: "Deny" },
    ],
  };
};

const startedAt = (value?: string | null) => (value ? new Date(value).getTime() : undefined);
const retainDraftWatch = (signal: AbortSignal) =>
  new Promise<void>((done) => {
    if (signal.aborted) done();
    else signal.addEventListener("abort", () => done(), { once: true });
  });

const matchesCanonicalMessages = (messages: SessionMessage[], displayed: SessionMessage[]) =>
  displayed.length === messages.length && displayed.every((message, index) => message === messages[index]);

const watchNotice = (current: Awaited<ReturnType<typeof readSessionSnapshot>> | undefined, queueError?: string) =>
  current ? executionNotice(current.reads.execution, queueError) || current.nativeNotice : queueError;

const displayConversation = (
  id: string,
  messages: SessionMessage[],
  queued: Awaited<ReturnType<typeof readQueue>> | undefined,
  harnessId: string | undefined,
  remote: boolean,
  hasTranscript: boolean,
) => {
  const state = conversationState(id, [...messages, ...(queued?.messages ?? [])], queued?.queue, harnessId, remote);
  return {
    ...state,
    ...(queued?.error && { queueReadOnly: true, operations: conversationOperations(remote, true) }),
    messages: hasTranscript ? state.messages : undefined,
  };
};

const writeFrames = async (ctx: CommandContext, id: string, revision: number, event: ChatWatchUpdate) => {
  for (const frame of diagnosticChatFrames(id, { revision, ...event })) {
    if (ctx.signal.aborted) return;
    await ctx.stream.write(JSON.parse(JSON.stringify(frame)));
  }
};

export const watchConversation = async (ctx: CommandContext, resource?: ResourceRef) => {
  const id = sessionId(resource);
  // A visible draft retains its shared watch until disposal, without reconnect churn.
  if (!id) return retainDraftWatch(ctx.signal);
  const hold = await ctx.sessions.retainResources(id);
  const subscriptionController = new AbortController();
  const subscriptionSignal = AbortSignal.any([ctx.signal, subscriptionController.signal]);
  let revision = 0;
  let messages: SessionMessage[] = [];
  let queued: Awaited<ReturnType<typeof readQueue>> | undefined;
  let approvals: ApprovalRequest[] = [];
  let harnessId: string | undefined;
  let remote = false;
  let available = true;
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
  const recovery = createRecoveryBackoff(() => {
    retryStream = true;
    changed();
  });
  const queueRecovery = createRecoveryBackoff(() => metadata.refreshQueue());
  const recoverQueue = (readOnly: boolean) => {
    if (remote && available && readOnly) queueRecovery.failed();
    else queueRecovery.succeeded();
  };
  const emittedRecovery = new Set<string>();
  const enqueue = (send: () => Promise<unknown>) => {
    writes = writes.then(send).then(() => {});
    // Own a rejected write while other public stream callbacks are pending.
    void writes.catch((error) => {
      failure = error;
      changed();
    });
    return writes;
  };
  const writeEvent = (event: ChatWatchUpdate) => enqueue(() => writeFrames(ctx, id, revision++, event));
  const observe = createStreamObservation(ctx, id, (observation) =>
    writeFrames(ctx, id, revision++, { snapshot: observation }),
  );
  const observation = () =>
    observe(metadata.query.getSnapshot().data?.session, hasTranscript ? messages : undefined, approvals[0]?.id);
  const write = (snapshot: ChatRendererSnapshot) => {
    if (snapshot.messages) canonicalDisplay = matchesCanonicalMessages(messages, snapshot.messages);
    writeEvent({ snapshot });
    const send = observation();
    return send ? enqueue(send) : writes;
  };
  const display = () => displayConversation(id, messages, queued, harnessId, remote, hasTranscript);
  const notice = () => watchNotice(metadata.query.getSnapshot().data, queued?.error);
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
      matchesCanonicalMessages(messages, displayed.messages)
    ) {
      const send = observation();
      writeEvent({
        patch: {
          op: data.op,
          path: data.path,
          ...(data.op === "remove" ? {} : { value: messages[Number(data.path.slice("/messages/".length))] }),
        },
      });
      await (send ? enqueue(send) : writes);
    } else await write(displayed);
  };
  const acceptQueued = async (data: Extract<ExtensionSessionStreamEvent, { event: "queued_messages" }>["data"]) => {
    queueClock++;
    if ("error" in data) {
      queued = { messages: queued?.messages ?? [], queue: queued?.queue, error: data.error };
      recoverQueue(true);
      await write({
        notice: data.error,
        queueReadOnly: true,
        operations: conversationOperations(remote, true),
      });
      return;
    }
    queued = { ...data, error: undefined };
    recoverQueue(Boolean(data.queue?.readOnly));
    const displayed = display();
    if (canonicalDisplay && displayed.messages && matchesCanonicalMessages(messages, displayed.messages))
      delete displayed.messages;
    await write({
      ...displayed,
      notice: notice(),
      operations: conversationOperations(remote, Boolean(data.queue?.readOnly)),
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
          else if (event.event === "queued_messages") await acceptQueued(event.data);
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
    const { session, reads, readAt } = result;
    const snapshot = { ...result.snapshot };
    harnessId = selectedHarness(snapshot.values ?? {})?.harnessId;
    remote = Boolean(snapshot.nativeHarnessAccount?.remote);
    available = reads.execution.available;
    if (!available) queueRecovery.succeeded();
    if (!result.queueRead || queueClock !== readAt.queue) {
      delete snapshot.queuedFollowUps;
      delete snapshot.queueReadOnly;
      delete snapshot.queueSteeringUnavailableReason;
      delete snapshot.operations;
    } else {
      recoverQueue(Boolean(reads.queued.error || reads.queued.queue?.readOnly));
      queued = reads.queued.error
        ? { ...reads.queued, messages: queued?.messages ?? [], queue: queued?.queue }
        : reads.queued;
    }
    // Queue fields and their notice share one clock, including cached inputs used by
    // unrelated later metadata hints. A stale RPC cannot retire a streamed recovery.
    metadata.accepted(result, queued ?? reads.queued);
    snapshot.notice = notice();
    if (!result.sessionRead || runClock !== readAt.run) {
      delete snapshot.streaming;
      delete snapshot.streamingStartedAt;
    }
    await write(snapshot);
    if (result.sessionRead || result.marks.some(([field]) => field === "storage"))
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
    queueRecovery.close();
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
