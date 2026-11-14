import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { affectedPackages } from "./ci-packages";

interface Package {
  name: string;
  dir: string;
  dependencies: string[];
}
// Build/test dependencies are intentionally broader than production imports. In
// particular, API test fixtures depend on Planner; that must not make a Planner
// edit appear to change every API and desktop feature.
export const integrationSourceOwners = (
  packages: Package[],
  changed: string[],
  root = resolve(import.meta.dir, "../.."),
) => {
  if (!changed.length) return [];
  const production = packages.map((pkg) => {
    const manifest = join(root, pkg.dir, "package.json");
    if (!existsSync(manifest)) return pkg;
    const metadata = JSON.parse(readFileSync(manifest, "utf8"));
    const imports = new Set<string>(Object.keys(metadata.dependencies ?? {}));
    for (const file of new Bun.Glob("src/**/*.{ts,tsx}").scanSync(join(root, pkg.dir))) {
      if (/\.p[0-3]\.|\.(test|spec|fixture|test-fixture)\.|\/(test-utils|testing|fixtures|e2e)\//.test(`/${file}`))
        continue;
      const source = readFileSync(join(root, pkg.dir, file), "utf8");
      for (const match of source.matchAll(/(?:from\s*|import\s*\()\s*["']([^./][^"']+)["']/g)) {
        const imported = packages.find((owner) => match[1] === owner.name || match[1]!.startsWith(`${owner.name}/`));
        if (imported) imports.add(imported.name);
      }
    }
    return { ...pkg, dependencies: [...imports] };
  });
  return affectedPackages(production, changed);
};
