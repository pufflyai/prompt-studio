import { readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const changesetBin = Bun.resolveSync("@changesets/cli/bin.js", import.meta.dir);
const stableTag = /^pstdio@(\d+)\.(\d+)\.(\d+)$/;

export const patchVersion = (baseTag: string, currentStableTag: string) => {
  const match = stableTag.exec(baseTag);
  if (!match) throw new Error("The patch base must be a stable release tag: pstdio@<major>.<minor>.<patch>.");
  if (baseTag !== currentStableTag)
    throw new Error(`Only the current stable release ${currentStableTag} can be patched.`);
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
};

export const validatePatchSource = (input: { descendsFromBase: boolean; sourceVersion: string; baseTag: string }) => {
  if (!input.descendsFromBase) throw new Error("The fix commit must descend from the selected stable release tag.");
  if (`pstdio@${input.sourceVersion}` !== input.baseTag)
    throw new Error(
      "The fix branch must retain the stable release package version. Do not merge a version PR into it.",
    );
};

export const versionPatch = async (root: string, summary: string) => {
  if (!summary.trim() || summary.includes("\n")) throw new Error("Supply a one-line patch summary.");
  // This checkout contains only the selected fixes. Their original bump requests must
  // not pull a minor or major release into an explicitly requested patch.
  for (const name of readdirSync(join(root, ".changeset"))) {
    if (name.endsWith(".md") && name !== "README.md") rmSync(join(root, ".changeset", name));
  }
  writeFileSync(join(root, ".changeset", "patch-release.md"), `---\n"pstdio": patch\n---\n\n${summary.trim()}\n`);
  const result = Bun.spawnSync([process.execPath, changesetBin, "version"], {
    cwd: root,
    stdout: "inherit",
    stderr: "inherit",
  });
  if (result.exitCode !== 0) throw new Error(`Patch versioning failed with ${result.exitCode}.`);
  return (JSON.parse(readFileSync(join(root, "packages/pstdio/package.json"), "utf8")) as { version: string }).version;
};
