import { Box } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { createWorkbench } from "@pstdio/workbench";
import { WORKBENCH_SETTINGS_OPEN_COMMAND_ID, Workbench } from "@pstdio/workbench/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { receiveSettings } from "@/shared/settings/synced-settings";
import { createPerformanceModule } from "../../performance/module";
import { createSettingsModule } from "../../settings/module";
import { createUpdatesModule } from "../module";
import type { UpdateChannel, UpdateChannelBridge } from "../update-channel-bridge";
import { UpdateChannelContent } from "./update-channel-panel";

const meta = {
  title: "Settings/Update channel",
  component: UpdateChannelContent,
  args: {
    version: "0.41.0",
    onChange: () => undefined,
    onDismissError: () => undefined,
  },
} satisfies CanvasMeta<typeof UpdateChannelContent>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const Stable: Story = {
  id: "settings-update-channel--stable",
  args: { channel: "stable" },
};
export const Nightly: Story = {
  id: "settings-update-channel--nightly",
  args: { channel: "nightly", version: "0.42.0-nightly.20261011" },
};
export const Loading: Story = {
  id: "settings-update-channel--loading",
  args: { channel: undefined, version: undefined },
};
export const Saving: Story = {
  id: "settings-update-channel--saving",
  args: { channel: "nightly", saving: true },
};
export const SaveFailure: Story = {
  id: "settings-update-channel--save-failure",
  args: { channel: "stable", error: "Could not change the update channel." },
};
// A desktop app that remembers the channel in memory, like Electron main does on disk.
const createDesktopBridge = (): UpdateChannelBridge => {
  let channel: UpdateChannel = "stable";
  return {
    getAppInfo: async () => ({ version: "0.41.0" }),
    getUpdateChannel: async () => channel,
    setUpdateChannel: async (next) => {
      channel = next;
    },
  };
};
// The real modules with a fake desktop app: pick a channel, then reopen the panel.
const UpdateChannelNavigation = () => {
  const [client] = useState(() => {
    const next = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
    next.setQueryData(["settings"], null);
    receiveSettings({ max_concurrent_sessions: null, notifications_enabled: false, machine_tokens_enabled: false });
    return next;
  });
  const [workbench] = useState(() => {
    const next = createWorkbench();
    const bridge = createDesktopBridge();
    next.registerModule(createSettingsModule());
    next.registerModule(createPerformanceModule(next.settings));
    next.registerModule(createUpdatesModule(bridge));
    // The panel registers once the desktop reports a channel.
    void bridge
      .getUpdateChannel()
      .then(() => next.commands.executeCommand(WORKBENCH_SETTINGS_OPEN_COMMAND_ID, { panelId: "update-channel" }));
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
export const SettingsNavigation: Story = {
  id: "settings-update-channel--settings-navigation",
  fullscreen: true,
  render: () => <UpdateChannelNavigation />,
};
