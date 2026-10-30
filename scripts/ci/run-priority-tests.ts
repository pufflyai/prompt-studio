import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { bunRunIdentity } from "./bun-test-evidence";
import { createPriorityPlan } from "./priority-plan";
import { runCiChecks } from "./run-ci-checks";
import { discoverTestFiles, testPriorities } from "./test-discovery";
import type { TestPriority } from "./test-policy";
import { readWorkspacePackages } from "./workspace-packages";

const root = resolve(import.meta.dir, "../..");
const args = process.argv.slice(2).filter((arg) => arg !== "--");
const priority = args.shift()?.toUpperCase() as TestPriority;
if (!testPriorities.includes(priority)) throw new Error("Choose p0, p1, p2 or p3");
const option = (name: string) => {
  const index = args.indexOf(name);
  if (index < 0) return;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`Missing value for ${name}`);
  return value;
};
const packages = readWorkspacePackages(root).map((pkg) => ({
  ...pkg,
  scripts: JSON.parse(readFileSync(join(root, pkg.dir, "package.json"), "utf8")).scripts ?? {},
}));
const plan = createPriorityPlan(discoverTestFiles(root), packages, priority, {
  scope: option("--scope"),
  runner: option("--runner"),
});
if (!plan.length) throw new Error(`No ${priority} tests selected`);
if (args.includes("--list")) {
  console.log(JSON.stringify(plan, null, 2));
} else {
  process.env.TEST_PRIORITIES = priority;
  process.env.CI_PRIORITY = priority;
  const prebuilt = args.includes("--prebuilt");
  const buildScopes = [
    ...new Set(
      plan
        .map((run) => {
          if (run.componentOwner) return packages.find((pkg) => pkg.dir === `packages/${run.componentOwner}`)!.name;
          return run.owner;
        })
        .filter((owner) => owner !== "repository"),
    ),
  ];
  const setup = [];
  if (!prebuilt) {
    if (buildScopes.length)
      setup.push({
        id: "build-test-dependencies",
        cwd: root,
        command: [
          "bun",
          "run",
          "build",
          "--",
          ...buildScopes.flatMap((owner) => ["--scope", owner]),
          "--include-dependencies",
        ],
      });
    if (plan.some((run) => run.componentOwner))
      setup.push({
        id: "build-canvas-previews",
        cwd: root,
        command: ["bun", "x", "--no-install", "lerna", "run", "build:previews", "--scope", "canvas-tests"],
      });
    if (plan.some((run) => run.runner.startsWith("packaged") || (run.runner === "performance" && run.owner === "e2e")))
      setup.push({ id: "build-packaged-cli", cwd: root, command: ["bun", "run", "--cwd", "scripts", "build:host"] });
    if (
      plan.some((run) => run.runner === "desktop" || (run.owner === "@pstdio/desktop" && run.runner === "performance"))
    )
      setup.push({ id: "package-desktop", cwd: root, command: ["bun", "run", "--cwd", "clients/desktop", "package"] });
  }
  const prepared = setup.length ? await runCiChecks(setup, { priority, concurrency: 1 }) : { outcome: "success" };
  if (prepared.outcome !== "success") process.exitCode = 1;
  else {
    const checks = plan.map((run) => ({
      id: run.id,
      cwd: join(root, run.cwd),
      command: run.componentOwner
        ? ["bun", "x", "--no-install", "cross-env", `CANVAS_TEST_PACKAGES=${run.componentOwner}`, ...run.command]
        : run.command,
    }));
    const result = await runCiChecks(checks, {
      priority,
      concurrency: priority === "P0" ? 2 : 1,
      env: {
        TEST_PRIORITIES: priority,
        CI_PRIORITY: priority,
        ...(priority === "P3" ? { UI_PERF_ASSERT_BUDGETS: "1" } : {}),
        E2E_PACKAGED_BINARY_PATH:
          process.env.E2E_PACKAGED_BINARY_PATH ??
          join(root, "dist", process.platform === "win32" ? "pstdio.exe" : "pstdio"),
      },
    });
    await Bun.write(
      join(root, `test-results/ci/${priority.toLowerCase()}-results.json`),
      JSON.stringify(
        { ...bunRunIdentity(root), selectedFiles: plan.flatMap((run) => run.files), priority, plan, ...result },
        null,
        2,
      ),
    );
    process.exitCode = result.outcome === "success" ? 0 : 1;
  }
}
