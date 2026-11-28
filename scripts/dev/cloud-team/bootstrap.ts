// Temporary app-daemon lifecycle for the local harness; see ADR0169.
import { spawn } from "node:child_process";
import { closeSync, mkdirSync, openSync, writeSync } from "node:fs";

const log = openSync("/workspace/cloud-team/bootstrap.log", "a", 0o600);
const writable = {
  HOME: "/workspace/cloud-team/build-home",
  TMPDIR: "/workspace/cloud-team/tmp",
  BUN_INSTALL_CACHE_DIR: "/workspace/cloud-team/bun-cache",
};
for (const directory of Object.values(writable)) mkdirSync(directory, { recursive: true, mode: 0o700 });
writeSync(log, `${JSON.stringify({ phase: "build environment", ...writable })}\n`);
const startup = [
  "git init -q",
  "git add -A",
  "git -c user.name=CloudTest -c user.email=cloud-test@example.invalid -c commit.gpgsign=false commit -qm snapshot",
  "bun install --frozen-lockfile",
  "bun run build -- --scope pstdio-dashboard --include-dependencies",
  "bun scripts/dev/cloud-team/workspace.ts",
].join(" && ");
const child = spawn("sh", ["-c", `${startup}; code=$?; echo "$code" > /workspace/cloud-team/exited; exit "$code"`], {
  cwd: "/workspace/cloud-team/repo",
  env: { ...process.env, ...writable },
  detached: true,
  stdio: ["ignore", log, log],
});
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.unref();
closeSync(log);
console.log(JSON.stringify({ pid: child.pid }));
