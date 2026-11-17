import { and, eq } from "drizzle-orm";
import { createStorageId } from "pstdio-api-contracts";
import { coreOwnerId } from "pstdio-sync/records";
import type * as Y from "yjs";
import type { DbClient } from "../db/connection.pglite";
import { extension_resource_sequences as sequences } from "../db/schemas.pg";
import { createDocumentStorageDBService } from "./extension-storage/document-storage";
import { nextIndexedNumber } from "./extension-storage/resource-number-records";
import { createResourceIdentityIndex } from "./resource-identity-index";
import { importResourceNumbers, upgradeResourceNumbers } from "./resource-number-upgrade";

interface AllocationInput {
  projectId: string;
  extensionId: string;
  kind: string;
  prefix: string;
  idPrefix?: string;
}

export const createExtensionResourceSequencesDBService = (
  db: DbClient,
  documents = createDocumentStorageDBService(db),
) => {
  let upgrade: Promise<void> | undefined;
  const ready = () =>
    (upgrade ??= upgradeResourceNumbers(db, documents).catch((error) => {
      upgrade = undefined;
      throw error;
    }));
  const { identity, identityMany, findByShorthand } = createResourceIdentityIndex(db, ready);
  const owner = (projectId: string) => ({ workbenchId: projectId, extensionId: coreOwnerId });

  // One transaction and one save for the whole batch; numbers are consecutive after the highest indexed one.
  const allocateMany = async (input: AllocationInput & { count: number }) => {
    if (!Number.isInteger(input.count) || input.count < 1 || input.count > 100)
      throw new Error("Allocate 1 to 100 resource numbers at a time.");
    await ready();
    const ids = Array.from({ length: input.count }, () => createStorageId(input.idPrefix));
    const timestamp = new Date().toISOString();
    try {
      return await documents.open({ owner: owner(input.projectId) }).records.transaction(async (records, tx) => {
        const [row] = await tx
          .insert(sequences)
          .values({
            project_id: input.projectId,
            extension_id: input.extensionId,
            kind: input.kind,
            prefix: input.prefix,
            next_value: 1,
            created_at: timestamp,
            updated_at: timestamp,
          })
          .onConflictDoUpdate({
            target: [sequences.project_id, sequences.extension_id, sequences.kind],
            set: { updated_at: timestamp },
          })
          .returning();
        const first = await nextIndexedNumber(tx, input.projectId, row!.prefix);
        const resources = ids.map((id, index) => ({
          id,
          extensionId: input.extensionId,
          kind: input.kind,
          prefix: row!.prefix,
          value: first + index,
          aliases: [],
        }));
        await records.commit({
          operationId: ids[0]!,
          edits: resources.map((resource) => ({ recordId: resource.id, replace: resource })),
        });
        return resources.map((resource) => ({ id: resource.id, shorthand: `${resource.prefix}-${resource.value}` }));
      });
    } catch (error) {
      const [owner] = await db
        .select()
        .from(sequences)
        .where(and(eq(sequences.project_id, input.projectId), eq(sequences.prefix, input.prefix)));
      if (owner && (owner.extension_id !== input.extensionId || owner.kind !== input.kind)) {
        throw new Error(
          `Resource prefix "${input.prefix}" belongs to ${owner.extension_id}/${owner.kind}; ${input.extensionId}/${input.kind} cannot claim it.`,
          { cause: error },
        );
      }
      throw error;
    }
  };
  const allocate = async (input: AllocationInput) => (await allocateMany({ ...input, count: 1 }))[0]!;
  return {
    flush: async () => {
      await upgrade?.catch(() => {});
      await documents.flushStatistics();
    },
    allocate,
    allocateMany,
    identity,
    identityMany,
    findByShorthand,
    watch: documents.watchNumbers,
    watchChanges: documents.watch,
    importLegacy: async (projectId: string, document: Y.Doc) => {
      await ready();
      await documents
        .open({ owner: owner(projectId) })
        .records.transaction((records) => importResourceNumbers(records, document));
      await documents.flushStatistics();
    },
    recordStream: (projectId: string) => {
      const store = documents.documents.recordStream(owner(projectId));
      return {
        ...store,
        open: async () => {
          await ready();
          return store.open();
        },
        snapshot: async (...input: Parameters<typeof store.snapshot>) => {
          await ready();
          return store.snapshot(...input);
        },
        apply: async (...input: Parameters<typeof store.apply>) => {
          await ready();
          return store.apply(...input);
        },
        merge: async (...input: Parameters<typeof store.merge>) => {
          await ready();
          return store.merge(...input);
        },
      };
    },
  };
};
