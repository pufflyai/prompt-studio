import { join } from "node:path";
import { sql } from "drizzle-orm";
import type { DbClient } from "./connection.pglite";

/** Only generated companion SQL may retire the released conversion inputs. */
export const retireLegacyRecordTables = async (db: Pick<DbClient, "transaction">, folder: string) => {
  const journal = await Bun.file(join(folder, "meta/_journal.json")).json();
  const statements: string[] = [];
  for (const entry of journal.entries as { tag: string }[]) {
    const file = Bun.file(join(folder, `${entry.tag}.post-data.sql`));
    if (await file.exists()) statements.push(...(await file.text()).split("--> statement-breakpoint"));
  }
  if (!statements.length) throw new Error("Missing generated legacy retirement migration");
  await db.transaction(async (tx) => {
    const [{ present }] = (
      await tx.execute<{ present: boolean }>(sql`
      SELECT to_regclass('public.storage_record_sync') IS NOT NULL AS present`)
    ).rows;
    if (!present) return;
    for (const statement of statements) if (statement.trim()) await tx.execute(sql.raw(statement));
  });
};
