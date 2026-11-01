import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPriorityPlan } from "./priority-plan";
import { priorityPlanSetup } from "./priority-plan-setup";

test("packaged setup builds its host once alongside the selected test dependencies", async () => {
  const root = await mkdtemp(join(tmpdir(), "packaged-build-plan-"));
  try {
    await mkdir(join(root, "scripts"));
    await writeFile(join(root, "package.json"), JSON.stringify({ scripts: { build: "bun build.fixture.ts" } }));
    await writeFile(
      join(root, "scripts/package.json"),
      JSON.stringify({ scripts: { "build:host": "bun ../host.fixture.ts" } }),
    );
    await writeFile(
      join(root, "host.fixture.ts"),
      `import {appendFileSync} from "node:fs";appendFileSync(${JSON.stringify(join(root, "host-builds.log"))},"host\\n");`,
    );
    // The real e2e workspace depends on pstdio. A dependency-graph build visits that host once,
    // including when the host is also selected explicitly.
    await writeFile(
      join(root, "build.fixture.ts"),
      `if(process.argv.includes("e2e")||process.argv.includes("pstdio"))await import("./host.fixture.ts");`,
    );
    const packages: Parameters<typeof createPriorityPlan>[1] = [
      { name: "e2e", dir: "packages/e2e", dependencies: ["pstdio"], scripts: {} },
      { name: "pstdio", dir: "packages/pstdio", dependencies: [], scripts: {} },
    ];
    const plan = createPriorityPlan(["packages/e2e/src/packaged/example.p1.test.ts"], packages, "P1");
    for (const step of priorityPlanSetup(root, plan, packages)) {
      const child = Bun.spawn(step.command, { cwd: step.cwd, stdout: "pipe", stderr: "pipe" });
      const [stdout, stderr, code] = await Promise.all([
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
        child.exited,
      ]);
      expect({ code, output: stdout + stderr }).toMatchObject({ code: 0 });
    }
    expect((await readFile(join(root, "host-builds.log"), "utf8")).trim().split("\n")).toEqual(["host"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
