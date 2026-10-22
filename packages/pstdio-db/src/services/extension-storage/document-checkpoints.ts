import { and, eq, gte, lte } from "drizzle-orm";
import { acceptDocumentCheckpoint, documentRevision, runBinaryTask } from "pstdio-sync";
import type * as Y from "yjs";
import type { DbClient } from "../../db/connection.pglite";
import { storage_document_updates, storage_documents } from "../../db/schemas.pg";
import { type DocumentAddress, documentWhere, foldEvery, updatesWhere } from "./document-persistence";
import type { StorageDiagnostics } from "./storage-diagnostics";

export const readDocumentSnapshot = async (
  db: DbClient,
  address: DocumentAddress,
  knownRevision?: number,
  throughRevision?: number,
) =>
  db.transaction(async (tx) => {
    const [row] = await tx
      .select({ revision: storage_documents.revision, folded_revision: storage_documents.folded_revision })
      .from(storage_documents)
      .where(documentWhere(address))
      .for("share");
    if (!row) return undefined;
    if (throughRevision !== undefined && row.folded_revision > throughRevision) return undefined;
    if (row.revision === knownRevision)
      return { revision: row.revision, foldedRevision: row.folded_revision, updates: [] };
    const [saved] = await tx
      .select({ state: storage_documents.state })
      .from(storage_documents)
      .where(documentWhere(address));
    const tail = await tx
      .select()
      .from(storage_document_updates)
      .where(and(updatesWhere(address), lte(storage_document_updates.revision, throughRevision ?? row.revision)))
      .orderBy(storage_document_updates.revision);
    return {
      revision: throughRevision ?? row.revision,
      foldedRevision: row.folded_revision,
      updates: [saved.state, ...tail.map(({ update }) => update)],
    };
  });

export const saveDocumentCheckpoint = async (
  db: DbClient,
  address: DocumentAddress,
  checkpoint: { state: Uint8Array; revision: number; foldedRevision: number },
) =>
  db.transaction(async (tx) => {
    const updated = await tx
      .update(storage_documents)
      .set({ state: checkpoint.state, folded_revision: checkpoint.revision })
      .where(
        and(
          documentWhere(address),
          eq(storage_documents.folded_revision, checkpoint.foldedRevision),
          gte(storage_documents.revision, checkpoint.revision),
        ),
      )
      .returning({ revision: storage_documents.revision });
    // A purge or another checkpoint changed the baseline. Never resurrect it.
    if (!updated.length) return false;
    await tx
      .delete(storage_document_updates)
      .where(and(updatesWhere(address), lte(storage_document_updates.revision, checkpoint.revision)));
    return true;
  });

export const createDocumentCheckpoints = (db: DbClient, diagnostics?: StorageDiagnostics) => {
  const pending = new Map<string, Promise<void>>();
  const errors = new Map<string, unknown>();
  const requested = new Map<
    string,
    { address: DocumentAddress; reference: WeakRef<Y.Doc>; revision: number; sequence: number }
  >();
  const start = (key: string) => {
    const job = (async () => {
      while (requested.has(key)) {
        const { address, reference, revision, sequence } = requested.get(key)!;
        requested.delete(key);
        const report = (
          phase: "checkpoint-captured" | "checkpoint-compacted" | "checkpoint-persisted",
          bytes: number,
        ) =>
          diagnostics?.({
            phase,
            owner: { workbenchId: address.workbench_id, extensionId: address.extension_id },
            bytes,
          });
        let snapshot: Awaited<ReturnType<typeof readDocumentSnapshot>>;
        const prepared = await runBinaryTask(async () => {
          snapshot = await readDocumentSnapshot(db, address, undefined, revision);
          if (snapshot && snapshot.revision - snapshot.foldedRevision < foldEvery) snapshot = undefined;
          if (snapshot && diagnostics)
            report(
              "checkpoint-captured",
              snapshot.updates.reduce((sum, update) => sum + update.length, 0),
            );
          return { kind: "compact", updates: snapshot?.updates ?? [new Uint8Array([0, 0])] };
        });
        if (!snapshot) continue;
        report("checkpoint-compacted", prepared.state.length);
        const accepted = await saveDocumentCheckpoint(db, address, {
          state: prepared.state,
          revision,
          foldedRevision: snapshot.foldedRevision,
        });
        const document = reference.deref();
        if (accepted && document) acceptDocumentCheckpoint(document, sequence, prepared.state);
        if (accepted) report("checkpoint-persisted", prepared.state.length);
        errors.delete(key);
      }
    })()
      .catch((error: unknown) => {
        errors.set(key, error);
        requested.delete(key);
      })
      .finally(() => {
        pending.delete(key);
        if (requested.has(key)) start(key);
      });
    pending.set(key, job);
  };
  const schedule = (
    address: DocumentAddress,
    loaded: { document: Y.Doc; revision: number; foldedRevision: number },
  ) => {
    if (loaded.revision - loaded.foldedRevision < foldEvery) return;
    const key = JSON.stringify(address);
    requested.set(key, {
      address,
      reference: new WeakRef(loaded.document),
      revision: loaded.revision,
      sequence: documentRevision(loaded.document),
    });
    if (!pending.has(key)) start(key);
  };
  return {
    schedule,
    async flush() {
      while (pending.size) await Promise.all(pending.values());
      if (errors.size) throw errors.values().next().value;
    },
  };
};
