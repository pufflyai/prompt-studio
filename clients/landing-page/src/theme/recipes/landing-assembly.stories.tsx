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
          "All 28 shapes appear in a settled pile directly in the static HTML. Physics starts from those resting positions, independently of desktop downloads. Shape positions, slots, and the loop survive navigation. The board grows with available width and height while its five slots and shapes keep their physical size. Claude, Codex, and OpenCode assemble tools, use the editor, and clear it again. Idle cursors move slowly over short distances. Cursors become compact single-line chat bubbles while typing CLI commands that update the local editor state. People can take a shape while the cursors keep working.",
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
