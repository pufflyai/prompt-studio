import { Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { createWorkbench } from "@pstdio/workbench";
import { WORKBENCH_SETTINGS_OPEN_COMMAND_ID, Workbench } from "@pstdio/workbench/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { receiveSettings } from "@/shared/settings/synced-settings";
import { createSettingsModule } from "../module";
import { BetaFeaturesContent } from "./beta-features-panel";

const meta = {
  title: "Product/Settings/Beta features",
  component: BetaFeaturesContent,
  args: { onChange: () => undefined, onRetry: () => undefined },
} satisfies CanvasMeta<typeof BetaFeaturesContent>;
export default meta;
type Story = CanvasFrame<typeof meta>;
const off = { notifications_enabled: false, machine_tokens_enabled: false };
export const Off: Story = {
  id: "settings-beta-features--off",
  args: { settings: off },
};
export const On: Story = {
  id: "settings-beta-features--on",
  args: { settings: { notifications_enabled: true, machine_tokens_enabled: true } },
};
export const Loading: Story = {
  id: "settings-beta-features--loading",
  args: { settings: undefined },
};
export const Failure: Story = {
  id: "settings-beta-features--failure",
  args: { settings: off, error: "Could not save settings. Try again." },
};
const BetaFeaturesNavigation = () => {
  const [client] = useState(() => {
    const next = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
    next.setQueryData(["settings"], null);
    receiveSettings({ max_concurrent_sessions: null, ...off });
    return next;
  });
  const [workbench] = useState(() => {
    const next = createWorkbench();
    next.registerModule(createSettingsModule());
    void next.commands.executeCommand(WORKBENCH_SETTINGS_OPEN_COMMAND_ID, { panelId: "beta-features" });
    return next;
  });
  return (
    <QueryClientProvider client={client}>
      <Box h="100dvh" w="full">
        <Workbench workbench={workbench} />
      </Box>
    </QueryClientProvider>
  );
};
export const ExperimentalNavigation: Story = {
  id: "settings-beta-features--experimental-navigation",
  fullscreen: true,
  render: () => <BetaFeaturesNavigation />,
};

export const SharedPendingAndRecovery = () => {
  const [confirmed, setConfirmed] = useState(off);
  const [pending, setPending] = useState<Partial<typeof off>>({});
  const [rejected, setRejected] = useState<boolean | undefined>();
  const [dismissed, setDismissed] = useState(false);
  const [open, setOpen] = useState(true);
  const settings = { ...confirmed, ...pending };
  return (
    <Stack p="md" gap="md" width="lg">
      <Text>{settings.notifications_enabled ? "Home · Notifications" : "Home"}</Text>
      {open ? (
        <BetaFeaturesContent
          settings={settings}
          pending={pending}
          error={rejected !== undefined && !dismissed ? "Could not change Notifications" : undefined}
          onChange={(patch) => setPending((current) => ({ ...current, ...patch }))}
          onDismiss={() => setDismissed(true)}
          onRetry={() => undefined}
        />
      ) : null}
      <HStack>
        <Button size="sm" onClick={() => setOpen(!open)}>
          {open ? "Close settings" : "Open settings"}
        </Button>
        <Button
          size="sm"
          onClick={() => {
            setConfirmed(settings);
            setPending({});
          }}
        >
          Confirm change
        </Button>
        <Button
          size="sm"
          disabled={pending.notifications_enabled === undefined}
          onClick={() => {
            setRejected(pending.notifications_enabled);
            setDismissed(false);
            setPending(({ notifications_enabled: _rejected, ...other }) => other);
          }}
        >
          Reject Notifications
        </Button>
      </HStack>
      {rejected !== undefined ? (
        <HStack aria-label="System activity">
          <Text>Could not change Notifications</Text>
          <Button size="sm" onClick={() => setOpen(true)}>
            Return to source
          </Button>
          <Button size="sm" variant="destructive" onClick={() => setRejected(undefined)}>
            Discard draft
          </Button>
        </HStack>
      ) : null}
    </Stack>
  );
};
