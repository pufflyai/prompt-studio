import { existsSync } from "node:fs";
import { mkdir, open, readdir, readFile, rm, rmdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { flushDirectory } from "./pglite-home-recovery";
import { renamePgliteHome } from "./rename-pglite-home";

export const batchWork = (path: string) => `${path}.reimport-0.49`;
export const batchBackup = (path: string) => `${path}.before-0.49`;
export const batchPayload = "pstdio-reimport-048";
export async function writeDurably(path: string, text: string) {
  const file = await open(path, "wx", 0o600);
  try {
    await file.writeFile(text);
    await file.sync();
  } finally {
    await file.close();
  }
}

// The active database lock lives beside these paths and spans both renames and the subsequent SQL migration.
export async function beginBatchHome(path: string) {
  const work = batchWork(path);
  await mkdir(work, { mode: 0o700 });
  // The candidate can only be created after we have durable proof that we own this directory.
  await writeDurably(join(work, "owner"), path);
  await flushDirectory(work);
  await flushDirectory(dirname(work));
  const candidate = join(work, "database");
  await mkdir(candidate, { mode: 0o700 });
  return candidate;
}

async function publishCandidate(path: string, candidate: string, backup: string, work: string) {
  if (existsSync(candidate)) {
    if (existsSync(path)) {
      if (existsSync(backup)) throw new Error(`Database re-import backup already exists: ${backup}`);
      await renamePgliteHome(path, backup);
      await flushDirectory(dirname(path));
    } else if (!existsSync(backup)) throw new Error("Missing original database during re-import");
    await renamePgliteHome(candidate, path);
    await flushDirectory(dirname(path));
    await flushDirectory(work);
  } else if (!existsSync(path) || !existsSync(backup)) throw new Error("Incomplete database re-import publication");
}

export async function recoverBatchHome(path: string) {
  const work = batchWork(path);
  if (!existsSync(work)) return;
  const contents = await readdir(work);
  if (!contents.length) {
    await rmdir(work);
    return;
  }
  const owner = join(work, "owner");
  // An interrupted first write can only leave the owner file in an otherwise empty directory.
  if (contents.length !== 1 || contents[0] !== "owner") {
    if ((await readFile(owner, "utf8")) !== path) throw new Error(`Unrecognized database re-import directory: ${work}`);
  } else if (!path.startsWith(await readFile(owner, "utf8"))) {
    throw new Error(`Unrecognized database re-import owner: ${work}`);
  }
  const candidate = join(work, "database");
  const backup = batchBackup(path);
  if (existsSync(join(work, "ready"))) {
    await publishCandidate(path, candidate, backup, work);
  } else if (existsSync(candidate)) {
    // An interrupted COPY can leave its one scratch file on the source's Postgres volume.
    await rm(join(path, "pstdio-reimport-048.tmp"), { force: true });
    await rm(candidate, { recursive: true, force: true });
  }
  await rm(join(work, "ready"), { force: true });
  await flushDirectory(work);
  await rm(owner);
  await rmdir(work);
  await flushDirectory(dirname(path));
}
