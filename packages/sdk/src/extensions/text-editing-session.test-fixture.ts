import type { TextEditingRequest, TextWireSnapshot } from "pstdio-api-contracts/extension-kernel";
import { applyTextEditorUpdate, readTextDocumentSeed, seedTextDocument } from "pstdio-sync/text";
import * as Y from "yjs";
import type { GuestHost } from "./guest-host";
import { createTextEditingClient } from "./text-editing-client";
import { decodeTextBytes, encodeTextBytes } from "./text-editing-codec";

export const textEditingSessionFixture = async (editable = true) => {
  let document = new Y.Doc();
  await seedTextDocument(document, "source");
  const listeners = new Set<(value: unknown) => void>();
  let revision = 1;
  let hold: (() => Promise<void>) | undefined;
  const snapshot = async (): Promise<TextWireSnapshot> => ({
    state: encodeTextBytes(Y.encodeStateAsUpdate(document)),
    seedId: (await readTextDocumentSeed(document)).id,
    sourceSeedId: (await readTextDocumentSeed(document)).id,
    revision,
    editable,
  });
  const frames: string[] = [];
  const sequences: number[] = [];
  const projects: number[] = [];
  let beforeAck: (() => void) | undefined;
  let loseAck = false;
  let retireDraft = false;
  let memberId = "";
  const open = async (input: Extract<TextEditingRequest, { operation: "open" }>) => {
    memberId = input.memberId;
    if (input.sourceState && !editable)
      throw Object.assign(new Error("Readonly recovery"), { code: "source_read_only", retryable: false });
    if (input.pendingUpdate && retireDraft)
      throw Object.assign(new Error("Source retired"), { code: "source_retired", retryable: false });
    if (input.pendingUpdate) {
      applyTextEditorUpdate(document, decodeTextBytes(input.pendingUpdate));
      revision++;
    }
    if (input.pendingUpdate) await hold?.();
    return { handle: input.memberId, grant: { token: "fixture" }, snapshot: await snapshot() };
  };
  const host = {
    call: async (_name: string, input: TextEditingRequest) => {
      if (input.operation === "open") return open(input);
      if (input.operation === "submit") {
        frames.push(input.update);
        sequences.push(input.sequence);
        applyTextEditorUpdate(document, decodeTextBytes(input.update));
        revision++;
        beforeAck?.();
        const reply = await snapshot();
        await hold?.();
        if (loseAck) {
          loseAck = false;
          throw new Error("Connection closed before acknowledgement");
        }
        return reply;
      }
      if (input.operation === "snapshot") return snapshot();
      if (input.operation === "project") {
        projects.push(input.revision);
        return { revision: input.revision };
      }
    },
    onEvent: (_scope: string, handler: (value: unknown) => void) => {
      listeners.add(handler);
      return () => {
        listeners.delete(handler);
      };
    },
  } as GuestHost;
  return {
    get document() {
      return document;
    },
    async replaceHistory(content: string) {
      const next = new Y.Doc();
      await seedTextDocument(next, content);
      document.destroy();
      document = next;
      revision++;
    },
    snapshot,
    beforeAck: (handler: () => void) => {
      beforeAck = handler;
    },
    frames,
    sequences,
    projects,
    retireDraft: () => {
      retireDraft = true;
    },
    readonly: () => {
      editable = false;
    },
    loseAck: () => {
      loseAck = true;
    },
    emit: (event: object) => {
      for (const listener of listeners) listener({ ...event, memberId, handle: memberId });
    },
    host,
    hold: (next?: () => Promise<void>) => {
      hold = next;
    },
    session: await createTextEditingClient(host).open({ sourceId: "body", params: {} }),
  };
};
