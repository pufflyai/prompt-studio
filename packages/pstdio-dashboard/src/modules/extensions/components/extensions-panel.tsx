import { Stack, Text } from "@chakra-ui/react";
import { LoadingState } from "@pstdio/ui";
import type { WorkbenchPanelRenderInput } from "@pstdio/workbench";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAgents } from "@/shared/agents/use-agents";
import { dashboardExtensionDetailPage, dashboardExtensionsPage } from "@/shared/app/resources";
import { useProjectedAutomationPreferences } from "@/shared/extensions/automation-preferences";
import { usePendingExtensionSourceChanges } from "@/shared/extensions/use-extension-mutation";
import {
  useMarketplaceExtensionContributions,
  useProjectExtensionMetadata,
  useProjectExtensions,
  useSetExtensionAutomationEnabled,
} from "@/shared/extensions/use-project-extensions";
import { AvailableExtensionDetail } from "./available-extension-detail";
import { marketplaceActionKey } from "./extension-actions";
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
  const hasPendingSourceChange = usePendingExtensionSourceChanges(projectId);
  const sourceChangingIds = new Set(
    extensionsQuery.data?.extensions.filter(({ id }) => hasPendingSourceChange(id)).map(({ id }) => id),
  );
  const metadataQuery = useProjectExtensionMetadata(projectId);
  const agentsQuery = useAgents(projectId);
  const agents = projectId && agentsQuery.isSuccess ? agentsQuery.data : undefined;
  const setAutomationEnabled = useSetExtensionAutomationEnabled(projectId);
  const automationPreferences = useProjectedAutomationPreferences(projectId, metadataQuery.data?.automations);
  const actions = useExtensionPanelActions(projectId, extensionsQuery.data?.upgradeConcurrency);
  const { filters, setFilters } = actions;
  const returnFocus = useRef<{ id: string; left: boolean } | undefined>(undefined);
  const focusTargets = useRef(new Map<string, HTMLElement>());
  // React Activity disconnects effects while a cached page is hidden. Its cleanup
  // records the departure even though an effect cannot observe visible=false.
  useEffect(
    () => () => {
      if (returnFocus.current) returnFocus.current.left = true;
    },
    [],
  );
  const selection = settingsInput.instance.resource?.id;
  const selectedInstanceId = selectedExtension(selection, "installed");
  const selectedMarketplaceName = selectedExtension(selection, "marketplace");
  const openList = () => {
    settingsInput.workbench.pageLocations.navigate({ kind: "page", page: dashboardExtensionsPage });
  };
  const openDetail = (id: string, displayName: string) => {
    returnFocus.current = { id, left: false };
    settingsInput.workbench.pageLocations.navigate({
      kind: "page",
      page: dashboardExtensionDetailPage,
      resource: { type: "extension", extensionId: "pstdio", id, label: displayName },
    });
  };
  useEffect(() => {
    // Workbench can retain separate list/detail panels. The list owns its return target
    // until it has actually left the screen; a render on the way out must not consume it.
    if (selection) {
      returnFocus.current ??= { id: selection, left: true };
      returnFocus.current.left = true;
      return;
    }
    const requested = returnFocus.current;
    if (settingsInput.visible === false) {
      if (requested) requested.left = true;
      return;
    }
    if (!requested?.left || !extensionsQuery.data) return;
    const catalogName = selectedExtension(requested.id, "marketplace");
    const installedId =
      catalogName &&
      (actions.installedIds[marketplaceActionKey(catalogName)] ??
        extensionsQuery.data.extensions.find((extension) => extension.installName === catalogName)?.id);
    const target =
      focusTargets.current.get(installedId ? `installed:${installedId}` : requested.id) ??
      document.getElementById(`extension-search-${settingsInput.instance.instanceId}`);
    if (!target?.getClientRects().length) return;
    target.focus();
    if (target.ownerDocument.activeElement === target) returnFocus.current = undefined;
  }, [selection, settingsInput.visible, actions.installedIds, extensionsQuery.data, settingsInput.instance.instanceId]);
  const registerFocusTarget = (id: string, node: HTMLElement | null) => {
    if (node) focusTargets.current.set(id, node);
    else focusTargets.current.delete(id);
  };
  const replacementDialog = settingsInput.visible !== false && (
    <ExtensionReplacementConfirmation replacement={actions.replacement} onClose={() => actions.setReplacement(null)} />
  );
  const marketplaceContributions = useMarketplaceExtensionContributions(
    projectId,
    selectedMarketplaceName ?? undefined,
  );

  if (extensionsQuery.isLoading) {
    return <LoadingState />;
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
  const catalogKey = selectedMarketplaceName ? marketplaceActionKey(selectedMarketplaceName) : undefined;
  const detailId = selectedInstanceId ?? (catalogKey && actions.installedIds[catalogKey]);
  const selected = extensions.find((extension) => extension.id === detailId);
  const selectedMarketplace = marketplace.find(
    (extension) => extension.installName === selectedMarketplaceName && !extension.installed,
  );

  if (selected) {
    const action = actions.actions[selected.id];
    return (
      <>
        {replacementDialog}
        <ExtensionDetailContainer
          projectId={projectId}
          onBack={openList}
          extension={selected}
          metadata={metadataQuery.data}
          agents={agents}
          settingsInput={settingsInput}
          action={action}
          sourceChanging={sourceChangingIds.has(selected.id)}
          onUpgrade={() => void actions.handleUpgrade(selected)}
          onToggle={(enabled) => void actions.handleToggle(selected, enabled)}
          onDismissAction={(expected) => actions.dismiss(selected.id, expected)}
          onRetryAction={() => actions.retry(selected.id)}
        />
      </>
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
          action={actions.actions[marketplaceActionKey(selectedMarketplace.installName)]}
          onDismissAction={(expected) =>
            actions.dismiss(marketplaceActionKey(selectedMarketplace.installName), expected)
          }
          onRetryAction={() => actions.retry(marketplaceActionKey(selectedMarketplace.installName))}
          onInstall={() => void actions.handleInstall(selectedMarketplace)}
        />
      </>
    );
  }

  return (
    <>
      {replacementDialog}
      <ExtensionsPanelView
        projectId={projectId}
        header={null}
        filters={filters}
        onFiltersChange={setFilters}
        rowRef={registerFocusTarget}
        searchRef={(node) => registerFocusTarget("search", node)}
        extensions={extensions}
        marketplace={marketplace}
        diagnostics={metadataQuery.data?.diagnostics ?? []}
        automations={automationPreferences.rows}
        harnesses={metadataQuery.isSuccess ? metadataQuery.data?.harnesses : undefined}
        agents={agents}
        actionStates={actions.actions}
        sourceChangingIds={sourceChangingIds}
        onDismissAction={actions.dismiss}
        onDismissBatch={actions.dismissBatch}
        onRetryAction={actions.retry}
        batch={actions.batch}
        togglingAutomation={automationPreferences.instances}
        onToggle={(extension, enabled) => void actions.handleToggle(extension, enabled)}
        onToggleAutomation={(extension, automation, enabled) =>
          setAutomationEnabled.mutateAsync({ instanceId: extension.id, automationId: automation.id, enabled })
        }
        onUpgrade={(extension) => void actions.handleUpgrade(extension)}
        onOpen={(extension) => openDetail(`installed:${extension.id}`, extension.displayName)}
        onInstallMarketplace={(extension) => void actions.handleInstall(extension)}
        onOpenMarketplace={(extension) => openDetail(`marketplace:${extension.installName}`, extension.displayName)}
        onUpgradeAll={(upgradable) => void actions.handleUpgradeAll(upgradable)}
        onDropFolder={(folder) => void actions.handleDrop(folder)}
      />
    </>
  );
};
