import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync } from "node:fs";
import { join, resolve } from "node:path";
import type { createEditedTestMatrix } from "./edited-test-matrix";
import { createPriorityPlan } from "./priority-plan";
import { priorityPlanSetup } from "./priority-plan-setup";
import { requestedTestFiles } from "./requested-test-files";
import { runCiChecks } from "./run-ci-checks";
import { discoverTestFiles } from "./test-discovery";
import type { TestPriority } from "./test-policy";
import { matchesPlatform, quarantineRegistry, quarantineRunnerForTest } from "./test-quarantine";
import { readWorkspacePackages } from "./workspace-packages";

const root = resolve(import.meta.dirname, "../..");
const row = JSON.parse(process.env.EDITED_TEST_ROW!) as ReturnType<typeof createEditedTestMatrix>[number];
const evidence = join(root, "test-results/edited-tests");
mkdirSync(evidence, { recursive: true });
const selectionPath = join(evidence, "selection.json");
await Bun.write(selectionPath, row.files);
const files = requestedTestFiles(["--files-from", selectionPath], discoverTestFiles(root));
const sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const results: { files: string[]; lane: string; exitCode: number }[] = [];
const execute = async (command: string[], env: Record<string, string | undefined> = {}) => {
  const child = Bun.spawn(command, {
    cwd: root,
    env: { ...process.env, ...env },
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  return child.exited;
};
let failed = false;
const checkQuarantine = async (file: string, runner: string, owner: string, env: Record<string, string>) => {
  const quarantined = quarantineRegistry.some(
    (entry) => entry.runner === runner && entry.file === file && matchesPlatform(entry, process.platform, process.arch),
  );
  if (!quarantined) return;
  await Bun.write(selectionPath, JSON.stringify([file]));
  const args = [runner, "--scope", owner, "--files-from", selectionPath];
  const code = await execute(["bun", "scripts/ci/run-quarantined-tests.ts", ...args, "--prebuilt"], env);
  const verified = await execute(["bun", "scripts/ci/verify-quarantine-reports.ts", ...args], env);
  results.push({ files: [file], lane: "quarantine", exitCode: code });
  failed ||= verified !== 0;
};
if (row.suite) {
  // Suites own cold-start order and their fixed workloads. An edit checks the complete suite once.
  const code = await execute([
    "bun",
    "packages/benchmarks/src/cli.ts",
    "run",
    "--checkout",
    `${root}=${sha}=edited-tests`,
    "--suites",
    row.suite,
    "--samples",
    "1",
    "--cache",
    join(process.env.RUNNER_TEMP ?? evidence, "edited-benchmarks"),
    "--out",
    join(evidence, "performance"),
  ]);
  results.push({ files, lane: "performance", exitCode: code });
  failed = code !== 0;
  // The desktop benchmark adapter already executes stable and quarantined cases together,
  // in cold-start order, and requires their reports. Never execute those cases a second time.
  if (row.suite !== "desktop") {
    const packages = readWorkspacePackages(root);
    for (const file of files) {
      const owner = packages.find((pkg) => file.startsWith(`${pkg.dir}/`))?.name ?? "repository";
      await checkQuarantine(file, "bun", owner, {
        TEST_PRIORITIES: row.priority,
        PSTDIO_EXTENSION_RELEASE_REF: sha,
      });
    }
  }
} else {
  const packages = readWorkspacePackages(root).map((pkg) => ({
    ...pkg,
    scripts: JSON.parse(readFileSync(join(root, pkg.dir, "package.json"), "utf8")).scripts ?? {},
  }));
  const priority = row.priority as TestPriority;
  const plan = createPriorityPlan(files, packages, priority, { scope: row.owner, runner: row.runner });
  if (new Set(plan.flatMap((run) => run.files)).size !== files.length)
    throw new Error("Edited tests missing from runner plan");
  const setup = priorityPlanSetup(root, plan, packages);
  const prepared = setup.length ? await runCiChecks(setup, { priority, concurrency: 1 }) : { outcome: "success" };
  if (prepared.outcome !== "success") throw new Error("Edited-test dependencies did not build");
  if (process.platform === "linux" && row.desktop) {
    const electron = join(root, "clients/desktop/node_modules/electron/dist/chrome-sandbox");
    const packaged = join(root, "clients/desktop/out/prompt-studio-linux-x64/chrome-sandbox");
    for (const path of [electron, packaged]) {
      if (!existsSync(path)) continue;
      if (await execute(["sudo", "chown", "root:root", path])) throw new Error("Cannot set native sandbox owner");
      if (await execute(["sudo", "chmod", "4755", path])) throw new Error("Cannot configure native sandbox");
    }
  }
  const env = {
    TEST_PRIORITIES: row.priority,
    PSTDIO_EXTENSION_RELEASE_REF: sha,
    E2E_PACKAGED_BINARY_PATH: join(root, "dist", process.platform === "win32" ? "pstdio.exe" : "pstdio"),
  };
  const runner = quarantineRunnerForTest(row.runner);
  for (const [index, file] of files.entries()) {
    await Bun.write(selectionPath, JSON.stringify([file]));
    const quarantinedHere = quarantineRegistry.some(
      (entry) =>
        entry.runner === runner && entry.file === file && matchesPlatform(entry, process.platform, process.arch),
    );
    if (row.stable) {
      const code = await execute(
        [
          "bun",
          "scripts/ci/run-priority-tests.ts",
          row.priority.toLowerCase(),
          "--files-from",
          selectionPath,
          "--prebuilt",
          ...(quarantinedHere ? ["--allow-quarantine-only"] : []),
        ],
        env,
      );
      results.push({ files: [file], lane: "stable", exitCode: code });
      failed ||= code !== 0;
    }
    await checkQuarantine(file, runner, row.owner, env);
    const owner = packages.find((pkg) => pkg.name === row.owner);
    if (owner && owner.dir !== ".") {
      const output = join(root, owner.dir, "test-results");
      if (existsSync(output)) renameSync(output, join(evidence, `artifacts-${index}`));
    }
    const report = join(root, `test-results/ci/${row.priority.toLowerCase()}-results.json`);
    if (existsSync(report)) renameSync(report, join(evidence, `result-${index}.json`));
  }
}
await Bun.write(
  join(evidence, "results.json"),
  JSON.stringify(
    { sourceSha: sha, row, selectedFiles: files, results, outcome: failed ? "failure" : "success" },
    null,
    2,
  ),
);
if (process.env.GITHUB_STEP_SUMMARY) {
  const summary = [
    `### Edited tests: ${row.name}`,
    ...results.map((result) => `- ${result.lane}: ${result.files.join(", ")} — exit ${result.exitCode}`),
  ];
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\n${summary.join("\n")}\n`);
}
process.exitCode = failed ? 1 : 0;
