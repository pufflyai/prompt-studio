import type { MarketplaceExtension, ProjectExtensionInstance } from "@pstdio/sdk/api";
import { PstdioApiError } from "@pstdio/sdk/client";
import { createExtensionUpgradePool, extensionUpgradeNeedsReviewCode } from "pstdio-api-contracts/extension-host";
import { useTranslation } from "react-i18next";
import { dashboardCommandIds } from "@/shared/app/commands";
import type { DroppedExtensionFolder } from "@/shared/extensions/api";
import {
  useAddLocalExtensionFolder,
  useInstallMarketplaceExtension,
  useSetProjectExtensionEnabled,
  useUpgradeProjectExtension,
} from "@/shared/extensions/use-project-extensions";
import { confirmedExtensionEdits, marketplaceActionKey } from "./extension-actions";
import { useExtensionActions } from "./use-extension-actions";

const extensionSource = (id: string, label: string) => ({
  type: "extension",
  extensionId: "pstdio",
  id,
  label,
});

export const useExtensionPanelActions = (projectId: string | undefined, capacity?: number) => {
  const { t } = useTranslation("projects");
  const feedback = useExtensionActions(projectId);
  const upgrade = useUpgradeProjectExtension(projectId);
  const install = useInstallMarketplaceExtension(projectId);
  const addFolder = useAddLocalExtensionFolder(projectId);
  const toggle = useSetProjectExtensionEnabled(projectId);
  const handleUpgrade = (extension: ProjectExtensionInstance, pool?: ReturnType<typeof createExtensionUpgradePool>) =>
    feedback.run(
      extension.id,
      {
        running: t("projectSettings.extensionsPanel.feedback.upgradingButton"),
        failed: (error) =>
          error instanceof PstdioApiError && error.code === extensionUpgradeNeedsReviewCode
            ? t("projectSettings.extensionsPanel.upgrade.reviewNeeded")
            : t("projectSettings.extensionsPanel.upgrade.failed"),
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
      {
        queuedLabel: pool && t("projectSettings.extensionsPanel.feedback.queued"),
        draft: { extension: extension.displayName, installName: extension.installName },
        source: extensionSource(`installed:${extension.id}`, extension.displayName),
        sourceCommand: (error) =>
          error instanceof PstdioApiError && error.code === extensionUpgradeNeedsReviewCode
            ? {
                id: dashboardCommandIds.openExtensions,
                args: { resolveInstanceId: extension.id, projectId },
                label: confirmedExtensionEdits(error)
                  ? t("projectSettings.extensionsPanel.upgrade.resolve", "Resolve")
                  : t("projectSettings.extensionsPanel.upgrade.chooseVersion", "Choose version"),
              }
            : { id: dashboardCommandIds.openExtensions },
      },
    );
  const handleUpgradeAll = (extensions: ProjectExtensionInstance[]) => {
    const pool = createExtensionUpgradePool(capacity);
    return feedback.runBatch(extensions, (extension) => handleUpgrade(extension, pool));
  };
  const handleToggle = (extension: ProjectExtensionInstance, enabled: boolean) =>
    feedback.run(
      extension.id,
      {
        running: t("projectSettings.extensionsPanel.feedback.updating", { name: extension.displayName }),
        failed: t("projectSettings.extensionsPanel.toggleErrorTitle"),
      },
      () => toggle.mutateAsync({ instanceId: extension.id, enabled }),
      {
        operation: "toggle",
        enabled,
        draft: { extension: extension.displayName, enabled },
        source: extensionSource(`installed:${extension.id}`, extension.displayName),
      },
    );
  const handleInstall = async (extension: MarketplaceExtension, force = false) => {
    await feedback.run(
      marketplaceActionKey(extension.installName),
      {
        running: t("projectSettings.extensionsPanel.feedback.installingButton"),
        failed: t("projectSettings.extensionsPanel.marketplace.installFailed"),
      },
      async () => {
        try {
          return await install.mutateAsync({ installName: extension.installName, force });
        } catch (error) {
          if (error instanceof PstdioApiError && error.code === "extension_already_installed" && !force) {
            feedback.setReplacement({ name: extension.displayName, retry: () => handleInstall(extension, true) });
          }
          throw error;
        }
      },
      {
        installedId: (result) => result.extension.id,
        draft: { extension: extension.displayName, installName: extension.installName },
        source: extensionSource(marketplaceActionKey(extension.installName), extension.displayName),
      },
    );
  };
  const handleDrop = async (folder: DroppedExtensionFolder) => {
    await feedback.run(
      "$folder",
      {
        running: t("projectSettings.extensionsPanel.dropZone.uploading", { name: folder.name }),
        failed: t("projectSettings.extensionsPanel.dropZone.failed"),
      },
      async () => {
        try {
          return await addFolder.mutateAsync(folder);
        } catch (error) {
          if (error instanceof PstdioApiError && error.code === "extension_already_installed" && !folder.force) {
            feedback.setReplacement({ name: folder.name, retry: () => handleDrop({ ...folder, force: true }) });
          }
          throw error;
        }
      },
      { installedId: (result) => result.extension.id, draft: { folder: folder.name, force: folder.force === true } },
    );
  };
  return {
    ...feedback,
    handleUpgrade,
    handleUpgradeAll,
    handleToggle,
    handleInstall,
    handleDrop,
  };
};
