import type { TextEditingEvent, TextOpenInput, TextWireSnapshot } from "pstdio-api-contracts/extension-kernel";
import * as Y from "yjs";
import type { GuestHost } from "./guest-host";
import { decodeTextSnapshot, textEditingError, textEditingFailure } from "./text-editing-codec";
import { createTextEditingReceiver } from "./text-editing-events";
import { createTextEditingLifecycle } from "./text-editing-lifecycle";
import { createTextEditingFences } from "./text-editing-queue";
import { createTextEditingReplica, createTextReceiveHandlers } from "./text-editing-replica";
import { createTextEditingOperations, createTextEditingPump } from "./text-editing-transport";
import type { TextEditingSession, TextEditingSnapshot } from "./text-editing-types";
export const openTextEditingSession = async (host: GuestHost, input: TextOpenInput, memberId: string) => {
  const origin = {};
  const listeners = new Set<() => void>();
  const receiveHandlers = createTextReceiveHandlers();
  const early: TextEditingEvent[] = [];
  let receiveEvent: ((event: TextEditingEvent) => void) | undefined;
  const stopEvents = host.onEvent("editing.text", (value) => {
    const event = value as TextEditingEvent;
    if (event.type !== "prepareClose" && event.memberId !== memberId) return;
    if (receiveEvent) receiveEvent(event);
    else early.push(event);
  });
  const opened = await host.call("editing.text", { operation: "open", memberId, input }).catch((error) => {
    stopEvents();
    throw error;
  });
  input = { grant: opened.grant };
  let handle = opened.handle;
  let replica = createTextEditingReplica(decodeTextSnapshot(opened.snapshot), receiveHandlers.run);
  const fences = createTextEditingFences(opened.snapshot.revision);
  const frameTickets: number[] = [];
  let revision = opened.snapshot.revision;
  let writing: Promise<void> | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let canonicalSeed = opened.snapshot.seedId;
  let state: TextEditingSnapshot = {
    version: 0,
    historyId: replica.seedId,
    text: replica.document.getText("content"),
    editable: opened.snapshot.editable,
    closing: false,
    pending: false,
    connected: true,
    participants: [],
  };
  const blocked = () =>
    state.error &&
    !state.error.retryable &&
    state.error.code !== "draft_active" &&
    state.error.code !== "projection_failed";
  const publish = (patch: Partial<TextEditingSnapshot> = {}) => {
    state = {
      ...state,
      ...patch,
      version: state.version + 1,
      text: replica.document.getText("content"),
      historyId: replica.seedId,
      pending: fences.pending(),
      closing: lifecycle.closing(),
    };
    for (const listener of listeners) listener();
  };
  const failed = (error: unknown) => {
    const failure = textEditingError(error);
    fences.fail(error);
    publish({ error: failure, connected: false });
    if (failure.retryable && !lifecycle.closed() && !retryTimer)
      retryTimer = setTimeout(() => {
        retryTimer = undefined;
        void operations.retry().catch(() => {});
      }, 1000);
  };
  const localChanged = () => {
    frameTickets.push(fences.author());
    publish();
    if (!state.editable) {
      failed(textEditingFailure("source_read_only", "The text source is read only"));
      return;
    }
    drive();
  };
  let stopLocal = replica.subscribe(localChanged);
  const receive = (snapshot: TextWireSnapshot) => {
    if (snapshot.revision < revision) return;
    const same = replica.receive(decodeTextSnapshot(snapshot));
    revision = snapshot.revision;
    canonicalSeed = snapshot.seedId;
    publish({ editable: snapshot.editable, connected: true, error: undefined });
    if (!same) drive();
  };
  const install = (snapshot: TextWireSnapshot) => {
    if (replica.pending() || snapshot.revision < revision || snapshot.seedId !== canonicalSeed) return;
    revision = snapshot.revision;
    canonicalSeed = snapshot.seedId;
    const previous = replica;
    stopLocal();
    replica = createTextEditingReplica(decodeTextSnapshot(snapshot), receiveHandlers.run);
    stopLocal = replica.subscribe(localChanged);
    publish({ participants: [], editable: snapshot.editable, error: undefined, connected: true });
    previous.dispose();
  };
  const pump = createTextEditingPump({
    host,
    memberId,
    source: input,
    sourceIdentity: opened.sourceIdentity,
    replica: () => replica,
    fences,
    tickets: frameTickets,
    handle: () => handle,
    setHandle: (next) => {
      handle = next;
    },
    snapshot: () => state,
    canonicalSeed: () => canonicalSeed,
    receive,
    install,
    closed: () => lifecycle.closed(),
  });
  function drive() {
    if (lifecycle.closed() || writing || blocked()) return;
    clearTimeout(retryTimer);
    retryTimer = undefined;
    writing = Promise.resolve()
      .then(pump)
      .catch(failed)
      .finally(() => {
        writing = undefined;
        if (!lifecycle.closed() && !state.error && replica.pending()) drive();
      });
  }
  const flushPrefix = (prefix: number) => {
    if (lifecycle.closed()) return Promise.reject(textEditingFailure("session_closed", "This text session is closed"));
    if (blocked() && !fences.settled(prefix)) return Promise.reject(state.error);
    const fence = fences.through(prefix);
    drive();
    return fence;
  };
  const lifecycle = createTextEditingLifecycle({
    host,
    source: input,
    sourceIdentity: opened.sourceIdentity,
    fences,
    sourceState: () => Y.encodeStateAsUpdate(replica.document),
    flush: flushPrefix,
    receive,
    publish,
    failed,
    assertWrite: () => {
      if (!state.editable) throw textEditingFailure("source_read_only", "The text source is read only");
      if (blocked()) throw state.error;
    },
    dispose: async () => {
      await writing;
      await host.call("editing.text", { operation: "close", handle });
      clearTimeout(retryTimer);
      stopEvents();
      stopLocal();
      replica.dispose();
      listeners.clear();
      receiveHandlers.clear();
    },
  });
  receiveEvent = createTextEditingReceiver({
    host,
    memberId,
    handle: () => handle,
    closed: lifecycle.closed,
    prepareClose: lifecycle.prepareClose,
    cancelClose: lifecycle.cancelClose,
    receive,
    failed,
    publish,
  });
  for (const event of early) receiveEvent(event);
  const operations = createTextEditingOperations({
    host,
    handle: () => handle,
    closed: () => lifecycle.closed() || lifecycle.closing(),
    flush: async () => {
      const prefix = fences.prefix();
      await lifecycle.retryDrafts();
      return flushPrefix(prefix);
    },
    projectionFailed: () => state.error?.code === "projection_failed",
    settle: async () => {
      await writing;
    },
    publish,
    failed,
  });
  return {
    origin,
    getSnapshot: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    transact(change) {
      if (lifecycle.closed() || lifecycle.closing())
        throw textEditingFailure("session_closed", "This text session is closing");
      if (!state.editable) throw textEditingFailure("source_read_only", "The text source is read only");
      if (blocked()) throw state.error;
      replica.document.transact(() => change(replica.document.getText("content")), origin);
    },
    createDraft: lifecycle.createDraft,
    beforeReceive: receiveHandlers.add,
    beforeClose: lifecycle.beforeClose,
    async flush() {
      const prefix = fences.prefix();
      await lifecycle.retryDrafts();
      await flushPrefix(prefix);
    },
    ...operations,
    close: lifecycle.close,
  } satisfies TextEditingSession;
};
