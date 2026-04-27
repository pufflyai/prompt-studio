import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadExtensionRuntime } from "./index";

let tempDirs: string[] = [];

const createProject = () => {
  const dir = mkdtempSync(join(tmpdir(), "pstdio-first-party-runtime-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs = [];
});

describe("first-party extension runtime", () => {
  test("loads the planner package extension", async () => {
    const runtime = await loadExtensionRuntime({ projectRoot: createProject() });

    expect(runtime.extensions).toContainEqual(
      expect.objectContaining({
        id: "pstdio.planner",
        sourceKind: "package",
        sourcePath: "@pstdio/pstdio-ext-planner",
      }),
    );
  });
});
