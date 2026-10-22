import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { KanbanRendererSkeleton } from "./kanban-renderer-skeleton";

const meta: Meta<typeof KanbanRendererSkeleton> = {
  title: "Patterns/Kanban Renderer/Loading",
  component: KanbanRendererSkeleton,
  parameters: { layout: "fullscreen" },
  args: { viewMode: "board" },
  decorators: [
    (Story) => (
      <Box height="100vh">
        <Story />
      </Box>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof KanbanRendererSkeleton>;

export const Board: Story = {};

export const List: Story = { args: { viewMode: "list" } };
