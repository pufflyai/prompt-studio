import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const freshInstallArgs = (root: string, directory: string) => {
  const configPath = join(directory, "fresh-install.bunfig.toml");
  const releaseConfig = JSON.parse(readFileSync(join(root, ".changeset/config.json"), "utf8")) as { fixed: string[][] };
  // Bun's exclusions are exact package names. The release group owns this list, including
  // packages reached transitively, so a new public package gets the same policy automatically.
  const ownPackages = releaseConfig.fixed.flat().filter((name) => name.startsWith("@pstdio/"));
  writeFileSync(configPath, `[install]\nminimumReleaseAgeExcludes = ${JSON.stringify(ownPackages)}\n`);
  return ["install", "--minimum-release-age=86400", `--config=${configPath}`];
};
