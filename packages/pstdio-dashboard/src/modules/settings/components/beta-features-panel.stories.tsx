import { Box } from "@chakra-ui/react";
import { createWorkbench } from "@pstdio/workbench";
import { WORKBENCH_SETTINGS_OPEN_COMMAND_ID, Workbench } from "@pstdio/workbench/react";
import type { Meta, StoryObj } from "@storybook/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { receiveSettings } from "@/shared/settings/synced-settings";
import { createSettingsModule } from "../module";
import { BetaFeaturesContent } from "./beta-features-panel";

const meta = {
  title: "Settings/Beta features",
  component: BetaFeaturesContent,
  args: { onChange: () => undefined, onRetry: () => undefined },
} satisfies Meta<typeof BetaFeaturesContent>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Off: Story = { args: { enabled: false } };
export const On: Story = { args: { enabled: true } };
export const Loading: Story = { args: { enabled: undefined } };
export const Failure: Story = { args: { enabled: false, error: "Could not save settings. Try again." } };

const BetaFeaturesNavigation = () => {
  const [client] = useState(() => {
    const next = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
    next.setQueryData(["settings"], null);
    receiveSettings({ max_concurrent_sessions: null, notifications_enabled: false });
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
  parameters: { layout: "fullscreen" },
  render: () => <BetaFeaturesNavigation />,
};
