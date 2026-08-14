import { appendFile } from "node:fs/promises";
import { read as readChangesetsConfig } from "@changesets/config";

type PublishedPackage = {
  name: string;
  version: string;
};

export const selectReleasePackages = (publishedPackages: PublishedPackage[], ignoredPackages: ReadonlySet<string>) =>
  publishedPackages.filter(({ name }) => !ignoredPackages.has(name));

export const toReleaseTagRefs = (packages: PublishedPackage[]) =>
  packages.map(({ name, version }) => `refs/tags/${name}@${version}`);

const readPublishedPackages = () => {
  const value = JSON.parse(process.env.PSTDIO_PUBLISHED_PACKAGES ?? "[]") as PublishedPackage[];
  return value;
};

const writeReleasePackagesOutput = async (packages: PublishedPackage[]) => {
  const value = JSON.stringify(packages);
  const outputPath = process.env.GITHUB_OUTPUT;

  if (outputPath) {
    await appendFile(outputPath, `packages=${value}\n`);
    return;
  }

  console.log(value);
};

const pushTags = async (tagRefs: string[]) => {
  if (tagRefs.length === 0) {
    console.log("No release tags to push.");
    return;
  }

  const child = Bun.spawn(["git", "push", "origin", ...tagRefs], {
    cwd: process.cwd(),
    stdout: "inherit",
    stderr: "inherit",
  });
  const exitCode = await child.exited;

  if (exitCode !== 0) throw new Error(`git push failed with exit code ${exitCode}`);
};

const main = async () => {
  const config = await readChangesetsConfig(process.cwd());
  const publishedPackages = readPublishedPackages();
  const releasePackages = selectReleasePackages(publishedPackages, new Set(config.ignore));

  await pushTags(toReleaseTagRefs(releasePackages));
  await writeReleasePackagesOutput(releasePackages);
};

if (import.meta.main) {
  await main();
}
