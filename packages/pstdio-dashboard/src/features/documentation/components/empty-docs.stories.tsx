import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { EmptyDocsContent } from "./empty-docs-content";

const meta: Meta<typeof EmptyDocsContent> = {
  title: "Documentation/EmptyDocs",
  component: EmptyDocsContent,
  decorators: [
    (Story) => (
      <Box minH="100vh" bg="bg" p="6">
        <Story />
      </Box>
    ),
  ],
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

type Story = StoryObj<typeof EmptyDocsContent>;

export const Default: Story = {};

export const OutsideProject: Story = {
  args: {
    canStartSession: false,
  },
};
