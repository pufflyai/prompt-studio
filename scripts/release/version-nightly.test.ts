import { afterEach, describe, expect, test } from "bun:test";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { versionNightly } from "./version-nightly";

const repoRoot = resolve(import.meta.dir, "../..");
const roots: string[] = [];

afterEach(() => {
  for (const root of roots) rmSync(root, { force: true, recursive: true });
  roots.length = 0;
});

type Manifest = { name: string; version: string; dependencies?: Record<string, string> };

const readManifest = (root: string, path: string) => JSON.parse(readFileSync(join(root, path), "utf8")) as Manifest;

// A copy of every workspace manifest and the real Changesets config, without
// pending changesets, so the run starts from what main has right after a release.
const copyWorkspace = () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-version-nightly-"));
  roots.push(root);
  const workspaces = (JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as { workspaces: string[] })
    .workspaces;
  const manifests = workspaces.flatMap((pattern) => [
    ...new Bun.Glob(`${pattern}/package.json`).scanSync({ cwd: repoRoot, dot: true, onlyFiles: true }),
  ]);
  for (const path of ["package.json", ".changeset/config.json", ".changeset/changelog.cjs", ...manifests]) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    copyFileSync(join(repoRoot, path), join(root, path));
  }
  return { root, manifests };
};

describe("nightly versioning", () => {
  test("gives every released package the same nightly version without touching extension SDK ranges", async () => {
    const { root, manifests } = copyWorkspace();
    const before = new Map(manifests.map((path) => [path, readManifest(root, path)]));
    const config = JSON.parse(readFileSync(join(root, ".changeset/config.json"), "utf8")) as { fixed: string[][] };

    const version = await versionNightly(root);

    expect(version).toMatch(/^\d+\.\d+\.\d+-nightly\.\d{14}$/);
    expect(Bun.semver.order(version, readManifest(repoRoot, "packages/pstdio/package.json").version)).toBe(1);
    const after = new Map(manifests.map((path) => [path, readManifest(root, path)]));
    const fixed = new Set(config.fixed[0]);
    for (const [path, manifest] of after) {
      if (fixed.has(manifest.name)) expect(`${manifest.name}@${manifest.version}`).toBe(`${manifest.name}@${version}`);
      for (const name of ["@pstdio/sdk", "@pstdio/ui"]) {
        expect(manifest.dependencies?.[name]).toBe(before.get(path)?.dependencies?.[name]);
      }
    }
  });
});
