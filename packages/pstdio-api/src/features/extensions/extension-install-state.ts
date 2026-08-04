import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const INSTALL_MARKER = ".pstdio-installing";

const markerPath = (sourcePath: string) => join(sourcePath, INSTALL_MARKER);

export const markExtensionInstallInProgress = (sourcePath: string) => {
  mkdirSync(sourcePath, { recursive: true });
  writeFileSync(markerPath(sourcePath), "");
};

export const clearExtensionInstallInProgress = (sourcePath: string) => {
  rmSync(markerPath(sourcePath), { force: true });
};

export const isExtensionInstallInProgress = (sourcePath: string) => existsSync(markerPath(sourcePath));
