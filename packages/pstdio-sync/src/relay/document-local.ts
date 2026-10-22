import type * as Y from "yjs";
import { runBinaryTask } from "../binary-background";
import type { BinaryTaskResult } from "../binary-task-types";
import { documentRevision, snapshotDocumentBinary } from "../document-binary";
import { applyDocumentUpdate, type DocumentStore } from "../document-types";
import type { StorageOwner } from "../types";
import type { DocumentBlob } from "./document-blob-manifest";

interface Snapshot {
  revision: number;
  updates: Uint8Array[];
  document?: Y.Doc;
}

export const createLocalDocumentComparison = (store: DocumentStore, owner: StorageOwner, signal: AbortSignal) => {
  let saved: Snapshot | undefined;
  let comparison: { snapshot: Snapshot; remoteRevision: number; result: Promise<BinaryTaskResult> } | undefined;
  let inspecting: Promise<Snapshot> | undefined;
  const load = async () => {
    if (store.snapshot) return store.snapshot(owner);
    return store.transaction(owner, async ({ document }) => ({ ...snapshotDocumentBinary(document), document }));
  };
  const inspect = async () => {
    if (store.revision) {
      const revision = await store.revision(owner);
      if (!saved || saved.revision !== revision) saved = { revision, updates: [] };
    } else if (store.snapshot) {
      const next = await store.snapshot(owner, saved?.revision);
      if (!saved || next.updates.length) saved = next;
    } else {
      saved = await store.transaction(owner, async ({ document }) => {
        if (saved?.document === document && saved.revision === documentRevision(document)) return saved;
        return { ...snapshotDocumentBinary(document), document };
      });
    }
    return saved!;
  };
  return {
    async compare(remote: Uint8Array, remoteRevision: number) {
      inspecting ??= inspect().finally(() => {
        inspecting = undefined;
      });
      const current = await inspecting;
      if (comparison?.snapshot !== current || comparison.remoteRevision !== remoteRevision) {
        comparison = {
          snapshot: current,
          remoteRevision,
          result: runBinaryTask(async () => {
            const snapshot = current.updates.length ? current : await load();
            return { kind: "compare", local: snapshot.updates, remote };
          }, signal),
        };
        const pending = comparison;
        pending.result.catch(() => {
          if (comparison === pending) comparison = undefined;
        });
      }
      return comparison.result;
    },
    async receive(update: Uint8Array, verify: (blobs: DocumentBlob[]) => Promise<void>) {
      while (true) {
        let snapshot: Snapshot | undefined;
        const candidate = await runBinaryTask(async () => {
          snapshot = await load();
          return { kind: "receive", local: snapshot.updates, update };
        }, signal);
        if (candidate.rejected.length) return false;
        await verify(candidate.blobs);
        signal.throwIfAborted();
        const captured = snapshot!;
        if (store.receive) {
          if (await store.receive(owner, captured.revision, update, signal)) return true;
          continue;
        }
        const accepted = await store.transaction(owner, async (state) => {
          signal.throwIfAborted();
          const sameDocument =
            captured.document === state.document && captured.revision === documentRevision(state.document);
          const sameRevision = !captured.document && state.revision === captured.revision;
          if (!sameDocument && !sameRevision) return false;
          applyDocumentUpdate(state, update);
          return true;
        });
        if (accepted) return true;
      }
    },
  };
};
