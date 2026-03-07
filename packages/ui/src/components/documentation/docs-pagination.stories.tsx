import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { DocsPagination } from "./docs-pagination";

const meta = {
  title: "Documentation/DocsPagination",
  component: DocsPagination,
  decorators: [
    (Story) => (
      <Box bg="bg" borderWidth="1px" borderColor="border.secondary" p="6">
        <Story />
      </Box>
    ),
  ],
} satisfies Meta<typeof DocsPagination>;

export default meta;
type Story = StoryObj<typeof meta>;

const previous = {
  href: "#getting-started",
  title: "Getting Started",
  description: "Start your journey with Prompt Studio.",
};

const next = {
  href: "#installation",
  title: "Installation",
  description: "Install the package and get running quickly.",
};

export const Default: Story = {
  args: {
    previous,
    next,
  },
};

export const PreviousOnly: Story = {
  args: {
    previous,
  },
};

export const NextOnly: Story = {
  args: {
    next,
  },
};
