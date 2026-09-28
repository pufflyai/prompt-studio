import { Flex, Spinner, Stack, Text } from "@chakra-ui/react";
import type { MarketplaceExtension, ProjectExtensionInstance } from "@pstdio/sdk/api";
import { toaster } from "@pstdio/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { DroppedExtensionFolder } from "@/shared/extensions/api";
import {
  useAddLocalExtensionFolder,
  useInstallMarketplaceExtension,
  useMarketplaceExtensionContributions,
  useProjectExtensionMetadata,
  useProjectExtensionSync,
  useProjectExtensions,
  useSetProjectExtensionEnabled,
  useUpgradeProjectExtension,
} from "@/shared/extensions/use-project-extensions";
import { AvailableExtensionDetail } from "./available-extension-detail";
import { ExtensionDetailContainer } from "./extension-detail-container";
import { ExtensionsPanelView } from "./extensions-panel-view";

interface ExtensionsPanelProps {
  projectId: string | undefined;
}

export const ExtensionsPanel = (props: ExtensionsPanelProps) => {
  const { projectId } = props;
  const { t } = useTranslation("projects");
  useProjectExtensionSync(projectId);
  const extensionsQuery = useProjectExtensions(projectId);
  const metadataQuery = useProjectExtensionMetadata(projectId);
  const setEnabled = useSetProjectExtensionEnabled(projectId);
  const upgrade = useUpgradeProjectExtension(projectId);
  const installMarketplace = useInstallMarketplaceExtension(projectId);
  const addLocalFolder = useAddLocalExtensionFolder(projectId);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [selectedMarketplaceName, setSelectedMarketplaceName] = useState<string | null>(null);
  const [installingMarketplaceNames, setInstallingMarketplaceNames] = useState<string[]>([]);
  const [upgradingInstanceIds, setUpgradingInstanceIds] = useState<string[]>([]);
  const marketplaceContributions = useMarketplaceExtensionContributions(
    projectId,
    selectedMarketplaceName ?? undefined,
  );

  if (extensionsQuery.isLoading) {
    return (
      <Flex flex="1" justifyContent="center" alignItems="center" padding="lg">
        <Spinner />
      </Flex>
    );
  }

  if (extensionsQuery.error) {
    return (
      <Stack padding="lg" gap="lg">
        <Text textStyle="paragraph/S/regular" color="fg.muted">
          {extensionsQuery.error instanceof Error
            ? extensionsQuery.error.message
            : t("projectSettings.extensionsPanel.loadError")}
        </Text>
      </Stack>
    );
  }

  const extensions = extensionsQuery.data?.extensions ?? [];
  const marketplace = extensionsQuery.data?.marketplace ?? [];
  const selected = extensions.find((extension) => extension.id === selectedInstanceId);
  const selectedMarketplace = marketplace.find(
    (extension) => extension.installName === selectedMarketplaceName && !extension.installed,
  );

  const handleInstallMarketplace = async (extension: MarketplaceExtension) => {
    setInstallingMarketplaceNames((current) => [...new Set([...current, extension.installName])]);
    try {
      await installMarketplace.mutateAsync({ installName: extension.installName });
      toaster.create({
        type: "success",
        title: t("projectSettings.extensionsPanel.marketplace.installSucceeded", { name: extension.displayName }),
      });
      if (selectedMarketplaceName === extension.installName) setSelectedMarketplaceName(null);
    } catch (error) {
      toaster.create({
        type: "error",
        title: t("projectSettings.extensionsPanel.marketplace.installFailed"),
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setInstallingMarketplaceNames((current) => current.filter((name) => name !== extension.installName));
    }
  };

  if (selected) {
    return (
      <ExtensionDetailContainer
        projectId={projectId}
        extension={selected}
        metadata={metadataQuery.data}
        onBack={() => setSelectedInstanceId(null)}
      />
    );
  }

  if (selectedMarketplace) {
    return (
      <AvailableExtensionDetail
        extension={selectedMarketplace}
        metadata={marketplaceContributions.data}
        contributionsError={
          marketplaceContributions.error instanceof Error ? marketplaceContributions.error.message : undefined
        }
        loadingContributions={marketplaceContributions.isLoading}
        installing={installingMarketplaceNames.includes(selectedMarketplace.installName)}
        onBack={() => setSelectedMarketplaceName(null)}
        onInstall={() => void handleInstallMarketplace(selectedMarketplace)}
      />
    );
  }

  const handleToggle = (extension: ProjectExtensionInstance, enabled: boolean) => {
    setEnabled.mutate(
      { instanceId: extension.id, enabled },
      {
        onError: (error) => {
          toaster.create({
            type: "error",
            title: t("projectSettings.extensionsPanel.toggleErrorTitle"),
            description: error instanceof Error ? error.message : t("projectSettings.extensionsPanel.toggleError"),
          });
        },
      },
    );
  };

  // Every target is marked up front so each row shows it is queued. The upgrades then run one at a
  // time: each fetches and installs a release, and one failure must not stop the rest.
  const handleUpgradeAll = async (upgradable: ProjectExtensionInstance[]) => {
    setUpgradingInstanceIds((current) => [...new Set([...current, ...upgradable.map((extension) => extension.id)])]);
    let upgraded = 0;
    const failed: string[] = [];
    for (const extension of upgradable) {
      try {
        await upgrade.mutateAsync({ instanceId: extension.id });
        upgraded += 1;
      } catch (error) {
        failed.push(`${extension.displayName}: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        setUpgradingInstanceIds((current) => current.filter((id) => id !== extension.id));
      }
    }
    if (upgraded > 0) {
      toaster.create({
        type: "success",
        title: t("projectSettings.extensionsPanel.upgradeAll.succeeded", { count: upgraded }),
      });
    }
    if (failed.length > 0) {
      toaster.create({
        type: "error",
        title: t("projectSettings.extensionsPanel.upgradeAll.failed", { count: failed.length }),
        description: failed.join("\n"),
      });
    }
  };

  // Each row upgrades on its own, so several upgrades can run at once and each reports its own result.
  const handleUpgrade = async (extension: ProjectExtensionInstance) => {
    setUpgradingInstanceIds((current) => [...new Set([...current, extension.id])]);
    try {
      const result = await upgrade.mutateAsync({ instanceId: extension.id });
      toaster.create({
        type: "success",
        title: t(
          result.changed
            ? "projectSettings.extensionsPanel.upgrade.succeeded"
            : "projectSettings.extensionsPanel.upgrade.current",
        ),
      });
    } catch (error) {
      toaster.create({
        type: "error",
        title: t("projectSettings.extensionsPanel.upgrade.failed"),
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setUpgradingInstanceIds((current) => current.filter((id) => id !== extension.id));
    }
  };

  const handleDropFolder = async (folder: DroppedExtensionFolder) => {
    try {
      const { extension } = await addLocalFolder.mutateAsync(folder);
      toaster.create({
        type: "success",
        title: t("projectSettings.extensionsPanel.dropZone.succeeded", { name: extension.displayName }),
      });
    } catch (error) {
      toaster.create({
        type: "error",
        title: t("projectSettings.extensionsPanel.dropZone.failed"),
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  return (
    <ExtensionsPanelView
      extensions={extensions}
      marketplace={marketplace}
      diagnostics={metadataQuery.data?.diagnostics ?? []}
      automations={metadataQuery.data?.automations ?? []}
      togglingInstanceId={setEnabled.isPending ? (setEnabled.variables?.instanceId ?? undefined) : undefined}
      upgradingInstanceIds={upgradingInstanceIds}
      installingMarketplaceNames={installingMarketplaceNames}
      onToggle={handleToggle}
      onUpgrade={(extension) => void handleUpgrade(extension)}
      onOpen={(extension) => setSelectedInstanceId(extension.id)}
      onInstallMarketplace={(extension) => void handleInstallMarketplace(extension)}
      onOpenMarketplace={(extension) => setSelectedMarketplaceName(extension.installName)}
      upgradingAll={extensions.some((extension) => extension.canUpgrade && upgradingInstanceIds.includes(extension.id))}
      onUpgradeAll={(upgradable) => void handleUpgradeAll(upgradable)}
      addingFolderName={addLocalFolder.isPending ? addLocalFolder.variables?.name : undefined}
      onDropFolder={(folder) => void handleDropFolder(folder)}
    />
  );
};
