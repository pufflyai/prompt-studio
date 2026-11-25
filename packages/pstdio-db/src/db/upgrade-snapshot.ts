import { createReadStream } from "node:fs";
import { mkdir, open, readdir, rename, rm, stat } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { createInterface } from "node:readline";
import { sql } from "drizzle-orm";
import type { DbClient } from "./connection.pglite";
import { flushDirectory } from "./pglite-home-recovery";
import { readUpgradeRows, type UpgradeSource } from "./upgrade-rows";

type Row = Record<string, unknown>;

export const hasUpgradeSnapshots = async (path: string) =>
  path !== ":memory:" &&
  (await readdir(dirname(path))).some(
    (name) => name.startsWith(`${basename(path)}-`) && /-upgrade\.jsonl?(?:\.tmp)?$/u.test(name),
  );

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
const snapshotWriter = (path: string) => {
  let file: Awaited<ReturnType<typeof open>> | undefined;
  let lines: string[] = [];
  let bufferedBytes = 0;
  const flush = async () => {
    if (!lines.length) return;
    file ??= await open(path, "w", 0o600);
    await file.writeFile(lines.join(""));
    lines = [];
    bufferedBytes = 0;
  };
  return {
    async append(row: Row) {
      const line = `${JSON.stringify(row)}\n`;
      const bytes = Buffer.byteLength(line);
      if (bufferedBytes && bufferedBytes + bytes > 64 * 1024) await flush();
      lines.push(line);
      bufferedBytes += bytes;
      // An oversized row leaves alone; ordinary batches stay within 64 KiB.
      if (bufferedBytes >= 64 * 1024) await flush();
    },
    async sync() {
      await flush();
      file ??= await open(path, "w", 0o600);
      await file.sync();
    },
    close: () => file?.close(),
  };
};
// These sources already consist of JSON-compatible PostgreSQL scalars. COPY streams
// one whole row at a time to the Node-backed PGlite volume without a JS round trip.
// JSON escapes control characters, so these CSV delimiters can never quote a row.
const copyJsonRows = async (db: DbClient, database: string, source: UpgradeSource, snapshot: string) => {
  const temporary = join(database, "pstdio-owned-rows.tmp");
  try {
    // Recreate the host entry before PGlite reuses its cached filesystem node.
    await rm(temporary, { force: true });
    await (await open(temporary, "wx", 0o600)).close();
    const order = sql.join(
      source.keys.map((key) => sql.identifier(key)),
      sql`, `,
    );
    await db.execute(sql`COPY (SELECT row_to_json(released)::text FROM ${sql.identifier(source.table)} released
      ORDER BY ${order}) TO '/pglite/data/pstdio-owned-rows.tmp'
      WITH (FORMAT csv, DELIMITER E'\\x01', QUOTE E'\\x02', ESCAPE E'\\x02')`);
    const file = await open(temporary, "r+");
    try {
      if (!(await file.stat()).size) return;
      await file.chmod(0o600);
      await file.sync();
    } finally {
      await file.close();
    }
    await rename(temporary, snapshot);
    await flushDirectory(dirname(snapshot));
    await flushDirectory(database);
    return [];
  } finally {
    await rm(temporary, { force: true });
  }
};
const captureRows = async (
  db: DbClient,
  source: UpgradeSource & { keepEmpty?: boolean },
  snapshot: string | undefined,
  normalize: (row: Row) => Promise<Row>,
) => {
  const memory: Row[] = [];
  const temporary = snapshot && `${snapshot}.tmp`;
  const writer = temporary ? snapshotWriter(temporary) : undefined;
  let captured = false;
  try {
    for await (const released of readUpgradeRows(db, source)) {
      const row = await normalize(released);
      captured = true;
      if (writer) await writer.append(row);
      else memory.push(row);
    }
    if (!captured && !source.keepEmpty) {
      if (temporary) await rm(temporary, { force: true });
      return;
    }
    // An explicit empty marker records work that must finish after DDL. Ordinary
    // empty sources contain no data to preserve and need no durable file.
    await writer?.sync();
  } catch (error) {
    if (temporary) await rm(temporary, { force: true });
    throw error;
  } finally {
    await writer?.close();
  }
  if (temporary && snapshot) {
    await rename(temporary, snapshot);
    await flushDirectory(dirname(snapshot));
  }
  return memory;
};
// Hold private conversion input until restoration commits. Grouped migrations
// retain every input until all related tables restore, then finalize the group.
const finishSnapshot = async (snapshot: string, archive?: string) => {
  if (archive && (await stat(snapshot)).size) {
    const folder = dirname(archive);
    await mkdir(folder, { recursive: true, mode: 0o700 });
    await flushDirectory(dirname(folder));
    await rename(snapshot, archive);
    await flushDirectory(folder);
  } else await rm(snapshot);
  await flushDirectory(dirname(snapshot));
};
export const prepareUpgradeSnapshot = async (
  db: DbClient,
  path: string,
  source: UpgradeSource & {
    name: string;
    capture?: boolean;
    copyJson?: boolean;
    keepEmpty?: boolean;
    archive?: string | (() => string);
  },
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
    const captured =
      source.copyJson && snapshot
        ? await copyJsonRows(db, path, source, snapshot)
        : await captureRows(db, source, snapshot, normalize);
    if (captured === undefined) return;
    memory = captured;
  }
  const complete = async () => {
    if (snapshot) {
      const archive = typeof source.archive === "function" ? source.archive() : source.archive;
      await finishSnapshot(snapshot, archive ? join(`${path}-migration-exports`, `${archive}.jsonl`) : undefined);
    }
  };
  const resume = async (retain = false) => {
    for await (const row of snapshot ? snapshotRows(snapshot) : memory) await restore(row);
    if (!retain) await complete();
  };
  return Object.assign(resume, { complete, captured: !exists });
};
