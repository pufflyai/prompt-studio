import { Button, HStack, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { createWorkbench } from "../../core";
import type { ViewToolbarAction } from "../../core/registries/renderers/view-toolbar-action";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";
import { ViewToolbarActions } from "./view-toolbar-actions";

const actions: ViewToolbarAction[] = [
  { id: "run", label: "Run experiment", presentation: "primary" },
  { id: "refresh", label: "Refresh results" },
];

const Toolbar = (props: { actions: ViewToolbarAction[] }) => {
  const { actions } = props;
  const [workbench] = useState(() => createWorkbench());
  const [lastAction, setLastAction] = useState("None");
  return (
    <Stack p="sm">
      <HStack gap="2xs">
        <Button size="2xs" variant="ghost">
          Filter
        </Button>
        <Button size="2xs" variant="ghost">
          Display
        </Button>
        <ViewToolbarActions
          workbench={workbench}
          actions={actions.map((action) => ({ ...action, run: () => setLastAction(action.label ?? action.id) }))}
        />
      </HStack>
      <Text>Last action: {lastAction}</Text>
    </Stack>
  );
};

const meta = {
  title: "pstdio-workbench/Reference/Core API/Native toolbar actions",
  component: Toolbar,
  args: { actions },
  decorators: [
    (Story) => (
      <WorkbenchThemeProvider>
        <Story />
      </WorkbenchThemeProvider>
    ),
  ],
} satisfies Meta<typeof Toolbar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const VisibleActions: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const primary = canvas.getByRole("button", { name: "Run experiment" });
    await expect(primary.getBoundingClientRect().height).toBe(28);
    await expect(canvas.getByRole("button", { name: "Refresh results" }).getBoundingClientRect().height).toBe(28);
    await expect(canvas.getAllByRole("separator")).toHaveLength(1);
    await expect(canvas.getByRole("separator").getBoundingClientRect().height).toBe(24);
    await userEvent.click(primary);
    await expect(canvas.getByText("Last action: Run experiment")).toBeVisible();
  },
};

export const NoActions: Story = {
  args: { actions: [] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("separator")).not.toBeInTheDocument();
  },
};

export const HiddenActions: Story = {
  args: { actions: actions.map((action) => ({ ...action, when: "false" })) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole("button", { name: "Run experiment" })).not.toBeInTheDocument();
    await expect(canvas.queryByRole("separator")).not.toBeInTheDocument();
  },
};
