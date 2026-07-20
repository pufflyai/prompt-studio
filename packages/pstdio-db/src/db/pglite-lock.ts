import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

type LockOwner = {
  id: string;
  pid: number;
  process: string;
  startedAt: string;
  ticket: number;
};

type Claim = {
  owner: LockOwner;
  path: string;
};

const CHOOSING_TIMEOUT_MS = 5_000;

const sleep = (milliseconds: number) => {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
};

const isProcessRunning = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
};

const describeLock = (owner: Partial<LockOwner>) => {
  const pid = typeof owner.pid === "number" ? owner.pid : "unknown";
  const command = owner.process ?? "unknown process";
  const started = owner.startedAt ? `, started ${owner.startedAt}` : "";
  return `pstdio.db is in use by pid ${pid} (${command}${started}) — refusing to open it a second time`;
};

const readOwner = (claimPath: string) => {
  try {
    return JSON.parse(fs.readFileSync(claimPath, "utf8")) as LockOwner;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return;
    }
    const pid = Number.parseInt(path.basename(claimPath), 10);
    return { id: claimPath, pid, process: "unknown process", startedAt: "", ticket: Number.MAX_SAFE_INTEGER };
  }
};

const removeClaim = (claimPath: string) => {
  try {
    fs.rmSync(claimPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
};

const removeClaimBestEffort = (claimPath: string) => {
  try {
    removeClaim(claimPath);
  } catch {
    // The lock error is more actionable than a secondary cleanup failure.
  }
};

const listClaims = (lockPath: string) => {
  while (true) {
    const claims: Claim[] = [];
    let changed = false;
    for (const name of fs.readdirSync(lockPath)) {
      if (!name.endsWith(".active") && !name.endsWith(".waiting")) {
        continue;
      }

      const claimPath = path.join(lockPath, name);
      const owner = readOwner(claimPath);
      if (!owner) {
        changed = true;
        break;
      }
      if (!Number.isFinite(owner.pid) || !isProcessRunning(owner.pid)) {
        removeClaim(claimPath);
        changed = true;
        break;
      }
      claims.push({ owner, path: claimPath });
    }

    if (!changed) {
      return claims;
    }
  }
};

const hasChoosingClaim = (lockPath: string) => {
  let choosing = false;
  for (const name of fs.readdirSync(lockPath)) {
    if (!name.endsWith(".choosing")) {
      continue;
    }
    const claimPath = path.join(lockPath, name);
    const owner = readOwner(claimPath);
    if (!owner) {
      continue;
    }
    if (!Number.isFinite(owner.pid) || !isProcessRunning(owner.pid)) {
      removeClaim(claimPath);
    } else {
      choosing = true;
    }
  }
  return choosing;
};

const ensureLockDirectory = (lockPath: string) => {
  try {
    fs.mkdirSync(lockPath);
    return;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
      throw error;
    }
  }

  if (fs.statSync(lockPath).isDirectory()) {
    return;
  }

  const legacyOwner = readOwner(lockPath);
  if (!legacyOwner) {
    return ensureLockDirectory(lockPath);
  }
  if (Number.isFinite(legacyOwner.pid) && isProcessRunning(legacyOwner.pid)) {
    throw new Error(describeLock(legacyOwner));
  }
  fs.rmSync(lockPath);
  fs.mkdirSync(lockPath);
};

export const acquirePgliteLock = (dbPath: string) => {
  const lockPath = `${dbPath}.lock`;
  ensureLockDirectory(lockPath);

  const owner: LockOwner = {
    id: randomUUID(),
    pid: process.pid,
    process: process.argv.join(" ") || process.execPath,
    startedAt: new Date().toISOString(),
    ticket: 0,
  };
  const claimPrefix = path.join(lockPath, `${owner.pid}-${owner.id}`);
  const choosingPath = `${claimPrefix}.choosing`;
  const waitingPath = `${claimPrefix}.waiting`;
  const activePath = `${claimPrefix}.active`;
  fs.writeFileSync(choosingPath, JSON.stringify(owner), { flag: "wx" });
  const existingTickets = listClaims(lockPath).map(({ owner: claimOwner }) => claimOwner.ticket);
  owner.ticket = Math.max(0, ...existingTickets) + 1;
  fs.writeFileSync(choosingPath, JSON.stringify(owner));
  fs.renameSync(choosingPath, waitingPath);
  const choosingDeadline = Date.now() + CHOOSING_TIMEOUT_MS;

  while (true) {
    if (hasChoosingClaim(lockPath)) {
      if (Date.now() >= choosingDeadline) {
        removeClaimBestEffort(waitingPath);
        throw new Error("Timed out waiting for another process choosing the pstdio.db lock");
      }
      sleep(1);
      continue;
    }

    const claims = listClaims(lockPath);
    const active = claims.filter(({ path: claimPath }) => claimPath.endsWith(".active"));
    if (active.length > 0) {
      removeClaimBestEffort(waitingPath);
      throw new Error(describeLock(active[0]?.owner ?? {}));
    }

    claims.sort((left, right) => left.owner.ticket - right.owner.ticket || left.owner.id.localeCompare(right.owner.id));
    if (claims[0]?.owner.id === owner.id) {
      fs.renameSync(waitingPath, activePath);
      break;
    }
    sleep(1);
  }

  const release = () => removeClaim(activePath);
  process.once("exit", release);

  return () => {
    process.off("exit", release);
    release();
  };
};
