import { Button, Flex, HStack, Icon, Separator, Stack, Tabs, Text } from "@chakra-ui/react";
import type {
  ExtensionDiagnostic,
  ExtensionSettingValueRecord,
  ProjectExtensionInstance,
  WorkbenchExtensionAutomationRecord,
} from "@pstdio/sdk/api";
import { AlertMessage, EmptyState, ParamEditor, Switch, type SwitchProps } from "@pstdio/ui";
import {
  ArrowLeft,
  ArrowUpCircle,
  Blocks,
  Puzzle,
  RotateCw,
  SlidersHorizontal,
  Timer,
  Trash2,
  Wrench,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { resolveLocalizableString } from "@/shared/extensions/extension-localization";
import type { DashboardExtensionMetadata } from "@/shared/extensions/types";
import { ExtensionConnectionsCard } from "./extension-connections-card";
import { ExtensionContributions } from "./extension-contributions";
import { settingsToParams, settingsToValues } from "./extension-settings-params";

export interface ExtensionDetailProps {
  projectId?: string;
  extension: ProjectExtensionInstance;
  metadata: DashboardExtensionMetadata | undefined;
  automations: WorkbenchExtensionAutomationRecord[];
  diagnostics: ExtensionDiagnostic[];
  settings: ExtensionSettingValueRecord[];
  toggling?: boolean;
  retrying?: boolean;
  updating?: boolean;
  upgrading?: boolean;
  fixing?: boolean;
  uninstalling?: boolean;
  togglingAutomationId?: string;
  onBack: () => void;
  onToggle: (enabled: boolean) => void;
  onToggleAutomation: (automation: WorkbenchExtensionAutomationRecord, enabled: boolean) => void;
  onChangeSetting: (key: string, value: unknown) => void;
  onRetry: () => void;
  onUpdate: () => void;
  onUpgrade: () => void;
  onAttemptFix: () => void;
  onUninstall: () => void;
}

const errorText = (error: Record<string, unknown> | null | undefined, key: "code" | "message") => {
  const value = error?.[key];
  return typeof value === "string" ? value : undefined;
};

export const ExtensionDetail = (props: ExtensionDetailProps) => {
  const {
    extension,
    projectId,
    metadata,
    automations,
    diagnostics,
    settings,
    toggling,
    retrying,
    updating,
    upgrading,
    fixing,
    uninstalling,
    togglingAutomationId,
    onBack,
    onToggle,
    onToggleAutomation,
    onChangeSetting,
    onRetry,
    onUpdate,
    onUpgrade,
    onAttemptFix,
    onUninstall,
  } = props;
  const { t } = useTranslation("projects");
  const failed = extension.status === "error";
  const incompatible = errorText(extension.lastError, "code") === "extension_manifest_unsupported_api_version";
  const hasErrorDiagnostics = diagnostics.some((diagnostic) => diagnostic.severity === "error");
  const settingsParams = settingsToParams(settings);
  const handleCheckedChange: NonNullable<SwitchProps["onCheckedChange"]> = (details) => {
    onToggle(details.checked);
  };

  return (
    <Stack gap="md" paddingBottom="lg" data-testid="extension-detail">
      <Stack gap="md" paddingX="lg" paddingTop="lg">
        <HStack>
          <Button variant="ghost" size="2xs" onClick={onBack} data-testid="extension-detail-back">
            <ArrowLeft size={12} />
            {t("projectSettings.extensionsPanel.detail.back")}
          </Button>
        </HStack>

        <HStack gap="md" alignItems="center">
          <Flex
            alignItems="center"
            justifyContent="center"
            boxSize="11"
            flexShrink="0"
            borderWidth="1px"
            borderColor="border.subtle"
            borderRadius="sm"
            bg="bg.subtle"
          >
            <Puzzle size={22} />
          </Flex>
          <Stack gap="0" flex="1" minW="0">
            <Text textStyle="heading/M">{extension.displayName}</Text>
            <Text textStyle="label/XS" fontFamily="mono" color="fg.subtle">
              {extension.extensionId}
              {extension.version ? ` · v${extension.version}` : ""} ·{" "}
              {t(`projectSettings.extensionsPanel.scope.${extension.scope}`)}
            </Text>
          </Stack>
          {extension.canUpgrade && (
            <Button
              variant="solid"
              size="2xs"
              onClick={onUpgrade}
              loading={upgrading}
              data-testid="extension-upgrade"
              flexShrink="0"
            >
              <ArrowUpCircle size={12} />
              {t("projectSettings.extensionsPanel.upgrade.action")}
            </Button>
          )}
          {!extension.canUpgrade && extension.updateAvailable && (
            <Button
              variant="solid"
              size="2xs"
              onClick={onUpdate}
              loading={updating}
              data-testid="extension-update"
              flexShrink="0"
            >
              <ArrowUpCircle size={12} />
              {t("projectSettings.extensionsPanel.update.action")}
            </Button>
          )}
          <Switch
            size="sm"
            checked={extension.enabled}
            onCheckedChange={handleCheckedChange}
            disabled={toggling || uninstalling}
            aria-label={t("projectSettings.extensionsPanel.toggleAriaLabel", { name: extension.displayName })}
          />
        </HStack>

        {extension.description && (
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            {extension.description}
          </Text>
        )}

        <Stack gap="3xs">
          <Text textStyle="label/XS" color="fg.subtle">
            {t("projectSettings.extensionsPanel.detail.sourcePath")}
          </Text>
          <Text
            textStyle="label/XS"
            fontFamily="mono"
            color="fg.muted"
            wordBreak="break-all"
            data-testid="extension-detail-source-path"
          >
            {extension.sourcePath}
          </Text>
        </Stack>

        {failed && (
          <AlertMessage
            status="error"
            title={
              incompatible
                ? t("projectSettings.extensionsPanel.health.incompatibleVersions")
                : (errorText(extension.lastError, "code") ?? t("projectSettings.extensionsPanel.status.error"))
            }
            data-testid="extension-detail-health"
            endElement={
              incompatible ? undefined : (
                <HStack gap="xs" flexShrink="0">
                  <Button
                    variant="outline"
                    size="2xs"
                    onClick={onRetry}
                    loading={retrying}
                    data-testid="extension-retry"
                  >
                    <RotateCw size={12} />
                    {t("projectSettings.extensionsPanel.health.retry")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="2xs"
                    onClick={onAttemptFix}
                    loading={fixing}
                    data-testid="extension-attempt-fix"
                  >
                    <Wrench size={12} />
                    {t("projectSettings.extensionsPanel.health.attemptFix")}
                  </Button>
                </HStack>
              )
            }
          >
            {errorText(extension.lastError, "message") ?? t("projectSettings.extensionsPanel.health.unknownError")}
            {extension.lastLoadedAt
              ? ` · ${t("projectSettings.extensionsPanel.health.lastLoaded", {
                  time: new Date(extension.lastLoadedAt).toLocaleString(),
                })}`
              : ""}
          </AlertMessage>
        )}

        {!failed && diagnostics.length > 0 && (
          <AlertMessage
            status={hasErrorDiagnostics ? "error" : "warning"}
            title={t("projectSettings.extensionsPanel.health.issues", { count: diagnostics.length })}
            data-testid="extension-detail-issues"
          >
            {diagnostics.slice(0, 4).map((diagnostic, index) => (
              <Text key={`${diagnostic.code}-${index}`} textStyle="label/XS">
                {diagnostic.code}: {diagnostic.message}
              </Text>
            ))}
          </AlertMessage>
        )}
      </Stack>

      <Tabs.Root defaultValue="settings" size="sm" tray>
        <Tabs.List>
          <Tabs.Trigger value="settings">
            <SlidersHorizontal size={14} />
            {t("projectSettings.extensionsPanel.detail.tabs.settings")}
          </Tabs.Trigger>
          <Tabs.Trigger value="contributions">
            <Blocks size={14} />
            {t("projectSettings.extensionsPanel.detail.tabs.contributions")}
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="settings">
          <Stack gap="lg">
            <Stack gap="lg" paddingX="lg">
              {settingsParams.length > 0 ? (
                <ParamEditor
                  params={settingsParams}
                  defaultValues={settingsToValues(settings)}
                  onChange={(id, value) => onChangeSetting(id, value)}
                  variant="small"
                />
              ) : (
                <EmptyState
                  size="sm"
                  title={t("projectSettings.extensionsPanel.detail.noSettings")}
                  icon={<SlidersHorizontal />}
                />
              )}

              {projectId && metadata?.connections?.length ? (
                <ExtensionConnectionsCard projectId={projectId} definitions={metadata.connections} />
              ) : null}

              {automations.length > 0 && (
                <Stack gap="2xs">
                  <HStack gap="2xs">
                    <Icon boxSize="3" color="fg.subtle">
                      <Timer />
                    </Icon>
                    <Text
                      textStyle="label/XS/medium"
                      color="fg.subtle"
                      textTransform="uppercase"
                      letterSpacing="0.06em"
                    >
                      {t("projectSettings.extensionsPanel.automations.title")}
                    </Text>
                  </HStack>
                  {automations.map((automation) => (
                    <HStack key={automation.id} gap="md" minH="7" data-testid="extension-automation-row">
                      <Stack gap="0" flex="1" minW="0">
                        <Text textStyle="label/S/regular" truncate>
                          {resolveLocalizableString(automation.title, automation.extensionId)}
                        </Text>
                        <Text textStyle="label/XS" fontFamily="mono" color="fg.subtle" truncate>
                          {automation.commandId} ·{" "}
                          {t("projectSettings.extensionsPanel.automations.cron", { cron: automation.cron })}
                        </Text>
                      </Stack>
                      <Switch
                        size="sm"
                        checked={automation.enabled}
                        disabled={togglingAutomationId === automation.id}
                        onCheckedChange={(details) => onToggleAutomation(automation, details.checked)}
                        aria-label={t("projectSettings.extensionsPanel.automations.toggleAriaLabel", {
                          name: resolveLocalizableString(automation.title, automation.extensionId),
                        })}
                      />
                    </HStack>
                  ))}
                </Stack>
              )}
            </Stack>

            <Separator borderColor="border.subtle" />

            <Stack gap="2xs" paddingX="lg">
              <Text textStyle="label/XS/medium" color="fg.subtle" textTransform="uppercase" letterSpacing="0.06em">
                {t("projectSettings.extensionsPanel.detail.dangerZone")}
              </Text>
              <HStack justifyContent="space-between">
                <Text textStyle="label/XS" color="fg.muted">
                  {t("projectSettings.extensionsPanel.detail.deleteHint")}
                </Text>
                <Button
                  variant="destructive"
                  size="2xs"
                  onClick={onUninstall}
                  loading={uninstalling}
                  data-testid="extension-delete"
                >
                  <Trash2 size={12} />
                  {t("projectSettings.extensionsPanel.delete")}
                </Button>
              </HStack>
            </Stack>
          </Stack>
        </Tabs.Content>

        <Tabs.Content value="contributions">
          <Stack paddingX="lg">
            <ExtensionContributions metadata={metadata} extensionId={extension.extensionId} automations={automations} />
          </Stack>
        </Tabs.Content>
      </Tabs.Root>
    </Stack>
  );
};
