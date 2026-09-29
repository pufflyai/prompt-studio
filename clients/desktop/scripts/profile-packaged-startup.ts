import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const output = join(import.meta.dirname, "../startup-diagnostics");
mkdirSync(output, { recursive: true });
const sampled = new Set<number>();
const profiles: Promise<number>[] = [];
const command = Bun.spawn(["bun", "run", "test:packaged", "--grep", "@essential"], {
  cwd: join(import.meta.dirname, ".."),
  stdout: "inherit",
  stderr: "inherit",
});

const timer = setInterval(() => {
  const result = Bun.spawnSync(["ps", "-axo", "pid,ppid,%cpu,%mem,state,comm"]);
  const snapshot = result.stdout.toString();
  appendFileSync(join(output, "processes.log"), `${new Date().toISOString()}\n${snapshot}\n`);
  for (const line of snapshot.split("\n")) {
    if (!line.includes("/Contents/MacOS/Prompt Studio") && !line.includes("/Contents/Resources/bin/pstdio")) continue;
    const pid = Number(line.trim().split(/\s+/)[0]);
    if (!pid || sampled.has(pid)) continue;
    sampled.add(pid);
    const profile = Bun.spawn(["sample", String(pid), "8", "10", "-file", join(output, `sample-${pid}.txt`)], {
      stdout: "ignore",
      stderr: "inherit",
    });
    profiles.push(profile.exited);
  }
}, 1_000);

const result = await command.exited;
clearInterval(timer);
await Promise.all(profiles);
process.exit(result);
