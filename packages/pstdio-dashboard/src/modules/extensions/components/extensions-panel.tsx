import { Flex, Spinner, Stack, Text } from "@chakra-ui/react";
import type { MarketplaceExtension, ProjectExtensionInstance } from "@pstdio/sdk/api";
import { PstdioApiError } from "@pstdio/sdk/client";
import { useToaster } from "@pstdio/ui";
import type { WorkbenchPanelRenderInput } from "@pstdio/workbench";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAgents } from "@/shared/agents/use-agents";
import { dashboardExtensionDetailPage, dashboardExtensionsPage } from "@/shared/app/resources";
import { useActionError } from "@/shared/components/use-action-error";
import type { DroppedExtensionFolder } from "@/shared/extensions/api";
import {
  useAddLocalExtensionFolder,
  useInstallMarketplaceExtension,
  useMarketplaceExtensionContributions,
  useProjectExtensionMetadata,
  useProjectExtensions,
  useSetExtensionAutomationEnabled,
  useSetProjectExtensionEnabled,
} from "@/shared/extensions/use-project-extensions";
import { AvailableExtensionDetail } from "./available-extension-detail";
import { ExtensionDetailContainer } from "./extension-detail-container";
import { ExtensionReplacementConfirmation } from "./extension-replacement-confirmation";
import { ExtensionsPanelView } from "./extensions-panel-view";
import { usePanelUpgrades } from "./use-panel-upgrades";

interface ExtensionsPanelProps {
  projectId: string | undefined;
  settingsInput: WorkbenchPanelRenderInput;
}

const selectedExtension = (id: string | undefined, kind: string) =>
  id?.startsWith(`${kind}:`) ? id.slice(kind.length + 1) : null;

