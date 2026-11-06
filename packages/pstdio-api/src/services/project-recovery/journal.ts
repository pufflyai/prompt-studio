import { createHash } from "node:crypto";
import { mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { recoveryChunkSchema } from "./chunks";

const journalSchema = z.strictObject({
  version: z.literal(1),
  /** Set once the starter policy decision for this source was applied. A later
   * missing `.pstignore` is then a deliberate deletion, never a reason to seed again. */
  enrolled: z.boolean(),
  /** A complete local capture that has not been acknowledged by the relay yet. */
  candidate: recoveryChunkSchema.nullable(),
});
export type RecoveryJournal = z.infer<typeof journalSchema>;
const empty: RecoveryJournal = { version: 1, enrolled: false, candidate: null };
type Change = Partial<Omit<RecoveryJournal, "version">>;
// Read-modify-write of one journal is serialized within the process.
const updates = new Map<string, Promise<unknown>>();

const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
};

/** Durable per-source lifecycle state, kept in recovery working storage outside
 * every captured folder. It holds only opaque ciphertext references. */
export const openRecoveryJournal = async (input: { root: string; source: string[] }) => {
  const directory = join(input.root, "sources");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const key = createHash("sha256").update(JSON.stringify(input.source)).digest("hex").slice(0, 32);
  const path = join(directory, `${key}.json`);
  const lockPath = join(directory, `${key}.lock`);
  const read = async () => {
    try {
      return journalSchema.parse(JSON.parse(await readFile(path, "utf8")));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return empty;
      throw error;
    }
  };
  const write = async (next: RecoveryJournal) => {
    const temporary = `${path}.${crypto.randomUUID()}.pending`;
    const file = await open(temporary, "wx", 0o600);
    try {
      await file.writeFile(JSON.stringify(journalSchema.parse(next)));
      await file.sync();
    } finally {
      await file.close();
    }
    await rename(temporary, path);
  };
  /** One process owns a source's capture and publication at a time. A lock left
   * by an exited process is taken over; a live owner keeps it. */
  const acquire = async (): Promise<(() => Promise<void>) | null> => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const file = await open(lockPath, "wx", 0o600);
        try {
          await file.writeFile(String(process.pid));
          await file.sync();
        } finally {
          await file.close();
        }
        return async () => {
          if ((await readFile(lockPath, "utf8").catch(() => "")) === String(process.pid)) await unlink(lockPath);
        };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      }
      const owner = Number(await readFile(lockPath, "utf8").catch(() => ""));
      if (Number.isSafeInteger(owner) && owner > 0 && alive(owner)) return null;
      await unlink(lockPath).catch(() => {});
    }
    return null;
  };
  return {
    read,
    update(change: Change | ((current: RecoveryJournal) => Change)) {
      const work = (updates.get(path) ?? Promise.resolve())
        .catch(() => {})
        .then(async () => {
          const current = await read();
          const next = { ...current, ...(typeof change === "function" ? change(current) : change) };
          await write(next);
          return next;
        });
      updates.set(path, work);
      const settled = () => {
        if (updates.get(path) === work) updates.delete(path);
      };
      work.then(settled, settled);
      return work;
    },
    acquire,
  };
};
