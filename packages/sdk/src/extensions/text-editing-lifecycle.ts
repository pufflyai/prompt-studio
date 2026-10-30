import type { TextOpenInput, TextWireSnapshot } from "pstdio-api-contracts/extension-kernel";
import type { GuestHost } from "./guest-host";
import { encodeTextBytes, textEditingError, textEditingFailure } from "./text-editing-codec";
import { createTextEditingDraft } from "./text-editing-draft";
import type { createTextEditingFences } from "./text-editing-queue";

interface LifecycleInput {
  host: GuestHost;
  source: TextOpenInput;
  fences: ReturnType<typeof createTextEditingFences>;
  sourceState: () => Uint8Array;
  flush: (prefix: number) => Promise<number>;
  receive: (snapshot: TextWireSnapshot) => void;
  assertWrite: () => void;
  publish: (patch?: { error?: ReturnType<typeof textEditingError> }) => void;
  dispose: () => Promise<void>;
  failed: (error: unknown) => void;
}

export const createTextEditingLifecycle = (input: LifecycleInput) => {
  const finalizers = new Set<() => void | Promise<void>>();
  const drafts = new Set<ReturnType<typeof createTextEditingDraft>>();
  let closing = false;
  let closed = false;
  let closingWork: Promise<void> | undefined;
  let preparing: { work: Promise<void> } | undefined;
  const prepareClose = () => {
    if (preparing) return preparing.work;
    const active = { work: Promise.resolve() };
    preparing = active;
    closing = true;
    input.publish();
    active.work = Promise.resolve()
      .then(async () => {
        for (const finalize of finalizers) await finalize();
        if ([...drafts].some((draft) => draft.pending() && !draft.frozen()))
          throw textEditingFailure("draft_active", "Finish or cancel the active text draft before closing");
        await Promise.all([...drafts].filter((draft) => draft.frozen()).map((draft) => draft.draft.commit()));
        while (input.fences.pending()) await input.flush(input.fences.prefix());
      })
      .catch((error) => {
        if (preparing === active) {
          closing = false;
          input.publish({ error: textEditingError(error) });
        }
        throw error;
      })
      .finally(() => {
        if (preparing === active) preparing = undefined;
      });
    return active.work;
  };
  return {
    closing: () => closing,
    closed: () => closed,
    prepareClose,
    cancelClose(error: unknown) {
      preparing = undefined;
      closing = false;
      input.publish({ error: textEditingError(error) });
    },
    retryDrafts: () => Promise.all([...drafts].filter((draft) => draft.frozen()).map((draft) => draft.draft.commit())),
    beforeClose(handler: () => void | Promise<void>) {
      finalizers.add(handler);
      return () => {
        finalizers.delete(handler);
      };
    },
    createDraft() {
      input.assertWrite();
      if (closed || closing) throw textEditingFailure("session_closed", "This session is closing");
      let ticket: number | undefined;
      let draftMember: string | undefined;
      const draft = createTextEditingDraft({
        state: input.sourceState(),
        commit: async (source, update, memberId) => {
          draftMember = memberId;
          ticket ??= input.fences.author();
          input.publish();
          try {
            await input.flush(ticket - 1);
            await input.host.call("editing.text", { operation: "register", memberId });
            const joined = await input.host.call("editing.text", {
              operation: "open",
              memberId,
              input: input.source,
              sourceState: encodeTextBytes(source),
              pendingUpdate: encodeTextBytes(update),
            });
            input.receive(joined.snapshot);
            input.fences.complete(ticket, joined.snapshot.revision);
            input.publish();
            await input.host.call("editing.text", { operation: "close", handle: joined.handle });
          } catch (error) {
            input.failed(error);
            throw error;
          }
        },
        cancelled: () => {
          if (ticket !== undefined) input.fences.cancel(ticket);
          if (draftMember)
            void input.host.call("editing.text", { operation: "abandon", memberId: draftMember }).catch(input.failed);
        },
        finished: () => {
          drafts.delete(draft);
          input.publish();
        },
      });
      drafts.add(draft);
      return draft.draft;
    },
    close() {
      if (closed) return Promise.resolve();
      if (closingWork) return closingWork;
      closingWork = prepareClose()
        .then(async () => {
          await input.dispose();
          closed = true;
          for (const draft of drafts) draft.draft.cancel();
        })
        .catch((error) => {
          closing = false;
          input.publish({ error: textEditingError(error) });
          throw error;
        })
        .finally(() => {
          closingWork = undefined;
        });
      return closingWork;
    },
  };
};
