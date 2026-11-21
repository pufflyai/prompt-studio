import { createReadStream } from "node:fs";
import { open, rename, rm } from "node:fs/promises";
import { dirname } from "node:path";
import { createInterface } from "node:readline";
import { sql } from "drizzle-orm";
import type { DbClient } from "./connection.pglite";
import { flushDirectory } from "./pglite-home-recovery";
import { readUpgradeRows, type UpgradeSource } from "./upgrade-rows";

async function* snapshotRows(path: string) {
  const stream = createReadStream(path, { encoding: "utf8" });
  const lines = createInterface({ input: stream, crlfDelay: Number.POSITIVE_INFINITY });
  try {
    for await (const line of lines) if (line) yield JSON.parse(line) as Record<string, unknown>;
  } finally {
    lines.close();
    stream.destroy();
  }
}
const hasSnapshot = async (path: string) => {
  try {
    const file = await open(path, "r");
    await file.close();
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return false;
  }
};
// Hold a private, durable conversion input until restoration commits. A restart
// must resume this file even if the generated migration already dropped its source.
export const prepareUpgradeSnapshot = async (
  db: DbClient,
  path: string,
  source: UpgradeSource & { name: string },
  restore: (row: Record<string, unknown>) => Promise<void>,
) => {
  const snapshot = path === ":memory:" ? undefined : `${path}-${source.name}-upgrade.jsonl`;
  const exists = snapshot ? await hasSnapshot(snapshot) : false;
  const memory: Record<string, unknown>[] = [];
  if (!exists) {
    const {
      rows: [table],
    } = await db.execute<{ present: string | null }>(
      sql`SELECT to_regclass(${`public.${source.table}`})::text AS present`,
    );
    if (!table.present) return;
    const temporary = snapshot && `${snapshot}.tmp`;
    const file = temporary ? await open(temporary, "w", 0o600) : undefined;
    try {
      for await (const row of readUpgradeRows(db, source)) {
        if (file) await file.writeFile(`${JSON.stringify(row)}\n`);
        else memory.push(row);
      }
      await file?.sync();
    } catch (error) {
      if (temporary) await rm(temporary, { force: true });
      throw error;
    } finally {
      await file?.close();
    }
    if (temporary && snapshot) {
      await rename(temporary, snapshot);
      await flushDirectory(dirname(snapshot));
    }
  }
  return async () => {
    for await (const row of snapshot ? snapshotRows(snapshot) : memory) await restore(row);
    if (snapshot) {
      await rm(snapshot);
      await flushDirectory(dirname(snapshot));
    }
  };
};
