import type { MarketplaceExtension, ProjectExtensionInstance } from "@pstdio/sdk/api";
import { PstdioApiError } from "@pstdio/sdk/client";
import { createExtensionUpgradePool } from "pstdio-api-contracts/extension-host";
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

export const useExtensionPanelActions = (projectId: string | undefined, capacity?: number) => {
  const { t } = useTranslation("projects");
  const feedback = useExtensionActions(projectId);
  const upgrade = useUpgradeProjectExtension(projectId);
  const install = useInstallMarketplaceExtension(projectId);
  const addFolder = useAddLocalExtensionFolder(projectId);
  const toggle = useSetProjectExtensionEnabled(projectId);
  const [replacement, setReplacement] = useState<{ name: string; retry: () => Promise<void> } | null>(null);
  const handleUpgrade = (extension: ProjectExtensionInstance, pool?: ReturnType<typeof createExtensionUpgradePool>) =>
    feedback.run(
      extension.installName,
      {
        running: t("projectSettings.extensionsPanel.feedback.upgradingButton"),
        success: t("projectSettings.extensionsPanel.upgrade.succeeded"),
        failed: t("projectSettings.extensionsPanel.upgrade.failed"),
      },
      (started) =>
        upgrade.mutateAsync({
          instanceId: extension.id,
          schedule:
            pool &&
            ((send) =>
              pool(() => {
                started();
                return send();
              })),
        }),
      pool && t("projectSettings.extensionsPanel.feedback.queued"),
    );
  const handleUpgradeAll = (extensions: ProjectExtensionInstance[]) => {
    const pool = createExtensionUpgradePool(capacity);
    return feedback.runBatch(
      extensions.map((extension) => ({ id: extension.installName, extension })),
      ({ extension }) => handleUpgrade(extension, pool),
    );
  };
  const handleToggle = (extension: ProjectExtensionInstance, enabled: boolean) =>
    feedback.run(
      extension.installName,
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
        running: t("projectSettings.extensionsPanel.feedback.installingButton"),
        success: t("projectSettings.extensionsPanel.feedback.installedButton"),
        failed: t("projectSettings.extensionsPanel.marketplace.installFailed"),
      },
      async () => {
        try {
          await install.mutateAsync({ installName: extension.installName, force });
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
