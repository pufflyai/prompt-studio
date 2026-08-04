import "@pstdio/ui/style.css";

import { Box, HStack, Stack, Text } from "@chakra-ui/react";
import { defineExtensionView, type GuestHost } from "@pstdio/sdk/extensions";
import { ChakraProvider, psTheme, Switch } from "@pstdio/ui";
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { AUTOMATION_ENABLED_KEY, loadAutomationEnabled, saveAutomationEnabled } from "./automation-settings-state";

interface AutomationSettingsProps {
  host: GuestHost;
}

const AutomationSettings = (props: AutomationSettingsProps) => {
  const { host } = props;
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await loadAutomationEnabled({
        load: async () => (await host.call("extension.settings.all", {})) as Record<string, unknown>,
        setEnabled: (value) => {
          if (!cancelled) setEnabled(value);
        },
        setLoading: (value) => {
          if (!cancelled) setLoading(value);
        },
      });
      if (cancelled) return;
      setError(result.ok ? null : result.message);
    })();
    return () => {
      cancelled = true;
    };
  }, [host]);

  const updateEnabled = async (checked: boolean) => {
    setError(null);
    const result = await saveAutomationEnabled({
      checked,
      current: enabled,
      setEnabled,
      setSaving,
      save: async (value) => {
        await host.call("extension.settings.set", { key: AUTOMATION_ENABLED_KEY, value });
      },
    });
    if (!result.ok) setError(result.message);
  };

  return (
    <Stack gap="lg" p="lg" maxW="2xl">
      <Stack gap="xs">
        <Text textStyle="heading/M/semibold">Planner automation</Text>
        <Text textStyle="paragraph/S/regular" color="fg.muted">
          Enabling the extension loads its commands and hooks. Planner automation is a separate opt-in that permits
          scheduled agent work.
        </Text>
      </Stack>

      <Box borderWidth="1px" borderColor="border.subtle" borderRadius="sm" p="md">
        <HStack justify="space-between" gap="md" alignItems="flex-start">
          <Stack gap="2xs">
            <Text textStyle="label/S/semibold">Enable planner automation</Text>
            <Text textStyle="paragraph/XS/regular" color="fg.muted">
              Allow this repository&apos;s scheduled planner automation to create and reconcile agent work.
            </Text>
          </Stack>
          <Switch
            checked={enabled}
            disabled={loading || saving}
            aria-label="Enable planner automation"
            onCheckedChange={(event) => void updateEnabled(event.checked)}
          />
        </HStack>
        {error ? (
          <Text role="alert" mt="sm" textStyle="paragraph/XS/regular" color="fg.error">
            {error}
          </Text>
        ) : null}
      </Box>
    </Stack>
  );
};

export default defineExtensionView({
  render({ mount, host }) {
    const root = createRoot(mount);
    root.render(
      <StrictMode>
        <ChakraProvider value={psTheme}>
          <AutomationSettings host={host} />
        </ChakraProvider>
      </StrictMode>,
    );
    return () => root.unmount();
  },
});
