import { Box, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { createWorkbench } from "../../core";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";
import { WorkbenchStatusBar } from "./workbench-panels";

const workbench = createWorkbench();

const registerItem = (input: { id: string; label: string; order: number; slot: "leading" | "trailing" }) => {
  workbench.views.registerView({
    id: input.id,
    title: input.label,
    body: {
      kind: "react",
      render: () => (
        <Box display="flex" alignItems="center" h="full" px="sm">
          <Text textStyle="xs">{input.label}</Text>
        </Box>
      ),
    },
  });
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

const statusBarSource = `import { Box, Text } from "@chakra-ui/react";
import { createWorkbench } from "@pstdio/workbench";
import {
  WorkbenchStatusBar,
  WorkbenchThemeProvider,
} from "@pstdio/workbench/react";

const workbench = createWorkbench();

const registerItem = (id, label, order, slot) => {
  workbench.views.registerView({
    id,
    title: label,
    body: { kind: "react", render: () => (
      <Box display="flex" alignItems="center" h="full" px="sm">
        <Text textStyle="xs">{label}</Text>
      </Box>
    ) },
  });
  workbench.statusBar.registerItem({
    id: id + ".status-bar-item",
    viewId: id,
    slot,
    order,
  });
};

registerItem("planner.branch", "main", 20, "leading");
registerItem("sync.connection", "Connected", 10, "leading");
registerItem("tasks.progress", "3 tasks", 10, "trailing");

export const App = () => (
  <WorkbenchThemeProvider>
    <Box h="2rem">
      <WorkbenchStatusBar workbench={workbench} />
    </Box>
  </WorkbenchThemeProvider>
);`;

const meta = {
  title: "pstdio-workbench/Reference/Core API/Status bar",
  component: WorkbenchStatusBar,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The host status-bar registry places registered views on its leading or trailing side. Extensions reach it through defineStatusBarItem.",
      },
    },
  },
} satisfies Meta<typeof WorkbenchStatusBar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SeveralOwnersInOrder: Story = {
  args: { workbench },
  parameters: {
    docs: { source: { code: statusBarSource, language: "tsx", type: "code" } },
  },
  decorators: [
    (Story) => (
      <WorkbenchThemeProvider>
        <Box h="2rem" w="full">
          <Story />
        </Box>
      </WorkbenchThemeProvider>
    ),
  ],
};
