import { existsSync, realpathSync, statSync } from "node:fs";
import { basename, isAbsolute, join, relative, resolve } from "node:path";

export const isLocalExtensionSource = (source: string) =>
  source.startsWith("./") ||
  source.startsWith(".\\") ||
  source.startsWith("../") ||
  source.startsWith("..\\") ||
  source.startsWith("~/") ||
  source.startsWith("~\\") ||
  isAbsolute(source);

export const validateInstallName = (installName: string) => {
  if (
    !installName.trim() ||
    installName === "." ||
    installName === ".." ||
    /[\\/:]/.test(installName) ||
    basename(installName) !== installName
  ) {
    throw new Error(`Invalid extension install name: ${installName}`);
  }
};

// A repo-scoped source can already occupy its canonical install directory. Nothing has to move,
// so that directory is validated where the developer keeps it instead of being staged and swapped.
export const isSameDirectory = (left: string, right: string) => realpathSync(left) === realpathSync(right);

export const assertCanCopy = (sourcePath: string, targetPath: string) => {
  const source = resolve(sourcePath);
  const target = resolve(targetPath);
  const sourceToTarget = relative(source, target);
  const targetToSource = relative(target, source);
  const nested = (value: string) => value === "" || (!value.startsWith("..") && !isAbsolute(value));

  if (nested(sourceToTarget) || nested(targetToSource)) {
    throw new Error("Refusing to copy an extension into itself");
  }
};

export const failIfInvalidSource = (sourcePath: string) => {
  if (!existsSync(sourcePath) || !statSync(sourcePath).isDirectory()) {
    throw new Error(`Extension source folder not found: ${sourcePath}`);
  }
  if (!existsSync(join(sourcePath, "package.json"))) {
    throw new Error(`Extension source is missing package.json: ${sourcePath}`);
  }
};
