import { and, eq, sql } from "drizzle-orm";
import type { DbClient } from "../db/connection.pglite";
import { extension_resource_sequences as sequences } from "../db/schemas.pg";

interface AllocationInput {
  projectId: string;
  extensionId: string;
  kind: string;
  prefix: string;
}

export const createExtensionResourceSequencesDBService = (db: DbClient) => {
  const allocate = async (input: AllocationInput) => {
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
      return { id: crypto.randomUUID(), shorthand: `${row!.prefix}-${row!.next_value}` };
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
  return { allocate };
};
