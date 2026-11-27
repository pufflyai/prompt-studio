// Temporary app-daemon lifecycle for the local harness; see ADR0169.
import { spawn } from "node:child_process";
import { closeSync, openSync } from "node:fs";

const log = openSync("/workspace/cloud-team/bootstrap.log", "a", 0o600);
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
