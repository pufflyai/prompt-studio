import { basename, dirname } from "node:path";
import { extensionIdentityRenames } from "pstdio-api-contracts/extension-host";

export const extensionIdentityBackupName = ".extension-identity-original";
const owners = new Set(extensionIdentityRenames.map(({ to }) => `${to.publisher}.${to.name}`));
/** Host-retained originals are evidence, never a second live artifact tree. */
export const isExtensionIdentityBackup = (path: string): boolean => {
  const name = (value: string) =>
    process.platform === "win32" || process.platform === "darwin" ? basename(value).toLowerCase() : basename(value);
  const parent = dirname(path);
  if (parent === path) return false;
  if (
    name(path) === extensionIdentityBackupName &&
    owners.has(name(parent)) &&
    name(dirname(parent)) === "extension-storage" &&
    name(dirname(dirname(parent))) === ".pstdio"
  )
    return true;
  return isExtensionIdentityBackup(parent);
};
