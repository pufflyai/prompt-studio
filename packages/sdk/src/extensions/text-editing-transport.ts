import type { TextOpenInput, TextWireSnapshot } from "pstdio-api-contracts/extension-kernel";
import type { createTextReplica } from "pstdio-sync/text";
import type { GuestHost } from "./guest-host";
import { decodeTextSnapshot, encodeTextBytes, textEditingError } from "./text-editing-codec";
import type { TextEditingSnapshot, TextSelection } from "./text-editing-types";

export const createTextEditingOperations = (input: {
  host: GuestHost;
  handle: () => string;
  closed: () => boolean;
  flush: () => Promise<number>;
  projectionFailed: () => boolean;
  settle: () => Promise<void>;
  publish: (patch: Partial<TextEditingSnapshot>) => void;
  failed: (error: unknown) => void;
}) => {
  const project = async () => {
    const revision = await input.flush();
    try {
      await input.host.call("editing.text", { operation: "project", handle: input.handle(), revision });
    } catch (error) {
      input.publish({
        error: {
          code: "projection_failed",
          message: error instanceof Error ? error.message : String(error),
          retryable: true,
        },
      });
      throw error;
    }
  };
  return {
    project,
    async retry() {
      const projectionFailed = input.projectionFailed();
      await input.settle();
      await input.flush();
      if (projectionFailed) await project();
    },
    setSelection(selection: TextSelection | null) {
      if (input.closed()) return;
      void input.host
        .call("editing.text", {
          operation: "presence",
          handle: input.handle(),
          selection: selection
            ? { anchor: encodeTextBytes(selection.anchor), head: encodeTextBytes(selection.head) }
            : null,
        })
        .catch(input.failed);
    },
  };
};

import { type createTextEditingFences, submitTextBatch } from "./text-editing-queue";

interface TextPumpInput {
  host: GuestHost;
  memberId: string;
  source: TextOpenInput;
  sourceIdentity: string;
  replica: () => ReturnType<typeof createTextReplica>;
  fences: ReturnType<typeof createTextEditingFences>;
  tickets: number[];
  handle: () => string;
  setHandle: (handle: string) => void;
  snapshot: () => TextEditingSnapshot;
  canonicalSeed: () => string;
  receive: (snapshot: TextWireSnapshot) => void;
  install: (snapshot: TextWireSnapshot) => void;
  closed: () => boolean;
  closing: () => boolean;
}
export const createTextEditingPump = (input: TextPumpInput) => {
  let sequence = 0;
  let batch: { count: number; update: Uint8Array; sequence: number } | undefined;
  const open = async (recovery = {}) => {
    const joined = await input.host.call("editing.text", {
      operation: "open",
      memberId: input.memberId,
      input: input.source,
      sourceIdentity: input.sourceIdentity,
      ...recovery,
    });
    // The lifecycle and future draft children share this SDK-owned source selection.
    if ("grant" in input.source) input.source.grant = joined.grant;
    return joined;
  };
  const adopt = async (replica: ReturnType<typeof createTextReplica>) => {
    const joined = await open();
    input.setHandle(joined.handle);
    input.receive(joined.snapshot);
    const pending = replica.capture();
    if (pending.update) {
      const recovered = await open({
        sourceState: encodeTextBytes(replica.receivedState()),
        pendingUpdate: encodeTextBytes(pending.update),
      });
      input.setHandle(recovered.handle);
      replica.acknowledge(pending.count, decodeTextSnapshot(recovered.snapshot));
      for (const ticket of input.tickets.splice(0, pending.count))
        input.fences.complete(ticket, recovered.snapshot.revision);
      input.receive(recovered.snapshot);
      return;
    }
    if (joined.snapshot.seedId === joined.snapshot.sourceSeedId) input.install(joined.snapshot);
  };
  const reconnect = async () => {
    const joined = await open(
      input.snapshot().editable ? { sourceState: encodeTextBytes(input.replica().receivedState()) } : {},
    );
    input.setHandle(joined.handle);
    input.receive(joined.snapshot);
  };
  const recoverConnection = async () => {
    const replica = input.replica();
    const captured = replica.capture();
    const recovery = captured.update
      ? {
          sourceState: encodeTextBytes(replica.receivedState()),
          pendingUpdate: encodeTextBytes(captured.update),
        }
      : {};
    const joined = await open(recovery);
    input.setHandle(joined.handle);
    replica.acknowledge(captured.count, decodeTextSnapshot(joined.snapshot));
    for (const ticket of input.tickets.splice(0, captured.count))
      input.fences.complete(ticket, joined.snapshot.revision);
    batch = undefined;
    sequence = 0;
    input.receive(joined.snapshot);
  };
  const run = async () => {
    if (!input.snapshot().connected && !batch) await reconnect();
    while (!input.closed()) {
      const replica = input.replica();
      const captured = replica.capture();
      if (!batch && captured.update) batch = { count: captured.count, update: captured.update, sequence: ++sequence };
      if (batch) {
        const snapshot = await submitTextBatch({
          host: input.host,
          handle: input.handle(),
          replica,
          fences: input.fences,
          tickets: input.tickets,
          batch,
        });
        batch = undefined;
        input.receive(snapshot);
        continue;
      }
      if (input.closing() || input.canonicalSeed() === replica.seedId) return;
      await adopt(replica);
    }
  };
  return async () => {
    try {
      await run();
    } catch (error) {
      if (textEditingError(error).code !== "connection_reset") throw error;
      await recoverConnection();
      await run();
    }
  };
};
