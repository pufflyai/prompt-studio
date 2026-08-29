import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { createProcessApi } from "./extension-process-api";

const isAlive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const killQuietly = (pid: number, signal: NodeJS.Signals) => {
  try {
    process.kill(pid, signal);
  } catch {
    // Already gone.
  }
};

describe("extension process api", () => {
  test("run captures output and exit code", async () => {
    const api = createProcessApi();

    const result = await api.run({ command: ["echo", "hello"] });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("hello");
  });

  test(
    "spawnDetached outlives the spawning process and its process group",
    async () => {
      const helperPath = join(import.meta.dirname, "extension-process-api.detached-helper.ts");
      // The spawning process runs in its own process group so killing that group
      // simulates a Prompt Studio shutdown that takes the whole tree down.
      const parent = Bun.spawn([process.execPath, helperPath], {
        cwd: import.meta.dirname,
        detached: true,
        stdout: "pipe",
        stderr: "pipe",
      });

      const exitTimeout = setTimeout(() => parent.kill("SIGKILL"), 10_000);
      const [stdout, exitCode] = await Promise.all([new Response(parent.stdout).text(), parent.exited]);
      clearTimeout(exitTimeout);

      // A detached child must not keep the spawning process alive.
      expect(exitCode).toBe(0);

      const childPid = Number.parseInt(stdout.trim(), 10);
      expect(Number.isFinite(childPid)).toBe(true);

      try {
        killQuietly(-parent.pid, "SIGKILL");

        expect(isAlive(childPid)).toBe(true);
      } finally {
        killQuietly(childPid, "SIGKILL");
      }
    },
    { timeout: 15_000 },
  );
});
