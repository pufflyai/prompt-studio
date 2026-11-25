import { join } from "node:path";
import type { PGlite } from "@electric-sql/pglite";

/** Only generated companion SQL may retire the released conversion inputs. */
export const retireLegacyRecordTables = async (db: PGlite, folder: string) => {
  const journal = await Bun.file(join(folder, "meta/_journal.json")).json();
  const statements: string[] = [];
  for (const entry of journal.entries as { tag: string }[]) {
    const file = Bun.file(join(folder, `${entry.tag}.post-data.sql`));
    if (await file.exists()) statements.push(...(await file.text()).split("--> statement-breakpoint"));
  }
  if (!statements.length) throw new Error("Missing generated legacy retirement migration");
  await db.transaction(async (tx) => {
    const [{ present }] = (
      await tx.query<{ present: boolean }>("SELECT to_regclass('public.storage_record_sync') IS NOT NULL AS present")
    ).rows;
    if (!present) return;
    await tx.exec(statements.join("\n"));
  });
};
