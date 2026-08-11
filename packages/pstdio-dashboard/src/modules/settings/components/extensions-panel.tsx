import { Flex, HStack, Input, InputGroup, Spinner, Stack, Text } from "@chakra-ui/react";
import type {
  ExtensionDiagnostic,
  ProjectExtensionInstance,
  WorkbenchExtensionAutomationRecord,
} from "@pstdio/sdk/api";
import { toaster } from "@pstdio/ui";
import { Search } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useAttemptExtensionFix,
  useProjectExtensionMetadata,
  useProjectExtensions,
  useReloadProjectExtension,
  useSetProjectExtensionEnabled,
} from "@/shared/extensions/use-project-extensions";
import { ExtensionDetailContainer } from "./extension-detail-container";
import type { ExtensionHealthPopoverProps } from "./extension-health-popover";
import { ExtensionListRow } from "./extension-list-row";

interface ExtensionsPanelProps {
  projectId: string | undefined;
}

export interface ExtensionsPanelViewProps {
  extensions: ProjectExtensionInstance[];
  diagnostics: ExtensionDiagnostic[];
  automations: WorkbenchExtensionAutomationRecord[];
  togglingInstanceId?: string;
  onToggle?: (extension: ProjectExtensionInstance, enabled: boolean) => void;
  onOpen?: (extension: ProjectExtensionInstance) => void;
  healthActions?: (
    extension: ProjectExtensionInstance,
  ) => Omit<ExtensionHealthPopoverProps, "extension" | "diagnostics">;
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

export const ExtensionsPanelView = (props: ExtensionsPanelViewProps) => {
  const { extensions, diagnostics, automations, togglingInstanceId, onToggle, onOpen, healthActions } = props;
  const { t } = useTranslation("projects");
  const [search, setSearch] = useState("");

  const diagnosticsByExtensionId = getDiagnosticsByExtensionId(extensions, diagnostics);
  const visible = extensions.filter((extension) => matchesSearch(extension, search));
  const enabledCount = extensions.filter((extension) => extension.enabled).length;
  const failingCount = extensions.filter((extension) => extension.status === "error").length;

  return (
    <Stack gap="0" data-testid="extensions-panel">
      <Stack
        paddingX="lg"
        paddingTop="lg"
        paddingBottom="md"
        gap="sm"
        borderBottomWidth="1px"
        borderColor="border.subtle"
      >
        <HStack gap="md" alignItems="center">
          <Stack gap="2xs" flex="1" minW="0">
            <Text textStyle="heading/M">{t("projectSettings.extensionsPanel.title")}</Text>
            <Text textStyle="label/XS" color="fg.subtle">
              {t("projectSettings.extensionsPanel.counts", {
                installed: extensions.length,
                enabled: enabledCount,
                failing: failingCount,
              })}
            </Text>
          </Stack>
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
          health={{
            diagnostics: diagnosticsByExtensionId.get(extension.extensionId) ?? [],
            ...healthActions?.(extension),
          }}
          automations={automations.filter((automation) => automation.extensionId === extension.extensionId)}
          toggling={togglingInstanceId === extension.id}
          onToggle={(enabled) => onToggle?.(extension, enabled)}
          onOpen={() => onOpen?.(extension)}
        />
      ))}
    </Stack>
  );
};

export const ExtensionsPanel = (props: ExtensionsPanelProps) => {
  const { projectId } = props;
  const { t } = useTranslation("projects");
  const extensionsQuery = useProjectExtensions(projectId);
  const metadataQuery = useProjectExtensionMetadata(projectId);
  const setEnabled = useSetProjectExtensionEnabled(projectId);
  const reload = useReloadProjectExtension(projectId);
  const attemptFix = useAttemptExtensionFix(projectId);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);

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
  const selected = extensions.find((extension) => extension.id === selectedInstanceId);

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

  const healthActions = (extension: ProjectExtensionInstance) => ({
    retrying: reload.isPending && reload.variables?.instanceId === extension.id,
    fixing: attemptFix.isPending && attemptFix.variables?.instanceId === extension.id,
    onRetry: () => reload.mutate({ instanceId: extension.id }),
    onAttemptFix: () =>
      attemptFix.mutate(
        { instanceId: extension.id },
        {
          onSuccess: (response) => {
            toaster.create({
              type: "success",
              title: t("projectSettings.extensionsPanel.health.fixSessionStarted"),
              description: response.title,
            });
          },
          onError: (error) => {
            toaster.create({
              type: "error",
              title: t("projectSettings.extensionsPanel.health.fixSessionFailed"),
              description: error instanceof Error ? error.message : undefined,
            });
          },
        },
      ),
  });

  return (
    <ExtensionsPanelView
      extensions={extensions}
      diagnostics={metadataQuery.data?.diagnostics ?? []}
      automations={metadataQuery.data?.automations ?? []}
      togglingInstanceId={setEnabled.isPending ? (setEnabled.variables?.instanceId ?? undefined) : undefined}
      onToggle={handleToggle}
      onOpen={(extension) => setSelectedInstanceId(extension.id)}
      healthActions={healthActions}
    />
  );
};
