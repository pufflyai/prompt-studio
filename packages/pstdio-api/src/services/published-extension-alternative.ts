import { canonicalExtensionId } from "pstdio-api-contracts/extension-host";
import type { ExtensionRelease } from "../app-config";
import type { ExtensionCatalog } from "../features/extensions/extension-catalog";
import type { InstallExtensionSourceInput } from "../features/extensions/install-extension-source";
import { ExtensionUpgradeUnavailableError } from "./extension-upgrade-unavailable-error";

export const createPublishedExtensionAlternative = (
  catalog: Promise<ExtensionCatalog>,
  release: ExtensionRelease | null,
) => {
  const lookup = async (id: string) =>
    (await catalog).extensions.find(
      (entry) =>
        entry.listed !== false &&
        entry.extensionId &&
        canonicalExtensionId(entry.extensionId) === canonicalExtensionId(id),
    );
  const available = async (source: { source_kind?: string; extension_id: string }) =>
    source.source_kind === "local_path" && (await lookup(source.extension_id)) !== undefined && Boolean(release);

  const input = async (id: string): Promise<InstallExtensionSourceInput> => {
    const entry = await lookup(id);
    if (!release || !entry?.extensionId)
      throw new ExtensionUpgradeUnavailableError("This local copy has no published alternative.");
    if (release.source === "registry") {
      return {
        source: entry.installName,
        registrySource: { url: release.ref.slice(4), id: entry.extensionId },
      };
    }
    return {
      source: entry.installName,
      hostReleaseRef: release.ref,
      originSource: { kind: "release", origin: entry.origin },
      ref: entry.origin.ref === "{hostRelease}" ? release.ref : entry.origin.ref,
    };
  };
  return { available, input };
};
