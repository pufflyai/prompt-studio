// Seeds an isolated stack's demo project with thousands of Planner tickets and committed files.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = "/workspace/project";
const largeTickets = process.env.PSTDIO_PLANNER_STRESS_TICKETS ?? "3000";
const largeFiles = process.env.PSTDIO_LARGE_PROJECT_FILES ?? "5000";

export const seedLargeProject = (connectionPath: string, stackName: string) => {
  // The Planner stress fixture already seeds real tickets through the command API and resumes safely.
  const tickets = spawnSync("bun", [resolve(import.meta.dirname, "seed-planner-stress.ts"), connectionPath], {
    stdio: ["ignore", "pipe", "inherit"],
    encoding: "utf8",
    env: { ...process.env, PSTDIO_PLANNER_STRESS_TICKETS: largeTickets },
  });
  if (tickets.status !== 0) throw new Error("Seeding the large project's tickets failed.");
  const fixture = JSON.parse(tickets.stdout) as { tickets: number; projectId: string; timelineUrl: string };

  process.stderr.write(`Large project files: writing ${largeFiles}\n`);
  // The project folder is a volume inside the stack, so the files are written by the container's own Bun.
  const files = spawnSync(
    "docker",
    [
      "exec",
      "-e",
      `LARGE_PROJECT_FILES=${largeFiles}`,
      "-w",
      PROJECT_ROOT,
      `${stackName}-prompt-studio-1`,
      "bun",
      "-e",
      readFileSync(resolve(import.meta.dirname, "large-project-files.ts"), "utf8"),
    ],
    { stdio: ["ignore", "pipe", "inherit"], encoding: "utf8" },
  );
  if (files.status !== 0) throw new Error("Seeding the large project's files failed.");
  return { ...fixture, files: Number(largeFiles) };
};

if (import.meta.main) {
  const [connectionPath, stackName] = process.argv.slice(2);
  if (!connectionPath || !stackName) throw new Error("Pass the stack's connection.json path and its --name.");
  const start = performance.now();
  const seeded = seedLargeProject(connectionPath, stackName);
  process.stdout.write(`${JSON.stringify({ ...seeded, seedMs: Math.round(performance.now() - start) })}\n`);
}
