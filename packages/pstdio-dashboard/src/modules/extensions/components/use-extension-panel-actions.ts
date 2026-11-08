import type { MarketplaceExtension, ProjectExtensionInstance } from "@pstdio/sdk/api";
import { PstdioApiError } from "@pstdio/sdk/client";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { DroppedExtensionFolder } from "@/shared/extensions/api";
import {
  useAddLocalExtensionFolder,
  useInstallMarketplaceExtension,
  useSetProjectExtensionEnabled,
  useUpgradeProjectExtension,
} from "@/shared/extensions/use-project-extensions";
import { useExtensionActions } from "./use-extension-actions";

export const useExtensionPanelActions = (projectId: string | undefined, onInstalled: (name: string) => void) => {
  const { t } = useTranslation("projects");
  const feedback = useExtensionActions(projectId);
  const upgrade = useUpgradeProjectExtension(projectId);
  const install = useInstallMarketplaceExtension(projectId);
  const addFolder = useAddLocalExtensionFolder(projectId);
  const toggle = useSetProjectExtensionEnabled(projectId);
  const [replacement, setReplacement] = useState<{ name: string; retry: () => Promise<void> } | null>(null);
  const handleUpgrade = (extension: ProjectExtensionInstance) =>
    feedback.run(
      extension.id,
      {
        running: t("projectSettings.extensionsPanel.feedback.upgradingButton"),
        success: t("projectSettings.extensionsPanel.upgrade.succeeded"),
        failed: t("projectSettings.extensionsPanel.upgrade.failed"),
      },
      () => upgrade.mutateAsync({ instanceId: extension.id }),
    );
  const handleUpgradeAll = (extensions: ProjectExtensionInstance[]) =>
    feedback.runBatch(extensions, t("projectSettings.extensionsPanel.feedback.queued"), handleUpgrade);
  const handleToggle = (extension: ProjectExtensionInstance, enabled: boolean) =>
    feedback.run(
      extension.id,
      {
        running: t("projectSettings.extensionsPanel.feedback.updating", { name: extension.displayName }),
        success: t("projectSettings.extensionsPanel.feedback.updated"),
        failed: t("projectSettings.extensionsPanel.toggleErrorTitle"),
      },
      () => toggle.mutateAsync({ instanceId: extension.id, enabled }),
    );
  const handleInstall = async (extension: MarketplaceExtension, force = false) => {
    await feedback.run(
      extension.installName,
      {
        running: t("projectSettings.extensionsPanel.feedback.installing", { name: extension.displayName }),
        success: t("projectSettings.extensionsPanel.marketplace.installSucceeded", { name: extension.displayName }),
        failed: t("projectSettings.extensionsPanel.marketplace.installFailed"),
      },
      async () => {
        try {
          await install.mutateAsync({ installName: extension.installName, force });
          onInstalled(extension.installName);
        } catch (error) {
          if (error instanceof PstdioApiError && error.code === "extension_already_installed" && !force) {
            setReplacement({ name: extension.displayName, retry: () => handleInstall(extension, true) });
          }
          throw error;
        }
      },
    );
  };
  const handleDrop = async (folder: DroppedExtensionFolder) => {
    await feedback.run(
      "$folder",
      {
        running: t("projectSettings.extensionsPanel.dropZone.uploading", { name: folder.name }),
        success: t("projectSettings.extensionsPanel.dropZone.succeeded", { name: folder.name }),
        failed: t("projectSettings.extensionsPanel.dropZone.failed"),
      },
      async () => {
        try {
          await addFolder.mutateAsync(folder);
        } catch (error) {
          if (error instanceof PstdioApiError && error.code === "extension_already_installed" && !folder.force) {
            setReplacement({ name: folder.name, retry: () => handleDrop({ ...folder, force: true }) });
          }
          throw error;
        }
      },
    );
  };
  return {
    ...feedback,
    handleUpgrade,
    handleUpgradeAll,
    handleToggle,
    handleInstall,
    handleDrop,
    replacement,
    setReplacement,
    addingFolderName: addFolder.isPending ? addFolder.variables?.name : undefined,
  };
};
