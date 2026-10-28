import { expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

for (const phase of ["test", "beforeAll"] as const) {
  test(`runner cancellation reaps pending processes after a ${phase} deadline`, async () => {
    const root = mkdtempSync(join(tmpdir(), "test-process-cleanup-"));
    const pidPath = join(root, "child.pid");
    const fixture = join(root, "deadline.test.ts");
    const readinessPath = resolve(import.meta.dirname, "process-readiness.ts");
    const setup = `async () => {
      const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {stdio: "pipe"});
      writeFileSync(${JSON.stringify(pidPath)}, String(child.pid));
      await waitForProcessReady(child, "Fixture", async () => undefined);
    }`;
    writeFileSync(
      fixture,
      `
      import {test, beforeAll} from "bun:test";
      import {spawn} from "node:child_process";
      import {writeFileSync} from "node:fs";
      import {waitForProcessReady} from ${JSON.stringify(readinessPath)};
      ${phase === "test" ? `test("deadline", ${setup}, 100);` : `beforeAll(${setup}, 100); test("after setup", () => {});`}
    `,
    );
    let pid: number | undefined;
    try {
      const runner = spawn(
        process.execPath,
        ["test", "--preload", resolve(import.meta.dirname, "bun-process-cleanup.ts"), fixture],
        { stdio: "pipe" },
      );
      runner.stdout.resume();
      let stderr = "";
      runner.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });
      const code = await new Promise<number | null>((resolve, reject) => {
        runner.once("error", reject);
        runner.once("close", resolve);
      });
      expect({ code, stderr }).toMatchObject({ code: 1, stderr: expect.stringContaining("timed out") });
      pid = Number(readFileSync(pidPath, "utf8"));
      expect(() => process.kill(pid!, 0)).toThrow();
    } finally {
      if (pid) {
        try {
          process.kill(pid);
        } catch {}
      }
      rmSync(root, { recursive: true, force: true });
    }
  });
}
