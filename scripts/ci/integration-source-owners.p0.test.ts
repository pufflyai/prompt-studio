import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { integrationSourceOwners } from "./integration-source-owners";

test("test-only dependencies do not broaden production integration coverage, while real imports do", () => {
  const root = mkdtempSync(join(tmpdir(), "integration-owners-"));
  const packages = [
    { name: "planner", dir: "extensions/planner", dependencies: [] },
    { name: "api", dir: "packages/api", dependencies: ["planner"] },
    { name: "consumer", dir: "packages/consumer", dependencies: ["planner"] },
  ];
  try {
    for (const pkg of packages) {
      mkdirSync(join(root, pkg.dir, "src"), { recursive: true });
      writeFileSync(
        join(root, pkg.dir, "package.json"),
        JSON.stringify({ name: pkg.name, devDependencies: { planner: "workspace:*" } }),
      );
    }
    writeFileSync(join(root, "packages/api/src/fixture.p0.test.ts"), 'import "planner";');
    writeFileSync(join(root, "packages/consumer/src/runtime.ts"), 'import { run } from "planner/runtime"; run();');
    expect(integrationSourceOwners(packages, ["extensions/planner/src/feature.ts"], root)).toEqual([
      "consumer",
      "planner",
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
