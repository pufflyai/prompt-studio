import { HStack, Stack, Text } from "@chakra-ui/react";
import { commandRef } from "@pstdio/sdk/extensions";
import { AlertMessage, PopoverHeader } from "@pstdio/ui";
import { useState } from "react";
import { Button } from "./button";
import { useCloudContext } from "./cloud-context";
import { CloudIcon } from "./cloud-label";
import { useCloud } from "./use-cloud";

// The workbench's public settings command opens the registered panel in the shared settings surface.
const openSettings = commandRef<{ panelId: string }, void>({ extensionId: "pstdio", id: "workbench.settings.open" });

export const CloudDetails = (props: { projectId?: string }) => {
  const { projectId } = props;
  const { client, t } = useCloudContext();
  const { data, error } = useCloud(projectId, true);
  const [navigationError, setNavigationError] = useState<string>();
  const navigate = async () => {
    setNavigationError(undefined);
    try {
      await client.navigation.open({
        kind: "command",
        target: { command: openSettings, params: { panelId: "pstdio.pstdio-cloud.settings-panel.cloud" } },
      });
    } catch (cause) {
      setNavigationError(String(cause));
    }
  };
  const earlyAccess = data?.account.features?.relay;
  const connected =
    data && earlyAccess && ["synced", "waiting-to-sync", "first-download-incomplete"].includes(data.sync.state);
  return (
    <Stack gap="0">
      <PopoverHeader icon={<CloudIcon name="cloud" />} title={t("popover.title", "Prompt Studio Cloud")} />
      <Stack gap="md" px="md" pb="sm">
        {error && <AlertMessage status="error">{error}</AlertMessage>}
        {connected && (
          <Stack gap="xs">
            <Text textStyle="label/S/medium" color="fg.muted">
              {t("devices.title", "Devices")}
            </Text>
            {data.devices
              .filter((device) => device.online)
              .map((device) => (
                <HStack key={device.id} justify="space-between">
                  <HStack gap="xs">
                    <CloudIcon name={device.current ? "laptop" : "monitor"} />
                    <Text>{device.name}</Text>
                  </HStack>
                  <Text color="fg.muted">
                    {device.current ? t("devices.current", "This device") : t("devices.online", "Online")}
                  </Text>
                </HStack>
              ))}
          </Stack>
        )}
        <Stack gap="xs">
          <Text textStyle="label/S/medium" color="fg.muted">
            {t("account.title", "Account")}
          </Text>
          <HStack gap="xs">
            <CloudIcon name="user-round" />
            <Text>
              {data?.account.login?.email ??
                (data?.account.login ? t("status.signedIn", "Signed in") : t("account.signedOut", "Not signed in"))}
            </Text>
          </HStack>
        </Stack>
        <Button size="sm" variant="outline" alignSelf="flex-start" onClick={() => void navigate()}>
          <CloudIcon name="settings" />
          {t("settings.open", "Cloud settings")}
        </Button>
        {navigationError && <AlertMessage status="error">{navigationError}</AlertMessage>}
      </Stack>
    </Stack>
  );
};
