import { Box, Button, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect } from "storybook/test";
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
        <Text textStyle="xs" px="sm">
          {input.label}
        </Text>
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
      <Text textStyle="xs" px="sm">{label}</Text>
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
          "The host status-bar registry places registered views on its leading or trailing side and centers each item vertically. Extensions reach it through defineStatusBarItem.",
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

const mixedWorkbench = createWorkbench();
for (const slot of ["leading", "trailing"] as const) {
  for (const kind of ["label", "button"] as const) {
    const id = `${slot}.${kind}`;
    mixedWorkbench.views.registerView({
      id,
      title: id,
      body: {
        kind: "react",
        render: () =>
          kind === "label" ? (
            <Text textStyle="xs" px="sm">
              {slot} status
            </Text>
          ) : (
            <Button size="xs" variant="ghost">
              {slot} action
            </Button>
          ),
      },
    });
    mixedWorkbench.statusBar.registerItem({ id, viewId: id, slot });
  }
}

export const MixedItemHeights: Story = {
  ...SeveralOwnersInOrder,
  args: { workbench: mixedWorkbench },
  parameters: {
    docs: {
      description: {
        story: "Text and buttons in both slots share the vertical center without layout wrappers in the views.",
      },
    },
  },
  play: async ({ canvasElement }) => {
    const footer = canvasElement.querySelector("footer");
    if (!footer) throw new Error("The status bar must be mounted.");
    const bounds = footer.getBoundingClientRect();
    const border = Number.parseFloat(getComputedStyle(footer).borderTopWidth);
    const center = bounds.top + border + (bounds.height - border) / 2;
    for (const item of footer.querySelectorAll("p, button")) {
      const itemBounds = item.getBoundingClientRect();
      await expect(Math.abs(itemBounds.top + itemBounds.height / 2 - center)).toBeLessThan(1);
    }
  },
};
