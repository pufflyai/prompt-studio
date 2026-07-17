import { Box, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";
import { expect, fireEvent, waitFor, within } from "storybook/test";
import { SplitView } from "./split-view";

interface PaneContentProps {
  label: string;
  children: ReactNode;
}

const PaneContent = (props: PaneContentProps) => {
  const { label, children } = props;
  return (
    <Box h="full" w="full" bg="bg.muted" borderWidth="1px" borderColor="border.subtle" p="md">
      <Text textStyle="label/M/medium">{label}</Text>
      <Text mt="xs" textStyle="body/S/regular" color="fg.muted">
        {children}
      </Text>
    </Box>
  );
};

const meta = {
  title: "Components/Layout/Split View",
  component: SplitView,
  decorators: [
    (Story: () => ReactNode) => (
      <Box h="480px" p="lg" bg="bg">
        <Story />
      </Box>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component: "Arrange two or more mounted panes on either axis with pointer and keyboard resizing.",
      },
    },
  },
} satisfies Meta<typeof SplitView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ThreePanes: Story = {
  args: {
    panes: [
      {
        id: "files",
        sizePx: 180,
        minSizePx: 140,
        maxSizePx: 280,
        content: <PaneContent label="Files">Project navigation</PaneContent>,
      },
      {
        id: "editor",
        minSizePx: 320,
        content: <PaneContent label="Editor">Primary workspace</PaneContent>,
      },
      {
        id: "inspector",
        sizePx: 220,
        minSizePx: 180,
        maxSizePx: 320,
        content: <PaneContent label="Inspector">Resource details</PaneContent>,
      },
    ],
    resizeLabel: (index) => `Resize workspace pane ${index + 1}`,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const [firstSeparator] = canvas.getAllByRole("separator");
    fireEvent.keyDown(firstSeparator, { key: "ArrowRight" });
    await waitFor(() => expect(firstSeparator).toHaveAttribute("aria-valuenow", "204"));
  },
};

export const Vertical: Story = {
  args: {
    direction: "column",
    panes: [
      {
        id: "preview",
        sizePx: 120,
        minSizePx: 96,
        maxSizePx: 180,
        content: <PaneContent label="Preview">Rendered output</PaneContent>,
      },
      {
        id: "source",
        minSizePx: 180,
        content: <PaneContent label="Source">Editable content</PaneContent>,
      },
      {
        id: "terminal",
        sizePx: 140,
        minSizePx: 96,
        maxSizePx: 220,
        content: <PaneContent label="Terminal">Build output</PaneContent>,
      },
    ],
    resizeLabel: (index) => `Resize vertical pane ${index + 1}`,
  },
};
