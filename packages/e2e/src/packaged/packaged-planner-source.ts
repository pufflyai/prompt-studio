import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { packWorkspacePackageTarball } from "../local-workspace-registry";

const repoRoot = join(import.meta.dirname, "../../../..");

export async function preparePlannerSource(root: string, options: { offline?: boolean } = {}) {
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
  const lock = Bun.spawn(
    ["bun", "install", "--lockfile-only", "--ignore-scripts", ...(options.offline ? ["--offline"] : [])],
    {
      cwd: source,
      stdout: "ignore",
      stderr: "pipe",
    },
  );
  const [exit, error] = await Promise.all([lock.exited, new Response(lock.stderr).text()]);
  if (exit !== 0) throw new Error(`Could not prepare planner fixture: ${error}`);
  return source;
}
