import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { resolveIsolatedHome } from "./dev-isolated";

const args = process.argv.slice(2);
const repoRoot = resolve(import.meta.dirname, "../..");
const nameIndex = args.indexOf("--name");
const name = nameIndex >= 0 ? args[nameIndex + 1]! : "pstdio-planner-stress";

if (args.includes("--help") || args.includes("-h")) {
  process.stdout.write(`Start a Docker-isolated Planner with 1,000 tickets and a saved filter matching 25.

bun run dev:planner-stress
bun run dev:planner-stress -- --name my-stress
bun run dev:planner-stress -- --logs
bun run dev:planner-stress -- --down

The named stack stays available until --down removes its state and volumes.
Seeding resumes an interrupted fixture. No agent sessions are started.
`);
} else {
  const home = resolveIsolatedHome(repoRoot, name);
  const started = spawnSync("bun", [resolve(import.meta.dirname, "dev-isolated.ts"), "--name", name, ...args], {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  });
  if (started.status !== 0) process.exit(started.status ?? 1);
  if (!args.includes("--down") && !args.includes("--logs")) {
    const seeded = spawnSync(
      "bun",
      [resolve(import.meta.dirname, "seed-planner-stress.ts"), resolve(home, "..", "connection.json")],
      { cwd: repoRoot, stdio: ["ignore", "pipe", "inherit"], encoding: "utf8", env: process.env },
    );
    if (seeded.status !== 0) process.exit(seeded.status ?? 1);
    const fixture = JSON.parse(seeded.stdout);
    process.stdout.write(`\nTimeline: ${fixture.timelineUrl}\n`);
    process.stdout.write(
      `Saved view: ${fixture.viewTitle} (${fixture.matching} matching / ${fixture.tickets} total)\n`,
    );
    process.stdout.write(`Check: bun run test:planner-stress -- --name ${name}\n`);
    process.stdout.write(`Stop: bun run dev:planner-stress -- --name ${name} --down\n`);
  }
}
