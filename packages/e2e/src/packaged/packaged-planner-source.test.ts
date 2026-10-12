import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { preparePlannerSource } from "./packaged-planner-source";

let root = "";
afterEach(() => rm(root, { recursive: true, force: true }));

// A release PR raises the workspace versions before they are published, so a
// Prompt Studio package resolved from npm fails there even when it works on main.
test("resolves every Prompt Studio package in the planner fixture to the workspace builds", async () => {
  root = await mkdtemp(join(tmpdir(), "planner-source-"));
  const source = await preparePlannerSource(root);

  const lock = Bun.JSONC.parse(await Bun.file(join(source, "bun.lock")).text()) as {
    packages: Record<string, [string, ...unknown[]]>;
  };
  const resolved = Object.values(lock.packages)
    .map(([id]) => id)
    .filter((id) => id.startsWith("@pstdio/"));
  expect(resolved).toEqual(
    expect.arrayContaining([expect.stringMatching(/^@pstdio\/sdk@/), expect.stringMatching(/^@pstdio\/ui@/)]),
  );
  expect(resolved.filter((id) => !id.includes(root))).toEqual([]);
});
