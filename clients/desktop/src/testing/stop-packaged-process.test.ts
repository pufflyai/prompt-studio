import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("Node cleanup terminates a packaged process and its descendants", async () => {
  const node = Bun.which("node");
  if (!node) throw new Error("The packaged Playwright tests require Node.js");
  const root = mkdtempSync(join(tmpdir(), "pstdio-process-tree-"));
  const pidFile = join(root, "children.json");
  const script = join(root, "cleanup.mts");
  const helper = new URL("./stop-packaged-process.ts", import.meta.url).href;
  const descendant = `import { writeFileSync } from "node:fs"; writeFileSync(${JSON.stringify(pidFile)}, JSON.stringify([process.ppid, process.pid])); setInterval(() => {}, 1000);`;
  const parent = `import { spawn } from "node:child_process"; spawn(process.execPath, ["-e", ${JSON.stringify(descendant)}], { detached: process.platform === "win32", stdio: "ignore" }); setInterval(() => {}, 1000);`;
  writeFileSync(
    script,
    `
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { stopPackagedProcess } from ${JSON.stringify(helper)};
const child = spawn(process.execPath, ["-e", ${JSON.stringify(parent)}], { detached: process.platform !== "win32", stdio: "ignore" });
while (!existsSync(${JSON.stringify(pidFile)})) await new Promise((resolve) => setTimeout(resolve, 10));
await stopPackagedProcess(child);
for (const pid of JSON.parse(readFileSync(${JSON.stringify(pidFile)}, "utf8"))) {
  // A process group is signalled together, but each descendant exits independently.
  const deadline = Date.now() + 1000;
  while (true) {
    try { process.kill(pid, 0); } catch (error) {
      if (error.code !== "ESRCH") throw error;
      break;
    }
    if (Date.now() >= deadline) { process.exitCode = 1; console.error("Leaked process", pid); break; }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
`,
  );
  try {
    // Run the cleanup in Node, the runtime that owns the packaged Playwright children.
    const runner = Bun.spawn([node, script], { stdout: "pipe", stderr: "pipe" });
    const [code, stderr] = await Promise.all([runner.exited, new Response(runner.stderr).text()]);
    expect(stderr).toBe("");
    expect(code).toBe(0);
    expect(JSON.parse(readFileSync(pidFile, "utf8"))).toHaveLength(2);
  } finally {
    if (existsSync(pidFile)) {
      for (const pid of JSON.parse(readFileSync(pidFile, "utf8")) as number[]) {
        try {
          process.kill(pid, "SIGKILL");
        } catch {}
      }
    }
    rmSync(root, { recursive: true, force: true });
  }
});
