import { Box } from "@chakra-ui/react";
import { createWorkbenchCore } from "@pstdio/workbench/core";
import { Workbench } from "@pstdio/workbench/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { createSessionBubbleModule } from "./module";

const launcherWorkbench = createWorkbenchCore();
launcherWorkbench.registerModule(createSessionBubbleModule());

const SessionBubbleLauncherStory = () => (
  <Box h="32rem" minW="48rem">
    <Workbench workbench={launcherWorkbench} />
  </Box>
);

const meta = {
  title: "Modules/Sessions/Session Bubble",
  component: SessionBubbleLauncherStory,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof SessionBubbleLauncherStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NoActiveSession: Story = {};
