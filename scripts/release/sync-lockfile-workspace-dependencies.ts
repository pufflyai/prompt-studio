import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const DEPENDENCY_FIELDS = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"] as const;

type DependencyField = (typeof DEPENDENCY_FIELDS)[number];

type PackageManifest = Partial<Record<DependencyField, Record<string, string>>>;

type Lockfile = {
  workspaces?: Record<string, PackageManifest>;
};

const parseLockfile = (source: string) => JSON.parse(source.replace(/,\s*([}\]])/g, "$1")) as Lockfile;

const workspaceMarker = (dir: string) => `    ${JSON.stringify(dir)}: {`;

const syncDependencyField = (
  block: string,
  field: DependencyField,
  lockDependencies: Record<string, string>,
  manifestDependencies: Record<string, string>,
) => {
  const fieldMarker = `      ${JSON.stringify(field)}: {`;
  const start = block.indexOf(fieldMarker);
  if (start === -1) throw new Error(`Missing ${field} block in bun.lock workspace`);
  const end = block.indexOf("      },", start);
  if (end === -1) throw new Error(`Missing end of ${field} block in bun.lock workspace`);
  const fieldEnd = end + "      },".length;
  let result = block.slice(start, fieldEnd);

  for (const [name, lockRange] of Object.entries(lockDependencies)) {
    const manifestRange = manifestDependencies[name];
    if (manifestRange === undefined || manifestRange === lockRange) continue;

    const current = `        ${JSON.stringify(name)}: ${JSON.stringify(lockRange)},`;
    const updated = `        ${JSON.stringify(name)}: ${JSON.stringify(manifestRange)},`;
    const occurrences = result.split(current).length - 1;
    if (occurrences !== 1) {
      throw new Error(`Expected one ${field}.${name} entry in bun.lock workspace`);
    }
    result = result.replace(current, updated);
  }

  return `${block.slice(0, start)}${result}${block.slice(fieldEnd)}`;
};

const syncWorkspaceBlock = (block: string, workspace: PackageManifest, manifest: PackageManifest) => {
  let result = block;

  for (const field of DEPENDENCY_FIELDS) {
    const lockDependencies = workspace[field];
    if (!lockDependencies) continue;
    result = syncDependencyField(result, field, lockDependencies, manifest[field] ?? {});
  }

  return result;
};

export const syncLockfileWorkspaceDependencies = (source: string, manifests: Record<string, PackageManifest>) => {
  const lockfile = parseLockfile(source);
  const workspaces = Object.entries(lockfile.workspaces ?? {});
  let result = source;

  for (let index = workspaces.length - 1; index >= 0; index -= 1) {
    const [dir, workspace] = workspaces[index];
    const manifest = manifests[dir];
    if (!manifest) throw new Error(`Missing package manifest for bun.lock workspace: ${dir || "."}`);

    const start = result.indexOf(workspaceMarker(dir));
    if (start === -1) throw new Error(`Missing bun.lock workspace block: ${dir || "."}`);
    const nextDir = workspaces[index + 1]?.[0];
    const end = nextDir === undefined ? result.length : result.indexOf(workspaceMarker(nextDir), start + 1);
    if (end === -1) throw new Error(`Missing next bun.lock workspace block: ${nextDir}`);

    const block = result.slice(start, end);
    result = `${result.slice(0, start)}${syncWorkspaceBlock(block, workspace, manifest)}${result.slice(end)}`;
  }

  return result;
};

const main = () => {
  const root = resolve(import.meta.dir, "../..");
  const lockfilePath = join(root, "bun.lock");
  const source = readFileSync(lockfilePath, "utf8");
  const lockfile = parseLockfile(source);
  const manifests = Object.fromEntries(
    Object.keys(lockfile.workspaces ?? {}).map((dir) => {
      const manifestPath = join(root, dir, "package.json");
      return [dir, JSON.parse(readFileSync(manifestPath, "utf8")) as PackageManifest];
    }),
  );
  const updated = syncLockfileWorkspaceDependencies(source, manifests);

  if (updated === source) {
    console.log("Lockfile workspace dependency ranges already match package manifests.");
    return;
  }

  writeFileSync(lockfilePath, updated);
  console.log("Synced lockfile workspace dependency ranges.");
};

if (import.meta.main) main();
