import { and, eq, inArray, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import { storage_documents as documents } from "../../db/schemas.pg";
import type { OrderedTransaction } from "./ordered-sql";

/** Collect concurrent operations from one bounded manifest page, without retaining cache state. */
const collect = <Input, Output>(run: (inputs: Input[]) => Promise<Output[]>) => {
  let pending: { input: Input; resolve: (value: Output) => void; reject: (error: unknown) => void }[] = [];
  return (input: Input) =>
    new Promise<Output>((resolve, reject) => {
      pending.push({ input, resolve, reject });
      if (pending.length !== 1) return;
      queueMicrotask(async () => {
        const page = pending;
        pending = [];
        try {
          const results = await run(page.map(({ input }) => input));
          for (const [index, item] of page.entries()) item.resolve(results[index]!);
        } catch (error) {
          for (const item of page) item.reject(error);
        }
      });
    });
};

export const createOrderedManifestRows = (tx: OrderedTransaction, owner: StorageOwner) => {
  const pending = new Map<string, { id: string; state: Uint8Array }>();
  const read = collect(async (ids: string[]) => {
    const found = new Map<string, Uint8Array>();
    for (let offset = 0; offset < ids.length; offset += 100) {
      const rows = await tx
        .select({ id: documents.document_id, state: documents.state })
        .from(documents)
        .where(
          and(
            eq(documents.workbench_id, owner.workbenchId),
            eq(documents.extension_id, owner.extensionId),
            inArray(documents.document_id, ids.slice(offset, offset + 100)),
          ),
        );
      for (const row of rows) found.set(row.id, row.state);
    }
    return ids.map((id) => found.get(id));
  });
  return {
    read: (id: string) => (pending.has(id) ? Promise.resolve(pending.get(id)!.state) : read(id)),
    write: async (row: { id: string; state: Uint8Array }) => {
      pending.set(row.id, row);
    },
    async flush() {
      const rows = [...pending.values()];
      let offset = 0;
      while (offset < rows.length) {
        const page: typeof rows = [];
        let bytes = 0;
        while (offset < rows.length && page.length < 100) {
          const row = rows[offset]!;
          if (page.length && bytes + row.state.byteLength > 4_000_000) break;
          page.push(row);
          bytes += row.state.byteLength;
          offset++;
        }
        await tx
          .insert(documents)
          .values(
            page.map((row) => ({
              workbench_id: owner.workbenchId,
              extension_id: owner.extensionId,
              document_id: row.id,
              state: row.state,
            })),
          )
          .onConflictDoUpdate({
            target: [documents.workbench_id, documents.extension_id, documents.document_id],
            set: { state: sql`excluded.state` },
          });
      }
      pending.clear();
    },
  };
};
