import { createTextEditingClient, type TextEditingEvent, type TextEditingRequest } from "@pstdio/sdk/extensions";
import * as Y from "yjs";

type Host = Parameters<typeof createTextEditingClient>[0];
const encode = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");

/** A controlled wire peer for real public SDK sessions, not host authorization or projection proof. */
export const markdownSessionFixture = async () => {
  let document = new Y.Doc({ gc: false });
  document.getText("content").insert(0, "source");
  const documents = [document];
  const listeners = new Set<(event: unknown) => void>();
  const frames: Uint8Array[] = [];
  const draftOpens: unknown[] = [];
  let rejectedDraft: "source_unavailable" | "source_retired" | undefined;
  let historyId = "history";
  let editable = true;
  let holdDraft: (() => Promise<void>) | undefined;
  let holdParent: (() => Promise<void>) | undefined;
  let failDraftCleanup = false;
  let revision = 1;
  let memberId = "";
  const snapshot = () => ({
    state: encode(Y.encodeStateAsUpdate(document)),
    seedId: historyId,
    sourceSeedId: historyId,
    revision,
    editable,
  });
  const requireWrite = () => {
    if (!editable)
      throw Object.assign(new Error("Source is read only"), { code: "source_read_only", retryable: false });
  };
  const host = {
    async call(_method: string, input: TextEditingRequest) {
      if (input.operation === "open") {
        memberId ||= input.memberId;
        if (input.pendingUpdate) {
          draftOpens.push(input);
          requireWrite();
          if (rejectedDraft)
            throw Object.assign(new Error("Draft admission interrupted"), {
              code: rejectedDraft,
              retryable: rejectedDraft !== "source_retired",
            });
          Y.applyUpdate(document, Buffer.from(input.pendingUpdate, "base64"));
          revision++;
          await holdDraft?.();
        } else await holdParent?.();
        return {
          handle: input.memberId,
          grant: { token: "selected" },
          sourceIdentity: "a".repeat(64),
          snapshot: snapshot(),
        };
      }
      if (input.operation === "submit") {
        requireWrite();
        const update = Buffer.from(input.update, "base64");
        frames.push(update);
        Y.applyUpdate(document, update);
        revision++;
        return snapshot();
      }
      if (input.operation === "snapshot") return snapshot();
      if (input.operation === "project") return { revision };
      if (input.operation === "close" && input.handle !== memberId && failDraftCleanup) {
        failDraftCleanup = false;
        throw Object.assign(new Error("Cleanup interrupted after receipt"), {
          code: "source_unavailable",
          retryable: true,
        });
      }
    },
    onEvent(_scope: string, listener: (event: unknown) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  } as Host;
  const session = await createTextEditingClient(host).open({ sourceId: "body", params: {} });
  return {
    get document() {
      return document;
    },
    session,
    frames,
    draftOpens,
    rejectDraft(code: typeof rejectedDraft) {
      rejectedDraft = code;
    },
    holdDraft(handler?: () => Promise<void>) {
      holdDraft = handler;
    },
    holdParent(handler?: () => Promise<void>) {
      holdParent = handler;
    },
    failDraftCleanup() {
      failDraftCleanup = true;
    },
    readonly() {
      editable = false;
      revision++;
      const event: TextEditingEvent = {
        type: "snapshot",
        memberId,
        handle: memberId,
        version: revision,
        snapshot: snapshot(),
      };
      for (const listener of listeners) listener(event);
    },
    async replace(source: string, notify = true) {
      document = new Y.Doc({ gc: false });
      document.getText("content").insert(0, source);
      documents.push(document);
      historyId = crypto.randomUUID();
      revision++;
      if (!notify) return;
      const event: TextEditingEvent = {
        type: "snapshot",
        memberId,
        handle: memberId,
        version: revision,
        snapshot: snapshot(),
      };
      for (const listener of listeners) listener(event);
      await session.retry();
    },
    remote(change: (text: Y.Text) => void) {
      document.transact(() => change(document.getText("content")));
      revision++;
      const event: TextEditingEvent = {
        type: "snapshot",
        memberId,
        handle: memberId,
        version: revision,
        snapshot: snapshot(),
      };
      for (const listener of listeners) listener(event);
    },
    async dispose() {
      await session.close();
      for (const value of documents) value.destroy();
    },
  };
};
