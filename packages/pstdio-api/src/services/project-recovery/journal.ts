import { createHash } from "node:crypto";
import { link, mkdir, open, readFile, rename, stat, unlink, utimes } from "node:fs/promises";
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

// Owners refresh their lock this often; a lock older than the stale limit is abandoned
// even when an unrelated process now has its PID.
const heartbeatMs = 60_000;
const staleMs = 5 * 60_000;
const lockSchema = z.strictObject({ pid: z.number().int().positive(), token: z.string().min(1) });
// Lock tokens this process holds or is creating. Another token with this PID is a crashed earlier process.
const heldTokens = new Set<string>();

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
  const live = async (text: string) => {
    const owner = lockSchema.safeParse(
      (() => {
        try {
          return JSON.parse(text);
        } catch {
          return null;
        }
      })(),
    ).data;
    if (!owner) return false;
    if (owner.pid === process.pid) return heldTokens.has(owner.token);
    const age = Date.now() - (await stat(lockPath)).mtimeMs;
    return age < staleMs && alive(owner.pid);
  };
  /** Moves an abandoned lock aside only if it is still the one judged stale, so
   * concurrent takeovers cannot remove a lock another contender just created. */
  const takeOver = async (stale: string) => {
    const aside = `${lockPath}.${crypto.randomUUID()}.stale`;
    try {
      await rename(lockPath, aside);
    } catch {
      return;
    }
    if ((await readFile(aside, "utf8").catch(() => "")) !== stale) await link(aside, lockPath).catch(() => {});
    await unlink(aside).catch(() => {});
  };
  /** One process owns a source's capture and publication at a time. The owner
   * refreshes the lock; an exited or silent owner's lock is taken over. */
  const acquire = async (): Promise<(() => Promise<void>) | null> => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const token = crypto.randomUUID();
      const content = JSON.stringify({ pid: process.pid, token });
      // A complete lock appears atomically, so a contender never reads a partial owner.
      const temporary = `${lockPath}.${token}.pending`;
      const file = await open(temporary, "wx", 0o600);
      try {
        await file.writeFile(content);
        await file.sync();
      } finally {
        await file.close();
      }
      heldTokens.add(token);
      try {
        await link(temporary, lockPath);
        const heartbeat = setInterval(() => {
          const now = new Date();
          void utimes(lockPath, now, now).catch(() => {});
        }, heartbeatMs);
        heartbeat.unref?.();
        return async () => {
          clearInterval(heartbeat);
          heldTokens.delete(token);
          if ((await readFile(lockPath, "utf8").catch(() => "")) === content) await unlink(lockPath).catch(() => {});
        };
      } catch (error) {
        heldTokens.delete(token);
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      } finally {
        await unlink(temporary).catch(() => {});
      }
      const current = await readFile(lockPath, "utf8").catch(() => null);
      if (current === null) continue;
      if (await live(current).catch(() => true)) return null;
      await takeOver(current);
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
