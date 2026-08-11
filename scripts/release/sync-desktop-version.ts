import { readFileSync, writeFileSync } from "node:fs";

type SyncDesktopVersionInput = {
  runtimePackagePath: string;
  desktopPackagePath: string;
};

const readPackage = (path: string) => JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;

export const syncDesktopVersion = (input: SyncDesktopVersionInput) => {
  const runtimePackage = readPackage(input.runtimePackagePath);
  const desktopPackage = readPackage(input.desktopPackagePath);
  if (desktopPackage.version === runtimePackage.version) return false;
  desktopPackage.version = runtimePackage.version;
  writeFileSync(input.desktopPackagePath, `${JSON.stringify(desktopPackage, null, 2)}\n`);
  return true;
};

if (import.meta.main) {
  const changed = syncDesktopVersion({
    runtimePackagePath: "./packages/pstdio/package.json",
    desktopPackagePath: "./clients/desktop/package.json",
  });
  process.stdout.write(changed ? "Synchronized desktop version\n" : "Desktop version already synchronized\n");
}
