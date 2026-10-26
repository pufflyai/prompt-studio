import { execFile } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { promisify } from "node:util";
import { packWorkspacePackageTarball } from "../local-workspace-registry";

const repoRoot = join(import.meta.dirname, "../../../..");

export async function preparePackagedExtensionSource(
  root: string,
  packagePath: string,
  options: { offline?: boolean } = {},
) {
  mkdirSync(root, { recursive: true });
  const source = join(root, "extension-source");
  rmSync(source, { recursive: true, force: true });
  // Test unpublished APIs through installed public packages, leaving release dependencies unchanged.
  cpSync(packagePath, source, {
    recursive: true,
    filter: (path) => !["node_modules", "bun.lock"].includes(basename(path)),
  });
  const path = join(source, "package.json");
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  manifest.overrides = {};
  for (const name of ["sdk", "ui"]) {
    const tarball = `file:${packWorkspacePackageTarball(join(repoRoot, "packages", name), root)}`;
    manifest.dependencies[`@pstdio/${name}`] = tarball;
    manifest.overrides[`@pstdio/${name}`] = tarball;
  }
  writeFileSync(path, JSON.stringify(manifest));
  await promisify(execFile)(
    "bun",
    ["install", "--lockfile-only", "--ignore-scripts", ...(options.offline ? ["--offline"] : [])],
    { cwd: source },
  );
  return source;
}
