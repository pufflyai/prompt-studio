import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadExtensionRuntime } from "./index";

let tempDirs: string[] = [];
const originalAgentsEnv = process.env.PSTDIO_AGENTS;

const createProject = () => {
  const dir = mkdtempSync(join(tmpdir(), "pstdio-first-party-runtime-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  if (originalAgentsEnv === undefined) {
    delete process.env.PSTDIO_AGENTS;
  } else {
    process.env.PSTDIO_AGENTS = originalAgentsEnv;
  }

  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs = [];
});

describe("first-party extension runtime", () => {
  test("loads first-party package extensions", async () => {
    delete process.env.PSTDIO_AGENTS;
    const runtime = await loadExtensionRuntime({ projectRoot: createProject() });

    expect(runtime.extensions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "pstdio.planner",
          sourceKind: "package",
          sourcePath: "@pstdio/pstdio-ext-planner",
        }),
        expect.objectContaining({
          id: "pstdio.harness.claude-code",
          sourceKind: "package",
          sourcePath: "@pstdio/pstdio-ext-harness-claude-code",
        }),
        expect.objectContaining({
          id: "pstdio.harness.opencode",
          sourceKind: "package",
          sourcePath: "@pstdio/pstdio-ext-harness-opencode",
        }),
      ]),
    );
    expect(runtime.harnesses.map((harness) => harness.id).sort()).toEqual([
      "pstdio.harness.claude-code",
      "pstdio.harness.opencode",
    ]);
  });

  test("loads fake harness only when explicitly enabled for tests", async () => {
    process.env.PSTDIO_AGENTS = "fake,opencode";

    const runtime = await loadExtensionRuntime({ projectRoot: createProject() });

    expect(runtime.extensions).toContainEqual(
      expect.objectContaining({
        id: "pstdio.harness.fake",
        sourceKind: "package",
        sourcePath: "@pstdio/pstdio-ext-harness-fake",
      }),
    );
    expect(runtime.harnesses.map((harness) => harness.id)).toContain("pstdio.harness.fake");
  });
});
