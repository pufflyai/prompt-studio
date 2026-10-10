import { appendFileSync } from "node:fs";
import { dirname } from "node:path";

interface PublicPackage {
  name: string;
  version: string;
  dir: string;
  // Null when the package has never been published.
  npmVersions: string[] | null;
}

export const planNpmPublishing = (packages: PublicPackage[]) => {
  const problems: string[] = [];
  for (const pkg of packages) {
    if (pkg.npmVersions === null)
      problems.push(
        `${pkg.name} is not on npm. Trusted publishing cannot create a package. Publish its first version by hand or make it private.`,
      );
    if (pkg.name === "pstdio" && pkg.npmVersions?.includes(pkg.version))
      problems.push(
        `pstdio@${pkg.version} is already on npm, so there is nothing to release. Check the version PR branch.`,
      );
  }
  const publish = packages.filter((pkg) => !pkg.npmVersions?.includes(pkg.version)).map((pkg) => pkg.dir);
  return { publish, problems };
};

const npmVersions = async (name: string) => {
  const result = Bun.spawnSync(["npm", "view", name, "versions", "--json"]);
  if (result.exitCode !== 0) {
    if (result.stderr.toString().includes("E404")) return null;
    throw new Error(`npm view ${name} failed: ${result.stderr.toString().trim()}`);
  }
  const versions = JSON.parse(result.stdout.toString()) as string | string[];
  return Array.isArray(versions) ? versions : [versions];
};

const publicPackages = async () => {
  const root = (await Bun.file("package.json").json()) as { workspaces: string[] };
  const packages: PublicPackage[] = [];
  for (const workspace of root.workspaces) {
    for await (const path of new Bun.Glob(`${workspace.replace(/\/$/, "")}/package.json`).scan(".")) {
      const manifest = (await Bun.file(path).json()) as { name?: string; version?: string; private?: boolean };
      if (manifest.private || !manifest.name || !manifest.version) continue;
      packages.push({
        name: manifest.name,
        version: manifest.version,
        dir: dirname(path),
        npmVersions: await npmVersions(manifest.name),
      });
    }
  }
  return packages;
};

if (import.meta.main) {
  const packages = await publicPackages();
  const plan = planNpmPublishing(packages);
  for (const dir of plan.publish) console.log(`Will publish ${dir}`);
  for (const problem of plan.problems) console.error(`::error::${problem}`);
  const version = packages.find((pkg) => pkg.name === "pstdio")?.version;
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\npublish=${JSON.stringify(plan.publish)}\n`);
  if (plan.problems.length > 0) process.exit(1);
}
