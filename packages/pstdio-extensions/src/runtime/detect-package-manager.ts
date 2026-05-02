import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type PackageManager = "npm" | "bun";

export type DetectPackageManagerResult = {
  manager: PackageManager;
  reason: "package_manager_field" | "lockfile" | "fallback_npm";
  source?: string;
};

const readPackageManagerField = (extensionPath: string) => {
  const pkgPath = join(extensionPath, "package.json");
  if (!existsSync(pkgPath)) return null;

  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { packageManager?: unknown };
    if (typeof pkg.packageManager !== "string") return null;
    return { value: pkg.packageManager, sourcePath: pkgPath };
  } catch {
    return null;
  }
};

const matchPackageManagerField = (value: string): PackageManager | null => {
  if (value.startsWith("bun@")) return "bun";
  if (value.startsWith("npm@")) return "npm";
  return null;
};

const lockfileSignals: Array<{ filename: string; manager: PackageManager }> = [
  { filename: "bun.lock", manager: "bun" },
  { filename: "bun.lockb", manager: "bun" },
  { filename: "package-lock.json", manager: "npm" },
];

export const detectPackageManager = (extensionPath: string): DetectPackageManagerResult => {
  const field = readPackageManagerField(extensionPath);
  if (field) {
    const matched = matchPackageManagerField(field.value);
    if (matched) {
      return { manager: matched, reason: "package_manager_field", source: field.sourcePath };
    }
  }

  for (const { filename, manager } of lockfileSignals) {
    const lockfilePath = join(extensionPath, filename);
    if (existsSync(lockfilePath)) {
      return { manager, reason: "lockfile", source: lockfilePath };
    }
  }

  return { manager: "npm", reason: "fallback_npm" };
};
