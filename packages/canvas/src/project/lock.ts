import { open, readFile, rm, stat } from "node:fs/promises";
import { join } from "node:path";

const isAlive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM: the process exists but belongs to another user.
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
};

/**
 * Lets one build at a time use an output folder: two builders would delete each other's modules.
 * A lock whose process has exited is stale and taken over. A second builder waits for the first.
 */
export const lockOutput = async (out: string, timeoutMs = 120_000) => {
  const path = join(out, "build.lock");
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const handle = await open(path, "wx");
      await handle.writeFile(String(process.pid));
      await handle.close();
      return { release: () => rm(path, { force: true }) };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
    const content = await readFile(path, "utf8").catch(() => "");
    const holder = Number(content);
    // An empty lock is still being written, unless its writer died before writing its process id.
    const abandoned = !holder && Date.now() - ((await stat(path).catch(() => undefined))?.mtimeMs ?? 0) > 5_000;
    if ((holder && !isAlive(holder)) || abandoned) {
      if ((await readFile(path, "utf8").catch(() => "")) === content) await rm(path, { force: true });
      continue;
    }
    if (Date.now() > deadline)
      throw new Error(`Another pstdio-canvas build (process ${holder}) is still using ${out}. Try again when it ends.`);
    await Bun.sleep(100);
  }
};
