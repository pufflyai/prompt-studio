import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("runtime cleanup waits until the process has exited", async () => {
  const node = Bun.which("node");
  if (!node) throw new Error("The packaged Playwright tests require Node.js");
  const root = mkdtempSync(join(tmpdir(), "pstdio-runtime-cleanup-"));
  const script = join(root, "cleanup.mts");
  const helper = new URL("./stop-packaged-runtime.ts", import.meta.url).href;
  writeFileSync(
    script,
    `
import { spawn } from "node:child_process";
import { once } from "node:events";
import { stopPackagedRuntime } from ${JSON.stringify(helper)};
const child = spawn(process.execPath, ["-e", "process.send('ready'); setInterval(() => {}, 1000)"], {
  cwd: ${JSON.stringify(root)}, stdio: ["ignore", "ignore", "ignore", "ipc"],
});
await once(child, "message");
await stopPackagedRuntime(child.pid);
try { process.kill(child.pid, 0); process.exitCode = 1; console.error("Runtime still alive after cleanup"); }
catch (error) { if (error.code !== "ESRCH") throw error; }
`,
  );
  try {
    const runner = Bun.spawn([node, script], { stdout: "pipe", stderr: "pipe" });
    const [code, stderr] = await Promise.all([runner.exited, new Response(runner.stderr).text()]);
    expect(stderr).toBe("");
    expect(code).toBe(0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
