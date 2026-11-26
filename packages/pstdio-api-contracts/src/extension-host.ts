import { canonicalExtensionId } from "./extension-identity.ts";

// Private host contracts. These are not re-exported through the public SDK.
export * from "./extension-identity.ts";
export { createExtensionUpgradePool } from "./extension-upgrade-pool.ts";
export * from "./extension-webview-path.ts";

export const extensionUpgradeNeedsReviewCode = "extension_upgrade_needs_review";

export const selectExtensionUpgradeCandidates = <
  T extends { extensionId: string; canUpgrade: boolean; hasPublishedAlternative?: boolean },
>(
  extensions: T[],
) => {
  const localProviders = new Set(
    extensions
      .filter((extension) => extension.hasPublishedAlternative)
      .map(({ extensionId }) => canonicalExtensionId(extensionId)),
  );
  return extensions.filter(
    ({ extensionId, canUpgrade, hasPublishedAlternative }) =>
      hasPublishedAlternative || (canUpgrade && !localProviders.has(canonicalExtensionId(extensionId))),
  );
};
