import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  canonicalExtensionId,
  extensionIdentityRenames,
  historicalExtensionId,
} from "pstdio-api-contracts/extension-identity";
import { readPackageManifestMetadata } from "pstdio-extensions";

/** Preserve an existing installation's origin path while its visible owner changes. */
export const installedIdentityPath = (root: string, directory: string, extensionId?: string) => {
  const target = join(root, directory);
  if (!extensionId) return target;
  const canonical = canonicalExtensionId(extensionId);
  const previous = historicalExtensionId(canonical);
  if (canonical === previous) return target;
  const rename = extensionIdentityRenames.find(({ to }) => `${to.publisher}.${to.name}` === canonical)!;
  const directories = new Set([directory, previous, canonical, rename.from.name, rename.to.name]);
  const matching = [...directories]
    .map((name) => join(root, name))
    .filter((path) => {
      if (!existsSync(join(path, "package.json"))) return false;
      const { manifest } = readPackageManifestMetadata(path);
      return manifest && canonicalExtensionId(manifest.id) === canonical;
    });
  if (matching.length > 1)
    throw new Error(`Conflicting installed extension directories for ${canonical}: ${matching.join(", ")}`);
  return matching[0] ?? target;
};
