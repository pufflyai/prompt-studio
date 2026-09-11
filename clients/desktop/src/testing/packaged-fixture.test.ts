import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

test("terminates packaged processes when the test body times out", async () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-fixture-timeout-"));
  const pidFile = join(root, "child.pid");
  let childPid: number | undefined;
  const fixture = fileURLToPath(new URL("./packaged-fixture.ts", import.meta.url));
  const playwright = fileURLToPath(import.meta.resolve("@playwright/test/cli"));
  writeFileSync(join(root, "playwright.config.ts"), 'export default { timeout: 1000, workers: 1, reporter: "line" };');
  writeFileSync(
    join(root, "timeout.spec.ts"),
    `
import { writeFileSync } from "node:fs";
import { test, spawnPackagedProcess } from ${JSON.stringify(fixture)};
test("holds a packaged process past the test deadline", async () => {
  const child = spawnPackagedProcess(${JSON.stringify(process.execPath)}, ["-e", "setInterval(() => {}, 1000)"], { stdio: "pipe" });
  writeFileSync(${JSON.stringify(pidFile)}, String(child.pid));
  await new Promise(() => {});
});
`,
  );
  try {
    const runner = Bun.spawn([process.execPath, playwright, "test", "--config", join(root, "playwright.config.ts")], {
      cwd: root,
      stdout: "pipe",
      stderr: "pipe",
    });
    const [code, stdout, stderr] = await Promise.all([
      runner.exited,
      new Response(runner.stdout).text(),
      new Response(runner.stderr).text(),
    ]);
    expect(`${stdout}\n${stderr}`).toContain("Test timeout of 1000ms exceeded");
    expect(code).toBe(1);
    expect(existsSync(pidFile)).toBe(true);
    childPid = Number(readFileSync(pidFile, "utf8"));
    expect(() => process.kill(childPid!, 0)).toThrow();
  } finally {
    if (childPid) {
      try {
        process.kill(childPid, "SIGKILL");
      } catch {}
    }
    rmSync(root, { recursive: true, force: true });
  }
});
