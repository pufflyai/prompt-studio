import { type ChildProcess, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { checkPlannerStress } from "./planner-stress-browser";
import { startPlannerStressRuntime } from "./planner-stress-packaged";

const repoRoot = resolve(import.meta.dirname, "../../../..");

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    process.stdout.write(`Check Planner's 1,000-ticket / 25-filtered workload.

bun run test:planner-stress                  # existing Docker stress stack
bun run test:planner-stress -- --name my-stress
bun run test:planner-stress -- --packaged     # disposable compiled runtime

Reports first timeline open, response bytes, mounted cards, three filter cycles,
and page heap usage. These are measurements, not new timing budgets.
`);
    return;
  }
  const nameIndex = args.indexOf("--name");
  const name = nameIndex >= 0 ? args[nameIndex + 1]! : "pstdio-planner-stress";
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(name)) throw new Error("Invalid isolated stack name.");
  const runtime = args.includes("--packaged") ? await startPlannerStressRuntime() : undefined;
  let seeder: ChildProcess | undefined;
  let stopping: Promise<void> | undefined;
  const stop = () => {
    if (seeder?.exitCode === null) seeder.kill();
    stopping ??= runtime?.stop() ?? Promise.resolve();
    return stopping;
  };
  const interrupt = () => void stop().finally(() => process.exit(130));
  const terminate = () => void stop().finally(() => process.exit(143));
  process.once("SIGINT", interrupt);
  process.once("SIGTERM", terminate);
  try {
    const connectionPath =
      runtime?.connectionPath ?? resolve(repoRoot, "__test-tmp__/dev-isolated", name, "connection.json");
    const connection = JSON.parse(readFileSync(connectionPath, "utf8"));
    const child = spawn("bun", [resolve(repoRoot, "scripts/dev/seed-planner-stress.ts"), connectionPath], {
      cwd: repoRoot,
      env: process.env,
      stdio: ["ignore", "pipe", "inherit"],
    });
    seeder = child;
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    const code = await new Promise<number | null>((resolveExit, reject) => {
      child.once("error", reject);
      child.once("exit", resolveExit);
    });
    if (code !== 0) throw new Error(`Seeding the stress project exited with ${code}.`);
    const fixture = JSON.parse(output.trim());
    const report = await checkPlannerStress(fixture, connection);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } finally {
    process.off("SIGINT", interrupt);
    process.off("SIGTERM", terminate);
    await stop();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
