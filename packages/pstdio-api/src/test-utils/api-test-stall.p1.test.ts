import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { recordStalledProcesses, stopStalledProcesses } from "./api-test-stall";

const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

test.skipIf(process.platform === "win32")(
  "records and stops every process under a stalled file",
  async () => {
    const directory = await mkdtemp(join(tmpdir(), "api-stall-"));
    const childPid = join(directory, "child.pid");
    // Like the runner's wrapper, the parent only waits for the process that does the work.
    const parent = Bun.spawn([
      process.execPath,
      "-e",
      `const child = Bun.spawn(["sleep", "60"]); await Bun.write(${JSON.stringify(childPid)}, String(child.pid)); await child.exited;`,
    ]);
    try {
      while (!(await Bun.file(childPid).exists())) await Bun.sleep(10);
      const child = Number(await Bun.file(childPid).text());
      const report = join(directory, "files", "0", "stall.txt");

      const pids = recordStalledProcesses(parent.pid, report);
      expect(pids).toEqual([parent.pid, child]);
      const states = await Bun.file(report).text();
      expect(states).toContain(`## Process ${child}`);
      expect(states).toContain("sleep 60");

      stopStalledProcesses(pids);
      expect(await parent.exited).not.toBe(0);
      while (alive(child)) await Bun.sleep(10);
    } finally {
      parent.kill();
      await rm(directory, { recursive: true, force: true });
    }
    // macOS samples each process for a second; the API runner allows 30 s per test.
  },
  30_000,
);
