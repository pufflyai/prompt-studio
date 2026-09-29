import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const output = join(import.meta.dirname, "../startup-diagnostics");
mkdirSync(output, { recursive: true });
const command = Bun.spawn(["bun", "run", "test:packaged", "--grep", "@essential"], {
  cwd: join(import.meta.dirname, ".."),
  stdout: "inherit",
  stderr: "inherit",
});

const timer = setInterval(() => {
  const result = Bun.spawnSync(["ps", "-axo", "pid,ppid,time,%cpu,%mem,state,comm"]);
  const snapshot = result.stdout.toString();
  appendFileSync(join(output, "processes.log"), `${new Date().toISOString()}\n${snapshot}\n`);
}, 1_000);

const result = await command.exited;
clearInterval(timer);
process.exit(result);
