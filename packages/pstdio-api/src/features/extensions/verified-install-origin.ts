import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { canonicalExtensionId } from "pstdio-api-contracts/extension-host";
import type { PreparedExtensionRevision } from "pstdio-extensions";
import { parseRegistrySourceRef } from "pstdio-extensions/distribution";
import { parseExtensionSourceRef } from "../../services/extension-source-ref";
import { hostCheckoutPath, packagedExtensionCatalog } from "./extension-catalog";
import type { InstallExtensionSourceInput } from "./install-extension-source-types";

export const sameSourcePath = (left: string, right: string) => {
  try {
    return realpathSync(left) === realpathSync(right);
  } catch {
    return false;
  }
};

export const firstPartyCatalogEntry = (extensionId: string) => {
  const id = canonicalExtensionId(extensionId);
  if (!id.startsWith("pstdio.")) return;
  return packagedExtensionCatalog.extensions.find((entry) => entry.extensionId === id);
};

/** Recorded only for bytes the installer obtained from the selected catalog or host checkout. */
export const verifiedInstallOrigin = (
  input: InstallExtensionSourceInput,
  source: { kind: "named" | "local"; path: string; ref?: string },
  extensionId: string,
  targetPath: string,
): PreparedExtensionRevision["verifiedInstall"] => {
  const entry = firstPartyCatalogEntry(extensionId);
  if (!entry) return;
  const sourcePath = resolve(targetPath);
  if (source.kind === "local") {
    if (sameSourcePath(source.path, hostCheckoutPath(entry))) return { sourcePath, ref: null };
    return;
  }
  if (!source.ref) return;
  const registry = parseRegistrySourceRef(source.ref);
  if (registry?.id === entry.extensionId) return { sourcePath, ref: source.ref };
  const git = parseExtensionSourceRef(source.ref);
  if (git?.url !== entry.origin.url || git.path !== entry.origin.path) return;
  // Explicit arbitrary refs are valid installs, but only the catalog's release selection attests to publisher code.
  const releaseRef = entry.origin.ref === "{hostRelease}" ? input.hostReleaseRef : entry.origin.ref;
  if (releaseRef && (input.ref === undefined || input.ref === releaseRef)) return { sourcePath, ref: source.ref };
};
