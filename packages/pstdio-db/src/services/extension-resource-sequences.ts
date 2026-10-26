import { and, eq, sql } from "drizzle-orm";
import { createStorageId } from "pstdio-api-contracts";
import {
  coreOwnerId,
  nextResourceNumber,
  rememberResourceNumber,
  resourceIdentity,
  resourceNumbers,
} from "pstdio-sync";
import type { DbClient } from "../db/connection.pglite";
import { extension_resource_sequences as sequences } from "../db/schemas.pg";
import { createDocumentStorageDBService } from "./extension-storage/document-storage";
import { createResourceIdentityIndex, upgradeResourceIdentityIndexes } from "./resource-identity-index";
import { createResourceNumberStore } from "./resource-number-store";

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
  const ready = upgradeResourceIdentityIndexes(db, documents);
  const store = createResourceNumberStore(documents, ready);
  const { identity, identityMany, findByShorthand } = createResourceIdentityIndex(db, ready);
  const owner = (projectId: string) => ({ workbenchId: projectId, extensionId: coreOwnerId });

  const allocate = async (input: AllocationInput) => {
    await ready;
    const id = createStorageId(input.idPrefix);
    const timestamp = new Date().toISOString();
    try {
      const [row] = await db
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
      return store.documentStore.transaction(owner(input.projectId), async ({ document }) => {
        const resource = {
          id,
          extensionId: input.extensionId,
          kind: input.kind,
          prefix: row!.prefix,
          value: nextResourceNumber(document, row!.prefix, row!.next_value - 1),
        };
        document.transact(() => {
          resourceNumbers(document).set(resource.id, resource);
          rememberResourceNumber(document, resource);
        });
        return { id: resource.id, shorthand: resourceIdentity(document, resource).shorthand };
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
  return { allocate, identity, identityMany, findByShorthand, ...store, watchChanges: documents.watch };
};
