import { and, eq } from "drizzle-orm";
import * as Y from "yjs";
import type { DbClient } from "../../db/connection.pglite";
import { documents as storage_documents } from "../../db/schemas/documents";
import { installed_extension_sources, project_extensions } from "../../db/schemas.pg";
import { ensureFileDocument, saveFileDocumentState } from "../extension-storage/document-file-persistence";
import { documentFilesFor, withDocumentFileTransaction } from "../extension-storage/document-files";
import { storageOwnerKey } from "../extension-storage/storage-owner-key";
import { findProjectExtension } from "./activate-project-sources";
import { projectExtensionRow } from "./project-extension-row";

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
const receiptId = (extensionId: string) => JSON.stringify(["host-local-migration", "default-extension", extensionId]);

export const hasProjectDefaultChoice = async (db: DbClient, projectId: string, extensionId: string) => {
  const [row] = await db
    .select({ documentId: storage_documents.key })
    .from(storage_documents)
    .where(
      and(
        eq(storage_documents.owner_id, storageOwnerKey({ workbenchId: projectId, extensionId: "pstdio" })),
        eq(storage_documents.key, receiptId(extensionId)),
      ),
    );
  return !!row;
};

// Like identity conversion, adoption is a host-local migration. Keeping the receipt
// outside the install row preserves an uninstall and keeps it out of Cloud content.
export const recordProjectDefaultChoice = async (
  db: DbClient | Transaction,
  projectId: string,
  extensionId: string,
) => {
  const document = new Y.Doc();
  document.getMap("data-migrations").set("adopted", 1);
  const state = Y.encodeStateAsUpdate(document);
  document.destroy();
  return withDocumentFileTransaction(db, async (tx) => {
    const owner = { workbenchId: projectId, extensionId: "pstdio" };
    const { row, initialize } = await ensureFileDocument(tx, documentFilesFor(tx), {
      owner,
      key: receiptId(extensionId),
      kind: "local",
    });
    if (!initialize) return [];
    await saveFileDocumentState(tx, owner, receiptId(extensionId), state);
    return [row];
  });
};

/** Adopt an extracted host tool once, even if discovery already attached it disabled. */
export const adoptProjectDefault = (
  db: DbClient,
  input: { projectId: string; extensionId: string; installedSourceId: string },
) =>
  db.transaction(async (tx) => {
    const [source] = await tx
      .select()
      .from(installed_extension_sources)
      .where(
        and(
          eq(installed_extension_sources.id, input.installedSourceId),
          eq(installed_extension_sources.extension_id, input.extensionId),
        ),
      );
    if (!source) throw new Error("Default extension source is unavailable");
    if (!(await recordProjectDefaultChoice(tx, input.projectId, input.extensionId)).length) return null;
    const existing = await findProjectExtension(tx, input.projectId, input.extensionId);
    if (existing && (existing.enabled || existing.installed_extension_id !== source.id)) return null;
    const timestamp = new Date().toISOString();
    const [instance] = await tx
      .insert(project_extensions)
      .values({
        extension_ref: source.id,
        project_id: input.projectId,
        enabled: true,
        created_at: timestamp,
        updated_at: timestamp,
      })
      .onConflictDoUpdate({
        target: [project_extensions.project_id, project_extensions.extension_ref],
        set: { enabled: true, updated_at: timestamp },
      })
      .returning();
    return projectExtensionRow(instance!);
  });
