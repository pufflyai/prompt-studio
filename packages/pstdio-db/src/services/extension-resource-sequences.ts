import { and, eq, sql } from "drizzle-orm";
import { createStorageId } from "pstdio-api-contracts";
import { coreOwnerId } from "pstdio-sync";
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
  const ready = () => (upgrade ??= upgradeResourceNumbers(db, documents));
  const { identity, identityMany, findByShorthand } = createResourceIdentityIndex(db, ready);
  const owner = (projectId: string) => ({ workbenchId: projectId, extensionId: coreOwnerId });

  const allocate = async (input: AllocationInput) => {
    await ready();
    const id = createStorageId(input.idPrefix);
    const timestamp = new Date().toISOString();
    try {
      const allocated = await documents
        .open({ owner: owner(input.projectId) })
        .records.transaction(async (records, tx) => {
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
              set: { next_value: sql`${sequences.next_value} + 1`, updated_at: timestamp },
            })
            .returning();
          const resource = {
            id,
            extensionId: input.extensionId,
            kind: input.kind,
            prefix: row!.prefix,
            value: await nextIndexedNumber(tx, input.projectId, row!.prefix, row!.next_value - 1),
            aliases: [],
          };
          await records.commit({ operationId: id, edits: [{ recordId: id, replace: resource }] });
          return { id, shorthand: `${resource.prefix}-${resource.value}` };
        });
      return allocated;
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
  return {
    flush: async () => {
      await upgrade;
      await documents.flushStatistics();
    },
    allocate,
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
        snapshot: async () => {
          await ready();
          return store.snapshot();
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
