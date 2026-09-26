import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnRuntimeProcess } from "./runtime-process";

test("a runtime can write output after its Node owner exits", async () => {
  const node = Bun.which("node");
  if (!node) throw new Error("Desktop runtime tests require Node.js");
  const root = mkdtempSync(join(tmpdir(), "desktop-runtime-output-"));
  const pidFile = join(root, "child.pid");
  const release = join(root, "release");
  const completed = join(root, "completed");
  const outputPath = join(root, "desktop-runtime.log");
  const script = join(root, "owner.mts");
  const helper = new URL("./runtime-process.ts", import.meta.url).href;
  const childSource = `
import { existsSync, writeFileSync } from "node:fs";
process.on("uncaughtException", (error) => { writeFileSync(${JSON.stringify(completed)}, String(error)); process.exit(1); });
const timer = setInterval(() => {
  if (!existsSync(${JSON.stringify(release)})) return;
  clearInterval(timer);
  process.stdout.write("runtime stdout after owner exit\\n", () => {
    process.stderr.write("runtime stderr after owner exit\\n", () => writeFileSync(${JSON.stringify(completed)}, "done"));
  });
}, 10);
`;
  writeFileSync(
    script,
    `
import { writeFileSync } from "node:fs";
import { spawnRuntimeProcess } from ${JSON.stringify(helper)};
const child = spawnRuntimeProcess(process.execPath, ["-e", ${JSON.stringify(childSource)}], { env: process.env, outputPath: ${JSON.stringify(outputPath)} });
child.once("spawn", () => { writeFileSync(${JSON.stringify(pidFile)}, String(child.pid)); process.exit(0); });
`,
  );
  try {
    const owner = Bun.spawn([node, script], { stdout: "pipe", stderr: "pipe" });
    const [code, stderr] = await Promise.all([owner.exited, new Response(owner.stderr).text()]);
    expect(stderr).toBe("");
    expect(code).toBe(0);
    writeFileSync(release, "owner exited");
    for (let attempt = 0; attempt < 100 && !existsSync(completed); attempt++) await Bun.sleep(10);
    expect(existsSync(completed)).toBe(true);
    expect(readFileSync(completed, "utf8")).toBe("done");
    expect(readFileSync(outputPath, "utf8")).toContain("runtime stdout after owner exit");
    expect(readFileSync(outputPath, "utf8")).toContain("runtime stderr after owner exit");
  } finally {
    if (existsSync(pidFile)) {
      try {
        process.kill(Number(readFileSync(pidFile, "utf8")), "SIGKILL");
      } catch {}
    }
    rmSync(root, { recursive: true, force: true });
  }
});

test("keeps the latest launch failure in bounded diagnostics", async () => {
  const node = Bun.which("node");
  if (!node) throw new Error("Desktop runtime tests require Node.js");
  const root = mkdtempSync(join(tmpdir(), "desktop-runtime-diagnostics-"));
  const outputPath = join(root, "desktop-runtime.log");
  writeFileSync(outputPath, "previous launch failure");
  try {
    const child = spawnRuntimeProcess(
      node,
      [
        "-e",
        'process.stdout.write("x".repeat(70 * 1024)); process.stderr.write("database startup failed"); process.exitCode = 42;',
      ],
      {
        env: process.env,
        outputPath,
      },
    );
    const code = await new Promise<number | null>((resolve) => child.once("exit", resolve));
    expect(code).toBe(42);
    expect(child.readOutput()).toHaveLength(64 * 1024);
    expect(child.readOutput()).toEndWith("database startup failed");
    expect(child.readOutput()).not.toContain("previous launch failure");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
