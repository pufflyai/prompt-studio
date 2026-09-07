import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const desktopRoot = resolve(import.meta.dirname, "..");
const repoRoot = resolve(desktopRoot, "../..");
const binaryPaths = {
  raw: join(repoRoot, "packages/pstdio/dist/platforms", `cli-darwin-${process.arch}`, "bin/pstdio"),
  signed: join(desktopRoot, "out", `Prompt Studio-darwin-${process.arch}`, "Prompt Studio.app/Contents/Resources/bin/pstdio"),
};
const waitForExit = (child: ChildProcess) => new Promise<void>((resolveExit) => {
  if (child.exitCode !== null || child.signalCode !== null) resolveExit();
  else child.once("exit", () => resolveExit());
});
const results: unknown[] = [];
for (const [variant, binary] of Object.entries(binaryPaths)) {
  if (!existsSync(binary)) { results.push({ variant, skipped: "Build did not produce this binary" }); continue; }
  const home = mkdtempSync(join(tmpdir(), "desktop-runtime-profile-"));
  mkdirSync(join(home, "tmp"));
  const env = { ...process.env, PSTDIO_HOME: home, TMPDIR: join(home, "tmp") };
  const start = performance.now();
  const child = spawn(binary, ["serve", "--foreground", "--owner", "desktop", "--host", "127.0.0.1", "--port", "0"], { cwd: home, env, stdio: ["ignore", "pipe", "pipe"] });
  const milestones: Array<{ milliseconds: number; phase: string }> = [];
  child.stdout?.on("data", (bytes) => {
    const text = String(bytes);
    if (text.includes("[createDb] PGlite ready")) milestones.push({ milliseconds: Math.round(performance.now() - start), phase: "database-ready" });
    if (text.includes("[drizzle] extracting 0000_")) milestones.push({ milliseconds: Math.round(performance.now() - start), phase: "extract-migrations" });
  });
  child.stderr?.resume();
  let readyMs: number | null = null;
  try {
    while (performance.now() - start < 15_000 && child.exitCode === null && child.signalCode === null) {
      try {
        const descriptor = JSON.parse(readFileSync(join(home, "runtime.json"), "utf8"));
        const ready = await fetch(`${descriptor.origin}/runtime/ready`, { headers: { authorization: `Bearer ${descriptor.token}` }, signal: AbortSignal.timeout(250) });
        if (ready.ok) { readyMs = Math.round(performance.now() - start); break; }
      } catch {}
      await Bun.sleep(25);
    }
    const signature = spawnSync("codesign", ["--display", "--verbose=4", binary], { encoding: "utf8" });
    results.push({ variant, platform: process.platform, arch: process.arch, readyMs, milestones, signature: signature.stderr });
    if (readyMs !== null) {
      const close = spawn(binary, ["close"], { cwd: home, env, stdio: "ignore" });
      await waitForExit(close);
    }
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
    await waitForExit(child);
    rmSync(home, { recursive: true, force: true });
  }
}
await Bun.write(join(desktopRoot, "test-results/runtime-startup-profile.json"), `${JSON.stringify(results, null, 2)}\n`);
for (const result of results) console.log(JSON.stringify(result));