export const ExtensionsPanel = (props: ExtensionsPanelProps) => {
  const toaster = useToaster();
  const { projectId, settingsInput } = props;
  const { showError, errorNotice, clearError } = useActionError();
  const { t } = useTranslation("projects");
  const extensionsQuery = useProjectExtensions(projectId);
  const metadataQuery = useProjectExtensionMetadata(projectId);
  const agentsQuery = useAgents(projectId);
  const agents = projectId && agentsQuery.isSuccess ? agentsQuery.data : undefined;
  const setEnabled = useSetProjectExtensionEnabled(projectId);
  const setAutomationEnabled = useSetExtensionAutomationEnabled(projectId);
  const installMarketplace = useInstallMarketplaceExtension(projectId);
  const addLocalFolder = useAddLocalExtensionFolder(projectId);
  const [replacement, setReplacement] = useState<{ name: string; retry: () => Promise<void> } | null>(null);
  const replacementDialog = (
    <ExtensionReplacementConfirmation replacement={replacement} onClose={() => setReplacement(null)} />
  );
  const selection = settingsInput.instance.resource?.id;
  const selectedInstanceId = selectedExtension(selection, "installed");
  const selectedMarketplaceName = selectedExtension(selection, "marketplace");
  const openList = () =>
    settingsInput.workbench.pageLocations.navigate({ kind: "page", page: dashboardExtensionsPage });
  const openDetail = (id: string, displayName: string) =>
    settingsInput.workbench.pageLocations.navigate({
      kind: "page",
      page: dashboardExtensionDetailPage,
      resource: { type: "extension", extensionId: "pstdio", id, label: displayName },
    });
  const [installingMarketplaceNames, setInstallingMarketplaceNames] = useState<string[]>([]);
  const marketplaceContributions = useMarketplaceExtensionContributions(
    projectId,
    selectedMarketplaceName ?? undefined,
  );

  const { handleUpgradeAll, handleUpgrade, upgradingInstanceIds, queuedInstanceIds } = usePanelUpgrades(
    projectId,
    extensionsQuery.data?.upgradeConcurrency,
    showError,
    clearError,
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

  const handleInstallMarketplace = async (extension: MarketplaceExtension, force = false) => {
    clearError();
    setInstallingMarketplaceNames((current) => [...new Set([...current, extension.installName])]);
    try {
      await installMarketplace.mutateAsync({ installName: extension.installName, force });
      toaster.create({
        type: "success",
        title: t("projectSettings.extensionsPanel.marketplace.installSucceeded", { name: extension.displayName }),
      });
      if (selectedMarketplaceName === extension.installName) openList();
    } catch (error) {
      if (error instanceof PstdioApiError && error.code === "extension_already_installed" && !force) {
        setReplacement({ name: extension.displayName, retry: () => handleInstallMarketplace(extension, true) });
        return;
      }
      showError({
        title: t("projectSettings.extensionsPanel.marketplace.installFailed"),
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setInstallingMarketplaceNames((current) => current.filter((name) => name !== extension.installName));
    }
  };

  if (selected) {
    return (
      <>
        {errorNotice}
        <ExtensionDetailContainer
          projectId={projectId}
          extension={selected}
          upgrading={upgradingInstanceIds.includes(selected.id)}
          onUpgrade={() => void handleUpgrade(selected, "detail")}
          metadata={metadataQuery.data}
          agents={agents}
          settingsInput={settingsInput}
          onBack={() => openList()}
        />
      </>
    );
  }

  if (selectedMarketplace) {
    return (
      <>
        {replacementDialog}
        {errorNotice}
        <AvailableExtensionDetail
          extension={selectedMarketplace}
          metadata={marketplaceContributions.data}
          contributionsError={
            marketplaceContributions.error instanceof Error ? marketplaceContributions.error.message : undefined
          }
          loadingContributions={marketplaceContributions.isLoading}
          installing={installingMarketplaceNames.includes(selectedMarketplace.installName)}
          onInstall={() => void handleInstallMarketplace(selectedMarketplace)}
        />
      </>
    );
  }

  const handleToggle = (extension: ProjectExtensionInstance, enabled: boolean) => {
    clearError();
    setEnabled.mutate(
      { instanceId: extension.id, enabled },
      {
        onError: (error) => {
          showError({
            title: t("projectSettings.extensionsPanel.toggleErrorTitle"),
            description: error instanceof Error ? error.message : t("projectSettings.extensionsPanel.toggleError"),
          });
        },
      },
    );
  };

  const handleDropFolder = async (folder: DroppedExtensionFolder) => {
    clearError();
    try {
      const { extension } = await addLocalFolder.mutateAsync(folder);
      toaster.create({
        type: "success",
        title: t("projectSettings.extensionsPanel.dropZone.succeeded", { name: extension.displayName }),
      });
    } catch (error) {
      if (error instanceof PstdioApiError && error.code === "extension_already_installed" && !folder.force) {
        setReplacement({ name: folder.name, retry: () => handleDropFolder({ ...folder, force: true }) });
        return;
      }
      showError({
        title: t("projectSettings.extensionsPanel.dropZone.failed"),
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  return (
    <>
      {replacementDialog}
      {errorNotice}
      <ExtensionsPanelView
        projectId={projectId}
        extensions={extensions}
        marketplace={marketplace}
        diagnostics={metadataQuery.data?.diagnostics ?? []}
        automations={metadataQuery.data?.automations ?? []}
        harnesses={metadataQuery.isSuccess ? metadataQuery.data?.harnesses : undefined}
        agents={agents}
        togglingInstanceId={setEnabled.isPending ? setEnabled.variables?.instanceId : undefined}
        togglingAutomation={setAutomationEnabled.isPending}
        queuedInstanceIds={queuedInstanceIds}
        upgradingInstanceIds={upgradingInstanceIds}
        installingMarketplaceNames={installingMarketplaceNames}
        onToggle={handleToggle}
        onToggleAutomation={(extension, automation, enabled) =>
          setAutomationEnabled.mutateAsync({ instanceId: extension.id, automationId: automation.id, enabled })
        }
        onUpgrade={(extension) => void handleUpgrade(extension, "list")}
        onOpen={(extension) => openDetail(`installed:${extension.id}`, extension.displayName)}
        onInstallMarketplace={(extension) => void handleInstallMarketplace(extension)}
        onOpenMarketplace={(extension) => openDetail(`marketplace:${extension.installName}`, extension.displayName)}
        upgradingAll={extensions.some(
          (extension) => extension.canUpgrade && upgradingInstanceIds.includes(extension.id),
        )}
        onUpgradeAll={(upgradable) => void handleUpgradeAll(upgradable)}
        addingFolderName={addLocalFolder.isPending ? addLocalFolder.variables?.name : undefined}
        onDropFolder={(folder) => void handleDropFolder(folder)}
      />
    </>
  );
};
