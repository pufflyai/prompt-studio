import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

test("terminates packaged process trees when the test body times out", async () => {
  console.log("cleanup diagnostic: begin", Date.now());
  const node = Bun.which("node");
  if (!node) throw new Error("The packaged Playwright tests require Node.js");
  const root = mkdtempSync(join(tmpdir(), "pstdio-fixture-timeout-"));
  const pidFile = join(root, "child.pid");
  let childPids: number[] = [];
  const fixture = fileURLToPath(new URL("./packaged-fixture.ts", import.meta.url));
  const playwright = fileURLToPath(import.meta.resolve("@playwright/test/cli"));
  writeFileSync(join(root, "playwright.config.ts"), 'export default { timeout: 1000, workers: 1, reporter: "line" };');
  writeFileSync(
    join(root, "timeout.spec.ts"),
    `
import { existsSync } from "node:fs";
import { test, spawnPackagedProcess } from ${JSON.stringify(fixture)};
test("holds a packaged process past the test deadline", async () => {
  console.log("cleanup diagnostic: inner begin", Date.now());
  const descendant = ${JSON.stringify(`import { writeFileSync } from "node:fs"; writeFileSync(${JSON.stringify(pidFile)}, JSON.stringify([process.ppid, process.pid])); setInterval(() => {}, 1000);`)};
  const parent = "import { spawn } from 'node:child_process'; spawn(process.execPath, ['-e', " + JSON.stringify(descendant) + "], { stdio: 'ignore' }); setInterval(() => {}, 1000);";
  spawnPackagedProcess(${JSON.stringify(node)}, ["-e", parent], { stdio: "inherit" });
  while (!existsSync(${JSON.stringify(pidFile)})) await new Promise((resolve) => setTimeout(resolve, 10));
  // Expire only after the child exists; waiting a full second adds no coverage.
  test.setTimeout(1);
  console.log("cleanup diagnostic: descendants ready", Date.now());
  await new Promise(() => {});
});
`,
  );
  try {
    const runner = Bun.spawn([node, playwright, "test", "--config", join(root, "playwright.config.ts")], {
      cwd: root,
      stdout: "pipe",
      stderr: "pipe",
    });
    const capture = async (stream: ReadableStream<Uint8Array>) => {
      let output = "";
      for await (const bytes of stream) {
        const chunk = new TextDecoder().decode(bytes);
        output += chunk;
        console.log("cleanup diagnostic: runner", Date.now(), chunk);
      }
      return output;
    };
    const [code, stdout, stderr] = await Promise.all([
      runner.exited,
      capture(runner.stdout),
      capture(runner.stderr),
    ]);
    expect(`${stdout}\n${stderr}`).toContain("Test timeout of 1ms exceeded");
    expect(code).toBe(1);
    expect(existsSync(pidFile)).toBe(true);
    childPids = JSON.parse(readFileSync(pidFile, "utf8"));
    expect(childPids).toHaveLength(2);
    for (const pid of childPids) expect(() => process.kill(pid, 0)).toThrow();
  } finally {
    if (childPids.length === 0 && existsSync(pidFile)) childPids = JSON.parse(readFileSync(pidFile, "utf8"));
    for (const pid of childPids) {
      try {
        process.kill(pid, "SIGKILL");
      } catch {}
    }
    rmSync(root, { recursive: true, force: true });
  }
});
