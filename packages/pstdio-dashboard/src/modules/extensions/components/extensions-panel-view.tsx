import { HStack, Input, InputGroup, Stack, Text } from "@chakra-ui/react";
import type {
  ExtensionDiagnostic,
  MarketplaceExtension,
  ProjectExtensionInstance,
  WorkbenchExtensionAutomationRecord,
  WorkbenchExtensionHarnessRecord,
} from "@pstdio/sdk/api";
import { Search } from "lucide-react";
import type { AgentInfo } from "pstdio-api-contracts";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PageContentLayout } from "@/shared/components/page-content-layout";
import type { DroppedExtensionFolder } from "@/shared/extensions/api";
import { ExtensionActionFeedback, type ExtensionActionState } from "./extension-action-feedback";
import type { ExtensionUpgradeBatch } from "./extension-actions";
import { ExtensionFolderDropZone } from "./extension-folder-drop-zone";
import { unavailableExtensionHarnesses } from "./extension-harness-availability";
import { ExtensionListRow } from "./extension-list-row";
import { ExtensionUpgradeProgress } from "./extension-upgrade-progress";
import { MarketplaceExtensionRow } from "./marketplace-extension-row";

export interface ExtensionsPanelViewProps {
  extensions: ProjectExtensionInstance[];
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
  togglingInstanceId?: string;
  togglingAutomation?: boolean;
  upgradingInstanceIds?: string[];
  onToggle?: (extension: ProjectExtensionInstance, enabled: boolean) => void;
  onToggleAutomation?: (
    extension: ProjectExtensionInstance,
    automation: WorkbenchExtensionAutomationRecord,
    enabled: boolean,
  ) => Promise<unknown>;
  onUpgrade?: (extension: ProjectExtensionInstance) => void;
  onOpen?: (extension: ProjectExtensionInstance) => void;
  installingMarketplaceNames?: string[];
  onInstallMarketplace?: (extension: MarketplaceExtension) => void;
  onOpenMarketplace?: (extension: MarketplaceExtension) => void;
  upgradingAll?: boolean;
  onUpgradeAll?: (extensions: ProjectExtensionInstance[]) => void;
  addingFolderName?: string;
  onDropFolder?: (folder: DroppedExtensionFolder) => void;
}

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

const matchesSearch = (extension: ProjectExtensionInstance, search: string) => {
  const query = search.trim().toLowerCase();
  if (!query) return true;
  return [extension.displayName, extension.extensionId, extension.description ?? ""].some((value) =>
    value.toLowerCase().includes(query),
  );
};

const matchesMarketplaceSearch = (extension: MarketplaceExtension, search: string) => {
  const query = search.trim().toLowerCase();
  if (!query) return true;
  return [extension.displayName, extension.installName, extension.extensionId ?? "", extension.description].some(
    (value) => value.toLowerCase().includes(query),
  );
};

