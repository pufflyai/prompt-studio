import { HStack, Stack, StackSeparator, Text } from "@chakra-ui/react";
import { AlertMessage, Switch } from "@pstdio/ui";
import { useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { useConnectionStatusSettings } from "@/lib/sync/connection-status-context";
import type { PerformanceMonitoringController } from "../performance-monitoring-controller";

interface DeveloperToolsSwitchRowProps {
  label: string;
  helper: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

const DeveloperToolsSwitchRow = (props: DeveloperToolsSwitchRowProps) => {
  const { label, helper, checked, disabled, onChange } = props;
  return (
    <HStack gap="sm" alignItems="center" padding="md">
      <Stack gap="3xs" flex="1">
        <Text textStyle="label/S/medium">{label}</Text>
        <Text textStyle="label/S/regular" color="fg.muted">
          {helper}
        </Text>
      </Stack>
      <Switch
        checked={checked}
        inputProps={{ "aria-label": label }}
        disabled={disabled}
        onCheckedChange={(details) => onChange(details.checked)}
      />
    </HStack>
  );
};

interface DeveloperToolsContentProps {
  host: "desktop" | "browser";
  performanceEnabled?: boolean;
  performanceSaving?: boolean;
  connectionStatusEnabled: boolean;
  error?: string;
  onPerformanceChange: (enabled: boolean) => void;
  onConnectionStatusChange: (enabled: boolean) => void;
  onDismissError: () => void;
}

export const DeveloperToolsContent = (props: DeveloperToolsContentProps) => {
  const {
    host,
    performanceEnabled,
    performanceSaving,
    connectionStatusEnabled,
    error,
    onPerformanceChange,
    onConnectionStatusChange,
    onDismissError,
  } = props;
  const { t } = useTranslation("settings");
  let performanceHelper = t("performance.settings.description");
  if (performanceEnabled && host === "desktop") performanceHelper = t("performance.settings.helperDesktopOn");
  if (performanceEnabled && host === "browser") performanceHelper = t("performance.settings.helperBrowserOn");

  return (
    <Stack gap="md" padding="lg" maxW="720px">
      <Stack gap="2xs">
        <Text textStyle="heading/S">{t("developerTools.title")}</Text>
        <Text textStyle="paragraph/S/regular" color="fg.muted">
          {t("developerTools.description")}
        </Text>
      </Stack>
      {error ? <AlertMessage status="error" title={error} onClose={onDismissError} /> : null}
      <Stack
        gap="0"
        borderWidth="1px"
        borderColor="border.subtle"
        borderRadius="md"
        separator={<StackSeparator borderColor="border.subtle" />}
      >
        <DeveloperToolsSwitchRow
          label={t("performance.settings.enable")}
          helper={performanceHelper}
          checked={performanceEnabled === true}
          disabled={performanceEnabled === undefined || performanceSaving}
          onChange={onPerformanceChange}
        />
        <DeveloperToolsSwitchRow
          label={t("connectionStatus.enable")}
          helper={t("connectionStatus.description")}
          checked={connectionStatusEnabled}
          onChange={onConnectionStatusChange}
        />
      </Stack>
    </Stack>
  );
};

interface DeveloperToolsPanelProps {
  controller: PerformanceMonitoringController;
}

export const DeveloperToolsPanel = (props: DeveloperToolsPanelProps) => {
  const { controller } = props;
  const { t } = useTranslation("settings");
  const performanceEnabled = useSyncExternalStore(controller.subscribe, controller.getEnabled);
  const connectionStatusSettings = useConnectionStatusSettings();
  const connectionStatusEnabled = useSyncExternalStore(
    connectionStatusSettings.subscribe,
    connectionStatusSettings.getEnabled,
  );
  const [performanceSaving, setPerformanceSaving] = useState(false);
  const [error, setError] = useState<string>();

  const changePerformance = async (next: boolean) => {
    setPerformanceSaving(true);
    setError(undefined);
    try {
      await controller.setEnabled(next);
    } catch {
      setError(t("performance.settings.saveError"));
    } finally {
      setPerformanceSaving(false);
    }
  };
  const changeConnectionStatus = (next: boolean) => {
    setError(undefined);
    try {
      connectionStatusSettings.setEnabled(next);
    } catch {
      setError(t("connectionStatus.saveError"));
    }
  };

  return (
    <DeveloperToolsContent
      host={controller.host.kind}
      performanceEnabled={performanceEnabled}
      performanceSaving={performanceSaving}
      connectionStatusEnabled={connectionStatusEnabled}
      error={error}
      onPerformanceChange={(next) => void changePerformance(next)}
      onConnectionStatusChange={changeConnectionStatus}
      onDismissError={() => setError(undefined)}
    />
  );
};
