import fs from "node:fs";

const LOCK_SUFFIX = ".lock";
const OWNER_FILE = "owner";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// process.kill(pid, 0) probes liveness without delivering a signal:
// ESRCH = gone (stale), EPERM = alive but not ours (treat as alive).
const isProcessAlive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
};

const readOwnerPid = (lockDir: string) => {
  try {
    return Number.parseInt(fs.readFileSync(`${lockDir}/${OWNER_FILE}`, "utf8"), 10);
  } catch {
    return Number.NaN;
  }
};

// A held lock is stale only when its owner is gone — a hard kill (SIGKILL) skips
// createDb's close() and leaves the directory behind. Liveness, not age, is the
// signal: a server can legitimately hold the lock for hours.
const isStale = (lockDir: string) => {
  const pid = readOwnerPid(lockDir);
  return Number.isNaN(pid) || !isProcessAlive(pid);
};

/**
 * Serializes access to a file-backed PGlite data directory.
 *
 * PGlite runs Postgres single-user in WASM with no postmaster lock, so two
 * processes opening the same directory corrupts it. Under `bun --watch` the
 * replacement server can boot before the outgoing one finishes flushing; this
 * lock makes the newcomer wait for the prior owner's release (or reclaim it if
 * that owner was hard-killed) instead of racing in.
 */
export const acquireDbLock = async (dbPath: string, { retryMs = 50, timeoutMs = 10_000 } = {}) => {
  if (dbPath === ":memory:") {
    return async () => {};
  }

  const lockDir = `${dbPath}${LOCK_SUFFIX}`;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      fs.mkdirSync(lockDir); // atomic: throws EEXIST when already held
      fs.writeFileSync(`${lockDir}/${OWNER_FILE}`, String(process.pid));

      let released = false;
      return async () => {
        if (released) return;
        released = true;
        fs.rmSync(lockDir, { recursive: true, force: true });
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;

      if (isStale(lockDir)) {
        fs.rmSync(lockDir, { recursive: true, force: true });
        continue;
      }

      await sleep(retryMs);
    }
  }

  throw new Error(
    `Timed out acquiring database lock at ${lockDir}; held by pid ${readOwnerPid(lockDir)}. ` +
      "Another pstdio process is using this database.",
  );
};
