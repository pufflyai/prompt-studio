import { and, eq, inArray } from "drizzle-orm";
import type { ResourceRenumberedEvent } from "pstdio-api-contracts/extension-kernel";
import { coreOwnerId, editResourceDocument, type StorageOwner } from "pstdio-sync";
import type { StorageRecord } from "pstdio-sync-contracts";
import type { DbClient } from "../../db/connection.pglite";
import { storage_resource_identities as identities } from "../../db/schemas.pg";
import type { RecordChange } from "./record-changes";
import { readProjectedRecords } from "./record-queries";
import { loadResourceDocuments, resourceDocumentId } from "./resource-document-persistence";
import {
  isNumberRecord,
  nextIndexedNumber,
  numberCollisions,
  numberValue,
  projectNumberRecords,
} from "./resource-number-records";

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
export type NumberChange = ResourceRenumberedEvent & { projectId: string };

export const previousNumbers = async (tx: Transaction, owner: StorageOwner, ids: string[]) => {
  const result = new Map<string, string>();
  if (owner.extensionId !== coreOwnerId) return result;
  for (let offset = 0; offset < ids.length; offset += 1_000) {
    const rows = await tx
      .select()
      .from(identities)
      .where(
        and(
          eq(identities.workbench_id, owner.workbenchId),
          inArray(identities.resource_id, ids.slice(offset, offset + 1_000)),
        ),
      );
    for (const row of rows) result.set(row.resource_id, row.shorthand);
  }
  return result;
};

/** Repairs touched collision groups under the record owner lock. IDs, rather than clocks, decide. */
export const repairNumberRecords = async (
  tx: Transaction,
  owner: StorageOwner,
  records: StorageRecord[],
  revision: number,
  before: Map<string, string>,
) => {
  const changes: RecordChange[] = [];
  const final = new Map(records.map((record) => [record.recordId, record]));
  for (const row of await numberCollisions(tx, owner, records)) {
    const id = row.resource_id;
    if (!before.has(id)) before.set(id, row.shorthand);
    const [record] = await readProjectedRecords(tx, owner, [id]);
    const resource = numberValue(record!);
    const value = await nextIndexedNumber(tx, owner.workbenchId, resource.prefix);
    const documentId = resourceDocumentId(id);
    const { sources } = await loadResourceDocuments(tx, owner, [documentId]);
    const source = sources.get(documentId)!;
    const result = await editResourceDocument(
      source.states,
      {
        recordId: id,
        replace: {
          ...resource,
          value,
          aliases: [...new Set([...resource.aliases, row.shorthand, `${resource.prefix}-${value}`])].sort(),
        },
      },
      true,
    );
    changes.push({ id: documentId, revision: source.revision + 1, foldedRevision: source.folded_revision, ...result });
    final.set(id, result.record);
    // The next loser must see this assignment before choosing its own number.
    await projectNumberRecords(tx, owner, [result.record], revision);
  }
  const events: NumberChange[] = [];
  if (owner.extensionId === coreOwnerId)
    for (const record of final.values()) {
      if (!isNumberRecord(record)) continue;
      const resource = numberValue(record);
      const shorthand = `${resource.prefix}-${resource.value}`;
      const previousShorthand = before.get(record.recordId);
      if (previousShorthand && previousShorthand !== shorthand)
        events.push({
          projectId: owner.workbenchId,
          resource: {
            type: resource.kind,
            id: resource.id,
            extensionId: resource.extensionId,
            projectId: owner.workbenchId,
          },
          previousShorthand,
          shorthand,
        });
    }
  return { changes, events, records: [...final.values()] };
};
