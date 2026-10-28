import { Box, Text } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { useEffect, useState } from "react";
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
        ctx.views.registerView({
          id: "storybook.settings.appearance.view",
          title: "Appearance",
          body: { kind: "react", render: () => <Text p="md">Appearance settings</Text> },
        });
        ctx.settings.registerPanel({
          id: "storybook.appearance",
          title: "Appearance",
          kind: "view",
          order: 20,
          section: "workbench",
          scope: "global",
          viewId: "storybook.settings.appearance.view",
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
} satisfies CanvasMeta<typeof SettingsOverlayStory>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const CenteredClose: Story = {
  id: "pstdio-workbench-reference-core-api-settings-overlay--centered-close",
};
export const NavigationRetention: Story = {
  id: "pstdio-workbench-reference-core-api-settings-overlay--navigation-retention",
};
