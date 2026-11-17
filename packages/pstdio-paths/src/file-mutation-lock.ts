import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { threadId } from "node:worker_threads";
import { currentFileMutationWorker, fileMutationWorkerMarker } from "./file-mutation-worker";
import { isProcessAlive } from "./process-liveness";

type LockOwner = {
  id: string;
  pid: number;
  ticket: number;
  worker?: string;
};

type Claim = {
  owner: LockOwner;
  path: string;
};

const LOCK_WAIT_TIMEOUT_MS = 5_000;

const sleep = (milliseconds: number) => {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
};

const readOwner = (claimPath: string) => {
  try {
    const value = JSON.parse(readFileSync(claimPath, "utf8")) as Partial<LockOwner>;
    if (typeof value.id === "string" && Number.isInteger(value.pid) && Number.isInteger(value.ticket)) {
      return value as LockOwner;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
  }

  const pid = Number.parseInt(basename(claimPath), 10);
  const worker = /^\d+-w([1-9]\d*)-/.exec(basename(claimPath));
  return {
    id: claimPath,
    pid,
    ticket: Number.MAX_SAFE_INTEGER,
    worker: worker ? fileMutationWorkerMarker(pid, Number(worker[1])) : undefined,
  };
};

const removeClaim = (claimPath: string) => {
  try {
    rmSync(claimPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
};

const removeClaimBestEffort = (claimPath: string) => {
  try {
    removeClaim(claimPath);
  } catch {
    // The ownership error is more useful than a secondary cleanup failure.
  }
};

const listClaims = (lockPath: string) => {
  while (true) {
    const claims: Claim[] = [];
    let changed = false;

    for (const name of readdirSync(lockPath)) {
      if (!name.endsWith(".active") && !name.endsWith(".waiting")) continue;

      const claimPath = join(lockPath, name);
      const owner = readOwner(claimPath);
      if (!owner) {
        changed = true;
        break;
      }
      if (
        !Number.isFinite(owner.pid) ||
        !isProcessAlive(owner.pid) ||
        (owner.worker !== undefined && !existsSync(owner.worker))
      ) {
        removeClaim(claimPath);
        changed = true;
        break;
      }
      claims.push({ owner, path: claimPath });
    }

    if (!changed) return claims;
  }
};

const hasChoosingClaim = (lockPath: string) => {
  let choosing = false;

  for (const name of readdirSync(lockPath)) {
    if (!name.endsWith(".choosing")) continue;

    const claimPath = join(lockPath, name);
    const owner = readOwner(claimPath);
    if (!owner) continue;
    if (
      !Number.isFinite(owner.pid) ||
      !isProcessAlive(owner.pid) ||
      (owner.worker !== undefined && !existsSync(owner.worker))
    ) {
      removeClaim(claimPath);
    } else {
      choosing = true;
    }
  }

  return choosing;
};

const ensureLockDirectory = (lockPath: string) => {
  mkdirSync(dirname(lockPath), { mode: 0o700, recursive: true });

  try {
    mkdirSync(lockPath, { mode: 0o700 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !statSync(lockPath).isDirectory()) throw error;
  }
};

export const acquireFileMutationLock = (descriptorPath: string, label = "file mutation") => {
  const lockPath = `${descriptorPath}.lock`;
  ensureLockDirectory(lockPath);

  const owner: LockOwner = { id: randomUUID(), pid: process.pid, ticket: 0, worker: currentFileMutationWorker() };
  const claimPrefix = join(lockPath, `${owner.pid}-w${threadId}-${owner.id}`);
  const choosingPath = `${claimPrefix}.choosing`;
  const waitingPath = `${claimPrefix}.waiting`;
  const activePath = `${claimPrefix}.active`;

  writeFileSync(choosingPath, JSON.stringify(owner), { flag: "wx", mode: 0o600 });

  try {
    owner.ticket = Math.max(0, ...listClaims(lockPath).map(({ owner: claimOwner }) => claimOwner.ticket)) + 1;
    writeFileSync(choosingPath, JSON.stringify(owner));
    renameSync(choosingPath, waitingPath);
    const deadline = Date.now() + LOCK_WAIT_TIMEOUT_MS;

    while (true) {
      if (!hasChoosingClaim(lockPath)) {
        const claims = listClaims(lockPath).sort(
          (left, right) => left.owner.ticket - right.owner.ticket || left.owner.id.localeCompare(right.owner.id),
        );
        if (claims[0]?.owner.id === owner.id) {
          renameSync(waitingPath, activePath);
          break;
        }
      }

      if (Date.now() >= deadline) throw new Error(`Timed out waiting for ${label} ownership`);
      sleep(1);
    }
  } catch (error) {
    removeClaimBestEffort(choosingPath);
    removeClaimBestEffort(waitingPath);
    throw error;
  }

  const releaseOnExit = () => removeClaimBestEffort(activePath);
  process.once("exit", releaseOnExit);

  return () => {
    process.off("exit", releaseOnExit);
    removeClaim(activePath);
  };
};

export const withFileMutationLock = <T>(descriptorPath: string, operation: () => T) => {
  const release = acquireFileMutationLock(descriptorPath);
  try {
    return operation();
  } finally {
    release();
  }
};
