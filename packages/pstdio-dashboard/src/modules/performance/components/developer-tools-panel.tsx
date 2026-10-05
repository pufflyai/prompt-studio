import { HStack, Stack, Text } from "@chakra-ui/react";
import { AlertMessage, Switch } from "@pstdio/ui";
import { useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import type { PerformanceMonitoringController } from "../performance-monitoring-controller";

interface DeveloperToolsContentProps {
  host: "desktop" | "browser";
  enabled?: boolean;
  saving?: boolean;
  error?: string;
  onChange: (enabled: boolean) => void;
  onDismissError: () => void;
}

export const DeveloperToolsContent = (props: DeveloperToolsContentProps) => {
  const { host, enabled, saving, error, onChange, onDismissError } = props;
  const { t } = useTranslation("settings");
  let helper = t("performance.settings.helperOff");
  if (enabled && host === "desktop") helper = t("performance.settings.helperDesktopOn");
  if (enabled && host === "browser") helper = t("performance.settings.helperBrowserOn");

  return (
    <Stack gap="md" padding="lg" maxW="720px">
      <Stack gap="2xs">
        <Text textStyle="heading/S">{t("performance.settings.title")}</Text>
        <Text textStyle="paragraph/S/regular" color="fg.muted">
          {t("performance.settings.description")}
        </Text>
      </Stack>
      {error ? <AlertMessage status="error" title={error} onClose={onDismissError} /> : null}
      <Stack gap="sm" borderWidth="1px" borderColor="border.subtle" borderRadius="md" padding="md">
        <HStack gap="sm" alignItems="center">
          <Stack gap="3xs" flex="1">
            <Text textStyle="label/S/medium">{t("performance.settings.enable")}</Text>
            <Text textStyle="label/S/regular" color="fg.muted">
              {helper}
            </Text>
          </Stack>
          <Switch
            checked={enabled === true}
            inputProps={{ checked: enabled === true, "aria-label": t("performance.settings.enable") }}
            disabled={enabled === undefined || saving}
            onCheckedChange={({ checked }) => onChange(checked)}
          />
        </HStack>
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
  const enabled = useSyncExternalStore(controller.subscribe, controller.getEnabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  const change = async (next: boolean) => {
    setSaving(true);
    setError(undefined);
    try {
      await controller.setEnabled(next);
    } catch {
      setError(t("performance.settings.saveError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DeveloperToolsContent
      host={controller.host.kind}
      enabled={enabled}
      saving={saving}
      error={error}
      onChange={(next) => void change(next)}
      onDismissError={() => setError(undefined)}
    />
  );
};
