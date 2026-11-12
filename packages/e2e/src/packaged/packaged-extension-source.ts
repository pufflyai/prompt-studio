import { execFile } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { promisify } from "node:util";
import { packWorkspacePackageTarball } from "../local-workspace-registry";

const repoRoot = join(import.meta.dirname, "../../../..");

export const preparePackagedPackageArtifacts = (root: string) =>
  Object.freeze(
    Object.fromEntries(
      ["sdk", "ui"].map((name) => [
        `@pstdio/${name}`,
        packWorkspacePackageTarball(join(repoRoot, "packages", name), root),
      ]),
    ),
  );

export async function preparePackagedExtensionSource(
  root: string,
  packagePath: string,
  options: {
    install?: boolean;
    offline?: boolean;
    env?: NodeJS.ProcessEnv;
    signal?: AbortSignal;
    packageArtifacts?: Readonly<Record<string, string>>;
  } = {},
) {
  mkdirSync(root, { recursive: true });
  const source = join(root, "extension-source");
  rmSync(source, { recursive: true, force: true });
  // Test unpublished APIs through installed public packages, leaving release dependencies unchanged.
  cpSync(packagePath, source, {
    recursive: true,
    filter: (path) => basename(path) !== "node_modules",
  });
  const path = join(source, "package.json");
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  manifest.overrides = {};
  for (const name of ["sdk", "ui"]) {
    if (!manifest.dependencies?.[`@pstdio/${name}`]) continue;
    const artifact =
      options.packageArtifacts?.[`@pstdio/${name}`] ??
      packWorkspacePackageTarball(join(repoRoot, "packages", name), root);
    const tarball = `file:${artifact}`;
    manifest.dependencies[`@pstdio/${name}`] = tarball;
    manifest.overrides[`@pstdio/${name}`] = tarball;
  }
  writeFileSync(path, JSON.stringify(manifest));
  await promisify(execFile)(
    "bun",
    [
      "install",
      ...(options.install ? [] : ["--lockfile-only"]),
      "--ignore-scripts",
      ...(options.offline ? ["--offline"] : []),
    ],
    { cwd: source, env: options.env, signal: options.signal },
  );
  return source;
}
