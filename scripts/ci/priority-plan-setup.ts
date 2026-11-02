import type { createPriorityPlan } from "./priority-plan";

export const priorityPlanSetup = (
  root: string,
  plan: ReturnType<typeof createPriorityPlan>,
  packages: { name: string; dir: string }[],
) => {
  const buildScopes = new Set(
    plan
      .map((run) => {
        if (run.componentOwner) return packages.find((pkg) => pkg.dir === `packages/${run.componentOwner}`)!.name;
        return run.owner;
      })
      .filter((owner) => owner !== "repository"),
  );
  if (plan.some((run) => run.runner.startsWith("packaged") || (run.runner === "performance" && run.owner === "e2e")))
    buildScopes.add("pstdio");
  const setup = [];
  if (buildScopes.size)
    setup.push({
      id: "build-test-dependencies",
      cwd: root,
      command: [
        "bun",
        "run",
        "build",
        "--",
        ...[...buildScopes].flatMap((owner) => ["--scope", owner]),
        "--include-dependencies",
      ],
    });
  if (plan.some((run) => run.componentOwner))
    setup.push({
      id: "build-canvas-previews",
      cwd: root,
      command: ["bun", "x", "--no-install", "lerna", "run", "build:previews", "--scope", "canvas-tests"],
    });
  if (plan.some((run) => run.runner === "desktop" || (run.owner === "@pstdio/desktop" && run.runner === "performance")))
    setup.push({ id: "package-desktop", cwd: root, command: ["bun", "run", "--cwd", "clients/desktop", "package"] });
  return setup;
};
