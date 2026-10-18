import { execFile } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { promisify } from "node:util";
import { packWorkspacePackageTarball } from "../local-workspace-registry";

const repoRoot = join(import.meta.dirname, "../../../..");

export async function preparePlannerSource(root: string) {
  mkdirSync(root, { recursive: true });
  const source = join(root, "planner-source");
  // Unpublished UI APIs need the built packages, including a generated fixture
  // lockfile. Release lockfiles still name the published package tarballs.
  cpSync(join(repoRoot, "extensions/pstdio-planner"), source, {
    recursive: true,
    filter: (path) => !["node_modules", "bun.lock"].includes(basename(path)),
  });
  const path = join(source, "package.json");
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  // The packed UI pins the SDK to the workspace version, which a release PR raises before
  // npm has it. Overrides resolve that nested SDK to the workspace build too.
  manifest.overrides = {};
  for (const name of ["sdk", "ui"]) {
    const tarball = `file:${packWorkspacePackageTarball(join(repoRoot, "packages", name), root)}`;
    manifest.dependencies[`@pstdio/${name}`] = tarball;
    manifest.overrides[`@pstdio/${name}`] = tarball;
  }
  writeFileSync(path, JSON.stringify(manifest));
  await promisify(execFile)("bun", ["install", "--lockfile-only", "--ignore-scripts"], { cwd: source });
  return source;
}
