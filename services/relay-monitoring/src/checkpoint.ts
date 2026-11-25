import { mkdir, open, readFile, rename } from "node:fs/promises";
import { join } from "node:path";
import type { UpdateEnvelope } from "pstdio-sync-contracts";

export interface Checkpoint {
  version: 1;
  documentId: string;
  lastBlobAt: number;
  lastMultipartAt: number;
  pendingUpdate?: { envelope: UpdateEnvelope; expected: string };
  pendingBlob?: { blobId: string; bytes: string; expectedHash: string; multipart: boolean };
}
export const createCheckpoint = async (directory: string, initial: () => Checkpoint) => {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const path = join(directory, "checkpoint.json");
  let state: Checkpoint;
  try {
    const contents = await readFile(path, "utf8");
    if (contents.length > 24 * 1024 ** 2) throw new Error("Checkpoint exceeds limit");
    state = JSON.parse(contents) as Checkpoint;
    if (state.version !== 1 || typeof state.documentId !== "string") throw new Error("Unsupported checkpoint");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT")
      throw new Error("Checkpoint unavailable; restore its backup");
    state = initial();
  }
  const save = async () => {
    const file = await open(`${path}.next`, "w", 0o600);
    try {
      await file.writeFile(JSON.stringify(state));
      await file.sync();
    } finally {
      await file.close();
    }
    await rename(`${path}.next`, path);
    const folder = await open(directory, "r");
    try {
      await folder.sync();
    } finally {
      await folder.close();
    }
  };
  await save();
  return { state, save };
};
