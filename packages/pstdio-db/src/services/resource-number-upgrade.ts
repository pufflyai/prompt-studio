import { and, eq } from "drizzle-orm";
import { coreOwnerId, resourceNumbers, resourceNumbersDocumentId, resourceShorthand } from "pstdio-sync/records";
import { fingerprint } from "pstdio-sync-contracts";
import type * as Y from "yjs";
import type { DbClient } from "../db/connection.pglite";
import { storage_documents, storage_resource_aliases, storage_resource_identities } from "../db/schemas.pg";
import { dataMigrationContext } from "./extension-storage/data-migration-context";
import { runDocumentTransaction } from "./extension-storage/document-persistence";
import type { createDocumentStorageDBService } from "./extension-storage/document-storage";
import { numberValue } from "./extension-storage/resource-number-records";

type NumberRecords = Parameters<
  Parameters<ReturnType<ReturnType<typeof createDocumentStorageDBService>["open"]>["records"]["transaction"]>[0]
>[0];

/** Imports a local or remote old source. Existing new-format saves keep their current number. */
export const importResourceNumbers = async (records: NumberRecords, document: Y.Doc) => {
  const history = new Map<string, Set<string>>();
  for (const key of document.getMap("resource-number-history").keys()) {
    const [id, shorthand] = JSON.parse(key) as [string, string];
    const values = history.get(id) ?? new Set<string>();
    values.add(shorthand);
    history.set(id, values);
  }
  const values = [...resourceNumbers(document).values()];
  for (let offset = 0; offset < values.length; offset += 100) {
    const edits = [];
    const batch = values.slice(offset, offset + 100);
    const savedRecords = await records.readMany(batch.map((resource) => resource.id));
    for (const [index, resource] of batch.entries()) {
      const saved = savedRecords[index]!;
      const current = saved.exists && !saved.deleted ? numberValue(saved) : { ...resource, aliases: [] };
      const aliases = [
        ...new Set([...current.aliases, ...(history.get(resource.id) ?? []), resourceShorthand(resource)]),
      ].sort();
      edits.push({ recordId: resource.id, replace: { ...current, aliases } });
    }
    await records.commit({ operationId: `number-upgrade:${await fingerprint(edits)}`, edits });
  }
};

/** The old source is removed with the last record save, so a failed or interrupted move rolls back. */
export const upgradeResourceNumbers = async (
  db: DbClient,
  documents: ReturnType<typeof createDocumentStorageDBService>,
) => {
  const owners = await db
    .select({ workbenchId: storage_documents.workbench_id })
    .from(storage_documents)
    .where(
      and(
        eq(storage_documents.extension_id, coreOwnerId),
        eq(storage_documents.document_id, resourceNumbersDocumentId),
      ),
    );
  for (const { workbenchId } of owners) {
    const owner = { workbenchId, extensionId: coreOwnerId };
    const address = { workbench_id: workbenchId, extension_id: coreOwnerId, document_id: resourceNumbersDocumentId };
    await documents.open({ owner }).records.transaction(async (records, tx) => {
      const where = and(
        eq(storage_documents.workbench_id, workbenchId),
        eq(storage_documents.extension_id, coreOwnerId),
        eq(storage_documents.document_id, resourceNumbersDocumentId),
      );
      if (!(await tx.select().from(storage_documents).where(where)).length) return;
      // The old projection may lag its source. Rebuild it, rather than carrying ghost rows forward.
      await tx.delete(storage_resource_aliases).where(eq(storage_resource_aliases.workbench_id, workbenchId));
      await tx.delete(storage_resource_identities).where(eq(storage_resource_identities.workbench_id, workbenchId));
      await dataMigrationContext.run({ key: "core-resource-number-records-v1", histories: new Map() }, async () => {
        const loaded = await runDocumentTransaction(tx, { owner, address }, async ({ document }) => {
          await importResourceNumbers(records, document);
        });
        loaded.document.destroy();
        await tx.delete(storage_documents).where(where);
      });
    });
  }
};
