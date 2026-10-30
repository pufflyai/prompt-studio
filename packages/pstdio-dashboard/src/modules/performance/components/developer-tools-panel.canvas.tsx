import { Box } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { createWorkbench } from "@pstdio/workbench";
import { WORKBENCH_SETTINGS_OPEN_COMMAND_ID, Workbench } from "@pstdio/workbench/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { receiveSettings } from "@/shared/settings/synced-settings";
import { createSettingsModule } from "../../settings/module";
import { createPerformanceModule } from "../module";
import { DeveloperToolsContent } from "./developer-tools-panel";

const meta = {
  title: "Settings/Developer tools",
  component: DeveloperToolsContent,
  args: {
    host: "desktop",
    performanceEnabled: false,
    connectionStatusEnabled: false,
    onPerformanceChange: () => undefined,
    onConnectionStatusChange: () => undefined,
    onDismissError: () => undefined,
  },
} satisfies CanvasMeta<typeof DeveloperToolsContent>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const Off: Story = {
  id: "settings-developer-tools--off",
};
export const OnDesktop: Story = {
  id: "settings-developer-tools--on-desktop",
  args: { performanceEnabled: true, connectionStatusEnabled: true },
};
export const OnBrowser: Story = {
  id: "settings-developer-tools--on-browser",
  args: { performanceEnabled: true, host: "browser" },
};
export const Loading: Story = {
  id: "settings-developer-tools--loading",
  args: { performanceEnabled: undefined },
};
export const SaveFailure: Story = {
  id: "settings-developer-tools--save-failure",
  args: { error: "Could not change performance monitoring." },
};
// The real modules with a browser host: the panel opens under Workbench in the settings navigation.
const DeveloperToolsNavigation = () => {
  const [client] = useState(() => {
    const next = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
    next.setQueryData(["settings"], null);
    receiveSettings({ max_concurrent_sessions: null, notifications_enabled: false, machine_tokens_enabled: false });
    return next;
  });
  const [workbench] = useState(() => {
    const next = createWorkbench();
    next.registerModule(createSettingsModule());
    next.registerModule(createPerformanceModule(next.settings));
    void next.commands.executeCommand(WORKBENCH_SETTINGS_OPEN_COMMAND_ID, { panelId: "developer-tools" });
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
  id: "settings-developer-tools--settings-navigation",
  fullscreen: true,
  render: () => <DeveloperToolsNavigation />,
};
