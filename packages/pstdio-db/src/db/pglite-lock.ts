import { Database } from "bun:sqlite";
import fs from "node:fs";

export const acquirePgliteLock = (dbPath: string) => {
  const legacyPath = `${dbPath}.lock`;
  if (fs.existsSync(legacyPath)) {
    const empty = fs.statSync(legacyPath).isDirectory() && fs.readdirSync(legacyPath).length === 0;
    if (!empty) throw new Error("A legacy pstdio.db lock exists. Stop its runtime before removing the legacy lock.");
  }
  // Keep this file's inode: SQLite's OS locks survive PID namespaces and release on process death.
  const lock = new Database(`${dbPath}.lock.sqlite`, { create: true });
  try {
    lock.exec("BEGIN IMMEDIATE");
  } catch (error) {
    lock.close();
    throw new Error("pstdio.db is in use — refusing to open it a second time", { cause: error });
  }
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    process.off("exit", release);
    lock.close();
  };
  process.once("exit", release);
  return release;
};
