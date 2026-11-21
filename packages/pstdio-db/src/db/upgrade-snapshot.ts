import { createReadStream } from "node:fs";
import { open, rename, rm } from "node:fs/promises";
import { dirname } from "node:path";
import { createInterface } from "node:readline";
import { sql } from "drizzle-orm";
import type { DbClient } from "./connection.pglite";
import { flushDirectory } from "./pglite-home-recovery";
import { readUpgradeRows, type UpgradeSource } from "./upgrade-rows";

type Row = Record<string, unknown>;
async function* snapshotRows(path: string) {
  const stream = createReadStream(path, { encoding: "utf8" });
  const lines = createInterface({ input: stream, crlfDelay: Number.POSITIVE_INFINITY });
  try {
    for await (const line of lines) if (line) yield JSON.parse(line) as Row;
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
const captureRows = async (
  db: DbClient,
  source: UpgradeSource,
  snapshot: string | undefined,
  normalize: (row: Row) => Promise<Row>,
) => {
  const memory: Row[] = [];
  const temporary = snapshot && `${snapshot}.tmp`;
  const file = temporary ? await open(temporary, "w", 0o600) : undefined;
  try {
    for await (const released of readUpgradeRows(db, source)) {
      const row = await normalize(released);
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
  return memory;
};
// Hold private conversion input until restoration commits. Grouped migrations
// retain every input until all related tables restore, then finalize the group.
export const prepareUpgradeSnapshot = async (
  db: DbClient,
  path: string,
  source: UpgradeSource & { name: string; capture?: boolean },
  restore: (row: Row) => Promise<void>,
  normalize: (row: Row) => Promise<Row> = async (row) => row,
) => {
  const snapshot = path === ":memory:" ? undefined : `${path}-${source.name}-upgrade.jsonl`;
  const exists = snapshot ? await hasSnapshot(snapshot) : false;
  let memory: Row[] = [];
  if (!exists) {
    if (source.capture === false) return;
    const {
      rows: [table],
    } = await db.execute<{ present: string | null }>(
      sql`SELECT to_regclass(${`public.${source.table}`})::text AS present`,
    );
    if (!table.present) return;
    memory = await captureRows(db, source, snapshot, normalize);
  }
  const complete = async () => {
    if (snapshot) {
      await rm(snapshot);
      await flushDirectory(dirname(snapshot));
    }
  };
  const resume = async (retain = false) => {
    for await (const row of snapshot ? snapshotRows(snapshot) : memory) await restore(row);
    if (!retain) await complete();
  };
  return Object.assign(resume, { complete });
};
