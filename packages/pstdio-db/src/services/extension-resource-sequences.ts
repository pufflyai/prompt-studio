import { and, eq, sql } from "drizzle-orm";
import { createStorageId } from "pstdio-api-contracts";
import {
  nextResourceNumber,
  rememberResourceNumber,
  resourceIdentity,
  resourceNumbers,
  resourceNumbersOwnerId,
} from "pstdio-sync";
import type { DbClient } from "../db/connection.pglite";
import { extension_resource_sequences as sequences } from "../db/schemas.pg";
import { createDocumentStorageDBService } from "./extension-storage/document-storage";
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
  const store = createResourceNumberStore(documents);
  const owner = (projectId: string) => ({ workbenchId: projectId, extensionId: resourceNumbersOwnerId });
  const identity = (input: Omit<AllocationInput, "prefix"> & { id: string }) =>
    store.documentStore.transaction(owner(input.projectId), async ({ document }) => {
      const resource = resourceNumbers(document).get(input.id);
      if (!resource || resource.kind !== input.kind || resource.extensionId !== input.extensionId) return null;
      return resourceIdentity(document, resource);
    });
  const findByShorthand = (input: Omit<AllocationInput, "prefix"> & { shorthand: string }) =>
    store.documentStore.transaction(owner(input.projectId), async ({ document }) =>
      [...resourceNumbers(document).values()]
        .filter((resource) => resource.kind === input.kind && resource.extensionId === input.extensionId)
        .map((resource) => resourceIdentity(document, resource))
        .filter((resource) => resource.shorthand === input.shorthand || resource.aliases.includes(input.shorthand))
        .sort(
          (a, b) =>
            Number(b.shorthand === input.shorthand) - Number(a.shorthand === input.shorthand) || (a.id < b.id ? -1 : 1),
        ),
    );

  const allocate = async (input: AllocationInput) => {
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
  return { allocate, identity, findByShorthand, ...store, watchChanges: documents.watch };
};
