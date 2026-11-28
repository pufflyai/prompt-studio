import { Stack, Text } from "@chakra-ui/react";
import type { ProjectExtensionInstance } from "@pstdio/sdk/api";
import { LoadingState } from "@pstdio/ui";
import type { WorkbenchPanelRenderInput } from "@pstdio/workbench";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { getApiClient } from "@/lib/api";
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
import { extensionUpgradeAgentAvailable, openExtensionUpgradeAgentDraft } from "./extension-upgrade-agent-draft";
import { ExtensionUpgradeReviewDialog, type ReviewTarget } from "./extension-upgrade-review-dialog";
import { ExtensionsPanelView } from "./extensions-panel-view";
import { useExtensionPanelActions } from "./use-extension-panel-actions";

interface ExtensionsPanelProps {
  projectId: string | undefined;
  settingsInput: WorkbenchPanelRenderInput;
}

const selectedExtension = (id: string | undefined, kind: string) =>
  id?.startsWith(`${kind}:`) ? id.slice(kind.length + 1) : null;

const useUpgradeReviewTarget = (
  projectId: string | undefined,
  extensions: ProjectExtensionInstance[] | undefined,
  actions: ReturnType<typeof useExtensionPanelActions>,
) => {
  const [reviewTarget, setReviewTarget] = useState<ReviewTarget | null>(null);
  const retryOrReview = (id: string, upgrade = false) => {
    const extension = extensions?.find((entry) => entry.id === id);
    if (!projectId || !extension) return;
    if (!extension.hasPublishedAlternative && !actions.actions[id]?.needsReview)
      return upgrade ? void actions.handleUpgrade(extension) : actions.retry(id);
    const load = getApiClient()
      .extensions.reviewUpgrade(projectId, id, { action: "begin" })
      .then(({ review }) => review);
    setReviewTarget({ extension, load });
  };
  return { reviewTarget, setReviewTarget, retryOrReview };
};

const ActiveExtensionUpgradeReview = ({
  projectId,
  reviewTarget,
  actions,
  settingsInput,
  close,
}: {
  projectId: string | undefined;
  reviewTarget: ReviewTarget | null;
  actions: ReturnType<typeof useExtensionPanelActions>;
  settingsInput: WorkbenchPanelRenderInput;
  close: () => void;
}) => {
  if (!projectId || !reviewTarget) return null;
  return (
    <ExtensionUpgradeReviewDialog
      projectId={projectId}
      target={reviewTarget}
      onClose={close}
      onApplied={() => actions.resolveConflict(reviewTarget.extension.id)}
      onCompose={
        extensionUpgradeAgentAvailable(settingsInput.workbench)
          ? (review, instructions) =>
              openExtensionUpgradeAgentDraft(settingsInput, projectId, reviewTarget.extension.id, review, instructions)
          : undefined
      }
    />
  );
};

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
  const { reviewTarget, setReviewTarget, retryOrReview } = useUpgradeReviewTarget(
    projectId,
    extensionsQuery.data?.extensions,
    actions,
  );
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
  const resolveInstanceId = selectedExtension(selection, "resolve");
  const openedResolution = useRef<string | null>(null);
  useEffect(() => {
    if (!resolveInstanceId) {
      openedResolution.current = null;
      return;
    }
    if (openedResolution.current === resolveInstanceId || !extensionsQuery.data || settingsInput.visible === false)
      return;
    if (!actions.actions[resolveInstanceId]?.needsReview) return;
    openedResolution.current = resolveInstanceId;
    retryOrReview(resolveInstanceId);
  }, [resolveInstanceId, extensionsQuery.data, settingsInput.visible, retryOrReview, actions.actions]);
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
    <>
      <ExtensionReplacementConfirmation
        replacement={actions.replacement}
        onClose={() => actions.setReplacement(null)}
      />
      <ActiveExtensionUpgradeReview
        projectId={projectId}
        reviewTarget={reviewTarget}
        actions={actions}
        settingsInput={settingsInput}
        close={() => {
          setReviewTarget(null);
          if (resolveInstanceId) openList();
        }}
      />
    </>
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
          onUpgrade={() => retryOrReview(selected.id, true)}
          onToggle={(enabled) => void actions.handleToggle(selected, enabled)}
          onDismissAction={(expected) => actions.dismiss(selected.id, expected)}
          onRetryAction={() => retryOrReview(selected.id)}
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
        onRetryAction={(id) => retryOrReview(id)}
        batch={actions.batch}
        togglingAutomation={automationPreferences.instances}
        onToggle={(extension, enabled) => void actions.handleToggle(extension, enabled)}
        onToggleAutomation={(extension, automation, enabled) =>
          setAutomationEnabled.mutateAsync({ instanceId: extension.id, automationId: automation.id, enabled })
        }
        onUpgrade={(extension) => retryOrReview(extension.id, true)}
        onOpen={(extension) => openDetail(`installed:${extension.id}`, extension.displayName)}
        onInstallMarketplace={(extension) => void actions.handleInstall(extension)}
        onOpenMarketplace={(extension) => openDetail(`marketplace:${extension.installName}`, extension.displayName)}
        onUpgradeAll={(upgradable) => void actions.handleUpgradeAll(upgradable)}
        onDropFolder={(folder) => void actions.handleDrop(folder)}
      />
    </>
  );
};
