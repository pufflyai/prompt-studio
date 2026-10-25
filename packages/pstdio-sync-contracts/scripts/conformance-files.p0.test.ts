import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { conformanceFiles } from "./conformance-files";

test("isolated conformance discovers every selected contract without a maintained file list", async () => {
  const root = await mkdtemp(join(tmpdir(), "conformance-discovery-"));
  try {
    for (const file of [
      "first.p1.integration.ts",
      "new.p1.integration.ts",
      "permutation.p2.integration.ts",
      "unit.p0.test.ts",
    ])
      await writeFile(join(root, file), "export {};\n");
    expect(conformanceFiles([root], ["P1"]).map((file) => basename(file))).toEqual([
      "first.p1.integration.ts",
      "new.p1.integration.ts",
    ]);
    expect(conformanceFiles([join(root, "permutation.p2.integration.ts")], ["P2"])).toHaveLength(1);
    expect(() => conformanceFiles([root], ["P3"])).toThrow("No");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
