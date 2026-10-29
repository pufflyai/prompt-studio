import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runPackagedRuntimeTests } from "./packaged-runtime-tests";

test("packaged runtime shards execute the complete native workload exactly once", () => {
  const cwd = mkdtempSync(join(tmpdir(), "packaged-shards-"));
  const executed = join(cwd, "executed");
  const binaryPath = join(cwd, "native-candidate");
  try {
    mkdirSync(join(cwd, "cases"));
    writeFileSync(join(cwd, "package.json"), JSON.stringify({ scripts: { "test:packaged:cli": "bun test ./cases" } }));
    for (let index = 0; index < 6; index++)
      writeFileSync(
        join(cwd, "cases", `case-${index}.test.ts`),
        `import { test, expect } from "bun:test";
import { appendFileSync } from "node:fs";
test("native case ${index}", () => {
  expect(process.env.E2E_PACKAGED_BINARY_PATH).toBe(${JSON.stringify(binaryPath)});
  appendFileSync(${JSON.stringify(executed)}, ${JSON.stringify(`${index}\n`)});
});`,
      );
    const cases = () => readFileSync(executed, "utf8").trim().split("\n").sort();
    runPackagedRuntimeTests({ cwd, binaryPath });
    const complete = cases();
    expect(complete).toHaveLength(6);
    writeFileSync(executed, "");
    runPackagedRuntimeTests({ cwd, binaryPath, shard: "1/2" });
    const first = cases();
    expect(first.length).toBeGreaterThan(0);
    expect(first.length).toBeLessThan(complete.length);
    runPackagedRuntimeTests({ cwd, binaryPath, shard: "2/2" });
    expect(cases()).toEqual(complete);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