export const ExtensionsPanelView = (props: ExtensionsPanelViewProps) => {
  const {
    extensions,
    actionStates = {},
    onDismissAction,
    onRetryAction,
    onDismissBatch,
    batch,
    marketplace,
    diagnostics,
    automations,
    harnesses,
    agents,
    togglingInstanceId,
    togglingAutomation,
    upgradingInstanceIds = [],
    installingMarketplaceNames = [],
    onToggle,
    onToggleAutomation,
    onUpgrade,
    onOpen,
    onInstallMarketplace,
    onOpenMarketplace,
    upgradingAll,
    onUpgradeAll,
    addingFolderName,
    onDropFolder,
  } = props;
  const { t } = useTranslation("projects");
  const [search, setSearch] = useState("");

  const diagnosticsByExtensionId = getDiagnosticsByExtensionId(extensions, diagnostics);
  const visible = extensions.filter((extension) => matchesSearch(extension, search));
  const availableMarketplace = marketplace.filter((extension) => !extension.installed);
  const visibleMarketplace = availableMarketplace.filter((extension) => matchesMarketplaceSearch(extension, search));
  const installingNames = new Set(installingMarketplaceNames);
  const upgradable = extensions.filter((extension) => extension.canUpgrade);

  return (
    <PageContentLayout
      testId="extensions-panel"
      header={
        <Stack
          paddingX="lg"
          paddingTop="lg"
          paddingBottom="md"
          gap="sm"
          bg="bg"
          borderBottomWidth="1px"
          borderColor="border.subtle"
        >
          <HStack gap="md" alignItems="center">
            <Text textStyle="heading/M" flex="1" minW="0">
              {t("projectSettings.extensionsPanel.title")}
            </Text>
            {(upgradable.length > 0 || batch || upgradingAll) && (
              <ExtensionUpgradeProgress
                batch={batch}
                onUpgrade={() => onUpgradeAll?.(upgradable)}
                onDismiss={onDismissBatch}
                canUpgrade={upgradable.length > 0}
              />
            )}
            <InputGroup startElement={<Search size={14} />} width="260px">
              <Input
                size="sm"
                value={search}
                placeholder={t("projectSettings.extensionsPanel.searchPlaceholder")}
                aria-label={t("projectSettings.extensionsPanel.searchPlaceholder")}
                onChange={(event) => setSearch(event.target.value)}
                data-testid="extensions-search"
              />
            </InputGroup>
          </HStack>
        </Stack>
      }
    >
      <Text paddingX="lg" paddingTop="md" paddingBottom="2xs" textStyle="label/XS/medium" color="fg.subtle">
        {t("projectSettings.extensionsPanel.installedGroup", { count: extensions.length })}
      </Text>

      {extensions.length === 0 && (
        <Text
          paddingX="lg"
          paddingY="md"
          textStyle="paragraph/S/regular"
          color="fg.muted"
          data-testid="extensions-empty"
        >
          {t("projectSettings.extensionsPanel.empty")}
        </Text>
      )}
      {extensions.length > 0 && visible.length === 0 && (
        <Text paddingX="lg" paddingY="md" textStyle="paragraph/S/regular" color="fg.muted">
          {t("projectSettings.extensionsPanel.noSearchResults", { query: search })}
        </Text>
      )}

      {visible.map((extension) => (
        <ExtensionListRow
          key={extension.id}
          extension={extension}
          diagnostics={diagnosticsByExtensionId.get(extension.extensionId) ?? []}
          automations={automations.filter((automation) => automation.extensionInstanceId === extension.id)}
          unavailableHarnesses={unavailableExtensionHarnesses(extension, harnesses, agents)}
          toggling={togglingInstanceId === extension.id}
          togglingAutomation={togglingAutomation}
          upgrading={upgradingInstanceIds.includes(extension.id)}
          action={actionStates[extension.id] ?? actionStates[extension.installName]}
          onDismissAction={(expected) =>
            onDismissAction?.(actionStates[extension.id] ? extension.id : extension.installName, expected)
          }
          onRetryAction={() => onRetryAction?.(extension.id)}
          onToggle={(enabled) => onToggle?.(extension, enabled)}
          onToggleAutomation={async (automation, enabled) => onToggleAutomation?.(extension, automation, enabled)}
          onUpgrade={() => onUpgrade?.(extension)}
          onOpen={() => onOpen?.(extension)}
        />
      ))}

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
          {t("projectSettings.extensionsPanel.noSearchResults", { query: search })}
        </Text>
      )}
      {visibleMarketplace.map((extension) => (
        <MarketplaceExtensionRow
          key={extension.installName}
          extension={extension}
          installing={installingNames.has(extension.installName)}
          feedback={
            <ExtensionActionFeedback
              action={actionStates[extension.installName]}
              onDismiss={() => onDismissAction?.(extension.installName)}
              onRetry={() => onInstallMarketplace?.(extension)}
            />
          }
          onInstall={() => onInstallMarketplace?.(extension)}
          onOpen={() => onOpenMarketplace?.(extension)}
        />
      ))}

      <Stack padding="lg">
        <ExtensionActionFeedback
          action={actionStates.$folder}
          onDismiss={() => onDismissAction?.("$folder")}
          onRetry={() => onRetryAction?.("$folder")}
        />
        <ExtensionFolderDropZone addingName={addingFolderName} onDropFolder={(folder) => onDropFolder?.(folder)} />
      </Stack>
    </PageContentLayout>
  );
};
