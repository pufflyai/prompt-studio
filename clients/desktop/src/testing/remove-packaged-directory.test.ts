import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("removes a home after a transient native directory handle is released", async () => {
  const node = Bun.which("node");
  if (!node) throw new Error("The packaged Playwright tests require Node.js");
  const root = mkdtempSync(join(tmpdir(), "pstdio-home-removal-"));
  const home = join(root, "home");
  const script = join(root, "remove.mts");
  mkdirSync(home);
  const helper = new URL("./remove-packaged-directory.ts", import.meta.url).href;
  const holder = `import { tmpdir } from "node:os";
process.on("message", () => setTimeout(() => process.chdir(tmpdir()), 200));
process.send("ready");`;
  writeFileSync(
    script,
    `
import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { removePackagedDirectory } from ${JSON.stringify(helper)};
const child = spawn(process.execPath, ["-e", ${JSON.stringify(holder)}], {
  cwd: ${JSON.stringify(home)}, stdio: ["ignore", "ignore", "ignore", "ipc"],
});
try {
  await once(child, "message");
  child.send("release");
  await removePackagedDirectory(${JSON.stringify(home)});
  if (existsSync(${JSON.stringify(home)})) throw new Error("Home was not removed");
} finally {
  const exited = once(child, "exit");
  child.kill("SIGKILL");
  await exited;
}
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
