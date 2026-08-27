import { existsSync, readFileSync, writeFileSync } from "node:fs";

type SyncDesktopVersionInput = {
  runtimePackagePath: string;
  desktopPackagePath: string;
  desktopChangelogPath: string;
};

type PackageJson = Record<string, unknown> & { version: string };

const readPackage = (path: string) => JSON.parse(readFileSync(path, "utf8")) as PackageJson;

const syncDesktopChangelog = (path: string, version: string) => {
  const heading = `## ${version}`;
  const currentChangelog = existsSync(path) ? readFileSync(path, "utf8") : "";
  if (currentChangelog.split("\n").includes(heading)) return false;

  const title = "# @pstdio/desktop";
  const previousEntries = currentChangelog.startsWith(title)
    ? currentChangelog.slice(title.length).trim()
    : currentChangelog.trim();
  const entry = `${heading}\n\n### Patch Changes\n\n- Synchronize the desktop application with \`pstdio@${version}\`.`;
  writeFileSync(path, `${[title, entry, previousEntries].filter(Boolean).join("\n\n")}\n`);
  return true;
};

export const syncDesktopVersion = (input: SyncDesktopVersionInput) => {
  const runtimePackage = readPackage(input.runtimePackagePath);
  const desktopPackage = readPackage(input.desktopPackagePath);
  const packageChanged = desktopPackage.version !== runtimePackage.version;
  if (packageChanged) {
    desktopPackage.version = runtimePackage.version;
    writeFileSync(input.desktopPackagePath, `${JSON.stringify(desktopPackage, null, 2)}\n`);
  }
  const changelogChanged = syncDesktopChangelog(input.desktopChangelogPath, runtimePackage.version);
  return packageChanged || changelogChanged;
};

if (import.meta.main) {
  const changed = syncDesktopVersion({
    runtimePackagePath: "./packages/pstdio/package.json",
    desktopPackagePath: "./clients/desktop/package.json",
    desktopChangelogPath: "./clients/desktop/CHANGELOG.md",
  });
  process.stdout.write(changed ? "Synchronized desktop version\n" : "Desktop version already synchronized\n");
}
