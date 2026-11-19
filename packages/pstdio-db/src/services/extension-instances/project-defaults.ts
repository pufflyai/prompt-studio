import { and, eq } from "drizzle-orm";
import * as Y from "yjs";
import type { DbClient } from "../../db/connection.pglite";
import { extension_instances, installed_extension_sources, storage_documents } from "../../db/schemas.pg";

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
const receiptId = (extensionId: string) => JSON.stringify(["host-local-migration", "default-extension", extensionId]);

export const hasProjectDefaultChoice = async (db: DbClient, projectId: string, extensionId: string) => {
  const [row] = await db
    .select({ documentId: storage_documents.document_id })
    .from(storage_documents)
    .where(
      and(
        eq(storage_documents.workbench_id, projectId),
        eq(storage_documents.extension_id, "pstdio"),
        eq(storage_documents.document_id, receiptId(extensionId)),
      ),
    );
  return !!row;
};

// Like identity conversion, adoption is a host-local migration. Keeping the receipt
// outside the install row preserves an uninstall and keeps it out of Cloud content.
export const recordProjectDefaultChoice = (db: DbClient | Transaction, projectId: string, extensionId: string) => {
  const document = new Y.Doc();
  document.getMap("data-migrations").set("adopted", 1);
  const state = Y.encodeStateAsUpdate(document);
  document.destroy();
  return db
    .insert(storage_documents)
    .values({
      workbench_id: projectId,
      extension_id: "pstdio",
      document_id: receiptId(extensionId),
      state,
    })
    .onConflictDoNothing()
    .returning();
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
    const providers = await tx
      .select({ instance: extension_instances })
      .from(extension_instances)
      .innerJoin(
        installed_extension_sources,
        eq(extension_instances.installed_extension_id, installed_extension_sources.id),
      )
      .where(
        and(
          eq(extension_instances.scope_type, "project"),
          eq(extension_instances.scope_id, input.projectId),
          eq(installed_extension_sources.extension_id, input.extensionId),
        ),
      );
    if (providers.some(({ instance }) => instance.enabled)) return null;
    const timestamp = new Date().toISOString();
    const [instance] = await tx
      .insert(extension_instances)
      .values({
        id: crypto.randomUUID(),
        installed_extension_id: source.id,
        scope_type: "project",
        scope_id: input.projectId,
        enabled: true,
        created_at: timestamp,
        updated_at: timestamp,
      })
      .onConflictDoUpdate({
        target: [
          extension_instances.scope_type,
          extension_instances.scope_id,
          extension_instances.installed_extension_id,
        ],
        set: { enabled: true, updated_at: timestamp },
      })
      .returning();
    return instance!;
  });
