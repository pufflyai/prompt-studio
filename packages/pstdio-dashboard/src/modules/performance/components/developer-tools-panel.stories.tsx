import { Box } from "@chakra-ui/react";
import { createWorkbench } from "@pstdio/workbench";
import { WORKBENCH_SETTINGS_OPEN_COMMAND_ID, Workbench } from "@pstdio/workbench/react";
import type { Meta, StoryObj } from "@storybook/react";
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
    onChange: () => undefined,
    onDismissError: () => undefined,
  },
} satisfies Meta<typeof DeveloperToolsContent>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Off: Story = { args: { enabled: false } };
export const OnDesktop: Story = { args: { enabled: true } };
export const OnBrowser: Story = { args: { enabled: true, host: "browser" } };
export const Loading: Story = { args: { enabled: undefined } };
export const SaveFailure: Story = { args: { enabled: false, error: "Could not change performance monitoring." } };

// The real modules with a browser host: toggle the switch, then open the view.
const DeveloperToolsNavigation = () => {
  const [client] = useState(() => {
    const next = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
    next.setQueryData(["settings"], null);
    receiveSettings({ max_concurrent_sessions: null, notifications_enabled: false });
    return next;
  });
  const [workbench] = useState(() => {
    const next = createWorkbench();
    next.registerModule(createSettingsModule());
    next.registerModule(createPerformanceModule());
    void next.commands.executeCommand(WORKBENCH_SETTINGS_OPEN_COMMAND_ID, { panelId: "performance" });
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
  parameters: { layout: "fullscreen" },
  render: () => <DeveloperToolsNavigation />,
};
