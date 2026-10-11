import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Changesets versions packages only when changesets are pending. Right after a stable
// release, or after refactors, none are, so this uncommitted patch changeset makes sure
// every nightly gets a version. The highest pending bump still wins in the fixed group.
const NIGHTLY_CHANGESET = `---
"pstdio": patch
---

Nightly build of main.
`;

const changesetBin = Bun.resolveSync("@changesets/cli/bin.js", import.meta.dir);

// Versions the workspace at `root` as `<next version>-nightly.<datetime>`. The snapshot
// settings live in `.changeset/config.json`.
export const versionNightly = async (root: string) => {
  writeFileSync(join(root, ".changeset", "nightly-build.md"), NIGHTLY_CHANGESET);
  const result = Bun.spawnSync([process.execPath, changesetBin, "version", "--snapshot", "nightly"], {
    cwd: root,
    stdout: "inherit",
    stderr: "inherit",
  });
  if (result.exitCode !== 0) throw new Error(`changeset version --snapshot failed with ${result.exitCode}`);
  const { version } = JSON.parse(readFileSync(join(root, "packages", "pstdio", "package.json"), "utf8")) as {
    version: string;
  };
  return version;
};

if (import.meta.main) {
  process.stdout.write(`${await versionNightly(process.cwd())}\n`);
}
