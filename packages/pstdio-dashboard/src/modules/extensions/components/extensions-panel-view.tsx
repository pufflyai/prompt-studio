import { Badge, Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import type {
  ExtensionDiagnostic,
  MarketplaceExtension,
  ProjectExtensionInstance,
  WorkbenchExtensionAutomationRecord,
  WorkbenchExtensionHarnessRecord,
} from "@pstdio/sdk/api";
import type { AgentInfo } from "pstdio-api-contracts";
import { selectExtensionUpgradeCandidates } from "pstdio-api-contracts/extension-host";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { PageContentLayout } from "@/shared/components/page-content-layout";
import type { DroppedExtensionFolder } from "@/shared/extensions/api";
import { ExtensionActionFeedback, type ExtensionActionState } from "./extension-action-feedback";
import { canStartExtensionUpgrade, type ExtensionUpgradeBatch, marketplaceActionKey } from "./extension-actions";
import { defaultExtensionFilters, type ExtensionFilters, matchesExtensionSearch } from "./extension-filters";
import { ExtensionFolderDropZone } from "./extension-folder-drop-zone";
import { unavailableExtensionHarnesses } from "./extension-harness-availability";
import { ExtensionListRow } from "./extension-list-row";
import { ExtensionUpgradeProgress } from "./extension-upgrade-progress";
import { ExtensionsColumnHeader, ExtensionsPanelHeader } from "./extensions-panel-header";
import { MarketplaceExtensionRow } from "./marketplace-extension-row";

export interface ExtensionsPanelViewProps {
  projectId?: string;
  header?: ReactNode;
  savedSignIns?: ReactNode;
  filters?: ExtensionFilters;
  onFiltersChange?: (filters: ExtensionFilters) => void;
  rowRef?: (id: string, node: HTMLDivElement | null) => void;
  searchRef?: (node: HTMLInputElement | null) => void;
  extensions: ProjectExtensionInstance[];
  sourceChangingIds?: ReadonlySet<string>;
  actionStates?: Record<string, ExtensionActionState>;
  onDismissAction?: (id: string, expected?: ExtensionActionState) => void;
  onDismissBatch?: (batch: ExtensionUpgradeBatch) => void;
  onRetryAction?: (id: string) => void;
  batch?: ExtensionUpgradeBatch;
  marketplace: MarketplaceExtension[];
  diagnostics: ExtensionDiagnostic[];
  automations: WorkbenchExtensionAutomationRecord[];
  harnesses?: WorkbenchExtensionHarnessRecord[];
  agents?: AgentInfo[];
  togglingAutomation?: boolean | ReadonlySet<string>;
  onToggle?: (extension: ProjectExtensionInstance, enabled: boolean) => void;
  onToggleAutomation?: (
    extension: ProjectExtensionInstance,
    automation: WorkbenchExtensionAutomationRecord,
    enabled: boolean,
  ) => Promise<unknown>;
  onUpgrade?: (extension: ProjectExtensionInstance) => void;
  onOpen?: (extension: ProjectExtensionInstance) => void;
  onInstallMarketplace?: (extension: MarketplaceExtension) => void;
  onOpenMarketplace?: (extension: MarketplaceExtension) => void;
  onUpgradeAll?: (extensions: ProjectExtensionInstance[]) => void;
  onDropFolder?: (folder: DroppedExtensionFolder) => void;
}

const compareDisplayName = (a: { displayName: string }, b: { displayName: string }) =>
  a.displayName.localeCompare(b.displayName);

const getDiagnosticsByExtensionId = (extensions: ProjectExtensionInstance[], diagnostics: ExtensionDiagnostic[]) => {
  const installedExtensionIds = new Set(extensions.map((extension) => extension.extensionId));
  const diagnosticsByExtensionId = new Map<string, ExtensionDiagnostic[]>();

  for (const diagnostic of diagnostics) {
    if (!diagnostic.extensionId || !installedExtensionIds.has(diagnostic.extensionId)) continue;

    const extensionDiagnostics = diagnosticsByExtensionId.get(diagnostic.extensionId) ?? [];
    extensionDiagnostics.push(diagnostic);
    diagnosticsByExtensionId.set(diagnostic.extensionId, extensionDiagnostics);
  }

  return diagnosticsByExtensionId;
};

export const ExtensionsPanelView = (props: ExtensionsPanelViewProps) => {
  const {
    extensions,
    actionStates = {},
    sourceChangingIds,
    onDismissAction,
    onRetryAction,
    onDismissBatch,
    batch,
    marketplace,
    diagnostics,
    automations,
    harnesses,
    agents,
    togglingAutomation,
    onToggle,
    onToggleAutomation,
    onUpgrade,
    onOpen,
    onInstallMarketplace,
    onOpenMarketplace,
    onUpgradeAll,
    onDropFolder,
  } = props;
  const { t } = useTranslation("projects");
  const [localFilters, setLocalFilters] = useState(defaultExtensionFilters);
  const filters = props.filters ?? localFilters;
  const onFiltersChange = props.onFiltersChange ?? setLocalFilters;
  const clearSearch = () => onFiltersChange(defaultExtensionFilters);
  const matches = (extension: ProjectExtensionInstance | MarketplaceExtension) =>
    matchesExtensionSearch(extension, filters.search);

  const diagnosticsByExtensionId = getDiagnosticsByExtensionId(extensions, diagnostics);
  const sortedExtensions = [...extensions].sort(compareDisplayName);
  const visible = sortedExtensions.filter(matches);
  const availableMarketplace = marketplace.filter((extension) => !extension.installed).sort(compareDisplayName);
  const visibleMarketplace = availableMarketplace.filter(matches);
  const groups = [
    { key: "enabled", extensions: visible.filter((extension) => extension.enabled) },
    { key: "installed", extensions: visible.filter((extension) => !extension.enabled) },
  ];
  const upgradable = selectExtensionUpgradeCandidates(extensions).filter(
    ({ id }) => !sourceChangingIds?.has(id) && canStartExtensionUpgrade(actionStates[id]),
  );
  const folderAction = actionStates.$folder;

  return (
    <Box w="full" h="full" flex="1" minH="0" minW="0" containerType="inline-size">
      <PageContentLayout
        testId="extensions-panel"
        header={
          <Stack gap="0">
            {props.header === undefined ? (
              <ExtensionsPanelHeader
                searchRef={props.searchRef}
                filters={filters}
                onFiltersChange={onFiltersChange}
                upgrade={
                  (upgradable.length > 0 || batch) && (
                    <ExtensionUpgradeProgress
                      batch={batch}
                      onUpgrade={() => onUpgradeAll?.(upgradable)}
                      onDismiss={onDismissBatch}
                      upgradeCount={upgradable.length}
                    />
                  )
                }
              />
            ) : (
              props.header
            )}
            <ExtensionsColumnHeader />
          </Stack>
        }
      >
        {visible.length === 0 && (
          <Stack padding="lg" gap="md" align="start" data-testid="extensions-empty">
            <Text textStyle="paragraph/S/regular" color="fg.muted">
              {extensions.length === 0
                ? t("projectSettings.extensionsPanel.empty")
                : t("projectSettings.extensionsPanel.noMatches")}
            </Text>
            {filters.search && (
              <Button variant="outline" size="xs" onClick={clearSearch}>
                {t("projectSettings.extensionsPanel.clearSearch")}
              </Button>
            )}
          </Stack>
        )}
        <Stack gap="0">
          {groups
            .filter((group) => group.extensions.length > 0)
            .flatMap((group) => [
              <HStack
                key={group.key}
                paddingX="lg"
                paddingY="sm"
                gap="sm"
                bg="bg.subtle"
                borderBottomWidth="1px"
                borderColor="border.subtle"
                data-testid={`extensions-group-${group.key}`}
              >
                <Text as="h2" textStyle="label/XS/medium">
                  {t(`projectSettings.extensionsPanel.${group.key}Group`)}
                </Text>
                <Badge variant="number" size="xs">
                  {group.extensions.length}
                </Badge>
              </HStack>,
              ...group.extensions.map((extension) => (
                <ExtensionListRow
                  projectId={props.projectId}
                  key={extension.id}
                  rowRef={(node) => props.rowRef?.(`installed:${extension.id}`, node)}
                  extension={extension}
                  diagnostics={diagnosticsByExtensionId.get(extension.extensionId) ?? []}
                  automations={automations.filter((automation) => automation.extensionInstanceId === extension.id)}
                  unavailableHarnesses={unavailableExtensionHarnesses(extension, harnesses, agents)}
                  togglingAutomation={
                    typeof togglingAutomation === "boolean" ? togglingAutomation : togglingAutomation?.has(extension.id)
                  }
                  action={actionStates[extension.id]}
                  sourceChanging={sourceChangingIds?.has(extension.id)}
                  onDismissAction={(expected) => onDismissAction?.(extension.id, expected)}
                  onRetryAction={() => onRetryAction?.(extension.id)}
                  onToggle={(enabled) => onToggle?.(extension, enabled)}
                  onToggleAutomation={async (automation, enabled) =>
                    onToggleAutomation?.(extension, automation, enabled)
                  }
                  onUpgrade={() => onUpgrade?.(extension)}
                  onOpen={() => onOpen?.(extension)}
                />
              )),
            ])}
        </Stack>

        {props.savedSignIns}

        <Text paddingX="lg" paddingTop="md" paddingBottom="2xs" textStyle="label/XS/medium" color="fg.subtle">
          {t("projectSettings.extensionsPanel.marketplace.group", { count: availableMarketplace.length })}
        </Text>
        {availableMarketplace.length === 0 && (
          <Text paddingX="lg" paddingY="md" textStyle="paragraph/S/regular" color="fg.muted">
            {t("projectSettings.extensionsPanel.marketplace.allInstalled")}
          </Text>
        )}
        {availableMarketplace.length > 0 && visibleMarketplace.length === 0 && (
          <Text paddingX="lg" paddingY="md" textStyle="paragraph/S/regular" color="fg.muted">
            {t("projectSettings.extensionsPanel.noMatches")}
          </Text>
        )}
        {visibleMarketplace.map((extension) => (
          <MarketplaceExtensionRow
            key={extension.installName}
            rowRef={(node) => props.rowRef?.(`marketplace:${extension.installName}`, node)}
            extension={extension}
            action={actionStates[marketplaceActionKey(extension.installName)]}
            onDismissAction={(expected) => onDismissAction?.(marketplaceActionKey(extension.installName), expected)}
            onRetryAction={() => onRetryAction?.(marketplaceActionKey(extension.installName))}
            onInstall={() => onInstallMarketplace?.(extension)}
            onOpen={() => onOpenMarketplace?.(extension)}
          />
        ))}

        <Stack padding="lg" position="relative">
          <ExtensionActionFeedback
            action={folderAction}
            onDismiss={() => onDismissAction?.("$folder", folderAction)}
            onRetry={() => onRetryAction?.("$folder")}
          />
          <ExtensionFolderDropZone
            addingLabel={folderAction?.status === "running" ? folderAction.label : undefined}
            onDropFolder={(folder) => onDropFolder?.(folder)}
          />
        </Stack>
      </PageContentLayout>
    </Box>
  );
};
