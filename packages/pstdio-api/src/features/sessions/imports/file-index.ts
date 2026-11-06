import { Database } from "bun:sqlite";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExportedFile } from "./source";

// This disposable index holds metadata only. Conversation and attachment bytes stay in the backup until used.
export const createImportFileIndex = async () => {
  const directory = await mkdtemp(join(tmpdir(), "pstdio-session-import-index-"));
  const db = new Database(join(directory, "files.sqlite"));
  db.exec(
    "PRAGMA journal_mode=OFF; PRAGMA synchronous=OFF; CREATE TABLE files (id TEXT PRIMARY KEY, row TEXT NOT NULL)",
  );
  const insert = db.query("INSERT OR REPLACE INTO files (id, row) VALUES (?, ?)");
  const read = db.query<{ row: string }, [string]>("SELECT row FROM files WHERE id = ?");
  const batch = db.transaction((files: ExportedFile[]) => {
    for (const file of files) insert.run(file.id, JSON.stringify(file));
  });
  return {
    add: batch,
    get(id: string) {
      const record = read.get(id);
      return record ? (JSON.parse(record.row) as ExportedFile) : undefined;
    },
    async close() {
      db.close();
      await rm(directory, { recursive: true, force: true });
    },
  };
};
