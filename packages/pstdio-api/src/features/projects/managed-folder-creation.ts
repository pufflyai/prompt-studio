import { lstat, mkdir, open, readFile, realpath, rename, rm, rmdir } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { z } from "zod";
import { publishManagedFolder } from "./managed-folder-publish";

const missing = (error: NodeJS.ErrnoException) => {
  if (error.code === "ENOENT") return null;
  throw error;
};
export const managedDirectoryIdentity = async (path: string) => {
  const found = await lstat(path, { bigint: true }).catch(missing);
  return found?.isDirectory() ? `${String(found.dev)}:${String(found.ino)}` : null;
};
export const creationReceiptPath = (record: string) => `${record}.creation`;
const schema = z.strictObject({
  version: z.literal(1),
  directory: z.string().uuid(),
  identity: z
    .string()
    .regex(/^\d+:\d+$/)
    .nullable(),
});
type Receipt = z.infer<typeof schema>;
const readReceipt = async (record: string) => {
  const content = await readFile(creationReceiptPath(record), "utf8").catch(missing);
  return content === null ? null : schema.parse(JSON.parse(content));
};
export const readCreationIdentity = async (record: string) => (await readReceipt(record))?.identity ?? null;
export const hasPendingFolderCreation = async (record: string) => (await readReceipt(record)) !== null;

// The caller holds the per-project lease. A fixed private temporary name also
// reclaims an interrupted small metadata write without accumulating files.
const saveRecord = async (path: string, value: string) => {
  const temporary = `${path}.pending`;
  await rm(temporary, { force: true });
  try {
    const file = await open(temporary, "wx", 0o600);
    try {
      await file.writeFile(value);
      await file.sync();
    } finally {
      await file.close();
    }
    await rename(temporary, path);
    const committed = await open(
      process.platform === "win32" ? path : dirname(path),
      process.platform === "win32" ? "r+" : "r",
    );
    try {
      await committed.sync();
    } finally {
      await committed.close();
    }
  } finally {
    await rm(temporary, { force: true });
  }
};
const saveReceipt = (record: string, value: Receipt) =>
  saveRecord(creationReceiptPath(record), JSON.stringify(schema.parse(value)));
const stagePath = (path: string, receipt: Receipt) => join(dirname(path), `.project-creation-${receipt.directory}`);
const discardStage = async (path: string, record: string, receipt: Receipt) => {
  const stage = stagePath(path, receipt);
  const found = await managedDirectoryIdentity(stage);
  if (found && receipt.identity && found !== receipt.identity)
    throw new Error(
      `Managed folder setup is incomplete. Move the replacement at ${stage} aside, then retry removing this copy.`,
    );
  // A reserved pending entry has no committed identity yet. It can only be
  // discarded while empty; never recursively remove an unverified directory.
  await rmdir(stage).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOTEMPTY" || error.code === "EEXIST")
      throw new Error(
        `Managed folder setup is incomplete. Move retained files out of ${stage}, then retry removing this copy.`,
      );
    return missing(error);
  });
  await rm(creationReceiptPath(record), { force: true });
};
const existingFolder = async (path: string) => {
  const resolved = await realpath(path);
  if (!(await lstat(resolved)).isDirectory())
    throw Object.assign(new Error("The existing project path is not a directory"), { code: "ENOTDIR" });
  return resolved;
};
const finishMarker = async (path: string, record: string, receipt: Receipt) => {
  if (!receipt.identity || (await managedDirectoryIdentity(path)) !== receipt.identity)
    throw new Error("The managed project directory changed during setup; its files were retained");
  await saveRecord(record, receipt.identity);
  if ((await managedDirectoryIdentity(path)) !== receipt.identity)
    throw new Error("The managed project directory changed during setup; its files were retained");
  await rm(creationReceiptPath(record), { force: true });
  return realpath(path);
};

export const prepareFolderCreation = async (path: string, record: string): Promise<string> => {
  let receipt = await readReceipt(record);
  const present = await lstat(path).catch(missing);
  if (!receipt && present) return existingFolder(path);
  const marker = await lstat(record).catch(missing);
  if (marker && !marker.isFile()) throw new Error("The managed folder ownership record is not a file");
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  if (!receipt) {
    receipt = { version: 1, directory: crypto.randomUUID(), identity: null };
    await saveReceipt(record, receipt);
  }
  if (receipt.identity && (await managedDirectoryIdentity(path)) === receipt.identity)
    return finishMarker(path, record, receipt);
  if (present) {
    await discardStage(path, record, receipt);
    return existingFolder(path);
  }
  const stage = stagePath(path, receipt);
  if (!receipt.identity) {
    await rmdir(stage).catch(missing);
    await mkdir(stage, { mode: 0o700 });
    receipt.identity = await managedDirectoryIdentity(stage);
    if (!receipt.identity) throw new Error("The managed staging directory changed during setup");
    await saveReceipt(record, receipt);
  } else if ((await managedDirectoryIdentity(stage)) !== receipt.identity) {
    if (await lstat(stage).catch(missing))
      throw new Error("The managed staging directory changed; its files were retained");
    await rm(creationReceiptPath(record), { force: true });
    return prepareFolderCreation(path, record);
  }
  const parent = await realpath(dirname(path));
  const { dev, ino } = await lstat(parent, { bigint: true });
  try {
    await publishManagedFolder({ parent, identity: { dev, ino }, from: basename(stage), to: basename(path) });
  } catch (error) {
    if (!["EEXIST", "ENOTEMPTY"].includes((error as NodeJS.ErrnoException).code ?? "")) throw error;
    await discardStage(path, record, receipt);
    return existingFolder(path);
  }
  return finishMarker(path, record, receipt);
};

export const discardFolderCreation = async (path: string, record: string) => {
  const receipt = await readReceipt(record);
  if (receipt) await discardStage(path, record, receipt);
  await rm(`${creationReceiptPath(record)}.pending`, { force: true });
  await rm(`${record}.pending`, { force: true });
};
