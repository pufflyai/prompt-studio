import { Box, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { createWorkbenchCore } from "../../core";
import { WorkbenchStatusBar } from "./workbench-panels";

const workbench = createWorkbenchCore();

const registerItem = (input: { id: string; label: string; order: number; slot: "leading" | "trailing" }) => {
  workbench.renderers.registerRenderer({
    id: input.id,
    render: () => (
      <Box display="flex" alignItems="center" h="full" px="sm">
        <Text textStyle="xs">{input.label}</Text>
      </Box>
    ),
  });
  workbench.layout.registerPanel({ id: input.id, title: input.label, region: "main", rendererId: input.id });
  workbench.views.registerView({ id: input.id, panelId: input.id, title: input.label });
  workbench.statusBar.registerItem({
    id: `${input.id}.status-bar-item`,
    viewId: input.id,
    slot: input.slot,
    order: input.order,
  });
};

registerItem({ id: "planner.branch", label: "main", order: 20, slot: "leading" });
registerItem({ id: "sync.connection", label: "Connected", order: 10, slot: "leading" });
registerItem({ id: "tasks.progress", label: "3 tasks", order: 10, slot: "trailing" });

const meta = {
  title: "pstdio-workbench/Status bar",
  component: WorkbenchStatusBar,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof WorkbenchStatusBar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SeveralOwnersInOrder: Story = {
  args: { workbench },
  decorators: [
    (Story) => (
      <Box h="2rem" w="full">
        <Story />
      </Box>
    ),
  ],
};
