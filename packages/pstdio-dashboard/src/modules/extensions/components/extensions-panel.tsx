import { Flex, Spinner, Stack, Text } from "@chakra-ui/react";
import type { WorkbenchPanelRenderInput } from "@pstdio/workbench";
import { useTranslation } from "react-i18next";
import { useAgents } from "@/shared/agents/use-agents";
import { dashboardExtensionDetailPage, dashboardExtensionsPage } from "@/shared/app/resources";
import {
  useMarketplaceExtensionContributions,
  useProjectExtensionMetadata,
  useProjectExtensions,
  useSetExtensionAutomationEnabled,
} from "@/shared/extensions/use-project-extensions";
import { AvailableExtensionDetail } from "./available-extension-detail";
import { ExtensionActionFeedback } from "./extension-action-feedback";
import { ExtensionDetailContainer } from "./extension-detail-container";
import { ExtensionReplacementConfirmation } from "./extension-replacement-confirmation";
import { ExtensionsPanelView } from "./extensions-panel-view";
import { useExtensionPanelActions } from "./use-extension-panel-actions";

interface ExtensionsPanelProps {
  projectId: string | undefined;
  settingsInput: WorkbenchPanelRenderInput;
}

const selectedExtension = (id: string | undefined, kind: string) =>
  id?.startsWith(`${kind}:`) ? id.slice(kind.length + 1) : null;

export const ExtensionsPanel = (props: ExtensionsPanelProps) => {
  const { projectId, settingsInput } = props;
  const { t } = useTranslation("projects");
  const extensionsQuery = useProjectExtensions(projectId);
  const metadataQuery = useProjectExtensionMetadata(projectId);
  const agentsQuery = useAgents(projectId);
  const agents = projectId && agentsQuery.isSuccess ? agentsQuery.data : undefined;
  const setAutomationEnabled = useSetExtensionAutomationEnabled(projectId);
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
  const actions = useExtensionPanelActions(projectId, (name) => {
    if (selectedMarketplaceName === name) openList();
  });
  const upgradingInstanceIds = Object.keys(actions.actions).filter((id) =>
    ["queued", "running"].includes(actions.actions[id]!.status),
  );
  const replacementDialog = (
    <ExtensionReplacementConfirmation replacement={actions.replacement} onClose={() => actions.setReplacement(null)} />
  );
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

  if (selected) {
    return (
      <ExtensionDetailContainer
        projectId={projectId}
        extension={selected}
        metadata={metadataQuery.data}
        agents={agents}
        settingsInput={settingsInput}
        onBack={() => openList()}
        upgradeAction={actions.actions[selected.id]}
        onUpgrade={() => void actions.handleUpgrade(selected)}
        onDismissUpgrade={(expected) => actions.dismiss(selected.id, expected)}
        onRetryAction={() => actions.retry(selected.id)}
      />
    );
  }

  if (selectedMarketplace) {
    return (
      <>
        {replacementDialog}
        <AvailableExtensionDetail
          extension={selectedMarketplace}
          metadata={marketplaceContributions.data}
          contributionsError={
            marketplaceContributions.error instanceof Error ? marketplaceContributions.error.message : undefined
          }
          loadingContributions={marketplaceContributions.isLoading}
          installing={actions.actions[selectedMarketplace.installName]?.status === "running"}
          feedback={
            <ExtensionActionFeedback
              action={actions.actions[selectedMarketplace.installName]}
              onDismiss={() => actions.dismiss(selectedMarketplace.installName)}
              onRetry={() => void actions.handleInstall(selectedMarketplace)}
            />
          }
          onBack={() => openList()}
          onInstall={() => void actions.handleInstall(selectedMarketplace)}
        />
      </>
    );
  }

  return (
    <>
      {replacementDialog}
      <ExtensionsPanelView
        extensions={extensions}
        marketplace={marketplace}
        diagnostics={metadataQuery.data?.diagnostics ?? []}
        automations={metadataQuery.data?.automations ?? []}
        harnesses={metadataQuery.isSuccess ? metadataQuery.data?.harnesses : undefined}
        agents={agents}
        actionStates={actions.actions}
        onDismissAction={actions.dismiss}
        onDismissBatch={actions.dismissBatch}
        onRetryAction={actions.retry}
        batch={actions.batch}
        togglingAutomation={setAutomationEnabled.isPending}
        upgradingInstanceIds={upgradingInstanceIds}
        installingMarketplaceNames={marketplace
          .filter((entry) => actions.actions[entry.installName]?.status === "running")
          .map((entry) => entry.installName)}
        onToggle={(extension, enabled) => void actions.handleToggle(extension, enabled)}
        onToggleAutomation={(extension, automation, enabled) =>
          setAutomationEnabled.mutateAsync({ instanceId: extension.id, automationId: automation.id, enabled })
        }
        onUpgrade={(extension) => void actions.handleUpgrade(extension)}
        onOpen={(extension) => openDetail(`installed:${extension.id}`, extension.displayName)}
        onInstallMarketplace={(extension) => void actions.handleInstall(extension)}
        onOpenMarketplace={(extension) => openDetail(`marketplace:${extension.installName}`, extension.displayName)}
        upgradingAll={(actions.batch?.ids ?? []).some((id) =>
          ["queued", "running"].includes(actions.actions[id]?.status ?? ""),
        )}
        onUpgradeAll={(upgradable) => void actions.handleUpgradeAll(upgradable)}
        addingFolderName={actions.addingFolderName}
        onDropFolder={(folder) => void actions.handleDrop(folder)}
      />
    </>
  );
};
