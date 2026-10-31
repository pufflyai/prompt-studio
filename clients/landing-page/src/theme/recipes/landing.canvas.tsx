import { Box } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { WorkbenchLanding } from "../../components/workbench/workbench-landing";
import { LANDING_PAGES } from "../../content/landing-pages";

const meta = {
  title: "Theme/Landing Pages",
  component: WorkbenchLanding,
  fullscreen: true,
  args: { initialPath: "/", pages: LANDING_PAGES, initialDocument: undefined },
} satisfies CanvasMeta<typeof WorkbenchLanding>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const Desktop: Story = {
  id: "theme-landing-pages--desktop",
  description: "The download copy and editor stay vertically centered in the main area on wide desktops.",
};
export const CompactDesktop: Story = {
  id: "theme-landing-pages--compact-desktop",
  description:
    "Home fits a 1080p desktop with browser chrome, including collapsed window mode. The download column keeps its width; vertical spacing and the editor height are compact.",
};
export const SingleColumn: Story = {
  id: "theme-landing-pages--single-column",
  decorators: [
    (Story) => (
      <Box width="1199px" maxWidth="full">
        <Story />
      </Box>
    ),
  ],
  description: "The download panel and editor stack when their main area is below 1200 pixels.",
};
export const Mobile: Story = {
  id: "theme-landing-pages--mobile",
  decorators: [
    (Story) => (
      <Box width="sm" maxWidth="full">
        <Story />
      </Box>
    ),
  ],
};
export const WhatIsPromptStudio: Story = {
  id: "theme-landing-pages--what-is-prompt-studio",
  args: { initialPath: "/what-is-prompt-studio/" },
};
export const Examples: Story = {
  id: "theme-landing-pages--examples",
  args: { initialPath: "/examples/coding-agent-dashboard/" },
};
export const Features: Story = {
  id: "theme-landing-pages--features",
  args: { initialPath: "/features/" },
};
