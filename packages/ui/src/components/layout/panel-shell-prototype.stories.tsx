import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";
import { PanelShellPrototype } from "@/components/layout/panel-shell-prototype";

const meta = {
  title: "Prototypes/Panel Shell",
  component: PanelShellPrototype,
  parameters: { layout: "fullscreen" },
  args: {
    gap: "2xs",
    radius: "sm",
    hoverDelayMs: 250,
    showPanelBorders: true,
    showSecondaryPanel: true,
    showSidePanel: true,
    sidenavCollapsed: false,
    secondaryCollapsed: false,
    sidePanelCollapsed: false,
  },
  argTypes: {
    gap: { control: "select", options: ["3xs", "2xs", "xs"] },
    radius: { control: "select", options: ["xs", "compact", "sm", "md"] },
    hoverDelayMs: { control: { type: "range", min: 0, max: 1000, step: 50 } },
  },
  decorators: [
    (Story: () => ReactNode) => (
      <Box h="100vh" w="100vw" bg="bg">
        <Story />
      </Box>
    ),
  ],
} satisfies Meta<typeof PanelShellPrototype>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const TightestGaps: Story = {
  args: { gap: "3xs", radius: "xs" },
};

export const WiderGaps: Story = {
  args: { gap: "xs", radius: "md" },
};

export const NoPanelBorders: Story = {
  args: { showPanelBorders: false },
};

export const SidenavCollapsed: Story = {
  args: { sidenavCollapsed: true },
};

export const SecondaryAndSideCollapsed: Story = {
  args: { secondaryCollapsed: true, sidePanelCollapsed: true },
};

export const MainOnly: Story = {
  args: { showSecondaryPanel: false, showSidePanel: false },
};
