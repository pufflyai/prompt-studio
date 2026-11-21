import { createHash, randomUUID } from "node:crypto";
import { link, mkdir, open, readFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { flushDirectory } from "./pglite-home-recovery";

export const fileOwnerExportPath = (database: string, kind: string, id: string) =>
  join(`${database}-migration-exports`, `file-${kind}`, `${createHash("sha256").update(id).digest("hex")}.json`);

export const readFileOwnerExport = async (database: string, kind: string, id: string) => {
  try {
    return JSON.parse(await readFile(fileOwnerExportPath(database, kind, id), "utf8")) as Record<string, unknown>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
};

// One-time conversion evidence stays outside the database until explicitly removed.
export const writeFileOwnerExport = async (database: string, kind: string, id: string, value: unknown) => {
  if (database === ":memory:") return;
  const root = `${database}-migration-exports`;
  const folder = join(root, `file-${kind}`);
  await mkdir(folder, { recursive: true, mode: 0o700 });
  await flushDirectory(dirname(root));
  await flushDirectory(root);
  const target = fileOwnerExportPath(database, kind, id);
  const temporary = `${target}.${randomUUID()}.tmp`;
  try {
    const file = await open(temporary, "wx", 0o600);
    try {
      await file.writeFile(JSON.stringify(value));
      await file.sync();
    } finally {
      await file.close();
    }
    try {
      await link(temporary, target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      if (!isDeepStrictEqual(JSON.parse(await readFile(target, "utf8")), value))
        throw new Error(`File migration identity collision: ${target}`);
    }
  } finally {
    await rm(temporary, { force: true });
  }
  await flushDirectory(folder);
};
