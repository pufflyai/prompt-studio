import { afterEach, expect, test } from "bun:test";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { patchVersion, validatePatchSource, versionPatch } from "./version-patch";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots.length = 0;
});

const workspace = () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-patch-"));
  roots.push(root);
  mkdirSync(join(root, ".changeset"));
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({ name: "test", private: true, workspaces: ["packages/*"] }),
  );
  writeFileSync(
    join(root, ".changeset/config.json"),
    JSON.stringify({ fixed: [["pstdio", "@pstdio/sdk"]], access: "public", baseBranch: "main", changelog: false }),
  );
  for (const [dir, name] of [
    ["pstdio", "pstdio"],
    ["sdk", "@pstdio/sdk"],
  ]) {
    mkdirSync(join(root, "packages", dir), { recursive: true });
    writeFileSync(join(root, "packages", dir, "package.json"), JSON.stringify({ name, version: "0.43.1" }));
  }
  return root;
};

test("uses a patch bump even when the selected fix has a minor changeset", async () => {
  const root = workspace();
  writeFileSync(join(root, ".changeset/fix.md"), '---\n"pstdio": minor\n---\n\nFix startup.\n');
  expect(await versionPatch(root, "Fix startup.")).toBe("0.43.2");
});

test("accepts only the current stable release as the patch base", () => {
  expect(patchVersion("pstdio@0.43.1", "pstdio@0.43.1")).toBe("0.43.2");
  expect(() => patchVersion("pstdio@0.43.0", "pstdio@0.43.1")).toThrow("current stable");
  expect(() => patchVersion("pstdio@0.44.0-nightly.1", "pstdio@0.44.0-nightly.1")).toThrow("stable release tag");
});

test("requires fixes to descend from the release and retain its package versions", () => {
  expect(() =>
    validatePatchSource({ descendsFromBase: true, sourceVersion: "0.43.1", baseTag: "pstdio@0.43.1" }),
  ).not.toThrow();
  expect(() =>
    validatePatchSource({ descendsFromBase: false, sourceVersion: "0.43.1", baseTag: "pstdio@0.43.1" }),
  ).toThrow("descend");
  expect(() =>
    validatePatchSource({ descendsFromBase: true, sourceVersion: "0.44.0", baseTag: "pstdio@0.43.1" }),
  ).toThrow("version");
});

test("keeps the real fixed group in sync and preserves extension SDK and UI ranges", async () => {
  const repo = resolve(import.meta.dir, "../..");
  const root = mkdtempSync(join(tmpdir(), "pstdio-patch-monorepo-"));
  roots.push(root);
  const read = (base: string, path: string) =>
    JSON.parse(readFileSync(join(base, path), "utf8")) as {
      name: string;
      version: string;
      dependencies?: Record<string, string>;
      workspaces?: string[];
    };
  const manifests = (read(repo, "package.json").workspaces ?? []).flatMap((pattern) => [
    ...new Bun.Glob(`${pattern.replace(/\/$/, "")}/package.json`).scanSync({ cwd: repo, dot: true, onlyFiles: true }),
  ]);
  for (const path of ["package.json", ".changeset/config.json", ".changeset/changelog.cjs", ...manifests]) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    copyFileSync(join(repo, path), join(root, path));
  }
  const config = JSON.parse(readFileSync(join(root, ".changeset/config.json"), "utf8")) as { fixed: string[][] };
  // A patch is versioned from a stable release checkout. Nightly candidates carry prerelease versions.
  const stable = read(root, "packages/pstdio/package.json").version.replace(/-.*$/, "");
  for (const path of manifests) {
    const manifest = read(root, path);
    if (config.fixed.flat().includes(manifest.name))
      writeFileSync(join(root, path), `${JSON.stringify({ ...manifest, version: stable }, null, 2)}\n`);
  }
  const before = new Map(manifests.map((path) => [path, read(root, path)]));
  const expected = patchVersion(`pstdio@${stable}`, `pstdio@${stable}`);
  const version = await versionPatch(root, "Fix stable startup.");
  expect(version).toBe(expected);
  for (const path of manifests) {
    const manifest = read(root, path);
    if (config.fixed.flat().includes(manifest.name)) expect(manifest.version).toBe(version);
    for (const name of ["@pstdio/sdk", "@pstdio/ui"])
      expect(manifest.dependencies?.[name]).toBe(before.get(path)?.dependencies?.[name]);
  }
});
