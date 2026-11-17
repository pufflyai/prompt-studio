import type { Dirent } from "node:fs";
import { lstat, readdir } from "node:fs/promises";
import { join } from "node:path";
import {
  type DocumentGroup,
  findDatabaseDirectory,
  readDocumentGroups,
  readTableSizes,
  type TableSize,
} from "./pg-files";
import { pstdioHome } from "./timeline";

export interface FileArea {
  group: "app" | "project";
  name: string;
  path: string;
  bytes: number;
  files: number;
}

export interface StorageReport {
  generatedAt: string;
  durationMs: number;
  home: string;
  database: { path: string; totalBytes: number; walBytes: number; tables: TableSize[]; documents: DocumentGroup[] };
  files: FileArea[];
  /** Areas left out because measuring them would walk dependency trees. */
  skipped: string[];
}

export const STORAGE_REPORT_FILE = "diagnostics/storage-report.json";
export const STORAGE_RUN_FILE = "diagnostics/storage-run.json";
// Worktrees hold full dependency trees; walking them takes minutes and says nothing about app data.
const SKIPPED_HOME_ENTRIES = new Set(["workspaces"]);
const EXPANDED_HOME_ENTRIES = new Set(["storage"]);

const measure = async (path: string) => {
  let bytes = 0;
  let files = 0;
  const walk = async (dir: string): Promise<void> => {
    let entries: Dirent[];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    // Files in one folder are measured together; folders are walked one at a time to bound open handles.
    await Promise.all(
      entries
        .filter((entry) => entry.isFile())
        .map(async (entry) => {
          try {
            // Read the size before adding: `bytes += await …` would add to a stale total.
            const { size } = await lstat(join(dir, entry.name));
            bytes += size;
            files++;
          } catch {
            // Files can disappear while the report runs.
          }
        }),
    );
    for (const entry of entries) if (entry.isDirectory()) await walk(join(dir, entry.name));
  };
  const info = await lstat(path).catch(() => null);
  if (!info) return { bytes, files };
  if (info.isFile()) return { bytes: info.size, files: 1 };
  if (info.isDirectory()) await walk(path);
  return { bytes, files };
};

const childDirectories = async (path: string) =>
  (await readdir(path, { withFileTypes: true }).catch(() => [])).filter((entry) => entry.isDirectory());

const measureAreas = async (home: string, projectRoot: string | null) => {
  const areas: FileArea[] = [];
  const skipped: string[] = [];
  for (const entry of await readdir(home, { withFileTypes: true })) {
    const path = join(home, entry.name);
    if (SKIPPED_HOME_ENTRIES.has(entry.name)) {
      skipped.push(path);
      continue;
    }
    if (EXPANDED_HOME_ENTRIES.has(entry.name) && entry.isDirectory()) {
      for (const child of await childDirectories(path)) {
        const childPath = join(path, child.name);
        areas.push({
          group: "app",
          name: `${entry.name}/${child.name}`,
          path: childPath,
          ...(await measure(childPath)),
        });
      }
      continue;
    }
    areas.push({ group: "app", name: entry.name, path, ...(await measure(path)) });
  }
  if (projectRoot) {
    const storage = join(projectRoot, ".pstdio", "extension-storage");
    for (const child of await childDirectories(storage)) {
      const path = join(storage, child.name);
      areas.push({ group: "project", name: child.name, path, ...(await measure(path)) });
    }
  }
  return { areas: areas.sort((a, b) => b.bytes - a.bytes), skipped };
};

export const buildStorageReport = async (projectRoot: string | null): Promise<StorageReport> => {
  const started = performance.now();
  const home = pstdioHome();
  const dataDir = process.env.PSTDIO_DB_PATH?.trim() || join(home, "pstdio.db");
  const databaseDir = await findDatabaseDirectory(dataDir);
  const { tables, byOid } = await readTableSizes(databaseDir);
  const documents = await readDocumentGroups(dataDir, databaseDir, byOid);
  const database = await measure(dataDir);
  const wal = await measure(join(dataDir, "pg_wal"));
  const { areas, skipped } = await measureAreas(home, projectRoot);
  return {
    generatedAt: new Date().toISOString(),
    durationMs: Math.round(performance.now() - started),
    home,
    database: { path: dataDir, totalBytes: database.bytes, walBytes: wal.bytes, tables, documents },
    files: areas,
    skipped,
  };
};
