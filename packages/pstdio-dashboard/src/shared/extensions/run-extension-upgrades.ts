import type { ProjectExtensionInstance, UpgradeProjectExtensionResponse } from "@pstdio/sdk/api";

export const runExtensionUpgrades = async (
  extensions: ProjectExtensionInstance[],
  upgrade: (extension: ProjectExtensionInstance) => Promise<UpgradeProjectExtensionResponse>,
  onSettled: (extension: ProjectExtensionInstance) => void,
) => {
  const upgraded: ProjectExtensionInstance[] = [];
  const current: ProjectExtensionInstance[] = [];
  const failed: string[] = [];
  const skipped = extensions.filter((extension) => !extension.canUpgrade && extension.upgradeBlockedReason);

  for (const extension of extensions.filter((entry) => entry.canUpgrade)) {
    try {
      const result = await upgrade(extension);
      (result.changed ? upgraded : current).push(result.extension);
    } catch (error) {
      failed.push(`${extension.displayName}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      onSettled(extension);
    }
  }

  return { upgraded, current, skipped, failed };
};
