import { Flex, Spinner, Stack, Text } from "@chakra-ui/react";
import type { MarketplaceExtension, ProjectExtensionInstance } from "@pstdio/sdk/api";
import { toaster } from "@pstdio/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useInstallMarketplaceExtension,
  useMarketplaceExtensionContributions,
  useProjectExtensionMetadata,
  useProjectExtensionSync,
  useProjectExtensions,
  useReloadProjectExtension,
  useSetProjectExtensionEnabled,
  useUpgradeProjectExtension,
  useUpgradeProjectExtensions,
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
  const reload = useReloadProjectExtension(projectId);
  const upgrade = useUpgradeProjectExtension(projectId);
  const installMarketplace = useInstallMarketplaceExtension(projectId);
  const upgradeAll = useUpgradeProjectExtensions(projectId);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [selectedMarketplaceName, setSelectedMarketplaceName] = useState<string | null>(null);
  const [installingMarketplaceNames, setInstallingMarketplaceNames] = useState<string[]>([]);
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

  const handleUpgradeAll = (upgradable: ProjectExtensionInstance[]) => {
    upgradeAll.mutate(
      { extensions: upgradable },
      {
        onSuccess: ({ upgraded, failed }) => {
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
        },
      },
    );
  };

  const healthActions = (extension: ProjectExtensionInstance) => ({
    retrying: reload.isPending && reload.variables?.instanceId === extension.id,
    upgrading: upgrade.isPending && upgrade.variables?.instanceId === extension.id,
    onRetry: () => reload.mutate({ instanceId: extension.id }),
    // A successful upgrade shows in the row itself; only a failure needs a message.
    onUpgrade: () =>
      upgrade.mutate(
        { instanceId: extension.id },
        {
          onError: (error) => {
            toaster.create({
              type: "error",
              title: t("projectSettings.extensionsPanel.upgrade.failed"),
              description: error instanceof Error ? error.message : undefined,
            });
          },
        },
      ),
  });

  return (
    <ExtensionsPanelView
      extensions={extensions}
      marketplace={marketplace}
      diagnostics={metadataQuery.data?.diagnostics ?? []}
      automations={metadataQuery.data?.automations ?? []}
      togglingInstanceId={setEnabled.isPending ? (setEnabled.variables?.instanceId ?? undefined) : undefined}
      installingMarketplaceNames={installingMarketplaceNames}
      onToggle={handleToggle}
      onOpen={(extension) => setSelectedInstanceId(extension.id)}
      onInstallMarketplace={(extension) => void handleInstallMarketplace(extension)}
      onOpenMarketplace={(extension) => setSelectedMarketplaceName(extension.installName)}
      healthActions={healthActions}
      upgradingAll={upgradeAll.isPending}
      onUpgradeAll={handleUpgradeAll}
    />
  );
};
