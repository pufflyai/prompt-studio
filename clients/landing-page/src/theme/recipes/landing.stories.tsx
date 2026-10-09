import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { WorkbenchLanding } from "../../components/workbench/workbench-landing";
import { LANDING_PAGES } from "../../content/landing-pages";

const meta = {
  title: "Theme/Landing Pages",
  component: WorkbenchLanding,
  parameters: { layout: "fullscreen" },
  args: { initialPath: "/", pages: LANDING_PAGES, initialDocument: undefined },
} satisfies Meta<typeof WorkbenchLanding>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Desktop: Story = {};
export const CompactDesktop: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Home fits a 1080p desktop with browser chrome, including collapsed window mode. The download column keeps its width; vertical spacing and the editor height are compact.",
      },
    },
  },
};
export const Mobile: Story = {
  decorators: [
    (Story) => (
      <Box width="sm" maxWidth="full">
        <Story />
      </Box>
    ),
  ],
};
export const WhatIsPromptStudio: Story = { args: { initialPath: "/what-is-prompt-studio/" } };
export const Examples: Story = { args: { initialPath: "/examples/coding-agent-dashboard/" } };
export const Features: Story = { args: { initialPath: "/features/" } };
