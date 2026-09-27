import { Box, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";
import { expect, waitFor, within } from "storybook/test";
import { createWorkbench } from "../../core";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";
import { Workbench } from "../workbench/workbench";
import { createWorkbenchSettingsModule, WORKBENCH_SETTINGS_OPEN_COMMAND_ID } from "./settings-module";

const SettingsOverlayStory = () => {
  const [workbench] = useState(() => createWorkbench());
  useEffect(() => {
    const settings = workbench.registerModule(createWorkbenchSettingsModule());
    const general = workbench.registerModule({
      id: "storybook.settings.general",
      activate(ctx) {
        ctx.views.registerView({
          id: "storybook.settings.general.view",
          title: "General",
          body: { kind: "react", render: () => <Text p="md">General settings</Text> },
        });
        ctx.settings.registerSection({ id: "workbench", title: "Workbench", order: 10 });
        ctx.settings.registerPanel({
          id: "storybook.general",
          title: "General",
          kind: "view",
          order: 10,
          section: "workbench",
          scope: "global",
          viewId: "storybook.settings.general.view",
        });
      },
    });
    void workbench.commands.executeCommand(WORKBENCH_SETTINGS_OPEN_COMMAND_ID);
    return () => {
      general.dispose();
      settings.dispose();
    };
  }, [workbench]);
  return <Workbench workbench={workbench} />;
};

const meta = {
  title: "pstdio-workbench/Reference/Core API/Settings overlay",
  component: SettingsOverlayStory,
  decorators: [
    (Story) => (
      <WorkbenchThemeProvider>
        <Box height="100vh">
          <Story />
        </Box>
      </WorkbenchThemeProvider>
    ),
  ],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: { component: "The settings dialog uses the shared dialog close position beside its title." },
    },
  },
} satisfies Meta<typeof SettingsOverlayStory>;
export default meta;
type Story = StoryObj<typeof meta>;

export const CenteredClose: Story = {
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const close = await body.findByRole("button", { name: /^Close/ });
    const title = await body.findByText("Settings");
    await waitFor(() => {
      const closeRect = close.getBoundingClientRect();
      const titleRect = title.getBoundingClientRect();
      const difference = Math.abs(closeRect.y + closeRect.height / 2 - titleRect.y - titleRect.height / 2);
      expect(difference).toBeLessThanOrEqual(1);
    });
  },
};
