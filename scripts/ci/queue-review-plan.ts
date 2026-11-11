import { join } from "node:path";
import { selectBrowserSmokeFiles } from "./browser-smoke-selection";
import { createPriorityPlan } from "./priority-plan";
import { resolveCiScope } from "./pull-request-ci-scope";

type Package = Parameters<typeof createPriorityPlan>[1][number];

// Reuse the queue's matrices and owning runners, so affected-file filtering cannot
// remove an unchanged contract that will gate this candidate in the merge queue.
export const queueReviewPlan = (packages: Package[], tests: string[], changed: string[]) => {
  const scope = resolveCiScope({ event: "merge_group", changedFiles: changed, packages, tests });
  if (
    scope.appMatrix.length ||
    scope.packagedMatrix.length ||
    scope.componentMatrix.length ||
    scope.clientMatrix.length ||
    scope.windows ||
    scope.harnessCli ||
    scope.dockerBuild
  )
    throw new Error("Merge queue added a validation lane; extend local queue coverage before running review");
  const owners = scope.packageMatrix.flatMap((row) => row.packages);
  const unit = createPriorityPlan(tests, packages, "P0", { runner: "bun" }).filter(
    (run) => run.owner !== "repository" && owners.includes(run.owner),
  );
  const repository = createPriorityPlan(tests, packages, "P0", { scope: "repository" });
  const database = scope.databaseMatrix.flatMap((row) => {
    const owner = packages.find((pkg) => pkg.name === row.package)!;
    return (JSON.parse(row.files) as string[]).map((file) => join(owner.dir, file).replaceAll("\\", "/"));
  });
  const contracts = [
    ...scope.bunContractMatrix.map((row) => ({ ...row, runner: "bun" })),
    ...scope.integrationMatrix.map((row) => ({ ...row, runner: "integration" })),
  ].flatMap((row) =>
    createPriorityPlan(tests, packages, row.priority, { runner: row.runner, scope: row.packages.join(",") }),
  );
  const browser = packages.find((pkg) => pkg.name === "e2e");
  if (scope.browserSmoke && !browser?.scripts["test:smoke"])
    throw new Error("Queue coverage requires the e2e test:smoke command");
  const smokeFiles = scope.browserSmoke ? selectBrowserSmokeFiles(tests) : [];
  const smoke = scope.browserSmoke
    ? [
        {
          id: "queue-browser-smoke",
          files: smokeFiles,
          cwd: browser!.dir,
          command: ["bun", "run", "test:smoke"],
          priority: "P1" as const,
        },
      ]
    : [];
  return {
    files: [
      ...new Set([
        ...unit.flatMap((run) => run.files),
        ...repository.flatMap((run) => run.files),
        ...database,
        ...contracts.flatMap((run) => run.files),
      ]),
    ].sort(),
    owners,
    smoke,
    smokeFiles,
    browserOwners: smoke.length
      ? packages.filter((pkg) => ["e2e", "pstdio-dashboard"].includes(pkg.name)).map((pkg) => pkg.name)
      : [],
  };
};
