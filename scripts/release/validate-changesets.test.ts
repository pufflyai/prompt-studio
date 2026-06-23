import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectChangesetConfigIssues } from "./validate-changesets";

const tempDirs: string[] = [];

const makeTempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), "pstdio-changeset-config-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
  tempDirs.length = 0;
});

const writeJson = (path: string, value: unknown) => {
  writeFileSync(path, JSON.stringify(value, null, 2));
};

const writeWorkspace = (dependencyField: "dependencies" | "devDependencies") => {
  const root = makeTempDir();
  mkdirSync(join(root, ".changeset"), { recursive: true });
  mkdirSync(join(root, "packages", "public-package"), { recursive: true });
  mkdirSync(join(root, "packages", "private-helper"), { recursive: true });

  writeJson(join(root, "package.json"), {
    private: true,
    workspaces: ["packages/*"],
  });
  writeJson(join(root, ".changeset", "config.json"), {
    changelog: false,
    commit: false,
    fixed: [],
    linked: [],
    access: "public",
    baseBranch: "main",
    updateInternalDependencies: "patch",
    ignore: ["private-helper"],
    privatePackages: {
      version: true,
      tag: true,
    },
  });
  writeJson(join(root, "packages", "public-package", "package.json"), {
    name: "public-package",
    version: "1.0.0",
    [dependencyField]: {
      "private-helper": "workspace:*",
    },
  });
  writeJson(join(root, "packages", "private-helper", "package.json"), {
    name: "private-helper",
    private: true,
    version: "1.0.0",
  });

  return root;
};

describe("collectChangesetConfigIssues", () => {
  test("reports releasable packages with runtime dependencies on ignored packages", async () => {
    const issues = await collectChangesetConfigIssues(writeWorkspace("dependencies"));

    expect(issues).toHaveLength(1);
    expect(issues[0]?.filePath).toBe(".changeset/config.json");
    expect(issues[0]?.message).toContain('"public-package" depends on the skipped package "private-helper"');
  });

  test("allows releasable packages to use ignored packages as build-time dependencies", async () => {
    const issues = await collectChangesetConfigIssues(writeWorkspace("devDependencies"));

    expect(issues).toEqual([]);
  });
});
