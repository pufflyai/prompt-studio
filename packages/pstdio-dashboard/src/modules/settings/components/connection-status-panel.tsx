import { HStack, Stack, Text } from "@chakra-ui/react";
import { AlertMessage, Switch } from "@pstdio/ui";
import { useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { useConnectionStatusSettings } from "@/lib/sync/connection-status-context";

interface ConnectionStatusContentProps {
  enabled: boolean;
  error?: string;
  onChange: (enabled: boolean) => void;
  onDismissError: () => void;
}

export const ConnectionStatusContent = (props: ConnectionStatusContentProps) => {
  const { enabled, error, onChange, onDismissError } = props;
  const { t } = useTranslation("settings");
  return (
    <Stack gap="md" padding="lg" maxW="720px">
      <Stack gap="2xs">
        <Text textStyle="heading/S">{t("connectionStatus.title")}</Text>
        <Text textStyle="paragraph/S/regular" color="fg.muted">
          {t("connectionStatus.description")}
        </Text>
      </Stack>
      {error ? <AlertMessage status="error" title={error} onClose={onDismissError} /> : null}
      <Stack gap="sm" borderWidth="1px" borderColor="border.subtle" borderRadius="md" padding="md">
        <HStack gap="sm" alignItems="center">
          <Text textStyle="label/S/medium" flex="1">
            {t("connectionStatus.enable")}
          </Text>
          <Switch
            checked={enabled}
            inputProps={{ checked: enabled, "aria-label": t("connectionStatus.enable") }}
            onCheckedChange={({ checked }) => onChange(checked)}
          />
        </HStack>
      </Stack>
    </Stack>
  );
};

export const ConnectionStatusPanel = () => {
  const connectionStatusSettings = useConnectionStatusSettings();
  const enabled = useSyncExternalStore(connectionStatusSettings.subscribe, connectionStatusSettings.getEnabled);
  const [error, setError] = useState<string>();
  const { t } = useTranslation("settings");
  const change = (next: boolean) => {
    setError(undefined);
    try {
      connectionStatusSettings.setEnabled(next);
    } catch {
      setError(t("connectionStatus.saveError"));
    }
  };
  return (
    <ConnectionStatusContent
      enabled={enabled}
      error={error}
      onChange={change}
      onDismissError={() => setError(undefined)}
    />
  );
};
