import { relative } from "node:path";
import { partitionPackageChecks } from "./package-check-matrix";
import { priorityFromFile, testRunner } from "./test-discovery";
import type { TestPriority } from "./test-policy";
import type { readWorkspacePackages } from "./workspace-packages";

type WorkspacePackage = ReturnType<typeof readWorkspacePackages>[number];

// Each contract job spends most of a minute on setup before short tests. Two shards keep the
// queue's job count low while the longest shard stays within its critical path.
const contractJobs = 2;

const partition = (files: string[], maximum: number, target: number) => {
  const count = Math.min(maximum, Math.ceil(files.length / target));
  const rows: string[][] = Array.from({ length: count }, () => []);
  files.forEach((file, index) => {
    rows[index % count]!.push(file);
  });
  return rows;
};

const fileRows = (files: string[], count: number, priority: TestPriority) =>
  Array.from({ length: Math.min(files.length, count) }, (_, index) => ({
    priority,
    shard: index + 1,
    total: Math.min(files.length, count),
    files: JSON.stringify(files.map((file) => relative("packages/e2e", file).replaceAll("\\", "/"))),
  }));

const componentRows = (files: string[], packages: WorkspacePackage[], owners: string[], priorities: TestPriority[]) => {
  const sourceOwners = packages.filter(
    (pkg) =>
      owners.includes(pkg.name) &&
      files.some((file) => file.startsWith(`packages/canvas-tests/src/ui/${pkg.dir.split("/").at(-1)}/`)),
  );
  const selected = files.filter((file) => {
    if (testRunner(file) !== "component") return false;
    const owner = file.split("/")[4];
    if (sourceOwners.length) return sourceOwners.some((pkg) => pkg.dir === `packages/${owner}`);
    return owners.includes("canvas-tests");
  });
  return priorities.flatMap((priority) => {
    const matching = selected.filter((file) => priorityFromFile(file) === priority);
    return [...new Set(matching.map((file) => file.split("/")[4]!))].sort().map((owner) => ({
      package: owner,
      project: packages.find((pkg) => pkg.dir === `packages/${owner}`)!.name,
      priority,
      files: JSON.stringify(
        matching
          .filter((file) => file.split("/")[4] === owner)
          .map((file) => file.replace("packages/canvas-tests/", "")),
      ),
    }));
  });
};

export const createTestMatrices = (
  files: string[],
  packages: WorkspacePackage[],
  owners: string[],
  priorities: TestPriority[],
) => {
  const functional = priorities.filter((priority) => priority !== "P0");
  const selected = files.filter((file) => {
    const owner = packages.find((pkg) => file.startsWith(`${pkg.dir}/`));
    return owner && owners.includes(owner.name);
  });
  const databaseMatrix = priorities.flatMap((priority) =>
    packages
      .filter((pkg) => ["pstdio-api", "pstdio-db"].includes(pkg.name))
      .flatMap((pkg) => {
        const matching = selected.filter(
          (file) => file.startsWith(`${pkg.dir}/`) && file.endsWith(".test.ts") && priorityFromFile(file) === priority,
        );
        const api = pkg.name === "pstdio-api";
        let maximum = 3;
        let target = 25;
        if (api) {
          maximum = 4;
          target = 100;
        }
        if (api && priority === "P1") {
          maximum = 5;
          target = 50;
        }
        const rows = partition(matching, maximum, target);
        return rows.map((row, index) => ({
          package: pkg.name,
          priority,
          shard: `${index + 1}/${rows.length}`,
          files: JSON.stringify(row.map((file) => file.slice(pkg.dir.length + 1))),
        }));
      }),
  );
  const bunContractMatrix = functional.flatMap((priority) => {
    const names = packages
      .filter(
        (pkg) =>
          !["pstdio-api", "pstdio-db"].includes(pkg.name) &&
          selected.some(
            (file) =>
              file.startsWith(`${pkg.dir}/`) && testRunner(file) === "bun" && priorityFromFile(file) === priority,
          ),
      )
      .map((pkg) => pkg.name);
    return partitionPackageChecks(names, contractJobs).map((row) => ({ ...row, priority }));
  });
  const app = selected.filter((file) => testRunner(file) === "app");
  const appMatrix = functional.flatMap((priority) =>
    fileRows(
      app.filter((file) => priorityFromFile(file) === priority),
      priority === "P1" ? 2 : 12,
      priority,
    ),
  );
  const packagedMatrix = functional.flatMap((priority) =>
    ["packaged-cli", "packaged-browser", "vite"].flatMap((runner) => {
      const matching = selected.filter((file) => testRunner(file) === runner && priorityFromFile(file) === priority);
      let shards = 1;
      if (priority === "P2" && runner === "packaged-cli") shards = 2;
      if (priority === "P2" && runner === "packaged-browser") shards = 3;
      const suite = runner.replace("packaged-", "");
      return fileRows(matching, shards, priority).map((row) => ({ ...row, suite, shard: `${row.shard}/${row.total}` }));
    }),
  );
  return {
    integrationMatrix: priorities.flatMap((priority) =>
      partitionPackageChecks(
        packages
          .filter((pkg) =>
            selected.some(
              (file) =>
                file.startsWith(`${pkg.dir}/`) &&
                testRunner(file) === "integration" &&
                priorityFromFile(file) === priority,
            ),
          )
          .map((pkg) => pkg.name),
        contractJobs,
      ).map((row) => ({ ...row, priority })),
    ),
    databaseMatrix,
    bunContractMatrix,
    appMatrix,
    packagedMatrix,
    componentMatrix: componentRows(files, packages, owners, functional),
  };
};
