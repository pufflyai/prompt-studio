import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { ShapeField } from "../../components/shapes/shape-field";

const meta = {
  title: "Theme/Tool Assembly",
  component: ShapeField,
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <Box width="6xl" maxWidth="full" height="48rem" position="relative">
        <Story />
      </Box>
    ),
  ],
} satisfies Meta<typeof ShapeField>;

export default meta;
type Story = StoryObj<typeof meta>;
export const DraggableAgents: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "All 28 shapes start awake in low floor stacks. Watch the first two seconds: the shapes settle slightly from the first frame, with no delayed burst when a cursor first grabs one. Pull an exposed shape slowly from beneath the pile, then sweep quickly across the scene and release. At 2560 by 1440, the held shape should keep up with the pointer and collide with its neighbours. Narrow scenes keep all 28 shapes and let them settle into a crowded pile. Neighbours move immediately. Escape or pointer cancellation returns the held shape. People can take a shape from an active cursor while other cursors keep working. Positions and the loop survive navigation. The board grows with available space while slots and shapes keep their size. Watch OpenCode after Rename icon, and resize during the board session clicks. Reduced motion hides cursors and preserves manual dragging.",
      },
    },
  },
};
export const Narrow: Story = {
  decorators: [
    (Story) => (
      <Box width="80" height="60rem" position="relative">
        <Story />
      </Box>
    ),
  ],
};
