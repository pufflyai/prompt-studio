import { createHash } from "node:crypto";
import { and, asc, eq, gt, isNotNull, or, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import type { DbClient } from "../../db/connection.pglite";
import { documents } from "../../db/schemas/documents";
import { file_projections as projections } from "../../db/schemas/file-projections";
import { owners as storageOwners } from "../../db/schemas/owners";
import { assertStorageOwnerAdmitted, storageOwnerAdmissionPending } from "../../db/storage-admission";
import { documentFilesFor, trackDocumentFiles } from "./document-files";
import { ensureNativeSource } from "./native-document-files";
import { storageOwnerKey } from "./storage-owner-key";

interface Address {
  owner: StorageOwner;
  documentKey: string;
  projectionKey?: string;
}
const root = (key = "handler") => JSON.stringify(["native", key]);
const where = (input: Address) =>
  and(
    eq(projections.owner_id, storageOwnerKey(input.owner)),
    eq(projections.root, root(input.projectionKey)),
    eq(projections.path, input.documentKey),
  );
const digest = (state: Uint8Array) => createHash("sha256").update(state).digest("hex");
const pendingMatches = (state: Uint8Array) =>
  and(eq(projections.pending_sha256, digest(state)), eq(projections.pending_bytes, state.length));

export const createNativeFileProjectionsDBService = (db: DbClient) => {
  const write = async (input: Address & { state: Uint8Array }, field: "baseline" | "pending") => {
    assertStorageOwnerAdmitted(db, input.owner);
    await db.transaction(async (tx) => {
      const files = documentFilesFor(tx);
      const [row] = await tx.select().from(projections).where(where(input)).for("update");
      if (!row) return;
      trackDocumentFiles(tx, input.owner.workbenchId, row.document_id!);
      const reference = await files.put(input.owner.workbenchId, row.document_id!, "copy", input.state);
      await tx
        .update(projections)
        .set({ [`${field}_sha256`]: reference.sha256, [`${field}_bytes`]: reference.bytes })
        .where(where(input));
    });
  };
  return {
    async copies({ owner, documentKey }: Address) {
      assertStorageOwnerAdmitted(db, owner);
      const rows = await db
        .select({ root: projections.root })
        .from(projections)
        .where(
          and(
            eq(projections.owner_id, storageOwnerKey(owner)),
            eq(projections.path, documentKey),
            sql`starts_with(${projections.root}, '["native",')`,
          ),
        );
      return rows.map(({ root }) => (JSON.parse(root) as string[])[1]!);
    },
    async initialize(input: Address & { state: Uint8Array | null }) {
      assertStorageOwnerAdmitted(db, input.owner);
      await db.transaction(async (tx) => {
        const files = documentFilesFor(tx);
        const [existing] = await tx.select().from(projections).where(where(input));
        if (existing) return;
        const document = await ensureNativeSource(tx, input.owner, input.documentKey);
        trackDocumentFiles(tx, input.owner.workbenchId, document.id);
        const baseline =
          input.state === null ? undefined : await files.put(input.owner.workbenchId, document.id, "copy", input.state);
        await tx
          .insert(projections)
          .values({
            owner_id: document.owner_id,
            root: root(input.projectionKey),
            path: input.documentKey,
            document_id: document.id,
            baseline_sha256: baseline?.sha256,
            baseline_bytes: baseline?.bytes,
          })
          .onConflictDoNothing();
      });
    },
    async read(input: Address) {
      assertStorageOwnerAdmitted(db, input.owner);
      return db.transaction(async (tx) => {
        const files = documentFilesFor(tx);
        const [row] = await tx.select().from(projections).where(where(input));
        if (!row) return undefined;
        const read = (sha256: string | null, bytes: number | null) =>
          sha256 === null || bytes === null
            ? null
            : files.read(input.owner.workbenchId, row.document_id!, "copy", { sha256, bytes });
        return {
          baseline: await read(row.baseline_sha256, row.baseline_bytes),
          pending: await read(row.pending_sha256, row.pending_bytes),
          completedRevision: row.completed_revision,
        };
      });
    },
    baseline: (input: Address & { state: Uint8Array }) => write(input, "baseline"),
    begin: (input: Address & { state: Uint8Array }) => write(input, "pending"),
    async complete(input: Address & { state: Uint8Array; revision?: number }) {
      assertStorageOwnerAdmitted(db, input.owner);
      return db.transaction(async (tx) => {
        const rows = await tx
          .update(projections)
          .set({
            baseline_sha256: digest(input.state),
            baseline_bytes: input.state.length,
            pending_sha256: null,
            pending_bytes: null,
            ...(input.revision !== undefined && { completed_revision: input.revision }),
          })
          .where(and(where(input), pendingMatches(input.state)))
          .returning({ id: projections.document_id });
        for (const row of rows) trackDocumentFiles(tx, input.owner.workbenchId, row.id!);
        return rows.length > 0;
      });
    },
    async cancel(input: Address & { state: Uint8Array }) {
      assertStorageOwnerAdmitted(db, input.owner);
      await db.transaction(async (tx) => {
        const rows = await tx
          .update(projections)
          .set({ pending_sha256: null, pending_bytes: null })
          .where(and(where(input), pendingMatches(input.state)))
          .returning({ id: projections.document_id });
        for (const row of rows) trackDocumentFiles(tx, input.owner.workbenchId, row.id!);
      });
    },
    async *pending(workbenchId?: string) {
      let cursor: string[] | undefined;
      while (true) {
        const rows = await db
          .select({
            workbenchId: storageOwners.project_id,
            extensionId: storageOwners.extension_id,
            documentKey: projections.path,
          })
          .from(projections)
          .innerJoin(storageOwners, eq(storageOwners.id, projections.owner_id))
          .leftJoin(documents, eq(documents.id, projections.document_id))
          .where(
            and(
              or(isNotNull(projections.pending_sha256), gt(documents.revision, projections.completed_revision)),
              eq(projections.root, root()),
              workbenchId ? eq(storageOwners.project_id, workbenchId) : undefined,
              cursor
                ? sql`(${storageOwners.project_id},${storageOwners.extension_id},${projections.path}) > (${cursor[0]},${cursor[1]},${cursor[2]})`
                : undefined,
            ),
          )
          .orderBy(asc(storageOwners.project_id), asc(storageOwners.extension_id), asc(projections.path))
          .limit(100);
        for (const { workbenchId, extensionId, documentKey } of rows)
          if (!storageOwnerAdmissionPending(db, { workbenchId, extensionId }))
            yield { owner: { workbenchId, extensionId }, documentKey };
        if (rows.length < 100) return;
        const last = rows.at(-1)!;
        cursor = [last.workbenchId, last.extensionId, last.documentKey];
      }
    },
  };
};
