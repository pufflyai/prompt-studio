import { statfs } from "node:fs/promises";
import { and, asc, eq, ne } from "drizzle-orm";
import { restoreDocument, type StorageOwner } from "pstdio-sync";
import type { DbClient } from "../../db/connection.pglite";
import { document_snapshots, projects, storage_documents } from "../../db/schemas.pg";
import { createEnvironmentDBService } from "../environment/environment";
import { runDocumentTransaction } from "./document-persistence";
import { captureSnapshotContent, readSnapshotContent, type SnapshotTransaction } from "./snapshot-content";

export class SnapshotSelectionError extends Error {}
const hourMs = 3_600_000;
const dueHours = (rows: Array<{ hours: number; captured_at: string }>, now: Date) =>
  [12, 24, 1].filter((hours) => {
    const previous = rows.find((row) => row.hours === hours);
    return !previous || now.getTime() - Date.parse(previous.captured_at) >= hours * hourMs;
  });
const isDiskFull = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? error.code : undefined;
  return code === "ENOSPC" || code === "53100" || ("cause" in error && isDiskFull(error.cause));
};

export const createDocumentSnapshots = (
  db: DbClient,
  options: {
    path?: string;
    freeBytes?: () => Promise<number>;
    restored?: (owner: StorageOwner) => void;
  } = {},
) => {
  const freeBytes =
    options.freeBytes ??
    (async () => {
      const fs = await statfs(options.path ?? process.cwd());
      return fs.bavail * fs.bsize;
    });
  const where = (id: string) => eq(document_snapshots.workbench_id, id);
  const lock = async (tx: SnapshotTransaction, id: string) => {
    const [project] = await tx.select({ id: projects.id }).from(projects).where(eq(projects.id, id)).for("update");
    if (!project) throw new SnapshotSelectionError("Project not found");
  };
  const keepTwelve = (tx: SnapshotTransaction, id: string) =>
    tx.delete(document_snapshots).where(and(where(id), ne(document_snapshots.hours, 12)));
  const save = (tx: SnapshotTransaction, projectId: string, hours: number, capturedAt: string, state: Uint8Array) =>
    tx
      .insert(document_snapshots)
      .values({ workbench_id: projectId, hours, captured_at: capturedAt, state })
      .onConflictDoUpdate({
        target: [document_snapshots.workbench_id, document_snapshots.hours],
        set: { captured_at: capturedAt, state },
      });
  const captureLimited = async (
    tx: SnapshotTransaction,
    projectId: string,
    now: Date,
    state: Uint8Array,
    rows: Array<{ hours: number; captured_at: string }>,
  ) => {
    await keepTwelve(tx, projectId);
    if (dueHours(rows, now).includes(12) && (await freeBytes()) >= state.byteLength) {
      await save(tx, projectId, 12, now.toISOString(), state);
      return;
    }
    if (rows.some((row) => row.hours === 12)) return;
    throw new Error("Not enough disk space for a recovery snapshot");
  };
  const capture = async (projectId: string, now = new Date()) => {
    try {
      await db.transaction(async (tx) => {
        await lock(tx, projectId);
        const rows = await tx.select().from(document_snapshots).where(where(projectId));
        const due = dueHours(rows, now);
        if (!due.length) return;
        const state = await captureSnapshotContent(tx, projectId);
        if (readSnapshotContent(state).length === 0) return;
        if ((await freeBytes()) < state.byteLength * due.length) {
          return captureLimited(tx, projectId, now, state, rows);
        }
        for (const hours of due) await save(tx, projectId, hours, now.toISOString(), state);
      });
    } catch (error) {
      if (!isDiskFull(error)) throw error;
      // The failed write rolled back. Release the optional slots in a separate durable transaction.
      await db.transaction(async (tx) => {
        await lock(tx, projectId);
        await keepTwelve(tx, projectId);
      });
      await db.transaction(async (tx) => {
        await lock(tx, projectId);
        const rows = await tx.select().from(document_snapshots).where(where(projectId));
        if (!dueHours(rows, now).includes(12)) return;
        const state = await captureSnapshotContent(tx, projectId);
        if (readSnapshotContent(state).length > 0) await save(tx, projectId, 12, now.toISOString(), state);
      });
    }
  };
  return {
    capture,
    async projects() {
      const rows = await db.selectDistinct({ id: document_snapshots.workbench_id }).from(document_snapshots);
      return rows.map((row) => row.id);
    },
    async list(projectId: string) {
      const current = await db
        .selectDistinct({ id: storage_documents.extension_id })
        .from(storage_documents)
        .where(eq(storage_documents.workbench_id, projectId));
      const rows = await db
        .select()
        .from(document_snapshots)
        .where(where(projectId))
        .orderBy(asc(document_snapshots.hours));
      return rows.map((row) => ({
        hours: row.hours as 1 | 12 | 24,
        capturedAt: row.captured_at,
        extensions: [
          ...new Set([
            ...current.map((row) => row.id),
            ...readSnapshotContent(row.state).map((document) => document.extensionId),
          ]),
        ].sort(),
      }));
    },
    async restore(projectId: string, input: { hours: number; capturedAt: string; extensionId?: string }) {
      const { environmentId } = await createEnvironmentDBService(db).get();
      const owners = await db.transaction(async (tx) => {
        await lock(tx, projectId);
        const [selected] = await tx
          .select()
          .from(document_snapshots)
          .where(and(where(projectId), eq(document_snapshots.hours, input.hours)));
        if (!selected || selected.captured_at !== input.capturedAt)
          throw new SnapshotSelectionError("Snapshot changed or is unavailable. Refresh the recovery points.");
        const content = readSnapshotContent(selected.state);
        const current = await tx.select().from(storage_documents).where(eq(storage_documents.workbench_id, projectId));
        if (
          input.extensionId &&
          ![...content.map((doc) => doc.extensionId), ...current.map((row) => row.extension_id)].includes(
            input.extensionId,
          )
        )
          throw new SnapshotSelectionError("Extension not found");
        const addresses = new Map(
          [...current.map((row) => ({ extensionId: row.extension_id, documentId: row.document_id })), ...content]
            .filter((doc) => !input.extensionId || doc.extensionId === input.extensionId)
            .map((doc) => [JSON.stringify([doc.extensionId, doc.documentId]), doc]),
        );
        // Preserve the pre-restore state in an existing slot so this restore can itself be undone.
        const slots = await tx
          .select({ hours: document_snapshots.hours })
          .from(document_snapshots)
          .where(where(projectId));
        await save(
          tx,
          projectId,
          slots.some((slot) => slot.hours === 1) ? 1 : 12,
          new Date().toISOString(),
          await captureSnapshotContent(tx, projectId),
        );
        const changed = new Set<string>();
        for (const doc of addresses.values()) {
          const owner = { workbenchId: projectId, extensionId: doc.extensionId };
          const saved = content.find((row) => row.extensionId === doc.extensionId && row.documentId === doc.documentId);
          const result = await runDocumentTransaction(
            tx,
            {
              address: { workbench_id: projectId, extension_id: doc.extensionId, document_id: doc.documentId },
              owner,
              environmentId,
            },
            async ({ document }) =>
              restoreDocument(
                document,
                saved ? Buffer.from(saved.state, "base64") : new Uint8Array([0, 0]),
                doc.documentId,
              ),
          );
          result.document.destroy();
          if (result.changed) changed.add(doc.extensionId);
        }
        return [...changed];
      });
      for (const extensionId of owners) options.restored?.({ workbenchId: projectId, extensionId });
      return { restored: owners.length };
    },
  };
};
