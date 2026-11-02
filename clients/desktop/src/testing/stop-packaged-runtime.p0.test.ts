import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { isRuntimePidAlive } from "pstdio/runtime";
import { stopPackagedRuntime } from "./stop-packaged-runtime";

test("runtime cleanup waits until the process has exited", async () => {
  const node = Bun.which("node");
  if (!node) throw new Error("The packaged Playwright tests require Node.js");
  const root = mkdtempSync(join(tmpdir(), "pstdio-runtime-cleanup-"));
  const script = join(root, "cleanup.mts");
  const helper = fileURLToPath(new URL("./stop-packaged-runtime.ts", import.meta.url));
  const runtime = fileURLToPath(import.meta.resolve("pstdio/runtime"));
  writeFileSync(
    script,
    `
import { spawn } from "node:child_process";
import { once } from "node:events";
import { stopPackagedRuntime } from ${JSON.stringify(helper)};
import { isRuntimePidAlive } from ${JSON.stringify(runtime)};
const child = spawn(process.execPath, ["-e", "process.send('ready'); setInterval(() => {}, 1000)"], {
  cwd: ${JSON.stringify(root)}, stdio: ["ignore", "ignore", "ignore", "ipc"],
});
await once(child, "message");
await stopPackagedRuntime(child.pid);
if (isRuntimePidAlive(child.pid)) { process.exitCode = 1; console.error("Runtime still alive after cleanup"); }
`,
  );
  try {
    const built = await Bun.build({ entrypoints: [script], target: "node", outdir: root, naming: "cleanup.mjs" });
    expect(built.success).toBe(true);
    const runner = Bun.spawn([node, join(root, "cleanup.mjs")], {
      env: { ...process.env, FORCE_COLOR: undefined },
      stdout: "pipe",
      stderr: "pipe",
    });
    const [code, stderr] = await Promise.all([runner.exited, new Response(runner.stderr).text()]);
    expect(stderr).toBe("");
    expect(code).toBe(0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test.skipIf(process.platform !== "linux")(
  "cleanup finishes after a runtime exits before its parent reaps it",
  async () => {
    const parent = Bun.spawn(["sh", "-c", "sleep 30 & echo $!; exec sleep 30"], { stdout: "pipe" });
    try {
      const reader = parent.stdout.getReader();
      const { value } = await reader.read();
      reader.releaseLock();
      const pid = Number(new TextDecoder().decode(value).trim());
      while (readFileSync(`/proc/${parent.pid}/comm`, "utf8").trim() !== "sleep") await Bun.sleep(10);
      process.kill(pid, "SIGKILL");
      while (true) {
        const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
        if (stat.charAt(stat.lastIndexOf(")") + 2) === "Z") break;
        await Bun.sleep(10);
      }
      await stopPackagedRuntime(pid);
      expect(isRuntimePidAlive(pid)).toBe(false);
      expect(isRuntimePidAlive(parent.pid)).toBe(true);
    } finally {
      parent.kill("SIGKILL");
      await parent.exited;
    }
  },
);
