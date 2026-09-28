import { Button, HStack, Input, InputGroup, Stack, Text } from "@chakra-ui/react";
import type {
  ExtensionDiagnostic,
  MarketplaceExtension,
  ProjectExtensionInstance,
  WorkbenchExtensionAutomationRecord,
} from "@pstdio/sdk/api";
import { ArrowUpCircle, Search } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { DroppedExtensionFolder } from "@/shared/extensions/api";
import { ExtensionFolderDropZone } from "./extension-folder-drop-zone";
import { ExtensionListRow } from "./extension-list-row";
import { MarketplaceExtensionRow } from "./marketplace-extension-row";

export interface ExtensionsPanelViewProps {
  extensions: ProjectExtensionInstance[];
  marketplace: MarketplaceExtension[];
  diagnostics: ExtensionDiagnostic[];
  automations: WorkbenchExtensionAutomationRecord[];
  togglingInstanceId?: string;
  upgradingInstanceIds?: string[];
  onToggle?: (extension: ProjectExtensionInstance, enabled: boolean) => void;
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
  return [extension.displayName, extension.installName, extension.description].some((value) =>
    value.toLowerCase().includes(query),
  );
};

export const ExtensionsPanelView = (props: ExtensionsPanelViewProps) => {
  const {
    extensions,
    marketplace,
    diagnostics,
    automations,
    togglingInstanceId,
    upgradingInstanceIds = [],
    installingMarketplaceNames = [],
    onToggle,
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
    <Stack gap="0" data-testid="extensions-panel">
      <Stack
        paddingX="lg"
        paddingTop="lg"
        paddingBottom="md"
        gap="sm"
        bg="bg"
        borderBottomWidth="1px"
        borderColor="border.subtle"
        position="sticky"
        top="0"
        zIndex="1"
      >
        <HStack gap="md" alignItems="center">
          <Text textStyle="heading/M" flex="1" minW="0">
            {t("projectSettings.extensionsPanel.title")}
          </Text>
          {upgradable.length > 0 && (
            <Button
              variant="primary"
              size="sm"
              flexShrink="0"
              loading={upgradingAll}
              onClick={() => onUpgradeAll?.(upgradable)}
              data-testid="extensions-upgrade-all"
            >
              <ArrowUpCircle size={14} />
              {t("projectSettings.extensionsPanel.upgradeAll.action")}
            </Button>
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
          automations={automations.filter((automation) => automation.extensionId === extension.extensionId)}
          toggling={togglingInstanceId === extension.id}
          upgrading={upgradingInstanceIds.includes(extension.id)}
          onToggle={(enabled) => onToggle?.(extension, enabled)}
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
          onInstall={() => onInstallMarketplace?.(extension)}
          onOpen={() => onOpenMarketplace?.(extension)}
        />
      ))}

      <Stack padding="lg">
        <ExtensionFolderDropZone addingName={addingFolderName} onDropFolder={(folder) => onDropFolder?.(folder)} />
      </Stack>
    </Stack>
  );
};
