import { Database } from "bun:sqlite";
import fs from "node:fs";
import path from "node:path";

export const acquirePgliteLock = (dbPath: string) => {
  const legacyPath = `${dbPath}.lock`;
  // Keep this file's inode: SQLite's OS locks survive PID namespaces and release on process death.
  const lock = new Database(`${dbPath}.lock.sqlite`, { create: true });
  try {
    lock.exec("BEGIN IMMEDIATE");
  } catch (error) {
    lock.close();
    throw new Error("pstdio.db is in use — refusing to open it a second time", { cause: error });
  }
  try {
    if (fs.existsSync(legacyPath) && !fs.lstatSync(legacyPath).isDirectory())
      throw new Error("A legacy pstdio.db lock exists. Stop its runtime before removing the legacy lock.");
    fs.mkdirSync(legacyPath, { recursive: true });
    const fence = path.join(legacyPath, "sqlite-format.active");
    // Older runtimes cannot unlink a directory as a stale PID claim (ADR 0079).
    if (!fs.existsSync(fence)) fs.mkdirSync(fence);
    if (
      !fs.lstatSync(fence).isDirectory() ||
      fs.readdirSync(fence).length ||
      fs.readdirSync(legacyPath).some((name) => name !== "sqlite-format.active")
    )
      throw new Error("A legacy pstdio.db lock exists. Stop its runtime before removing the legacy lock.");
  } catch (error) {
    lock.close();
    throw error;
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
