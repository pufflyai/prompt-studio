import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../..");
const workflowFiles = [".github/workflows", ".github/actions"].flatMap((folder) =>
  readdirSync(resolve(root, folder), { recursive: true, encoding: "utf8" })
    .filter((path) => path.endsWith(".yml"))
    .map((path) => `${folder}/${path}`),
);

// Each `<script> <runner> [--scope <owners>]` call names one quarantine lane.
const lanes = (commands: string[], script: string) =>
  commands
    .flatMap((command) => [...command.matchAll(new RegExp(`${script}\\.ts (\\S+)([^\\n]*)`, "g"))])
    .map(([, runner, rest]) => `${runner} ${rest!.match(/--scope (\S+)/)?.[1] ?? "(every owner)"}`)
    .sort();

test("every workflow job verifies the same quarantine lanes it runs", () => {
  const mismatches = workflowFiles.flatMap((file) => {
    const workflow = Bun.YAML.parse(readFileSync(resolve(root, file), "utf8")) as {
      jobs?: Record<string, { steps?: { run?: string }[] }>;
      runs?: { steps?: { run?: string }[] };
    };
    const jobs = workflow.jobs ?? (workflow.runs ? { action: workflow.runs } : {});
    return Object.entries(jobs).flatMap(([job, { steps = [] }]) => {
      const commands = steps.flatMap((step) => step.run ?? []);
      const orderedDesktop = commands.some(
        (command) =>
          command.includes("bun run test:benchmark") ||
          command.includes("bun run --cwd clients/desktop test:benchmark"),
      );
      const run = [
        ...lanes(commands, "run-quarantined-tests"),
        ...(orderedDesktop ? ["packaged-desktop-benchmark @pstdio/desktop"] : []),
      ].sort();
      const verified = lanes(commands, "verify-quarantine-reports");
      return JSON.stringify(run) === JSON.stringify(verified) ? [] : [{ file, job, run, verified }];
    });
  });

  expect(mismatches).toEqual([]);
});
