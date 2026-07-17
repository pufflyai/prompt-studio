import { Box, Button, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";
import { Header } from "./header";
import { SidePanel } from "./side-panel";

const PanelContent = () => (
  <Stack gap="sm" p="md">
    <Text textStyle="body/S/regular" color="fg.muted">
      Side-panel content stays mounted while its presentation changes.
    </Text>
    <Button alignSelf="start" size="sm">
      Continue
    </Button>
  </Stack>
);

const meta = {
  title: "Components/Layout/Side Panel",
  component: SidePanel,
  decorators: [
    (Story: () => ReactNode) => (
      <Box h="side-panel-height" minW="0" overflow="hidden" bg="bg.muted">
        <Story />
      </Box>
    ),
  ],
} satisfies Meta<typeof SidePanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Docked: Story = {
  args: {
    presentation: "docked",
    "aria-label": "Details",
    header: (
      <Header variant="main" w="full">
        <Text textStyle="label/S/medium">Details</Text>
      </Header>
    ),
    children: <PanelContent />,
  },
};

export const Floating: Story = {
  args: {
    presentation: "floating",
    "aria-label": "Assistant",
    header: (
      <Header variant="main" w="full">
        <Text textStyle="label/S/medium">Assistant</Text>
      </Header>
    ),
    children: <PanelContent />,
  },
};
