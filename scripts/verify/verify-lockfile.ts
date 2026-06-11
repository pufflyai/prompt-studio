import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dir, "../..");
const DEPENDENCY_FIELDS = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"] as const;

type DependencyField = (typeof DEPENDENCY_FIELDS)[number];

interface PackageManifest {
  [key: string]: unknown;
}

interface LockfileWorkspace {
  [key: string]: unknown;
}

interface Lockfile {
  workspaces?: Record<string, LockfileWorkspace>;
}

const readJson = (file: string) => JSON.parse(readFileSync(file, "utf8")) as PackageManifest;

const readLockfile = () => {
  const source = readFileSync(path.join(ROOT, "bun.lock"), "utf8");
  return JSON.parse(source.replace(/,\s*([}\]])/g, "$1")) as Lockfile;
};

const asStringRecord = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, string>;
};

const compareDependencyField = (
  input: {
    dir: string;
    field: DependencyField;
    manifest: PackageManifest;
    workspace: LockfileWorkspace;
  },
  errors: string[],
) => {
  const manifestDeps = asStringRecord(input.manifest[input.field]);
  const lockDeps = asStringRecord(input.workspace[input.field]);
  const names = new Set([...Object.keys(manifestDeps), ...Object.keys(lockDeps)]);

  for (const name of names) {
    const manifestRange = manifestDeps[name];
    const lockRange = lockDeps[name];
    if (manifestRange !== lockRange) {
      errors.push(
        `${input.dir} ${input.field}.${name}: package.json has ${manifestRange ?? "<missing>"}, bun.lock has ${
          lockRange ?? "<missing>"
        }`,
      );
    }
  }
};

const main = () => {
  const lockfile = readLockfile();
  const errors: string[] = [];

  for (const [dir, workspace] of Object.entries(lockfile.workspaces ?? {})) {
    const manifestPath = path.join(ROOT, dir, "package.json");
    const manifest = readJson(manifestPath);

    for (const field of DEPENDENCY_FIELDS) {
      compareDependencyField({ dir: dir || ".", field, manifest, workspace }, errors);
    }
  }

  if (errors.length > 0) {
    console.error(`Lockfile workspace metadata drift (${errors.length}):`);
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }

  console.log(`Lockfile workspace metadata OK across ${Object.keys(lockfile.workspaces ?? {}).length} workspaces.`);
};

main();
