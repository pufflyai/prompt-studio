import { Box } from "@chakra-ui/react";
import { createWorkbench } from "@pstdio/workbench";
import { WorkbenchTreeView } from "@pstdio/workbench/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { userEvent, within } from "storybook/test";
import { createHelpModule } from "./module";

const HelpMenuStory = () => {
  const [workbench] = useState(() => {
    const next = createWorkbench();
    next.registerModule(createHelpModule());
    next.views.registerView({
      id: "help-menu-story",
      title: "Help",
      body: {
        kind: "tree",
        getBody: () =>
          next.navigationTrees.getSections({ kind: "mode", id: "project", extensionId: "pstdio" }, "footer"),
        getChildren: () => [],
      },
    });
    return next;
  });

  return (
    <Box w="64" h="64" pt="40">
      <WorkbenchTreeView workbench={workbench} treeViewId="help-menu-story" />
    </Box>
  );
};

const meta = {
  title: "Dashboard/Help menu",
  component: HelpMenuStory,
  parameters: { layout: "padded" },
} satisfies Meta<typeof HelpMenuStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AlphaRelease: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole("button", { name: "Help" }));
  },
};
