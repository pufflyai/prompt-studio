import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { runCiChecks } from "./run-ci-checks";

const removeContainer = async (container: string, directory: string) => {
  try {
    // --all includes stopped containers; an already removed --rm container is success.
    const ids = execFileSync(
      "docker",
      ["container", "ls", "--all", "--quiet", "--filter", `name=^/${container.replaceAll(".", "\\.")}$`],
      {
        encoding: "utf8",
        timeout: 10000,
      },
    )
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!ids.length) return { container, outcome: "success" as const };
    const command = ["docker", "rm", "--force", ...ids];
    const result = await runCiChecks([{ id: container, command }], {
      priority: "P0",
      concurrency: 1,
      cleanupOnExit: true,
      logDirectory: join(directory, "logs/compose-cleanup"),
    });
    return { container, command, ...result };
  } catch (error) {
    return { container, outcome: "failure" as const, error: String(error) };
  }
};

// Compose resources live in Docker's daemon, outside the supervised process tree.
// Launchers register exact projects before startup; cleanup runs after their group exits.
export const cleanupReviewCompose = async (directory: string) => {
  let entries: string;
  try {
    entries = await readFile(join(directory, "compose-projects.jsonl"), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const projects = new Map<string, { project: string; file: string }>();
  const containers = new Set<string>();
  const invalid: { outcome: "failure"; error: string }[] = [];
  for (const [index, line] of entries.split("\n").entries()) {
    if (!line) continue;
    try {
      const entry = JSON.parse(line);
      if (typeof entry.container === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(entry.container)) {
        containers.add(entry.container);
        continue;
      }
      if (typeof entry.project !== "string" || typeof entry.file !== "string")
        throw new Error("Invalid owned Compose cleanup entry");
      projects.set(entry.project, entry);
    } catch (error) {
      invalid.push({ outcome: "failure", error: `Registration ${index + 1}: ${String(error)}` });
    }
  }
  const results = [];
  for (const { project, file } of projects.values()) {
    const command = ["docker", "compose", "-f", file, "-p", project, "down", "--volumes", "--remove-orphans"];
    const result = await runCiChecks([{ id: project, command }], {
      priority: "P0",
      concurrency: 1,
      cleanupOnExit: true,
      logDirectory: join(directory, "logs/compose-cleanup"),
    });
    results.push({ project, file, command, ...result });
  }
  const containerResults = [];
  for (const container of containers) containerResults.push(await removeContainer(container, directory));
  return [...invalid, ...results, ...containerResults];
};
