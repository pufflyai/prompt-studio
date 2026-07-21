import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { StockholmIcon } from "./stockholm-icon";

const meta = {
  title: "Primitives/Stockholm Icon",
  component: StockholmIcon,
  render: () => (
    <Box width="48px" height="48px" color="fg">
      <StockholmIcon />
    </Box>
  ),
} satisfies Meta<typeof StockholmIcon>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
