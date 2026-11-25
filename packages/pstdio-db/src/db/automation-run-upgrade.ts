import { mkdir, open, rename } from "node:fs/promises";
import { dirname, join } from "node:path";
import { and, eq } from "drizzle-orm";
import type { DbClient } from "./connection.pglite";
import { flushDirectory } from "./pglite-home-recovery";
import { automation_runs } from "./schemas/automation";

// One-time exports belong to the person, like failed-owner recovery exports.
// They are retained until removed explicitly, never copied into the database.
const exportCollision = async (path: string, row: Record<string, unknown>) => {
  if (path === ":memory:") return;
  const folder = `${path}-migration-exports/automation`;
  await mkdir(folder, { recursive: true, mode: 0o700 });
  const target = join(folder, `${encodeURIComponent(String(row.id))}.json`);
  const file = await open(`${target}.tmp`, "w", 0o600);
  try {
    await file.writeFile(JSON.stringify(row));
    await file.sync();
  } finally {
    await file.close();
  }
  await rename(`${target}.tmp`, target);
  await flushDirectory(folder);
  await flushDirectory(dirname(folder));
  await flushDirectory(dirname(dirname(folder)));
};
export const restoreAutomationRun = async (db: DbClient, path: string, input: Record<string, unknown>) => {
  const { released_principal_id, ...values } = input;
  const row = values as typeof automation_runs.$inferInsert;
  const [existing] = await db
    .select({ id: automation_runs.id })
    .from(automation_runs)
    .where(eq(automation_runs.id, row.id));
  if (existing) return;
  let key = row.idempotency_key;
  let suffix = 0;
  while (
    (
      await db
        .select({ id: automation_runs.id })
        .from(automation_runs)
        .where(
          and(
            eq(automation_runs.project_id, row.project_id),
            eq(automation_runs.principal, row.principal),
            eq(automation_runs.command_id, row.command_id),
            eq(automation_runs.idempotency_key, key),
          ),
        )
        .limit(1)
    ).length
  ) {
    if (!suffix) await exportCollision(path, { ...row, principal_id: released_principal_id });
    key = `ps1200-migrated:${row.id}:${++suffix}`;
  }
  await db
    .insert(automation_runs)
    .values({ ...row, idempotency_key: key })
    .onConflictDoNothing({ target: automation_runs.id });
};
