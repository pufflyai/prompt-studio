import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, open, readFile, rename, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import { and, asc, eq, sql } from "drizzle-orm";
import type { DbClient } from "./connection.pglite";
import { flushDirectory } from "./pglite-home-recovery";
import { file_projections } from "./schemas/file-projections";

// Retain admission decisions beside the exact migration archive. A later explicit
// user-data purge removes initialized markers; it must not undo successful admission.
// Ordinary requests cannot invent an owner or erase unresolved migration evidence.
const unavailable = new WeakMap<object, { archive: string; keys: Set<string> }>();
const root = (key: string) => JSON.stringify(["artifact", key]);
export const assertArtifactProjectionAdmitted = (db: object, key: string) => {
  const retained = unavailable.get(db);
  if (retained?.keys.has(key))
    throw new Error(
      `This file mirror's saved state is retained in ${retained.archive}. Its owner needs repair before the mirror can be used.`,
    );
};

const readArchivedRoots = async (archive: string) => {
  try {
    await access(archive);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  const keys = new Set<string>();
  const stream = createReadStream(archive, { encoding: "utf8" });
  const lines = createInterface({ input: stream, crlfDelay: Number.POSITIVE_INFINITY });
  try {
    for await (const line of lines) {
      if (!line) continue;
      const row = JSON.parse(line) as { projection_key: string };
      if (typeof row.projection_key !== "string") throw new Error(`Invalid file mirror archive: ${archive}`);
      keys.add(row.projection_key);
    }
  } finally {
    lines.close();
    stream.destroy();
  }
  return keys;
};

type Admission = { format: 1; roots: string; admitted: string[] };
const readAdmission = async (path: string, roots: string, keys: Set<string>) => {
  const text = await readFile(path, "utf8").catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });
  if (text === undefined) return;
  const proof = JSON.parse(text) as Admission;
  if (
    proof.format !== 1 ||
    proof.roots !== roots ||
    !Array.isArray(proof.admitted) ||
    proof.admitted.some((key) => typeof key !== "string" || !keys.has(key))
  )
    throw new Error(`Invalid file mirror admission evidence: ${path}`);
  // Finish a rename whose directory flush was interrupted on the previous open.
  await flushDirectory(dirname(path));
  return new Set(proof.admitted);
};
const writeAdmission = async (path: string, roots: string, admitted: Set<string>) => {
  const temporary = `${path}.${randomUUID()}.tmp`;
  const file = await open(temporary, "wx", 0o600);
  try {
    try {
      await file.writeFile(JSON.stringify({ format: 1, roots, admitted: [...admitted].sort() } satisfies Admission));
      await file.sync();
    } finally {
      await file.close();
    }
    await rename(temporary, path);
    await flushDirectory(dirname(path));
  } finally {
    await rm(temporary, { force: true });
  }
};

export const restoreArtifactProjectionAdmission = async (db: DbClient, path: string) => {
  if (path === ":memory:") return;
  const archive = join(`${path}-migration-exports`, "artifact_file_projection_roots.jsonl");
  const keys = await readArchivedRoots(archive);
  if (!keys) return;
  const roots = createHash("sha256")
    .update(JSON.stringify([...keys].sort()))
    .digest("hex");
  const proofPath = `${archive}.admission.json`;
  const previous = await readAdmission(proofPath, roots, keys);
  const admitted = new Set(previous);
  for (const key of admitted) keys.delete(key);
  const archived = new Map([...keys].map((key) => [root(key), key]));
  let after: { owner: number; root: string } | undefined;
  while (keys.size) {
    const initialized = await db
      .select({ owner: file_projections.owner_id, root: file_projections.root })
      .from(file_projections)
      .where(
        and(
          eq(file_projections.path, ""),
          after
            ? sql`(${file_projections.owner_id},${file_projections.root}) > (${after.owner},${after.root})`
            : undefined,
        ),
      )
      .orderBy(asc(file_projections.owner_id), asc(file_projections.root))
      .limit(200);
    if (!initialized.length) break;
    for (const row of initialized) {
      const key = archived.get(row.root);
      if (key !== undefined) {
        admitted.add(key);
        keys.delete(key);
      }
    }
    after = initialized.at(-1)!;
  }
  if (!previous || previous.size !== admitted.size) await writeAdmission(proofPath, roots, admitted);
  unavailable.set(db, { archive, keys });
  if (keys.size)
    console.warn("File mirror upgrade retained roots without an initialized owner", {
      count: keys.size,
      keys: [...keys].slice(0, 10),
      archive,
    });
};
