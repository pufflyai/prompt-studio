import { Box } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { createWorkbench } from "@pstdio/workbench";
import { WORKBENCH_SETTINGS_OPEN_COMMAND_ID, Workbench } from "@pstdio/workbench/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { receiveSettings } from "@/shared/settings/synced-settings";
import { createSettingsModule } from "../module";
import { BetaFeaturesContent } from "./beta-features-panel";

const meta = {
  title: "Settings/Beta features",
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
