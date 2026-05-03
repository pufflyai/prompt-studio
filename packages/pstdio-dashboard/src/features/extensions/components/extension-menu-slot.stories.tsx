import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import type { ExtensionMenuActionItem } from "../extension-slots";
import { ExtensionMenuActions } from "./extension-menu-slot";

const actions: ExtensionMenuActionItem[] = [
  {
    key: "lab.say-hello:project.headerPrimary",
    label: "Lab: Say hello",
    kind: "extension",
    placement: "first",
    onClick: () => undefined,
  },
  {
    key: "lab.counter.bump:project.headerOverflow",
    label: "Bump lab counter",
    kind: "extension",
    onClick: () => undefined,
  },
];

const meta = {
  title: "Extensions/ExtensionMenuActions",
  component: ExtensionMenuActions,
  parameters: {
    layout: "padded",
  },
  decorators: [
    (Story) => (
      <Box borderWidth="1px" borderColor="border.muted" p="sm" minH="48px">
        <Story />
      </Box>
    ),
  ],
} satisfies Meta<typeof ExtensionMenuActions>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: {
    actions: [],
  },
};

export const Loading: Story = {
  args: {
    actions: [],
    isLoading: true,
  },
};

export const MenuActions: Story = {
  args: {
    actions,
    overflowLabel: "Project actions",
    presentation: "overflow-menu",
  },
};

export const ButtonGroupActions: Story = {
  args: {
    actions,
    overflowLabel: "Project actions",
    presentation: "button-group",
  },
};
