import { and, eq, or, sql } from "drizzle-orm";
import type { DbClient } from "./connection.pglite";
import { resource_prefixes as prefixes } from "./schemas/resource-prefixes";
import { prepareUpgradeSnapshot } from "./upgrade-snapshot";

/** Prefix bindings and allocation floors survive the generated table replacement together. */
export const prepareResourcePrefixUpgrade = async (db: DbClient, path: string) => {
  const pending: (Omit<typeof prefixes.$inferInsert, "next_value"> & { next_value: string })[] = [];
  let bytes = 0;
  const flush = async () => {
    if (!pending.length) return;
    const rows = pending.splice(0);
    bytes = 0;
    await db.transaction(async (tx) => {
      await tx
        .insert(prefixes)
        .values(rows.map((row) => ({ ...row, next_value: sql`${row.next_value}::bigint` })))
        .onConflictDoNothing();
      const restored = await tx
        .select({
          project_id: prefixes.project_id,
          prefix: prefixes.prefix,
          extension_id: prefixes.extension_id,
          kind: prefixes.kind,
          next_value: sql<string>`${prefixes.next_value}::text`,
        })
        .from(prefixes)
        .where(or(...rows.map((row) => and(eq(prefixes.project_id, row.project_id), eq(prefixes.prefix, row.prefix)))));
      const byPrefix = new Map(restored.map((row) => [JSON.stringify([row.project_id, row.prefix]), row]));
      for (const row of rows) {
        const existing = byPrefix.get(JSON.stringify([row.project_id, row.prefix]));
        if (
          !existing ||
          existing.extension_id !== row.extension_id ||
          existing.kind !== row.kind ||
          existing.next_value !== row.next_value
        )
          throw new Error("Resource prefix restoration conflict");
      }
    });
  };
  const restore = await prepareUpgradeSnapshot(
    db,
    path,
    {
      table: "extension_resource_sequences",
      keys: ["project_id", "extension_id", "kind"],
      name: "resource-prefixes",
      archive: "extension_resource_sequences",
    },
    async (source) => {
      const { project_id, extension_id, kind, prefix, next_value } = source;
      if (
        typeof project_id !== "string" ||
        typeof extension_id !== "string" ||
        typeof kind !== "string" ||
        typeof prefix !== "string" ||
        typeof next_value !== "string" ||
        !/^-?\d+$/u.test(next_value) ||
        BigInt(next_value) < -9223372036854775808n ||
        BigInt(next_value) > 9223372036854775807n
      )
        throw new Error("Invalid released resource prefix");
      const size = Buffer.byteLength(JSON.stringify(source));
      if (pending.length && bytes + size > 4 * 1024 * 1024) await flush();
      pending.push({ project_id, extension_id, kind, prefix, next_value });
      bytes += size;
      if (pending.length === 200) await flush();
    },
    // PGlite returns counters outside the safe-number range as bigint. Preserve the exact
    // decimal value in JSON and cast it back in SQL, including an exhausted allocation floor.
    async (source) => ({ ...source, next_value: String(source.next_value) }),
  );
  if (!restore) return;
  return async () => {
    await restore(true);
    await flush();
    await restore.complete();
  };
};
