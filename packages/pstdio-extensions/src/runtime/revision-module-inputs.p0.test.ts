import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectRevisionDependencies, hashRevisionDependencies } from "./revision-dependencies";

test("dependency inspection follows changed junctions and fingerprints the new package owner", () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "revision-module-owners-")));
  try {
    const source = join(root, "source");
    const first = join(root, "first");
    const second = join(root, "second");
    for (const path of [source, first, second]) mkdirSync(path);
    writeFileSync(join(source, "package.json"), JSON.stringify({ name: "revision-source" }));
    writeFileSync(join(source, "extension.ts"), 'export { value } from "./active/index.ts";');
    writeFileSync(join(first, "index.ts"), "export const value = 1;");
    writeFileSync(join(second, "index.ts"), "export const value = 2;");
    const active = join(source, "active");
    symlinkSync(first, active, "junction");

    const before = collectRevisionDependencies(source);
    expect(before.get(source)?.moduleInputs.get(":./active/index.ts")).toBe(first);
    const firstHash = hashRevisionDependencies(before, source);
    rmSync(active);
    symlinkSync(second, active, "junction");

    const after = collectRevisionDependencies(source);
    expect(after.get(source)?.moduleInputs.get(":./active/index.ts")).toBe(second);
    expect(after.has(first)).toBe(false);
    expect(hashRevisionDependencies(after, source)).not.toBe(firstHash);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
