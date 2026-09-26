import { expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { text } from "node:stream/consumers";
import { fileURLToPath } from "node:url";
import { stopPackagedProcess } from "./stop-packaged-process";

test("terminates packaged processes when the test body times out", async () => {
  const node = Bun.which("node");
  if (!node) throw new Error("The packaged Playwright tests require Node.js");
  const root = mkdtempSync(join(tmpdir(), "pstdio-fixture-timeout-"));
  const pidFile = join(root, "child.pid");
  const fixture = fileURLToPath(new URL("./packaged-fixture.ts", import.meta.url));
  const playwright = fileURLToPath(import.meta.resolve("@playwright/test/cli"));
  writeFileSync(join(root, "playwright.config.ts"), 'export default { timeout: 1000, workers: 1, reporter: "line" };');
  writeFileSync(
    join(root, "timeout.spec.ts"),
    `
import { writeFileSync } from "node:fs";
import { test, spawnPackagedProcess } from ${JSON.stringify(fixture)};
test("holds a packaged process past the test deadline", async () => {
  const child = spawnPackagedProcess(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "pipe" });
  writeFileSync(${JSON.stringify(pidFile)}, String(child.pid));
  // Expire only after the child exists; waiting a full second adds no coverage.
  test.setTimeout(1);
  await new Promise(() => {});
});
`,
  );
  // Use the runtime that owns the packaged Playwright processes, including worker IPC.
  const runner = spawn(node, [playwright, "test", "--config", join(root, "playwright.config.ts")], {
    cwd: root,
    detached: process.platform !== "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });
  try {
    const [[code], stdout, stderr] = await Promise.all([
      once(runner, "exit"),
      text(runner.stdout),
      text(runner.stderr),
    ]);
    expect(`${stdout}\n${stderr}`).toContain("Test timeout of 1ms exceeded");
    expect(code).toBe(1);
    expect(existsSync(pidFile)).toBe(true);
    const childPid = Number(readFileSync(pidFile, "utf8"));
    expect(() => process.kill(childPid, 0)).toThrow();
  } finally {
    try {
      await stopPackagedProcess(runner);
    } finally {
      if (existsSync(pidFile)) {
        try {
          process.kill(Number(readFileSync(pidFile, "utf8")), "SIGKILL");
        } catch {}
      }
      rmSync(root, { recursive: true, force: true });
    }
  }
});
