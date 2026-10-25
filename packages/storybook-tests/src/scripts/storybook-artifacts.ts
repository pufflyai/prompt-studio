import { execFileSync } from "node:child_process";
import { access, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { sharedStorybooks } from "./storybook-config";

const outputPath = (packageName: string) => {
  if (!sharedStorybooks.some((owner) => owner.packageName === packageName))
    throw new Error(`Unknown Storybook owner: ${packageName}`);
  return `packages/${packageName}/storybook-static`;
};
const archivePath = (directory: string, packageName: string) => join(directory, `storybook-${packageName}.tar.gz`);
const requiredFiles = (output: string) => [`${output}/index.json`, `${output}/iframe.html`];

export const packStorybook = async (root: string, artifacts: string, packageName: string) => {
  const output = outputPath(packageName);
  for (const file of requiredFiles(output)) await access(join(root, file));
  await mkdir(artifacts, { recursive: true });
  execFileSync("tar", ["-czf", archivePath(artifacts, packageName), output], { cwd: root });
};

export const restoreStorybooks = async (root: string, artifacts: string) => {
  // Validate every producer before extracting any output. A partial matrix cannot
  // fall back to building a missing owner's stories inside a browser shard.
  for (const { packageName } of sharedStorybooks) {
    const output = outputPath(packageName);
    const archive = archivePath(artifacts, packageName);
    await access(archive);
    const entries = execFileSync("tar", ["-tzf", archive], { encoding: "utf8" }).trim().split("\n");
    if (
      entries.some((entry) => !entry.startsWith(`${output}/`) || entry.split("/").includes("..")) ||
      requiredFiles(output).some((file) => !entries.includes(file))
    )
      throw new Error(`Storybook archive does not contain its expected owner: ${packageName}`);
  }
  for (const { packageName } of sharedStorybooks)
    execFileSync("tar", ["-xzf", archivePath(artifacts, packageName)], { cwd: root });
};

if (import.meta.main) {
  const root = resolve(import.meta.dir, "../../../..");
  const artifacts = join(root, ".cache/storybook-artifacts");
  if (process.argv[2] === "pack") await packStorybook(root, artifacts, process.argv[3]);
  else if (process.argv[2] === "restore") await restoreStorybooks(root, artifacts);
  else throw new Error("Choose pack <owner> or restore");
}
